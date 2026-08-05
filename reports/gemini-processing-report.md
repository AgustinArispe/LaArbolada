# Casa La Arbolada architectural photo-development report

Generated: 2026-07-26T16:09:29.054Z

- Provider: **gemini** (gemini-3-pro-image)
- Run mode: **validation-only**
- Style: **casa-la-arbolada@1.0.0**
- Style SHA-256: `52466a31d0b61f4b8c0dd29b5129efc0ade6e04c296589a9b6a33eeda2e0b4ce`
- Post-development analysis: **enabled**
- Minimum naturalness / profile match: **80 / 75**
- Definitive defect confidence: **0.85**
- Violation evidence required: **yes**
- Contradiction policy: **manual-review**


Gemini provides schema-validated analysis, one source-to-image editing pass, and a separate post-development validation pass. The exact returned raster is preserved in cache. Geometry is validated before deterministic Lanczos3 normalization to the canonical source dimensions; structural and quality metrics use only the normalized raster. Nothing is published automatically.

## Locked images

| Catalog ID | Original | Enforcement |
| --- | --- | --- |
| `casa-livingcasa` | `livingCASA.HEIC` | SHA-256 protected; excluded from analysis, upload, editing, comparison, cache, batches, derivatives, and replacement. |
| `casa-livingcasa3` | `livingCASA3.HEIC` | SHA-256 protected; excluded from analysis, upload, editing, comparison, cache, batches, derivatives, and replacement. |
| `casa-mesalivingcasa4` | `mesaLIVINGCASA4.HEIC` | SHA-256 protected; excluded from analysis, upload, editing, comparison, cache, batches, derivatives, and replacement. |

## Style and review results

| Catalog ID | Policy outcome | Raster geometry | Current | Projected | Raw profile | Raw naturalness | Color | Luxury | Raw confidence | Adjustments | Raw violations and evidence | Contradictions | Decision source | Final policy reasoning |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| `casa-5casa` | **REJECT** | 4032×3024 → 4800×3584 → —; no resampling | — | — | — | — | — | — | — | adaptive no-op | none | none | all gates passed | none |
| `casa-cocinacasa1` | **REJECT** | 4032×3024 → 4800×3584 → —; no resampling | — | — | — | — | — | — | — | adaptive no-op | none | none | all gates passed | none |
| `casa-fachada2` | **REJECT** | 4032×3024 → 4800×3584 → —; no resampling | — | — | — | — | — | — | — | adaptive no-op | none | none | all gates passed | none |
| `casa-patio11` | **REJECT** | 4032×3024 → 4800×3584 → —; no resampling | — | — | — | — | — | — | — | adaptive no-op | none | none | all gates passed | none |
| `casa-patio7` | **REJECT** | 4032×3024 → 4800×3584 → —; no resampling | — | — | — | — | — | — | — | adaptive no-op | none | none | all gates passed | none |

## Photographic development instructions

### casa-5casa — default@2

- Profile SHA-256: `0152140b40a75fb8b77c025309a7039af9960b875d2abd955fabd861b6c70681`
- Selection reason: No deterministic category alias matched; selected conservative default.
- Source analysis label: `detail`
- Prompt-template version: `la-arbolada-photographic-development-v4`
- Structured-plan SHA-256: `3cd0c1818dec9ff276b4220f84b204fd144bd58b61acd12134c2c746b5d818de`
- Image-specific adaptations: none

Structured development plan:

```json
{
  "profileId": "default",
  "profileVersion": 2,
  "profileSha256": "0152140b40a75fb8b77c025309a7039af9960b875d2abd955fabd861b6c70681",
  "sourceAnalysisLabel": "detail",
  "selectionReason": "No deterministic category alias matched; selected conservative default.",
  "description": "Safe but visibly effective professional development for an uncertain real-estate category.",
  "adjustments": {
    "exposure": {
      "intensity": "moderate",
      "direction": "balance",
      "instruction": "Set a visibly brighter, balanced exposure when the photograph needs it; preserve already-bright areas and do not wash out the scene.",
      "apply": true
    },
    "shadows": {
      "intensity": "moderate",
      "direction": "lift",
      "instruction": "Open blocked shadows decisively enough to reveal existing detail while retaining natural depth and black separation.",
      "apply": true
    },
    "highlights": {
      "intensity": "moderate",
      "direction": "recover",
      "instruction": "Recover bright-window, reflective, and pale-surface detail from the existing pixels without inventing information.",
      "apply": true
    },
    "contrast": {
      "intensity": "moderate",
      "direction": "balance",
      "instruction": "Establish clean midtone separation after tonal recovery; keep contrast photographic and never HDR-like.",
      "apply": true
    },
    "whiteBalance": {
      "intensity": "subtle",
      "direction": "neutral-warm",
      "instruction": "Neutralize unwanted casts, then keep a refined neutral-to-slightly-warm balance appropriate to the actual light.",
      "apply": true
    },
    "vibrance": {
      "intensity": "moderate",
      "direction": "increase",
      "instruction": "Enrich muted existing color selectively while preserving realistic material response and hue separation.",
      "apply": true
    },
    "saturation": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Use only the saturation needed for a clearly polished result; keep neutrals neutral and avoid clipped color.",
      "apply": true
    },
    "texture": {
      "intensity": "light-moderate",
      "direction": "increase",
      "instruction": "Reveal existing material texture and tonal variation without inventing detail or creating a gritty finish.",
      "apply": true
    },
    "clarity": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Add only clean local definition needed for readability; avoid halos, crunchiness, and artificial microcontrast.",
      "apply": true
    },
    "sharpness": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Apply restrained final sharpening only to existing edges; no halos or synthetic detail.",
      "apply": true
    }
  },
  "materialActions": [],
  "specialActions": [],
  "imageSpecificAdaptations": [],
  "detectedFeatures": {
    "lensFlare": false,
    "grass": false,
    "sky": true,
    "marble": false,
    "wood": true,
    "stone": true,
    "metal": false,
    "textiles": false,
    "water": false,
    "vegetation": true,
    "alreadyOversaturated": false,
    "excessiveMicrocontrast": false,
    "alreadyBright": false
  },
  "protectedElements": [
    "exact scene and architecture",
    "room layout and object count",
    "furniture and fixture placement",
    "openings, walls, roofs, floors, windows and doors",
    "vegetation, paths, pool boundaries and horizon",
    "camera position, perspective, framing, lens and composition"
  ],
  "prohibitions": [
    "no generative redesign",
    "no artificial HDR",
    "no invented detail",
    "no physical-object changes"
  ],
  "valuesAreNaturalLanguageDirections": true,
  "sha256": "3cd0c1818dec9ff276b4220f84b204fd144bd58b61acd12134c2c746b5d818de"
}
```

