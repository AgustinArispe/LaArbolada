import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import decodeHeic from 'heic-decode';
import sharp from 'sharp';

const root = process.cwd();
const rawRoot = path.join(root, 'assets-raw');
const reportRoot = path.join(root, 'reports');
const sources = ['drive-1', 'drive-2'];
const properties = {
  casa: 'Casa La Arbolada',
  departamento: 'Departamento La Arbolada',
};

const unaccent = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalized = (value) =>
  unaccent(value)
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const compact = (value) => normalized(value).replaceAll(' ', '');
const posix = (value) => value.split(path.sep).join('/');
const md = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : String(value).replaceAll('|', '\\|');

function readableSpace(value) {
  return normalized(
    value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .replace(/(\d)([a-zA-Z])/g, '$1 $2'),
  ).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function findProperty(baseName) {
  const name = compact(baseName);
  const match = name.match(/departamento|depto|dpto|casa/);
  if (!match || match.index === undefined) return null;
  return {
    label: match[0] === 'casa' ? properties.casa : properties.departamento,
    start: match.index,
    end: match.index + match[0].length,
  };
}

function interpretName(baseName, inferredProperty) {
  const name = compact(baseName);
  const propertyMatch = findProperty(baseName);
  const observations = [];
  let property = propertyMatch?.label ?? inferredProperty ?? null;
  let space = null;
  let spaceNumber = null;
  let order = null;

  if (propertyMatch) {
    const before = name.slice(0, propertyMatch.start);
    const after = name.slice(propertyMatch.end);
    const spaceNumberMatch = before.match(/(\d+)$/);
    const orderMatch = after.match(/^(\d+)$/);
    space =
      readableSpace(spaceNumberMatch ? before.slice(0, -spaceNumberMatch[1].length) : before) ||
      null;
    spaceNumber = spaceNumberMatch ? Number(spaceNumberMatch[1]) : null;
    order = orderMatch ? Number(orderMatch[1]) : null;
    if (after && !orderMatch)
      observations.push('Texto no reconocido después del código de propiedad.');
  } else {
    const orderMatch = name.match(/(\d+)$/);
    space = readableSpace(orderMatch ? name.slice(0, -orderMatch[1].length) : name) || null;
    order = orderMatch ? Number(orderMatch[1]) : null;
    if (property)
      observations.push(
        'Propiedad inferida por predominio de nombres identificados en la carpeta de origen.',
      );
  }

  if (!property) observations.push('Propiedad sin interpretar.');
  if (!space) observations.push('Espacio sin interpretar.');
  if (order === null) observations.push('Orden de imagen ausente o ambiguo.');
  return {
    interpretedSpace: space,
    interpretedSpaceNumber: spaceNumber,
    interpretedProperty: property,
    interpretedOrder: order,
    analysisStatus:
      property && space && order !== null
        ? 'correcto'
        : property || space
          ? 'ambiguo'
          : 'sin interpretar',
    observations,
  };
}

async function recursivelyGetFiles(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(folder, entry.name);
      if (entry.isDirectory()) return recursivelyGetFiles(entryPath);
      return entry.isFile() ? [entryPath] : [];
    }),
  );
  return results.flat();
}

async function getImageData(filePath) {
  try {
    const metadata = await sharp(filePath, { failOn: 'none' }).metadata();
    const width = metadata.width ?? null;
    const height = metadata.height ?? null;
    return {
      width,
      height,
      orientation:
        width && height
          ? width > height
            ? 'horizontal'
            : width < height
              ? 'vertical'
              : 'cuadrada'
          : null,
      error: null,
      source: 'sharp',
    };
  } catch (error) {
    try {
      if (path.extname(filePath).toLowerCase() !== '.heic') throw error;
      const metadata = await decodeHeic({ buffer: await fs.readFile(filePath) });
      const width = metadata.width ?? null;
      const height = metadata.height ?? null;
      return {
        width,
        height,
        orientation:
          width && height
            ? width > height
              ? 'horizontal'
              : width < height
                ? 'vertical'
                : 'cuadrada'
            : null,
        error: null,
        source: 'heic-decode fallback',
      };
    } catch (fallbackError) {
      return {
        width: null,
        height: null,
        orientation: null,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        source: null,
      };
    }
  }
}

function nullableCompare(left, right) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

