import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export function enhancedDerivativePaths(record, processedRoot) {
  const base = path.join(processedRoot, record.property, record.id);
  return {
    webp: {
      thumbnail: `${base}-thumbnail.webp`,
      mobile: `${base}-mobile.webp`,
      desktop: `${base}-desktop.webp`,
      large: `${base}-large.webp`,
    },
    avif: {
      thumbnail: `${base}-thumbnail.avif`,
      mobile: `${base}-mobile.avif`,
      desktop: `${base}-desktop.avif`,
      large: `${base}-large.avif`,
    },
    blur: `${base}-blur.webp`,
    manifest: `${base}-derivatives.json`,
  };
}

async function describe(filePath) {
  const [buffer, metadata] = await Promise.all([fs.readFile(filePath), sharp(filePath).metadata()]);
  return {
    path: filePath,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.length,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
  };
}

export async function generateDeliveryDerivatives({
  record,
  processedRoot,
  settings,
  metadata,
  masterPath = record.masterPath,
}) {
  if (record.locked) throw new Error(`LOCKED image ${record.id} cannot generate derivatives.`);
  const outputs = enhancedDerivativePaths(record, processedRoot);
  for (const [name, variant] of Object.entries(settings.variants)) {
    await fs.mkdir(path.dirname(outputs.webp[name]), { recursive: true });
    await Promise.all([
      sharp(masterPath)
        .resize({ width: variant.width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: variant.webpQuality, effort: 6 })
        .toFile(outputs.webp[name]),
      sharp(masterPath)
        .resize({ width: variant.width, fit: 'inside', withoutEnlargement: true })
        .avif({ quality: variant.avifQuality, effort: 6 })
        .toFile(outputs.avif[name]),
    ]);
  }
  await sharp(masterPath)
    .resize({ width: settings.blur.width, fit: 'inside', withoutEnlargement: true })
    .blur(settings.blur.sigma)
    .webp({ quality: settings.blur.quality, effort: 4 })
    .toFile(outputs.blur);
  const manifest = {
    schemaVersion: 2,
    catalogId: record.id,
    generatedAt: new Date().toISOString(),
    ...metadata,
    processedMaster: await describe(masterPath),
    webp: Object.fromEntries(
      await Promise.all(
        Object.entries(outputs.webp).map(async ([name, filePath]) => [
          name,
          await describe(filePath),
        ]),
      ),
    ),
    avif: Object.fromEntries(
      await Promise.all(
        Object.entries(outputs.avif).map(async ([name, filePath]) => [
          name,
          await describe(filePath),
        ]),
      ),
    ),
    blur: await describe(outputs.blur),
  };
  await fs.writeFile(outputs.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  return outputs;
}
