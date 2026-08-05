import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalize } from '../style/profile.mjs';

export const developmentProfileDirectory = 'photo-processing/profiles';
export const developmentPromptTemplateVersion = 'la-arbolada-photographic-development-v4';

const profileFiles = [
  'facade.json',
  'patio.json',
  'bathroom.json',
  'kitchen.json',
  'living-room.json',
  'bedroom.json',
  'garden.json',
  'pool.json',
  'default.json',
];

const requiredAdjustments = [
  'exposure',
  'shadows',
  'highlights',
  'contrast',
  'whiteBalance',
  'vibrance',
  'saturation',
  'texture',
  'clarity',
  'sharpness',
];

const aliases = [
  ['bathroom', ['bathroom', 'restroom', 'washroom', 'bano', 'banio', 'toilet']],
  ['kitchen', ['kitchen', 'cocina']],
  ['living-room', ['living room', 'living', 'lounge', 'sitting room', 'salon']],
  ['bedroom', ['bedroom', 'dormitorio', 'dorm', 'habitacion']],
  ['pool', ['swimming pool', 'pool', 'pileta', 'piscina']],
  ['patio', ['patio', 'terrace', 'deck', 'veranda', 'terraza', 'galeria']],
  ['facade', ['facade', 'fachada', 'frontage', 'exterior']],
  ['garden', ['garden', 'yard', 'landscape', 'park', 'parque', 'creek', 'arroyo']],
];

function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sha256(value) {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function validateProfile(profile, filename) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile))
    throw new Error(`Development profile ${filename} is malformed.`);
  if (!profile.id || !Number.isInteger(profile.version) || profile.version < 1)
    throw new Error(`Development profile ${filename} requires id and positive version.`);
  if (!profile.description || !profile.adjustments)
    throw new Error(`Development profile ${filename} requires description and adjustments.`);
  for (const name of requiredAdjustments) {
    const adjustment = profile.adjustments[name];
    if (!adjustment?.intensity || !adjustment?.direction || !adjustment?.instruction)
      throw new Error(`Development profile ${filename} has invalid ${name}.`);
  }
  for (const collection of ['materialPriorities', 'specialInstructions']) {
    if (!Array.isArray(profile[collection]))
      throw new Error(`Development profile ${filename} requires ${collection}.`);
    for (const item of profile[collection]) {
      if (!item?.when || !item?.instruction)
        throw new Error(`Development profile ${filename} has invalid ${collection} entry.`);
    }
  }
  if (!Array.isArray(profile.prohibitions) || profile.prohibitions.some((item) => !item))
    throw new Error(`Development profile ${filename} requires prohibitions.`);
  return Object.freeze({ ...profile, sha256: sha256(profile), relativePath: filename });
}

export async function loadDevelopmentProfiles({ root }) {
  const profiles = await Promise.all(
    profileFiles.map(async (filename) => {
      const absolutePath = path.join(root, developmentProfileDirectory, filename);
      let parsed;
      try {
        parsed = JSON.parse(await fs.readFile(absolutePath, 'utf8'));
      } catch (error) {
        throw new Error(
          `Development profile ${filename} is missing or malformed: ${error.message}`,
        );
      }
      return validateProfile(parsed, path.join(developmentProfileDirectory, filename));
    }),
  );
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  if (byId.size !== profileFiles.length || !byId.has('default'))
    throw new Error('Development profile IDs must be unique and include default.');
  return Object.freeze({ profiles, byId });
}

function sourceCandidates(record, sourceAnalysisLabel) {
  return [
    ['catalog ID', record?.id],
    ['space label', record?.space],
    ['original filename', record?.originalName],
    ['analysis label', sourceAnalysisLabel],
    ['classification', record?.classification],
  ].map(([source, value]) => ({ source, value: normalized(value) }));
}

