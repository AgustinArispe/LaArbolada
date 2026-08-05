import fs from 'node:fs/promises';
import path from 'node:path';
import { configPath, readJson, root } from './photo-workflow-lib.mjs';
import { loadStyleProfile } from '../photo-processing/style/profile.mjs';

export const reviewStatePath = path.join(root, 'reports', 'photo-review-state.json');
export const processingBatchPath = path.join(root, 'reports', 'photo-processing-batch.json');
export const sourceMatchingPath = path.join(root, 'reports', 'photo-source-matching.json');

export const reviewStatuses = new Set(['approved', 'skipped', 'manual', 'pending']);

function defaultDecision(record, timestamp) {
  if (record.status === 'locked') {
    return {
      status: 'skipped',
      updatedAt: timestamp,
      locked: true,
      reason: 'LOCKED owner-approved website image; permanently excluded from AI processing.',
    };
  }
  return { status: 'pending', updatedAt: null, locked: false, reason: null };
}

function normalizeDecision(record, decision, timestamp) {
  if (record.status === 'locked') return defaultDecision(record, decision?.updatedAt ?? timestamp);
  const status = reviewStatuses.has(decision?.status) ? decision.status : 'pending';
  return {
    status,
    updatedAt: decision?.updatedAt ?? (status === 'pending' ? null : timestamp),
    locked: false,
    reason: decision?.reason ?? null,
  };
}

