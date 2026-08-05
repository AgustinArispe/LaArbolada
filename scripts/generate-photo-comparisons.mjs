import fs from 'node:fs/promises';
import path from 'node:path';
import { exists, loadWorkflow, root } from './photo-workflow-lib.mjs';

const workflow = await loadWorkflow();
const outputDir = path.join(root, 'reports', 'photo-comparisons');
const outputPath = path.join(outputDir, 'index.html');
await fs.mkdir(outputDir, { recursive: true });

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const comparisonRecords = workflow.records.filter((record) => !record.locked);
const sheets = await Promise.all(
  comparisonRecords.map(async (record, index) => {
    const originalFile = path.join(root, 'public', record.sources.large.replace(/^\//, ''));
    const afterAvailable = await exists(record.masterPath);
    const beforeSrc = path.relative(outputDir, originalFile);
    const afterSrc = path.relative(outputDir, record.masterPath);
    return `
      <article class="sheet">
        <header>
          <div><strong>${String(index + 1).padStart(2, '0')} / ${comparisonRecords.length}</strong> · ${escapeHtml(record.id)}</div>
          <div>${escapeHtml(record.classification)} · ${escapeHtml(record.originalName)}</div>
        </header>
        <div class="pair">
          <figure>
            <img src="${escapeHtml(beforeSrc)}" alt="Original derivative for ${escapeHtml(record.id)}">
            <figcaption>Before · current website derivative</figcaption>
          </figure>
          <figure class="${afterAvailable ? '' : 'pending'}">
            ${
              afterAvailable
                ? `<img src="${escapeHtml(afterSrc)}" alt="Developed result for ${escapeHtml(record.id)}">`
                : '<div class="placeholder">Pending approved developed output</div>'
            }
            <figcaption>After · reviewed full-resolution processed master</figcaption>
          </figure>
        </div>
      </article>`;
  }),
);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Casa La Arbolada · Photo comparisons</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #161812; color: #f4f0e5; }
      .intro { max-width: 1500px; margin: 0 auto; padding: 32px 28px 12px; }
      .intro h1 { margin: 0 0 8px; font: 500 clamp(28px, 4vw, 52px)/1.05 Georgia, serif; }
      .intro p { margin: 0; color: #bfc2b2; }
      .locked-images { max-width: 1500px; margin: 18px auto 30px; padding: 24px 28px; border: 1px solid #777d67; background: #20231b; }
      .locked-images h2 { margin: 0 0 14px; font: 500 28px/1.1 Georgia, serif; }
      .locked-images ul { margin: 0; padding-left: 22px; }
      .locked-images li + li { margin-top: 10px; }
      .locked-images code { color: #e9d89a; }
      .sheet { max-width: 1500px; min-height: 720px; margin: 20px auto; padding: 24px 28px 30px; background: #20231b; break-after: page; }
      header { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 18px; color: #d8d9cb; font-size: 14px; }
      .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      figure { margin: 0; min-width: 0; }
      img, .placeholder { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: contain; background: #0f110d; }
      .placeholder { display: grid; place-items: center; color: #8f9483; border: 1px dashed #555a4b; }
      figcaption { padding-top: 10px; color: #bfc2b2; font-size: 13px; }
      @media (max-width: 760px) { .pair { grid-template-columns: 1fr; } header { flex-direction: column; } }
      @media print { body { background: white; color: #111; } .intro { display: none; } .locked-images { margin: 0; max-width: none; background: white; } .sheet { margin: 0; max-width: none; background: white; color: #111; } header, figcaption { color: #333; } }
    </style>
  </head>
  <body>
    <section class="intro">
      <h1>Before / after review sheets</h1>
      <p>Original website derivatives remain active. Processed results are review-only until PUBLIC_IMAGE_SET=processed is explicitly selected.</p>
    </section>
    <section class="locked-images">
      <h2>Locked images</h2>
      <ul>
        ${workflow.config.lockedImages
          .map(
            (locked) =>
              `<li><code>${escapeHtml(locked.id)}</code> · ${escapeHtml(locked.originalName)} — ${escapeHtml(locked.reason)} Excluded from analysis, upload, editing, comparisons, cache, batches, derivatives, and replacement.</li>`,
          )
          .join('\n')}
      </ul>
    </section>
    ${sheets.join('\n')}
  </body>
</html>
`;

await fs.writeFile(outputPath, html);
console.log(
  `Generated ${path.relative(root, outputPath)} (${comparisonRecords.length} sheets; locked images excluded).`,
);
