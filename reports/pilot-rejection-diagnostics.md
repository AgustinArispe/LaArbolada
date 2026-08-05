# Pilot rejection diagnostics

Generated from existing pilot artifacts only. No provider request, development pass, derivative generation, threshold change, approval change, or workflow command was performed for this analysis.

## Executive conclusion

**Selected conclusions: D and E.**

- **D. Gemini post-validation is inconsistent.** Three candidates were assigned failing style scores even though the same validation response reported no violation, no overprocessing, no semantic or geometry concern, and described the rendering as natural, aligned, or minimally adjusted.
- **E. More than one issue exists.** The fireplace has a credible image-specific red-cast concern, while the other three failures are primarily conservative or internally inconsistent post-validation decisions. The evidence does not support treating all four as unsafe, nor does it support lowering any configured threshold.

All four rejected candidates passed every local quality and structural gate. The only common rejection mechanism was the deterministic style gate applying Gemini's post-validation scores: naturalness below 80 and profile match below 75. `casa-5casa` also had two Gemini-reported forbidden-style violations.

## Gates and thresholds

| Gate | Configured acceptance rule |
| --- | ---: |
| SSIM | at least 0.72 |
| Edge SSIM | at least 0.90 |
| PSNR | at least 18 dB |
| Average luminance change | at most 0.18 |
| Color histogram delta | at most 0.25 |
| Aspect-ratio delta | exactly 0 |
| Pixel dimensions | exactly equal |
| Geometry operator | none |
| Coordinate mapping | identity |
| Style naturalness | at least 80 |
| Style profile match | at least 75 |
| Post-validation flags | no semantic change, geometry change, overprocessing, or forbidden aesthetic violation |

### Actual local and style metrics

| Image | SSIM | Edge SSIM | PSNR dB | Luminance Δ | Histogram Δ | Aspect Δ | Naturalness | Profile match | Local result | Final result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `casa-5casa` | 0.995554 | 0.992479 | 31.1418 | 0.011927 | 0.110348 | 0 | 62 | 66 | Passed | Rejected |
| `casa-cocinacasa1` | 0.994304 | 0.995550 | 25.9903 | 0.033829 | 0.135423 | 0 | 70 | 68 | Passed | Rejected |
| `casa-patio11` | 0.999088 | 0.999145 | 31.6202 | 0.017433 | 0.068633 | 0 | 75 | 73 | Passed | Rejected |
| `casa-patio7` | 0.997860 | 0.995402 | 36.9399 | 0.003830 | 0.034579 | 0 | 75 | 73 | Passed | Rejected |
| `casa-fachada2` reference | 0.999057 | 0.998087 | 34.1165 | 0.007505 | 0.068949 | 0 | 98 | 98 | Passed | Passed |

Every candidate retained the original 4032×3024 dimensions, identity coordinate mapping, zero aspect-ratio change, and no geometry operator. No local metric was close to its rejection boundary.

## `casa-5casa` — detail / fireplace

