import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  buildCacheIdentity,
  buildNormalizedCacheIdentity,
  canReuseDevelopedCacheEntry,
  canReusePostAnalysisCacheEntry,
} from '../photo-processing/cache.mjs';
import { developPhotograph, developerVersion } from '../photo-processing/developer.mjs';
import {
  createPilotReviewState,
  evaluateFullRunGate,
  syncPilotReviewState,
  validatePilotComposition,
} from '../photo-processing/pilot.mjs';
import {
  evaluatePostValidation,
  reclassifyPilotResults,
} from '../photo-processing/post-validation.mjs';
import {
  normalizationAlgorithm,
  normalizationVersion,
  persistProviderRaster,
  providerRasterProcessorVersion,
  validateRasterGeometry,
} from '../photo-processing/provider-raster.mjs';
import { assessQuality } from '../photo-processing/quality.mjs';
import {
  createProvider,
  validateAnalysisResponse,
  validateStyleValidationResponse,
} from '../photo-processing/providers/gemini.mjs';
import {
  adjustmentOperations,
  buildEditPrompt,
  responseAdjustmentNames,
} from '../photo-processing/providers/prompts.mjs';
import {
  buildStructuredDevelopmentPlan,
  developmentPromptTemplateVersion,
  loadDevelopmentProfiles,
  selectDevelopmentProfile,
  sourceLabelFromVisualAnalysis,
} from '../photo-processing/profiles/profile.mjs';
import {
  canonicalize,
  loadStyleProfile,
  styleProfileSha256,
  validateStyleProfile,
} from '../photo-processing/style/profile.mjs';
import { loadWorkflow } from '../scripts/photo-workflow-lib.mjs';
import { isTechnicalReviewCandidate } from '../photo-processing/review-image-set.mjs';
import { isGeminiReviewBuild, selectGeminiReviewImages } from '../src/data/image-set.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const config = JSON.parse(
  await fs.readFile(path.join(projectRoot, 'photo-processing/config.json'), 'utf8'),
);
const schema = JSON.parse(
  await fs.readFile(path.join(projectRoot, config.style.schemaPath), 'utf8'),
);
const style = await loadStyleProfile({ root: projectRoot, config, environment: {} });
const developmentProfiles = await loadDevelopmentProfiles({ root: projectRoot });

function profileDirective(
  record,
  sourceAnalysisLabel,
  visualAnalysis = responseFixture().visualAnalysis,
) {
  const selection = selectDevelopmentProfile({
    profiles: developmentProfiles,
    record,
    sourceAnalysisLabel,
  });
  return buildStructuredDevelopmentPlan({ selection, visualAnalysis });
}

function pilotResult(id, masterSha256 = `${id}-master`) {
  const cacheIdentity = buildCacheIdentity({
    sourceSha256: `${id}-source`,
    styleProfileSha256: style.sha256,
    developerVersion,
    providerModel: 'gemini-3.6-flash',
    promptVersion: 'la-arbolada-style-development-v3',
  });
  return {
    catalogId: id,
    sourceSha256: `${id}-source`,
    masterSha256,
    styleProfile: { profileId: style.profileId, version: style.version, sha256: style.sha256 },
    cacheIdentity,
    postAnalysisPromptVersion: 'la-arbolada-style-validation-v1',
    provider: { model: 'gemini-3.6-flash' },
    promptVersion: 'la-arbolada-style-development-v3',
  };
}

function responseFixture() {
  const observations = Object.fromEntries(
    [
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
    ].map((key) => [key, 'Natural and preserved.']),
  );
  return {
    visualAnalysis: {
      overallAssessment: 'Safe photometric development.',
      currentStyleMatchScore: 80,
      projectedStyleMatchScore: 91,
      naturalnessScore: 94,
      colorConsistencyScore: 90,
      luxuryEditorialScore: 88,
      observations,
      preservationNotes: ['Preserve all content.'],
      confidence: 0.92,
    },
    developmentPlan: {
      adjustments: Object.fromEntries(
        responseAdjustmentNames.map((name) => [
          name,
          {
            apply: false,
            direction: 'neutral',
            relativeStrength: 0,
            reason: 'Already matches the target.',
            styleRule:
              name === 'greens'
                ? '$.colors.greens.target'
                : name === 'sky'
                  ? '$.colors.sky.target'
                  : `$.global.${{ whiteBalance: 'whiteBalance', localContrast: 'localContrast', highlights: 'highlights', shadows: 'shadows', noiseReduction: 'noiseReduction', sharpness: 'sharpness', vibrance: 'vibrance', saturation: 'saturation', contrast: 'contrast', exposure: 'exposure', wood: 'whiteBalance', whites: 'whiteBalance' }[name]}`,
          },
        ]),
      ),
      expectedResult: 'A natural, restrained development of the same photograph.',
      riskFlags: [],
      confidence: 0.9,
    },
  };
}

function localQualityFixture(overrides = {}) {
  return {
    sourceDimensions: { width: 100, height: 80 },
    outputDimensions: { width: 100, height: 80 },
    aspectRatioDelta: 0,
    semanticValidation: {
      status: 'Passed',
      violations: [],
      geometryOperationsApplied: false,
      pixelCoordinateMapping: 'identity',
    },
    ...overrides,
  };
}

function validationFixture(overrides = {}) {
  return {
    styleValidation: {
      profileMatchScore: 90,
      naturalnessScore: 90,
      colorConsistencyScore: 90,
      overprocessed: false,
      underprocessed: false,
      semanticChangeSuspected: false,
      geometryChangeSuspected: false,
      violations: [],
      reviewNotes: [],
      confidence: 0.9,
      ...overrides,
    },
  };
}

