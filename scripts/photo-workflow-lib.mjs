import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import decodeHeic from 'heic-decode';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const catalogPath = path.join(root, 'src', 'data', 'images.generated.ts');
export const inventoryPath = path.join(root, 'reports', 'drive-inventory.json');
export const configPath = path.join(root, 'photo-processing', 'config.json');
export const workRoot = path.join(root, '.photo-work');
export const processedRoot = path.join(root, 'public', 'images-processed');

export const allowedClassifications = new Set([
  'interior daylight',
  'interior mixed lighting',
  'exterior',
  'park',
  'creek',
  'detail',
  'locked',
]);

const posix = (value) => value.split(path.sep).join('/');

export function normalizeSourceFilename(value) {
  return path
    .parse(path.basename(value))
    .name.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function readCatalog() {
  const source = await fs.readFile(catalogPath, 'utf8');
  const match = source.match(
    /export const propertyImages: PropertyImage\[\] = (\[[\s\S]*?\]) as PropertyImage\[\];/,
  );
  if (!match) throw new Error(`Could not parse ${path.relative(root, catalogPath)}.`);
  return JSON.parse(match[1]);
}

async function recursivelyListFiles(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return recursivelyListFiles(entryPath);
      return entry.isFile() ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

async function sha256(filePath) {
  return createHash('sha256')
    .update(await fs.readFile(filePath))
    .digest('hex');
}

function parseSipsMetadata(stdout) {
  const metadata = {};
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s{2}([^:]+):\s*(.*)$/);
    if (match) metadata[match[1]] = match[2];
  }
  const exifMetadata = Object.fromEntries(
    ['creation', 'make', 'model', 'software'].flatMap((key) =>
      metadata[key] ? [[key, metadata[key]]] : [],
    ),
  );
  return {
    width: Number.parseInt(metadata.pixelWidth, 10) || null,
    height: Number.parseInt(metadata.pixelHeight, 10) || null,
    format: metadata.format || null,
    colorSpace: metadata.space || null,
    colorProfile: metadata.profile || null,
    exifMetadata,
    exifFingerprint: Object.keys(exifMetadata).length
      ? createHash('sha256').update(JSON.stringify(exifMetadata)).digest('hex')
      : null,
  };
}