Exact final edit instruction sent to Gemini:

```text
EXACT-PHOTOGRAPH RETOUCHING — ONE FINAL RASTER

ROLE
You are a senior Lightroom and Photoshop retoucher for luxury hotels, architecture, and hospitality. This supplied image is an existing real photograph. Perform photographic development only on its existing pixels.

EDITING OBJECTIVE
Execute the requested corrections visibly and decisively, like a careful professional retouch. Do not generate, redesign, restage, beautify, or reinterpret the scene. Preserve every structural and semantic element exactly; return one edited version of this same photograph.

OUTPUT CANVAS
Keep the exact supplied image canvas and aspect ratio. Do not crop, extend, pad, resize, rotate, mirror, reframe, or otherwise alter the pixel-coordinate layout.

REQUIRED DEVELOPMENT ACTIONS
Apply the following photographic development to the supplied photograph. Treat every intensity and direction as an imperative retoucher instruction, not as a literal slider value. Adapt the exact strength to the existing pixels, but make the requested result clearly visible rather than timid.

- exposure: moderate / balance. Set a visibly brighter, balanced exposure when the photograph needs it; preserve already-bright areas and do not wash out the scene.
- shadows: moderate / lift. Open blocked shadows decisively enough to reveal existing detail while retaining natural depth and black separation.
- highlights: moderate / recover. Recover bright-window, reflective, and pale-surface detail from the existing pixels without inventing information.
- contrast: moderate / balance. Establish clean midtone separation after tonal recovery; keep contrast photographic and never HDR-like.
- whiteBalance: subtle / neutral-warm. Neutralize unwanted casts, then keep a refined neutral-to-slightly-warm balance appropriate to the actual light.
- vibrance: moderate / increase. Enrich muted existing color selectively while preserving realistic material response and hue separation.
- saturation: light / increase. Use only the saturation needed for a clearly polished result; keep neutrals neutral and avoid clipped color.
- texture: light-moderate / increase. Reveal existing material texture and tonal variation without inventing detail or creating a gritty finish.
- clarity: light / increase. Add only clean local definition needed for readability; avoid halos, crunchiness, and artificial microcontrast.
- sharpness: light / increase. Apply restrained final sharpening only to existing edges; no halos or synthetic detail.

MATERIAL-SPECIFIC DEVELOPMENT
Develop only materials confirmed by the existing image analysis. Do not introduce a material-specific instruction for anything that is not visible.
- stone: Reveal the existing mineral grain and tonal variation. Add clean local contrast without crunchy edges, halos, or invented surface detail.
- wood: Warm and deepen the existing wood naturally. Reveal grain and tonal richness without pushing it orange, red, glossy, or newly refinished.
- trees and vegetation: Separate the existing foliage with natural green balance, restrained saturation, open shadows, and realistic depth. Preserve every plant shape, branch, leaf mass, and density.
- sky: Recover the existing sky highlights and deepen only its existing blue. Reveal real cloud detail without changing clouds, weather, atmosphere, or time of day.

IMAGE-SPECIFIC CALIBRATION
The structured actions above already incorporate the image analysis. Use that analysis only to place the requested corrections, protect areas already correct, and avoid compounding existing excess; never use it as permission to alter content.

NATURAL PHOTOGRAPHIC FINISH
Build luminosity with exposure and shadow recovery; protect highlights; establish professional white balance; reveal real material texture; and develop rich, natural color. Maintain natural tonal separation and realistic material response. Avoid HDR rendering, halos, clipped channels, crushed blacks, excessive microcontrast, excessive saturation, plastic smoothing, and synthetic sharpness.

PROFILE-SPECIFIC GUARDRAILS
- no generative redesign
- no artificial HDR
- no invented detail
- no physical-object changes

PROFILE AUDIT
Profile: default@2
Profile SHA-256: 0152140b40a75fb8b77c025309a7039af9960b875d2abd955fabd861b6c70681
Selection reason: No deterministic category alias matched; selected conservative default.
Source analysis label: detail
Prompt template: la-arbolada-photographic-development-v4

ABSOLUTE SCENE PRESERVATION
Preserve the exact scene, architecture, room layout, object count, furniture placement, and fixture placement. Preserve all openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon exactly as supplied. Preserve every person, face, item of clothing, physical object, material, reflection, cloud, plant shape, shadow direction, light direction, and existing texture.

Do not add, remove, replace, relocate, redesign, restage, or beautify physical objects. Do not change camera position, perspective, framing, lens, focal length, crop, proportions, or composition. Do not create fake sunlight, fake lamps, fake landscaping, fake shadows, fake reflections, fake rays, artificial HDR, or imaginary details. Do not add text, people, vehicles, furniture, plants, decorations, or building elements. Do not perform scene or object inpainting, outpainting, warping, reframing, sky replacement, or weather replacement.

If any photographic-development operation risks a semantic or geometric change, do not apply that adjustment. Preserve the existing photograph instead.

STYLE IDENTITY
Casa La Arbolada style: casa-la-arbolada@1.0.0
Style SHA-256: 52466a31d0b61f4b8c0dd29b5129efc0ade6e04c296589a9b6a33eeda2e0b4ce
Category: detail

DELIVERY
Complete one decisive, natural professional photographic development of this exact existing photograph. Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.
```

### casa-cocinacasa1 — kitchen@3

- Profile SHA-256: `fdcc24a93baeadfe99a7e889502e04592e36d4bd0d0bee0d9ffb9aa9a5ecefff`
- Selection reason: Matched alias "cocina" in catalog ID: "casa cocinacasa1".
- Source analysis label: `kitchen`
- Prompt-template version: `la-arbolada-photographic-development-v4`
- Structured-plan SHA-256: `4bc891f08dc0eee5a27819c400253049d123aba9e8608733ce9aa4c8917f1e70`
- Image-specific adaptations: detected-wood: Keep cabinetry wood warm and realistic without orange color.

Structured development plan:

