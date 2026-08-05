import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalize } from './style/profile.mjs';

const pilotStatuses = new Set(['approved', 'rejected', 'needs-review', 'pending']);

async function atomicWriteJson(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporaryPath, filePath);
}

function processingIdentityForResult(result, style) {
  const cacheIdentity = result?.cacheIdentity;
  return {
    sourceSha256: result?.sourceSha256 ?? cacheIdentity?.components?.sourceSha256 ?? null,
    styleProfileSha256:
      result?.styleProfile?.sha256 ?? cacheIdentity?.components?.styleProfileSha256 ?? style.sha256,
    cacheIdentitySha256: cacheIdentity?.sha256 ?? null,
    developerVersion: cacheIdentity?.components?.developerVersion ?? null,
    providerModel: cacheIdentity?.components?.providerModel ?? result?.provider?.model ?? null,
    promptVersion: cacheIdentity?.components?.promptVersion ?? result?.promptVersion ?? null,
    returnedRasterDimensions: cacheIdentity?.components?.returnedRasterDimensions ?? null,
    normalizationAlgorithm: cacheIdentity?.components?.normalizationAlgorithm ?? null,
    normalizationVersion: cacheIdentity?.components?.normalizationVersion ?? null,
    developmentProfileId: cacheIdentity?.components?.developmentProfileId ?? null,
    developmentProfileVersion: cacheIdentity?.components?.developmentProfileVersion ?? null,
    developmentProfileSha256: cacheIdentity?.components?.developmentProfileSha256 ?? null,
    promptTemplateVersion: cacheIdentity?.components?.promptTemplateVersion ?? null,
    structuredDevelopmentPlanSha256:
      cacheIdentity?.components?.structuredDevelopmentPlanSha256 ?? null,
    postAnalysisPromptVersion: result?.postAnalysisPromptVersion ?? null,
  };
}

function isValidExistingState(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function readExistingState(statePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, 'utf8'));
    return isValidExistingState(parsed) ? parsed : null;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

export function validatePilotComposition(workflow) {
  const locked = new Set(workflow.config.lockedImages.map((item) => item.id));
  const records = workflow.config.pilotIds.map((id) =>
    workflow.records.find((record) => record.id === id),
  );
  if (records.some((record) => !record))
    throw new Error('Pilot selection contains an unknown catalog ID.');
  if (records.length !== 5)
    throw new Error('Pilot must contain exactly five representative photographs.');
  if (records.some((record) => record.locked || locked.has(record.id)))
    throw new Error('Pilot selection contains a LOCKED photograph.');
  if (!records.some((record) => record.classification === 'exterior'))
    throw new Error('Pilot requires at least one exterior photograph with sky coverage.');
  if (!records.some((record) => ['park', 'creek', 'exterior'].includes(record.classification)))
    throw new Error('Pilot requires vegetation coverage.');
  if (!records.some((record) => record.classification?.startsWith('interior')))
    throw new Error('Pilot requires one non-locked interior photograph.');
  for (const [coverage, ids] of Object.entries(workflow.config.pilotCoverage ?? {})) {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.some((id) => !workflow.config.pilotIds.includes(id))
    ) {
      throw new Error(`Pilot ${coverage} coverage must reference at least one selected pilot ID.`);
    }
  }
  if (workflow.config.pilotCoverage && !workflow.config.pilotCoverage.sky?.length) {
    throw new Error('Pilot requires explicit sky coverage.');
  }
  return records;
}

export function createPilotReviewState({ results, style, existing = null }) {
  const timestamp = new Date().toISOString();
  const previousState = isValidExistingState(existing) ? existing : null;
  const styleMatches = previousState?.styleProfile?.sha256 === style.sha256;
  return {
    schemaVersion: 2,
    updatedAt: timestamp,
    styleProfile: { profileId: style.profileId, version: style.version, sha256: style.sha256 },
    decisions: Object.fromEntries(
      results.map((result) => {
        const prior = styleMatches ? previousState?.decisions?.[result.catalogId] : null;
        const processingIdentity = processingIdentityForResult(result, style);
        const identityMatches =
          prior?.processingIdentity != null &&
          canonicalize(prior.processingIdentity) === canonicalize(processingIdentity);
        const resultMatches =
          Boolean(result.masterSha256) && prior?.resultSha256 === result.masterSha256;
        const preservePrior = Boolean(styleMatches && identityMatches && resultMatches);
        return [
          result.catalogId,
          {
            status: preservePrior && pilotStatuses.has(prior?.status) ? prior.status : 'pending',
            resultSha256: result.masterSha256 ?? null,
            processingIdentity,
            updatedAt: preservePrior ? (prior?.updatedAt ?? null) : null,
          },
        ];
      }),
    ),
  };
}

export async function syncPilotReviewState({ statePath, results, style }) {
  const existing = await readExistingState(statePath);
  const state = createPilotReviewState({ results, style, existing });
  await atomicWriteJson(statePath, state);
  return state;
}

export async function updatePilotReviewState({ statePath, decisions }) {
  const state = await readExistingState(statePath);
  if (!state?.decisions || !state?.styleProfile?.sha256) {
    throw new Error('Pilot review state is missing or malformed; rerun the pilot synchronization.');
  }
  const timestamp = new Date().toISOString();
  for (const [id, status] of Object.entries(decisions ?? {})) {
    if (!state.decisions[id] || !pilotStatuses.has(status)) continue;
    state.decisions[id] = { ...state.decisions[id], status, updatedAt: timestamp };
  }
  state.updatedAt = timestamp;
  await atomicWriteJson(statePath, state);
  return state;
}

export function evaluateFullRunGate({ workflow, metrics, pilotState, style }) {
  const reasons = [];
  if (!metrics || metrics.runMode !== 'pilot')
    reasons.push('A completed pilot metrics report is required.');
  if (metrics?.styleProfile?.sha256 !== style.sha256)
    reasons.push('Pilot metrics were produced with a different style profile.');
  if (pilotState?.styleProfile?.sha256 !== style.sha256)
    reasons.push('Pilot approvals were recorded for a different style profile.');
  for (const id of workflow.config.pilotIds) {
    const result = metrics?.results?.find((item) => item.catalogId === id);
    const decision = pilotState?.decisions?.[id];
    if (!result || ['ERROR', 'REJECTED'].includes(result.status))
      reasons.push(`${id} has no acceptable pilot result.`);
    if (
      decision?.status !== 'approved' ||
      !result?.masterSha256 ||
      decision.resultSha256 !== result.masterSha256
    )
      reasons.push(`${id} is not explicitly approved for its current pilot result.`);
  }
  return { allowed: reasons.length === 0, reasons };
}