async function readImageMetadata(filePath) {
  try {
    const { stdout } = await execFileAsync('sips', ['-g', 'all', filePath], {
      maxBuffer: 1024 * 1024,
    });
    return { ...parseSipsMetadata(stdout), metadataSource: 'macOS ImageIO (sips)' };
  } catch {
    try {
      const metadata = await sharp(filePath, { failOn: 'none' }).metadata();
      const exifFingerprint = metadata.exif
        ? createHash('sha256').update(metadata.exif).digest('hex')
        : null;
      return {
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        format: metadata.format ?? null,
        colorSpace: metadata.space ?? null,
        colorProfile: metadata.icc ? 'embedded ICC profile' : null,
        exifMetadata: {},
        exifFingerprint,
        metadataSource: 'Sharp metadata fallback',
      };
    } catch {
      return {
        width: null,
        height: null,
        format: null,
        colorSpace: null,
        colorProfile: null,
        exifMetadata: {},
        exifFingerprint: null,
        metadataSource: null,
      };
    }
  }
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
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function scanOriginalSources(config) {
  const supported = new Set(
    config.sourceDiscovery.supportedExtensions.map((extension) => extension.toLowerCase()),
  );
  const located = [];
  for (const [property, relativeDirectory] of Object.entries(
    config.sourceDiscovery.canonicalDirectories,
  )) {
    const absoluteDirectory = path.join(root, relativeDirectory);
    const files = await recursivelyListFiles(absoluteDirectory);
    for (const filePath of files) {
      if (!supported.has(path.extname(filePath).toLowerCase())) continue;
      located.push({ property, filePath });
    }
  }

  const discovered = await mapWithConcurrency(located, 6, async ({ property, filePath }) => {
    const [stat, metadata, digest] = await Promise.all([
      fs.stat(filePath),
      readImageMetadata(filePath),
      sha256(filePath),
    ]);
    return {
      property,
      fileName: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      normalizedFilename: normalizeSourceFilename(filePath),
      relativePath: posix(path.relative(root, filePath)),
      absolutePath: filePath,
      fileSizeBytes: stat.size,
      width: metadata.width,
      height: metadata.height,
      orientation:
        metadata.width && metadata.height
          ? metadata.width > metadata.height
            ? 'landscape'
            : metadata.width < metadata.height
              ? 'portrait'
              : 'square'
          : null,
      format: metadata.format,
      colorSpace: metadata.colorSpace,
      colorProfile: metadata.colorProfile,
      exifMetadata: metadata.exifMetadata,
      exifFingerprint: metadata.exifFingerprint,
      metadataSource: metadata.metadataSource,
      sha256: digest,
    };
  });

  return discovered.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function inventoryProperty(file) {
  if (file.interpretedProperty?.toLowerCase().includes('departamento')) return 'departamento';
  if (file.interpretedProperty?.toLowerCase().includes('casa')) return 'casa';
  return file.sourceFolder === 'drive-2' ? 'departamento' : 'casa';
}

function expectedInventoryFor(image, inventory) {
  const normalizedName = normalizeSourceFilename(image.originalName);
  return (
    inventory.files.find(
      (file) =>
        inventoryProperty(file) === image.property &&
        normalizeSourceFilename(file.originalName) === normalizedName,
    ) ?? null
  );
}

function dimensionsMatch(candidate, expected) {
  if (!candidate.width || !candidate.height || !expected?.width || !expected?.height) return false;
  return (
    (candidate.width === expected.width && candidate.height === expected.height) ||
    (candidate.width === expected.height && candidate.height === expected.width)
  );
}

function evidenceFor(candidate, image, expected) {
  const normalizedFilename =
    candidate.normalizedFilename === normalizeSourceFilename(image.originalName);
  const manifestFilename = expected
    ? candidate.normalizedFilename === normalizeSourceFilename(expected.originalName)
    : false;
  const dimensions = dimensionsMatch(candidate, expected ?? image);
  const fileSize = Boolean(
    expected?.fileSizeBytes && candidate.fileSizeBytes === expected.fileSizeBytes,
  );
  const sha256Match = Boolean(expected?.sha256 && candidate.sha256 === expected.sha256);
  const exifMetadataAvailable = Boolean(Object.keys(candidate.exifMetadata).length);
  const score =
    (normalizedFilename ? 0.5 : 0) +
    0.15 +
    (manifestFilename ? 0.08 : 0) +
    (dimensions ? 0.1 : 0) +
    (fileSize ? 0.07 : 0) +
    (sha256Match ? 0.1 : 0);
  return {
    normalizedFilename,
    propertyFolder: true,
    expectedManifestFilename: manifestFilename,
    dimensions,
    fileSize,
    exifMetadataAvailable,
    sha256: sha256Match,
    score: Number(score.toFixed(4)),
  };
}

const perceptualHashCache = new Map();

async function perceptualHash(filePath) {
  if (perceptualHashCache.has(filePath)) return perceptualHashCache.get(filePath);
  let pipeline;
  try {
    pipeline = sharp(filePath, { failOn: 'none' });
    await pipeline.metadata();
    pipeline = sharp(filePath, { failOn: 'none' });
  } catch (error) {
    if (!['.heic', '.heif'].includes(path.extname(filePath).toLowerCase())) throw error;
    const decoded = await decodeHeic({ buffer: await fs.readFile(filePath) });
    const data = Buffer.from(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
    pipeline = sharp(data, {
      raw: { width: decoded.width, height: decoded.height, channels: 4 },
    });
  }
  const pixels = await pipeline
    .rotate()
    .resize(17, 16, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  let bits = '';
  for (let row = 0; row < 16; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      const offset = row * 17 + column;
      bits += pixels[offset] > pixels[offset + 1] ? '1' : '0';
    }
  }
  perceptualHashCache.set(filePath, bits);
  return bits;
}

function hammingDistance(left, right) {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance / left.length;
}

async function comparePerceptually(image, candidates) {
  const publishedPath = path.join(root, 'public', image.sources.large.replace(/^\//, ''));
  try {
    const publishedHash = await perceptualHash(publishedPath);
    const compared = await mapWithConcurrency(candidates, 2, async (candidate) => ({
      candidate,
      distance: hammingDistance(publishedHash, await perceptualHash(candidate.absolutePath)),
    }));
    return compared.sort((left, right) => left.distance - right.distance);
  } catch {
    return [];
  }
}

function publicCandidate(candidate, evidence, perceptualDistance = null) {
  return {
    path: candidate.relativePath,
    fileName: candidate.fileName,
    width: candidate.width,
    height: candidate.height,
    fileSizeBytes: candidate.fileSizeBytes,
    sha256: candidate.sha256,
    evidence,
    perceptualDistance,
  };
}

async function matchCatalogImage(image, expected, propertySources, locked) {
  const normalizedExpected = normalizeSourceFilename(image.originalName);
  const named = propertySources.filter(
    (candidate) => candidate.normalizedFilename === normalizedExpected,
  );
  const evidence = new Map(
    propertySources.map((candidate) => [
      candidate.relativePath,
      evidenceFor(candidate, image, expected),
    ]),
  );

  let selected = null;
  let matchingMethod = null;
  let confidenceScore = 0;
  let possibleCandidates = [];

  if (named.length === 1) {
    selected = named[0];
    const signals = evidence.get(selected.relativePath);
    matchingMethod =
      'normalized filename → property folder → expected manifest filename → dimensions → file size → EXIF metadata → SHA-256';
    confidenceScore = Math.max(0.9, signals.score);
  } else if (named.length > 1) {
    const shaMatches = named.filter((candidate) => evidence.get(candidate.relativePath).sha256);
    const sizeDimensionMatches = named.filter((candidate) => {
      const signals = evidence.get(candidate.relativePath);
      return signals.dimensions && signals.fileSize;
    });
    if (shaMatches.length === 1) {
      selected = shaMatches[0];
      matchingMethod = 'normalized filename → property folder → manifest SHA-256';
      confidenceScore = 1;
    } else if (sizeDimensionMatches.length === 1) {
      selected = sizeDimensionMatches[0];
      matchingMethod = 'normalized filename → property folder → dimensions → file size';
      confidenceScore = 0.94;
    } else {
      const compared = await comparePerceptually(image, named);
      if (
        compared.length &&
        compared[0].distance <= 0.2 &&
        (!compared[1] || compared[1].distance - compared[0].distance >= 0.03)
      ) {
        selected = compared[0].candidate;
        matchingMethod =
          'normalized filename → property folder → metadata/SHA tie-break → perceptual comparison';
        confidenceScore = Number((0.8 + (0.2 - compared[0].distance)).toFixed(4));
      } else {
        possibleCandidates = (
          compared.length ? compared : named.map((candidate) => ({ candidate }))
        ).map(({ candidate, distance = null }) =>
          publicCandidate(candidate, evidence.get(candidate.relativePath), distance),
        );
      }
    }
  } else {
    const shaMatches = propertySources.filter(
      (candidate) => evidence.get(candidate.relativePath).sha256,
    );
    const sizeDimensionMatches = propertySources.filter((candidate) => {
      const signals = evidence.get(candidate.relativePath);
      return signals.dimensions && signals.fileSize;
    });
    if (shaMatches.length === 1) {
      selected = shaMatches[0];
      matchingMethod = 'property folder → expected manifest filename → SHA-256';
      confidenceScore = 0.98;
    } else if (sizeDimensionMatches.length === 1) {
      selected = sizeDimensionMatches[0];
      matchingMethod = 'property folder → expected manifest filename → dimensions → file size';
      confidenceScore = 0.88;
    } else if (propertySources.length) {
      const compared = await comparePerceptually(image, propertySources);
      if (
        compared.length &&
        compared[0].distance <= 0.2 &&
        (!compared[1] || compared[1].distance - compared[0].distance >= 0.03)
      ) {
        selected = compared[0].candidate;
        matchingMethod =
          'property folder → dimensions → file size → EXIF metadata → SHA-256 → perceptual comparison';
        confidenceScore = Number((0.72 + (0.2 - compared[0].distance)).toFixed(4));
      } else {
        possibleCandidates = compared
          .slice(0, 8)
          .map(({ candidate, distance }) =>
            publicCandidate(candidate, evidence.get(candidate.relativePath), distance),
          );
      }
    }
  }

  const status = locked
    ? 'locked'
    : selected
      ? 'matched'
      : possibleCandidates.length
        ? 'ambiguous'
        : 'unmatched';
  return {
    catalogId: image.id,
    property: image.property,
    expectedOriginalFilename: image.originalName,
    actualDiscoveredSourcePath: selected?.relativePath ?? null,
    matchingMethod: selected ? matchingMethod : null,
    confidenceScore: selected ? Number(Math.min(1, confidenceScore).toFixed(4)) : 0,
    status,
    possibleCandidates,
    evidence: selected ? evidence.get(selected.relativePath) : null,
    sourceMetadata: selected
      ? {
          width: selected.width,
          height: selected.height,
          fileSizeBytes: selected.fileSizeBytes,
          format: selected.format,
          colorSpace: selected.colorSpace,
          colorProfile: selected.colorProfile,
          exifMetadata: selected.exifMetadata,
          exifFingerprint: selected.exifFingerprint,
          sha256: selected.sha256,
        }
      : null,
  };
}

async function buildSourceMatching(catalog, inventory, config, lockedById) {
  const discovered = await scanOriginalSources(config);
  const records = [];
  for (const image of catalog) {
    const expected = expectedInventoryFor(image, inventory);
    const propertySources = discovered.filter((source) => source.property === image.property);
    records.push(
      await matchCatalogImage(image, expected, propertySources, lockedById.get(image.id) ?? null),
    );
  }
  const assigned = new Set(
    records.map((record) => record.actualDiscoveredSourcePath).filter(Boolean),
  );
  const unusedSourceFiles = discovered
    .filter((source) => !assigned.has(source.relativePath))
    .map((source) => ({
      property: source.property,
      path: source.relativePath,
      fileName: source.fileName,
      width: source.width,
      height: source.height,
      fileSizeBytes: source.fileSizeBytes,
      sha256: source.sha256,
    }));
  const houseOriginals = discovered.filter((source) => source.property === 'casa').length;
  const apartmentOriginals = discovered.filter(
    (source) => source.property === 'departamento',
  ).length;
  return {
    canonicalSourceDirectories: config.sourceDiscovery.canonicalDirectories,
    supportedExtensions: config.sourceDiscovery.supportedExtensions,
    summary: {
      totalOriginalFilesDiscovered: discovered.length,
      houseOriginalsDiscovered: houseOriginals,
      apartmentOriginalsDiscovered: apartmentOriginals,
      lockedImages: records.filter((record) => record.status === 'locked').length,
      processableCatalogEntries: records.filter((record) => record.status !== 'locked').length,
      automaticallyMatchedSources: records.filter((record) => record.status === 'matched').length,
      ambiguousMatches: records.filter((record) => record.status === 'ambiguous').length,
      unmatchedCatalogEntries: records.filter((record) => record.status === 'unmatched').length,
      unusedOriginalFiles: unusedSourceFiles.length,
    },
    records,
    unusedSourceFiles,
    discovered,
  };
}

function validateCatalogAndLockPolicy(catalog, config) {
  const catalogIds = new Set(catalog.map((image) => image.id));
  const catalogById = new Map(catalog.map((image) => [image.id, image]));
  const lockedById = new Map(config.lockedImages.map((image) => [image.id, image]));
  if (lockedById.size !== config.lockedImages.length) {
    throw new Error('Locked image IDs must be unique.');
  }
  for (const locked of config.lockedImages) {
    const catalogImage = catalogById.get(locked.id);
    if (!catalogImage) throw new Error(`Unknown locked image ID: ${locked.id}.`);
    if (catalogImage.originalName !== locked.originalName) {
      throw new Error(`Locked original-name mismatch for ${locked.id}.`);
    }
    for (const [variant, source] of Object.entries(locked.publishedSources)) {
      if (catalogImage.sources[variant] !== source.path) {
        throw new Error(`Locked published-source mismatch for ${locked.id} (${variant}).`);
      }
    }
  }

  const classificationIds = Object.keys(config.classifications);
  const missingClassifications = catalog.filter((image) => !config.classifications[image.id]);
  const unknownClassifications = classificationIds.filter((id) => !catalogIds.has(id));
  const invalidClassifications = classificationIds.filter(
    (id) => !allowedClassifications.has(config.classifications[id]),
  );
  if (
    missingClassifications.length ||
    unknownClassifications.length ||
    invalidClassifications.length
  ) {
    throw new Error(
      [
        missingClassifications.length &&
          `Missing classifications: ${missingClassifications.map((image) => image.id).join(', ')}`,
        unknownClassifications.length &&
          `Unknown classified IDs: ${unknownClassifications.join(', ')}`,
        invalidClassifications.length &&
          `Invalid classifications: ${invalidClassifications.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  const invalidLockStates = catalog.filter(
    (image) => (config.classifications[image.id] === 'locked') !== lockedById.has(image.id),
  );
  if (invalidLockStates.length) {
    throw new Error(
      `Classification/lock policy mismatch: ${invalidLockStates.map((image) => image.id).join(', ')}`,
    );
  }
  return lockedById;
}

export async function loadWorkflow() {
  const [catalog, inventory, config] = await Promise.all([
    readCatalog(),
    readJson(inventoryPath),
    readJson(configPath),
  ]);
  const lockedById = validateCatalogAndLockPolicy(catalog, config);
  const sourceMatching = await buildSourceMatching(catalog, inventory, config, lockedById);
  const matchById = new Map(sourceMatching.records.map((record) => [record.catalogId, record]));
  const discoveredByPath = new Map(
    sourceMatching.discovered.map((source) => [source.relativePath, source]),
  );
  const records = catalog.map((image) => {
    const sourceMatch = matchById.get(image.id);
    const discoveredSource = sourceMatch.actualDiscoveredSourcePath
      ? discoveredByPath.get(sourceMatch.actualDiscoveredSourcePath)
      : null;
    const expectedInventory = expectedInventoryFor(image, inventory);
    return {
      ...image,
      classification: config.classifications[image.id],
      locked: lockedById.get(image.id) ?? null,
      sourceMatch,
      sourcePath: discoveredSource?.absolutePath ?? null,
      sourceRelativePath: discoveredSource?.relativePath ?? null,
      expectedSource: {
        bytes: discoveredSource?.fileSizeBytes ?? expectedInventory?.fileSizeBytes ?? null,
        sha256: discoveredSource?.sha256 ?? expectedInventory?.sha256 ?? null,
        width: discoveredSource?.width ?? expectedInventory?.width ?? image.width,
        height: discoveredSource?.height ?? expectedInventory?.height ?? image.height,
      },
      catalogExpectedSource: expectedInventory
        ? {
            bytes: expectedInventory.fileSizeBytes,
            sha256: expectedInventory.sha256,
            width: expectedInventory.width,
            height: expectedInventory.height,
          }
        : null,
      preparedPath: path.join(workRoot, 'prepared', `${image.id}.png`),
      masterPath: path.join(processedRoot, image.property, `${image.id}.jpg`),
    };
  });
  return { catalog, inventory, config, sourceMatching, records };
}

export async function verifyLockedPublishedFiles(workflow) {
  const results = [];
  for (const locked of workflow.config.lockedImages) {
    const variants = [];
    for (const [name, source] of Object.entries(locked.publishedSources)) {
      const filePath = path.join(root, 'public', source.path.replace(/^\//, ''));
      if (!(await exists(filePath))) {
        throw new Error(`LOCKED website asset is missing: ${source.path}`);
      }
      const actualSha256 = await sha256(filePath);
      if (actualSha256 !== source.sha256) {
        throw new Error(
          `LOCKED website asset changed: ${source.path}. Expected ${source.sha256}, got ${actualSha256}.`,
        );
      }
      variants.push({ name, path: source.path, sha256: actualSha256, verified: true });
    }
    results.push({
      id: locked.id,
      originalName: locked.originalName,
      classification: 'locked',
      reason: locked.reason,
      variants,
    });
  }
  return results;
}

export function derivativePaths(record) {
  const base = path.join(processedRoot, record.property, record.id);
  return {
    thumbnail: `${base}-thumbnail.webp`,
    mobile: `${base}-mobile.webp`,
    desktop: `${base}-desktop.webp`,
    large: `${base}-large.webp`,
  };
}

export async function exists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function publicProcessedSources(record) {
  const base = `/images-processed/${record.property}/${record.id}`;
  return {
    thumbnail: `${base}-thumbnail.webp`,
    mobile: `${base}-mobile.webp`,
    desktop: `${base}-desktop.webp`,
    large: `${base}-large.webp`,
  };
}

export async function buildManifest(workflow) {
  const lockedImages = await verifyLockedPublishedFiles(workflow);
  const items = await Promise.all(
    workflow.records.map(async (record) => {
      const derivatives = derivativePaths(record);
      return {
        id: record.id,
        property: record.property,
        originalName: record.originalName,
        classification: record.classification,
        locked: Boolean(record.locked),
        lockedReason: record.locked?.reason ?? null,
        source: record.sourceRelativePath,
        sourceMatch: record.sourceMatch,
        expectedSource: record.expectedSource,
        catalogExpectedSource: record.catalogExpectedSource,
        sourceAvailable: await exists(record.sourcePath),
        preparedAvailable: await exists(record.preparedPath),
        processedMaster: path.relative(root, record.masterPath),
        processedMasterAvailable: await exists(record.masterPath),
        processedSources: publicProcessedSources(record),
        activeLockedSources: record.locked
          ? Object.fromEntries(
              Object.entries(record.locked.publishedSources).map(([name, source]) => [
                name,
                source.path,
              ]),
            )
          : null,
        derivativeAvailability: Object.fromEntries(
          await Promise.all(
            Object.entries(derivatives).map(async ([name, filePath]) => [
              name,
              await exists(filePath),
            ]),
          ),
        ),
      };
    }),
  );

  const classificationCounts = Object.fromEntries(
    [...allowedClassifications].map((classification) => [
      classification,
      items.filter((item) => item.classification === classification).length,
    ]),
  );
  const sourceSummary = workflow.sourceMatching.summary;

  return {
    generatedAt: new Date().toISOString(),
    provider: workflow.config.provider,
    policy: workflow.config.policy,
    sourceDiscovery: workflow.config.sourceDiscovery,
    totals: {
      images: items.length,
      originalFilesDiscovered: sourceSummary.totalOriginalFilesDiscovered,
      houseOriginalsDiscovered: sourceSummary.houseOriginalsDiscovered,
      apartmentOriginalsDiscovered: sourceSummary.apartmentOriginalsDiscovered,
      locked: lockedImages.length,
      processEligible: items.filter((item) => !item.locked).length,
      automaticallyMatchedSources: sourceSummary.automaticallyMatchedSources,
      ambiguousMatches: sourceSummary.ambiguousMatches,
      unmatchedCatalogEntries: sourceSummary.unmatchedCatalogEntries,
      unusedOriginalFiles: sourceSummary.unusedOriginalFiles,
      sourceAvailable: items.filter(
        (item) => !item.locked && item.sourceMatch.status === 'matched' && item.sourceAvailable,
      ).length,
      preparedAvailable: items.filter((item) => !item.locked && item.preparedAvailable).length,
      processedMasters: items.filter((item) => !item.locked && item.processedMasterAvailable)
        .length,
      completeDerivativeSets: items.filter(
        (item) => !item.locked && Object.values(item.derivativeAvailability).every(Boolean),
      ).length,
    },
    classificationCounts,
    lockedImages,
    pilotIds: workflow.config.pilotIds,
    unusedSourceFiles: workflow.sourceMatching.unusedSourceFiles,
    items,
  };
}

function sourceMatchingReport(workflow, generatedAt) {
  return {
    generatedAt,
    canonicalSourceDirectories: workflow.sourceMatching.canonicalSourceDirectories,
    supportedExtensions: workflow.sourceMatching.supportedExtensions,
    summary: workflow.sourceMatching.summary,
    records: workflow.sourceMatching.records,
    unusedSourceFiles: workflow.sourceMatching.unusedSourceFiles,
    discoveredOriginalFiles: workflow.sourceMatching.discovered.map(
      ({ absolutePath: _absolutePath, ...source }) => source,
    ),
  };
}

export async function writeManifest(workflow) {
  const manifest = await buildManifest(workflow);
  const outputPath = path.join(root, 'reports', 'photo-processing-manifest.json');
  const matchingPath = path.join(root, 'reports', 'photo-source-matching.json');
  const reportPath = path.join(root, 'reports', 'photo-processing-report.md');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await Promise.all([
    fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`),
    fs.writeFile(
      matchingPath,
      `${JSON.stringify(sourceMatchingReport(workflow, manifest.generatedAt), null, 2)}\n`,
    ),
  ]);
  const lockedRows = manifest.lockedImages
    .map(
      (image) =>
        `| \`${image.id}\` | \`${image.originalName}\` | ${image.reason} | ${image.variants.length} published variants SHA-256 verified; excluded from analysis, upload, editing, comparisons, cache, batches, derivatives, and source replacement. |`,
    )
    .join('\n');
  const report = `# Professional photo-processing report

Generated: ${manifest.generatedAt}

## Canonical original sources

- House: \`${manifest.sourceDiscovery.canonicalDirectories.casa}/\`
- Apartment: \`${manifest.sourceDiscovery.canonicalDirectories.departamento}/\`
- Recursive scan; supported extensions: ${manifest.sourceDiscovery.supportedExtensions.join(', ')}

## Locked images

| Image ID | Corresponding HEIC | Reason | Enforcement |
| --- | --- | --- | --- |
${lockedRows}

## Source matching

- Original files discovered: ${manifest.totals.originalFilesDiscovered}
- House originals discovered: ${manifest.totals.houseOriginalsDiscovered}
- Apartment originals discovered: ${manifest.totals.apartmentOriginalsDiscovered}
- Processable catalog entries: ${manifest.totals.processEligible}
- Automatically matched sources: ${manifest.totals.automaticallyMatchedSources}
- Ambiguous matches: ${manifest.totals.ambiguousMatches}
- Unmatched catalog entries: ${manifest.totals.unmatchedCatalogEntries}
- Unused original files: ${manifest.totals.unusedOriginalFiles}

## Processing status

- Locked owner-approved images: ${manifest.totals.locked}
- Prepared PNGs: ${manifest.totals.preparedAvailable}
- Corrected masters: ${manifest.totals.processedMasters}
- Complete processed WebP sets: ${manifest.totals.completeDerivativeSets}

The locked images retain their existing website source paths even when \`PUBLIC_IMAGE_SET=processed\` is selected. Source discovery and matching are read-only; originals are never renamed, moved, duplicated, or modified.
`;
  await fs.writeFile(reportPath, report);
  return { manifest, outputPath, matchingPath, reportPath };
}
