import fs from 'node:fs/promises';
import path from 'node:path';
import decodeHeic from 'heic-decode';
import sharp from 'sharp';

export const developerVersion = 'adaptive-architectural-developer-v1';

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

function adjustmentFromPlan(plan, operation) {
  const adjustment = plan.adjustments?.find((item) => item.operation === operation);
  return (
    adjustment ?? {
      operation,
      apply: false,
      intensity: 0,
      direction: 'none',
      reason: 'Provider found no correction necessary.',
    }
  );
}

function adaptiveIntensity(plan, operation, measuredNeed) {
  const adjustment = adjustmentFromPlan(plan, operation);
  if (!adjustment.apply || measuredNeed <= 0) return 0;
  return clamp(Math.sqrt(clamp(adjustment.intensity) * clamp(measuredNeed)));
}

async function decodeSource(record, sourceBuffer) {
  try {
    const decoded = sharp(sourceBuffer, { failOn: 'error' }).autoOrient().toColourspace('srgb');
    await decoded.metadata();
    return decoded.removeAlpha().raw().toBuffer({ resolveWithObject: true });
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
    })
      .removeAlpha()
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });
  }
}

function analyzePixels(data, width, height, channels) {
  const histogram = new Uint32Array(256);
  let red = 0;
  let green = 0;
  let blue = 0;
  let saturation = 0;
  let horizontalDifference = 0;
  let horizontalSamples = 0;
  const pixelCount = width * height;
  const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / 500000)));
  let sampled = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      histogram[Math.round(luma)] += 1;
      red += r;
      green += g;
      blue += b;
      const maximum = Math.max(r, g, b);
      const minimum = Math.min(r, g, b);
      saturation += maximum ? (maximum - minimum) / maximum : 0;
      if (x >= stride) {
        const previous = offset - stride * channels;
        const previousLuma =
          0.2126 * data[previous] + 0.7152 * data[previous + 1] + 0.0722 * data[previous + 2];
        horizontalDifference += Math.abs(luma - previousLuma) / 255;
        horizontalSamples += 1;
      }
      sampled += 1;
    }
  }

  function quantile(fraction) {
    const target = sampled * fraction;
    let accumulated = 0;
    for (let value = 0; value < histogram.length; value += 1) {
      accumulated += histogram[value];
      if (accumulated >= target) return value / 255;
    }
    return 1;
  }

  const p05 = quantile(0.05);
  const p50 = quantile(0.5);
  const p95 = quantile(0.95);
  const channelMeans = {
    red: red / sampled / 255,
    green: green / sampled / 255,
    blue: blue / sampled / 255,
  };
  const channelMaximum = Math.max(channelMeans.red, channelMeans.green, channelMeans.blue);
  const channelMinimum = Math.min(channelMeans.red, channelMeans.green, channelMeans.blue);
  return {
    sampledPixels: sampled,
    p05: Number(p05.toFixed(6)),
    medianLuminance: Number(p50.toFixed(6)),
    p95: Number(p95.toFixed(6)),
    dynamicRange: Number((p95 - p05).toFixed(6)),
    averageSaturation: Number((saturation / sampled).toFixed(6)),
    channelMeans,
    whiteBalanceImbalance: Number((channelMaximum - channelMinimum).toFixed(6)),
    detailActivity: Number((horizontalDifference / horizontalSamples).toFixed(6)),
  };
}

