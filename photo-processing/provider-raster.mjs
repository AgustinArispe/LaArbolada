import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const providerEditCacheVersion = 'gemini-image-edit-request-v1';
export const normalizationAlgorithm = 'lanczos3';
export const normalizationVersion = 'provider-raster-normalization-v1';
export const providerRasterProcessorVersion = normalizationVersion;

const geometrySampleSize = 160;
const alternativeTransformMargin = 0.04;
const minimumAlternativeConfidence = 0.5;
const cropTransformMargin = 0.06;

const extensionByMimeType = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function atomicWrite(filePath, buffer) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(temporaryPath, buffer);
  await fs.rename(temporaryPath, filePath);
}

function normalizedCorrelation(left, right) {
  let leftSum = 0;
  let rightSum = 0;
  for (let index = 0; index < left.length; index += 1) {
    leftSum += left[index];
    rightSum += right[index];
  }
  const leftMean = leftSum / left.length;
  const rightMean = rightSum / right.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator === 0 ? 0 : numerator / denominator;
}

function edgeMap(pixels, size = geometrySampleSize) {
  const edges = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const center = pixels[y * size + x];
      const right = pixels[y * size + Math.min(size - 1, x + 1)];
      const below = pixels[Math.min(size - 1, y + 1) * size + x];
      edges[y * size + x] = Math.hypot(right - center, below - center);
    }
  }
  return edges;
}

function transformSquare(pixels, transform, size = geometrySampleSize) {
  const output = new Float32Array(pixels.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sourceX = x;
      let sourceY = y;
      if (transform === 'mirror-horizontal') sourceX = size - 1 - x;
      if (transform === 'mirror-vertical') sourceY = size - 1 - y;
      if (transform === 'rotate-180') {
        sourceX = size - 1 - x;
        sourceY = size - 1 - y;
      }
      if (transform === 'rotate-90') {
        sourceX = y;
        sourceY = size - 1 - x;
      }
      if (transform === 'rotate-270') {
        sourceX = size - 1 - y;
        sourceY = x;
      }
      output[y * size + x] = pixels[sourceY * size + sourceX];
    }
  }
  return output;
}

