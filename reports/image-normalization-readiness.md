# Image-normalization production readiness

Audit date: 2026-07-23  
Scope: deterministic raster ingestion and normalization implementation, synthetic tests, static checks, and production build only.  
Gemini requests: **0**  
Owner photographs processed: **0**

## Outcome

The pipeline now accepts a Gemini-edited raster at a different supported resolution without weakening its structural thresholds. The original provider input remains the canonical geometry. Any returned raster must pass decode, MIME, exact aspect-ratio, orientation, rotation, mirror, and crop checks before deterministic normalization can begin.

A returned raster whose dimensions differ but whose aspect and geometry pass is uniformly resampled to the original width and height with Sharp/libvips Lanczos3. The operation performs no crop, padding, stretch, framing change, or AI upscaling. All SSIM, edge SSIM, PSNR, histogram, luminance, coordinate-map, and final dimension checks compare the original provider input with the normalized JPEG—not the raw Gemini raster.

The first live use should remain a single-image test. Synthetic coverage proves the engineering contract, but one real provider result is still required to verify Gemini's returned aspect behavior and calibrate confidence in the pre-normalization crop/transform detector before spending five-image pilot credits.

## Artifact separation

Each provider edit has an isolated directory under `.photo-work/provider-edits/<request-cache-sha>/`:

| Artifact                                  | Role                                                                     | Byte handling                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| `original.jpg`                            | Exact JPEG submitted to Gemini and canonical geometry reference          | Written byte-for-byte and SHA-256 recorded    |
| `gemini-returned.png`, `.jpg`, or `.webp` | Exact raster returned by Gemini; extension follows decoded/declared MIME | Written byte-for-byte and SHA-256 recorded    |
| `normalized.jpg`                          | Deterministic, full-size sRGB JPEG used by every downstream stage        | Created only after geometry validation passes |

The raw provider bytes are never overwritten by normalization. A geometry-rejected result retains `original.jpg` and `gemini-returned.<ext>` for diagnosis but does not create `normalized.jpg`.

## Processing order

1. Verify the approved, unlocked source and its SHA-256.
2. Create or reuse the exact provider-input JPEG.
3. Request exactly one edited raster.
4. Validate raster size, declared MIME, decoded MIME, and decodability.
5. Persist the exact original input and exact provider response separately.
6. Require exact source/returned aspect identity and canonical EXIF orientation.
7. Compare structural edge hypotheses for identity, rotation, mirroring, and representative crop transforms.
8. Reject any credible non-identity transform or crop.
9. If necessary, uniformly resample with Lanczos3 to the original dimensions.
10. Require the normalized raster to have the exact original dimensions.
11. Compute local quality and structural metrics using only the original and normalized files.
12. Run post-development validation using only the original and normalized files.
13. Continue to reports, derivatives, and mandatory human approval under the existing policy.

## Geometry policy

| Condition                                                        | Result                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| Invalid, empty, oversized, unreadable, or MIME-mismatched raster | Immediate rejection                                   |
| No returned image, multiple images, or text-only response        | Immediate rejection in provider adapter               |
| Aspect ratio differs by any amount                               | Immediate rejection; no normalization                 |
| Non-canonical EXIF orientation                                   | Immediate rejection                                   |
| Rotation hypothesis is materially stronger than identity         | Immediate rejection                                   |
| Mirror hypothesis is materially stronger than identity           | Immediate rejection                                   |
| Crop hypothesis is materially stronger than full-frame identity  | Immediate rejection                                   |
| Same dimensions and valid geometry                               | Deterministic JPEG conversion; no resampling          |
| Different dimensions, exact aspect, valid geometry               | Uniform Lanczos3 normalization to original dimensions |

No SSIM, edge SSIM, PSNR, histogram, luminance, aspect, semantic, or post-validation thresholds were changed. Human approval and the full-run pilot gate are unchanged.

## Official API compatibility

The edit request now declares the source's exact supported aspect ratio through `generationConfig.imageConfig.aspectRatio`; the editing prompt is unchanged. A source ratio outside the supported set fails before upload so the provider cannot silently crop or pad it. Returned resolution remains provider-controlled and may be smaller, larger, or equal to the source.

## Cache behavior

The cache now has two identities:

- The request identity covers source SHA-256, style SHA-256, analysis and image model identity, prompt versions, and the provider-edit contract version.
- The normalized-result identity additionally covers the decoded returned raster width and height, `lanczos3`, and `provider-raster-normalization-v1`.

Changing the normalization algorithm or version invalidates `normalized.jpg`, its cache identity, and its post-validation response. When the exact raw provider raster still passes its SHA-256 check, the pipeline reuses it and performs normalization offline without another Gemini edit request. Geometry-rejected raw responses are also indexed so a retry does not spend another editing request merely to reproduce the same rejection.

## Reporting

Processing JSON, Markdown, derivative metadata, and the comparison dashboard now carry:

- original dimensions
- Gemini-returned dimensions
- whether normalization was required
- normalization algorithm and version
- final dimensions
- uniform scaling factor
- `upscaled`, `downscaled`, or `none`
- geometry-validation result and hypothesis scores
- original, returned, and normalized artifact paths and hashes where applicable

The dashboard comparison and post-analysis input use `normalized.jpg` exclusively.

## Regression coverage

Synthetic regression tests cover:

- returned image smaller than original
- returned image larger than original
- returned image at the same dimensions
- different aspect ratio
- rotated raster
- mirrored raster
- cropped raster
- exact preservation of the raw Gemini-returned bytes
- separate original/returned/normalized artifacts
- normalization cache invalidation by dimensions, algorithm, and version
- metrics refusing to run before normalization and geometry validation
- exact normalized output dimensions and identity coordinate mapping
- existing lock, pilot, post-validation, and provider-response safeguards

## Validation results

| Command               | Result                               |
| --------------------- | ------------------------------------ |
| `npm run photos:test` | PASS — 40/40 tests                   |
| `npm run check`       | PASS — 0 errors, 0 warnings, 0 hints |
| `npm run build`       | PASS — three static pages built      |

Additional safeguards confirmed:

- No Gemini request was made.
- No owner photograph was decoded, normalized, compared, or processed.
- No prompt or approval logic changed.
- No quality or structural threshold changed.
- `PUBLIC_IMAGE_SET` remains `original`.
- Published website assets were not replaced.
- Locked living-room protections remain in the processing path.
- No push or deployment occurred.

## Remaining live risk

Rotation, mirror, and crop rejection uses deterministic multi-hypothesis structural edge correlation. The synthetic cases pass, but the first real Gemini raster may reveal provider-specific behavior—especially slight nominal-aspect rounding or an edit strong enough to lower structural correlation. The pipeline will fail closed in either case. A single paid image is therefore the correct next boundary: inspect its exact raw dimensions and geometry diagnostics before authorizing the five-image pilot.

READY FOR SINGLE IMAGE TEST