```json
{
  "profileId": "kitchen",
  "profileVersion": 3,
  "profileSha256": "fdcc24a93baeadfe99a7e889502e04592e36d4bd0d0bee0d9ffb9aa9a5ecefff",
  "sourceAnalysisLabel": "kitchen",
  "selectionReason": "Matched alias \"cocina\" in catalog ID: \"casa cocinacasa1\".",
  "description": "Bright, clean neutral-to-warm kitchen development with controlled reflective highlights and natural cabinetry materials.",
  "adjustments": {
    "exposure": {
      "intensity": "moderate",
      "direction": "increase",
      "instruction": "Increase overall exposure decisively enough for a bright, welcoming kitchen without clipping counters, lights, appliances, or windows.",
      "apply": true
    },
    "shadows": {
      "intensity": "moderate",
      "direction": "lift",
      "instruction": "Open shadows beneath cabinetry and counters to reveal existing detail while retaining natural depth.",
      "apply": true
    },
    "highlights": {
      "intensity": "moderate",
      "direction": "recover",
      "instruction": "Recover window, appliance, and reflective work-surface highlights while retaining a clean luminous finish.",
      "apply": true
    },
    "contrast": {
      "intensity": "moderate",
      "direction": "balance",
      "instruction": "Establish clean material separation without harsh edges, HDR compression, or sterile contrast.",
      "apply": true
    },
    "whiteBalance": {
      "intensity": "moderate",
      "direction": "neutral-warm",
      "instruction": "Neutralize casts for clean whites with slight natural warmth; no yellow cabinetry or blue-white surfaces.",
      "apply": true
    },
    "vibrance": {
      "intensity": "moderate",
      "direction": "increase",
      "instruction": "Enrich muted existing color moderately while keeping cabinetry, counters, and appliances realistic.",
      "apply": true
    },
    "saturation": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Use only a light controlled saturation increase.",
      "apply": true
    },
    "texture": {
      "intensity": "moderate",
      "direction": "increase",
      "instruction": "Reveal existing cabinetry and countertop texture through natural tonal separation, never invented detail.",
      "apply": true
    },
    "clarity": {
      "intensity": "light-moderate",
      "direction": "increase",
      "instruction": "Add restrained clarity without making appliances or edges brittle.",
      "apply": true
    },
    "sharpness": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Apply light final sharpening.",
      "apply": true
    }
  },
  "materialActions": [
    {
      "material": "wood",
      "instruction": "Keep cabinetry wood warm and realistic without orange color."
    }
  ],
  "specialActions": [],
  "imageSpecificAdaptations": [
    {
      "id": "detected-wood",
      "reason": "wood is identified in the existing analysis.",
      "instruction": "Keep cabinetry wood warm and realistic without orange color."
    }
  ],
  "detectedFeatures": {
    "lensFlare": false,
    "grass": false,
    "sky": true,
    "marble": false,
    "wood": true,
    "stone": false,
    "metal": false,
    "textiles": false,
    "water": false,
    "vegetation": true,
    "alreadyOversaturated": false,
    "excessiveMicrocontrast": false,
    "alreadyBright": false
  },
  "protectedElements": [
    "exact scene and architecture",
    "room layout and object count",
    "furniture and fixture placement",
    "openings, walls, roofs, floors, windows and doors",
    "vegetation, paths, pool boundaries and horizon",
    "camera position, perspective, framing, lens and composition"
  ],
  "prohibitions": [
    "no yellow cast",
    "no blue whites",
    "no blown metallic reflections"
  ],
  "valuesAreNaturalLanguageDirections": true,
  "sha256": "4bc891f08dc0eee5a27819c400253049d123aba9e8608733ce9aa4c8917f1e70"
}
```

Exact final edit instruction sent to Gemini:

```text
EXACT-PHOTOGRAPH RETOUCHING — ONE FINAL RASTER

ROLE
You are a senior Lightroom and Photoshop retoucher for luxury hotels, architecture, and hospitality. This supplied image is an existing real photograph. Perform photographic development only on its existing pixels.

EDITING OBJECTIVE
Execute the requested corrections visibly and decisively, like a careful professional retouch. Do not generate, redesign, restage, beautify, or reinterpret the scene. Preserve every structural and semantic element exactly; return one edited version of this same photograph.

OUTPUT CANVAS
Keep the exact supplied image canvas and aspect ratio. Do not crop, extend, pad, resize, rotate, mirror, reframe, or otherwise alter the pixel-coordinate layout.

REQUIRED DEVELOPMENT ACTIONS
Apply the following photographic development to the supplied photograph. Treat every intensity and direction as an imperative retoucher instruction, not as a literal slider value. Adapt the exact strength to the existing pixels, but make the requested result clearly visible rather than timid.

- exposure: moderate / increase. Increase overall exposure decisively enough for a bright, welcoming kitchen without clipping counters, lights, appliances, or windows.
- shadows: moderate / lift. Open shadows beneath cabinetry and counters to reveal existing detail while retaining natural depth.
- highlights: moderate / recover. Recover window, appliance, and reflective work-surface highlights while retaining a clean luminous finish.
- contrast: moderate / balance. Establish clean material separation without harsh edges, HDR compression, or sterile contrast.
- whiteBalance: moderate / neutral-warm. Neutralize casts for clean whites with slight natural warmth; no yellow cabinetry or blue-white surfaces.
- vibrance: moderate / increase. Enrich muted existing color moderately while keeping cabinetry, counters, and appliances realistic.
- saturation: light / increase. Use only a light controlled saturation increase.
- texture: moderate / increase. Reveal existing cabinetry and countertop texture through natural tonal separation, never invented detail.
- clarity: light-moderate / increase. Add restrained clarity without making appliances or edges brittle.
- sharpness: light / increase. Apply light final sharpening.

MATERIAL-SPECIFIC DEVELOPMENT
Develop only materials confirmed by the existing image analysis. Do not introduce a material-specific instruction for anything that is not visible.
- stucco: Refine the existing stucco or render with even white balance, controlled highlights, and moderate natural texture. Preserve every stain, joint, edge, and surface transition.
- wood: Keep cabinetry wood warm and realistic without orange color.
- trees and vegetation: Separate the existing foliage with natural green balance, restrained saturation, open shadows, and realistic depth. Preserve every plant shape, branch, leaf mass, and density.
- sky: Recover the existing sky highlights and deepen only its existing blue. Reveal real cloud detail without changing clouds, weather, atmosphere, or time of day.
- glass: Refine the existing glass through highlight recovery and clean tonal separation. Preserve every reflection, transparency, view, frame, and edge exactly.

IMAGE-SPECIFIC CALIBRATION
The structured actions above already incorporate the image analysis. Use that analysis only to place the requested corrections, protect areas already correct, and avoid compounding existing excess; never use it as permission to alter content.

NATURAL PHOTOGRAPHIC FINISH
Build luminosity with exposure and shadow recovery; protect highlights; establish professional white balance; reveal real material texture; and develop rich, natural color. Maintain natural tonal separation and realistic material response. Avoid HDR rendering, halos, clipped channels, crushed blacks, excessive microcontrast, excessive saturation, plastic smoothing, and synthetic sharpness.

PROFILE-SPECIFIC GUARDRAILS
- no yellow cast
- no blue whites
- no blown metallic reflections

PROFILE AUDIT
Profile: kitchen@3
Profile SHA-256: fdcc24a93baeadfe99a7e889502e04592e36d4bd0d0bee0d9ffb9aa9a5ecefff
Selection reason: Matched alias "cocina" in catalog ID: "casa cocinacasa1".
Source analysis label: kitchen
Prompt template: la-arbolada-photographic-development-v4

ABSOLUTE SCENE PRESERVATION
Preserve the exact scene, architecture, room layout, object count, furniture placement, and fixture placement. Preserve all openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon exactly as supplied. Preserve every person, face, item of clothing, physical object, material, reflection, cloud, plant shape, shadow direction, light direction, and existing texture.

Do not add, remove, replace, relocate, redesign, restage, or beautify physical objects. Do not change camera position, perspective, framing, lens, focal length, crop, proportions, or composition. Do not create fake sunlight, fake lamps, fake landscaping, fake shadows, fake reflections, fake rays, artificial HDR, or imaginary details. Do not add text, people, vehicles, furniture, plants, decorations, or building elements. Do not perform scene or object inpainting, outpainting, warping, reframing, sky replacement, or weather replacement.

If any photographic-development operation risks a semantic or geometric change, do not apply that adjustment. Preserve the existing photograph instead.

STYLE IDENTITY
Casa La Arbolada style: casa-la-arbolada@1.0.0
Style SHA-256: 52466a31d0b61f4b8c0dd29b5129efc0ade6e04c296589a9b6a33eeda2e0b4ce
Category: kitchen

DELIVERY
Complete one decisive, natural professional photographic development of this exact existing photograph. Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.
```