export function sourceLabelFromVisualAnalysis(visualAnalysis, fallbackLabel) {
  const explicitLabel =
    visualAnalysis?.sceneCategory ??
    visualAnalysis?.category ??
    visualAnalysis?.classification ??
    null;
  if (normalized(explicitLabel)) return String(explicitLabel);

  const assessment = normalized(visualAnalysis?.overallAssessment);
  const matches = aliases
    .map(([profileId, profileAliases]) => ({
      profileId,
      alias: profileAliases.find((value) => assessment.includes(value)) ?? null,
    }))
    .filter((match) => match.alias);
  const matchedProfiles = new Set(matches.map((match) => match.profileId));
  if (matchedProfiles.size === 1) return matches[0].alias;
  return fallbackLabel ?? null;
}

export function selectDevelopmentProfile({ profiles, record, sourceAnalysisLabel }) {
  if (record?.locked)
    throw new Error(`LOCKED image ${record.id} cannot select a development profile.`);
  const candidates = sourceCandidates(record, sourceAnalysisLabel);
  for (const [profileId, profileAliases] of aliases) {
    for (const candidate of candidates) {
      const alias = profileAliases.find((value) => candidate.value.includes(value));
      if (alias) {
        return {
          profile: profiles.byId.get(profileId),
          profileId,
          profileVersion: profiles.byId.get(profileId).version,
          sourceAnalysisLabel: sourceAnalysisLabel ?? null,
          selectionReason: `Matched alias "${alias}" in ${candidate.source}: "${candidate.value}".`,
        };
      }
    }
  }
  const profile = profiles.byId.get('default');
  return {
    profile,
    profileId: profile.id,
    profileVersion: profile.version,
    sourceAnalysisLabel: sourceAnalysisLabel ?? null,
    selectionReason: 'No deterministic category alias matched; selected conservative default.',
  };
}

function analysisText(visualAnalysis) {
  return normalized(
    [
      visualAnalysis?.overallAssessment,
      ...Object.values(visualAnalysis?.observations ?? {}),
      ...(visualAnalysis?.preservationNotes ?? []),
    ].join(' '),
  );
}

function hasPositiveMention(text, pattern, negativePattern) {
  if (!pattern.test(text)) return false;
  return !negativePattern?.test(text);
}

export function detectDevelopmentFeatures(visualAnalysis) {
  const text = analysisText(visualAnalysis);
  const feature = (pattern, negative) => hasPositiveMention(text, pattern, negative);
  return {
    lensFlare: feature(
      /\b(lens flare|lens glare|circular flare|veiling glare|optical flare|starburst glare)\b/,
      /\b(no|without|free of) (?:visible )?(?:lens flare|lens glare|circular flare|veiling glare|optical flare|starburst glare)\b/,
    ),
    grass: feature(/\b(grass|lawn|turf)\b/, /\b(no|without) (?:visible )?(?:grass|lawn|turf)\b/),
    sky: feature(/\b(sky|cloud|clouds)\b/, /\b(no|without) (?:visible )?(?:sky|clouds?)\b/),
    marble: feature(/\bmarble\b/, /\b(no|without) (?:visible )?marble\b/),
    wood: feature(/\b(wood|timber|cabinetry)\b/, /\b(no|without) (?:visible )?(?:wood|timber)\b/),
    stone: feature(/\b(stone|masonry|gravel|stucco)\b/, /\b(no|without) (?:visible )?stone\b/),
    metal: feature(
      /\b(chrome|metal|metallic|stainless steel)\b/,
      /\b(no|without) (?:visible )?(?:chrome|metal|stainless steel)\b/,
    ),
    textiles: feature(
      /\b(textile|textiles|bedding|fabric|upholstery)\b/,
      /\b(no|without) (?:visible )?(?:textiles?|bedding|fabric)\b/,
    ),
    water: feature(/\b(water|pool)\b/, /\b(no|without) (?:visible )?water\b/),
    vegetation: feature(
      /\b(vegetation|foliage|plants?|trees?|garden)\b/,
      /\b(no|without) (?:visible )?(?:vegetation|foliage|plants?)\b/,
    ),
    alreadyOversaturated:
      /\b(over[ -]?saturat|excessive saturation|already (?:highly )?saturated|too saturated)\b/.test(
        text,
      ),
    excessiveMicrocontrast:
      /\b(excessive microcontrast|overly sharp|artificial clarity|crunchy|harsh detail)\b/.test(
        text,
      ),
    alreadyBright:
      /\b(already bright|bright overall|well[ -]?exposed|high[ -]?key|exposure is already correct)\b/.test(
        text,
      ),
  };
}

