import { createHash } from 'node:crypto';
import { developmentPromptTemplateVersion } from '../profiles/profile.mjs';

export const promptVersion = 'la-arbolada-style-development-v4';
export const editPromptVersion = developmentPromptTemplateVersion;
export const postAnalysisPromptVersion = 'la-arbolada-style-validation-v1';

export const responseAdjustmentNames = [
  'exposure',
  'whiteBalance',
  'contrast',
  'localContrast',
  'highlights',
  'shadows',
  'saturation',
  'vibrance',
  'greens',
  'sky',
  'wood',
  'whites',
  'sharpness',
  'noiseReduction',
];

export const adjustmentOperations = [
  'exposure',
  'white_balance',
  'contrast',
  'local_contrast',
  'micro_contrast',
  'dynamic_range',
  'highlight_recovery',
  'shadow_recovery',
  'natural_saturation',
  'natural_vibrance',
  'color_balance',
  'noise_reduction',
  'sharpening',
  'lens_correction',
  'perspective_correction',
  'chromatic_aberration_reduction',
  'texture_clarity',
  'natural_depth',
  'window_brightness_balance',
  'interior_brightness_balance',
  'vegetation_color',
  'sky_color',
  'sunlight_balance',
];

const observations = [
  'exposure',
  'whiteBalance',
  'contrast',
  'saturation',
  'greens',
  'sky',
  'wood',
  'whites',
  'highlights',
  'shadows',
  'noise',
  'sharpness',
];

const adjustmentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    apply: { type: 'boolean' },
    direction: { type: 'string', enum: ['increase', 'decrease', 'neutral'] },
    relativeStrength: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string' },
    styleRule: { type: 'string' },
  },
  required: ['apply', 'direction', 'relativeStrength', 'reason', 'styleRule'],
};

export const developmentAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    visualAnalysis: {
      type: 'object',
      additionalProperties: false,
      properties: {
        overallAssessment: { type: 'string' },
        currentStyleMatchScore: { type: 'number', minimum: 0, maximum: 100 },
        projectedStyleMatchScore: { type: 'number', minimum: 0, maximum: 100 },
        naturalnessScore: { type: 'number', minimum: 0, maximum: 100 },
        colorConsistencyScore: { type: 'number', minimum: 0, maximum: 100 },
        luxuryEditorialScore: { type: 'number', minimum: 0, maximum: 100 },
        observations: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(observations.map((name) => [name, { type: 'string' }])),
          required: observations,
        },
        preservationNotes: { type: 'array', items: { type: 'string' }, maxItems: 12 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: [
        'overallAssessment',
        'currentStyleMatchScore',
        'projectedStyleMatchScore',
        'naturalnessScore',
        'colorConsistencyScore',
        'luxuryEditorialScore',
        'observations',
        'preservationNotes',
        'confidence',
      ],
    },
    developmentPlan: {
      type: 'object',
      additionalProperties: false,
      properties: {
        adjustments: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(
            responseAdjustmentNames.map((name) => [name, adjustmentSchema]),
          ),
          required: responseAdjustmentNames,
        },
        expectedResult: { type: 'string' },
        riskFlags: { type: 'array', items: { type: 'string' }, maxItems: 12 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['adjustments', 'expectedResult', 'riskFlags', 'confidence'],
    },
  },
  required: ['visualAnalysis', 'developmentPlan'],
};

export const styleValidationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    styleValidation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        profileMatchScore: { type: 'number', minimum: 0, maximum: 100 },
        naturalnessScore: { type: 'number', minimum: 0, maximum: 100 },
        colorConsistencyScore: { type: 'number', minimum: 0, maximum: 100 },
        overprocessed: { type: 'boolean' },
        underprocessed: { type: 'boolean' },
        semanticChangeSuspected: { type: 'boolean' },
        geometryChangeSuspected: { type: 'boolean' },
        violations: {
          type: 'array',
          maxItems: 16,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              ruleId: { type: 'string', minLength: 1 },
              description: { type: 'string', minLength: 1 },
              evidence: { type: 'string', minLength: 1 },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['ruleId', 'description', 'evidence', 'confidence'],
          },
        },
        reviewNotes: { type: 'array', items: { type: 'string' }, maxItems: 16 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: [
        'profileMatchScore',
        'naturalnessScore',
        'colorConsistencyScore',
        'overprocessed',
        'underprocessed',
        'semanticChangeSuspected',
        'geometryChangeSuspected',
        'violations',
        'reviewNotes',
        'confidence',
      ],
    },
  },
  required: ['styleValidation'],
};