function deriveAdjustments(plan, analysis) {
  const exposureStops = clamp(
    Math.log2(0.46 / Math.max(analysis.medianLuminance, 0.02)),
    -0.75,
    0.75,
  );
  const exposureNeed = clamp(Math.abs(exposureStops) / 0.75);
  const dynamicRangeNeed = clamp((0.72 - analysis.dynamicRange) / 0.5);
  const shadowNeed = clamp((0.14 - analysis.p05) / 0.14);
  const highlightNeed = clamp((analysis.p95 - 0.88) / 0.12);
  const saturationDifference = 0.24 - analysis.averageSaturation;
  const saturationNeed = clamp(Math.abs(saturationDifference) / 0.24);
  const contrastNeed = clamp(Math.abs(0.7 - analysis.dynamicRange) / 0.5);
  const detailNeed = clamp((0.075 - analysis.detailActivity) / 0.075);
  const noiseNeed = clamp(
    ((analysis.detailActivity - 0.09) / 0.18) * (analysis.medianLuminance < 0.38 ? 1 : 0.45),
  );

  const intensity = {
    exposure: adaptiveIntensity(plan, 'exposure', exposureNeed),
    whiteBalance: adaptiveIntensity(
      plan,
      'white_balance',
      clamp(analysis.whiteBalanceImbalance / 0.24),
    ),
    contrast: adaptiveIntensity(plan, 'contrast', contrastNeed),
    localContrast: adaptiveIntensity(plan, 'local_contrast', dynamicRangeNeed),
    microContrast: adaptiveIntensity(plan, 'micro_contrast', detailNeed),
    dynamicRange: adaptiveIntensity(plan, 'dynamic_range', dynamicRangeNeed),
    highlights: adaptiveIntensity(plan, 'highlight_recovery', highlightNeed),
    shadows: adaptiveIntensity(plan, 'shadow_recovery', shadowNeed),
    saturation: adaptiveIntensity(plan, 'natural_saturation', saturationNeed),
    vibrance: adaptiveIntensity(plan, 'natural_vibrance', saturationNeed),
    colorBalance: adaptiveIntensity(
      plan,
      'color_balance',
      clamp(analysis.whiteBalanceImbalance / 0.24),
    ),
    noiseReduction: adaptiveIntensity(plan, 'noise_reduction', noiseNeed),
    sharpening: adaptiveIntensity(plan, 'sharpening', detailNeed),
    textureClarity: adaptiveIntensity(plan, 'texture_clarity', detailNeed),
    naturalDepth: adaptiveIntensity(plan, 'natural_depth', contrastNeed),
    windowBalance: adaptiveIntensity(plan, 'window_brightness_balance', highlightNeed),
    interiorBalance: adaptiveIntensity(plan, 'interior_brightness_balance', shadowNeed),
    vegetationColor: adaptiveIntensity(plan, 'vegetation_color', saturationNeed),
    skyColor: adaptiveIntensity(plan, 'sky_color', Math.max(highlightNeed, saturationNeed)),
    sunlightBalance: adaptiveIntensity(plan, 'sunlight_balance', highlightNeed),
  };

  const green = analysis.channelMeans.green;
  let redGainTarget = green / Math.max(analysis.channelMeans.red, 0.02);
  let blueGainTarget = green / Math.max(analysis.channelMeans.blue, 0.02);
  const whiteBalanceStrength = Math.max(intensity.whiteBalance, intensity.colorBalance);
  const whiteBalanceDirection = adjustmentFromPlan(plan, 'white_balance').direction;
  if (whiteBalanceDirection === 'warm') {
    redGainTarget = 1 + analysis.whiteBalanceImbalance;
    blueGainTarget = 1 - analysis.whiteBalanceImbalance * 0.7;
  } else if (whiteBalanceDirection === 'cool') {
    redGainTarget = 1 - analysis.whiteBalanceImbalance * 0.7;
    blueGainTarget = 1 + analysis.whiteBalanceImbalance;
  }
  const redGain = 1 + (redGainTarget - 1) * whiteBalanceStrength;
  const blueGain = 1 + (blueGainTarget - 1) * whiteBalanceStrength;

  return {
    intensity,
    exposureStops: exposureStops * intensity.exposure,
    redGain: clamp(redGain, 0.88, 1.12),
    greenGain: 1,
    blueGain: clamp(blueGain, 0.88, 1.12),
    saturationDelta:
      (adjustmentFromPlan(plan, 'natural_saturation').direction === 'decrease'
        ? -1
        : adjustmentFromPlan(plan, 'natural_saturation').direction === 'increase'
          ? 1
          : Math.sign(saturationDifference)) *
      Math.max(intensity.saturation, intensity.vibrance) *
      Math.min(Math.abs(saturationDifference), 0.16),
    contrastDirection:
      adjustmentFromPlan(plan, 'contrast').direction === 'decrease'
        ? -1
        : adjustmentFromPlan(plan, 'contrast').direction === 'increase'
          ? 1
          : analysis.dynamicRange < 0.7
            ? 1
            : -1,
    saturationDirection: Math.sign(saturationDifference),
  };
}