### casa-fachada2 — facade@2

- Profile SHA-256: `e7e7a082c858c64b02c397e1dcc8452eea38dad25a24b75109ef87ced16c1b24`
- Selection reason: Matched alias "fachada" in catalog ID: "casa fachada2".
- Source analysis label: `exterior`
- Prompt-template version: `la-arbolada-photographic-development-v4`
- Structured-plan SHA-256: `7c13de15dad896a1a183a685e440a8c8dad9d190a1145bf682fcc32eb7073fd5`
- Image-specific adaptations: detected-grass: Enrich dull existing grass toward a rich natural green while preserving blade, dry-area, hue, and luminance variation; never fluorescent or uniform.; detected-stone: Reveal existing stone texture, earth tones and tonal richness without crunchy microcontrast.; detected-wood: Keep existing wood warm, rich and realistic without an orange or red cast.

Structured development plan:

```json
{
  "profileId": "facade",
  "profileVersion": 2,
  "profileSha256": "e7e7a082c858c64b02c397e1dcc8452eea38dad25a24b75109ef87ced16c1b24",
  "sourceAnalysisLabel": "exterior",
  "selectionReason": "Matched alias \"fachada\" in catalog ID: \"casa fachada2\".",
  "description": "Bright, legible architectural exterior development with controlled highlights, natural sky, and realistic material depth.",
  "adjustments": {
    "exposure": {
      "intensity": "strong",
      "direction": "increase",
      "instruction": "Increase overall exposure decisively to create a bright, welcoming exterior while retaining detail in sunlit walls, glazing, and pale paving.",
      "apply": true
    },
    "shadows": {
      "intensity": "aggressive",
      "direction": "lift",
      "instruction": "Open deep shadows beneath roof overhangs, along building bases, and in the foreground; retain believable architectural depth.",
      "apply": true
    },
    "highlights": {
      "intensity": "moderate",
      "direction": "recover",
      "instruction": "Recover highlight detail in render, walls, glazing, and other bright existing surfaces; prevent clipping without dulling sunlight.",
      "apply": true
    },
    "contrast": {
      "intensity": "moderate",
      "direction": "increase",
      "instruction": "Restore crisp architectural tonal separation after shadow recovery without HDR compression or exaggerated local contrast.",
      "apply": true
    },
    "whiteBalance": {
      "intensity": "subtle",
      "direction": "warm",
      "instruction": "Neutralize unwanted casts and warm only enough to make stone, plaster, and wood inviting while keeping neutral building materials believable.",
      "apply": true
    },
    "vibrance": {
      "intensity": "strong",
      "direction": "increase",
      "instruction": "Enrich muted existing color clearly while preserving natural variation between vegetation, sky, stone, plaster, and wood.",
      "apply": true
    },
    "saturation": {
      "intensity": "moderate",
      "direction": "increase",
      "instruction": "Increase saturation only with controlled channel separation; preserve realistic greens, blue sky, and neutral façades.",
      "apply": true
    },
    "texture": {
      "intensity": "moderate",
      "direction": "increase",
      "instruction": "Reveal existing stone, plaster, and wood texture through tonal richness; do not redraw or invent surface detail.",
      "apply": true
    },
    "clarity": {
      "intensity": "moderate",
      "direction": "increase",
      "instruction": "Add moderate, clean architectural clarity for legibility without halos, crunchy surfaces, or edge glow.",
      "apply": true
    },
    "sharpness": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Apply only light final sharpening with natural edges.",
      "apply": true
    }
  },
  "materialActions": [
    {
      "material": "grass",
      "instruction": "Enrich dull existing grass toward a rich natural green while preserving blade, dry-area, hue, and luminance variation; never fluorescent or uniform."
    },
    {
      "material": "stone",
      "instruction": "Reveal existing stone texture, earth tones and tonal richness without crunchy microcontrast."
    },
    {
      "material": "wood",
      "instruction": "Keep existing wood warm, rich and realistic without an orange or red cast."
    }
  ],
  "specialActions": [],
  "imageSpecificAdaptations": [
    {
      "id": "detected-grass",
      "reason": "grass is identified in the existing analysis.",
      "instruction": "Enrich dull existing grass toward a rich natural green while preserving blade, dry-area, hue, and luminance variation; never fluorescent or uniform."
    },
    {
      "id": "detected-stone",
      "reason": "stone is identified in the existing analysis.",
      "instruction": "Reveal existing stone texture, earth tones and tonal richness without crunchy microcontrast."
    },
    {
      "id": "detected-wood",
      "reason": "wood is identified in the existing analysis.",
      "instruction": "Keep existing wood warm, rich and realistic without an orange or red cast."
    }
  ],
  "detectedFeatures": {
    "lensFlare": false,
    "grass": true,
    "sky": false,
    "marble": false,
    "wood": true,
    "stone": true,
    "metal": false,
    "textiles": false,
    "water": false,
    "vegetation": true,
    "alreadyOversaturated": false,
    "excessiveMicrocontrast": false,
    "alreadyBright": false
  },
  "protectedElements": [
    "exact scene and architecture",
    "room layout and object count",
    "furniture and fixture placement",
    "openings, walls, roofs, floors, windows and doors",
    "vegetation, paths, pool boundaries and horizon",
    "camera position, perspective, framing, lens and composition"
  ],
  "prohibitions": [
    "no fluorescent greens",
    "no artificial sky",
    "no clipped walls",
    "no HDR halos"
  ],
  "valuesAreNaturalLanguageDirections": true,
  "sha256": "7c13de15dad896a1a183a685e440a8c8dad9d190a1145bf682fcc32eb7073fd5"
}
```

