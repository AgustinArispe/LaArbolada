import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from '../scripts/photo-workflow-lib.mjs';

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function displayScore(value) {
  return typeof value === 'number' ? Math.round(value) : '—';
}

function displayConfidence(value) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';
}

function formatViolation(violation) {
  if (typeof violation === 'string') return `${violation} (legacy label; unsupported)`;
  const evidence = violation?.evidence ? ` Evidence: ${violation.evidence}` : ' No evidence.';
  return `${violation?.ruleId ?? 'unknown-rule'}: ${violation?.description ?? 'No description.'}${evidence} Confidence: ${displayConfidence(violation?.confidence)}.`;
}

function policyOutcome(result) {
  return result.policyOutcome ?? result.postDecision?.outcome ?? 'REJECT';
}

function decisionSources(decision) {
  const gates = decision?.gates ?? {};
  const sources = [];
  if (gates.localStructuralGate?.failed) sources.push('local structural gate');
  if (gates.semanticGate?.failed) sources.push('semantic gate');
  if (gates.geometryGate?.failed) sources.push('geometry gate');
  if (gates.overprocessingGate?.failed) sources.push('overprocessing gate');
  if (gates.concreteVisualDefect?.failed) sources.push('concrete visual defect');
  if (gates.forbiddenViolation?.failed) sources.push('forbidden violation');
  if (gates.scoreThreshold?.failed) sources.push('score threshold');
  if (gates.contradictionManualReview?.routed) sources.push('contradiction/manual-review routing');
  return sources;
}

function relativeFromReport(reportPath, targetPath) {
  return path
    .relative(path.dirname(reportPath), path.join(root, targetPath))
    .split(path.sep)
    .join('/');
}

function resultScores(result) {
  const initial = result.visualAnalysis ?? {};
  const final = result.postAnalysis?.styleValidation ?? {};
  return {
    current: initial.currentStyleMatchScore,
    projected: initial.projectedStyleMatchScore,
    profile: final.profileMatchScore,
    naturalness: final.naturalnessScore ?? initial.naturalnessScore,
    color: final.colorConsistencyScore ?? initial.colorConsistencyScore,
    luxury: initial.luxuryEditorialScore,
    confidence: final.confidence ?? initial.confidence,
  };
}

function dimensions(value) {
  return value?.width && value?.height ? `${value.width}×${value.height}` : '—';
}

