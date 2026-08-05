import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateDeliveryDerivatives } from '../photo-processing/derivatives.mjs';
import { isTechnicalReviewCandidate } from '../photo-processing/review-image-set.mjs';
import { loadWorkflow, root } from './photo-workflow-lib.mjs';

const reviewRoot = path.join(root, 'public', 'images-gemini');
const manifestPath = path.join(root, 'src', 'data', 'gemini-review-manifest.json');
const metricsPath = path.join(root, 'reports', 'gemini-metrics.json');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function readJsonIfPresent(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

function publicReviewSources(image) {
  const base = `/images-gemini/${image.property}/${image.id}`;
 return {
    thumbnail: `${base}-thumbnail.webp`,
    mobile: `${base}-mobile.webp`,
    desktop: `${base}-desktop.webp`,
    large: `${base}-large.webp`,
  };
}

async function originalManifestEntry(image, locked, reason) {
  const sourcePath = image.sources.large ?? image.sources.desktop;
  const absolutePath = path.join(root, 'public', sourcePath.replace(/^\//, ''));
  const source = await fs.readFile(absolutePath);
  return {
    photoId: image.id,
    requestedSet: 'gemini-review',
    servedSet: 'original',
    fallback: true,
    reason,
    sourcePath,
    sha256: sha256(source),
    locked,
    sources: image.sources,
  };
}

async function reviewedManifestEntry({ image, record, result, config }) {
  const normalizedPath = path.join(root, result.developedPreviewPath);
  const masterPath = path.join(reviewRoot, image.property, `${image.id}.jpg`);
  const normalized = await fs.readFile(normalizedPath);
  await fs.mkdir(path.dirname(masterPath), { recursive: true });
  await fs.writeFile(masterPath, normalized);
  await generateDeliveryDerivatives({
    record,
    masterPath,
    processedRoot: reviewRoot,
    settings: config.derivatives,
    metadata: {
      reviewOnly: true,
      sourceSha256: result.sourceSha256,
      providerOutputSha256: result.providerOutputSha256,
      cacheIdentity: result.cacheIdentity,
      postDecision: result.postDecision,
    },
  });
  return {
    photoId: image.id,
    requestedSet: 'gemini-review',
    servedSet: 'gemini-review',
    fallback: false,
    reviewOnly: true,
    humanApproval: 'pending',
    sourcePath: `/images-gemini/${image.property}/${image.id}.jpg`,
    sha256: sha256(normalized),
    sources: publicReviewSources(image),
  };
}

const workflow = await loadWorkflow();
const metrics = await readJsonIfPresent(metricsPath, { results: [] });
const results = new Map((metrics.results ?? []).map((result) => [result.catalogId, result]));
const records = new Map(workflow.records.map((record) => [record.id, record]));
const lockedIds = new Set(workflow.config.lockedImages.map((image) => image.id));

await fs.mkdir(reviewRoot, { recursive: true });
const images = [];
for (const image of workflow.catalog) {
  const record = records.get(image.id);
  const result = results.get(image.id);
  if (lockedIds.has(image.id)) {
    images.push(
      await originalManifestEntry(
        image,
        true,
        'Permanently blocked photograph; original website asset remains mandatory.',
      ),
    );
  } else if (record && isTechnicalReviewCandidate(result)) {
    images.push(await reviewedManifestEntry({ image, record, result, config: workflow.config }));
  } else {
    images.push(
      await originalManifestEntry(image, false, 'No validated Gemini review image.'),
    );
  }
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  requestedSet: 'gemini-review',
  reviewOnly: true,
  sourceMetrics: path.relative(root, metricsPath),
  images,
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const reviewed = images.filter((image) => !image.fallback);
const fallback = images.length - reviewed.length;
console.log(
  `Gemini review image set: ${reviewed.length} technical review candidate(s), ${fallback} original fallback(s).`,
);