Exact final edit instruction sent to Gemini:

```text
EXACT-PHOTOGRAPH RETOUCHING — ONE FINAL RASTER

ROLE
You are a senior Lightroom and Photoshop retoucher for luxury hotels, architecture, and hospitality. This supplied image is an existing real photograph. Perform photographic development only on its existing pixels.

EDITING OBJECTIVE
Execute the requested corrections visibly and decisively, like a careful professional retouch. Do not generate, redesign, restage, beautify, or reinterpret the scene. Preserve every structural and semantic element exactly; return one edited version of this same photograph.

OUTPUT CANVAS
Keep the exact supplied image canvas and aspect ratio. Do not crop, extend, pad, resize, rotate, mirror, reframe, or otherwise alter the pixel-coordinate layout.

REQUIRED DEVELOPMENT ACTIONS
Apply the following photographic development to the supplied photograph. Treat every intensity and direction as an imperative retoucher instruction, not as a literal slider value. Adapt the exact strength to the existing pixels, but make the requested result clearly visible rather than timid.

- exposure: strong / increase. Increase overall exposure decisively to create a bright, welcoming exterior while retaining detail in sunlit walls, glazing, and pale paving.
- shadows: aggressive / lift. Open deep shadows beneath roof overhangs, along building bases, and in the foreground; retain believable architectural depth.
- highlights: moderate / recover. Recover highlight detail in render, walls, glazing, and other bright existing surfaces; prevent clipping without dulling sunlight.
- contrast: moderate / increase. Restore crisp architectural tonal separation after shadow recovery without HDR compression or exaggerated local contrast.
- whiteBalance: subtle / warm. Neutralize unwanted casts and warm only enough to make stone, plaster, and wood inviting while keeping neutral building materials believable.
- vibrance: strong / increase. Enrich muted existing color clearly while preserving natural variation between vegetation, sky, stone, plaster, and wood.
- saturation: moderate / increase. Increase saturation only with controlled channel separation; preserve realistic greens, blue sky, and neutral façades.
- texture: moderate / increase. Reveal existing stone, plaster, and wood texture through tonal richness; do not redraw or invent surface detail.
- clarity: moderate / increase. Add moderate, clean architectural clarity for legibility without halos, crunchy surfaces, or edge glow.
- sharpness: light / increase. Apply only light final sharpening with natural edges.

MATERIAL-SPECIFIC DEVELOPMENT
Develop only materials confirmed by the existing image analysis. Do not introduce a material-specific instruction for anything that is not visible.
- stone: Reveal existing stone texture, earth tones and tonal richness without crunchy microcontrast.
- stucco: Refine the existing stucco or render with even white balance, controlled highlights, and moderate natural texture. Preserve every stain, joint, edge, and surface transition.
- wood: Keep existing wood warm, rich and realistic without an orange or red cast.
- grass: Enrich dull existing grass toward a rich natural green while preserving blade, dry-area, hue, and luminance variation; never fluorescent or uniform.
- trees and vegetation: Separate the existing foliage with natural green balance, restrained saturation, open shadows, and realistic depth. Preserve every plant shape, branch, leaf mass, and density.

IMAGE-SPECIFIC CALIBRATION
The structured actions above already incorporate the image analysis. Use that analysis only to place the requested corrections, protect areas already correct, and avoid compounding existing excess; never use it as permission to alter content.

NATURAL PHOTOGRAPHIC FINISH
Build luminosity with exposure and shadow recovery; protect highlights; establish professional white balance; reveal real material texture; and develop rich, natural color. Maintain natural tonal separation and realistic material response. Avoid HDR rendering, halos, clipped channels, crushed blacks, excessive microcontrast, excessive saturation, plastic smoothing, and synthetic sharpness.

PROFILE-SPECIFIC GUARDRAILS
- no fluorescent greens
- no artificial sky
- no clipped walls
- no HDR halos

PROFILE AUDIT
Profile: facade@2
Profile SHA-256: e7e7a082c858c64b02c397e1dcc8452eea38dad25a24b75109ef87ced16c1b24
Selection reason: Matched alias "fachada" in catalog ID: "casa fachada2".
Source analysis label: exterior
Prompt template: la-arbolada-photographic-development-v4

ABSOLUTE SCENE PRESERVATION
Preserve the exact scene, architecture, room layout, object count, furniture placement, and fixture placement. Preserve all openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon exactly as supplied. Preserve every person, face, item of clothing, physical object, material, reflection, cloud, plant shape, shadow direction, light direction, and existing texture.

Do not add, remove, replace, relocate, redesign, restage, or beautify physical objects. Do not change camera position, perspective, framing, lens, focal length, crop, proportions, or composition. Do not create fake sunlight, fake lamps, fake landscaping, fake shadows, fake reflections, fake rays, artificial HDR, or imaginary details. Do not add text, people, vehicles, furniture, plants, decorations, or building elements. Do not perform scene or object inpainting, outpainting, warping, reframing, sky replacement, or weather replacement.

If any photographic-development operation risks a semantic or geometric change, do not apply that adjustment. Preserve the existing photograph instead.

STYLE IDENTITY
Casa La Arbolada style: casa-la-arbolada@1.0.0
Style SHA-256: 52466a31d0b61f4b8c0dd29b5129efc0ade6e04c296589a9b6a33eeda2e0b4ce
Category: exterior

DELIVERY
Complete one decisive, natural professional photographic development of this exact existing photograph. Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.
```

### casa-patio11 — patio@2

- Profile SHA-256: `69af2ea472c4bfe10676f2377bba2f45e1a284ca546e0405d9d00d5742651555`
- Selection reason: Matched alias "patio" in catalog ID: "casa patio11".
- Source analysis label: `landscape`
- Prompt-template version: `la-arbolada-photographic-development-v4`
- Structured-plan SHA-256: `2198e8a18b36fc3db56080e93f1ddfc3f7ec0a6fa250021560ab6c45f5d6461b`
- Image-specific adaptations: detected-sky: Keep the existing sky soft and believable without deep artificial blue.; detected-stone: Keep stone, gravel and tile texture visible but gentle and realistic.

