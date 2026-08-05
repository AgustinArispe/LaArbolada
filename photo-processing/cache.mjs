import { createHash } from 'node:crypto';
import { canonicalize } from './style/profile.mjs';

export function buildCacheIdentity({
  sourceSha256,
  styleProfileSha256,
  developerVersion,
  providerModel,
  promptVersion,
  developmentProfileId,
  developmentProfileVersion,
  developmentProfileSha256,
  promptTemplateVersion,
  structuredDevelopmentPlanSha256,
  imageOutputConfig,
}) {
  for (const [key, value] of Object.entries({
    sourceSha256,
    styleProfileSha256,
    developerVersion,
    providerModel,
    promptVersion,
  })) {
    if (!value) throw new Error(`Cache identity requires ${key}.`);
  }
  const components = {
    sourceSha256,
    styleProfileSha256,
    developerVersion,
    providerModel,
    promptVersion,
    ...(imageOutputConfig ? { imageOutputConfig } : {}),
    ...(developmentProfileId
      ? {
          developmentProfileId,
          developmentProfileVersion,
          developmentProfileSha256,
          promptTemplateVersion,
          structuredDevelopmentPlanSha256,
        }
      : {}),
  };
  if (developmentProfileId) {
    for (const [key, value] of Object.entries({
      developmentProfileVersion,
      developmentProfileSha256,
      promptTemplateVersion,
      structuredDevelopmentPlanSha256,
    })) {
      if (!value) throw new Error(`Profile-aware cache identity requires ${key}.`);
    }
  }
  return {
    components,
    sha256: createHash('sha256').update(canonicalize(components)).digest('hex'),
  };
}

export function buildNormalizedCacheIdentity({
  requestCacheIdentity,
  returnedRasterDimensions,
  normalizationAlgorithm,
  normalizationVersion,
}) {
  if (!requestCacheIdentity?.sha256 || !requestCacheIdentity?.components) {
    throw new Error('Normalized cache identity requires a valid request cache identity.');
  }
  const width = returnedRasterDimensions?.width;
  const height = returnedRasterDimensions?.height;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new Error('Normalized cache identity requires returned raster dimensions.');
  }
  if (!normalizationAlgorithm || !normalizationVersion) {
    throw new Error('Normalized cache identity requires algorithm and version.');
  }
  const components = {
    ...requestCacheIdentity.components,
    requestCacheIdentitySha256: requestCacheIdentity.sha256,
    returnedRasterDimensions: { width, height },
    normalizationAlgorithm,
    normalizationVersion,
  };
  return {
    components,
    sha256: createHash('sha256').update(canonicalize(components)).digest('hex'),
  };
}

export function canReuseDevelopedCacheEntry({
  entry,
  cacheIdentitySha256,
  developerVersion,
  normalizationAlgorithm,
  normalizationVersion,
  developedFileExists,
  developedSha256Matches,
}) {
  return Boolean(
    entry?.cacheIdentity?.sha256 === cacheIdentitySha256 &&
    entry?.developerVersion === developerVersion &&
    (!normalizationAlgorithm || entry?.normalization?.algorithm === normalizationAlgorithm) &&
    (!normalizationVersion || entry?.normalization?.version === normalizationVersion) &&
    entry?.developedSha256 &&
    developedFileExists &&
    developedSha256Matches,
  );
}

export function canReusePostAnalysisCacheEntry({
  entry,
  cacheIdentitySha256,
  postAnalysisPromptVersion,
}) {
  return Boolean(
    entry?.cacheIdentity?.sha256 === cacheIdentitySha256 &&
    entry?.postAnalysisPromptVersion === postAnalysisPromptVersion &&
    entry?.postAnalysis?.styleValidation,
  );
}