const categoryInstructions = {
  'living room':
    'Preserve warm natural light, wood tones, textile fidelity, fireplace detail, and balanced existing windows.',
  kitchen:
    'Favor neutral-to-warm whites, realistic cabinetry and steel, countertop texture, and no blue cast.',
  bedroom: 'Favor soft neutral textiles and warm natural light without a yellow cast.',
  bathroom: 'Favor clean whites, realistic chrome reflections, and restrained contrast.',
  exterior:
    'Favor natural greens, a soft existing sky, realistic façade materials, and preserved sunlight.',
  park: 'Favor natural vegetation separation, restrained green saturation, and realistic depth without artificial lawn coloring.',
  creek: 'Favor natural water reflections and subtle vegetation color without colorizing water.',
  detail: 'Protect the featured material and exact texture; use conservative detail development.',
};

function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function promptCategoryFor(record) {
  if (['exterior', 'park', 'creek', 'detail'].includes(record.classification))
    return record.classification;
  const description = normalized(
    [record.id, record.space, record.originalName, record.classification].join(' '),
  );
  if (description.includes('living')) return 'living room';
  if (description.includes('cocina') || description.includes('kitchen')) return 'kitchen';
  if (description.includes('dorm') || description.includes('bedroom')) return 'bedroom';
  if (description.includes('banio') || description.includes('bano') || description.includes('bath'))
    return 'bathroom';
  return 'detail';
}

function promptResult(category, prompt, version) {
  return {
    category,
    prompt,
    promptVersion: version,
    promptSha256: createHash('sha256').update(prompt).digest('hex'),
  };
}

export function buildAnalysisPrompt(record, style) {
  const category = promptCategoryFor(record);
  const prompt = `You are a professional RAW-development analyst, not an image generator. Return JSON only. Analyze how the supplied photograph can be developed toward the immutable Casa La Arbolada style profile below. Do not return image pixels and do not prescribe absolute pixel/operator values.

The exact photograph is immutable. Architecture, objects, furniture, materials, windows, reflections, vegetation, sky, clouds, sunlight direction, shadows, composition, dimensions, camera angle, perspective, and pixel coordinates must remain identical. Your plan may contain only adaptive photometric development of existing pixels. Never propose content insertion/removal, replacement, generation, inpainting, outpainting, cropping, warping, geometry changes, or invented detail.

For every adjustment, use relativeStrength 0..1. If no change is needed, use apply=false, direction=neutral, relativeStrength=0. styleRule must be an exact JSON path in the profile, such as $.global.exposure or $.colors.greens.target. Reasons and observations must describe visible existing conditions only; never phrase them as commands or use edit verbs such as remove, add, replace, reconstruct, crop, or change. Category guidance adds emphasis and can never override the global profile.

CATEGORY: ${category}
CATEGORY EMPHASIS: ${categoryInstructions[category]}

STYLE PROFILE IDENTITY: ${style.profileId}@${style.version}
STYLE PROFILE SHA-256: ${style.sha256}
STYLE PROFILE JSON:
${style.normalized}

Return exactly two sections: visualAnalysis and developmentPlan. The separate image-editing pass receives only these relative recommendations plus the immutable preservation rules. Safety checks always override advisory aesthetic scores.`;
  return promptResult(category, prompt, promptVersion);
}