Structured development plan:

```json
{
  "profileId": "patio",
  "profileVersion": 2,
  "profileSha256": "69af2ea472c4bfe10676f2377bba2f45e1a284ca546e0405d9d00d5742651555",
  "sourceAnalysisLabel": "landscape",
  "selectionReason": "Matched alias \"patio\" in catalog ID: \"casa patio11\".",
  "description": "Soft, inviting hospitality patio development with open shadows, controlled highlights, and restrained photographic texture.",
  "adjustments": {
    "exposure": {
      "intensity": "moderate",
      "direction": "balance",
      "instruction": "Set a bright but believable overall exposure that feels welcoming without changing the real time-of-day character.",
      "apply": true
    },
    "shadows": {
      "intensity": "moderate",
      "direction": "lift",
      "instruction": "Open shaded seating, paving, and architectural recesses enough to reveal existing detail while retaining soft depth.",
      "apply": true
    },
    "highlights": {
      "intensity": "strong",
      "direction": "recover",
      "instruction": "Recover bright highlights in existing lamps, glazing, paving, and reflective surfaces while retaining a luminous natural finish.",
      "apply": true
    },
    "contrast": {
      "intensity": "moderate",
      "direction": "balance",
      "instruction": "Create soft, clean tonal separation after shadow recovery; avoid both flatness and hard HDR-like contrast.",
      "apply": true
    },
    "whiteBalance": {
      "intensity": "moderate",
      "direction": "neutralize",
      "instruction": "Neutralize unwanted cold or yellow casts while preserving the actual time-of-day character and warm hospitality mood.",
      "apply": true
    },
    "vibrance": {
      "intensity": "light-moderate",
      "direction": "increase",
      "instruction": "Enrich muted existing color gently for an inviting setting while preserving restrained material color.",
      "apply": true
    },
    "saturation": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Use restrained saturation only where the original is muted; keep stone, wood, sky, and vegetation realistic.",
      "apply": true
    },
    "texture": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Reveal existing stone, tile, wood, and fabric texture softly; never create a gritty or crunchy surface.",
      "apply": true
    },
    "clarity": {
      "intensity": "low-moderate",
      "direction": "increase",
      "instruction": "Use only gentle local clarity for material readability; avoid glowing edges, harsh microcontrast, and digital crispness.",
      "apply": true
    },
    "sharpness": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Apply light natural sharpening to existing edges only; keep the hospitality finish soft and photographic.",
      "apply": true
    }
  },
  "materialActions": [
    {
      "material": "sky",
      "instruction": "Keep the existing sky soft and believable without deep artificial blue."
    },
    {
      "material": "stone",
      "instruction": "Keep stone, gravel and tile texture visible but gentle and realistic."
    }
  ],
  "specialActions": [],
  "imageSpecificAdaptations": [
    {
      "id": "detected-sky",
      "reason": "sky is identified in the existing analysis.",
      "instruction": "Keep the existing sky soft and believable without deep artificial blue."
    },
    {
      "id": "detected-stone",
      "reason": "stone is identified in the existing analysis.",
      "instruction": "Keep stone, gravel and tile texture visible but gentle and realistic."
    }
  ],
  "detectedFeatures": {
    "lensFlare": false,
    "grass": true,
    "sky": true,
    "marble": false,
    "wood": false,
    "stone": true,
    "metal": false,
    "textiles": false,
    "water": false,
    "vegetation": true,
    "alreadyOversaturated": false,
    "excessiveMicrocontrast": false,
    "alreadyBright": false
  },
  "protectedElements": [
    "exact scene and architecture",
    "room layout and object count",
    "furniture and fixture placement",
    "openings, walls, roofs, floors, windows and doors",
    "vegetation, paths, pool boundaries and horizon",
    "camera position, perspective, framing, lens and composition"
  ],
  "prohibitions": [
    "no dramatic HDR",
    "no crushed blacks",
    "no glowing edges",
    "no artificial sharpness"
  ],
  "valuesAreNaturalLanguageDirections": true,
  "sha256": "2198e8a18b36fc3db56080e93f1ddfc3f7ec0a6fa250021560ab6c45f5d6461b"
}
```

Exact final edit instruction sent to Gemini:

