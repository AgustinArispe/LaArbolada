import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import decodeHeic from 'heic-decode';
import sharp from 'sharp';
import {
  buildCacheIdentity,
  buildNormalizedCacheIdentity,
  canReuseDevelopedCacheEntry,
  canReusePostAnalysisCacheEntry,
} from './cache.mjs';
import { generateDeliveryDerivatives } from './derivatives.mjs';
import {
  adjustmentsFromProviderPlan,
  normalizationAlgorithm,
  normalizationVersion,
  persistProviderRaster,
  providerEditCacheVersion,
  providerOutputExtension,
  providerRasterProcessorVersion,
} from './provider-raster.mjs';
import { createPhotoProvider, resolveProviderName } from './providers/provider.mjs';
import {
  buildAnalysisPrompt,
  buildEditPrompt,
  buildPostAnalysisPrompt,
  postAnalysisPromptVersion,
} from './providers/prompts.mjs';
import { evaluatePostValidation } from './post-validation.mjs';
import {
  buildStructuredDevelopmentPlan,
  loadDevelopmentProfiles,
  selectDevelopmentProfile,
  sourceLabelFromVisualAnalysis,
} from './profiles/profile.mjs';
import { evaluateFullRunGate, syncPilotReviewState, validatePilotComposition } from './pilot.mjs';
import { assessQuality, generateSideBySideComparison } from './quality.mjs';
import { writeProcessingReports } from './reports.mjs';
import { loadStyleProfile } from './style/profile.mjs';
import {
  exists,
  processedRoot,
  root,
  verifyLockedPublishedFiles,
  workRoot,
} from '../scripts/photo-workflow-lib.mjs';
import {
  loadApprovedProcessingBatch,
  loadReviewState,
} from '../scripts/photo-review-state-lib.mjs';

const cacheIndexPath = path.join(workRoot, 'cache', 'source-index.json');
const pilotStatePath = path.join(root, 'reports', 'photo-pilot-review-state.json');
const analysisCacheVersion = 'gemini-analysis-request-v1';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function greatestCommonDivisor(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a;
}

function providerAspectRatio(dimensions) {
  const divisor = greatestCommonDivisor(dimensions.width, dimensions.height);
  const ratio = `${dimensions.width / divisor}:${dimensions.height / divisor}`;
  const supported = new Set([
    '1:1',
    '2:3',
    '3:2',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
    '21:9',
  ]);
  if (!supported.has(ratio)) {
    throw new Error(
      `Source aspect ratio ${ratio} is not supported by the configured Gemini image model; upload denied to prevent cropping or padding.`,
    );
  }
  return ratio;
}

async function fileSha256(filePath) {
  return sha256(await fs.readFile(filePath));
}

async function atomicWriteJson(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporaryPath, filePath);
}

async function loadCacheIndex() {
  try {
    const existing = JSON.parse(await fs.readFile(cacheIndexPath, 'utf8'));
    return existing.schemaVersion === 4
      ? existing
      : { schemaVersion: 4, updatedAt: null, entries: {} };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { schemaVersion: 4, updatedAt: null, entries: {} };
  }
}

async function verifySource(record) {
  if (record.locked) throw new Error(`LOCKED image ${record.id} cannot enter processing.`);
  if (record.sourceMatch.status !== 'matched' || !record.sourcePath) {
    throw new Error(
      `${record.id} has source status ${record.sourceMatch.status}; processing denied.`,
    );
  }
  const source = await fs.readFile(record.sourcePath);
  if (source.length !== record.expectedSource.bytes) {
    throw new Error(`Source size changed for ${record.id}; processing denied.`);
  }
  if (sha256(source) !== record.expectedSource.sha256) {
    throw new Error(`Source SHA-256 changed for ${record.id}; processing denied.`);
  }
  return source;
}

async function sourcePipeline(record, sourceBuffer) {
  try {
    const image = sharp(sourceBuffer, { failOn: 'error' });
    await image.metadata();
    return sharp(sourceBuffer, { failOn: 'error' }).autoOrient();
  } catch (error) {
    if (!['.heic', '.heif'].includes(path.extname(record.sourcePath).toLowerCase())) throw error;
    const decoded = await decodeHeic({ buffer: sourceBuffer });
    const pixels = Buffer.from(
      decoded.data.buffer,
      decoded.data.byteOffset,
      decoded.data.byteLength,
    );
    return sharp(pixels, {
      raw: { width: decoded.width, height: decoded.height, channels: 4 },
    });
  }
}

