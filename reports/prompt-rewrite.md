# Gemini photographic-development prompt rewrite

Generated: 2026-07-23

## Scope

This change rewrites only the Gemini image-editing instruction assembled by `buildEditPrompt()` and advances its prompt-template identity from `la-arbolada-photographic-development-v1` to `la-arbolada-photographic-development-v2`.

No pipeline stage, API call, provider request shape, validation rule, structural threshold, normalization behavior, approval rule, cache implementation, report implementation, owner photograph, or production asset was changed. The template-version advance uses the cache identity behavior that already existed; no cache code or policy was modified.

## Editing philosophy extracted from the successful manual directions

The repository's successful façade, patio, and bathroom descriptions share a practical retouching method:

1. Start with a decisive tonal correction rather than a vague request to make the image better.
2. State the required strength: strong exposure lift, aggressive shadow recovery, controlled highlight recovery, moderate clarity, and light finishing sharpness where appropriate.
3. Correct white balance and color deliberately, with different treatment for each photographed material.
4. Push the development far enough to be visibly useful while naming the failure modes that define the limit: clipping, fluorescent color, halos, crushed blacks, artificial HDR, and synthetic texture.
5. Reverse the treatment when the source already has too much contrast, saturation, clarity, or sharpness, as in the patio direction.
6. Apply material and optical corrections only when the existing analysis confirms that the relevant content is visible.
7. Treat architecture, objects, landscaping, perspective, framing, and composition as locked scene content rather than retouching variables.

The new prompt generalizes that method into reusable retoucher language. It does not copy the owner descriptions literally.

## Previous prompt

The previous template was accurate but read primarily as a safety and metadata envelope. Its operative development direction was comparatively brief, while the structured plan appeared as raw JSON.

```text
ROLE
You are performing professional photographic development for a real-estate listing. Apply the requested tonal, color, exposure, and texture development to the supplied photograph. Treat this as photographic retouching, not scene generation.

PRIMARY TASK
Apply the following photographic development to the supplied photograph. Follow the stated natural-language direction and intensity for exposure, shadow lift, highlight recovery, contrast, white balance, vibrance, saturation, texture, clarity, sharpness, and material rendering. These are photographic directions, not literal Lightroom slider values.

SELECTED DEVELOPMENT PROFILE
Profile: <profile ID>@<profile version>
Profile SHA-256: <profile hash>
Selection reason: <selection reason>
Source analysis label: <analysis label>
Prompt template: la-arbolada-photographic-development-v1

STRUCTURED PHOTOGRAPHIC DEVELOPMENT PLAN JSON
<serialized structured plan>

IMAGE-SPECIFIC OBSERVATIONS JSON
<serialized analysis observations>

STRUCTURAL PRESERVATION — MANDATORY
Preserve the exact scene, architecture, room layout, object count, furniture placement, and fixture placement. Preserve all openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon exactly as supplied. Preserve every person, face, item of clothing, physical object, material, reflection, cloud, plant shape, shadow direction, light direction, and existing texture.

Do not add, remove, replace, relocate, redesign, restage, or beautify physical objects. Do not change camera position, perspective, framing, lens, focal length, crop, proportions, or composition. Do not create fake sunlight, fake lamps, fake landscaping, fake shadows, fake reflections, fake rays, artificial HDR, or imaginary details. Do not add text, people, vehicles, furniture, plants, decorations, or building elements. Do not inpaint, outpaint, warp, reframe, or replace sky or weather.

If any requested photographic adjustment risks a semantic or geometric change, do not apply that adjustment.

STYLE IDENTITY
Casa La Arbolada style: <style ID>@<style version>
Style SHA-256: <style hash>
Category: <category>

OUTPUT
Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.
```

## New prompt

The new template converts every applicable structured-plan adjustment into a direct retouching instruction and renders only confirmed visible-material treatments. Angle-bracketed values below are filled from the existing profile and analysis data at runtime.

