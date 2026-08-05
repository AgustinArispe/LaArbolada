# Casa La Arbolada photographic-development profiles readiness

Generated: 2026-07-23

## Outcome

The Gemini image-editing stage now receives explicit, category-specific photographic-development direction instead of a generic enhancement request. The repository's global editorial style, approval flow, locked-image protections, raster normalization, structural gates, post-validation, reports, cache safety, and publication behavior remain in force.

No owner photograph was opened by the runtime pipeline, processed, uploaded, regenerated, approved, or published during this implementation. No Gemini endpoint was contacted.

## Files created

- `photo-processing/profiles/profile.mjs`
- `photo-processing/profiles/facade.json`
- `photo-processing/profiles/patio.json`
- `photo-processing/profiles/bathroom.json`
- `photo-processing/profiles/kitchen.json`
- `photo-processing/profiles/living-room.json`
- `photo-processing/profiles/bedroom.json`
- `photo-processing/profiles/garden.json`
- `photo-processing/profiles/pool.json`
- `photo-processing/profiles/default.json`
- `reports/development-profiles-readiness.md`

## Files modified

- `photo-processing/providers/prompts.mjs`
- `photo-processing/cache.mjs`
- `photo-processing/pipeline.mjs`
- `photo-processing/pilot.mjs`
- `photo-processing/reports.mjs`
- `photo-processing/README.md`
- `scripts/photo-ai-workflow.mjs`
- `tests/photo-pipeline.test.mjs`
- `README.md`

No production image, owner original, approval decision, style profile, quality threshold, provider model configuration, or publication selector was modified.

## Profile summaries

All profiles are validated fail-closed at pipeline startup. A profile requires an ID, positive integer version, complete adjustment directions, material priorities, conditional special actions, and prohibitions. Its content hash is the SHA-256 of canonicalized JSON, so formatting and object-key order do not create false cache changes.

| Profile | Version | Intent | Content SHA-256 |
| --- | ---: | --- | --- |
| `facade` | 1 | Luminous, warm exterior development; strong exposure/shadow recovery, controlled sky/grass/material richness | `39be26d13ee3843d30fb7aa42c79a280c0dae4cf086f3fde76a0918138f7e3ae` |
| `patio` | 1 | Soft, realistic patio development; strong reduction of excessive contrast, saturation, clarity, and hard detail | `4b04e28b1461723818a5386fe30c51f692f35b5c1050eff2acf836a38716b5fe` |
| `bathroom` | 1 | Bright, clean bathroom development; shadow lift, reflective-highlight control, rich natural materials, conditional optical-flare cleanup | `02c2b5dbc0105b2683aaa6851587c02ced23b29441694608bc34fa117b18ea58` |
| `kitchen` | 1 | Neutral-to-warm whites, realistic cabinetry, controlled metal reflections, lifted shadows | `047a3425ca3c43f7c695ab75e85a0f4a3ea406967818c7d2526f59d61fe77c9e` |
| `living-room` | 1 | Warm inviting light, protected windows, careful dark-furniture lift, authentic materials | `fe7c1dd9be7b3f221a0b6e8e0abf0d71d16920626a1e1f0dbb23ecfa404c18a7` |
| `bedroom` | 1 | Soft natural light, neutral bedding, restrained contrast and clarity, no orange/yellow cast | `9c583c8525262576cff2392821331e0eebb60f6acdb411bc120eca03cd35a27d` |
| `garden` | 1 | Natural vegetation separation, controlled greens, natural sky, visible soil/stone texture | `8a33ef37bd3f434ee676311be36f0fc08a657348986d56dd97d6f40fb95a0ddd` |
| `pool` | 1 | Clean natural water color, preserved reflections, controlled highlights, realistic vegetation | `74c52d6be3232661c066d16a545326169c6d44709ab2597c2abdde931acde459` |
| `default` | 1 | Conservative professional real-estate development for uncertain categories | `212dfd2e2a1079fd8d49258cc0af171e38aacc304d48ea9ab3e854b4812e6530` |

The structured fields are natural-language photographic directions. They are not represented as Lightroom slider values and are not translated into unsupported API parameters.

## Deterministic profile selection

Selection uses data already available to the existing analysis workflow; it does not add a Gemini call. Candidate signals are checked deterministically and the result records the selected ID/version, source analysis label, and exact selection reason.

Supported aliases include:

- `exterior`, `facade`, `fachada`, `frontage` → `facade`
- `patio`, `terrace`, `deck`, `veranda`, `terraza` → `patio`
- `bathroom`, `restroom`, `washroom`, `baño` → `bathroom`
- `kitchen`, `cocina` → `kitchen`
- `living`, `living room`, `lounge`, `sitting room` → `living-room`
- `bedroom`, `dormitorio` → `bedroom`
- `garden`, `yard`, `landscape`, `park`, `creek` → `garden`
- `pool`, `swimming pool`, `pileta`, `piscina` → `pool`