async function main() {
  await fs.mkdir(reportRoot, { recursive: true });
  const files = [];

  for (const sourceFolder of sources) {
    const sourcePath = path.join(rawRoot, sourceFolder);
    let localFiles;
    try {
      localFiles = await recursivelyGetFiles(sourcePath);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }

    const direct = localFiles
      .map((file) => findProperty(path.parse(file).name)?.label)
      .filter(Boolean);
    const counts = new Map();
    for (const property of direct) counts.set(property, (counts.get(property) ?? 0) + 1);
    const inferredProperty = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    for (const filePath of localFiles) {
      const stats = await fs.stat(filePath);
      const pathData = path.parse(filePath);
      const image = await getImageData(filePath);
      const name = interpretName(pathData.name, inferredProperty);
      const hash = createHash('sha256')
        .update(await fs.readFile(filePath))
        .digest('hex');
      const observations = [...name.observations];
      if (image.error) observations.push(`No se pudo leer metadata de imagen: ${image.error}`);
      if (image.source === 'heic-decode fallback')
        observations.push(
          'Dimensiones obtenidas con fallback HEIC después de que Sharp rechazó el encabezado.',
        );
      files.push({
        originalName: path.basename(filePath),
        extension: pathData.ext.toLowerCase().slice(1) || null,
        sourceFolder,
        localPath: posix(path.relative(root, filePath)),
        fileSizeBytes: stats.size,
        width: image.width,
        height: image.height,
        orientation: image.orientation,
        metadataSource: image.source,
        ...name,
        observations,
        sha256: hash,
        probableDuplicates: [],
      });
    }
  }

  const byHash = new Map();
  const bySize = new Map();
  const byName = new Map();
  for (const file of files) {
    for (const [index, key] of [
      [byHash, file.sha256],
      [bySize, String(file.fileSizeBytes)],
      [byName, normalized(file.originalName)],
    ]) {
      const group = index.get(key) ?? [];
      group.push(file);
      index.set(key, group);
    }
  }
  for (const file of files) {
    const sameHash = (byHash.get(file.sha256) ?? []).filter((item) => item !== file);
    const sameSize = (bySize.get(String(file.fileSizeBytes)) ?? []).filter((item) => item !== file);
    const sameName = (byName.get(normalized(file.originalName)) ?? []).filter(
      (item) => item !== file,
    );
    file.probableDuplicates = sameHash.map((item) => item.localPath);
    if (sameHash.length)
      file.observations.push(
        `Duplicado probable por hash SHA-256: ${file.probableDuplicates.join(', ')}.`,
      );
    else if (sameName.length || sameSize.length)
      file.observations.push(
        'Coincidencia parcial de nombre o tamaño detectada; el hash no coincide.',
      );
  }

  files.sort(
    (a, b) =>
      (a.interpretedProperty ?? '').localeCompare(b.interpretedProperty ?? '', 'es') ||
      (a.interpretedSpace ?? '').localeCompare(b.interpretedSpace ?? '', 'es') ||
      nullableCompare(a.interpretedSpaceNumber, b.interpretedSpaceNumber) ||
      nullableCompare(a.interpretedOrder, b.interpretedOrder) ||
      a.localPath.localeCompare(b.localPath, 'es'),
  );

  const statusCount = (status) => files.filter((file) => file.analysisStatus === status).length;
  const summary = {
    totalFiles: files.length,
    filesBySourceFolder: Object.fromEntries(
      sources.map((source) => [
        source,
        files.filter((file) => file.sourceFolder === source).length,
      ]),
    ),
    analysisStatus: {
      correcto: statusCount('correcto'),
      ambiguo: statusCount('ambiguo'),
      'sin interpretar': statusCount('sin interpretar'),
    },
    probableDuplicateFiles: files.filter((file) => file.probableDuplicates.length > 0).length,
  };
  const inventory = {
    generatedAt: new Date().toISOString(),
    sourceFolders: sources,
    summary,
    files,
  };
  await fs.writeFile(
    path.join(reportRoot, 'drive-inventory.json'),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );

  const rows = files.map(
    (file) =>
      `| ${md(file.interpretedProperty)} | ${md(file.interpretedSpace)} | ${md(file.interpretedSpaceNumber)} | ${md(file.interpretedOrder)} | ${md(file.originalName)} | ${md(file.extension)} | ${md(file.sourceFolder)} | ${md(file.localPath)} | ${md(file.fileSizeBytes)} | ${md(file.width)} | ${md(file.height)} | ${md(file.orientation)} | ${md(file.analysisStatus)} | ${md(file.observations.join(' '))} |`,
  );
  const markdown = [
    '# Inventario de fotografías de Google Drive',
    '',
    `Generado: ${inventory.generatedAt}`,
    '',
    `- Archivos totales: ${summary.totalFiles}`,
    `- Drive 1: ${summary.filesBySourceFolder['drive-1']}`,
    `- Drive 2: ${summary.filesBySourceFolder['drive-2']}`,
    `- Análisis correcto: ${summary.analysisStatus.correcto}`,
    `- Ambiguos: ${summary.analysisStatus.ambiguo}`,
    `- Sin interpretar: ${summary.analysisStatus['sin interpretar']}`,
    `- Archivos con duplicados probables por hash: ${summary.probableDuplicateFiles}`,
    '',
    'Se preservan los nombres originales en `assets-raw`; el script no renombra ni elimina fotografías.',
    '',
    '| Propiedad | Espacio | Nº espacio | Orden | Nombre original | Ext. | Origen | Ruta local | Tamaño (bytes) | Ancho | Alto | Orientación | Estado | Observaciones |',
    '| --- | --- | ---: | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
  await fs.writeFile(path.join(reportRoot, 'drive-inventory.md'), markdown);
  console.log(
    `Inventario generado: ${files.length} archivos (${summary.analysisStatus.correcto} correctos, ${summary.analysisStatus.ambiguo} ambiguos).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