function applyPhotometricDevelopment(data, channels, derived, plan) {
  const output = Buffer.allocUnsafe(data.length);
  const exposureFactor = 2 ** derived.exposureStops;
  const contrastStrength = Math.max(
    derived.intensity.contrast,
    derived.intensity.localContrast,
    derived.intensity.dynamicRange,
    derived.intensity.naturalDepth,
  );
  const shadowStrength = Math.max(derived.intensity.shadows, derived.intensity.interiorBalance);
  const highlightStrength = Math.max(
    derived.intensity.highlights,
    derived.intensity.windowBalance,
    derived.intensity.sunlightBalance,
  );
  const saturationFactor = 1 + derived.saturationDelta;
  const vegetationDirection = adjustmentFromPlan(plan, 'vegetation_color').direction;
  const skyDirection = adjustmentFromPlan(plan, 'sky_color').direction;

  for (let offset = 0; offset < data.length; offset += channels) {
    let red = clamp((data[offset] / 255) * derived.redGain * exposureFactor);
    let green = clamp((data[offset + 1] / 255) * derived.greenGain * exposureFactor);
    let blue = clamp((data[offset + 2] / 255) * derived.blueGain * exposureFactor);
    let luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const lifted = luma + shadowStrength * (1 - luma) ** 2 * 0.14;
    const compressed = lifted - highlightStrength * lifted ** 2 * 0.11;
    const contrasted =
      0.5 + (compressed - 0.5) * (1 + contrastStrength * derived.contrastDirection * 0.2);
    const targetLuma = clamp(contrasted);
    const lumaScale = targetLuma / Math.max(luma, 0.002);
    red = clamp(red * lumaScale);
    green = clamp(green * lumaScale);
    blue = clamp(blue * lumaScale);
    luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    red = clamp(luma + (red - luma) * saturationFactor);
    green = clamp(luma + (green - luma) * saturationFactor);
    blue = clamp(luma + (blue - luma) * saturationFactor);

    const vegetationPixel = green > red * 1.05 && green > blue * 1.04;
    if (vegetationPixel && derived.intensity.vegetationColor > 0) {
      const direction =
        vegetationDirection === 'decrease'
          ? -1
          : vegetationDirection === 'increase'
            ? 1
            : derived.saturationDirection;
      const correction = direction * derived.intensity.vegetationColor * 0.025;
      green = clamp(green + correction * (1 - green));
    }
    const skyPixel = blue > red * 1.08 && blue > green * 1.025;
    if (skyPixel && derived.intensity.skyColor > 0) {
      const direction =
        skyDirection === 'decrease'
          ? -1
          : skyDirection === 'increase'
            ? 1
            : derived.saturationDirection;
      const correction = direction * derived.intensity.skyColor * 0.02;
      blue = clamp(blue + correction * (1 - blue));
    }

    output[offset] = Math.round(red * 255);
    output[offset + 1] = Math.round(green * 255);
    output[offset + 2] = Math.round(blue * 255);
    for (let channel = 3; channel < channels; channel += 1)
      output[offset + channel] = data[offset + channel];
  }
  return output;
}

async function applyAdaptiveDetail(data, info, derived) {
  let current = data;
  const noise = derived.intensity.noiseReduction;
  if (noise > 0.02) {
    const blurred = await sharp(current, { raw: info })
      .blur(0.3 + noise * 0.85)
      .raw()
      .toBuffer();
    const weight = noise * 0.28;
    const blended = Buffer.allocUnsafe(current.length);
    for (let index = 0; index < current.length; index += 1) {
      blended[index] = Math.round(current[index] * (1 - weight) + blurred[index] * weight);
    }
    current = blended;
  }
  const detail = Math.max(
    derived.intensity.sharpening,
    derived.intensity.microContrast,
    derived.intensity.textureClarity,
  );
  if (detail > 0.02) {
    const sharpened = await sharp(current, { raw: info })
      .sharpen({
        sigma: 0.5 + detail * 1.1,
        m1: 0.25 + detail * 0.75,
        m2: 0.5 + detail * 1.5,
      })
      .raw()
      .toBuffer();
    const weight = detail * 0.32;
    const blended = Buffer.allocUnsafe(current.length);
    for (let index = 0; index < current.length; index += 1) {
      blended[index] = Math.round(current[index] * (1 - weight) + sharpened[index] * weight);
    }
    current = blended;
  }
  return current;
}