An uncertain category selects `default`. A locked record throws before profile selection.

## Image-specific adaptation

The structured plan is assembled locally from the selected repository profile and the already-produced visual analysis. It records every adjustment, activated material action, special action, detected feature, preservation requirement, profile prohibition, selection reason, and a canonical plan SHA-256.

- Flare cleanup is emitted only when the analysis positively identifies lens flare, circular flare, optical flare, or veiling glare.
- Grass, sky, marble, wood, stone, metal, textile, water, and vegetation directions are emitted only when detected.
- Existing oversaturation replaces any aggressive increase with conservative saturation/vibrance reduction.
- Existing excessive microcontrast replaces clarity/texture increases with reduction.
- An already-bright or correctly exposed image suppresses further global exposure increase and protects highlights.
- Adaptation cannot remove the profile's prohibitions or the common structural-preservation block.

## Prompt construction

Prompt-template version: `la-arbolada-photographic-development-v1`.

Every final prompt begins exactly with this role and task:

```text
ROLE
You are performing professional photographic development for a real-estate listing. Apply the requested tonal, color, exposure, and texture development to the supplied photograph. Treat this as photographic retouching, not scene generation.

PRIMARY TASK
Apply the following photographic development to the supplied photograph. Follow the stated natural-language direction and intensity for exposure, shadow lift, highlight recovery, contrast, white balance, vibrance, saturation, texture, clarity, sharpness, and material rendering. These are photographic directions, not literal Lightroom slider values.
```

Every final prompt also includes the selected profile identity and hash, selection reason, source analysis label, complete structured development plan JSON, image-specific observations, global Casa La Arbolada style identity, and this mandatory output rule:

```text
Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.
```

### Example: facade

Representative selection: `casa-fachada2`, source label `exterior`.

```text
SELECTED DEVELOPMENT PROFILE
Profile: facade@1
Profile SHA-256: 39be26d13ee3843d30fb7aa42c79a280c0dae4cf086f3fde76a0918138f7e3ae
Selection reason: Matched alias "fachada" in catalog ID: "casa fachada2".
Source analysis label: exterior
Prompt template: la-arbolada-photographic-development-v1

Apply strong global exposure increase while protecting already-bright surfaces; aggressively lift overhang, building-base, and foreground shadows; recover wall, render, glazing, and sky highlights; add moderate clean contrast; warm white balance subtly; increase vibrance strongly but naturally and saturation moderately; add moderate texture and clarity with light final sharpening. Because the example analysis detects grass, sky, stone, and wood, enrich only the existing grass toward natural emerald, deepen only the existing pale-blue sky, reveal real stone/earth texture, and preserve realistic warm wood.
```

The representative plan hash is `f7cc8028e7e5171717c32de08e8011d42afdee25d37eb03be692fbf4eff869d6`. The exact generated prompt hash is `db5c758cb22dc307dfab4ab02f547eb9f3a6576343a6a89400154f2273c8600f`.

### Example: patio

Representative selection: `casa-patio11`, source label `park`; the catalog ID deterministically selects the more specific patio profile.

```text
SELECTED DEVELOPMENT PROFILE
Profile: patio@1
Profile SHA-256: 4b04e28b1461723818a5386fe30c51f692f35b5c1050eff2acf836a38716b5fe
Selection reason: Matched alias "patio" in catalog ID: "casa patio11".
Source analysis label: park
Prompt template: la-arbolada-photographic-development-v1

Balance exposure conservatively; lift only deep shadows; strongly recover existing bright highlights; strongly reduce excessive global contrast; neutralize cold ambient and excessive sunset casts; reduce excessive vibrance and saturation; strongly reduce artificial texture and clarity; soften excessive digital sharpness. Because the example analysis reports existing oversaturation and harsh microcontrast, the adaptive plan explicitly suppresses any saturation, vibrance, clarity, or texture increase. Keep detected sky and stone soft and believable with no HDR, crushed blacks, halos, or glowing edges.
```

The representative plan hash is `b9c76f1d76e6e9db2f414be90efeaff5a77ed737cb199a8d753697055546dbb8`. The exact generated prompt hash is `3ff2fbdd3291371169240917f2eb03a1fa7079fbef412a2a495bbc606308930c`.

### Example: bathroom

Representative selection: `casa-banio1`, source label `bathroom`; the example analysis detects circular flare, dark green marble, chrome, and wood.

