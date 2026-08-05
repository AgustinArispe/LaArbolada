# Casa La Arbolada single-image Gemini test

Tested: 2026-07-23T18:21:17.952Z  
Target: **casa-fachada2**  
Execution mode: **single image**  
Production publication: **blocked**

## Identity

| Field                 | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Image ID              | `casa-fachada2`                                                    |
| Source                | `assets-raw/CASA ARBOLADA/fachada2.HEIC`                           |
| Source SHA-256        | `fdebe099044743c22ba5b51b823c2385521b7ff6bdf9d6d9789daa7a5d976ee3` |
| Gemini analysis model | `gemini-3.6-flash`                                                 |
| Gemini image model    | `gemini-3.1-flash-image`                                           |
| Style profile         | `casa-la-arbolada@1.0.0`                                           |
| Style SHA-256         | `52466a31d0b61f4b8c0dd29b5129efc0ade6e04c296589a9b6a33eeda2e0b4ce` |
| Logical API requests  | **2** — 1 analysis, 1 image edit, 0 post-validation                |
| HTTP attempts         | **2**                                                              |

## Raster result

| Field                      | Value                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Returned MIME type         | `image/jpeg`                                                                                                      |
| Original dimensions        | **4032×3024**                                                                                                     |
| Gemini-returned dimensions | **1200×896**                                                                                                      |
| Original aspect ratio      | **4:3 (1.333333333)**                                                                                             |
| Returned aspect ratio      | **75:56 (1.339285714)**                                                                                           |
| Relative aspect delta      | **0.446429%**                                                                                                     |
| Normalization required     | **Yes, because dimensions differ**                                                                                |
| Normalization applied      | **No — exact-aspect gate rejected the raster first**                                                              |
| Scaling factor             | Not applied. Horizontal would be 3.360000× and vertical 3.375000×, proving that uniform resampling is impossible. |

## Stop result

The pipeline stopped immediately with:

> Provider raster aspect ratio differs from the original (1200x896 vs 4032x3024); normalization rejected.

The request explicitly declared `4:3`, but the API returned 1200×896. Mapping that raster to 4032×3024 would require non-uniform stretching, cropping, or padding. The pipeline correctly refused all three.

- MIME and JPEG decoding: **passed**
- Exact aspect ratio: **failed**
- Orientation/rotation/mirror/crop correlation: **not run after the decisive aspect failure**
- Deterministic normalization: **not run**
- SSIM, edge SSIM, PSNR, histogram, luminance, coordinate mapping: **not run**
- Post-development validation: **not run**
- Policy outcome: **PIPELINE STOPPED / REJECTED**
- Human approval: **pending; no automatic approval was recorded**

## Preserved artifacts

| Artifact              | Path                                                                                                              | Status                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Exact provider input  | `.photo-work/provider-edits/e704f3993edea16750859698b4cd1f22bbe9e8074b994930090cb118593787ab/original.jpg`        | Preserved                                                                             |
| Exact Gemini raster   | `.photo-work/provider-edits/e704f3993edea16750859698b4cd1f22bbe9e8074b994930090cb118593787ab/gemini-returned.jpg` | Preserved; SHA-256 `c09806df901d3190b22973f1e387f91d178367e4dc7569a14c0ba3771aa8214d` |
| Normalized JPEG       | `.photo-work/provider-edits/e704f3993edea16750859698b4cd1f22bbe9e8074b994930090cb118593787ab/normalized.jpg`      | Intentionally absent                                                                  |
| Final comparison      | `reports/gemini-comparisons/casa-fachada2.jpg`                                                                    | No new comparison generated; existing legacy file was not modified                    |
| Analysis JSON         | `reports/single-image-test/casa-fachada2/analysis.json`                                                           | Generated from cached provider response                                               |
| Edit request metadata | `reports/single-image-test/casa-fachada2/edit-request-metadata.json`                                              | Generated without credentials                                                         |
| Post-validation JSON  | `reports/single-image-test/casa-fachada2/post-validation.json`                                                    | Records required stop before post-validation                                          |
| Metrics JSON          | `reports/single-image-test/casa-fachada2/metrics.json`                                                            | Records geometry failure and skipped metrics                                          |
| Pipeline metrics      | `reports/gemini-metrics.json`                                                                                     | Preserved                                                                             |

## Safety confirmation

- `PUBLIC_IMAGE_SET=original` remained active.
- No source photograph was overwritten.
- The existing processed master and legacy comparison both predate this test and were not modified.
- No derivatives or production replacements were generated.
- The three locked living-room images and all 12 protected published variants passed their SHA-256 checks and remained untouched.
- The five-image pilot and full workflow were not run.
- Gemini was not retried after the structural stop.
- Nothing was pushed or deployed.

## Blocking defect

The real provider does not produce mathematically exact 4:3 pixels for this request: its nominal 4:3 output is 1200×896. Under the mandatory no-crop, no-pad, no-stretch contract, that raster cannot be normalized to 4032×3024. A policy or provider-contract change is required before another paid pilot run; silently accepting the mismatch would weaken the structural guarantee.

SINGLE IMAGE TEST FAILED — PIPELINE FIX REQUIRED
