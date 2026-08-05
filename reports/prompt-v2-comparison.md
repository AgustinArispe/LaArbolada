# Casa La Arbolada prompt v2 single-image comparison

Test date: 2026-07-23  
Target: **`casa-fachada2`**  
Mode: **single image**  
Production publication: **blocked / unchanged**

## Execution result

Exactly one target was submitted through the existing production single-image command:

```text
npm run photos:gemini-single -- --confirm-upload --target=casa-fachada2
```

No five-image pilot or full workflow was run. The source was approved, matched, unlocked, SHA-verified, and protected by `PUBLIC_IMAGE_SET=original` before upload.

The execution made **2 logical Gemini requests / 2 HTTP attempts**:

- analysis: 1
- image editing: 1
- post-validation: 0

The provider returned one decodable JPEG, but the existing exact-aspect-ratio gate stopped the workflow:

> Provider raster aspect ratio differs from the original (1200x896 vs 4032x3024); normalization rejected.

This is the same safe stop encountered by the earlier API result. The v2 raster was preserved exactly, but no normalization, SSIM, Edge SSIM, PSNR, histogram comparison, luminance comparison, coordinate mapping, post-validation, derivative, approval, or publication was produced.

## Important comparison limitation

The repository contains one earlier paid Gemini raster for this target. Its recorded edit-prompt version is **`la-arbolada-gemini-raster-development-v1`**, which predates the later **`la-arbolada-photographic-development-v1`** template. There is no paid raster in the repository produced by `la-arbolada-photographic-development-v1`.

Therefore, this report compares the only real previous API raster with the new `la-arbolada-photographic-development-v2` raster. It does not mislabel the earlier raster as a profile-v1 result.

The new run also made a fresh analysis request, as reported by the unchanged pipeline. The code change under evaluation was limited to the edit-prompt template, but provider nondeterminism and the newly returned analysis plan prevent a scientifically isolated text-only A/B attribution. The visual and pixel comparison remains useful, but subtle differences cannot be attributed exclusively to wording with absolute confidence.

## Raster identity and validation

| Field | Original | Previous API result | New v2 API result |
| --- | --- | --- | --- |
| Role | Canonical provider input | Exact raw Gemini raster | Exact raw Gemini raster |
| Dimensions | 4032×3024 | 1200×896 | 1200×896 |
| Aspect ratio | 4:3 · 1.333333333 | 75:56 · 1.339285714 | 75:56 · 1.339285714 |
| MIME | image/jpeg | image/jpeg | image/jpeg |
| File size | 5,657,319 bytes | 923,346 bytes | 931,914 bytes |
| SHA-256 | `23041963285fe56468313697eed29f703b0503a81db35e125d9e4d417c7ea1d7` | `c09806df901d3190b22973f1e387f91d178367e4dc7569a14c0ba3771aa8214d` | `7200c86157ce5cb511c57916960669b3ab4e7e492df00d5c6c2289bdef25613e` |
| Normalization | Not applicable | Rejected before normalization | Rejected before normalization |
| Structural validation | Canonical reference | Failed exact aspect-ratio gate; remaining gates not run | Failed exact aspect-ratio gate; remaining gates not run |
| Prompt version | Not applicable | `la-arbolada-gemini-raster-development-v1` | `la-arbolada-photographic-development-v2` |

Visual page: [`reports/prompt-v2-comparison.html`](prompt-v2-comparison.html)

## Preserved artifacts

### Original provider input

`.photo-work/provider-edits/0d0e38b5d606c1e9e479df3bc03e6fced386ea5c311a7e1b876d7f290f3b7e13/original.jpg`

### Previous raw Gemini raster

`.photo-work/provider-edits/e704f3993edea16750859698b4cd1f22bbe9e8074b994930090cb118593787ab/gemini-returned.jpg`

### New v2 raw Gemini raster

`.photo-work/provider-edits/0d0e38b5d606c1e9e479df3bc03e6fced386ea5c311a7e1b876d7f290f3b7e13/gemini-returned.jpg`

### Normalized images

Neither run has a `normalized.jpg`. Both stopped before normalization because uniform resampling to 4032×3024 is impossible without stretching, cropping, or padding.

### Current pipeline records

- `reports/gemini-metrics.json`
- `reports/gemini-processing-report.md`
- `.photo-work/cache/source-index.json`

The v2 cache record retains edit prompt SHA-256 `29a7c1563278bf709ac4357a617e54d57f786b5f186d1b7c01bf142b23484a4a`, structured-plan SHA-256 `d54631b9d39bf5c1b1ae1a586d11568a9038f4ce3267c782a9fd9deb1e75aab0`, raw raster SHA-256, MIME, dimensions, provider metadata, and the geometry-rejected status.

## Quantitative v1/v2 comparison

The two Gemini rasters share identical dimensions and can be compared directly without normalization.

- Mean absolute channel delta: **5.494 / 255**
- Root-mean-square channel delta: **8.606 / 255**
- Maximum local channel delta: **165 / 255**
- Differing decoded channel values: **90.649%**
- Pixel data identical: **no**

The broad visual development remains close despite many small local pixel differences.

