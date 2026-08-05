# Photo-processing production readiness audit

Audit date: 2026-07-23  
Scope: repository implementation, current configuration, existing cached/report artifacts, and synthetic local tests only.  
External Gemini requests: **0**  
Owner photographs processed: **0**

## Executive conclusion

The access controls, locked-image protections, response rejection logic, cache identity, pilot selection, and full-run gate are strong. The repository is not ready to spend production credits, however, because the current Gemini output-size contract conflicts with the pipeline's exact-dimension and exact-aspect structural gates.

All five configured pilot sources are 4032×3024. The configured edit request does not set an output size or aspect ratio. Google's current documentation states that `gemini-3.1-flash-image` defaults to the 1K output tier and exposes predefined dimensions rather than arbitrary source dimensions. Its documented 4:3 1K output is 1200×896, not 4032×3024 and not an exact 4:3 ratio. The repository correctly rejects any dimension difference and has `maximumAspectRatioDelta` set to zero. Therefore, documented API behavior is expected to consume an editing request and then fail the local structural gate.

Two additional production blockers were confirmed:

1. `policy.preserveMetadata` is `true`, but the provider-raster JPEG conversion strips EXIF and orientation metadata.
2. Cache and approval state writes are atomic, but processing reports, derivative images, and derivative manifests are not transactional or atomically published as a complete set.

The current website remains safe: `PUBLIC_IMAGE_SET=original`, no owner image was sent, and all 12 locked website variants still match their protected SHA-256 values.

## Official Gemini API verification

Primary official sources checked on 2026-07-23:

- [Gemini 3.1 Flash Image model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image)
- [Current Gemini image generation and editing guide](https://ai.google.dev/gemini-api/docs/image-generation)
- [Generate Content image guide — legacy API](https://ai.google.dev/gemini-api/docs/generate-content/image-generation)
- [GenerateContentResponse reference](https://ai.google.dev/api/generate-content)

Findings:

- `gemini-3.1-flash-image` is a currently documented **stable** model. It accepts text and image input and returns image and text output.
- `.env` does not explicitly set `GEMINI_IMAGE_MODEL`, but `.env.example` defines it and runtime correctly falls back to `photo-processing/config.json`, where it is `gemini-3.1-flash-image`.
- The current primary Google guide uses `POST https://generativelanguage.googleapis.com/v1beta/interactions` with `model`, `input`, and `response_format`.
- The repository uses `POST https://generativelanguage.googleapis.com/v1/models/{model}:generateContent`. Google still documents this exact endpoint and payload under its **Legacy** Generate Content guide. It is not an invented or currently invalid endpoint, but it is not the primary current API path.
- For the selected legacy endpoint, the repository request format is correct: `contents[].parts[]`, inline base64 image data, and `generationConfig.responseModalities: ["IMAGE"]`.
- The response parser matches the legacy response format: `candidates[].content.parts[].inlineData`.
- The parser does not surface `promptFeedback`, `finishReason`, or `safetyRatings`; a blocked/no-image result still fails closed, but its diagnostic reason will be generic.
- No `responseFormat.image.aspectRatio` or `imageSize` is sent. The documented default is 1K, which is incompatible with the five 4032×3024 pilot inputs under the repository's exact-dimension policy.
- Google states that generated images include SynthID. This remains a provider-level characteristic and should be accepted explicitly before production use.

## Checklist findings

### 1. Configured Gemini image model and API

Status: **WARNING**

- Model name: verified stable and supported.
- Environment override: available but absent from the current `.env`; the configured fallback is valid.
- Endpoint: officially documented but under Google's Legacy Generate Content path.
- Request and response shape: correct for that legacy endpoint.
- Mismatch: repository documentation and adapter are built around legacy `generateContent`, while Google's current main guide now prefers `v1beta/interactions` and a different response shape.
- Critical configuration omission: no output size/aspect format is requested.

### 2. Image-editing response handling

Status: **PASS**

Verified by code inspection, the 32-test suite, and additional synthetic mocked responses:

| Case | Result |
| --- | --- |
| No image | Rejected |
| More than one final image | Rejected |
| Text only | Rejected |
| Different dimensions | Marked non-identity and rejected by structural validation |
| Undecodable bytes | Rejected by Sharp before persistence |
| Unsupported declared MIME | Rejected |
| Declared/decoded MIME mismatch | Rejected |
| Thought/intermediate images only | Ignored; absence of one final raster is rejected |

The provider also rejects malformed base64, empty rasters, and output larger than 40 MB.

### 3. Raster integrity

Status: **FAIL**

What passes:

- The raw Gemini raster is written byte-for-byte through a temporary file and atomic rename.
- The local conversion performs no resize and no crop.
- JPEG dimensions exactly match the **provider raster** dimensions.
- The local conversion explicitly targets sRGB and uses fixed JPEG settings (`quality: 98`, 4:4:4, mozjpeg). Sharp is locked to 0.35.3 in `package-lock.json`, making the conversion reproducible in the current environment.
- Dimension and aspect mismatches against the provider input are rejected.

Blocking findings:

- Exact source dimensions are not requested from Gemini and are not one of the documented arbitrary output options. All pilot sources are 4032×3024; documented model output uses size tiers such as 1K, 2K, and 4K.
- With `maximumAspectRatioDelta: 0`, even the documented nominal 4:3 tier dimensions do not meet the repository's exact ratio requirement.
- `preserveMetadata: true` is not honored. A synthetic raster containing EXIF orientation was converted to JPEG with `outputHasExif: false` and no output orientation.
- The raw provider raster preserves provider metadata, but the candidate/master path does not preserve source EXIF, capture metadata, or an explicit embedded metadata policy.

### 4. Cache identity

Status: **PASS**

The main cache SHA-256 identity changes when any required component changes:

- source SHA-256
- style profile SHA-256
- analysis model (part of the combined provider model identity)
- image model (part of the combined provider model identity)
- analysis/edit prompt version
- raster processor version (stored in the legacy-named `developerVersion` identity component)

Reuse additionally requires:

- matching cache identity
- matching processor version
- matching developed JPEG SHA-256
- matching raw provider-raster SHA-256
- `processorKind === "provider-image-edit"`
- matching post-analysis prompt version before post-analysis reuse

Remaining risk: the cached full-resolution provider-input JPEG is keyed only by source SHA. A future change to HEIC decoding, JPEG preparation quality, or color preprocessing must also bump the processor/prompt identity deliberately; the input file itself has no separate preparation-version identity.

### 5. Locked images

Status: **PASS**

Protected IDs:

- `casa-livingcasa`
- `casa-livingcasa3`
- `casa-mesalivingcasa4`

Controls verified:

- All 12 published locked variants match their configured SHA-256 values.
- Locked decisions are forced to `skipped` and cannot enter the approved processing batch.
- Runtime selection requires `!record.locked`.
- `verifySource()` fails closed if passed a locked record.
- Provider analysis/editing occurs only after locked filtering.
- Comparisons and cache entries are created only inside the selected runtime path.
- Derivative generation independently rejects locked records.
- The website always retains original locked sources even if `PUBLIC_IMAGE_SET=processed` is selected.

The locked photographs cannot reach analysis, editing, cache, comparison, derivatives, or processed publication through the audited pipeline.

### 6. Pilot gating

Status: **PASS**

- The approval batch currently contains 54 approved, matched, unlocked records and excludes the three locks.
- Pilot mode intersects that approved set with exactly five configured pilot IDs.
- The selected runtime pilot set resolves to the expected five IDs only.
- Pilot composition enforces five records, exterior coverage, vegetation coverage, sky coverage, and a non-locked interior.
- Provider upload requires both the approval batch and explicit `--confirm-upload`.
- Full mode is currently blocked.
- All five pilot approval states are `pending`.
- Full mode requires every current pilot result to have a valid master SHA and an explicit approval matching that SHA.

### 7. Reports

Status: **WARNING**

The report implementation records or links:

- original provider-input preview
- edited JPEG candidate
- side-by-side comparison
- SSIM, edge SSIM, PSNR, luminance, histogram, dimensions, and semantic checks
- provider and request metadata
- raw provider-raster path, MIME type, and SHA-256
- cache identity and style identity
- policy outcome and reasoning
- approval controls backed by `reports/photo-pilot-review-state.json`

Warnings:

- Existing `gemini-*` reports are legacy pilot artifacts from the prior deterministic implementation. They currently identify `gemini-3.6-flash` and do not prove the new raster-editing path.
- Metrics, Markdown, and comparison-dashboard HTML are written directly, not by temporary-file rename. Interruption can leave a truncated or mutually inconsistent report set.
- Approval state is available through the dashboard and its separate JSON file, but it is not embedded as an immutable snapshot in `gemini-metrics.json`.
- The report writer can merge existing same-style results without requiring the same processor/model identity. A partial future run can therefore retain stale results unless every relevant catalog ID is replaced.

### 8. Rollback safety

Status: **FAIL**

What passes:

- Current `.env` has `PUBLIC_IMAGE_SET=original`.
- The processing pipeline never rewrites current production image references.
- Edited files use `public/images-processed/`; owner originals and current published WebPs are separate.
- Locked images always remain on their approved original website sources.

Blocking finding:

- `PUBLIC_IMAGE_SET` is read through `import.meta.env` during the Astro build. Switching it back to `original` requires a rebuild and redeployment; it is not an immediate runtime rollback flag.
- If a processed build were deployed, the code switches every non-locked catalog record to processed paths without consulting per-image approvals or derivative availability at runtime.

### 9. Error recovery and atomicity

Status: **FAIL**

Atomic or fail-safe components:

- cache index JSON: temporary file + rename, with serialized cache writes
- raw provider raster: unique temporary file + rename
- developed JPEG: unique temporary file + rename
- pilot review state: unique temporary file + rename
- general review state and processing batch: temporary file + rename
- processed master: temporary copy + rename, preventing partial master bytes

Non-atomic or non-transactional components:

- `gemini-metrics.json`, processing Markdown, and comparison-dashboard HTML use direct writes
- responsive WebP/AVIF files and blur placeholders write directly to final paths
- derivative manifests use direct writes
- side-by-side comparison images write directly to final paths
- the processed master is promoted before the derivative set and reports complete; a later failure leaves a new master with an incomplete or old derivative/report set
- there is no transaction marker or atomic directory/version swap for a complete image result
- interruption after receiving and writing a provider raster but before indexing it can leave an orphaned artifact; interruption before raster persistence can require paying for the edit again

Approvals are protected from partial JSON corruption, but reports and derivative sets are not fully crash-consistent.

### 10. Production readiness

Status: **FAIL**

The pipeline is safe against accidental publication and unsafe provider responses, but it is not cost-safe or artifact-consistent enough for the first paid raster pilot under its current invariants.

## Final subsystem table

| Subsystem | Classification | Production finding |
| --- | --- | --- |
| Gemini model | PASS | Stable `gemini-3.1-flash-image` confirmed in official model documentation. |
| API endpoint and wire format | WARNING | Correct for officially documented Legacy `generateContent`; current main guide prefers Interactions API. |
| Response cardinality and MIME validation | PASS | Zero, text-only, multiple, unsupported, malformed, and undecodable outputs fail closed. |
| Raster dimensions and aspect | FAIL | Documented size-tier output conflicts with exact 4032×3024 and zero aspect-delta gates. |
| Local raster conversion | WARNING | No resize/crop and deterministic sRGB JPEG, but source/provider metadata is stripped. |
| Cache identity and reuse | PASS | All required identity components and both raster hashes are checked. |
| Locked-image isolation | PASS | Three IDs and 12 published variants are protected across all stages. |
| Pilot selection and full-run gate | PASS | Exactly five pilot IDs selected; full run blocked; approvals pending and mandatory. |
| Reporting completeness | WARNING | Required data is represented, but current artifacts are legacy and writes are non-atomic. |
| Rollback | FAIL | Originals are active, but rollback is build-time rather than immediate runtime. |
| Crash recovery | FAIL | Cache/approvals/master bytes are atomic; reports and derivative sets are not transactional. |
| Overall production readiness | FAIL | Paid pilot is expected to fail structural dimensions and lacks complete artifact atomicity. |

## Validation performed

- `npm run photos:test`: **32/32 passed**; all provider calls in tests were mocked.
- `npm run check`: **0 errors, 0 warnings, 0 hints**.
- `npm run build`: **passed**, three static pages generated.
- Additional synthetic-only checks passed for no image, text-only, multiple images, unsupported MIME, decode failure, dimension mismatch, provider-raster/JPEG dimension preservation, and all cache identity components.
- Locked-file verification: **3 IDs / 12 variants passed SHA-256**.
- Current cache SHA-256 remained `a4ca9fe6bdd9346f76c7a0b525bf04df3843f9d1ea4a6b5fb69bec12c56dc9c0`.
- Gemini requests: **0**.
- Owner photographs processed: **0**.

## Required recommendations before spending credits

1. Resolve the output-dimension contract. Decide explicitly whether to permit a deterministic no-crop resample back to source dimensions, relax the exact-dimension/aspect invariant, or use a service capable of returning exact source dimensions. Merely requesting 4K will not reproduce 4032×3024 exactly.
2. Make metadata policy truthful: either preserve the required EXIF/ICC fields in masters or change the declared policy and document intentional stripping. Orientation must be handled explicitly.
3. Make reports and derivative publication atomic as a complete result set, and keep the previous processed version until every new artifact and manifest validates.
4. Provide a genuinely immediate rollback mechanism if that remains a requirement; the current static build flag requires rebuild/redeploy.
5. Either migrate the image-edit adapter to the current Interactions API and its response shape or explicitly accept the legacy endpoint with a documented compatibility policy and contract tests.
6. Regenerate raster-era reports only after the blockers above are resolved; current reports are valid historical artifacts but not evidence for the new editing implementation.
7. Consider surfacing `promptFeedback`, `finishReason`, `safetyRatings`, response model version, and usage metadata so paid failures are diagnosable.

The known dimension failure is enough to block even a paid single-image execution: the system would likely spend the editing credit and then reject the documented default-size output. The metadata and crash-consistency findings independently block a five-image production pilot.

## NOT READY