function adjustmentReport(plan, derived) {
  const intensityByOperation = {
    exposure: derived.intensity.exposure,
    white_balance: derived.intensity.whiteBalance,
    contrast: derived.intensity.contrast,
    local_contrast: derived.intensity.localContrast,
    micro_contrast: derived.intensity.microContrast,
    dynamic_range: derived.intensity.dynamicRange,
    highlight_recovery: derived.intensity.highlights,
    shadow_recovery: derived.intensity.shadows,
    natural_saturation: derived.intensity.saturation,
    natural_vibrance: derived.intensity.vibrance,
    color_balance: derived.intensity.colorBalance,
    noise_reduction: derived.intensity.noiseReduction,
    sharpening: derived.intensity.sharpening,
    texture_clarity: derived.intensity.textureClarity,
    natural_depth: derived.intensity.naturalDepth,
    window_brightness_balance: derived.intensity.windowBalance,
    interior_brightness_balance: derived.intensity.interiorBalance,
    vegetation_color: derived.intensity.vegetationColor,
    sky_color: derived.intensity.skyColor,
    sunlight_balance: derived.intensity.sunlightBalance,
  };
  const geometricallyBlocked = new Set([
    'lens_correction',
    'perspective_correction',
    'chromatic_aberration_reduction',
  ]);
  return plan.adjustments.map((adjustment) => {
    if (geometricallyBlocked.has(adjustment.operation)) {
      return {
        ...adjustment,
        applied: false,
        estimatedIntensity: 0,
        developerReason:
          'Blocked by immutable-geometry policy because no verified camera/lens profile is available.',
      };
    }
    const intensity = intensityByOperation[adjustment.operation] ?? 0;
    return {
      ...adjustment,
      applied: intensity > 0.02,
      estimatedIntensity: Number(intensity.toFixed(4)),
      developerReason:
        intensity > 0.02
          ? 'Strength derived from this image’s measured luminance, color, dynamic-range, and detail statistics.'
          : 'Analysis indicates that this adjustment should remain untouched.',
    };
  });
}

export async function developPhotograph({ record, sourceBuffer, plan, outputPath, styleIdentity }) {
  if (record.locked) throw new Error(`LOCKED image ${record.id} cannot enter development.`);
  const decoded = await decodeSource(record, sourceBuffer);
  const analysis = analyzePixels(
    decoded.data,
    decoded.info.width,
    decoded.info.height,
    decoded.info.channels,
  );
  const derived = deriveAdjustments(plan, analysis);
  const photometric = applyPhotometricDevelopment(
    decoded.data,
    decoded.info.channels,
    derived,
    plan,
  );
  const developed = await applyAdaptiveDetail(photometric, decoded.info, derived);
  const originalExif = record.sourceMatch.sourceMetadata?.exifMetadata ?? {};
  const ifd0 = Object.fromEntries(
    [
      ['Make', originalExif.make],
      ['Model', originalExif.model],
      ['Software', developerVersion],
      ['DateTime', originalExif.creation],
      [
        'ImageDescription',
        `Casa La Arbolada style ${styleIdentity.profileId}@${styleIdentity.version}; sha256=${styleIdentity.sha256}; developer=${developerVersion}`,
      ],
    ].filter(([, value]) => value),
  );
  const ifd2 = originalExif.creation
    ? { DateTimeOriginal: originalExif.creation, DateTimeDigitized: originalExif.creation }
    : {};
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  let output = sharp(developed, { raw: decoded.info }).withIccProfile('srgb');
  if (Object.keys(ifd0).length || Object.keys(ifd2).length) {
    output = output.withExif({ IFD0: ifd0, IFD2: ifd2 });
  }
  await output.jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toFile(temporaryPath);
  await fs.rename(temporaryPath, outputPath);
  return {
    outputPath,
    developerVersion,
    analysis,
    adjustments: adjustmentReport(plan, derived),
    geometryOperationsApplied: false,
    pixelCoordinateMapping: 'identity',
    dimensions: { width: decoded.info.width, height: decoded.info.height },
  };
}