| Region | Luminance change, v2−previous | HSV saturation change | Shadow-pixel change | Edge-energy change |
| --- | ---: | ---: | ---: | ---: |
| Full frame | +0.812 / 255 | +0.888 pp | −0.410 pp | +0.197 |
| Sky | −0.838 / 255 | −1.454 pp | 0 pp | +0.032 |
| Grass | +2.884 / 255 | +1.713 pp | −0.940 pp | +0.295 |
| House | −0.327 / 255 | +1.693 pp | +0.195 pp | +0.247 |
| Stone | −0.249 / 255 | +3.594 pp | +0.159 pp | +0.335 |

The full-frame mean RGB moved from **136.526 / 140.822 / 112.377** to **138.577 / 141.541 / 110.465**. This is a small warmer shift: red increased, blue decreased, and mean luminance rose by less than one 8-bit level.

## Objective photographic assessment

### Exposure

**Slight increase, not a meaningful step change.** Full-frame luminance rose only 0.812/255. Grass brightened more noticeably (+2.884), while the house region became fractionally darker (−0.327). The v2 prompt did not produce the intended strong global exposure lift relative to the prior API result.

### Shadow recovery

**Small, uneven improvement.** The proportion of dark full-frame pixels fell by 0.410 percentage points and grass shadows fell by 0.940 points. House and stone shadow pixels increased slightly. This is not the strong, architecture-focused shadow recovery requested by the façade profile.

### Highlight recovery

**Slight regression.** Pixels above the diagnostic highlight threshold increased from 0.758% to 0.925% overall and from 1.612% to 1.962% in the house region. No obvious large clipped patch appears in the visual review, but the measurements do not show stronger highlight recovery.

### White balance

**Warmer, but only subtly.** V2 adds approximately +2.05 red and −1.91 blue globally. The house loses about 2.95 blue levels. The shift is consistent with a warmer development direction and remains visually plausible, though it also pushes stone somewhat yellower.

### Grass rendering

**Slightly richer and brighter.** Grass luminance rises 2.884/255, saturation rises 1.713 percentage points, and dark pixels decrease. The change is visible on close comparison but remains modest. It trends toward warmer olive/yellow-green rather than a distinctly deeper emerald separation.

### Sky rendering

**No improvement; mild regression against the stated direction.** Sky luminance falls 0.838/255, saturation falls 1.454 points, red increases, and blue decreases. Cloud/edge energy changes by only +0.032. V2 does not deepen the existing blue or reveal meaningfully more cloud detail relative to the previous raster.

### Stone texture

**Small increase in color and microcontrast.** Stone saturation rises 3.594 points and edge energy rises 0.335. The added richness is measurable, but most of it comes from reduced blue, creating a warmer/yellower stone rendering. Texture remains believable and no obvious halos are visible at the comparison scale.

### Wood richness

**No meaningful visible improvement.** The limited exterior wood/window areas remain very close between the two outputs. The global warmer balance affects them slightly, but there is no clear independent wood-development gain.

### Local contrast

**Slight increase.** Full-frame edge energy rises about 1.6%, with a roughly 2.3% increase in the selected stone region. This is directionally consistent with the v2 brief but not a substantial change.

### Clarity

**Slight increase without an obvious artifact.** Fine detail appears marginally firmer, consistent with the edge measurements. No obvious crunchy sharpening or halo regression is visible, but the improvement is subtle.

### Realism

**Broadly preserved.** V2 remains photographically plausible and does not look dramatically HDR-processed. The warmer/yellower stone and grass treatment is a small potential regression, while the increased color and detail remain restrained.

### Architectural preservation

**No obvious redesign is visible between the previous and v2 rasters, but formal preservation did not pass.** Major walls, roof lines, openings, windows, stone base, trees, paths, and foreground rocks appear in the same locations in the two API outputs. However, both outputs have a non-identical aspect ratio relative to the original, so the production pipeline correctly rejected them before rotation, mirror, crop correlation, SSIM, Edge SSIM, and coordinate-mapping checks. Architectural preservation therefore cannot be certified as passed.

## Regressions

- V2 does not deliver a materially stronger exposure lift.
- House and stone shadows are fractionally worse despite a small full-frame shadow improvement.
- High-luminance pixel incidence rises rather than falls.
- The sky becomes slightly less saturated and less blue.
- Stone and grass shift warmer/yellower, which may be less neutral than intended.
- The same 1200×896 aspect-ratio failure prevents normalization and full structural/post-validation assessment.

## Safety and publication confirmation

- Only `casa-fachada2` was targeted.
- No pilot or full workflow ran.
- The exact original input and exact v2 provider raster are preserved separately.
- No source photograph was overwritten.
- No normalized image was fabricated after the geometry rejection.
- Human approval remains pending; no automatic approval occurred.
- `PUBLIC_IMAGE_SET=original` remains active.
- No production image reference or asset was replaced.
- Locked living-room images were not processed.
- No retry or additional Gemini run was started after the safe failure.
- Nothing was pushed or deployed.

## Conclusion

The v2 request produces a measurable but small warmer, slightly more saturated and slightly more detailed rendition. Those differences are not large enough to match the owner's substantially stronger manual development, and the sky/highlight behavior shows minor regressions. Because both outputs also fail the same aspect-ratio gate, v2 provides no production-readiness improvement in this test.

PROMPT V2 SHOWS NO MEANINGFUL IMPROVEMENT