```text
EXACT-PHOTOGRAPH RETOUCHING — ONE FINAL RASTER

ROLE
You are a senior Lightroom and Photoshop retoucher for luxury hotels, architecture, and hospitality. This supplied image is an existing real photograph. Perform photographic development only on its existing pixels.

EDITING OBJECTIVE
Execute the requested corrections visibly and decisively, like a careful professional retouch. Do not generate, redesign, restage, beautify, or reinterpret the scene. Preserve every structural and semantic element exactly; return one edited version of this same photograph.

OUTPUT CANVAS
Keep the exact supplied image canvas and aspect ratio. Do not crop, extend, pad, resize, rotate, mirror, reframe, or otherwise alter the pixel-coordinate layout.

REQUIRED DEVELOPMENT ACTIONS
Apply the following photographic development to the supplied photograph. Treat every intensity and direction as an imperative retoucher instruction, not as a literal slider value. Adapt the exact strength to the existing pixels, but make the requested result clearly visible rather than timid.

- exposure: moderate / balance. Set a bright but believable overall exposure that feels welcoming without changing the real time-of-day character.
- shadows: moderate / lift. Open shaded seating, paving, and architectural recesses enough to reveal existing detail while retaining soft depth.
- highlights: strong / recover. Recover bright highlights in existing lamps, glazing, paving, and reflective surfaces while retaining a luminous natural finish.
- contrast: moderate / balance. Create soft, clean tonal separation after shadow recovery; avoid both flatness and hard HDR-like contrast.
- whiteBalance: moderate / neutralize. Neutralize unwanted cold or yellow casts while preserving the actual time-of-day character and warm hospitality mood.
- vibrance: light-moderate / increase. Enrich muted existing color gently for an inviting setting while preserving restrained material color.
- saturation: light / increase. Use restrained saturation only where the original is muted; keep stone, wood, sky, and vegetation realistic.
- texture: light / increase. Reveal existing stone, tile, wood, and fabric texture softly; never create a gritty or crunchy surface.
- clarity: low-moderate / increase. Use only gentle local clarity for material readability; avoid glowing edges, harsh microcontrast, and digital crispness.
- sharpness: light / increase. Apply light natural sharpening to existing edges only; keep the hospitality finish soft and photographic.

MATERIAL-SPECIFIC DEVELOPMENT
Develop only materials confirmed by the existing image analysis. Do not introduce a material-specific instruction for anything that is not visible.
- stone: Keep stone, gravel and tile texture visible but gentle and realistic.
- stucco: Refine the existing stucco or render with even white balance, controlled highlights, and moderate natural texture. Preserve every stain, joint, edge, and surface transition.
- grass: Deepen dull existing grass toward a rich natural green. Preserve blade patterns, density, dry areas, hue variation, and luminance variation; never make it fluorescent or uniform.
- trees and vegetation: Separate the existing foliage with natural green balance, restrained saturation, open shadows, and realistic depth. Preserve every plant shape, branch, leaf mass, and density.
- sky: Keep the existing sky soft and believable without deep artificial blue.

IMAGE-SPECIFIC CALIBRATION
The structured actions above already incorporate the image analysis. Use that analysis only to place the requested corrections, protect areas already correct, and avoid compounding existing excess; never use it as permission to alter content.

NATURAL PHOTOGRAPHIC FINISH
Build luminosity with exposure and shadow recovery; protect highlights; establish professional white balance; reveal real material texture; and develop rich, natural color. Maintain natural tonal separation and realistic material response. Avoid HDR rendering, halos, clipped channels, crushed blacks, excessive microcontrast, excessive saturation, plastic smoothing, and synthetic sharpness.

PROFILE-SPECIFIC GUARDRAILS
- no dramatic HDR
- no crushed blacks
- no glowing edges
- no artificial sharpness

PROFILE AUDIT
Profile: patio@2
Profile SHA-256: 69af2ea472c4bfe10676f2377bba2f45e1a284ca546e0405d9d00d5742651555
Selection reason: Matched alias "patio" in catalog ID: "casa patio11".
Source analysis label: landscape
Prompt template: la-arbolada-photographic-development-v4

ABSOLUTE SCENE PRESERVATION
Preserve the exact scene, architecture, room layout, object count, furniture placement, and fixture placement. Preserve all openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon exactly as supplied. Preserve every person, face, item of clothing, physical object, material, reflection, cloud, plant shape, shadow direction, light direction, and existing texture.

Do not add, remove, replace, relocate, redesign, restage, or beautify physical objects. Do not change camera position, perspective, framing, lens, focal length, crop, proportions, or composition. Do not create fake sunlight, fake lamps, fake landscaping, fake shadows, fake reflections, fake rays, artificial HDR, or imaginary details. Do not add text, people, vehicles, furniture, plants, decorations, or building elements. Do not perform scene or object inpainting, outpainting, warping, reframing, sky replacement, or weather replacement.

If any photographic-development operation risks a semantic or geometric change, do not apply that adjustment. Preserve the existing photograph instead.

STYLE IDENTITY
Casa La Arbolada style: casa-la-arbolada@1.0.0
Style SHA-256: 52466a31d0b61f4b8c0dd29b5129efc0ade6e04c296589a9b6a33eeda2e0b4ce
Category: park

DELIVERY
Complete one decisive, natural professional photographic development of this exact existing photograph. Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.
```

### casa-patio7 — patio@2

- Profile SHA-256: `69af2ea472c4bfe10676f2377bba2f45e1a284ca546e0405d9d00d5742651555`
- Selection reason: Matched alias "patio" in catalog ID: "casa patio7".
- Source analysis label: `creek`
- Prompt-template version: `la-arbolada-photographic-development-v4`
- Structured-plan SHA-256: `06a333526b8c55d2fe40e39a7f34d23fd49957515cc4d0ea62fcb9d5869f84a6`
- Image-specific adaptations: detected-sky: Keep the existing sky soft and believable without deep artificial blue.; detected-stone: Keep stone, gravel and tile texture visible but gentle and realistic.

Structured development plan:

```json
{
  "profileId": "patio",
  "profileVersion": 2,
  "profileSha256": "69af2ea472c4bfe10676f2377bba2f45e1a284ca546e0405d9d00d5742651555",
  "sourceAnalysisLabel": "creek",
  "selectionReason": "Matched alias \"patio\" in catalog ID: \"casa patio7\".",
  "description": "Soft, inviting hospitality patio development with open shadows, controlled highlights, and restrained photographic texture.",
  "adjustments": {
    "exposure": {
      "intensity": "moderate",
      "direction": "balance",
      "instruction": "Set a bright but believable overall exposure that feels welcoming without changing the real time-of-day character.",
      "apply": true
    },
    "shadows": {
      "intensity": "moderate",
      "direction": "lift",
      "instruction": "Open shaded seating, paving, and architectural recesses enough to reveal existing detail while retaining soft depth.",
      "apply": true
    },
    "highlights": {
      "intensity": "strong",
      "direction": "recover",
      "instruction": "Recover bright highlights in existing lamps, glazing, paving, and reflective surfaces while retaining a luminous natural finish.",
      "apply": true
    },
    "contrast": {
      "intensity": "moderate",
      "direction": "balance",
      "instruction": "Create soft, clean tonal separation after shadow recovery; avoid both flatness and hard HDR-like contrast.",
      "apply": true
    },
    "whiteBalance": {
      "intensity": "moderate",
      "direction": "neutralize",
      "instruction": "Neutralize unwanted cold or yellow casts while preserving the actual time-of-day character and warm hospitality mood.",
      "apply": true
    },
    "vibrance": {
      "intensity": "light-moderate",
      "direction": "increase",
      "instruction": "Enrich muted existing color gently for an inviting setting while preserving restrained material color.",
      "apply": true
    },
    "saturation": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Use restrained saturation only where the original is muted; keep stone, wood, sky, and vegetation realistic.",
      "apply": true
    },
    "texture": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Reveal existing stone, tile, wood, and fabric texture softly; never create a gritty or crunchy surface.",
      "apply": true
    },
    "clarity": {
      "intensity": "low-moderate",
      "direction": "increase",
      "instruction": "Use only gentle local clarity for material readability; avoid glowing edges, harsh microcontrast, and digital crispness.",
      "apply": true
    },
    "sharpness": {
      "intensity": "light",
      "direction": "increase",
      "instruction": "Apply light natural sharpening to existing edges only; keep the hospitality finish soft and photographic.",
      "apply": true
    }
  },
  "materialActions": [
    {
      "material": "sky",
      "instruction": "Keep the existing sky soft and believable without deep artificial blue."
    },
    {
      "material": "stone",
      "instruction": "Keep stone, gravel and tile texture visible but gentle and realistic."
    }
  ],
  "specialActions": [],
  "imageSpecificAdaptations": [
    {
      "id": "detected-sky",
      "reason": "sky is identified in the existing analysis.",
      "instruction": "Keep the existing sky soft and believable without deep artificial blue."
    },
    {
      "id": "detected-stone",
      "reason": "stone is identified in the existing analysis.",
      "instruction": "Keep stone, gravel and tile texture visible but gentle and realistic."
    }
  ],
  "detectedFeatures": {
    "lensFlare": false,
    "grass": true,
    "sky": true,
    "marble": false,
    "wood": false,
    "stone": true,
    "metal": false,
    "textiles": false,
    "water": true,
    "vegetation": true,
    "alreadyOversaturated": false,
    "excessiveMicrocontrast": false,
    "alreadyBright": false
  },
  "protectedElements": [
    "exact scene and architecture",
    "room layout and object count",
    "furniture and fixture placement",
    "openings, walls, roofs, floors, windows and doors",
    "vegetation, paths, pool boundaries and horizon",
    "camera position, perspective, framing, lens and composition"
  ],
  "prohibitions": [
    "no dramatic HDR",
    "no crushed blacks",
    "no glowing edges",
    "no artificial sharpness"
  ],
  "valuesAreNaturalLanguageDirections": true,
  "sha256": "06a333526b8c55d2fe40e39a7f34d23fd49957515cc4d0ea62fcb9d5869f84a6"
}
```