async function prepareProviderInput(record, sourceBuffer, settings) {
  const inputPath = path.join(workRoot, 'provider-input', `${record.expectedSource.sha256}.jpg`);
  if (await exists(inputPath)) {
    const imageBuffer = await fs.readFile(inputPath);
    const metadata = await sharp(imageBuffer).metadata();
    return {
      inputPath,
      imageBuffer,
      mimeType: 'image/jpeg',
      dimensions: { width: metadata.width, height: metadata.height },
    };
  }
  let imageBuffer;
  for (const quality of settings.inputJpegQualities) {
    const pipeline = await sourcePipeline(record, sourceBuffer);
    imageBuffer = await pipeline
      .jpeg({ quality, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer();
    if (imageBuffer.length <= settings.maximumInlineInputBytes) break;
  }
  if (imageBuffer.length > settings.maximumInlineInputBytes) {
    throw new Error(
      `${record.id} cannot fit the provider's inline analysis limit without resizing; upload denied to preserve resolution.`,
    );
  }
  await fs.mkdir(path.dirname(inputPath), { recursive: true });
  await fs.writeFile(inputPath, imageBuffer);
  const metadata = await sharp(imageBuffer).metadata();
  return {
    inputPath,
    imageBuffer,
    mimeType: 'image/jpeg',
    dimensions: { width: metadata.width, height: metadata.height },
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => worker()),
  );
  return results;
}

function publicPaths(outputs) {
  const relative = (filePath) => path.relative(root, filePath).split(path.sep).join('/');
  return {
    webp: Object.fromEntries(
      Object.entries(outputs.webp).map(([name, filePath]) => [name, relative(filePath)]),
    ),
    avif: Object.fromEntries(
      Object.entries(outputs.avif).map(([name, filePath]) => [name, relative(filePath)]),
    ),
    blur: relative(outputs.blur),
    manifest: relative(outputs.manifest),
  };
}

export async function validatePhotoPipeline({ workflow, environment = process.env }) {
  await verifyLockedPublishedFiles(workflow);
  validatePilotComposition(workflow);
  const style = await loadStyleProfile({ root, config: workflow.config, environment });
  const developmentProfiles = await loadDevelopmentProfiles({ root });
  const providerName = resolveProviderName(workflow.config, environment);
  const provider = await createPhotoProvider({ config: workflow.config, environment });
  if (provider.returnsImagePixels !== true || provider.mode !== 'image-editing') {
    throw new Error(
      `Provider ${providerName} must implement the approved image-editing raster contract.`,
    );
  }
  const { state } = await loadReviewState({ createIfMissing: true });
  const counts = Object.values(state.decisions).reduce(
    (summary, decision) => {
      summary[decision.status] = (summary[decision.status] ?? 0) + 1;
      return summary;
    },
    { approved: 0, skipped: 0, manual: 0, pending: 0 },
  );
  await writeProcessingReports({
    workflow,
    providerName,
    model: provider.model,
    runMode: 'validation-only',
    results: [],
    style,
  });
  return {
    providerName,
    providerMode: provider.mode,
    model: provider.model,
    analysisModel: provider.analysisModel,
    imageOutput: provider.imageOutput,
    concurrency:
      Number.parseInt(environment.PHOTO_CONCURRENCY ?? '', 10) ||
      workflow.config.provider.concurrency,
    counts,
    locked: workflow.config.lockedImages.length,
    styleProfile: { profileId: style.profileId, version: style.version, sha256: style.sha256 },
    postAnalysis: style.postAnalysis,
    developmentProfiles: developmentProfiles.profiles.length,
  };
}

export async function runPhotoPipeline({
  workflow,
  mode,
  targetId = null,
  environment = process.env,
}) {
  if (!['single', 'pilot', 'full'].includes(mode))
    throw new Error(`Invalid processing mode: ${mode}.`);
  if (mode === 'single' && !targetId)
    throw new Error('Single-image mode requires an explicit catalog target.');
  await verifyLockedPublishedFiles(workflow);
  validatePilotComposition(workflow);
  const { approvedIds, style } = await loadApprovedProcessingBatch(workflow, environment);
  const developmentProfiles = await loadDevelopmentProfiles({ root });
  if (mode === 'pilot' && !style.postAnalysis)
    throw new Error('PHOTO_POST_ANALYSIS must remain enabled for the pilot.');
  if (mode === 'full') {
    let metrics = null;
    let pilotState = null;
    try {
      metrics = JSON.parse(
        await fs.readFile(path.join(root, workflow.config.reports.metrics), 'utf8'),
      );
    } catch {}
    try {
      pilotState = JSON.parse(await fs.readFile(pilotStatePath, 'utf8'));
    } catch {}
    const gate = evaluateFullRunGate({ workflow, metrics, pilotState, style });
    if (!gate.allowed)
      throw new Error(`Full run blocked by pilot gate:\n- ${gate.reasons.join('\n- ')}`);
  }
  const approved = new Set(approvedIds);
  const eligible = workflow.records.filter(
    (record) =>
      !record.locked && record.sourceMatch.status === 'matched' && approved.has(record.id),
  );
  const selected =
    mode === 'single'
      ? eligible.filter((record) => record.id === targetId)
      : mode === 'pilot'
        ? eligible.filter((record) => workflow.config.pilotIds.includes(record.id))
        : eligible;
  if (!selected.length) throw new Error(`No approved, unlocked ${mode} images are available.`);
  if (mode === 'single' && selected.length !== 1) {
    throw new Error(`Single-image target ${targetId} is not uniquely approved and eligible.`);
  }
  if (mode === 'full' && selected.length !== approved.size) {
    throw new Error(
      `Full processing must include every approved image (${approved.size}); only ${selected.length} passed safety gates.`,
    );
  }

  const provider = await createPhotoProvider({ config: workflow.config, environment });
  if (provider.returnsImagePixels !== true || provider.mode !== 'image-editing') {
    throw new Error('Provider rejected: the approved image-editing raster contract is missing.');
  }
  if (!provider.isConfigured) {
    throw new Error(
      `${provider.requiredEnvironment.join(', ')} is not configured. No source was decoded and no image was uploaded.`,
    );
  }
  const concurrency =
    Number.parseInt(environment.PHOTO_CONCURRENCY ?? '', 10) ||
    workflow.config.provider.concurrency;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new Error('PHOTO_CONCURRENCY must be an integer from 1 through 10.');
  }
  const comparisonRoot = path.join(root, workflow.config.reports.comparisonsDirectory);
  const cache = await loadCacheIndex();
  let cacheWriteQueue = Promise.resolve();
  const saveCache = () => {
    cache.updatedAt = new Date().toISOString();
    cacheWriteQueue = cacheWriteQueue.then(() => atomicWriteJson(cacheIndexPath, cache));
    return cacheWriteQueue;
  };
  const developmentJobs = new Map();

  async function acquireDevelopment(record, input, prompt) {
    const sourceSha = record.expectedSource.sha256;
    const analysisCacheIdentity = buildCacheIdentity({
      sourceSha256: sourceSha,
      styleProfileSha256: style.sha256,
      developerVersion: analysisCacheVersion,
      providerModel: provider.analysisModel,
      promptVersion: prompt.promptVersion,
    });
    if (developmentJobs.has(analysisCacheIdentity.sha256))
      return developmentJobs.get(analysisCacheIdentity.sha256);
    const job = (async () => {
      let entry = cache.entries[analysisCacheIdentity.sha256] ?? null;
      let plan = entry?.analysisPlan ?? null;
      let providerMetadata = entry?.providerMetadata ?? null;
      let visualAnalysis = entry?.visualAnalysis ?? null;
      let developmentPlan = entry?.developmentPlan ?? null;
      let analysisCacheStatus = 'cached-analysis';
      if (!plan) {
        const analyzed = await provider.analyze({
          imageBuffer: input.imageBuffer,
          mimeType: input.mimeType,
          prompt: prompt.prompt,
          styleProfile: style.profile,
          metadata: {
            catalogId: record.id,
            sourceSha256: sourceSha,
            styleProfileId: style.profileId,
            styleProfileVersion: style.version,
            styleProfileSha256: style.sha256,
            cacheIdentity: analysisCacheIdentity.sha256,
            processorVersion: analysisCacheVersion,
            providerModel: provider.analysisModel,
            imageEditingModel: provider.imageModel,
            promptVersion: prompt.promptVersion,
          },
        });
        plan = analyzed.plan;
        visualAnalysis = analyzed.analysis;
        developmentPlan = analyzed.developmentPlan;
        providerMetadata = {
          provider: analyzed.provider,
          analysis: {
            model: analyzed.model,
            mode: analyzed.mode,
            requestId: analyzed.requestId,
            analyzedAt: new Date().toISOString(),
          },
        };
        entry = {
          sourceSha256: sourceSha,
          analysisCacheIdentity,
          analysisPlan: plan,
          visualAnalysis,
          developmentPlan,
          analysisPlanSha256: sha256(Buffer.from(JSON.stringify(plan))),
          providerMetadata,
          promptVersion: prompt.promptVersion,
          promptSha256: prompt.promptSha256,
          status: 'analysis-plan-cached',
        };
        cache.entries[analysisCacheIdentity.sha256] = entry;
        await saveCache();
        analysisCacheStatus = 'analyzed';
      }

      const profileSelection = selectDevelopmentProfile({
        profiles: developmentProfiles,
        record,
        sourceAnalysisLabel: sourceLabelFromVisualAnalysis(visualAnalysis, prompt.category),
      });
      const structuredDevelopmentPlan = buildStructuredDevelopmentPlan({
        selection: profileSelection,
        visualAnalysis,
      });
      const editPrompt = buildEditPrompt(
        record,
        style,
        developmentPlan,
        structuredDevelopmentPlan,
        visualAnalysis,
      );
      const requestCacheIdentity = buildCacheIdentity({
        sourceSha256: sourceSha,
        styleProfileSha256: style.sha256,
        developerVersion: providerEditCacheVersion,
        providerModel: provider.cacheModelIdentity,
        promptVersion: `${prompt.promptVersion}+${editPrompt.promptVersion}`,
        imageOutputConfig: provider.imageOutput,
        developmentProfileId: editPrompt.developmentProfile.id,
        developmentProfileVersion: editPrompt.developmentProfile.version,
        developmentProfileSha256: editPrompt.developmentProfile.sha256,
        promptTemplateVersion: editPrompt.promptTemplateVersion,
        structuredDevelopmentPlanSha256: editPrompt.structuredDevelopmentPlanSha256,
      });
      const editIdentityMatches =
        entry?.requestCacheIdentity?.sha256 === requestCacheIdentity.sha256;
      const developmentAudit = {
        developmentProfile: editPrompt.developmentProfile,
        structuredDevelopmentPlan: editPrompt.structuredDevelopmentPlan,
        structuredDevelopmentPlanSha256: editPrompt.structuredDevelopmentPlanSha256,
        imageSpecificAdaptations: editPrompt.imageSpecificAdaptations,
        editInstruction: editPrompt.prompt,
        editPromptVersion: editPrompt.promptVersion,
        editPromptSha256: editPrompt.promptSha256,
        promptTemplateVersion: editPrompt.promptTemplateVersion,
      };

      const artifactRoot = path.join(workRoot, 'provider-edits', requestCacheIdentity.sha256);
      const originalPath = path.join(artifactRoot, 'original.jpg');
      const developedPath = path.join(artifactRoot, 'normalized.jpg');
      const cachedDevelopedPath = entry?.developedPath
        ? path.join(root, entry.developedPath)
        : developedPath;
      const cachedOriginalPath = entry?.originalPath ? path.join(root, entry.originalPath) : null;
      const originalFileExists = await exists(cachedOriginalPath);
      const originalSha256Matches =
        originalFileExists && (await fileSha256(cachedOriginalPath)) === sha256(input.imageBuffer);
      const developedFileExists = await exists(cachedDevelopedPath);
      const developedSha256Matches =
        developedFileExists && (await fileSha256(cachedDevelopedPath)) === entry?.developedSha256;
      const cachedProviderOutputPath = entry?.providerOutputPath
        ? path.join(root, entry.providerOutputPath)
        : null;
      const providerOutputFileExists = await exists(cachedProviderOutputPath);
      const providerOutputSha256Matches =
        editIdentityMatches &&
        providerOutputFileExists &&
        (await fileSha256(cachedProviderOutputPath)) === entry?.providerOutputSha256;
      const cachedNormalizedIdentity =
        editIdentityMatches && entry?.providerOutputDimensions
          ? buildNormalizedCacheIdentity({
              requestCacheIdentity,
              returnedRasterDimensions: entry.providerOutputDimensions,
              normalizationAlgorithm,
              normalizationVersion,
            })
          : null;
      if (
        canReuseDevelopedCacheEntry({
          entry,
          cacheIdentitySha256: cachedNormalizedIdentity?.sha256,
          developerVersion: providerRasterProcessorVersion,
          normalizationAlgorithm,
          normalizationVersion,
          developedFileExists,
          developedSha256Matches,
        }) &&
        entry?.processorKind === 'provider-image-edit' &&
        providerOutputSha256Matches &&
        originalSha256Matches
      ) {
        return {
          developedPath: cachedDevelopedPath,
          providerOutputPath: cachedProviderOutputPath,
          providerOutputSha256: entry.providerOutputSha256,
          providerOutputMimeType: entry.providerOutputMimeType,
          providerOutputDimensions: entry.providerOutputDimensions,
          originalPath: cachedOriginalPath,
          originalDimensions: entry.originalDimensions,
          finalDimensions: entry.finalDimensions,
          normalization: entry.normalization,
          geometryValidation: entry.geometryValidation,
          editPromptVersion: entry.editPromptVersion,
          editPromptSha256: entry.editPromptSha256,
          editInstruction: entry.editInstruction,
          promptTemplateVersion: entry.promptTemplateVersion,
          developmentProfile: entry.developmentProfile,
          structuredDevelopmentPlan: entry.structuredDevelopmentPlan,
          structuredDevelopmentPlanSha256: entry.structuredDevelopmentPlanSha256,
          imageSpecificAdaptations: entry.imageSpecificAdaptations,
          plan,
          visualAnalysis,
          developmentPlan,
          cacheIdentity: cachedNormalizedIdentity,
          cacheEntryKey: analysisCacheIdentity.sha256,
          providerMetadata,
          analysis: entry.localAnalysis ?? null,
          adjustments: entry.adjustments,
          geometryOperationsApplied: entry.geometryOperationsApplied,
          pixelCoordinateMapping: entry.pixelCoordinateMapping,
          cacheStatus: 'reused-provider-edit-source-sha',
          processorKind: 'provider-image-edit',
        };
      }

      let edited;
      try {
        edited = providerOutputSha256Matches
          ? {
              imageBuffer: await fs.readFile(cachedProviderOutputPath),
              mimeType: entry.providerOutputMimeType,
              model: entry.providerMetadata?.editing?.model ?? provider.imageModel,
              mode: 'cached-provider-image-edit',
              requestId: entry.providerMetadata?.editing?.requestId ?? null,
              imageOutput: entry.providerMetadata?.editing?.requestedImageOutput ?? provider.imageOutput,
              apiImageOutput:
                entry.providerMetadata?.editing?.requestedApiImageOutput ??
                provider.apiImageOutput,
            }
          : await provider.edit({
              imageBuffer: input.imageBuffer,
              mimeType: input.mimeType,
              prompt: editPrompt.prompt,
              metadata: {
                catalogId: record.id,
                sourceSha256: sourceSha,
                styleProfileId: style.profileId,
                styleProfileVersion: style.version,
                styleProfileSha256: style.sha256,
                cacheIdentity: requestCacheIdentity.sha256,
                processorVersion: providerEditCacheVersion,
                normalizationAlgorithm,
                normalizationVersion,
                aspectRatio: providerAspectRatio(input.dimensions),
                imageSize: provider.imageOutput.imageSize,
                providerModel: provider.imageModel,
                analysisModel: provider.analysisModel,
                analysisPlanSha256: entry.analysisPlanSha256,
                promptVersion: editPrompt.promptVersion,
                promptSha256: editPrompt.promptSha256,
                developmentProfileId: editPrompt.developmentProfile.id,
                developmentProfileVersion: editPrompt.developmentProfile.version,
                developmentProfileSha256: editPrompt.developmentProfile.sha256,
                promptTemplateVersion: editPrompt.promptTemplateVersion,
                structuredDevelopmentPlanSha256: editPrompt.structuredDevelopmentPlanSha256,
              },
            });
      } catch (error) {
        error.developmentAudit = developmentAudit;
        throw error;
      }
      const providerOutputPath = providerOutputSha256Matches
        ? cachedProviderOutputPath
        : path.join(artifactRoot, `gemini-returned${providerOutputExtension(edited.mimeType)}`);
      let raster;
      try {
        raster = await persistProviderRaster({
          originalBuffer: input.imageBuffer,
          originalPath,
          imageBuffer: edited.imageBuffer,
          mimeType: edited.mimeType,
          providerOutputPath,
          developedPath,
          maximumBytes: provider.maximumOutputBytes,
          expectedDimensions: input.dimensions,
        });
      } catch (error) {
        if (error.rasterArtifacts) {
          const rejectedIdentity = buildNormalizedCacheIdentity({
            requestCacheIdentity,
            returnedRasterDimensions: error.rasterArtifacts.providerOutputDimensions,
            normalizationAlgorithm,
            normalizationVersion,
          });
          cache.entries[analysisCacheIdentity.sha256] = {
            ...entry,
            analysisCacheIdentity,
            requestCacheIdentity,
            cacheIdentity: rejectedIdentity,
            originalPath: path.relative(root, error.rasterArtifacts.originalPath),
            originalSha256: error.rasterArtifacts.originalSha256,
            providerOutputPath: path.relative(root, error.rasterArtifacts.providerOutputPath),
            providerOutputSha256: error.rasterArtifacts.providerOutputSha256,
            providerOutputMimeType: error.rasterArtifacts.providerOutputMimeType,
            providerOutputDimensions: error.rasterArtifacts.providerOutputDimensions,
            originalDimensions: error.rasterArtifacts.originalDimensions,
            finalDimensions: null,
            normalization: error.rasterArtifacts.normalization,
            providerMetadata: {
              ...providerMetadata,
              editing: {
                model: edited.model,
                mode: edited.mode,
                requestId: edited.requestId,
                editedAt: new Date().toISOString(),
                outputMimeType: error.rasterArtifacts.providerOutputMimeType,
                outputSha256: error.rasterArtifacts.providerOutputSha256,
                returnedDimensions: error.rasterArtifacts.providerOutputDimensions,
                normalizationAlgorithm,
                normalizationVersion,
                requestedImageOutput: edited.imageOutput ?? provider.imageOutput,
                requestedApiImageOutput: edited.apiImageOutput ?? provider.apiImageOutput,
              },
            },
            processorKind: 'provider-image-edit',
            developerVersion: providerRasterProcessorVersion,
            editPromptVersion: editPrompt.promptVersion,
            editPromptSha256: editPrompt.promptSha256,
            editInstruction: editPrompt.prompt,
            promptTemplateVersion: editPrompt.promptTemplateVersion,
            developmentProfile: editPrompt.developmentProfile,
            structuredDevelopmentPlan: editPrompt.structuredDevelopmentPlan,
            structuredDevelopmentPlanSha256: editPrompt.structuredDevelopmentPlanSha256,
            imageSpecificAdaptations: editPrompt.imageSpecificAdaptations,
            postAnalysis: null,
            postAnalysisPromptVersion: null,
            status: 'provider-raster-geometry-rejected',
          };
          await saveCache();
          error.rasterArtifacts.cacheIdentity = rejectedIdentity;
          error.developmentAudit = developmentAudit;
          error.actualImageModel = edited.model;
          error.requestedImageOutput = edited.imageOutput ?? provider.imageOutput;
        }
        throw error;
      }
      const cacheIdentity = buildNormalizedCacheIdentity({
        requestCacheIdentity,
        returnedRasterDimensions: raster.providerOutputDimensions,
        normalizationAlgorithm,
        normalizationVersion,
      });
      const adjustments = adjustmentsFromProviderPlan(plan);
      const normalizedIdentityUnchanged = entry?.cacheIdentity?.sha256 === cacheIdentity.sha256;
      providerMetadata = {
        ...providerMetadata,
        editing: {
          model: edited.model,
          mode: edited.mode,
          requestId: edited.requestId,
          editedAt: new Date().toISOString(),
          outputMimeType: raster.providerOutputMimeType,
          outputSha256: raster.providerOutputSha256,
          returnedDimensions: raster.providerOutputDimensions,
          normalizationAlgorithm,
          normalizationVersion,
          requestedImageOutput: edited.imageOutput ?? provider.imageOutput,
          requestedApiImageOutput: edited.apiImageOutput ?? provider.apiImageOutput,
        },
      };
      cache.entries[analysisCacheIdentity.sha256] = {
        ...entry,
        analysisCacheIdentity,
        requestCacheIdentity,
        cacheIdentity,
        providerMetadata,
        originalPath: path.relative(root, raster.originalPath),
        originalSha256: raster.originalSha256,
        providerOutputPath: path.relative(root, raster.providerOutputPath),
        providerOutputSha256: raster.providerOutputSha256,
        providerOutputMimeType: raster.providerOutputMimeType,
        providerOutputDimensions: raster.providerOutputDimensions,
        originalDimensions: raster.originalDimensions,
        finalDimensions: raster.finalDimensions,
        developedPath: path.relative(root, raster.developedPath),
        developedSha256: raster.developedSha256,
        developerVersion: providerRasterProcessorVersion,
        processorKind: 'provider-image-edit',
        localAnalysis: null,
        adjustments,
        geometryOperationsApplied: raster.geometryOperationsApplied,
        pixelCoordinateMapping: raster.pixelCoordinateMapping,
        geometryValidation: raster.geometryValidation,
        normalization: raster.normalization,
        editPromptVersion: editPrompt.promptVersion,
        editPromptSha256: editPrompt.promptSha256,
        editInstruction: editPrompt.prompt,
        promptTemplateVersion: editPrompt.promptTemplateVersion,
        developmentProfile: editPrompt.developmentProfile,
        structuredDevelopmentPlan: editPrompt.structuredDevelopmentPlan,
        structuredDevelopmentPlanSha256: editPrompt.structuredDevelopmentPlanSha256,
        imageSpecificAdaptations: editPrompt.imageSpecificAdaptations,
        postAnalysis: normalizedIdentityUnchanged ? (entry.postAnalysis ?? null) : null,
        postAnalysisPromptVersion: normalizedIdentityUnchanged
          ? (entry.postAnalysisPromptVersion ?? null)
          : null,
        status: 'provider-image-edit-ready',
      };
      await saveCache();
      return {
        ...raster,
        plan,
        visualAnalysis,
        developmentPlan,
        analysis: null,
        adjustments,
        cacheIdentity,
        cacheEntryKey: analysisCacheIdentity.sha256,
        providerMetadata,
        processorKind: 'provider-image-edit',
        editPromptVersion: editPrompt.promptVersion,
        editPromptSha256: editPrompt.promptSha256,
        editInstruction: editPrompt.prompt,
        promptTemplateVersion: editPrompt.promptTemplateVersion,
        developmentProfile: editPrompt.developmentProfile,
        structuredDevelopmentPlan: editPrompt.structuredDevelopmentPlan,
        structuredDevelopmentPlanSha256: editPrompt.structuredDevelopmentPlanSha256,
        imageSpecificAdaptations: editPrompt.imageSpecificAdaptations,
        cacheStatus:
          analysisCacheStatus === 'analyzed'
            ? 'analyzed-and-provider-edited'
            : 'provider-edited-from-analysis-cache',
      };
    })();
    developmentJobs.set(analysisCacheIdentity.sha256, job);
    return job;
  }

  const results = await mapWithConcurrency(selected, concurrency, async (record, index) => {
    console.log(`[${index + 1}/${selected.length}] ${record.id}: Gemini raster development`);
    try {
      const sourceBuffer = await verifySource(record);
      const input = await prepareProviderInput(
        record,
        sourceBuffer,
        workflow.config.provider.input,
      );
      const prompt = buildAnalysisPrompt(record, style);
      const developed = await acquireDevelopment(record, input, prompt);
      const quality = await assessQuality({
        sourcePath: input.inputPath,
        processedPath: developed.developedPath,
        thresholds: workflow.config.qualityControl.thresholds,
        invariants: {
          geometryOperationsApplied: developed.geometryOperationsApplied,
          pixelCoordinateMapping: developed.pixelCoordinateMapping,
          normalization: developed.normalization,
          geometryValidation: developed.geometryValidation,
        },
      });
      const comparisonPath = path.join(comparisonRoot, `${record.id}.jpg`);
      await generateSideBySideComparison({
        id: record.id,
        sourcePath: input.inputPath,
        processedPath: developed.developedPath,
        outputPath: comparisonPath,
      });

      let postAnalysis = { status: 'Skipped by configuration' };
      let postDecision =
        quality.semanticValidation.status === 'Rejected'
          ? {
              outcome: 'REJECT',
              accepted: false,
              status: 'Rejected',
              reasons: ['Local structural validation failed.'],
            }
          : {
              outcome: 'PASS',
              accepted: true,
              status: 'Passed Policy',
              reasons: ['Post-analysis disabled by explicit configuration; local gates passed.'],
            };
      if (style.postAnalysis) {
        const cacheEntry = cache.entries[developed.cacheEntryKey];
        const cachedPost = canReusePostAnalysisCacheEntry({
          entry: cacheEntry,
          cacheIdentitySha256: developed.cacheIdentity.sha256,
          postAnalysisPromptVersion,
        })
          ? cacheEntry.postAnalysis
          : null;
        if (cachedPost) {
          postAnalysis = cachedPost;
        } else {
          const postPrompt = buildPostAnalysisPrompt(record, style);
          postAnalysis = await provider.validateDevelopment({
            originalBuffer: input.imageBuffer,
            developedBuffer: await fs.readFile(developed.developedPath),
            mimeType: input.mimeType,
            prompt: postPrompt.prompt,
            metadata: {
              catalogId: record.id,
              sourceSha256: record.expectedSource.sha256,
              styleProfileId: style.profileId,
              styleProfileVersion: style.version,
              styleProfileSha256: style.sha256,
              cacheIdentity: developed.cacheIdentity.sha256,
              processorVersion: providerRasterProcessorVersion,
              providerModel: provider.analysisModel,
              imageEditingModel: provider.imageModel,
              editPromptVersion: developed.editPromptVersion,
              promptTemplateVersion: developed.promptTemplateVersion,
              developmentProfileId: developed.developmentProfile.id,
              developmentProfileVersion: developed.developmentProfile.version,
              developmentProfileSha256: developed.developmentProfile.sha256,
              structuredDevelopmentPlanSha256: developed.structuredDevelopmentPlanSha256,
              promptVersion: postPrompt.promptVersion,
            },
          });
          cache.entries[developed.cacheEntryKey].postAnalysis = postAnalysis;
          cache.entries[developed.cacheEntryKey].postAnalysisPromptVersion =
            postPrompt.promptVersion;
          await saveCache();
        }
        postDecision = evaluatePostValidation({
          response: postAnalysis,
          localQuality: quality,
          style,
        });
      }

      let derivatives = null;
      let masterSha256 = null;
      let masterPath = null;
      if (postDecision.outcome === 'PASS') {
        await fs.mkdir(path.dirname(record.masterPath), { recursive: true });
        const temporaryMaster = `${record.masterPath}.${process.pid}.tmp`;
        await fs.copyFile(developed.developedPath, temporaryMaster);
        await fs.rename(temporaryMaster, record.masterPath);
        const generated = await generateDeliveryDerivatives({
          record,
          processedRoot,
          settings: workflow.config.derivatives,
          metadata: {
            sourceSha256: record.expectedSource.sha256,
            styleProfile: {
              profileId: style.profileId,
              version: style.version,
              sha256: style.sha256,
            },
            cacheIdentity: developed.cacheIdentity,
            processorVersion: providerRasterProcessorVersion,
            providerModel: provider.imageModel,
            analysisModel: provider.analysisModel,
            promptVersion: developed.editPromptVersion,
            promptTemplateVersion: developed.promptTemplateVersion,
            developmentProfile: developed.developmentProfile,
            structuredDevelopmentPlanSha256: developed.structuredDevelopmentPlanSha256,
            providerOutputSha256: developed.providerOutputSha256,
            normalization: developed.normalization,
            providerOutputDimensions: developed.providerOutputDimensions,
            finalDimensions: developed.finalDimensions,
          },
        });
        derivatives = publicPaths(generated);
        masterPath = path.relative(root, record.masterPath);
        masterSha256 = await fileSha256(record.masterPath);
      }

      return {
        catalogId: record.id,
        property: record.property,
        classification: record.classification,
        category: prompt.category,
        sourcePath: record.sourceRelativePath,
        sourceSha256: record.expectedSource.sha256,
        status:
          postDecision.outcome === 'REJECT'
            ? 'REJECTED'
            : postDecision.outcome === 'MANUAL_REVIEW'
              ? 'MANUAL_REVIEW'
              : developed.cacheStatus.startsWith('reused')
                ? 'CACHED'
                : 'PROCESSED',
        cacheStatus: developed.cacheStatus,
        provider: developed.providerMetadata ?? { provider: provider.name, model: provider.model },
        requestedImageModel: provider.imageModel,
        actualImageModel: developed.providerMetadata?.editing?.model ?? provider.imageModel,
        requestedImageOutput:
          developed.providerMetadata?.editing?.requestedImageOutput ?? provider.imageOutput,
        providerPurpose:
          'Gemini image-editing raster; mandatory local structural, style, and human review',
        processorKind: developed.processorKind,
        processorVersion: providerRasterProcessorVersion,
        promptVersion: prompt.promptVersion,
        promptSha256: prompt.promptSha256,
        editPromptVersion: developed.editPromptVersion,
        editPromptSha256: developed.editPromptSha256,
        editInstruction: developed.editInstruction,
        promptTemplateVersion: developed.promptTemplateVersion,
        developmentProfile: developed.developmentProfile,
        selectedDevelopmentProfile: developed.developmentProfile,
        structuredDevelopmentPlan: developed.structuredDevelopmentPlan,
        structuredDevelopmentPlanSha256: developed.structuredDevelopmentPlanSha256,
        imageSpecificAdaptations: developed.imageSpecificAdaptations,
        styleProfile: { profileId: style.profileId, version: style.version, sha256: style.sha256 },
        cacheIdentity: developed.cacheIdentity,
        visualAnalysis: developed.visualAnalysis,
        developmentPlan: developed.developmentPlan,
        localAnalysis: developed.analysis,
        adjustments: developed.adjustments,
        providerOutputPath: path.relative(root, developed.providerOutputPath),
        providerOutputSha256: developed.providerOutputSha256,
        providerOutputMimeType: developed.providerOutputMimeType,
        originalArtifactPath: path.relative(root, developed.originalPath),
        originalDimensions: developed.originalDimensions,
        providerOutputDimensions: developed.providerOutputDimensions,
        finalDimensions: developed.finalDimensions,
        normalization: developed.normalization,
        geometryValidation: developed.geometryValidation,
        masterPath,
        masterSha256,
        derivatives,
        comparisonPath: path.relative(root, comparisonPath),
        originalPreviewPath: path.relative(root, input.inputPath),
        developedPreviewPath: path.relative(root, developed.developedPath),
        quality,
        postAnalysis,
        postAnalysisPromptVersion: style.postAnalysis ? postAnalysisPromptVersion : null,
        postDecision,
        policyOutcome: postDecision.outcome,
        reviewStatus:
          postDecision.outcome === 'REJECT'
            ? 'Rejected'
            : postDecision.outcome === 'MANUAL_REVIEW'
              ? 'Manual Review Required'
              : quality.status === 'Needs Review'
                ? 'Needs Review'
                : 'Human Review Required',
        publicationStatus: 'Human Review Required',
      };
    } catch (error) {
      const artifacts = error.rasterArtifacts;
      const developmentAudit = error.developmentAudit;
      return {
        catalogId: record.id,
        property: record.property,
        classification: record.classification,
        status: 'ERROR',
        error: error.message,
        requestedImageModel: provider.imageModel,
        actualImageModel: error.actualImageModel ?? null,
        requestedImageOutput: error.requestedImageOutput ?? provider.imageOutput,
        ...(developmentAudit
          ? {
              editInstruction: developmentAudit.editInstruction,
              editPromptVersion: developmentAudit.editPromptVersion,
              editPromptSha256: developmentAudit.editPromptSha256,
              promptTemplateVersion: developmentAudit.promptTemplateVersion,
              developmentProfile: developmentAudit.developmentProfile,
              selectedDevelopmentProfile: developmentAudit.developmentProfile,
              structuredDevelopmentPlan: developmentAudit.structuredDevelopmentPlan,
              structuredDevelopmentPlanSha256: developmentAudit.structuredDevelopmentPlanSha256,
              imageSpecificAdaptations: developmentAudit.imageSpecificAdaptations,
            }
          : {}),
        ...(artifacts
          ? {
              cacheIdentity: artifacts.cacheIdentity,
              originalArtifactPath: path.relative(root, artifacts.originalPath),
              originalDimensions: artifacts.originalDimensions,
              providerOutputPath: path.relative(root, artifacts.providerOutputPath),
              providerOutputSha256: artifacts.providerOutputSha256,
              providerOutputMimeType: artifacts.providerOutputMimeType,
              providerOutputDimensions: artifacts.providerOutputDimensions,
              finalDimensions: artifacts.finalDimensions,
              normalization: artifacts.normalization,
            }
          : {}),
        reviewStatus: 'Rejected',
        publicationStatus: 'Blocked',
      };
    }
  });
  await cacheWriteQueue;
  if (mode === 'pilot') await syncPilotReviewState({ statePath: pilotStatePath, results, style });
  const providerRequests = provider.getRequestCounts?.() ?? null;
  await writeProcessingReports({
    workflow,
    providerName: provider.name,
    model: provider.model,
    runMode: mode,
    results,
    style,
    providerRequests,
  });
  Object.defineProperty(results, 'providerRequests', {
    value: providerRequests,
    enumerable: false,
  });
  const errors = results.filter((result) => result.status === 'ERROR');
  if (errors.length) {
    throw new Error(
      `${errors.length} image(s) failed. Reports were written; no website references were changed.`,
    );
  }
  return results;
}
