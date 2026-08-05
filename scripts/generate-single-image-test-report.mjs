import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from './photo-workflow-lib.mjs';

const targetId = process.argv[2] ?? 'casa-fachada2';
const metricsPath = path.join(root, 'reports', 'gemini-metrics.json');
const cachePath = path.join(root, '.photo-work', 'cache', 'source-index.json');
const outputRoot = path.join(root, 'reports', 'single-image-test', targetId);
const reportPath = path.join(root, 'reports', 'single-image-test.md');
const [metrics, cache] = await Promise.all([
  fs.readFile(metricsPath, 'utf8').then(JSON.parse),
  fs.readFile(cachePath, 'utf8').then(JSON.parse),
]);
const result = metrics.results.find((item) => item.catalogId === targetId);
if (!result) throw new Error(`No single-image result exists for ${targetId}.`);
const requestIdentity = result.cacheIdentity?.components?.requestCacheIdentitySha256;
const entry = cache.entries?.[requestIdentity];
if (!entry) throw new Error(`No cache evidence exists for ${targetId}.`);

const original = result.originalDimensions;
const returned = result.providerOutputDimensions;
const originalAspect = original.width / original.height;
const returnedAspect = returned.width / returned.height;
const relativeAspectDelta = Math.abs(returnedAspect - originalAspect) / originalAspect;
const theoreticalScale = {
  horizontal: original.width / returned.width,
  vertical: original.height / returned.height,
};
const conclusion = 'SINGLE IMAGE TEST FAILED — PIPELINE FIX REQUIRED';
const stoppedReason = result.error;

const analysis = {
  schemaVersion: 1,
  catalogId: targetId,
  sourceSha256: result.cacheIdentity.components.sourceSha256,
  styleProfileSha256: result.cacheIdentity.components.styleProfileSha256,
  provider: entry.providerMetadata?.provider,
  model: entry.providerMetadata?.analysis?.model,
  requestId: entry.providerMetadata?.analysis?.requestId ?? null,
  promptVersion: entry.promptVersion,
  promptSha256: entry.promptSha256,
  analysisPlanSha256: entry.analysisPlanSha256,
  visualAnalysis: entry.visualAnalysis,
  developmentPlan: entry.developmentPlan,
  deterministicPlan: entry.analysisPlan,
};
const editRequestMetadata = {
  schemaVersion: 1,
  catalogId: targetId,
  sourceSha256: result.cacheIdentity.components.sourceSha256,
  styleProfileSha256: result.cacheIdentity.components.styleProfileSha256,
  requestCacheIdentity: entry.requestCacheIdentity,
  normalizationCacheIdentity: entry.cacheIdentity,
  analysisModel: entry.providerMetadata?.analysis?.model,
  imageModel: entry.providerMetadata?.editing?.model,
  requestedAspectRatio: '4:3',
  promptVersion: entry.editPromptVersion,
  promptSha256: entry.editPromptSha256,
  response: entry.providerMetadata?.editing,
  credentialsIncluded: false,
};
const postValidation = {
  schemaVersion: 1,
  catalogId: targetId,
  status: 'not-run',
  reason: stoppedReason,
  providerRequests: 0,
};
const structuralMetrics = {
  schemaVersion: 1,
  catalogId: targetId,
  status: 'not-run',
  reason: 'Pre-normalization exact-aspect gate failed.',
  originalDimensions: original,
  providerOutputDimensions: returned,
  originalAspectRatio: Number(originalAspect.toFixed(9)),
  providerOutputAspectRatio: Number(returnedAspect.toFixed(9)),
  relativeAspectRatioDelta: Number(relativeAspectDelta.toFixed(9)),
  normalizationRequired: true,
  normalizationApplied: false,
  normalizationAlgorithm: entry.normalization?.algorithm,
  theoreticalNonUniformScale: theoreticalScale,
  ssim: null,
  edgeSsim: null,
  psnrDb: null,
  colorHistogramDelta: null,
  averageLuminanceChange: null,
  coordinateMapping: 'rejected-before-normalization',
};

