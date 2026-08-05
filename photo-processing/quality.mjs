import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sampleSize = 512;

async function comparablePixels(filePath) {
  return sharp(filePath, { failOn: 'error' })
    .resize(sampleSize, sampleSize, { fit: 'fill' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer();
}

function luminance(red, green, blue) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function edgeMap(pixels) {
  const edges = new Float64Array((sampleSize - 1) * (sampleSize - 1));
  let target = 0;
  for (let y = 0; y < sampleSize - 1; y += 1) {
    for (let x = 0; x < sampleSize - 1; x += 1) {
      const offset = (y * sampleSize + x) * 3;
      const right = offset + 3;
      const below = offset + sampleSize * 3;
      const centerY = luminance(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      const rightY = luminance(pixels[right], pixels[right + 1], pixels[right + 2]);
      const belowY = luminance(pixels[below], pixels[below + 1], pixels[below + 2]);
      edges[target++] = Math.hypot(rightY - centerY, belowY - centerY);
    }
  }
  return edges;
}

function scalarSsim(left, right) {
  let leftSum = 0;
  let rightSum = 0;
  let leftSquared = 0;
  let rightSquared = 0;
  let cross = 0;
  for (let index = 0; index < left.length; index += 1) {
    leftSum += left[index];
    rightSum += right[index];
    leftSquared += left[index] ** 2;
    rightSquared += right[index] ** 2;
    cross += left[index] * right[index];
  }
  const leftMean = leftSum / left.length;
  const rightMean = rightSum / right.length;
  const leftVariance = leftSquared / left.length - leftMean ** 2;
  const rightVariance = rightSquared / right.length - rightMean ** 2;
  const covariance = cross / left.length - leftMean * rightMean;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  return (
    ((2 * leftMean * rightMean + c1) * (2 * covariance + c2)) /
    ((leftMean ** 2 + rightMean ** 2 + c1) * (leftVariance + rightVariance + c2))
  );
}

function calculateMetrics(original, processed) {
  const pixelCount = original.length / 3;
  let sourceLuminanceSum = 0;
  let outputLuminanceSum = 0;
  let sourceLuminanceSquared = 0;
  let outputLuminanceSquared = 0;
  let crossLuminance = 0;
  let squaredError = 0;
  const sourceHistogram = Array.from({ length: 3 }, () => new Array(32).fill(0));
  const outputHistogram = Array.from({ length: 3 }, () => new Array(32).fill(0));

  for (let offset = 0; offset < original.length; offset += 3) {
    const sourceY = luminance(original[offset], original[offset + 1], original[offset + 2]);
    const outputY = luminance(processed[offset], processed[offset + 1], processed[offset + 2]);
    sourceLuminanceSum += sourceY;
    outputLuminanceSum += outputY;
    sourceLuminanceSquared += sourceY * sourceY;
    outputLuminanceSquared += outputY * outputY;
    crossLuminance += sourceY * outputY;
    for (let channel = 0; channel < 3; channel += 1) {
      const difference = original[offset + channel] - processed[offset + channel];
      squaredError += difference * difference;
      sourceHistogram[channel][Math.min(31, original[offset + channel] >> 3)] += 1;
      outputHistogram[channel][Math.min(31, processed[offset + channel] >> 3)] += 1;
    }
  }

  const sourceMean = sourceLuminanceSum / pixelCount;
  const outputMean = outputLuminanceSum / pixelCount;
  const sourceVariance = sourceLuminanceSquared / pixelCount - sourceMean ** 2;
  const outputVariance = outputLuminanceSquared / pixelCount - outputMean ** 2;
  const covariance = crossLuminance / pixelCount - sourceMean * outputMean;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const ssim =
    ((2 * sourceMean * outputMean + c1) * (2 * covariance + c2)) /
    ((sourceMean ** 2 + outputMean ** 2 + c1) * (sourceVariance + outputVariance + c2));
  const mse = squaredError / original.length;
  const psnr = mse === 0 ? 99 : 10 * Math.log10(255 ** 2 / mse);
  let histogramDelta = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    for (let bin = 0; bin < 32; bin += 1) {
      histogramDelta += Math.abs(
        sourceHistogram[channel][bin] / pixelCount - outputHistogram[channel][bin] / pixelCount,
      );
    }
  }

  return {
    ssim: Number(ssim.toFixed(6)),
    psnrDb: Number(psnr.toFixed(4)),
    averageLuminanceChange: Number((Math.abs(outputMean - sourceMean) / 255).toFixed(6)),
    colorHistogramDelta: Number((histogramDelta / 6).toFixed(6)),
    sourceAverageLuminance: Number((sourceMean / 255).toFixed(6)),
    outputAverageLuminance: Number((outputMean / 255).toFixed(6)),
    sample: `${sampleSize}x${sampleSize} sRGB`,
  };
}

export async function assessQuality({ sourcePath, processedPath, thresholds, invariants }) {
  if (invariants?.normalization?.status !== 'normalized') {
    throw new Error('Quality metrics require a completed deterministic normalization stage.');
  }
  if (invariants?.geometryValidation?.status !== 'passed') {
    throw new Error('Quality metrics require passed pre-normalization geometry validation.');
  }
  const [sourceMetadata, outputMetadata, sourcePixels, outputPixels] = await Promise.all([
    sharp(sourcePath).metadata(),
    sharp(processedPath).metadata(),
    comparablePixels(sourcePath),
    comparablePixels(processedPath),
  ]);
  const metrics = calculateMetrics(sourcePixels, outputPixels);
  const edgeSsim = Number(scalarSsim(edgeMap(sourcePixels), edgeMap(outputPixels)).toFixed(6));
  const sourceAspect = sourceMetadata.width / sourceMetadata.height;
  const outputAspect = outputMetadata.width / outputMetadata.height;
  const aspectRatioDelta = Math.abs(outputAspect - sourceAspect) / sourceAspect;
  const dimensionMismatch =
    sourceMetadata.width !== outputMetadata.width ||
    sourceMetadata.height !== outputMetadata.height;
  const violations = [];
  if (metrics.ssim < thresholds.minimumSsim) {
    violations.push(`SSIM ${metrics.ssim} is below ${thresholds.minimumSsim}`);
  }
  if (metrics.psnrDb < thresholds.minimumPsnrDb) {
    violations.push(`PSNR ${metrics.psnrDb} dB is below ${thresholds.minimumPsnrDb} dB`);
  }
  if (metrics.averageLuminanceChange > thresholds.maximumAverageLuminanceChange) {
    violations.push(
      `average luminance change ${metrics.averageLuminanceChange} exceeds ${thresholds.maximumAverageLuminanceChange}`,
    );
  }
  if (metrics.colorHistogramDelta > thresholds.maximumColorHistogramDelta) {
    violations.push(
      `color histogram delta ${metrics.colorHistogramDelta} exceeds ${thresholds.maximumColorHistogramDelta}`,
    );
  }
  if (aspectRatioDelta > thresholds.maximumAspectRatioDelta) {
    violations.push(
      `aspect-ratio delta ${aspectRatioDelta.toFixed(6)} exceeds ${thresholds.maximumAspectRatioDelta}`,
    );
  }
  if (dimensionMismatch) violations.push('processed master dimensions differ from the source');
  const semanticViolations = [];
  if (dimensionMismatch) semanticViolations.push('pixel dimensions changed');
  if (aspectRatioDelta !== 0) semanticViolations.push('aspect ratio changed');
  if (invariants?.geometryOperationsApplied !== false) {
    semanticViolations.push('geometry-changing operator was applied or not attested');
  }
  if (invariants?.pixelCoordinateMapping !== 'identity') {
    semanticViolations.push('pixel coordinate mapping is not identity');
  }
  if (edgeSsim < thresholds.minimumEdgeSsim) {
    semanticViolations.push(
      `edge-structure SSIM ${edgeSsim} is below ${thresholds.minimumEdgeSsim}`,
    );
  }
  return {
    ...metrics,
    edgeSsim,
    sourceDimensions: { width: sourceMetadata.width, height: sourceMetadata.height },
    outputDimensions: { width: outputMetadata.width, height: outputMetadata.height },
    aspectRatioDelta: Number(aspectRatioDelta.toFixed(6)),
    thresholds,
    status: violations.length ? 'Needs Review' : 'Passed Metrics',
    violations,
    semanticValidation: {
      status: semanticViolations.length ? 'Rejected' : 'Passed',
      violations: semanticViolations,
      geometryOperationsApplied: invariants?.geometryOperationsApplied ?? null,
      pixelCoordinateMapping: invariants?.pixelCoordinateMapping ?? null,
      geometryValidation: invariants?.geometryValidation ?? null,
      normalization: invariants?.normalization ?? null,
      operatorPolicy: 'photometric-and-local-detail-only',
    },
    humanArchitecturalReviewRequired: true,
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function generateSideBySideComparison({ id, sourcePath, processedPath, outputPath }) {
  const width = 1800;
  const panelWidth = width / 2;
  const imageHeight = 720;
  const headerHeight = 74;
  const [source, processed] = await Promise.all([
    sharp(sourcePath)
      .resize(panelWidth, imageHeight, { fit: 'contain', background: '#11130f' })
      .jpeg({ quality: 92 })
      .toBuffer(),
    sharp(processedPath)
      .resize(panelWidth, imageHeight, { fit: 'contain', background: '#11130f' })
      .jpeg({ quality: 92 })
      .toBuffer(),
  ]);
  const labels = Buffer.from(`<svg width="${width}" height="${headerHeight}">
    <rect width="100%" height="100%" fill="#181b15"/>
    <text x="28" y="46" fill="#f4f0e4" font-family="Arial, sans-serif" font-size="24" font-weight="700">${escapeXml(id)} · Original</text>
    <text x="${panelWidth + 28}" y="46" fill="#f4f0e4" font-family="Arial, sans-serif" font-size="24" font-weight="700">Enhanced · mandatory human review</text>
  </svg>`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: { width, height: imageHeight + headerHeight, channels: 3, background: '#11130f' },
  })
    .composite([
      { input: labels, left: 0, top: 0 },
      { input: source, left: 0, top: headerHeight },
      { input: processed, left: panelWidth, top: headerHeight },
    ])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(outputPath);
}
