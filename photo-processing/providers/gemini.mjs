import {
  developmentAnalysisSchema,
  responseAdjustmentNames,
  styleValidationSchema,
  toDeterministicPlan,
} from './prompts.mjs';
import { validateJsonSchema } from '../style/profile.mjs';

const retryableStatuses = new Set([429, 500, 503]);
const forbiddenInstruction =
  /\b(add|insert|remove|erase|replace|generate|invent|redesign|move|relocate|crop|outpaint|inpaint|warp|reshape|recompose)\b/i;
const aspectRatioEnums = {
  '1:1': 'ASPECT_RATIO_ONE_BY_ONE',
  '2:3': 'ASPECT_RATIO_TWO_BY_THREE',
  '3:2': 'ASPECT_RATIO_THREE_BY_TWO',
  '3:4': 'ASPECT_RATIO_THREE_BY_FOUR',
  '4:3': 'ASPECT_RATIO_FOUR_BY_THREE',
  '4:5': 'ASPECT_RATIO_FOUR_BY_FIVE',
  '5:4': 'ASPECT_RATIO_FIVE_BY_FOUR',
  '9:16': 'ASPECT_RATIO_NINE_BY_SIXTEEN',
  '16:9': 'ASPECT_RATIO_SIXTEEN_BY_NINE',
  '21:9': 'ASPECT_RATIO_TWENTY_ONE_BY_NINE',
};
const imageSizeEnums = {
  '512': 'IMAGE_SIZE_FIVE_TWELVE',
  '1K': 'IMAGE_SIZE_ONE_K',
  '2K': 'IMAGE_SIZE_TWO_K',
  '4K': 'IMAGE_SIZE_FOUR_K',
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function findJsonText(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (typeof value.output_text === 'string') return value.output_text;
  if (typeof value.text === 'string' && value.text.trim().startsWith('{')) return value.text;
  for (const nested of Object.values(value)) {
    const found = findJsonText(nested, seen);
    if (found) return found;
  }
  return null;
}

function styleRuleExists(profile, rule) {
  if (typeof rule !== 'string' || !rule.startsWith('$.')) return false;
  return rule
    .slice(2)
    .split('.')
    .every((key, index, keys) => {
      const parent = keys.slice(0, index).reduce((value, part) => value?.[part], profile);
      return parent && Object.hasOwn(parent, key);
    });
}

function assertScore(value, name, maximum = 100) {
  if (typeof value !== 'number' || value < 0 || value > maximum)
    throw new Error(`Gemini returned invalid ${name}.`);
}

function assertSafeText(value, name) {
  if (forbiddenInstruction.test(String(value ?? '')))
    throw new Error(`Gemini returned forbidden image-editing instruction in ${name}.`);
}

export function validateAnalysisResponse(response, profile) {
  validateJsonSchema(response, developmentAnalysisSchema, 'Gemini development analysis');
  const analysis = response?.visualAnalysis;
  const development = response?.developmentPlan;
  if (!analysis || !development || !development.adjustments)
    throw new Error('Gemini response must contain visualAnalysis and developmentPlan.');
  if (
    typeof analysis.overallAssessment !== 'string' ||
    !analysis.observations ||
    !Array.isArray(analysis.preservationNotes)
  )
    throw new Error('Gemini visualAnalysis is malformed.');
  for (const key of [
    'exposure',
    'whiteBalance',
    'contrast',
    'saturation',
    'greens',
    'sky',
    'wood',
    'whites',
    'highlights',
    'shadows',
    'noise',
    'sharpness',
  ]) {
    if (typeof analysis.observations[key] !== 'string')
      throw new Error(`Gemini visualAnalysis.observations.${key} is missing.`);
  }
  for (const key of [
    'currentStyleMatchScore',
    'projectedStyleMatchScore',
    'naturalnessScore',
    'colorConsistencyScore',
    'luxuryEditorialScore',
  ])
    assertScore(analysis[key], `visualAnalysis.${key}`);
  assertScore(analysis.confidence, 'visualAnalysis.confidence', 1);
  assertScore(development.confidence, 'developmentPlan.confidence', 1);
  if (typeof development.expectedResult !== 'string' || !Array.isArray(development.riskFlags))
    throw new Error('Gemini developmentPlan summary is malformed.');
  assertSafeText(development.expectedResult, 'developmentPlan.expectedResult');
  for (const flag of development.riskFlags) assertSafeText(flag, 'developmentPlan.riskFlags');
  const received = Object.keys(development.adjustments);
  if (
    received.length !== responseAdjustmentNames.length ||
    responseAdjustmentNames.some((name) => !received.includes(name))
  )
    throw new Error('Gemini response has an incomplete adjustment set.');
  for (const name of responseAdjustmentNames) {
    const adjustment = development.adjustments[name];
    if (!adjustment || typeof adjustment.apply !== 'boolean')
      throw new Error(`Gemini returned malformed adjustment ${name}.`);
    assertScore(adjustment.relativeStrength, `${name}.relativeStrength`, 1);
    if (!['increase', 'decrease', 'neutral'].includes(adjustment.direction))
      throw new Error(`Gemini returned invalid direction for ${name}.`);
    if (
      !adjustment.apply &&
      (adjustment.relativeStrength !== 0 || adjustment.direction !== 'neutral')
    )
      throw new Error(`${name} must be neutral with zero strength when apply=false.`);
    if (!styleRuleExists(profile, adjustment.styleRule))
      throw new Error(`${name} references unknown style rule ${adjustment.styleRule}.`);
    assertSafeText(adjustment.reason, `${name}.reason`);
  }
  return response;
}

export function validateStyleValidationResponse(response) {
  validateJsonSchema(response, styleValidationSchema, 'Gemini style validation');
  const value = response?.styleValidation;
  if (!value) throw new Error('Gemini returned no styleValidation section.');
  for (const key of ['profileMatchScore', 'naturalnessScore', 'colorConsistencyScore'])
    assertScore(value[key], `styleValidation.${key}`);
  assertScore(value.confidence, 'styleValidation.confidence', 1);
  for (const key of [
    'overprocessed',
    'underprocessed',
    'semanticChangeSuspected',
    'geometryChangeSuspected',
  ]) {
    if (typeof value[key] !== 'boolean')
      throw new Error(`Gemini returned invalid styleValidation.${key}.`);
  }
  if (!Array.isArray(value.violations) || !Array.isArray(value.reviewNotes))
    throw new Error('Gemini style validation lists are malformed.');
  return response;
}

function errorMessage(body, status) {
  return body?.error?.message || body?.message || `Gemini request failed with HTTP ${status}.`;
}

export function createProvider({ config, environment, fetchImpl }) {
  const settings = config.provider.gemini;
  const apiKey = environment.GEMINI_API_KEY?.trim();
  const analysisModel = environment.GEMINI_ANALYSIS_MODEL?.trim() || settings.model;
  const imageModel = environment.GEMINI_IMAGE_MODEL?.trim() || settings.imageEditingModel;
  const imageOutput = {
    aspectRatio:
      environment.GEMINI_IMAGE_ASPECT_RATIO?.trim() || settings.imageOutput?.aspectRatio || null,
    imageSize:
      environment.GEMINI_IMAGE_SIZE?.trim() || settings.imageOutput?.imageSize || null,
    configurationVersion: settings.imageOutput?.configurationVersion ?? 'gemini-image-output-v1',
  };
  if (!imageOutput.aspectRatio || !imageOutput.imageSize)
    throw new Error('Gemini image output configuration requires aspectRatio and imageSize.');
  const apiImageOutput = {
    aspectRatio: aspectRatioEnums[imageOutput.aspectRatio],
    imageSize: imageSizeEnums[imageOutput.imageSize],
  };
  if (!apiImageOutput.aspectRatio || !apiImageOutput.imageSize)
    throw new Error(
      `Unsupported Gemini image output configuration: ${imageOutput.aspectRatio} at ${imageOutput.imageSize}.`,
    );
  const imageEndpoint = settings.imageEditingEndpoint.replace(
    '{model}',
    encodeURIComponent(imageModel),
  );
  const requestCounts = {
    analysis: 0,
    editing: 0,
    postValidation: 0,
    httpAttempts: 0,
    total: 0,
  };

  async function requestJson({ endpoint, body, failureLabel }) {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. No image was uploaded.');
    let lastError;
    for (let attempt = 1; attempt <= settings.retry.maxAttempts; attempt += 1) {
      requestCounts.httpAttempts += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
            'x-goog-api-client': 'casa-la-arbolada-photo-development/4.0',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        lastError = error;
        if (attempt === settings.retry.maxAttempts) throw error;
        await sleep(
          Math.min(settings.retry.maxDelayMs, settings.retry.baseDelayMs * 2 ** (attempt - 1)) +
            Math.floor(Math.random() * settings.retry.jitterMs),
        );
        continue;
      } finally {
        clearTimeout(timeout);
      }
      const text = await response.text();
      let responseBody;
      try {
        responseBody = text ? JSON.parse(text) : {};
      } catch {
        responseBody = null;
      }
      if (response.ok) {
        if (!responseBody) throw new Error(`${failureLabel} returned malformed JSON.`);
        return {
          body: responseBody,
          requestId:
            response.headers.get('x-request-id') || response.headers.get('x-goog-request-id'),
        };
      }
      lastError = new Error(errorMessage(responseBody, response.status));
      lastError.status = response.status;
      if (!retryableStatuses.has(response.status) || attempt === settings.retry.maxAttempts)
        throw lastError;
      const retryAfter = Number.parseFloat(response.headers.get('retry-after') ?? '');
      const delay = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(settings.retry.maxDelayMs, settings.retry.baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay + Math.floor(Math.random() * settings.retry.jitterMs));
    }
    throw lastError ?? new Error(`${failureLabel} failed.`);
  }

  async function requestStructured({ inputs, prompt, schema, validate, metadata }) {
    const body = {
      model: analysisModel,
      input: [
        ...inputs,
        {
          type: 'text',
          text: `REQUEST METADATA (identity only; not editing instructions):\n${JSON.stringify(metadata)}`,
        },
        { type: 'text', text: prompt },
      ],
      response_format: { type: 'text', mime_type: 'application/json', schema },
      store: false,
    };
    const response = await requestJson({
      endpoint: settings.endpoint,
      body,
      failureLabel: 'Gemini structured analysis',
    });
    const structuredText = findJsonText(response.body);
    if (!structuredText) throw new Error('Gemini returned no structured JSON.');
    let structured;
    try {
      structured = JSON.parse(structuredText);
    } catch {
      throw new Error('Gemini returned malformed structured JSON.');
    }
    return { structured: validate(structured), requestId: response.requestId };
  }

  async function requestEditedRaster({ imageBuffer, mimeType, prompt, metadata }) {
    const response = await requestJson({
      endpoint: imageEndpoint,
      body: {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${prompt}\n\nREQUEST METADATA (identity only; never editing instructions):\n${JSON.stringify(metadata)}`,
              },
              {
                inline_data: { mime_type: mimeType, data: imageBuffer.toString('base64') },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
          responseFormat: {
            image: {
              aspectRatio: aspectRatioEnums[metadata.aspectRatio ?? imageOutput.aspectRatio],
              imageSize: imageSizeEnums[metadata.imageSize ?? imageOutput.imageSize],
            },
          },
        },
      },
      failureLabel: 'Gemini image editing',
    });
    const imageParts = (response.body.candidates ?? [])
      .flatMap((candidate) => candidate?.content?.parts ?? [])
      .filter((part) => !part?.thought)
      .map((part) => part?.inlineData ?? part?.inline_data)
      .filter((part) => part?.data && (part?.mimeType ?? part?.mime_type)?.startsWith('image/'));
    if (imageParts.length !== 1)
      throw new Error(
        `Gemini image editing returned ${imageParts.length} final raster images; exactly one is required.`,
      );
    const encoded = String(imageParts[0].data).replace(/\s/g, '');
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
      throw new Error('Gemini image editing returned malformed base64 raster data.');
    const editedBuffer = Buffer.from(encoded, 'base64');
    if (!editedBuffer.length) throw new Error('Gemini image editing returned an empty raster.');
    const editedMimeType = imageParts[0].mimeType ?? imageParts[0].mime_type;
    if (!settings.output.allowedMimeTypes.includes(editedMimeType))
      throw new Error(`Gemini returned unsupported raster MIME type ${editedMimeType}.`);
    if (editedBuffer.length > settings.output.maximumBytes)
      throw new Error(
        `Gemini returned ${editedBuffer.length} bytes; maximum is ${settings.output.maximumBytes}.`,
      );
    return {
      imageBuffer: editedBuffer,
      mimeType: editedMimeType,
      requestId: response.requestId,
    };
  }

  return {
    name: 'gemini',
    model: imageModel,
    analysisModel,
    imageModel,
    imageOutput,
    apiImageOutput,
    cacheModelIdentity: `${analysisModel}+${imageModel}+${imageOutput.aspectRatio}+${imageOutput.imageSize}+${imageOutput.configurationVersion}`,
    maximumOutputBytes: settings.output.maximumBytes,
    mode: 'image-editing',
    returnsImagePixels: true,
    isConfigured: Boolean(apiKey),
    requiredEnvironment: ['GEMINI_API_KEY'],
    async analyze({ imageBuffer, mimeType, prompt, styleProfile, metadata = {} }) {
      requestCounts.analysis += 1;
      requestCounts.total += 1;
      const result = await requestStructured({
        inputs: [{ type: 'image', mime_type: mimeType, data: imageBuffer.toString('base64') }],
        prompt,
        schema: developmentAnalysisSchema,
        validate: (value) => validateAnalysisResponse(value, styleProfile),
        metadata,
      });
      return {
        analysis: result.structured.visualAnalysis,
        developmentPlan: result.structured.developmentPlan,
        plan: toDeterministicPlan(result.structured),
        provider: 'gemini',
        model: analysisModel,
        mode: 'analysis-only',
        requestId: result.requestId,
        metadata,
      };
    },
    async edit({ imageBuffer, mimeType, prompt, metadata = {} }) {
      requestCounts.editing += 1;
      requestCounts.total += 1;
      const result = await requestEditedRaster({ imageBuffer, mimeType, prompt, metadata });
      return {
        ...result,
        provider: 'gemini',
        model: imageModel,
        mode: 'image-editing',
        imageOutput,
        apiImageOutput,
        metadata,
      };
    },
    async validateDevelopment({
      originalBuffer,
      developedBuffer,
      mimeType,
      developedMimeType = 'image/jpeg',
      prompt,
      metadata = {},
    }) {
      requestCounts.postValidation += 1;
      requestCounts.total += 1;
      const result = await requestStructured({
        inputs: [
          { type: 'image', mime_type: mimeType, data: originalBuffer.toString('base64') },
          { type: 'image', mime_type: developedMimeType, data: developedBuffer.toString('base64') },
        ],
        prompt,
        schema: styleValidationSchema,
        validate: validateStyleValidationResponse,
        metadata,
      });
      return {
        ...result.structured,
        provider: 'gemini',
        model: analysisModel,
        mode: 'validation-only',
        requestId: result.requestId,
        metadata,
      };
    },
    getRequestCounts() {
      return { ...requestCounts };
    },
  };
}