Exact final edit instruction sent to Gemini:

```text
EXACT-PHOTOGRAPH RETOUCHING — ONE FINAL RASTER

ROLE
You are a senior Lightroom and Photoshop retoucher for luxury hotels, architecture, and hospitality. This supplied image is an existing real photograph. Perform photographic development only on its existing pixels.

EDITING OBJECTIVE
Execute the requested corrections visibly and decisively, like a careful professional retouch. Do not generate, redesign, restage, beautify, or reinterpret the scene. Preserve every structural and semantic element exactly; return one edited version of this same photograph.

OUTPUT CANVAS
Keep the exact supplied image canvas and aspect ratio. Do not crop, extend, pad, resize, rotate, mirror, reframe, or otherwise alter the pixel-coordinate layout.

REQUIRED DEVELOPMENT ACTIONS
Apply the following photographic development to the supplied photograph. Treat every intensity and direction as an imperative retoucher instruction, not as a literal slider value. Adapt the exact strength to the existing pixels, but make the requested result clearly visible rather than timid.

- exposure: moderate / balance. Set a bright but believable overall exposure that feels welcoming without changing the real time-of-day character.
- shadows: moderate / lift. Open shaded seating, paving, and architectural recesses enough to reveal existing detail while retaining soft depth.
- highlights: strong / recover. Recover bright highlights in existing lamps, glazing, paving, and reflective surfaces while retaining a luminous natural finish.
- contrast: moderate / balance. Create soft, clean tonal separation after shadow recovery; avoid both flatness and hard HDR-like contrast.
- whiteBalance: moderate / neutralize. Neutralize unwanted cold or yellow casts while preserving the actual time-of-day character and warm hospitality mood.
- vibrance: light-moderate / increase. Enrich muted existing color gently for an inviting setting while preserving restrained material color.
- saturation: light / increase. Use restrained saturation only where the original is muted; keep stone, wood, sky, and vegetation realistic.
- texture: light / increase. Reveal existing stone, tile, wood, and fabric texture softly; never create a gritty or crunchy surface.
- clarity: low-moderate / increase. Use only gentle local clarity for material readability; avoid glowing edges, harsh microcontrast, and digital crispness.
- sharpness: light / increase. Apply light natural sharpening to existing edges only; keep the hospitality finish soft and photographic.

MATERIAL-SPECIFIC DEVELOPMENT
Develop only materials confirmed by the existing image analysis. Do not introduce a material-specific instruction for anything that is not visible.
- stone: Keep stone, gravel and tile texture visible but gentle and realistic.
- grass: Deepen dull existing grass toward a rich natural green. Preserve blade patterns, density, dry areas, hue variation, and luminance variation; never make it fluorescent or uniform.
- trees and vegetation: Separate the existing foliage with natural green balance, restrained saturation, open shadows, and realistic depth. Preserve every plant shape, branch, leaf mass, and density.
- sky: Keep the existing sky soft and believable without deep artificial blue.
- water: Refine the existing water color, highlights, and tonal separation. Preserve every reflection, ripple, boundary, transparency, and depth cue exactly.

IMAGE-SPECIFIC CALIBRATION
The structured actions above already incorporate the image analysis. Use that analysis only to place the requested corrections, protect areas already correct, and avoid compounding existing excess; never use it as permission to alter content.

NATURAL PHOTOGRAPHIC FINISH
Build luminosity with exposure and shadow recovery; protect highlights; establish professional white balance; reveal real material texture; and develop rich, natural color. Maintain natural tonal separation and realistic material response. Avoid HDR rendering, halos, clipped channels, crushed blacks, excessive microcontrast, excessive saturation, plastic smoothing, and synthetic sharpness.

PROFILE-SPECIFIC GUARDRAILS
- no dramatic HDR
- no crushed blacks
- no glowing edges
- no artificial sharpness

PROFILE AUDIT
Profile: patio@2
Profile SHA-256: 69af2ea472c4bfe10676f2377bba2f45e1a284ca546e0405d9d00d5742651555
Selection reason: Matched alias "patio" in catalog ID: "casa patio7".
Source analysis label: creek
Prompt template: la-arbolada-photographic-development-v4

ABSOLUTE SCENE PRESERVATION
Preserve the exact scene, architecture, room layout, object count, furniture placement, and fixture placement. Preserve all openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon exactly as supplied. Preserve every person, face, item of clothing, physical object, material, reflection, cloud, plant shape, shadow direction, light direction, and existing texture.

Do not add, remove, replace, relocate, redesign, restage, or beautify physical objects. Do not change camera position, perspective, framing, lens, focal length, crop, proportions, or composition. Do not create fake sunlight, fake lamps, fake landscaping, fake shadows, fake reflections, fake rays, artificial HDR, or imaginary details. Do not add text, people, vehicles, furniture, plants, decorations, or building elements. Do not perform scene or object inpainting, outpainting, warping, reframing, sky replacement, or weather replacement.

If any photographic-development operation risks a semantic or geometric change, do not apply that adjustment. Preserve the existing photograph instead.

STYLE IDENTITY
Casa La Arbolada style: casa-la-arbolada@1.0.0
Style SHA-256: 52466a31d0b61f4b8c0dd29b5129efc0ade6e04c296589a9b6a33eeda2e0b4ce
Category: creek

DELIVERY
Complete one decisive, natural professional photographic development of this exact existing photograph. Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.
```

Provider reasoning, adaptive edit instructions, provider-raster identity, quality metrics, cache identity, style identity, and full structured responses are retained in `reports/gemini-metrics.json`.