```text
PHOTOGRAPHIC DEVELOPMENT ASSIGNMENT
Develop this existing photograph as a senior architectural and luxury real-estate retoucher working in Lightroom and Photoshop. Apply photographic development to the supplied pixels. Do not generate a scene. Do not redesign, beautify, restage, or reinterpret the property.

WORKING STANDARD
Execute the requested development assertively. Make every strong or aggressive correction clearly effective; do not dilute it into a timid, barely perceptible adjustment. Keep every correction photographic, controlled, and material-aware. Build luminosity with exposure and shadow recovery, protect highlights, establish professional white balance, create clean local contrast, reveal real texture, and develop rich but natural color. Avoid HDR rendering, halos, clipped channels, crushed blacks, excessive clarity, excessive saturation, and synthetic sharpness.

Apply the following photographic development to the supplied photograph.
Treat each intensity and direction as a retoucher's instruction, not as a literal Lightroom slider value. Adapt the exact strength to the existing pixels while preserving the requested visual impact.

- exposure: <intensity> / <direction>. <imperative profile instruction>
- shadows: <intensity> / <direction>. <imperative profile instruction>
- highlights: <intensity> / <direction>. <imperative profile instruction>
- contrast: <intensity> / <direction>. <imperative profile instruction>
- whiteBalance: <intensity> / <direction>. <imperative profile instruction>
- vibrance: <intensity> / <direction>. <imperative profile instruction>
- saturation: <intensity> / <direction>. <imperative profile instruction>
- texture: <intensity> / <direction>. <imperative profile instruction>
- clarity: <intensity> / <direction>. <imperative profile instruction>
- sharpness: <intensity> / <direction>. <imperative profile instruction>

VISIBLE-MATERIAL DEVELOPMENT
Develop only materials confirmed by the existing image analysis. Do not introduce a material-specific instruction for anything that is not visible.
<only the applicable stone, stucco, concrete, wood, marble, metal, grass, trees/vegetation, sky, glass, water, ceramics, and fabric instructions>

<conditional optical-development section, emitted only when an optical artifact was detected>

IMAGE-SPECIFIC CALIBRATION
Use these observations to place the corrections, protect areas already correct, and avoid compounding existing excess. Do not use them as permission to alter content.
<existing analysis assessment and applicable observations>

PROFILE CONTROL
Profile: <profile ID>@<profile version>
Profile SHA-256: <profile hash>
Selection reason: <selection reason>
Source analysis label: <analysis label>
Prompt template: la-arbolada-photographic-development-v2

DEVELOP THE PHOTOGRAPH; LOCK THE SCENE
Preserve the exact scene, architecture, room layout, object count, furniture placement, and fixture placement. Preserve all openings, walls, roofs, floors, windows, doors, fixtures, vegetation, paths, pool boundaries, and the horizon exactly as supplied. Preserve every person, face, item of clothing, physical object, material, reflection, cloud, plant shape, shadow direction, light direction, and existing texture.

Do not add, remove, replace, relocate, redesign, restage, or beautify physical objects. Do not change camera position, perspective, framing, lens, focal length, crop, proportions, or composition. Do not create fake sunlight, fake lamps, fake landscaping, fake shadows, fake reflections, fake rays, artificial HDR, or imaginary details. Do not add text, people, vehicles, furniture, plants, decorations, or building elements. Do not perform scene or object inpainting, outpainting, warping, reframing, sky replacement, or weather replacement.

If any photographic-development operation risks a semantic or geometric change, do not apply that adjustment. Preserve the existing photograph instead.

STYLE IDENTITY
Casa La Arbolada style: <style ID>@<style version>
Style SHA-256: <style hash>
Category: <category>

DELIVERY
Complete one decisive, professional photographic development of this exact existing photograph. Return exactly one final edited raster image of the exact same photograph. Do not return text, variants, alternate developments, or alternate compositions.
```

## Material-specific development language

The prompt now emits concrete development instructions only for materials positively identified by the existing analysis:

| Visible material | Development direction |
| --- | --- |
| Stone | Reveal existing mineral grain and tonal variation; add clean local contrast without halos or invented detail. |
| Stucco/render | Refine white balance and highlight roll-off; reveal moderate natural texture while preserving every surface transition. |
| Concrete | Neutralize unwanted casts; reveal restrained real texture and preserve wear and tonal variation. |
| Wood | Warm and deepen existing wood; reveal grain without making it orange, red, glossy, or newly refinished. |
| Marble | Deepen existing color; reveal real veining and control highlights without changing pattern or reflectance. |
| Metal | Neutralize contamination; refine highlights and microcontrast while preserving real reflections. |
| Grass | Deepen dull grass toward rich natural green while preserving density, dry areas, hue variation, and blade patterns. |
| Trees/vegetation | Separate existing foliage with natural green balance and open shadows while preserving all geometry and density. |
| Sky | Recover existing highlights and blue; reveal only real cloud detail without weather or atmosphere changes. |
| Glass | Recover highlights and tonal separation while preserving reflections, transparency, views, frames, and edges. |
| Water | Refine existing color and highlights while preserving ripples, reflections, boundaries, transparency, and depth cues. |
| Ceramics | Correct white balance and glossy highlights; keep whites bright but unclipped and preserve fixture detail. |
| Fabric | Refine tonal separation and restrained texture while preserving weave, folds, color, wear, and contours. |

If a material is absent, its material-development instruction is omitted. Optical-flare correction is likewise omitted unless flare or veiling glare was positively detected by the existing analysis.

## Reasoning

The earlier prompt depended on Gemini interpreting a large structured JSON object as a retouching brief. Although auditable, that presentation gave the model little editorial hierarchy: safety language dominated, while the actual photographic moves were easy to treat as advisory.

The rewrite changes that balance without removing any safety rule:

- It opens with a professional retoucher role rather than generic AI framing.
- It uses direct verbs—develop, increase, recover, lift, deepen, warm, neutralize, reveal, refine, reduce, preserve, and never—throughout the operational sections.
- It explicitly instructs Gemini not to weaken strong or aggressive corrections into subtle changes.
- It translates structured profile fields into readable working instructions instead of passing the plan only as raw JSON.
- It separates tonal development, visible-material development, image-specific calibration, scene locking, and delivery so the model can prioritize the work.
- It defines realism by photographic failure limits rather than by asking for a weak edit.
- It retains every architecture, geometry, object, vegetation, perspective, crop, framing, and composition prohibition.

## Expected behavioral differences

| Previous behavior | Expected behavior from the rewritten request |
| --- | --- |
| Generic or timid global correction | Clearly executed exposure, shadow, white-balance, contrast, color, and detail development at the stated strength |
| Raw plan interpreted as optional metadata | Each plan entry presented as a direct retoucher instruction |
| Broad material treatment | Independent treatment only for materials confirmed visible |
| Safety language implicitly encouraging minimal change | Strong photographic development explicitly separated from immutable scene content |
| Risk of flat shadows and weak color response | More decisive shadow recovery and richer controlled color where the selected profile requests it |
| Risk of uniformly strong treatment | Existing oversaturation, brightness, or microcontrast still reverses or suppresses the corresponding increase |
| Generic polish | Category-specific Lightroom/Photoshop development decisions derived from the owner-approved editing philosophy |

## Why this should produce stronger photographic development

Gemini now receives an ordered retouching brief rather than an abstract desired appearance. It is told what to do to exposure, shadows, highlights, color balance, local contrast, texture, and each confirmed material; how strongly to do it; and exactly where realism imposes the stopping boundary. The request explicitly distinguishes decisive pixel development from forbidden scene manipulation, allowing stronger photographic corrections without relaxing structural preservation.

## Verification

- `npm run photos:test`: **PASS — 50/50 tests**
- Gemini calls: **0**
- Photographs processed: **0**
- Existing pipeline stages added or removed: **0**
- Validation, normalization, approval, cache, and report implementations changed: **no**
- Production assets changed: **0**
- Push or deploy performed: **no**