async function structuralEdges(buffer, extract = null) {
  let pipeline = sharp(buffer, { failOn: 'error' });
  if (extract) pipeline = pipeline.extract(extract);
  const pixels = await pipeline
    .resize(geometrySampleSize, geometrySampleSize, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .greyscale()
    .raw()
    .toBuffer();
  return edgeMap(pixels);
}

function cropRegions(dimensions) {
  const regions = [];
  for (const scale of [0.82, 0.88, 0.94]) {
    const width = Math.max(1, Math.round(dimensions.width * scale));
    const height = Math.max(1, Math.round(dimensions.height * scale));
    const maxLeft = dimensions.width - width;
    const maxTop = dimensions.height - height;
    for (const [x, y, name] of [
      [0.5, 0.5, 'center'],
      [0, 0.5, 'left'],
      [1, 0.5, 'right'],
      [0.5, 0, 'top'],
      [0.5, 1, 'bottom'],
    ]) {
      regions.push({
        name: `${name}-${Math.round(scale * 100)}%`,
        region: {
          left: Math.round(maxLeft * x),
          top: Math.round(maxTop * y),
          width,
          height,
        },
      });
    }
  }
  return regions;
}

export async function validateRasterGeometry({
  originalBuffer,
  returnedBuffer,
  originalDimensions,
  returnedDimensions,
  returnedOrientation,
}) {
  if (
    originalDimensions.width * returnedDimensions.height !==
    originalDimensions.height * returnedDimensions.width
  ) {
    throw new Error(
      `Provider raster aspect ratio differs from the original (${returnedDimensions.width}x${returnedDimensions.height} vs ${originalDimensions.width}x${originalDimensions.height}); normalization rejected.`,
    );
  }
  if (returnedOrientation && returnedOrientation !== 1) {
    throw new Error(
      `Provider raster contains non-canonical EXIF orientation ${returnedOrientation}; rotation or mirroring rejected.`,
    );
  }

  const [originalEdges, returnedEdges] = await Promise.all([
    structuralEdges(originalBuffer),
    structuralEdges(returnedBuffer),
  ]);
  const identityScore = normalizedCorrelation(originalEdges, returnedEdges);
  const alternatives = Object.fromEntries(
    ['mirror-horizontal', 'mirror-vertical', 'rotate-180', 'rotate-90', 'rotate-270'].map(
      (name) => [name, normalizedCorrelation(originalEdges, transformSquare(returnedEdges, name))],
    ),
  );
  const [bestAlternative, bestAlternativeScore] = Object.entries(alternatives).sort(
    (left, right) => right[1] - left[1],
  )[0];
  if (
    bestAlternativeScore >= minimumAlternativeConfidence &&
    bestAlternativeScore > identityScore + alternativeTransformMargin
  ) {
    const kind = bestAlternative.startsWith('mirror') ? 'mirrored' : 'rotated';
    throw new Error(
      `Provider raster appears ${kind} (${bestAlternative} score ${bestAlternativeScore.toFixed(4)} exceeds identity ${identityScore.toFixed(4)}); normalization rejected.`,
    );
  }

  let bestCrop = { name: null, score: Number.NEGATIVE_INFINITY };
  for (const candidate of cropRegions(originalDimensions)) {
    const candidateEdges = await structuralEdges(originalBuffer, candidate.region);
    const score = normalizedCorrelation(candidateEdges, returnedEdges);
    if (score > bestCrop.score) bestCrop = { name: candidate.name, score };
  }
  if (
    bestCrop.score >= minimumAlternativeConfidence &&
    bestCrop.score > identityScore + cropTransformMargin
  ) {
    throw new Error(
      `Provider raster appears cropped (${bestCrop.name} score ${bestCrop.score.toFixed(4)} exceeds full-frame identity ${identityScore.toFixed(4)}); normalization rejected.`,
    );
  }

  return {
    status: 'passed',
    aspectRatio: 'exact-match',
    orientation: 'canonical',
    rotationDetected: false,
    mirrorDetected: false,
    cropDetected: false,
    identityScore: Number(identityScore.toFixed(6)),
    strongestAlternative: {
      transform: bestAlternative,
      score: Number(bestAlternativeScore.toFixed(6)),
    },
    strongestCropHypothesis: {
      transform: bestCrop.name,
      score: Number(bestCrop.score.toFixed(6)),
    },
    detector: 'multi-hypothesis structural edge correlation v1',
  };
}

export function providerOutputExtension(mimeType) {
  const extension = extensionByMimeType[mimeType];
  if (!extension) throw new Error(`Unsupported provider raster MIME type: ${mimeType}.`);
  return extension;
}

export async function persistProviderRaster({
  originalBuffer,
  originalPath,
  imageBuffer,
  mimeType,
  providerOutputPath,
  developedPath,
  maximumBytes,
  expectedDimensions,
}) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0)
    throw new Error('Provider returned an empty edited raster.');
  if (imageBuffer.length > maximumBytes)
    throw new Error(
      `Provider raster is ${imageBuffer.length} bytes; maximum allowed is ${maximumBytes}.`,
    );
  providerOutputExtension(mimeType);
  const metadata = await sharp(imageBuffer, { failOn: 'error' }).metadata();
  const detectedMimeType =
    metadata.format === 'jpeg' ? 'image/jpeg' : `image/${metadata.format ?? 'unknown'}`;
  if (detectedMimeType !== mimeType)
    throw new Error(
      `Provider raster MIME mismatch: declared ${mimeType}, decoded ${detectedMimeType}.`,
    );
  if (!metadata.width || !metadata.height)
    throw new Error('Provider raster has no valid pixel dimensions.');

  if (!Buffer.isBuffer(originalBuffer) || originalBuffer.length === 0)
    throw new Error('Canonical original provider input is missing.');
  await atomicWrite(originalPath, originalBuffer);
  await atomicWrite(providerOutputPath, imageBuffer);
  let geometryValidation;
  try {
    geometryValidation = await validateRasterGeometry({
      originalBuffer,
      returnedBuffer: imageBuffer,
      originalDimensions: expectedDimensions,
      returnedDimensions: { width: metadata.width, height: metadata.height },
      returnedOrientation: metadata.orientation,
    });
  } catch (error) {
    error.rasterArtifacts = {
      originalPath,
      originalSha256: sha256(originalBuffer),
      providerOutputPath,
      providerOutputSha256: sha256(imageBuffer),
      providerOutputBytes: imageBuffer.length,
      providerOutputMimeType: mimeType,
      originalDimensions: { ...expectedDimensions },
      providerOutputDimensions: { width: metadata.width, height: metadata.height },
      finalDimensions: null,
      normalization: {
        status: 'rejected-before-normalization',
        required: null,
        algorithm: normalizationAlgorithm,
        configuredAlgorithm: normalizationAlgorithm,
        version: normalizationVersion,
      },
    };
    throw error;
  }
  await fs.mkdir(path.dirname(developedPath), { recursive: true });
  const temporaryDevelopedPath = `${developedPath}.${process.pid}.${Date.now()}.tmp`;
  const dimensionsMatch =
    metadata.width === expectedDimensions?.width && metadata.height === expectedDimensions?.height;
  let normalization = sharp(imageBuffer, { failOn: 'error' });
  if (!dimensionsMatch) {
    normalization = normalization.resize(expectedDimensions.width, expectedDimensions.height, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    });
  }
  await normalization
    .removeAlpha()
    .toColourspace('srgb')
    .jpeg({ quality: 98, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(temporaryDevelopedPath);
  await fs.rename(temporaryDevelopedPath, developedPath);
  const developedBuffer = await fs.readFile(developedPath);
  const normalizedMetadata = await sharp(developedPath, { failOn: 'error' }).metadata();
  if (
    normalizedMetadata.width !== expectedDimensions.width ||
    normalizedMetadata.height !== expectedDimensions.height
  ) {
    throw new Error('Normalized raster dimensions do not exactly match the canonical original.');
  }
  const scaleX = expectedDimensions.width / metadata.width;
  const scaleY = expectedDimensions.height / metadata.height;
  if (Math.abs(scaleX - scaleY) > Number.EPSILON * Math.max(scaleX, scaleY) * 8) {
    throw new Error('Normalization would require non-uniform scaling; raster rejected.');
  }

  return {
    originalPath,
    originalSha256: sha256(originalBuffer),
    providerOutputPath,
    providerOutputSha256: sha256(imageBuffer),
    providerOutputBytes: imageBuffer.length,
    providerOutputMimeType: mimeType,
    developedPath,
    developedSha256: sha256(developedBuffer),
    providerOutputDimensions: { width: metadata.width, height: metadata.height },
    originalDimensions: { ...expectedDimensions },
    finalDimensions: { width: normalizedMetadata.width, height: normalizedMetadata.height },
    geometryOperationsApplied: false,
    pixelCoordinateMapping: 'identity',
    geometryValidation,
    normalization: {
      status: 'normalized',
      required: !dimensionsMatch,
      algorithm: dimensionsMatch ? 'none' : normalizationAlgorithm,
      configuredAlgorithm: normalizationAlgorithm,
      version: normalizationVersion,
      scaleFactor: Number(scaleX.toFixed(8)),
      direction: dimensionsMatch ? 'none' : scaleX > 1 ? 'upscaled' : 'downscaled',
      aiUpscaling: false,
      crop: false,
      padding: false,
      stretch: false,
    },
    formatConversion: dimensionsMatch
      ? 'provider raster to high-quality sRGB JPEG; dimensions unchanged'
      : `provider raster uniformly resampled with ${normalizationAlgorithm} to canonical dimensions; no crop, padding, stretch, or AI upscaling`,
  };
}

export function adjustmentsFromProviderPlan(plan) {
  return (plan?.adjustments ?? []).map((adjustment) => ({
    ...adjustment,
    applied: Boolean(adjustment.apply),
    estimatedIntensity: adjustment.apply ? adjustment.intensity : 0,
    developerReason:
      'Gemini Image Editing received this adaptive relative instruction; the API does not expose absolute Lightroom-style operator values.',
  }));
}