export async function writeReviewState(state) {
  const temporaryPath = `${reviewStatePath}.tmp`;
  await fs.mkdir(path.dirname(reviewStatePath), { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
  await fs.rename(temporaryPath, reviewStatePath);
  return state;
}

export async function loadReviewState({ createIfMissing = false } = {}) {
  const matching = await readJson(sourceMatchingPath);
  let existing = null;
  try {
    existing = await readJson(reviewStatePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const timestamp = new Date().toISOString();
  const decisions = Object.fromEntries(
    matching.records.map((record) => [
      record.catalogId,
      normalizeDecision(record, existing?.decisions?.[record.catalogId], timestamp),
    ]),
  );
  const normalized = {
    schemaVersion: 1,
    updatedAt: existing?.updatedAt ?? timestamp,
    decisions,
  };
  if (!existing && createIfMissing) await writeReviewState(normalized);
  return { state: normalized, matching };
}

export async function updateReviewState(inputDecisions) {
  const { state, matching } = await loadReviewState({ createIfMissing: true });
  const timestamp = new Date().toISOString();
  const incoming = inputDecisions && typeof inputDecisions === 'object' ? inputDecisions : {};
  for (const record of matching.records) {
    if (record.status === 'locked') {
      state.decisions[record.catalogId] = defaultDecision(record, timestamp);
      continue;
    }
    const input = incoming[record.catalogId];
    const requestedStatus = typeof input === 'string' ? input : input?.status;
    if (!reviewStatuses.has(requestedStatus)) continue;
    const previous = state.decisions[record.catalogId];
    state.decisions[record.catalogId] = {
      status: requestedStatus,
      updatedAt: previous?.status === requestedStatus ? previous.updatedAt : timestamp,
      locked: false,
      reason: null,
    };
  }
  state.updatedAt = timestamp;
  await writeReviewState(state);
  return state;
}

function reviewSummary(state) {
  const values = Object.values(state.decisions);
  return {
    approved: values.filter((decision) => decision.status === 'approved').length,
    skipped: values.filter((decision) => decision.status === 'skipped').length,
    needsManualEditing: values.filter((decision) => decision.status === 'manual').length,
    pending: values.filter((decision) => decision.status === 'pending').length,
  };
}

export async function generateProcessingBatch() {
  const [{ state, matching }, config] = await Promise.all([
    loadReviewState({ createIfMissing: true }),
    readJson(configPath),
  ]);
  const lockedIds = new Set(config.lockedImages.map((image) => image.id));
  const style = await loadStyleProfile({ root, config });
  const images = matching.records
    .filter((record) => {
      const decision = state.decisions[record.catalogId];
      return (
        decision?.status === 'approved' &&
        record.status === 'matched' &&
        !lockedIds.has(record.catalogId)
      );
    })
    .map((record) => ({
      catalogId: record.catalogId,
      property: record.property,
      expectedOriginalFilename: record.expectedOriginalFilename,
      actualDiscoveredSourcePath: record.actualDiscoveredSourcePath,
      matchingMethod: record.matchingMethod,
      confidenceScore: record.confidenceScore,
      sourceSha256: record.sourceMetadata?.sha256 ?? null,
      styleProfileSha256: style.sha256,
      reviewDecision: 'approved',
    }));
  const batch = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    reviewStateUpdatedAt: state.updatedAt,
    totalApproved: images.length,
    estimatedImagesToProcess: images.length,
    styleProfile: {
      profileId: style.profileId,
      version: style.version,
      sha256: style.sha256,
      path: style.relativePath,
    },
    images,
  };
  const temporaryPath = `${processingBatchPath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(batch, null, 2)}\n`);
  await fs.rename(temporaryPath, processingBatchPath);
  return { batch, summary: reviewSummary(state) };
}

export async function loadApprovedProcessingBatch(workflow, environment = process.env) {
  let batch;
  try {
    batch = await readJson(processingBatchPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        'reports/photo-processing-batch.json is missing. Generate it from the approval dashboard before any provider upload.',
      );
    }
    throw error;
  }
  const { state } = await loadReviewState({ createIfMissing: false });
  const style = await loadStyleProfile({ root, config: workflow.config, environment });
  if (
    batch.styleProfile?.profileId !== style.profileId ||
    batch.styleProfile?.version !== style.version ||
    batch.styleProfile?.sha256 !== style.sha256
  ) {
    throw new Error(
      'The processing batch style identity is missing or stale. Generate a new batch.',
    );
  }
  if (batch.reviewStateUpdatedAt !== state.updatedAt) {
    throw new Error(
      'The processing batch is stale because review decisions changed. Regenerate reports/photo-processing-batch.json.',
    );
  }
  const workflowById = new Map(workflow.records.map((record) => [record.id, record]));
  const approvedIds = [];
  const seenIds = new Set();
  for (const item of batch.images ?? []) {
    const record = workflowById.get(item.catalogId);
    const decision = state.decisions[item.catalogId];
    if (
      !record ||
      record.locked ||
      record.sourceMatch.status !== 'matched' ||
      decision?.status !== 'approved' ||
      item.reviewDecision !== 'approved' ||
      item.actualDiscoveredSourcePath !== record.sourceRelativePath ||
      item.sourceSha256 !== record.expectedSource.sha256 ||
      item.styleProfileSha256 !== style.sha256
    ) {
      throw new Error(`Unsafe or stale processing batch entry: ${item.catalogId}.`);
    }
    if (seenIds.has(item.catalogId)) {
      throw new Error(`Duplicate processing batch entry: ${item.catalogId}.`);
    }
    seenIds.add(item.catalogId);
    approvedIds.push(item.catalogId);
  }
  if (approvedIds.length !== batch.totalApproved) {
    throw new Error('Processing batch count does not match its approved image list.');
  }
  const expectedApprovedIds = workflow.records
    .filter(
      (record) =>
        !record.locked &&
        record.sourceMatch.status === 'matched' &&
        state.decisions[record.id]?.status === 'approved',
    )
    .map((record) => record.id);
  const missingApprovedIds = expectedApprovedIds.filter((id) => !seenIds.has(id));
  if (missingApprovedIds.length || approvedIds.length !== expectedApprovedIds.length) {
    throw new Error(
      `Processing batch must contain every approved image exactly once. Missing: ${missingApprovedIds.join(', ') || 'none'}.`,
    );
  }
  return { batch, approvedIds, style };
}