export function buildEditPrompt(
  record,
  style,
  _analysisDevelopmentPlan,
  structuredDevelopmentPlan,
  visualAnalysis,
) {
  if (!structuredDevelopmentPlan?.profileId || !structuredDevelopmentPlan?.sha256) {
    throw new Error('Image-edit prompt requires a structured photographic development plan.');
  }
  const category = promptCategoryFor(record);
  const adjustmentLines = Object.entries(structuredDevelopmentPlan.adjustments)
    .filter(([, adjustment]) => adjustment.apply !== false)
    .map(
      ([name, adjustment]) =>
        `- ${name}: ${adjustment.intensity} / ${adjustment.direction}. ${adjustment.instruction}`,
    )
    .join('\n');
  const analysisText = normalized(
    [
      visualAnalysis?.overallAssessment,
      ...Object.values(visualAnalysis?.observations ?? {}),
      ...(visualAnalysis?.preservationNotes ?? []),
    ].join(' '),
  );
  const hasVisibleMaterial = (expressions) => {
    const alternatives = expressions.join('|');
    const mention = new RegExp(`\\b(?:${alternatives})\\b`);
    const absent = new RegExp(
      `\\b(?:(?:no|without|free of) (?:visible )?(?:${alternatives})|(?:${alternatives})(?: is| are)? (?:absent|not present|not visible))\\b`,
    );
    return mention.test(analysisText) && !absent.test(analysisText);
  };
  const features = structuredDevelopmentPlan.detectedFeatures ?? {};
  const visibleMaterials = [
    {
      id: 'stone',
      visible: features.stone,
      instruction:
        'Reveal the existing mineral grain and tonal variation. Add clean local contrast without crunchy edges, halos, or invented surface detail.',
    },
    {
      id: 'stucco',
      visible: hasVisibleMaterial(['stucco', 'render', 'plaster']),
      instruction:
        'Refine the existing stucco or render with even white balance, controlled highlights, and moderate natural texture. Preserve every stain, joint, edge, and surface transition.',
    },
    {
      id: 'concrete',
      visible: hasVisibleMaterial(['concrete']),
      instruction:
        'Neutralize unwanted color casts in the existing concrete. Reveal restrained texture and preserve its real density, wear, and tonal variation.',
    },
    {
      id: 'wood',
      visible: features.wood,
      instruction:
        'Warm and deepen the existing wood naturally. Reveal grain and tonal richness without pushing it orange, red, glossy, or newly refinished.',
    },
    {
      id: 'marble',
      visible: features.marble,
      instruction:
        'Deepen the existing marble color and reveal real veining with controlled highlights. Preserve its exact pattern, reflectance, edges, and material identity.',
    },
    {
      id: 'metal',
      visible: features.metal,
      instruction:
        'Neutralize color contamination in the existing metal. Refine highlights and microcontrast while preserving every real reflection and avoiding brittle sharpness.',
    },
    {
      id: 'grass',
      visible: features.grass,
      instruction:
        'Deepen dull existing grass toward a rich natural green. Preserve blade patterns, density, dry areas, hue variation, and luminance variation; never make it fluorescent or uniform.',
    },
    {
      id: 'trees and vegetation',
      profileKeys: ['trees and vegetation', 'vegetation'],
      visible: features.vegetation,
      instruction:
        'Separate the existing foliage with natural green balance, restrained saturation, open shadows, and realistic depth. Preserve every plant shape, branch, leaf mass, and density.',
    },
    {
      id: 'sky',
      visible: features.sky,
      instruction:
        'Recover the existing sky highlights and deepen only its existing blue. Reveal real cloud detail without changing clouds, weather, atmosphere, or time of day.',
    },
    {
      id: 'glass',
      visible: hasVisibleMaterial(['glass', 'glazing']),
      instruction:
        'Refine the existing glass through highlight recovery and clean tonal separation. Preserve every reflection, transparency, view, frame, and edge exactly.',
    },
    {
      id: 'water',
      visible: features.water,
      instruction:
        'Refine the existing water color, highlights, and tonal separation. Preserve every reflection, ripple, boundary, transparency, and depth cue exactly.',
    },
    {
      id: 'ceramics',
      visible: hasVisibleMaterial(['ceramic', 'ceramics', 'porcelain', 'sink', 'sinks']),
      instruction:
        'Clean the white balance of the existing ceramics and recover glossy highlights. Keep whites bright but unclipped and preserve every edge, reflection, and fixture detail.',
    },
    {
      id: 'fabric',
      profileKeys: ['fabric', 'textiles'],
      visible: features.textiles,
      instruction:
        'Refine the existing fabric with soft tonal separation and restrained texture. Preserve weave, folds, color, wear, and every physical contour.',
    },
  ];
  const profileMaterialInstructions = new Map(
    structuredDevelopmentPlan.materialActions.map((item) => [normalized(item.material), item]),
  );
  const materialLines = visibleMaterials
    .filter((material) => material.visible)
    .map((material) => {
      const profileInstruction = (material.profileKeys ?? [material.id])
        .map((key) => profileMaterialInstructions.get(normalized(key)))
        .find(Boolean);
      return `- ${material.id}: ${profileInstruction?.instruction ?? material.instruction}`;
    })
    .join('\n');
const specialActions = structuredDevelopmentPlan.specialActions.length
    ? `\nOPTICAL DEVELOPMENT — APPLY ONLY BECAUSE THE ARTIFACT WAS DETECTED
${structuredDevelopmentPlan.specialActions.map((instruction) => `- ${instruction}`).join('\n')}
- Treat this only as correction of an optical capture artifact. Preserve every physical object, fixture, material, light source, reflection, and architectural detail. Reconstruct only obscured detail already established by adjacent pixels.`
    : '';
  const profileGuardrailLines = [...new Set(structuredDevelopmentPlan.prohibitions ?? [])]
    .map((prohibition) => `- ${prohibition}`)
    .join('\n');
  const prompt = `EXACT-PHOTOGRAPH RETOUCHING — ONE FINAL RASTER

ROLE
You are a senior Lightroom and Photoshop retoucher for luxury hotels, architecture, and hospitality. This supplied image is an existing real photograph. Perform photographic development only on its existing pixels.

EDITING OBJECTIVE
Execute the requested corrections visibly and decisively, like a careful professional retouch. Do not generate, redesign, restage, beautify, or reinterpret the scene. Preserve every structural and semantic element exactly; return one edited version of this same photograph.

OUTPUT CANVAS
Keep the exact supplied image canvas and aspect ratio. Do not crop, extend, pad, resize, rotate, mirror, reframe, or otherwise alter the pixel-coordinate layout.

REQUIRED DEVELOPMENT ACTIONS
Apply the following photographic development to the supplied photograph. Treat every intensity and direction as an imperative retoucher instruction, not as a literal slider value. Adapt the exact strength to the existing pixels, but make the requested result clearly visible rather than timid.

${adjustmentLines}

MATERIAL-SPECIFIC DEVELOPMENT
Develop only materials confirmed by the existing image analysis. Do not introduce a material-specific instruction for anything that is not visible.
${materialLines || '- Apply no separate material treatment beyond the tonal and color development above.'}${specialActions}

IMAGE-SPECIFIC CALIBRATION
The structured actions above already incorporate the image analysis. Use that analysis only to place the requested corrections, protect areas already correct, and avoid compounding existing excess; never use it as permission to alter content.

NATURAL PHOTOGRAPHIC FINISH
Build luminosity with exposure and shadow recovery; protect highlights; establish professional white balance; reveal real material texture; and develop rich, natural color. Maintain natural tonal separation and realistic material response. Avoid HDR rendering, halos, clipped channels, crushed blacks, excessive microcontrast, excessive saturation, plastic smoothing, and synthetic sharpness.

PROFILE-SPECIFIC GUARDRAILS
${profileGuardrailLines || '- Keep the finish natural, restrained, and faithful to the supplied pixels.'}

PROFILE AUDIT
Profile: ${structuredDevelopmentPlan.profileId}@${structuredDevelopmentPlan.profileVersion}
Profile SHA-256: ${structuredDevelopmentPlan.profileSha256}
Selection reason: ${structuredDevelopmentPlan.selectionReason}
Source analysis label: ${structuredDevelopmentPlan.sourceAnalysisLabel}
Prompt template: ${developmentPromptTemplateVersion}

ABSOLUTE SCENE PRESERVATION
Preserve the exact scene, architecture, room layout, object count, furniture placement, and fixture placement. Preserve all openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon exactly as supplied. Preserve every person, face, item of clothing, physical object, material, reflection, cloud, plant shape, shadow direction, light direction, and existing texture.

Do not add, remove, replace, relocate, redesign, restage, or beautify physical objects. Do not change camera position, perspective, framing, lens, focal length, crop, proportions, or composition. Do not create fake sunlight, fake lamps, fake landscaping, fake shadows, fake reflections, fake rays, artificial HDR, or imaginary details. Do not add text, people, vehicles, furniture, plants, decorations, or building elements. Do not perform scene or object inpainting, outpainting, warping, reframing, sky replacement, or weather replacement.

If any photographic-development operation risks a semantic or geometric change, do not apply that adjustment. Preserve the existing photograph instead.

STYLE IDENTITY
Casa La Arbolada style: ${style.profileId}@${style.version}
Style SHA-256: ${style.sha256}
Category: ${category}

DELIVERY
Complete one decisive, natural professional photographic development of this exact existing photograph. Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.`;
  return {
    ...promptResult(category, prompt, editPromptVersion),
    promptTemplateVersion: developmentPromptTemplateVersion,
    developmentProfile: {
      id: structuredDevelopmentPlan.profileId,
      version: structuredDevelopmentPlan.profileVersion,
      sha256: structuredDevelopmentPlan.profileSha256,
      selectionReason: structuredDevelopmentPlan.selectionReason,
      sourceAnalysisLabel: structuredDevelopmentPlan.sourceAnalysisLabel,
    },
    structuredDevelopmentPlan,
    structuredDevelopmentPlanSha256: structuredDevelopmentPlan.sha256,
    imageSpecificAdaptations: structuredDevelopmentPlan.imageSpecificAdaptations,
  };
}