function card(result, comparisonsPath, pilotState) {
  const scores = resultScores(result);
  const outcome = policyOutcome(result);
  const decisionDetails = result.postDecision ?? {};
  const providerRaster = result.processorKind === 'provider-image-edit';
  const original = result.originalPreviewPath
    ? relativeFromReport(comparisonsPath, result.originalPreviewPath)
    : null;
  const developed = result.developedPreviewPath
    ? relativeFromReport(comparisonsPath, result.developedPreviewPath)
    : null;
  const comparison = result.comparisonPath
    ? relativeFromReport(comparisonsPath, result.comparisonPath)
    : null;
  const adjustments = (result.adjustments ?? [])
    .filter((item) => item.applied)
    .map(
      (item) =>
        `<li><div><strong>${escapeHtml(item.operation.replaceAll('_', ' '))}</strong><span>${Math.round(item.intensity * 100)}% → ${Math.round(item.estimatedIntensity * 100)}%</span></div><p>${escapeHtml(item.reason)}</p><small>Provider-relative → local-effective. ${escapeHtml(item.developerReason)} · ${escapeHtml(item.styleRule)}</small></li>`,
    )
    .join('');
  const providerAdjustments = Object.entries(result.developmentPlan?.adjustments ?? {})
    .map(
      ([name, item]) =>
        `<li><div><strong>${escapeHtml(name)}</strong><span>${item.apply ? `${Math.round(item.relativeStrength * 100)}%` : 'unchanged'}</span></div><p>${escapeHtml(item.reason)}</p><small>${escapeHtml(item.styleRule)}</small></li>`,
    )
    .join('');
  const warnings = [
    ...(result.developmentPlan?.riskFlags ?? []),
    ...(result.postAnalysis?.styleValidation?.violations ?? []).map(formatViolation),
    ...(result.postDecision?.reasons ?? []),
  ];
  const defects = decisionDetails.concreteDefects ?? [];
  const legacyViolations = decisionDetails.legacyViolations ?? [];
  const contradictions = decisionDetails.contradictionFlags ?? [];
  const sources = decisionSources(decisionDetails);
  const decision = pilotState?.decisions?.[result.catalogId]?.status ?? 'pending';
  const normalization = result.normalization;
  const requestedImageOutput =
    result.requestedImageOutput ?? result.provider?.editing?.requestedImageOutput ?? null;
  const rasterDetails = providerRaster
    ? `<dl class="raster"><div><dt>Original</dt><dd>${escapeHtml(dimensions(result.originalDimensions))}</dd></div><div><dt>Gemini returned</dt><dd>${escapeHtml(dimensions(result.providerOutputDimensions))}</dd></div><div><dt>Requested</dt><dd>${escapeHtml(`${result.requestedImageModel ?? '—'} · ${requestedImageOutput?.aspectRatio ?? '—'} · ${requestedImageOutput?.imageSize ?? '—'}`)}</dd></div><div><dt>Normalization</dt><dd>${normalization?.required ? 'Required' : 'Not required'}</dd></div><div><dt>Algorithm</dt><dd>${escapeHtml(normalization?.algorithm ?? '—')}</dd></div><div><dt>Final</dt><dd>${escapeHtml(dimensions(result.finalDimensions))}</dd></div><div><dt>Scale</dt><dd>${normalization?.scaleFactor == null ? '—' : `${normalization.scaleFactor}× · ${escapeHtml(normalization.direction)}`}</dd></div></dl>`
    : '';
  const developmentProfile = result.selectedDevelopmentProfile ?? result.developmentProfile;
  const developmentAudit = developmentProfile
    ? `<section class="policy"><h3>Photographic development profile</h3><p><strong>${escapeHtml(developmentProfile.id)}@${escapeHtml(developmentProfile.version)}</strong> · <code>${escapeHtml(developmentProfile.sha256)}</code></p><p>${escapeHtml(developmentProfile.selectionReason)}</p><p>Source analysis label: ${escapeHtml(developmentProfile.sourceAnalysisLabel ?? 'unknown')} · Prompt template: ${escapeHtml(result.promptTemplateVersion)}</p><h3>Image-specific adaptations</h3>${result.imageSpecificAdaptations?.length ? `<ul>${result.imageSpecificAdaptations.map((item) => `<li><strong>${escapeHtml(item.id)}</strong>: ${escapeHtml(item.instruction)} <small>${escapeHtml(item.reason)}</small></li>`).join('')}</ul>` : '<p>None activated.</p>'}<details><summary>Structured photographic development plan</summary><pre>${escapeHtml(JSON.stringify(result.structuredDevelopmentPlan ?? null, null, 2))}</pre></details><details><summary>Exact final edit instruction sent to Gemini</summary><pre>${escapeHtml(result.editInstruction ?? '')}</pre></details></section>`
    : '';
  const media =
    original && developed
      ? `<div class="comparison"><img src="${escapeHtml(original)}" loading="lazy" alt="Original ${escapeHtml(result.catalogId)}"><div class="developed" style="width:50%"><img src="${escapeHtml(developed)}" loading="lazy" alt="Developed ${escapeHtml(result.catalogId)}"></div><span class="label before">Original</span><span class="label after">Developed</span></div><label class="slider">Overlay position<input type="range" min="0" max="100" value="50" aria-label="Original to developed overlay"></label>`
      : comparison
        ? `<img class="sheet" src="${escapeHtml(comparison)}" loading="lazy" alt="Comparison ${escapeHtml(result.catalogId)}">`
        : `<div class="empty">${escapeHtml(result.error ?? 'Comparison pending')}</div>`;
  return `<article data-id="${escapeHtml(result.catalogId)}"><header><div><small>${escapeHtml(result.property)} · ${escapeHtml(result.category ?? result.classification)}</small><h2>${escapeHtml(result.catalogId)}</h2></div><span class="badge ${outcome === 'REJECT' ? 'danger' : outcome === 'PASS' ? 'pass' : 'review'}">${escapeHtml(outcome)}</span></header>${media}${rasterDetails}<div class="scores"><div><b>${displayScore(scores.current)}</b><span>Current style</span></div><div><b>${displayScore(scores.projected)}</b><span>Projected</span></div><div><b>${displayScore(scores.profile)}</b><span>Raw profile</span></div><div><b>${displayScore(scores.naturalness)}</b><span>Raw naturalness</span></div><div><b>${displayScore(scores.color)}</b><span>Color consistency</span></div><div><b>${displayScore(scores.luxury)}</b><span>Luxury editorial</span></div><div><b>${displayConfidence(scores.confidence)}</b><span>Gemini confidence</span></div></div>${developmentAudit}<details><summary>Original Gemini response</summary><pre>${escapeHtml(JSON.stringify(result.postAnalysis ?? null, null, 2))}</pre></details><details><summary>Provider analysis and relative plan</summary><p>${escapeHtml(result.visualAnalysis?.overallAssessment ?? '')}</p><ul class="adjustments">${providerAdjustments}</ul></details><details open><summary>${providerRaster ? 'Gemini image-editing development' : 'Legacy local adaptive development'}</summary><ul class="adjustments">${adjustments || '<li><div><strong>No effective adjustment</strong><span>0%</span></div><p>Measured need remained below the safe activation threshold.</p></li>'}</ul>${providerRaster ? `<p><small>Provider raster SHA-256: ${escapeHtml(result.providerOutputSha256)} · ${escapeHtml(result.providerOutputMimeType)}</small></p>` : ''}</details><section class="policy"><h3>Post-validation decision policy</h3><p><strong>${escapeHtml(outcome)}</strong> · Sources: ${escapeHtml(sources.join(', ') || 'all gates passed')}</p><ul>${(decisionDetails.reasons ?? []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join('') || '<li>No additional policy reason.</li>'}</ul><h3>Concrete defects and evidence</h3>${defects.length ? `<ul>${defects.map((defect) => `<li>${escapeHtml(formatViolation(defect))}${defect.definitive ? ' <strong>Definitive</strong>' : ' <em>Non-definitive</em>'}</li>`).join('')}</ul>` : '<p>None reported.</p>'}<h3>Contradiction flags</h3>${contradictions.length ? `<ul>${contradictions.map((flag) => `<li>${escapeHtml(flag)}</li>`).join('')}</ul>` : '<p>None.</p>'}${legacyViolations.length ? `<h3>Unsupported legacy labels</h3><ul>${legacyViolations.map((violation) => `<li>${escapeHtml(formatViolation(violation))}</li>`).join('')}</ul>` : ''}</section><section class="warnings"><h3>Warnings and raw violations</h3>${warnings.length ? `<ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>` : '<p>None reported.</p>'}</section><fieldset class="approval"><legend>Human pilot approval</legend>${[
    ['approved', 'Approved'],
    ['needs-review', 'Needs manual review'],
    ['rejected', 'Reject'],
    ['pending', 'Pending'],
  ]
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="decision-${escapeHtml(result.catalogId)}" value="${value}" ${decision === value ? 'checked' : ''}>${label}</label>`,
    )
    .join(
      '',
    )}<small>Saved to reports/photo-pilot-review-state.json through the local review server.</small></fieldset></article>`;
}

export async function writeProcessingReports({
  workflow,
  providerName,
  model,
  runMode,
  results,
  style,
  providerRequests = null,
  policyReclassification = null,
}) {
  const metricsPath = path.join(root, workflow.config.reports.metrics);
  const reportPath = path.join(root, workflow.config.reports.processingReport);
  const comparisonsPath = path.join(root, workflow.config.reports.comparisons);
  const pilotStatePath = path.join(root, 'reports', 'photo-pilot-review-state.json');
  const [existing, pilotState] = await Promise.all([
    readJsonIfPresent(metricsPath),
    readJsonIfPresent(pilotStatePath),
  ]);
  const reusable = existing?.styleProfile?.sha256 === style.sha256 ? (existing.results ?? []) : [];
  const byId = new Map(reusable.map((result) => [result.catalogId, result]));
  for (const result of results) byId.set(result.catalogId, result);
  const combined = [...byId.values()].sort((left, right) =>
    left.catalogId.localeCompare(right.catalogId),
  );
  const generatedAt = new Date().toISOString();
  const styleIdentity = {
    profileId: style.profileId,
    version: style.version,
    sha256: style.sha256,
    path: style.relativePath,
  };
  const metrics = {
    schemaVersion: 5,
    generatedAt,
    provider: providerName,
    model,
    runMode,
    styleProfile: styleIdentity,
    thresholds: {
      minimumNaturalness: style.minimumNaturalness,
      minimumProfileMatch: style.minimumProfileMatch,
    },
    postAnalysisEnabled: style.postAnalysis,
    postValidationPolicy: style.postValidationPolicy,
    providerRequests,
    policyReclassification,
    mandatoryHumanArchitecturalReview: true,
    results: combined,
  };
  await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  await fs.writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);

  const lockedRows = workflow.config.lockedImages
    .map(
      (image) =>
        `| \`${image.id}\` | \`${image.originalName}\` | SHA-256 protected; excluded from analysis, upload, editing, comparison, cache, batches, derivatives, and replacement. |`,
    )
    .join('\n');
  const resultRows = combined.length
    ? combined
        .map((result) => {
          const scores = resultScores(result);
          const applied = (result.adjustments ?? [])
            .filter((item) => item.applied)
            .map((item) => `${item.operation} ${Math.round(item.estimatedIntensity * 100)}%`)
            .join(', ');
          const violations = (result.postAnalysis?.styleValidation?.violations ?? [])
            .map(formatViolation)
            .join('; ');
          const sources = decisionSources(result.postDecision).join(', ');
          const contradictions = (result.postDecision?.contradictionFlags ?? []).join(', ');
          const reasoning = (result.postDecision?.reasons ?? []).join('; ');
          const normalization = result.normalization;
          const raster = `${dimensions(result.originalDimensions)} → ${dimensions(result.providerOutputDimensions)} → ${dimensions(result.finalDimensions)}; ${normalization?.required ? `${normalization.algorithm} ${normalization.scaleFactor}× ${normalization.direction}` : 'no resampling'}`;
          return `| \`${result.catalogId}\` | **${policyOutcome(result)}** | ${raster} | ${displayScore(scores.current)} | ${displayScore(scores.projected)} | ${displayScore(scores.profile)} | ${displayScore(scores.naturalness)} | ${displayScore(scores.color)} | ${displayScore(scores.luxury)} | ${displayConfidence(scores.confidence)} | ${applied || 'adaptive no-op'} | ${violations || 'none'} | ${contradictions || 'none'} | ${sources || 'all gates passed'} | ${reasoning || 'none'} |`;
        })
        .join('\n')
    : '| — | — | — | — | — | — | — | — | — | — | No photographs processed | none | none | none | — |';
  const markdown = `# Casa La Arbolada architectural photo-development report

Generated: ${generatedAt}

- Provider: **${providerName}** (${model})
- Run mode: **${runMode}**
- Style: **${style.profileId}@${style.version}**
- Style SHA-256: \`${style.sha256}\`
- Post-development analysis: **${style.postAnalysis ? 'enabled' : 'disabled'}**
- Minimum naturalness / profile match: **${style.minimumNaturalness} / ${style.minimumProfileMatch}**
- Definitive defect confidence: **${style.postValidationPolicy.minimumRejectConfidence}**
- Violation evidence required: **${style.postValidationPolicy.requireEvidence ? 'yes' : 'no'}**
- Contradiction policy: **${style.postValidationPolicy.contradictionPolicy}**
${policyReclassification ? `- Offline policy reclassification: **yes** (${policyReclassification.providerRequests} provider requests; ${policyReclassification.reprocessedImages} images reprocessed)` : ''}

Gemini provides schema-validated analysis, one source-to-image editing pass, and a separate post-development validation pass. The exact returned raster is preserved in cache. Geometry is validated before deterministic Lanczos3 normalization to the canonical source dimensions; structural and quality metrics use only the normalized raster. Nothing is published automatically.

## Locked images

| Catalog ID | Original | Enforcement |
| --- | --- | --- |
${lockedRows}

## Style and review results

| Catalog ID | Policy outcome | Raster geometry | Current | Projected | Raw profile | Raw naturalness | Color | Luxury | Raw confidence | Adjustments | Raw violations and evidence | Contradictions | Decision source | Final policy reasoning |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
${resultRows}

## Photographic development instructions

${
  combined
    .filter((result) => result.selectedDevelopmentProfile ?? result.developmentProfile)
    .map((result) => {
      const profile = result.selectedDevelopmentProfile ?? result.developmentProfile;
      return `### ${result.catalogId} — ${profile.id}@${profile.version}