1. **Exact rejection gates:** naturalness 62 < 80; profile match 66 < 75; forbidden violations `colors.wood.forbid: red cast` and `lighting.fakeLight: forbidden`.
2. **Metric context:** all local metrics passed: SSIM 0.995554 ≥ 0.72, edge SSIM 0.992479 ≥ 0.90, PSNR 31.1418 ≥ 18, luminance delta 0.011927 ≤ 0.18, histogram delta 0.110348 ≤ 0.25, aspect delta 0.
3. **Origin:** multiple style gates driven by Gemini post-validation; no local structural failure. The deterministic style evaluator correctly rejected the scores and violations it received.
4. **Actually applied:** exposure 0.1374; white balance 0.2779; contrast 0.1057; shadow recovery 0.3665; saturation 0.1652; vibrance 0.1349; color balance 0.2779; sharpening 0.2571; natural depth 0.1057; interior brightness 0.3665; vegetation color 0.1349; sky color 0.1907. Highlight recovery, noise reduction, local/micro contrast, and geometry operators remained inactive.
5. **Strongest adjustment:** shadow recovery and its interior-brightness alias, effective strength 0.3665. These aliases are combined by maximum strength locally, not added together.
6. **Provider reasoning:** open the dark hearth and mantle shadows, warm mixed daylight, protect the window, and restrain terracotta saturation. Its own risk flags warned that shadow lifting could look HDR-like and warming could accentuate red tiles.
7. **Local reasoning:** effective strengths were derived from measured luminance, color, dynamic range, and detail statistics; geometry was blocked. The record provides no more specific explanation for the resulting hearth hue.
8. **Visual assessment:** composition and structure are unchanged and no technical defect is visible. A subtle red/magenta emphasis inside the hearth is credible. The `fakeLight` finding is not supported by the comparison: no new source, ray, or changed lighting geometry is visible. Overall: **visually usable but with a genuine color concern, rejected partly correctly and partly conservatively**.
9. **Pattern:** primarily image-specific (terracotta, brick, deep warm shadows), compounded by the systemic inconsistency of the post-validator. It is not evidence of a general detail-category failure.
10. **Safest correction:** keep it unapproved for now. For any later corrective variant, reduce or decouple warm color balance in the hearth before reducing structural safeguards; do not lower thresholds or accept the unsupported fake-light claim without high-resolution human confirmation.

Compared with `casa-fachada2`, the fireplace had similarly strong development but a much larger projected-to-final style reversal: 91 to 66, versus 92 to 98 for the reference. Its local structure remained excellent; the credible difference is color behavior in warm masonry and shadow regions, not geometry or image integrity.

## `casa-cocinacasa1` — kitchen / mixed lighting

1. **Exact rejection gates:** naturalness 70 < 80 and profile match 68 < 75.
2. **Metric context:** SSIM 0.994304 ≥ 0.72, edge SSIM 0.995550 ≥ 0.90, PSNR 25.9903 ≥ 18, luminance delta 0.033829 ≤ 0.18, histogram delta 0.135423 ≤ 0.25, aspect delta 0. All local gates passed.
3. **Origin:** Gemini post-validation scores plus deterministic style thresholds; no forbidden rule, overprocessing flag, semantic concern, geometry concern, or local structural failure.
4. **Actually applied:** exposure 0.3068; white balance 0.4438; contrast 0.1057; local contrast 0.1513; micro contrast, sharpening, and texture clarity 0.3451; dynamic range 0.1311; shadow/interior recovery 0.4058; saturation 0.3528; vibrance 0.3055; color balance 0.4793; natural depth 0.1057; vegetation color 0.3944.
5. **Strongest adjustment:** color balance 0.4793, the highest effective single adjustment among the five pilot images. White balance at 0.4438 and shadow/interior recovery at 0.4058 were also substantial.
6. **Provider reasoning:** cool the heavy tungsten cast, neutralize whites and stone, control orange/red wood and floor tones, open under-counter shadows, and increase definition. Its risk flags specifically warned that excessive white-balance correction could make the terracotta floor cold or gray.
7. **Local reasoning:** strengths were activated from the image's measured channel imbalance, luminance, saturation, and detail activity. The local record confirms a large adaptive color correction but does not diagnose mixed illuminants by region.
8. **Visual assessment:** the developed candidate is brighter and noticeably more neutral/cool, but remains structurally identical and does not look technically defective or overtly overprocessed. The post-validator itself says the candidate maintains the natural architectural appearance. Overall: **visually acceptable but conservatively rejected, with a plausible mixed-light color-balance concern**.
9. **Pattern:** category-specific and systemic. Mixed-light interiors are more sensitive to global color correction; simultaneously, the validator assigned low scores with only 0.72 confidence and no concrete violation.
10. **Safest correction:** retain pending human review. If a later variant is authorized, reduce the global color/white-balance correction for mixed-light interiors or make it more conservative; keep all current thresholds unchanged.

Compared with `casa-fachada2`, this candidate changed luminance and histogram more, but still remained far inside every local limit. The decisive difference was Gemini's style score: projected 92 fell to 68, while the reference rose from projected 92 to final 98. The validation text does not explain that 30-point separation.