export function buildPostAnalysisPrompt(record, style) {
  const category = promptCategoryFor(record);
  const prompt = `Act only as a validation auditor. Compare image 1 (original) with image 2 (provider-edited development candidate) against the fixed Casa La Arbolada style profile. Return JSON only and do not propose, request, or describe any new edit.

Detect overprocessing, forbidden aesthetics, semantic differences, geometry/perspective/crop changes, or any change to architecture, objects, materials, vegetation, sky content, reflections, shadows, or composition. Scores are advisory; safety findings are decisive. List violated rules using exact profile JSON paths or exact aesthetic restriction text.

Every violation must be a structured observable defect with ruleId, description, specific visible evidence comparing the two supplied images, and confidence from 0 to 1. Do not emit an unsupported label. If no visible evidence exists, return no violation. This is validation only: do not propose a new edit.

CATEGORY: ${category}
STYLE PROFILE IDENTITY: ${style.profileId}@${style.version}
STYLE PROFILE SHA-256: ${style.sha256}
STYLE PROFILE JSON:
${style.normalized}`;
  return promptResult(category, prompt, postAnalysisPromptVersion);
}

const internalMap = {
  exposure: ['exposure'],
  whiteBalance: ['white_balance'],
  contrast: ['contrast', 'dynamic_range', 'natural_depth'],
  localContrast: ['local_contrast', 'micro_contrast', 'texture_clarity'],
  highlights: ['highlight_recovery', 'window_brightness_balance', 'sunlight_balance'],
  shadows: ['shadow_recovery', 'interior_brightness_balance'],
  saturation: ['natural_saturation'],
  vibrance: ['natural_vibrance'],
  greens: ['vegetation_color'],
  sky: ['sky_color'],
  wood: [],
  whites: [],
  sharpness: ['sharpening'],
  noiseReduction: ['noise_reduction'],
};

