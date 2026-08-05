# Adaptive architectural photo-development workflow

This is a source-to-image photo-development pipeline, not an unconstrained image-generation flow.

Gemini first analyzes an approved source and returns schema-validated JSON with an adaptive development plan. The same approved source and that constrained plan are then sent to the Gemini Image Editing API, which must return exactly one edited raster. Three roles are stored separately: `original.jpg` is the exact provider input, `gemini-returned.<mime extension>` preserves the provider bytes unchanged, and `normalized.jpg` is the only raster allowed into metrics, comparisons, post-validation, derivatives, and human review.

## Exact-photograph guarantee

The editing prompt forbids adding, removing, moving, redrawing, inpainting, outpainting, cropping, rotating, resizing, warping, or replacing content. Because a model-produced raster cannot provide the same mathematical guarantee as deterministic local operators, every result remains fail-closed behind local structural metrics, Gemini comparison validation, and explicit human approval.

- Any aspect-ratio mismatch, rotation, mirroring, or crop signal is an automatic structural rejection before normalization.
- A dimension-only mismatch with exact aspect identity is uniformly resampled to the original dimensions with deterministic Lanczos3. No crop, padding, stretch, framing change, or AI upscaling is allowed.
- Geometry-changing operators are blocked unless a future implementation has a verified camera/lens profile and can prove identity framing. With the current sources they are reported as not applied.
- Sky and vegetation corrections are limited to existing blue/green pixel colors. No masks create pixels or alter shapes.
- Every full-run batch entry is developed. An adjustment may remain at zero only when combined AI and pixel analysis says it is already correct.
- Every output is still human-review-only and never activates website references automatically.

## Photographic-development profiles

The immutable editorial style remains global, while `photo-processing/profiles/` defines distinct, versioned photographic-development direction for façade, patio, bathroom, kitchen, living room, bedroom, garden, pool, and a conservative default. These JSON files describe exposure, shadows, highlights, contrast, white balance, vibrance, saturation, texture, clarity, sharpness, material priorities, conditional actions, and prohibitions as natural-language retouching directions—not literal Lightroom sliders.

Profile selection is deterministic and auditable. It maps the existing catalog/analysis category and aliases to a profile, records the source label and selection reason, and falls back to `default` when uncertain. No additional provider request is made for selection. Locked records fail before profile selection.

For each source, the existing Gemini analysis still returns all supported advisory adjustments with `apply`, `direction`, `reason`, and a relative need from 0 to 1. Local logic combines those observations with the selected repository profile to create a structured development plan. Conditional directions are activated only when the analysis identifies their subject: for example, flare cleanup requires detected optical flare, and grass or marble treatment requires that material to be present. Existing oversaturation, excessive microcontrast, or already-bright exposure suppresses the corresponding aggressive increase.

The image-edit request begins with “Apply the following photographic development to the supplied photograph,” embeds the structured plan and image-specific observations, and reiterates every scene-preservation restriction. It never asks Gemini merely to improve or enhance the scene.

Supported development operations include exposure, white balance, contrast, local/micro contrast, dynamic range, highlight/shadow recovery, natural saturation/vibrance, color balance, noise reduction, sharpening, texture clarity, natural depth, window/interior balance, and color-only vegetation/sky/sunlight development.

## Provider abstraction

The pipeline imports `providers/provider.mjs`, never Gemini directly. Provider adapters implement:

```js
createProvider(context) => {
  name,
  analysisModel,
  imageModel,
  mode: 'image-editing',
  returnsImagePixels: true,
  analyze(request),
  edit(request),
  validateDevelopment(request)
}
```

Adapters that do not implement all three stages or return exactly one supported raster are rejected before the result can enter quality control.

Gemini uses the Interactions API for JSON Schema analysis and the official `generateContent` image-editing endpoint for the raster. Retry with exponential backoff covers HTTP 429, 500, and 503.

Official documentation:

- <https://ai.google.dev/gemini-api/docs/image-understanding>
- <https://ai.google.dev/gemini-api/docs/structured-output>
- <https://ai.google.dev/gemini-api/docs/generate-content/image-generation#image_editing>
- <https://ai.google.dev/gemini-api/docs/troubleshooting>

## Locked images

These owner-approved production images are permanently excluded from analysis, upload, editing, comparison, caching, derivatives, batches, and replacement:

- `casa-livingcasa`
- `casa-livingcasa3`
- `casa-mesalivingcasa4`

Their 12 published WebP hashes are verified before validation or processing.

## Approval and full-run rule

The dashboard writes `reports/photo-processing-batch.json`. The batch must contain every currently approved, matched, unlocked image exactly once. Duplicate, missing, stale, skipped, manual-editing, ambiguous, unmatched, or locked records cause a fail-closed error.

Pilot mode processes the approved pilot intersection. Full mode refuses to start unless every approved batch image passes the safety gate and is selected.

## Configuration

```sh
PHOTO_PROVIDER=gemini
PHOTO_CONCURRENCY=3
GEMINI_API_KEY=
GEMINI_ANALYSIS_MODEL=gemini-3.6-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

The key is needed only for uncached runtime analysis, editing, or post-validation. Validation, checks, and builds do not require it.

## Cache

Analysis reuse remains keyed by source SHA-256, style hash, analysis contract/model, and analysis-prompt version. The image-edit request identity additionally includes the image model, development-profile ID, profile version, profile content SHA-256, prompt-template version, and structured-development-plan SHA-256. Any profile content, version, template, or image-specific plan change invalidates the edit cache without forcing a redundant analysis request.

The normalized result identity additionally includes the returned raster dimensions, normalization algorithm, and normalization version. Changing normalization invalidates the normalized result while retaining an unchanged, SHA-verified raw provider raster for offline renormalization without another upload.

Cache and provider-input files remain under ignored `.photo-work/`. Originals remain read-only.

## Quality validation

Each result records:

- Selected development profile, version, content hash, source analysis label, and selection reason
- Structured photographic-development plan, its SHA-256, and activated image-specific adaptations
- Exact final image-edit instruction and prompt-template version
- Adjustments applied, direction, estimated adaptive intensity, and reason
- Source measurements and provider scene assessment
- Raw Gemini raster path, MIME type, request metadata, and SHA-256
- Original, Gemini-returned, and final dimensions; normalization requirement, algorithm, version, scale factor, and direction
- SSIM and edge-structure SSIM
- PSNR
- Average luminance change
- Color histogram delta
- Pre-normalization aspect, rotation, mirror, and crop validation plus final dimension and coordinate-map invariants
- Review and semantic-validation status

A geometry invariant failure rejects before normalization. SSIM, edge SSIM, PSNR, histogram, luminance, and coordinate-map metrics are computed only between the canonical original and `normalized.jpg`.

## Commands

```sh
npm run photos:gemini
npm run photos:gemini-pilot -- --confirm-upload
npm run photos:gemini-full -- --confirm-upload
```

`photos:gemini` is validation/report scaffolding only. Pilot/full require the approval batch, API key, and explicit confirmation.

## Outputs

Accepted candidates produce:

- JPEG processed master under `public/images-processed/<property>/`
- Responsive WebP
- Responsive AVIF
- Blur WebP placeholder
- Side-by-side comparison under `reports/gemini-comparisons/`

Reports:

- `reports/gemini-processing-report.md`
- `reports/gemini-metrics.json`
- `reports/gemini-comparisons.html`

Current published assets are never modified or automatically replaced.
