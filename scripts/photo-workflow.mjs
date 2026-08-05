import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { generateDeliveryDerivatives } from '../photo-processing/derivatives.mjs';
import {
  exists,
  loadWorkflow,
  processedRoot,
  root,
  verifyLockedPublishedFiles,
  writeManifest,
} from './photo-workflow-lib.mjs';

try {
  process.loadEnvFile?.(path.join(root, '.env'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const command = process.argv[2] ?? 'status';
const args = new Set(process.argv.slice(3));
const force = args.has('--force');
const workflow = await loadWorkflow();

function run(commandName, commandArguments) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, commandArguments, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${commandName} exited with code ${code}.`));
    });
  });
}

async function verifySource(record) {
  if (record.locked) {
    throw new Error(`LOCKED image ${record.id} cannot enter source preparation.`);
  }
  if (record.sourceMatch.status !== 'matched' || !record.sourcePath) {
    throw new Error(
      `Catalog source for ${record.id} is ${record.sourceMatch.status}; it cannot be prepared.`,
    );
  }
  const stat = await fs.stat(record.sourcePath);
  if (stat.size !== record.expectedSource.bytes) {
    throw new Error(`Source size mismatch for ${record.originalName}.`);
  }
}

async function status() {
  const { manifest, outputPath, matchingPath, reportPath } = await writeManifest(workflow);
  const counts = manifest.classificationCounts;
  console.log(`Catalog: ${manifest.totals.images} images`);
  console.log(
    `Classes: ${Object.entries(counts)
      .map(([name, count]) => `${name}=${count}`)
      .join(', ')}`,
  );
  console.log(`Original files discovered: ${manifest.totals.originalFilesDiscovered}`);
  console.log(`House originals discovered: ${manifest.totals.houseOriginalsDiscovered}`);
  console.log(`Apartment originals discovered: ${manifest.totals.apartmentOriginalsDiscovered}`);
  console.log(`Locked images: ${manifest.totals.locked} (published hashes verified)`);
  console.log(`Processable catalog entries: ${manifest.totals.processEligible}`);
  console.log(`Automatically matched sources: ${manifest.totals.automaticallyMatchedSources}`);
  console.log(`Ambiguous matches: ${manifest.totals.ambiguousMatches}`);
  console.log(`Unmatched catalog entries: ${manifest.totals.unmatchedCatalogEntries}`);
  console.log(`Unused original files: ${manifest.totals.unusedOriginalFiles}`);
  console.log(
    `Full-resolution processable sources: ${manifest.totals.sourceAvailable}/${manifest.totals.processEligible}`,
  );
  console.log(
    `Prepared PNGs: ${manifest.totals.preparedAvailable}/${manifest.totals.processEligible}`,
  );
  console.log(
    `Processed masters: ${manifest.totals.processedMasters}/${manifest.totals.processEligible}`,
  );
  console.log(
    `Complete WebP sets: ${manifest.totals.completeDerivativeSets}/${manifest.totals.processEligible}`,
  );
  console.log(`Provider: ${process.env.PHOTO_PROVIDER || workflow.config.provider.default}`);
  console.log(`Manifest: ${path.relative(root, outputPath)}`);
  console.log(`Source matching: ${path.relative(root, matchingPath)}`);
  console.log(`Report: ${path.relative(root, reportPath)}`);
}

async function prepare() {
  await verifyLockedPublishedFiles(workflow);
  const processable = workflow.records.filter((record) => !record.locked);
  const eligible = processable.filter((record) => record.sourceMatch.status === 'matched');
  for (const record of processable.filter((record) => record.sourceMatch.status !== 'matched')) {
    console.log(`${record.id}: ${record.sourceMatch.status}; excluded from preparation`);
  }
  for (const [index, record] of eligible.entries()) {
    await verifySource(record);
    if (!force && (await exists(record.preparedPath))) {
      console.log(`[${index + 1}/${eligible.length}] ${record.id}: prepared PNG exists`);
      continue;
    }
    await fs.mkdir(path.dirname(record.preparedPath), { recursive: true });
    console.log(`[${index + 1}/${eligible.length}] ${record.id}: lossless HEIC → PNG decode`);
    await run('sips', ['-s', 'format', 'png', record.sourcePath, '--out', record.preparedPath]);
    const metadata = await sharp(record.preparedPath).metadata();
    if (
      metadata.width !== record.expectedSource.width ||
      metadata.height !== record.expectedSource.height
    ) {
      throw new Error(
        `Prepared dimensions changed for ${record.id}: ${metadata.width}x${metadata.height}.`,
      );
    }
  }
  await status();
}

async function derivatives() {
  await verifyLockedPublishedFiles(workflow);
  const eligible = workflow.records.filter(
    (record) => !record.locked && record.sourceMatch.status === 'matched',
  );
  for (const [index, record] of eligible.entries()) {
    if (!(await exists(record.masterPath))) {
      console.log(`[${index + 1}/${eligible.length}] ${record.id}: no processed master; skipping`);
      continue;
    }
    await generateDeliveryDerivatives({
      record,
      processedRoot,
      settings: workflow.config.derivatives,
    });
    console.log(`[${index + 1}/${eligible.length}] ${record.id}: WebP, AVIF, and blur set ready`);
  }
  await status();
}

switch (command) {
  case 'status':
    await status();
    break;
  case 'prepare':
    await prepare();
    break;
  case 'derivatives':
    await derivatives();
    break;
  default:
    throw new Error(
      `Unknown photo workflow command: ${command}. Provider processing uses photos:gemini-pilot or photos:gemini-full.`,
    );
}