function cloneAdjustments(profile) {
  return Object.fromEntries(
    Object.entries(profile.adjustments).map(([name, value]) => [name, { ...value, apply: true }]),
  );
}

export function buildStructuredDevelopmentPlan({ selection, visualAnalysis }) {
  const profile = selection.profile;
  const features = detectDevelopmentFeatures(visualAnalysis);
  const adjustments = cloneAdjustments(profile);
  const adaptations = [];

  if (features.alreadyOversaturated) {
    adjustments.saturation = {
      apply: true,
      intensity: 'moderate',
      direction: 'decrease',
      instruction:
        'The analysis identifies existing oversaturation. Reduce it conservatively; do not apply the profile’s normal saturation increase.',
    };
    adjustments.vibrance = {
      ...adjustments.vibrance,
      intensity: 'light',
      direction: 'decrease',
      instruction:
        'Reduce excessive vibrance lightly and preserve realistic separation between existing colors.',
    };
    adaptations.push({
      id: 'protect-existing-saturation',
      reason: 'Analysis identifies existing oversaturation.',
      instruction: 'Replace saturation increases with conservative saturation reduction.',
    });
  }
  if (features.excessiveMicrocontrast) {
    for (const name of ['clarity', 'texture']) {
      adjustments[name] = {
        ...adjustments[name],
        intensity: 'strong',
        direction: 'decrease',
        instruction: `Reduce existing artificial ${name} strongly; do not add more microcontrast.`,
      };
    }
    adaptations.push({
      id: 'protect-existing-microcontrast',
      reason: 'Analysis identifies excessive microcontrast or artificial sharpness.',
      instruction: 'Reduce clarity and texture rather than increasing them.',
    });
  }
  if (features.alreadyBright && ['increase', 'lift'].includes(adjustments.exposure.direction)) {
    adjustments.exposure = {
      ...adjustments.exposure,
      intensity: 'none',
      direction: 'protect',
      instruction:
        'Exposure is already bright. Preserve it and protect highlights; do not increase global exposure.',
    };
    adaptations.push({
      id: 'protect-existing-brightness',
      reason: 'Analysis identifies an already-bright or correctly exposed image.',
      instruction: 'Suppress the profile’s normal exposure increase.',
    });
  }

  const materialActions = profile.materialPriorities
    .filter((item) => item.when === 'always' || features[item.when])
    .map((item) => ({ material: item.material, instruction: item.instruction }));
  const specialActions = profile.specialInstructions
    .filter((item) => item.when === 'always' || features[item.when])
    .map((item) => item.instruction);
  for (const item of materialActions) {
    adaptations.push({
      id: `detected-${normalized(item.material).replaceAll(' ', '-')}`,
      reason: `${item.material} is identified in the existing analysis.`,
      instruction: item.instruction,
    });
  }
  if (features.lensFlare) {
    adaptations.push({
      id: 'detected-optical-flare',
      reason: 'Existing analysis identifies optical lens flare or veiling glare.',
      instruction: specialActions.find((item) => /flare|glare/i.test(item)) ?? '',
    });
  }

  const plan = {
    profileId: profile.id,
    profileVersion: profile.version,
    profileSha256: profile.sha256,
    sourceAnalysisLabel: selection.sourceAnalysisLabel,
    selectionReason: selection.selectionReason,
    description: profile.description,
    adjustments,
    materialActions,
    specialActions,
    imageSpecificAdaptations: adaptations,
    detectedFeatures: features,
    protectedElements: [
      'exact scene and architecture',
      'room layout and object count',
      'furniture and fixture placement',
      'openings, walls, roofs, floors, windows and doors',
      'vegetation, paths, pool boundaries and horizon',
      'camera position, perspective, framing, lens and composition',
    ],
    prohibitions: profile.prohibitions,
    valuesAreNaturalLanguageDirections: true,
  };
  return { ...plan, sha256: sha256(plan) };
}
