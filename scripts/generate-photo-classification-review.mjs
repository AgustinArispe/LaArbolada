import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dataPath = path.join(root, 'src', 'data', 'images.generated.ts');
const outputPath = path.join(root, 'reports', 'photo-classification-review.html');

function readPropertyImages(source) {
  const match = source.match(/PropertyImage\[\] = (\[[\s\S]*\]) as PropertyImage\[\]/);
  if (!match) throw new Error('Could not read propertyImages from images.generated.ts.');
  return JSON.parse(match[1]);
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function render(images) {
  const cards = images
    .map((item, index) => {
      const source = item.sources.large ?? item.sources.desktop;
      const absoluteSource = path.join(root, 'public', source.replace(/^\//, ''));
      return `
        <article class="card">
          <img src="file://${escapeHtml(absoluteSource)}" alt="${escapeHtml(item.alt)}" />
          <div class="meta">
            <strong>${String(index + 1).padStart(2, '0')} · ${escapeHtml(item.id)}</strong>
            <span>${escapeHtml(item.space)} · ${escapeHtml(item.originalName)}</span>
          </div>
        </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Casa La Arbolada · Photo classification review</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 28px; background: #171713; color: #f6f1e6; font: 16px/1.4 system-ui, sans-serif; }
      header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
      h1 { margin: 0; font: 600 30px/1.1 Georgia, serif; }
      header p { margin: 0; color: #bbb6aa; }
      main { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
      .card { overflow: hidden; border: 1px solid #4a483f; border-radius: 10px; background: #24231e; }
      img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: contain; background: #090908; }
      .meta { display: grid; gap: 3px; padding: 10px 12px 12px; }
      strong { font-size: 14px; }
      span { color: #bbb6aa; font-size: 12px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Photo classification review</h1>
      <p>${images.length} referenced property photographs</p>
    </header>
    <main>${cards}</main>
  </body>
</html>`;
}

const source = await fs.readFile(dataPath, 'utf8');
const images = readPropertyImages(source);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, render(images));
console.log(path.relative(root, outputPath));