## `casa-patio11` — park

1. **Exact rejection gates:** naturalness 75 < 80 and profile match 73 < 75.
2. **Metric context:** SSIM 0.999088 ≥ 0.72, edge SSIM 0.999145 ≥ 0.90, PSNR 31.6202 ≥ 18, luminance delta 0.017433 ≤ 0.18, histogram delta 0.068633 ≤ 0.25, aspect delta 0. It exceeds the passed reference on both SSIM measures.
3. **Origin:** Gemini post-validation scores plus style thresholds only; no local, semantic, geometric, overprocessing, or forbidden-rule failure.
4. **Actually applied:** exposure 0.2599; white/color balance 0.2953; contrast/natural depth 0.1057; highlight/window/sunlight recovery 0.1913; saturation 0.1553; vibrance 0.2126; vegetation color 0.2905; sky color 0.2329; noise reduction 0.0992.
5. **Strongest adjustment:** white balance and color balance, both 0.2953; vegetation color followed at 0.2905.
6. **Provider reasoning:** preserve sunset character, warm cool greens slightly, lift lawn midtones, recover the horizon, and avoid yellow-green lawn. It projected a style score of 93.
7. **Local reasoning:** color and tonal strengths were derived from measured channel imbalance and image statistics; aliased highlight controls use their maximum rather than cumulative application.
8. **Visual assessment:** the comparison is nearly identical, with restrained warming and tonal refinement. No artifact, semantic change, geometry change, or overprocessing is apparent. Overall: **visually acceptable but rejected conservatively**.
9. **Pattern:** more systemic than image-specific. A single park sample cannot establish category bias, but the positive post-validation notes directly conflict with the failing scores.
10. **Safest correction:** do not reprocess it merely to satisfy these scores. Keep it pending for high-resolution human review and later improve validator consistency so a below-threshold score requires a concrete, reviewable defect.

Compared with `casa-fachada2`, its histogram delta is effectively the same (0.068633 versus 0.068949) and its structural similarity is slightly higher, yet it received 73/75 instead of 98/98. The artifacts provide no visual or numerical basis for that difference.

## `casa-patio7` — creek

1. **Exact rejection gates:** naturalness 75 < 80 and profile match 73 < 75.
2. **Metric context:** SSIM 0.997860 ≥ 0.72, edge SSIM 0.995402 ≥ 0.90, PSNR 36.9399 ≥ 18, luminance delta 0.003830 ≤ 0.18, histogram delta 0.034579 ≤ 0.25, aspect delta 0. It has the best PSNR and smallest luminance/histogram changes of the pilot.
3. **Origin:** Gemini post-validation scores plus style thresholds only; every local and semantic/geometry check passed.
4. **Actually applied:** exposure decrease 0.1262; white/color balance 0.2915; contrast/natural depth 0.1508; highlight/window/sunlight recovery 0.3482; saturation decrease 0.1980; vibrance decrease 0.1616; noise reduction 0.1459; vegetation color 0.2800. The three highlight-related report entries represent one maximum-combined tonal strength, not three cumulative passes.
5. **Strongest adjustment:** highlight recovery and its window/sunlight aliases at 0.3482.
6. **Provider reasoning:** recover gravel and sky highlights, restrain grass and marker saturation, warm cool daylight slightly, and preserve creek depth. It explicitly warned against excessive shadow lifting, which the local developer did not apply.
7. **Local reasoning:** measured highlights supported recovery; measured shadows did not activate shadow lifting. This is a good example of local analysis overriding an unnecessary adjustment safely.
8. **Visual assessment:** the developed candidate is extremely close to the original, with no visible technical or semantic defect. Gemini's own notes say the tonal rendering aligns well with the style and textures remain realistic. Overall: **visually acceptable but rejected conservatively**.
9. **Pattern:** systemic validator inconsistency is the strongest explanation. Creek-specific highlight and vegetation treatment does not appear unsafe.
10. **Safest correction:** retain for human review without reprocessing. Treat the contradictory post score as a validation-quality problem; do not weaken structural or style thresholds.