- Profile SHA-256: \`${profile.sha256}\`
- Selection reason: ${profile.selectionReason}
- Source analysis label: \`${profile.sourceAnalysisLabel ?? 'unknown'}\`
- Prompt-template version: \`${result.promptTemplateVersion}\`
- Structured-plan SHA-256: \`${result.structuredDevelopmentPlanSha256}\`
- Image-specific adaptations: ${(result.imageSpecificAdaptations ?? []).map((item) => `${item.id}: ${item.instruction}`).join('; ') || 'none'}

Structured development plan:

\`\`\`json
${JSON.stringify(result.structuredDevelopmentPlan ?? null, null, 2)}
\`\`\`

Exact final edit instruction sent to Gemini:

\`\`\`text
${result.editInstruction ?? ''}
\`\`\``;
    })
    .join('\n\n') || 'No profile-aware edit instruction has been generated yet.'
}

Provider reasoning, adaptive edit instructions, provider-raster identity, quality metrics, cache identity, style identity, and full structured responses are retained in \`reports/gemini-metrics.json\`.
`;
  await fs.writeFile(reportPath, markdown);

  const cards = combined.length
    ? combined.map((result) => card(result, comparisonsPath, pilotState)).join('')
    : '<p class="none">No photographs have been processed. Integration validation only; no owner image was decoded, developed, or uploaded.</p>';
  const clientData = JSON.stringify({
    endpoint: 'http://127.0.0.1:4317/api/photo-pilot-review-state',
  }).replaceAll('<', '\\u003c');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Casa La Arbolada development QA</title><style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui;background:#0d100d;color:#f3efe4}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#1c241b,#0d100d 42%)}.shell{width:min(1500px,calc(100% - 28px));margin:auto}.hero{padding:46px 0 24px}.eyebrow,small,dt{color:#aab3a2}.hero h1{font:500 clamp(2.1rem,5vw,4.6rem)/1.02 Georgia,serif;margin:.18em 0}.hero p{max-width:850px;color:#c4cabd}.identity,.notice{display:flex;flex-wrap:wrap;gap:12px;padding:14px 16px;border:1px solid #394336;background:#171d16;border-radius:12px;margin-top:14px}.identity code{overflow-wrap:anywhere}.notice{border-color:#695f37;background:#282418}.grid{display:grid;gap:28px;padding:20px 0 64px}article{overflow:hidden;border:1px solid #343c31;border-radius:18px;background:#161a15;box-shadow:0 20px 70px #0006}article>header{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;gap:14px}h2{margin:.2em 0 0;font-size:1.45rem}.badge{border-radius:99px;padding:7px 11px;font-size:.75rem;font-weight:800}.review{background:#4b411d;color:#f3d879}.danger{background:#4a211e;color:#ffaaa0}.pass{background:#1c4932;color:#9df0bd}.comparison{position:relative;overflow:hidden;aspect-ratio:3/2;background:#090b09}.comparison>img,.developed,.developed img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.developed{overflow:hidden;border-right:2px solid white}.developed img{width:100vw;max-width:none}.label{position:absolute;top:12px;padding:6px 9px;border-radius:6px;background:#000b;font-size:.75rem}.before{left:12px}.after{right:12px}.slider{display:flex;gap:14px;align-items:center;padding:12px 20px;color:#aab3a2}.slider input{width:100%}.sheet{display:block;width:100%}.raster{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;margin:0;background:#32382f}.raster div{padding:13px 16px;background:#141913}.raster dt{font-size:.67rem;text-transform:uppercase}.raster dd{margin:5px 0 0}.scores{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:#32382f}.scores div{background:#181d17;padding:16px;text-align:center}.scores b{display:block;font:500 1.7rem Georgia,serif}.scores span{font-size:.68rem;text-transform:uppercase;color:#9fa798}details,.policy,.warnings,.approval{margin:0;padding:18px 22px;border:0;border-top:1px solid #343c31}summary,h3,legend{font-weight:800;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em}.adjustments{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;padding:12px 0 0;list-style:none}.adjustments li{padding:12px;border:1px solid #343c31;border-radius:10px}.adjustments li div{display:flex;justify-content:space-between}.adjustments p{margin:.6em 0}.warnings ul{color:#f0bc96}.policy{background:#111510}.policy h3:not(:first-child){margin-top:20px}.policy li,.warnings li{margin:.45em 0}pre{padding:14px;overflow:auto;border-radius:10px;background:#090b09;color:#cbd6c5;font-size:.75rem}.approval{display:flex;gap:12px;flex-wrap:wrap}.approval legend{margin-bottom:12px}.approval label{padding:10px 12px;border:1px solid #414a3c;border-radius:9px}.approval small{flex-basis:100%}.none,.empty{padding:48px;color:#aab3a2}@media(max-width:800px){.scores,.raster{grid-template-columns:repeat(3,1fr)}.adjustments{grid-template-columns:1fr}.comparison{aspect-ratio:4/3}.developed img{width:calc(100vw - 28px)}}@media(max-width:480px){article>header{align-items:flex-start;flex-direction:column}.scores,.raster{grid-template-columns:repeat(2,1fr)}.approval{display:grid}}</style></head><body><header class="hero shell"><span class="eyebrow">Casa La Arbolada · Architectural development QA</span><h1>Fixed editorial identity review</h1><p>Original and normalized provider-edited pixels are compared against one immutable profile. Scores are advisory; structural, geometry, semantic, and human checks remain decisive.</p><div class="identity"><strong>${escapeHtml(style.profileId)}@${escapeHtml(style.version)}</strong><code>${escapeHtml(style.sha256)}</code></div><div class="notice">Locked owner-approved living-room photographs never enter this dashboard or any analysis, comparison, cache, derivative, or upload path.</div></header><main class="shell grid">${cards}</main><script>const config=${clientData};document.querySelectorAll('.slider input').forEach(input=>input.addEventListener('input',()=>input.closest('article').querySelector('.developed').style.width=input.value+'%'));document.querySelectorAll('.approval input').forEach(input=>input.addEventListener('change',async()=>{const article=input.closest('article');try{const response=await fetch(config.endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({decisions:{[article.dataset.id]:input.value}})});if(!response.ok)throw new Error(await response.text());}catch(error){input.checked=false;alert('Start npm run photos:review-server to persist pilot decisions. '+error.message);}}));</script></body></html>`;
  await fs.writeFile(comparisonsPath, html);
  return { metrics, paths: { metricsPath, reportPath, comparisonsPath } };
}