async function geometryFixture(width = 96, height = 64) {
  const svg =
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#d9d1bb"/>
    <rect x="4" y="5" width="31" height="19" fill="#243b2e"/>
    <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.3)}" r="9" fill="#9d4d32"/>
    <path d="M8 ${height - 8} L${Math.round(width * 0.48)} ${Math.round(height * 0.45)} L${width - 7} ${height - 14}" fill="none" stroke="#355f8a" stroke-width="4"/>
    <rect x="${Math.round(width * 0.57)}" y="${Math.round(height * 0.58)}" width="${Math.round(width * 0.3)}" height="${Math.round(height * 0.24)}" fill="#786446"/>
  </svg>`);
  return sharp(svg).png().toBuffer();
}

function artifactPaths(directory, returnedExtension = 'png') {
  return {
    originalPath: path.join(directory, 'original.jpg'),
    providerOutputPath: path.join(directory, `gemini-returned.${returnedExtension}`),
    developedPath: path.join(directory, 'normalized.jpg'),
  };
}

test('style profile passes schema and canonical lock validation', () => {
  assert.equal(validateStyleProfile(style.profile, schema, config.lockedImages), style.profile);
  assert.equal(style.profileId, 'casa-la-arbolada');
  assert.equal(style.version, '1.0.0');
});

test('missing style profile fails closed', async () => {
  await assert.rejects(
    loadStyleProfile({
      root: projectRoot,
      config: { ...config, style: { ...config.style, profilePath: 'missing-style.json' } },
      environment: {},
    }),
    /missing or malformed/,
  );
});

test('style hash is deterministic and changed style invalidates cache identity', () => {
  const reordered = Object.fromEntries(Object.entries(style.profile).reverse());
  assert.equal(styleProfileSha256(reordered), style.sha256);
  assert.equal(canonicalize(reordered), canonicalize(style.profile));
  const changedHash = styleProfileSha256({ ...style.profile, version: '1.0.1' });
  const base = {
    sourceSha256: 'a'.repeat(64),
    developerVersion,
    providerModel: 'gemini-test',
    promptVersion: 'prompt-v1',
  };
  assert.notEqual(
    buildCacheIdentity({ ...base, styleProfileSha256: style.sha256 }).sha256,
    buildCacheIdentity({ ...base, styleProfileSha256: changedHash }).sha256,
  );
});

test('image output model and requested 4:3 4K configuration invalidate edit cache identity', () => {
  const base = {
    sourceSha256: 'f'.repeat(64),
    styleProfileSha256: style.sha256,
    developerVersion: providerRasterProcessorVersion,
    providerModel: 'gemini-3.6-flash+gemini-3-pro-image+4:3+4K',
    promptVersion: 'analysis-v4+edit-v4',
    imageOutputConfig: { aspectRatio: '4:3', imageSize: '4K' },
  };
  const identity = buildCacheIdentity(base).sha256;
  assert.notEqual(
    identity,
    buildCacheIdentity({ ...base, imageOutputConfig: { aspectRatio: '4:3', imageSize: '2K' } })
      .sha256,
  );
  assert.notEqual(
    identity,
    buildCacheIdentity({ ...base, providerModel: 'gemini-3.6-flash+gemini-3.1-flash-image+4:3+4K' })
      .sha256,
  );
});

test('Gemini response schema, adjustment bounds, and style rules are enforced', () => {
  assert.doesNotThrow(() => validateAnalysisResponse(responseFixture(), style.profile));
  const missing = responseFixture();
  delete missing.visualAnalysis.observations.sky;
  assert.throws(() => validateAnalysisResponse(missing, style.profile), /observations.sky/);
  const outOfBounds = responseFixture();
  outOfBounds.developmentPlan.adjustments.exposure = {
    ...outOfBounds.developmentPlan.adjustments.exposure,
    apply: true,
    direction: 'increase',
    relativeStrength: 1.1,
  };
  assert.throws(() => validateAnalysisResponse(outOfBounds, style.profile), /relativeStrength/);
});

test('post-validation schema requires structured violations with evidence', () => {
  const supported = validationFixture({
    violations: [
      {
        ruleId: '$.colors.wood.forbid[0]',
        description: 'A red cast is visible on neutral wall surfaces.',
        evidence: 'The wall beside the fireplace shifts from neutral cream to saturated red.',
        confidence: 0.91,
      },
    ],
  });
  assert.doesNotThrow(() => validateStyleValidationResponse(supported));
  assert.throws(
    () => validateStyleValidationResponse(validationFixture({ violations: ['red cast'] })),
    /expected object/,
  );
  const missingEvidence = structuredClone(supported);
  delete missingEvidence.styleValidation.violations[0].evidence;
  assert.throws(() => validateStyleValidationResponse(missingEvidence), /evidence/);
  const emptyEvidence = structuredClone(supported);
  emptyEvidence.styleValidation.violations[0].evidence = '';
  assert.throws(() => validateStyleValidationResponse(emptyEvidence), /too short/);
});

test('forbidden Gemini image-generation or content-edit instructions fail closed', () => {
  const response = responseFixture();
  response.developmentPlan.adjustments.exposure = {
    ...response.developmentPlan.adjustments.exposure,
    apply: true,
    direction: 'increase',
    relativeStrength: 0.2,
    reason: 'Remove the chair first.',
  };
  assert.throws(() => validateAnalysisResponse(response, style.profile), /forbidden/);
});

test('Gemini requests are stateless, JSON-only, and carry style identity metadata', async () => {
  let requestBody;
  const provider = createProvider({
    config,
    environment: { GEMINI_API_KEY: 'test-key' },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ output_text: JSON.stringify(responseFixture()) }), {
        status: 200,
        headers: { 'x-request-id': 'offline-test' },
      });
    },
  });
  await provider.analyze({
    imageBuffer: Buffer.from('synthetic-image'),
    mimeType: 'image/jpeg',
    prompt: 'Analyze only.',
    styleProfile: style.profile,
    metadata: { styleProfileSha256: style.sha256 },
  });
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.response_format.type, 'text');
  assert.equal(requestBody.response_format.mime_type, 'application/json');
  assert.match(requestBody.input.at(-2).text, new RegExp(style.sha256));
  assert.equal(requestBody.response_format.type === 'image', false);
});

test('Gemini image editing sends one approved source and returns exactly one raster', async () => {
  const editedRaster = await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 130, g: 120, b: 105 } },
  })
    .png()
    .toBuffer();
  let requestUrl;
  let requestBody;
  const provider = createProvider({
    config,
    environment: { GEMINI_API_KEY: 'test-key' },
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: editedRaster.toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'x-goog-request-id': 'mock-edit' } },
      );
    },
  });
  const result = await provider.edit({
    imageBuffer: Buffer.from('approved-source'),
    mimeType: 'image/jpeg',
    prompt: 'Develop only the existing photograph.',
    metadata: { catalogId: 'synthetic-approved', aspectRatio: '4:3' },
  });
  assert.match(requestUrl, /\/v1\/models\/gemini-3-pro-image:generateContent$/);
  assert.deepEqual(requestBody.generationConfig.responseModalities, ['IMAGE']);
  assert.deepEqual(requestBody.generationConfig.responseFormat, {
    image: {
      aspectRatio: 'ASPECT_RATIO_FOUR_BY_THREE',
      imageSize: 'IMAGE_SIZE_FOUR_K',
    },
  });
  assert.equal(requestBody.contents.length, 1);
  assert.equal(requestBody.contents[0].parts.filter((part) => part.inline_data).length, 1);
  assert.equal(requestBody.contents[0].parts[1].inline_data.mime_type, 'image/jpeg');
  assert.deepEqual(result.imageBuffer, editedRaster);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.requestId, 'mock-edit');
  assert.deepEqual(result.imageOutput, {
    aspectRatio: '4:3',
    imageSize: '4K',
    configurationVersion: 'gemini-image-output-v2',
  });
  assert.equal(provider.mode, 'image-editing');
  assert.equal(provider.returnsImagePixels, true);
  assert.deepEqual(provider.getRequestCounts(), {
    analysis: 0,
    editing: 1,
    postValidation: 0,
    httpAttempts: 1,
    total: 1,
  });
});

test('Gemini image editing fails closed when no unique final raster is returned', async () => {
  const provider = createProvider({
    config,
    environment: { GEMINI_API_KEY: 'test-key' },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'No image' }] } }] }),
        {
          status: 200,
        },
      ),
  });
  await assert.rejects(
    provider.edit({
      imageBuffer: Buffer.from('approved-source'),
      mimeType: 'image/jpeg',
      prompt: 'Develop only.',
    }),
    /exactly one is required/,
  );
});

test('provider raster, original input, and normalized JPEG are separate exact-role artifacts', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'la-arbolada-provider-raster-'));
  const paths = artifactPaths(temporary);
  const original = await sharp(await geometryFixture())
    .jpeg({ quality: 98 })
    .toBuffer();
  const raster = await sharp(original).modulate({ brightness: 1.02 }).png().toBuffer();
  const persisted = await persistProviderRaster({
    originalBuffer: original,
    originalPath: paths.originalPath,
    imageBuffer: raster,
    mimeType: 'image/png',
    providerOutputPath: paths.providerOutputPath,
    developedPath: paths.developedPath,
    maximumBytes: 1_000_000,
    expectedDimensions: { width: 96, height: 64 },
  });
  assert.deepEqual(await fs.readFile(paths.originalPath), original);
  assert.deepEqual(await fs.readFile(paths.providerOutputPath), raster);
  assert.deepEqual(persisted.providerOutputDimensions, { width: 96, height: 64 });
  assert.equal(persisted.pixelCoordinateMapping, 'identity');
  assert.equal(persisted.geometryOperationsApplied, false);
  assert.equal(persisted.normalization.required, false);
  const metadata = await sharp(paths.developedPath).metadata();
  assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 96, height: 64 });
  assert.match(persisted.formatConversion, /dimensions unchanged/);
});

for (const [label, returnedWidth, returnedHeight, direction] of [
  ['smaller', 48, 32, 'upscaled'],
  ['larger', 192, 128, 'downscaled'],
]) {
  test(`returned image ${label} than original is uniformly normalized before metrics`, async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), `la-arbolada-${label}-`));
    const paths = artifactPaths(temporary);
    const original = await sharp(await geometryFixture())
      .jpeg({ quality: 98 })
      .toBuffer();
    const returned = await sharp(original)
      .resize(returnedWidth, returnedHeight, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    const result = await persistProviderRaster({
      originalBuffer: original,
      originalPath: paths.originalPath,
      imageBuffer: returned,
      mimeType: 'image/png',
      providerOutputPath: paths.providerOutputPath,
      developedPath: paths.developedPath,
      maximumBytes: 1_000_000,
      expectedDimensions: { width: 96, height: 64 },
    });
    assert.deepEqual(result.providerOutputDimensions, {
      width: returnedWidth,
      height: returnedHeight,
    });
    assert.deepEqual(result.finalDimensions, { width: 96, height: 64 });
    assert.equal(result.normalization.required, true);
    assert.equal(result.normalization.algorithm, normalizationAlgorithm);
    assert.equal(result.normalization.direction, direction);
    assert.equal(result.normalization.crop, false);
    assert.equal(result.normalization.padding, false);
    assert.equal(result.normalization.stretch, false);
  });
}

test('an exact 4:3 provider raster is accepted and proportionally normalized', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'la-arbolada-exact-4x3-'));
  const paths = artifactPaths(temporary);
  const original = await sharp(await geometryFixture(96, 72)).jpeg({ quality: 98 }).toBuffer();
  const returned = await sharp(original)
    .resize(480, 360, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const result = await persistProviderRaster({
    originalBuffer: original,
    originalPath: paths.originalPath,
    imageBuffer: returned,
    mimeType: 'image/png',
    providerOutputPath: paths.providerOutputPath,
    developedPath: paths.developedPath,
    maximumBytes: 1_000_000,
    expectedDimensions: { width: 96, height: 72 },
  });
  assert.deepEqual(result.providerOutputDimensions, { width: 480, height: 360 });
  assert.deepEqual(result.finalDimensions, { width: 96, height: 72 });
  assert.equal(result.geometryValidation.status, 'passed');
  assert.equal(result.normalization.status, 'normalized');
  assert.equal(result.normalization.crop, false);
  assert.equal(result.normalization.padding, false);
  assert.equal(result.normalization.stretch, false);
});

test('different aspect ratio is rejected before normalization', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'la-arbolada-aspect-'));
  const paths = artifactPaths(temporary);
  const original = await geometryFixture();
  const returned = await sharp(original).resize(50, 32, { fit: 'fill' }).png().toBuffer();
  await assert.rejects(
    persistProviderRaster({
      originalBuffer: original,
      originalPath: paths.originalPath,
      imageBuffer: returned,
      mimeType: 'image/png',
      providerOutputPath: paths.providerOutputPath,
      developedPath: paths.developedPath,
      maximumBytes: 1_000_000,
      expectedDimensions: { width: 96, height: 64 },
    }),
    /aspect ratio differs/,
  );
  assert.deepEqual(await fs.readFile(paths.originalPath), original);
  assert.deepEqual(await fs.readFile(paths.providerOutputPath), returned);
  await assert.rejects(fs.access(paths.developedPath), /ENOENT/);
});

test('rotated raster is rejected before normalization', async () => {
  const original = await geometryFixture();
  const returned = await sharp(original).rotate(180).png().toBuffer();
  await assert.rejects(
    validateRasterGeometry({
      originalBuffer: original,
      returnedBuffer: returned,
      originalDimensions: { width: 96, height: 64 },
      returnedDimensions: { width: 96, height: 64 },
    }),
    /appears rotated/,
  );
});

test('mirrored raster is rejected before normalization', async () => {
  const original = await geometryFixture();
  const returned = await sharp(original).flop().png().toBuffer();
  await assert.rejects(
    validateRasterGeometry({
      originalBuffer: original,
      returnedBuffer: returned,
      originalDimensions: { width: 96, height: 64 },
      returnedDimensions: { width: 96, height: 64 },
    }),
    /appears mirrored/,
  );
});

test('cropped raster is rejected before normalization', async () => {
  const original = await geometryFixture();
  const returned = await sharp(original)
    .extract({ left: 12, top: 8, width: 72, height: 48 })
    .resize(96, 64, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  await assert.rejects(
    validateRasterGeometry({
      originalBuffer: original,
      returnedBuffer: returned,
      originalDimensions: { width: 96, height: 64 },
      returnedDimensions: { width: 96, height: 64 },
    }),
    /appears cropped/,
  );
});

test('normalization identity invalidates when algorithm, version, or returned dimensions change', () => {
  const requestCacheIdentity = buildCacheIdentity({
    sourceSha256: 'c'.repeat(64),
    styleProfileSha256: style.sha256,
    developerVersion: 'provider-edit-v1',
    providerModel: 'analysis+image',
    promptVersion: 'analysis+edit',
  });
  const base = {
    requestCacheIdentity,
    returnedRasterDimensions: { width: 1200, height: 800 },
    normalizationAlgorithm,
    normalizationVersion,
  };
  const identity = buildNormalizedCacheIdentity(base);
  assert.notEqual(
    identity.sha256,
    buildNormalizedCacheIdentity({ ...base, normalizationAlgorithm: 'other-kernel' }).sha256,
  );
  assert.notEqual(
    identity.sha256,
    buildNormalizedCacheIdentity({ ...base, normalizationVersion: 'v-next' }).sha256,
  );
  assert.notEqual(
    identity.sha256,
    buildNormalizedCacheIdentity({
      ...base,
      returnedRasterDimensions: { width: 2400, height: 1600 },
    }).sha256,
  );
});

test('quality metrics reject any raster that has not completed normalization', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'la-arbolada-metrics-order-'));
  const originalPath = path.join(temporary, 'original.png');
  const normalizedPath = path.join(temporary, 'normalized.jpg');
  const original = await geometryFixture();
  await fs.writeFile(originalPath, original);
  await sharp(original).jpeg({ quality: 98 }).toFile(normalizedPath);
  await assert.rejects(
    assessQuality({
      sourcePath: originalPath,
      processedPath: normalizedPath,
      thresholds: config.qualityControl.thresholds,
      invariants: {},
    }),
    /completed deterministic normalization stage/,
  );
  const quality = await assessQuality({
    sourcePath: originalPath,
    processedPath: normalizedPath,
    thresholds: config.qualityControl.thresholds,
    invariants: {
      geometryOperationsApplied: false,
      pixelCoordinateMapping: 'identity',
      normalization: { status: 'normalized' },
      geometryValidation: { status: 'passed' },
    },
  });
  assert.deepEqual(quality.sourceDimensions, quality.outputDimensions);
});

test('image-edit prompt binds style, adaptive plan, and immutable photograph constraints', () => {
  const response = responseFixture();
  const record = { id: 'casa-fachada2', classification: 'exterior', originalName: 'fachada2.HEIC' };
  const directive = profileDirective(record, 'exterior', response.visualAnalysis);
  const prompt = buildEditPrompt(
    record,
    style,
    response.developmentPlan,
    directive,
    response.visualAnalysis,
  );
  assert.match(prompt.prompt, new RegExp(style.sha256));
  assert.match(
    prompt.prompt,
    /Apply the following photographic development to the supplied photograph/,
  );
  assert.match(prompt.prompt, /Return exactly one final edited raster image/);
  assert.match(prompt.prompt, /Do not add, remove, replace, relocate, redesign, restage/);
  assert.match(prompt.prompt, /do not apply that adjustment/);
  assert.equal(prompt.promptVersion, developmentPromptTemplateVersion);
  assert.equal(prompt.developmentProfile.id, 'facade');
  assert.deepEqual(prompt.structuredDevelopmentPlan, directive);
  assert.equal(prompt.structuredDevelopmentPlanSha256, directive.sha256);
});

test('facade, patio, bathroom, and unknown categories select deterministic profiles', () => {
  const cases = [
    [
      { id: 'casa-fachada2', classification: 'exterior', originalName: 'fachada2.HEIC' },
      'exterior',
      'facade',
    ],
    [{ id: 'casa-patio11', classification: 'park', originalName: 'patio11.HEIC' }, 'park', 'patio'],
    [
      { id: 'casa-banio1', classification: 'interior mixed lighting', originalName: 'banio1.HEIC' },
      'bathroom',
      'bathroom',
    ],
    [
      { id: 'casa-unknown', classification: 'detail', originalName: 'unknown.HEIC' },
      'detail',
      'default',
    ],
  ];
  for (const [record, sourceAnalysisLabel, expected] of cases) {
    const selected = selectDevelopmentProfile({
      profiles: developmentProfiles,
      record,
      sourceAnalysisLabel,
    });
    assert.equal(selected.profileId, expected);
    assert.ok(selected.selectionReason);
    assert.equal(selected.sourceAnalysisLabel, sourceAnalysisLabel);
  }
});

test('category aliases map to the intended photographic profiles', () => {
  for (const [label, expected] of [
    ['frontage', 'facade'],
    ['terrace', 'patio'],
    ['washroom', 'bathroom'],
    ['kitchen', 'kitchen'],
    ['lounge', 'living-room'],
    ['sitting room', 'living-room'],
    ['bedroom', 'bedroom'],
    ['yard', 'garden'],
    ['swimming pool', 'pool'],
  ]) {
    const selection = selectDevelopmentProfile({
      profiles: developmentProfiles,
      record: { id: 'synthetic', classification: 'detail', originalName: 'synthetic.HEIC' },
      sourceAnalysisLabel: label,
    });
    assert.equal(selection.profileId, expected, label);
  }
});

test('existing visual analysis supplies a deterministic category without another request', () => {
  const sourceAnalysisLabel = sourceLabelFromVisualAnalysis(
    { overallAssessment: 'A clean kitchen interior with cabinetry and a countertop.' },
    'detail',
  );
  const selection = selectDevelopmentProfile({
    profiles: developmentProfiles,
    record: { id: 'synthetic', classification: 'detail', originalName: 'synthetic.HEIC' },
    sourceAnalysisLabel,
  });
  assert.equal(sourceAnalysisLabel, 'kitchen');
  assert.equal(selection.profileId, 'kitchen');
  assert.match(selection.selectionReason, /analysis label/);
  assert.equal(
    sourceLabelFromVisualAnalysis(
      { overallAssessment: 'An ambiguous architectural detail with no room label.' },
      'detail',
    ),
    'detail',
  );
});

test('flare cleanup appears only when optical flare is detected', () => {
  const record = {
    id: 'casa-banio1',
    classification: 'interior mixed lighting',
    originalName: 'banio1.HEIC',
  };
  const clean = responseFixture();
  clean.visualAnalysis.overallAssessment =
    'A clean bathroom with even light and no visible optical artifacts.';
  const cleanPlan = profileDirective(record, 'bathroom', clean.visualAnalysis);
  const cleanPrompt = buildEditPrompt(
    record,
    style,
    clean.developmentPlan,
    cleanPlan,
    clean.visualAnalysis,
  );
  assert.doesNotMatch(cleanPrompt.prompt, /Remove only the detected optical lens flare/);
  const flare = responseFixture();
  flare.visualAnalysis.overallAssessment =
    'A circular lens flare and veiling glare obscure part of the vanity.';
  const flarePlan = profileDirective(record, 'bathroom', flare.visualAnalysis);
  const flarePrompt = buildEditPrompt(
    record,
    style,
    flare.developmentPlan,
    flarePlan,
    flare.visualAnalysis,
  );
  assert.match(flarePrompt.prompt, /Remove only the detected optical lens flare/);
  assert.ok(flarePlan.specialActions.some((item) => /flare|glare/i.test(item)));
});

test('grass and marble directions appear only when those materials are detected', () => {
  const facadeRecord = {
    id: 'casa-fachada2',
    classification: 'exterior',
    originalName: 'fachada2.HEIC',
  };
  const plainFacade = responseFixture();
  const plainPlan = profileDirective(facadeRecord, 'exterior', plainFacade.visualAnalysis);
  assert.equal(
    plainPlan.materialActions.some((item) => item.material === 'grass'),
    false,
  );
  const grassFacade = responseFixture();
  grassFacade.visualAnalysis.observations.greens = 'Existing grass and lawn are dull but visible.';
  const grassPlan = profileDirective(facadeRecord, 'exterior', grassFacade.visualAnalysis);
  assert.ok(grassPlan.materialActions.some((item) => item.material === 'grass'));

  const bathroomRecord = {
    id: 'casa-banio1',
    classification: 'interior mixed lighting',
    originalName: 'banio1.HEIC',
  };
  const plainBathroom = responseFixture();
  const plainMarblePlan = profileDirective(
    bathroomRecord,
    'bathroom',
    plainBathroom.visualAnalysis,
  );
  assert.equal(
    plainMarblePlan.materialActions.some((item) => item.material === 'marble'),
    false,
  );
  const marbleBathroom = responseFixture();
  marbleBathroom.visualAnalysis.overallAssessment =
    'Dark green marble is present around the vanity.';
  const marblePlan = profileDirective(bathroomRecord, 'bathroom', marbleBathroom.visualAnalysis);
  assert.ok(marblePlan.materialActions.some((item) => item.material === 'marble'));
});

test('already oversaturated analysis suppresses aggressive saturation increases', () => {
  const response = responseFixture();
  response.visualAnalysis.observations.saturation =
    'The image is already highly saturated and too vibrant.';
  const plan = profileDirective(
    { id: 'casa-fachada2', classification: 'exterior', originalName: 'fachada2.HEIC' },
    'exterior',
    response.visualAnalysis,
  );
  assert.equal(plan.adjustments.saturation.direction, 'decrease');
  assert.notEqual(plan.adjustments.saturation.intensity, 'strong');
  assert.ok(
    plan.imageSpecificAdaptations.some((item) => item.id === 'protect-existing-saturation'),
  );
});

test('final development prompt contains every structural preservation rule', () => {
  const response = responseFixture();
  const record = { id: 'casa-fachada2', classification: 'exterior', originalName: 'fachada2.HEIC' };
  const plan = profileDirective(record, 'exterior', response.visualAnalysis);
  const prompt = buildEditPrompt(
    record,
    style,
    response.developmentPlan,
    plan,
    response.visualAnalysis,
  ).prompt;
  for (const expected of [
    'exact scene',
    'architecture',
    'room layout',
    'object count',
    'furniture placement',
    'openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon',
    'camera position, perspective, framing, lens, focal length, crop, proportions, or composition',
    'fake sunlight, fake lamps, fake landscaping',
    'text, people, vehicles, furniture, plants, decorations, or building elements',
  ])
    assert.match(prompt, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('profile content, version, prompt template, and structured plan invalidate edit cache', () => {
  const response = responseFixture();
  const record = { id: 'casa-fachada2', classification: 'exterior', originalName: 'fachada2.HEIC' };
  const plan = profileDirective(record, 'exterior', response.visualAnalysis);
  const base = {
    sourceSha256: 'd'.repeat(64),
    styleProfileSha256: style.sha256,
    developerVersion: 'provider-edit-v1',
    providerModel: 'analysis+image',
    promptVersion: 'analysis+edit',
    developmentProfileId: plan.profileId,
    developmentProfileVersion: plan.profileVersion,
    developmentProfileSha256: plan.profileSha256,
    promptTemplateVersion: developmentPromptTemplateVersion,
    structuredDevelopmentPlanSha256: plan.sha256,
  };
  const identity = buildCacheIdentity(base).sha256;
  assert.notEqual(
    identity,
    buildCacheIdentity({ ...base, developmentProfileSha256: 'e'.repeat(64) }).sha256,
  );
  assert.notEqual(
    identity,
    buildCacheIdentity({ ...base, developmentProfileVersion: plan.profileVersion + 1 }).sha256,
  );
  assert.notEqual(
    identity,
    buildCacheIdentity({ ...base, promptTemplateVersion: 'template-v-next' }).sha256,
  );
  assert.notEqual(
    identity,
    buildCacheIdentity({ ...base, structuredDevelopmentPlanSha256: 'f'.repeat(64) }).sha256,
  );
});

test('profile audit data is carried into prompts, pipeline results, and reports', async () => {
  const response = responseFixture();
  const record = { id: 'casa-fachada2', classification: 'exterior', originalName: 'fachada2.HEIC' };
  const plan = profileDirective(record, 'exterior', response.visualAnalysis);
  const prompt = buildEditPrompt(
    record,
    style,
    response.developmentPlan,
    plan,
    response.visualAnalysis,
  );
  assert.equal(prompt.developmentProfile.id, 'facade');
  assert.equal(prompt.structuredDevelopmentPlan.sha256, plan.sha256);
  assert.equal(prompt.promptTemplateVersion, developmentPromptTemplateVersion);
  const [pipelineSource, reportSource] = await Promise.all([
    fs.readFile(path.join(projectRoot, 'photo-processing/pipeline.mjs'), 'utf8'),
    fs.readFile(path.join(projectRoot, 'photo-processing/reports.mjs'), 'utf8'),
  ]);
  for (const field of [
    'selectedDevelopmentProfile',
    'structuredDevelopmentPlan',
    'editInstruction',
    'imageSpecificAdaptations',
  ]) {
    assert.match(pipelineSource, new RegExp(field));
    assert.match(reportSource, new RegExp(field));
  }
});

test('locked selectors fail closed and production image set remains original', async () => {
  assert.throws(
    () =>
      selectDevelopmentProfile({
        profiles: developmentProfiles,
        record: { id: 'casa-livingcasa', locked: true },
        sourceAnalysisLabel: 'living room',
      }),
    /LOCKED image/,
  );
  const [environmentFile, imageSource, layoutSource] = await Promise.all([
    fs.readFile(path.join(projectRoot, '.env'), 'utf8'),
    fs.readFile(path.join(projectRoot, 'src/data/images.ts'), 'utf8'),
    fs.readFile(path.join(projectRoot, 'src/layouts/BaseLayout.astro'), 'utf8'),
  ]);
  assert.match(environmentFile, /^PUBLIC_IMAGE_SET=original$/m);
  assert.match(imageSource, /PUBLIC_IMAGE_SET === 'processed'/);
  assert.match(imageSource, /lockedImageIds\.has\(image\.id\)/);
  assert.match(imageSource, /gemini-review/);
  assert.match(layoutSource, /Gemini image review/);
  assert.match(layoutSource, /PUBLIC_IMAGE_SET === 'gemini-review'/);
});

test('Gemini review image selection uses only validated entries and safely falls back', () => {
  const originals = [
    {
      id: 'editable',
      sources: { thumbnail: '/original-thumb.webp', mobile: '/original-mobile.webp', desktop: '/original.webp' },
    },
    {
      id: 'casa-livingcasa',
      sources: { thumbnail: '/locked-thumb.webp', mobile: '/locked-mobile.webp', desktop: '/locked.webp' },
    },
    {
      id: 'fallback',
      sources: { thumbnail: '/fallback-thumb.webp', mobile: '/fallback-mobile.webp', desktop: '/fallback.webp' },
    },
  ];
  const manifest = {
    images: [
      {
        photoId: 'editable',
        servedSet: 'gemini-review',
        fallback: false,
        sources: { thumbnail: '/gemini-thumb.webp', mobile: '/gemini-mobile.webp', desktop: '/gemini.webp' },
      },
      {
        photoId: 'casa-livingcasa',
        servedSet: 'gemini-review',
        fallback: false,
        sources: { thumbnail: '/forbidden-thumb.webp', mobile: '/forbidden-mobile.webp', desktop: '/forbidden.webp' },
      },
      {
        photoId: 'fallback',
        servedSet: 'original',
        fallback: true,
      },
    ],
  };
  const selected = selectGeminiReviewImages(
    originals,
    manifest,
    new Set(['casa-livingcasa']),
  );
  assert.equal(isGeminiReviewBuild('gemini-review'), true);
  assert.equal(isGeminiReviewBuild('original'), false);
  assert.equal(selected[0].sources.desktop, '/gemini.webp');
  assert.equal(selected[1].sources.desktop, '/locked.webp');
  assert.equal(selected[2].sources.desktop, '/fallback.webp');
});

test('only technically valid non-rejected results become Gemini review candidates', () => {
  const candidate = {
    status: 'MANUAL_REVIEW',
    geometryValidation: { status: 'passed' },
    normalization: { status: 'normalized' },
    quality: { semanticValidation: { status: 'Passed' } },
    postDecision: { outcome: 'MANUAL_REVIEW' },
    developedPreviewPath: '.photo-work/provider-edits/example/normalized.jpg',
  };
  assert.equal(isTechnicalReviewCandidate(candidate), true);
  assert.equal(
    isTechnicalReviewCandidate({
      ...candidate,
      geometryValidation: { status: 'rejected-before-normalization' },
    }),
    false,
  );
  assert.equal(isTechnicalReviewCandidate({ ...candidate, postDecision: { outcome: 'REJECT' } }), false);
});

test('image model and raster processor version invalidate the previous cache identity', () => {
  const base = {
    sourceSha256: 'b'.repeat(64),
    styleProfileSha256: style.sha256,
    promptVersion: 'analysis-v1+edit-v1',
  };
  const legacy = buildCacheIdentity({
    ...base,
    developerVersion,
    providerModel: 'gemini-3.6-flash',
  });
  const raster = buildCacheIdentity({
    ...base,
    developerVersion: providerRasterProcessorVersion,
    providerModel: 'gemini-3.6-flash+gemini-3.1-flash-image',
  });
  assert.notEqual(raster.sha256, legacy.sha256);
});

test('runtime pipeline uses the provider raster contract and not the legacy local developer', async () => {
  const source = await fs.readFile(path.join(projectRoot, 'photo-processing/pipeline.mjs'), 'utf8');
  assert.doesNotMatch(source, /from ['"]\.\/developer\.mjs['"]/);
  assert.doesNotMatch(source, /developPhotograph\s*\(/);
  assert.match(source, /provider\.edit\s*\(/);
  assert.match(source, /persistProviderRaster\s*\(/);
});

test('profile lock declarations cannot diverge from canonical configuration', () => {
  assert.throws(
    () =>
      validateStyleProfile(
        { ...style.profile, lockedImages: style.profile.lockedImages.slice(1) },
        schema,
        config.lockedImages,
      ),
    /lockedImages/,
  );
});

test('pilot state is created safely when no prior file exists', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'la-arbolada-pilot-state-'));
  const statePath = path.join(temporary, 'photo-pilot-review-state.json');
  const results = Array.from({ length: 5 }, (_, index) => pilotResult(`pilot-${index + 1}`));
  const state = await syncPilotReviewState({ statePath, results, style });
  assert.equal(Object.keys(state.decisions).length, 5);
  assert.ok(Object.values(state.decisions).every((decision) => decision.status === 'pending'));
  assert.deepEqual(JSON.parse(await fs.readFile(statePath, 'utf8')), state);
});

test('null, empty, or missing prior pilot records start pending without exceptions', () => {
  const result = pilotResult('pilot-null-safe');
  for (const existing of [null, {}, { styleProfile: { sha256: style.sha256 }, decisions: {} }]) {
    const state = createPilotReviewState({ results: [result], style, existing });
    assert.equal(state.decisions[result.catalogId].status, 'pending');
    assert.equal(state.decisions[result.catalogId].updatedAt, null);
  }
});

test('matching pilot result and processing identity preserve approval timestamp', () => {
  const result = pilotResult('pilot-preserved');
  const initial = createPilotReviewState({ results: [result], style });
  const timestamp = '2026-07-23T12:00:00.000Z';
  initial.decisions[result.catalogId] = {
    ...initial.decisions[result.catalogId],
    status: 'approved',
    updatedAt: timestamp,
  };
  const recovered = createPilotReviewState({ results: [result], style, existing: initial });
  assert.equal(recovered.decisions[result.catalogId].status, 'approved');
  assert.equal(recovered.decisions[result.catalogId].updatedAt, timestamp);
});

test('changed pilot result SHA resets approval and timestamp', () => {
  const original = pilotResult('pilot-changed-result');
  const existing = createPilotReviewState({ results: [original], style });
  existing.decisions[original.catalogId].status = 'approved';
  existing.decisions[original.catalogId].updatedAt = '2026-07-23T12:00:00.000Z';
  const changed = pilotResult(original.catalogId, 'changed-master-sha');
  const recovered = createPilotReviewState({ results: [changed], style, existing });
  assert.equal(recovered.decisions[original.catalogId].status, 'pending');
  assert.equal(recovered.decisions[original.catalogId].updatedAt, null);
});

test('changed style hash resets pilot approval and timestamp', () => {
  const result = pilotResult('pilot-changed-style');
  const existing = createPilotReviewState({ results: [result], style });
  existing.decisions[result.catalogId].status = 'approved';
  existing.decisions[result.catalogId].updatedAt = '2026-07-23T12:00:00.000Z';
  existing.styleProfile.sha256 = 'different-style';
  const recovered = createPilotReviewState({ results: [result], style, existing });
  assert.equal(recovered.decisions[result.catalogId].status, 'pending');
  assert.equal(recovered.decisions[result.catalogId].updatedAt, null);
});

test('malformed pilot state is rebuilt atomically as pending', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'la-arbolada-pilot-malformed-'));
  const statePath = path.join(temporary, 'photo-pilot-review-state.json');
  await fs.writeFile(statePath, '{partial');
  const result = pilotResult('pilot-rebuilt');
  const state = await syncPilotReviewState({ statePath, results: [result], style });
  assert.equal(state.decisions[result.catalogId].status, 'pending');
  assert.deepEqual(JSON.parse(await fs.readFile(statePath, 'utf8')), state);
  assert.deepEqual(
    (await fs.readdir(temporary)).filter((name) => name.endsWith('.tmp')),
    [],
  );
});

test('rerun reuses five complete cached pilot artifacts with zero Gemini requests', () => {
  const results = Array.from({ length: 5 }, (_, index) => pilotResult(`cached-${index + 1}`));
  let reused = 0;
  let geminiRequests = 0;
  for (const result of results) {
    const entry = {
      cacheIdentity: result.cacheIdentity,
      developerVersion,
      developedSha256: `${result.catalogId}-developed`,
      postAnalysisPromptVersion: result.postAnalysisPromptVersion,
      postAnalysis: { styleValidation: { profileMatchScore: 90 } },
    };
    const developmentCached = canReuseDevelopedCacheEntry({
      entry,
      cacheIdentitySha256: result.cacheIdentity.sha256,
      developerVersion,
      developedFileExists: true,
      developedSha256Matches: true,
    });
    const postAnalysisCached = canReusePostAnalysisCacheEntry({
      entry,
      cacheIdentitySha256: result.cacheIdentity.sha256,
      postAnalysisPromptVersion: result.postAnalysisPromptVersion,
    });
    if (!developmentCached) geminiRequests += 1;
    if (!postAnalysisCached) geminiRequests += 1;
    if (developmentCached && postAnalysisCached) reused += 1;
  }
  assert.equal(reused, 5);
  assert.equal(geminiRequests, 0);
});

test('representative pilot composition and full-run approvals are enforced', () => {
  const records = [
    { id: 'interior', classification: 'interior mixed lighting' },
    { id: 'exterior', classification: 'exterior' },
    { id: 'park', classification: 'park' },
    { id: 'creek', classification: 'creek' },
    { id: 'detail', classification: 'detail' },
  ];
  const workflow = {
    config: { pilotIds: records.map((item) => item.id), lockedImages: [] },
    records,
  };
  assert.equal(validatePilotComposition(workflow).length, 5);
  const results = records.map((item) => ({
    catalogId: item.id,
    status: 'PROCESSED',
    masterSha256: `${item.id}-sha`,
  }));
  const metrics = { runMode: 'pilot', styleProfile: { sha256: style.sha256 }, results };
  const decisions = Object.fromEntries(
    results.map((item) => [
      item.catalogId,
      { status: 'approved', resultSha256: item.masterSha256 },
    ]),
  );
  assert.equal(
    evaluateFullRunGate({
      workflow,
      metrics,
      pilotState: { styleProfile: { sha256: style.sha256 }, decisions },
      style,
    }).allowed,
    true,
  );
  decisions.park.status = 'pending';
  assert.equal(
    evaluateFullRunGate({
      workflow,
      metrics,
      pilotState: { styleProfile: { sha256: style.sha256 }, decisions },
      style,
    }).allowed,
    false,
  );
});

test('failing score with no violation and low confidence routes to manual review', () => {
  const decision = evaluatePostValidation({
    response: validationFixture({ naturalnessScore: 72, confidence: 0.5 }),
    localQuality: localQualityFixture(),
    style,
  });
  assert.equal(decision.outcome, 'MANUAL_REVIEW');
  assert.equal(decision.gates.scoreThreshold.failed, true);
  assert.ok(decision.contradictionFlags.includes('low-confidence-score-failure'));
});

test('failing score with positive notes routes to manual review', () => {
  const decision = evaluatePostValidation({
    response: validationFixture({
      profileMatchScore: 70,
      reviewNotes: ['The rendering remains natural and aligns well with the editorial style.'],
      confidence: 0.72,
    }),
    localQuality: localQualityFixture(),
    style,
  });
  assert.equal(decision.outcome, 'MANUAL_REVIEW');
  assert.ok(
    decision.contradictionFlags.includes('profile-score-conflicts-with-positive-review-notes'),
  );
});

test('contradictory rejection recommendation without violations routes to manual review', () => {
  const decision = evaluatePostValidation({
    response: validationFixture({
      naturalnessScore: 70,
      reviewNotes: ['The result is natural, but should not pass and is recommended for rejection.'],
      confidence: 0.6,
    }),
    localQuality: localQualityFixture(),
    style,
  });
  assert.equal(decision.outcome, 'MANUAL_REVIEW');
  assert.ok(
    decision.contradictionFlags.includes('rejection-recommendation-without-supported-violation'),
  );
});

test('supported concrete defect at definitive confidence rejects', () => {
  const decision = evaluatePostValidation({
    response: validationFixture({
      violations: [
        {
          ruleId: '$.colors.wood.forbid[0]',
          description: 'Red cast on neutral material.',
          evidence: 'Neutral plaster next to the mantle is visibly red in the candidate only.',
          confidence: 0.91,
        },
      ],
    }),
    localQuality: localQualityFixture(),
    style,
  });
  assert.equal(decision.outcome, 'REJECT');
  assert.equal(decision.gates.concreteVisualDefect.failed, true);
});

test('concrete defect below definitive confidence routes to manual review', () => {
  const decision = evaluatePostValidation({
    response: validationFixture({
      violations: [
        {
          ruleId: '$.global.hdrLook',
          description: 'Possible halo along a window edge.',
          evidence: 'A faint bright border may be visible on the right mullion.',
          confidence: 0.7,
        },
      ],
    }),
    localQuality: localQualityFixture(),
    style,
  });
  assert.equal(decision.outcome, 'MANUAL_REVIEW');
  assert.equal(decision.gates.concreteVisualDefect.failed, false);
});

test('unsupported legacy violation string routes to manual review', () => {
  const decision = evaluatePostValidation({
    response: validationFixture({ violations: ['lighting.fakeLight: forbidden'] }),
    localQuality: localQualityFixture(),
    style,
  });
  assert.equal(decision.outcome, 'MANUAL_REVIEW');
  assert.equal(decision.legacyViolations.length, 1);
  assert.equal(decision.legacyViolations[0].supported, false);
});

test('semantic, geometry, overprocessing, and local structural failures reject', () => {
  for (const override of [
    { semanticChangeSuspected: true },
    { geometryChangeSuspected: true },
    { overprocessed: true },
  ]) {
    assert.equal(
      evaluatePostValidation({
        response: validationFixture(override),
        localQuality: localQualityFixture(),
        style,
      }).outcome,
      'REJECT',
    );
  }
  const structural = evaluatePostValidation({
    response: validationFixture(),
    localQuality: localQualityFixture({
      outputDimensions: { width: 99, height: 80 },
    }),
    style,
  });
  assert.equal(structural.outcome, 'REJECT');
  assert.equal(structural.gates.localStructuralGate.failed, true);
});

test('passing scores with no defects passes policy', () => {
  const decision = evaluatePostValidation({
    response: validationFixture(),
    localQuality: localQualityFixture(),
    style,
  });
  assert.equal(decision.outcome, 'PASS');
  assert.equal(decision.accepted, true);
});

test('cached results can be reclassified offline without mutating cache or image artifacts', async () => {
  const workflow = await loadWorkflow();
  const cachePath = path.join(projectRoot, '.photo-work/cache/source-index.json');
  const cacheBefore = await fs.readFile(cachePath);
  const metrics = JSON.parse(
    await fs.readFile(path.join(projectRoot, workflow.config.reports.metrics), 'utf8'),
  );
  const candidatePaths = (
    await Promise.all(
      metrics.results
        .map((result) => result.developedPreviewPath)
        .filter(Boolean)
        .map(async (filePath) => {
          try {
            await fs.access(filePath);
            return filePath;
          } catch {
            return null;
          }
        }),
    )
  ).filter(Boolean);
  const candidateBytesBefore = await Promise.all(
    candidatePaths.map((filePath) => fs.readFile(filePath)),
  );
  const lockedPaths = workflow.config.lockedImages.flatMap((item) =>
    Object.values(item.publishedSources).map((source) =>
      path.join(projectRoot, 'public', source.path.replace(/^\//, '')),
    ),
  );
  const lockedBytesBefore = await Promise.all(lockedPaths.map((filePath) => fs.readFile(filePath)));
  const reclassified = reclassifyPilotResults({ results: metrics.results, style });
  assert.equal(reclassified.length, metrics.results.length);
  assert.deepEqual(await fs.readFile(cachePath), cacheBefore);
  const candidateBytesAfter = await Promise.all(
    candidatePaths.map((filePath) => fs.readFile(filePath)),
  );
  assert.deepEqual(candidateBytesAfter, candidateBytesBefore);
  const lockedBytesAfter = await Promise.all(lockedPaths.map((filePath) => fs.readFile(filePath)));
  assert.deepEqual(lockedBytesAfter, lockedBytesBefore);
});

test('deterministic development preserves dimensions, coordinates, and disables geometry', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'la-arbolada-pipeline-'));
  const outputPath = path.join(temporary, 'developed.jpg');
  const input = await sharp({
    create: { width: 96, height: 64, channels: 3, background: { r: 124, g: 112, b: 94 } },
  })
    .jpeg()
    .toBuffer();
  const plan = {
    adjustments: adjustmentOperations.map((operation) => ({
      operation,
      apply: operation === 'exposure',
      intensity: operation === 'exposure' ? 0.2 : 0,
      direction: operation === 'exposure' ? 'increase' : 'neutral',
      reason: 'Synthetic test.',
      styleRule: '$.global.exposure',
    })),
  };
  const developed = await developPhotograph({
    record: {
      id: 'synthetic',
      locked: false,
      sourcePath: 'synthetic.jpg',
      sourceMatch: { sourceMetadata: { exifMetadata: {} } },
    },
    sourceBuffer: input,
    plan,
    outputPath,
    styleIdentity: style,
  });
  assert.deepEqual(developed.dimensions, { width: 96, height: 64 });
  assert.equal(developed.pixelCoordinateMapping, 'identity');
  assert.equal(developed.geometryOperationsApplied, false);
  for (const operation of [
    'lens_correction',
    'perspective_correction',
    'chromatic_aberration_reduction',
  ]) {
    const item = developed.adjustments.find((adjustment) => adjustment.operation === operation);
    assert.equal(item.applied, false);
    assert.equal(item.estimatedIntensity, 0);
  }
});