Compared with `casa-fachada2`, this image changed less by every pixel-difference measure and scored better on PSNR, yet failed the style scores. The reference had stronger effective vibrance and vegetation adjustment (0.3637) than this creek image's vegetation correction (0.2800), so adjustment magnitude alone cannot explain the rejection.

## Why `casa-fachada2` passed

The reference passed because both independent layers agreed:

- Local metrics passed: SSIM 0.999057, edge SSIM 0.998087, PSNR 34.1165 dB, luminance delta 0.007505, histogram delta 0.068949, exact dimensions and identity geometry.
- Gemini post-validation returned profile match 98, naturalness 98, color consistency 98, confidence 0.98, no violations, no overprocessing, and no semantic or geometry concern.
- Its strongest effective adjustments were vibrance and vegetation color at 0.3637, followed by saturation 0.2818 and white/color balance 0.2628.

The pass therefore does **not** show that low adjustment strength is required. `casa-fachada2` received stronger vegetation/vibrance development than either park/creek rejection and still scored 98. The material difference is the post-validator's favorable assessment, not a local structural metric or a single deterministic operator.

## Cross-image findings

### Repeated rejection causes

- Naturalness below 80 rejected all four.
- Profile match below 75 rejected all four.
- Local structural validation rejected none.
- Forbidden aesthetic violations appeared only for `casa-5casa`.
- No image was flagged overprocessed, underprocessed, semantically changed, or geometrically changed.

Thus no single forbidden rule caused most failures. Two score gates tied as the universal cause, both consuming Gemini's post-validation values.

### Repeated aggressive adjustments

- White/color balance appeared in all five images and was strongest in the kitchen (0.4793).
- Shadow/interior recovery was substantial in both interior/detail images (0.3665 and 0.4058).
- Vegetation correction appeared in every rejected image, even the fireplace because a small exterior patch was visible; however, the passed reference used the strongest vegetation correction (0.3637).
- Highlight/window/sunlight entries are aliases collapsed to one maximum tonal strength, so their repeated report rows do not indicate cumulative processing.

No single deterministic adjustment correlates with all failures. The kitchen's unusually strong global color balance and the fireplace's warm shadow treatment deserve image-specific caution, but they do not explain the park and creek failures.

### Validation inconsistencies

- Initial projected profile scores fell sharply for every rejection: fireplace 91→66, kitchen 92→68, park 93→73, creek 88→73. The reference moved 92→98.
- Naturalness similarly fell 82→62, 85→70, and 88→75 for the first three; the reference rose 88→98.
- Kitchen, park, and creek have positive validation notes with no violation but still receive failing scores.
- The least internally consistent cases also have lower post-validation confidence: kitchen 0.72 and park 0.70 versus reference 0.98.
- `casa-5casa`'s red-cast note is visually plausible, but its `fakeLight` violation lacks visible support.

### Category pattern

- Exterior reference: passed.
- Detail/fireplace: failed with a color-specific violation plus low scores.
- Mixed-light kitchen: failed low scores; plausible sensitivity to strong global color balance.
- Park and creek: failed low scores despite excellent local similarity and natural-looking comparisons.

With only one sample per category, this cannot prove category bias. It does show that the current post-validator is not calibrated consistently across interior, detail, park, creek, and exterior scenes.

## Recommended next action

Keep all four decisions pending and make no threshold or approval change from this diagnostic pass.

Before any new processing run, design a narrowly scoped validation-policy change for separate review:

1. Require a concrete rule violation or observable defect when post-validation assigns a failing style score.
2. Route contradictory, low-confidence responses—positive notes, no violations, but failing scores—to manual review rather than treating the score as self-explanatory.
3. Review the fireplace at full resolution for the red cast and the kitchen for excessive global color neutralization before authorizing any reduced-strength variant.
4. Do not change SSIM, edge SSIM, PSNR, luminance, histogram, naturalness, or profile-match thresholds based on this five-image sample.

This recommendation preserves the conservative safety posture while addressing the actual weakness demonstrated by the artifacts: inconsistent Gemini post-validation, plus two image-specific color-development concerns.