await fs.mkdir(outputRoot, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(outputRoot, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`),
  fs.writeFile(
    path.join(outputRoot, 'edit-request-metadata.json'),
    `${JSON.stringify(editRequestMetadata, null, 2)}\n`,
  ),
  fs.writeFile(
    path.join(outputRoot, 'post-validation.json'),
    `${JSON.stringify(postValidation, null, 2)}\n`,
  ),
  fs.writeFile(
    path.join(outputRoot, 'metrics.json'),
    `${JSON.stringify(structuralMetrics, null, 2)}\n`,
  ),
]);

const markdown = `# Casa La Arbolada single-image Gemini test

Tested: ${metrics.generatedAt}  
Target: **${targetId}**  
Execution mode: **single image**  
Production publication: **blocked**

## Identity

| Field | Value |
| --- | --- |
| Image ID | \`${targetId}\` |
| Source | \`assets-raw/CASA ARBOLADA/fachada2.HEIC\` |
| Source SHA-256 | \`${result.cacheIdentity.components.sourceSha256}\` |
| Gemini analysis model | \`${entry.providerMetadata.analysis.model}\` |
| Gemini image model | \`${entry.providerMetadata.editing.model}\` |
| Style profile | \`casa-la-arbolada@1.0.0\` |
| Style SHA-256 | \`${result.cacheIdentity.components.styleProfileSha256}\` |
| Logical API requests | **${metrics.providerRequests.total}** — ${metrics.providerRequests.analysis} analysis, ${metrics.providerRequests.editing} image edit, ${metrics.providerRequests.postValidation} post-validation |
| HTTP attempts | **${metrics.providerRequests.httpAttempts}** |

## Raster result

| Field | Value |
| --- | --- |
| Returned MIME type | \`${result.providerOutputMimeType}\` |
| Original dimensions | **${original.width}×${original.height}** |
| Gemini-returned dimensions | **${returned.width}×${returned.height}** |
| Original aspect ratio | **4:3 (${originalAspect.toFixed(9)})** |
| Returned aspect ratio | **75:56 (${returnedAspect.toFixed(9)})** |
| Relative aspect delta | **${(relativeAspectDelta * 100).toFixed(6)}%** |
| Normalization required | **Yes, because dimensions differ** |
| Normalization applied | **No — exact-aspect gate rejected the raster first** |
| Scaling factor | Not applied. Horizontal would be ${theoreticalScale.horizontal.toFixed(6)}× and vertical ${theoreticalScale.vertical.toFixed(6)}×, proving that uniform resampling is impossible. |

## Stop result

The pipeline stopped immediately with:

> ${stoppedReason}

The request explicitly declared \`4:3\`, but the API returned 1200×896. Mapping that raster to 4032×3024 would require non-uniform stretching, cropping, or padding. The pipeline correctly refused all three.

- MIME and JPEG decoding: **passed**
- Exact aspect ratio: **failed**
- Orientation/rotation/mirror/crop correlation: **not run after the decisive aspect failure**
- Deterministic normalization: **not run**
- SSIM, edge SSIM, PSNR, histogram, luminance, coordinate mapping: **not run**
- Post-development validation: **not run**
- Policy outcome: **PIPELINE STOPPED / REJECTED**
- Human approval: **pending; no automatic approval was recorded**

## Preserved artifacts

| Artifact | Path | Status |
| --- | --- | --- |
| Exact provider input | \`${result.originalArtifactPath}\` | Preserved |
| Exact Gemini raster | \`${result.providerOutputPath}\` | Preserved; SHA-256 \`${result.providerOutputSha256}\` |
| Normalized JPEG | \`.photo-work/provider-edits/${requestIdentity}/normalized.jpg\` | Intentionally absent |
| Final comparison | \`reports/gemini-comparisons/${targetId}.jpg\` | No new comparison generated; existing legacy file was not modified |
| Analysis JSON | \`reports/single-image-test/${targetId}/analysis.json\` | Generated from cached provider response |
| Edit request metadata | \`reports/single-image-test/${targetId}/edit-request-metadata.json\` | Generated without credentials |
| Post-validation JSON | \`reports/single-image-test/${targetId}/post-validation.json\` | Records required stop before post-validation |
| Metrics JSON | \`reports/single-image-test/${targetId}/metrics.json\` | Records geometry failure and skipped metrics |
| Pipeline metrics | \`reports/gemini-metrics.json\` | Preserved |

## Safety confirmation

- \`PUBLIC_IMAGE_SET=original\` remained active.
- No source photograph was overwritten.
- The existing processed master and legacy comparison both predate this test and were not modified.
- No derivatives or production replacements were generated.
- The three locked living-room images and all 12 protected published variants passed their SHA-256 checks and remained untouched.
- The five-image pilot and full workflow were not run.
- Gemini was not retried after the structural stop.
- Nothing was pushed or deployed.

## Blocking defect

The real provider does not produce mathematically exact 4:3 pixels for this request: its nominal 4:3 output is 1200×896. Under the mandatory no-crop, no-pad, no-stretch contract, that raster cannot be normalized to 4032×3024. A policy or provider-contract change is required before another paid pilot run; silently accepting the mismatch would weaken the structural guarantee.

${conclusion}
`;
await fs.writeFile(reportPath, markdown);
console.log(path.relative(root, reportPath));