export function toDeterministicPlan(response) {
  const mapped = [];
  for (const [name, adjustment] of Object.entries(response.developmentPlan.adjustments)) {
    for (const operation of internalMap[name] ?? []) {
      mapped.push({
        operation,
        apply: adjustment.apply,
        intensity: adjustment.relativeStrength,
        direction: adjustment.direction,
        reason: adjustment.reason,
        styleRule: adjustment.styleRule,
      });
    }
  }
  const colorInputs = ['whiteBalance', 'wood', 'whites'].map(
    (name) => response.developmentPlan.adjustments[name],
  );
  const strongestColorInput = colorInputs.reduce((strongest, item) =>
    item.relativeStrength > strongest.relativeStrength ? item : strongest,
  );
  mapped.push({
    operation: 'color_balance',
    apply: colorInputs.some((item) => item.apply),
    intensity: Math.max(...colorInputs.map((item) => item.relativeStrength)),
    direction: strongestColorInput.direction,
    reason: colorInputs
      .filter((item) => item.apply)
      .map((item) => item.reason)
      .join(' '),
    styleRule: strongestColorInput.styleRule,
  });
  for (const operation of [
    'lens_correction',
    'perspective_correction',
    'chromatic_aberration_reduction',
  ]) {
    mapped.push({
      operation,
      apply: false,
      intensity: 0,
      direction: 'neutral',
      reason: 'Geometry operators are prohibited by the identity-coordinate safety policy.',
      styleRule: '$.intent.realism',
    });
  }
  const present = new Set(mapped.map((item) => item.operation));
  for (const operation of adjustmentOperations) {
    if (!present.has(operation))
      mapped.push({
        operation,
        apply: false,
        intensity: 0,
        direction: 'neutral',
        reason: 'No independent safe deterministic operator is required.',
        styleRule: '$.intent.realism',
      });
  }
  return {
    adjustments: adjustmentOperations.map((operation) =>
      mapped.find((item) => item.operation === operation),
    ),
  };
}