```text
SELECTED DEVELOPMENT PROFILE
Profile: bathroom@1
Profile SHA-256: 02c2b5dbc0105b2683aaa6851587c02ced23b29441694608bc34fa117b18ea58
Selection reason: Matched alias "banio" in catalog ID: "casa banio1".
Source analysis label: bathroom
Prompt template: la-arbolada-photographic-development-v1

Increase exposure strongly; aggressively lift shadows beneath countertops, vanities, furniture, and in dark corners; strongly recover reflective highlights; restore moderate depth; use clean neutral-to-slightly-warm white balance; increase vibrance and controlled saturation strongly; add moderate-to-strong material texture, moderate clarity, and light sharpening. Enrich only detected real marble and wood, keep detected metal reflections physically believable, and remove only the detected optical flare or veiling glare. Reconstruct only obscured photographic detail already implied by surrounding pixels; do not redesign or invent architecture, fixtures, reflections, or materials.
```

The conditional optical-flare safety paragraph is omitted entirely when flare is not detected. The representative plan hash is `4a483c6c5ef9d3bbf072f8336f6abbf90f7a24b97978022b60856678f6bddbe1`. The exact generated prompt hash is `4e0f2a2883e1ca753faa4d833dc17a75f4423da16d8913bc410e279e8d140244`.

## Structural preservation retained in every prompt

Every profile-specific prompt preserves the exact scene, architecture, room layout, object count, furniture and fixture placement, openings, walls, roofs, floors, windows, doors, vegetation, paths, pool boundaries, horizon, people, clothing, materials, reflections, clouds, plant shapes, shadows, lighting direction, camera position, perspective, framing, lens, focal length, crop, proportions, and composition.

It prohibits adding, removing, replacing, relocating, redesigning, restaging, or beautifying physical objects; fake sunlight, lamps, landscaping, shadows, reflections, rays, HDR, or imaginary detail; new text, people, vehicles, furniture, plants, decorations, or building elements; inpainting, outpainting, warping, reframing, sky replacement, and weather replacement. If a requested adjustment risks a semantic or geometric change, Gemini is instructed not to apply that adjustment.

These prompt changes do not alter or lower the exact aspect-ratio gate, normalization safety, rotation/mirror/crop detection, SSIM, Edge SSIM, PSNR, histogram or luminance validation, coordinate identity, post-validation, human approval, or publication gate.

## Reports and audit data

Pipeline result JSON, Markdown processing reports, comparison cards, provider request metadata, derivative metadata, and pilot processing identity now retain, as applicable:

- selected profile ID, version, SHA-256, selection reason, and source analysis label;
- full structured development plan and its SHA-256;
- image-specific adaptations;
- exact final edit instruction and its SHA-256;
- prompt-template version.

No API key or sensitive request header is added to these records.

## Cache behavior

The existing analysis cache remains independently reusable. The image-edit request cache identity now includes:

- source SHA-256;
- global style-profile SHA-256;
- provider-edit contract version;
- analysis plus image-model identity;
- analysis/edit prompt versions;
- development-profile ID;
- development-profile version;
- development-profile content SHA-256;
- prompt-template version;
- structured-development-plan SHA-256.

Changing profile content, profile version, prompt-template version, or an image-specific structured plan invalidates the edit cache. Returned raster dimensions, normalization algorithm, and normalization version remain part of the downstream normalized identity. Locked images never obtain any cache identity.

## Tests added or extended

Regression coverage verifies:

- facade, patio, and bathroom profile selection;
- conservative default fallback;
- frontage, terrace, washroom, kitchen, lounge, sitting-room, bedroom, yard, and swimming-pool aliases;
- deterministic category extraction from the existing visual analysis with no additional request;
- conditional flare, grass, and marble instructions;
- protection from aggressive saturation when analysis reports oversaturation;
- the full structural-preservation prompt block;
- cache invalidation on profile content, profile version, prompt-template version, and plan changes;
- propagation of structured plans and profile audit fields into prompts, pipeline results, and reports;
- fail-closed selection for locked images;
- `PUBLIC_IMAGE_SET=original` and all existing locked-image protections.

The unchanged safety suite additionally re-verifies response cardinality, normalization, aspect ratio, rotation, mirroring, cropping, structural metrics ordering, post-validation, pilot gating, cache integrity, atomic review-state behavior, and deterministic output geometry.

## Validation results

| Command | Result |
| --- | --- |
| `npm run photos:test` | PASS — 50 tests, 50 passed, 0 failed, 0 skipped |
| `npm run check` | PASS — 75 files, 0 errors, 0 warnings, 0 hints |
| `npm run build` | PASS — static build completed; 3 routes generated |

## Operational confirmations

- Gemini calls: **0**
- Photographs processed: **0**
- Owner photographs uploaded: **0**
- Developed candidates regenerated: **0**
- Production assets modified or replaced: **0**
- Approval decisions changed: **0**
- Locked living-room images analyzed, edited, cached, compared, derived, or published: **0**
- `PUBLIC_IMAGE_SET`: **original**
- Push/deploy performed: **no**

READY FOR NEW SINGLE-IMAGE TEST
