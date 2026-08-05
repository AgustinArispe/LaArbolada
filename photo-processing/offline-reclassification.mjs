import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncPilotReviewState } from './pilot.mjs';
import { reclassifyPilotResults } from './post-validation.mjs';
import { writeProcessingReports } from './reports.mjs';
import { loadStyleProfile } from './style/profile.mjs';
import { root, verifyLockedPublishedFiles } from '../scripts/photo-workflow-lib.mjs';

const cacheIndexPath = path.join(root, '.photo-work', 'cache', 'source-index.json');
const pilotStatePath = path.join(root, 'reports', 'photo-pilot-review-state.json');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${label} is missing or malformed at ${path.relative(root, filePath)}: ${error.message}`,
    );
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function snapshotDevelopedCandidates(cache, results) {
  const snapshots = new Map();
  for (const result of results) {
    const identity = result.cacheIdentity?.sha256;
    const entry = identity ? cache.entries?.[identity] : null;
    if (!entry?.developedPath) {
      throw new Error(`Cached developed candidate is missing for ${result.catalogId}.`);
    }
    const absolutePath = path.join(root, entry.developedPath);
    const bytes = await fs.readFile(absolutePath);
    const actualSha256 = sha256(bytes);
    if (entry.developedSha256 && entry.developedSha256 !== actualSha256) {
      throw new Error(`Cached developed candidate SHA-256 mismatch for ${result.catalogId}.`);
    }
    snapshots.set(result.catalogId, {
      path: entry.developedPath,
      sha256: actualSha256,
      bytes: bytes.length,
    });
  }
  return snapshots;
}

function decisionStatuses(state) {
  return Object.fromEntries(
    Object.entries(state?.decisions ?? {}).map(([id, decision]) => [id, decision?.status ?? null]),
  );
}

export async function reclassifyExistingPilot({
  workflow,
  environment = process.env,
  write = true,
} = {}) {
  if (!workflow) throw new Error('Offline pilot reclassification requires the loaded workflow.');
  const style = await loadStyleProfile({ root, config: workflow.config, environment });
  const metricsPath = path.join(root, workflow.config.reports.metrics);
  const [metrics, priorState, cacheBytes] = await Promise.all([
    readJson(metricsPath, 'Pilot metrics'),
    readOptionalJson(pilotStatePath),
    fs.readFile(cacheIndexPath),
  ]);
  const cache = JSON.parse(cacheBytes.toString('utf8'));
  if (metrics.runMode !== 'pilot')
    throw new Error('Existing metrics are not a completed pilot run.');
  if (metrics.styleProfile?.sha256 !== style.sha256)
    throw new Error('Existing pilot style hash does not match the active style profile.');

  const byId = new Map((metrics.results ?? []).map((result) => [result.catalogId, result]));
  const pilotResults = workflow.config.pilotIds.map((id) => byId.get(id));
  if (pilotResults.some((result) => !result))
    throw new Error('Existing pilot metrics do not contain all five configured pilot photographs.');

  await verifyLockedPublishedFiles(workflow);
  const developedBefore = await snapshotDevelopedCandidates(cache, pilotResults);
  const cacheSha256Before = sha256(cacheBytes);
  const approvalsBefore = decisionStatuses(priorState);
  const results = reclassifyPilotResults({ results: pilotResults, style });
  const outcomes = Object.fromEntries(
    results.map((result) => [result.catalogId, result.policyOutcome]),
  );

  if (write) {
    await writeProcessingReports({
      workflow,
      providerName: metrics.provider,
      model: metrics.model,
      runMode: 'pilot',
      results,
      style,
      providerRequests: metrics.providerRequests,
      policyReclassification: {
        performedAt: new Date().toISOString(),
        mode: 'offline-cache-only',
        providerRequests: 0,
        reprocessedImages: 0,
      },
    });
    const updatedState = await syncPilotReviewState({
      statePath: pilotStatePath,
      results,
      style,
    });
    const approvalsAfter = decisionStatuses(updatedState);
    for (const id of workflow.config.pilotIds) {
      if ((approvalsBefore[id] ?? 'pending') !== approvalsAfter[id]) {
        throw new Error(
          `Offline reclassification attempted to change the human approval for ${id}.`,
        );
      }
    }
  }

  const cacheBytesAfter = await fs.readFile(cacheIndexPath);
  if (!cacheBytes.equals(cacheBytesAfter))
    throw new Error('Offline reclassification changed the processing cache.');
  const developedAfter = await snapshotDevelopedCandidates(cache, pilotResults);
  for (const [id, before] of developedBefore) {
    const after = developedAfter.get(id);
    if (before.sha256 !== after.sha256 || before.bytes !== after.bytes)
      throw new Error(`Offline reclassification changed developed JPEG bytes for ${id}.`);
  }
  await verifyLockedPublishedFiles(workflow);

  return {
    outcomes,
    providerRequests: 0,
    reprocessedImages: 0,
    cacheSha256: cacheSha256Before,
    developedCandidates: Object.fromEntries(developedAfter),
    pilotStatePath: path.relative(root, pilotStatePath),
    approvals: approvalsBefore,
  };
}
