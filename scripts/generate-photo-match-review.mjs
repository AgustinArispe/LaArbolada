import fs from 'node:fs/promises';
import path from 'node:path';
import { configPath, readCatalog, readJson, root } from './photo-workflow-lib.mjs';
import { loadReviewState } from './photo-review-state-lib.mjs';

const matchingPath = path.join(root, 'reports', 'photo-source-matching.json');
const outputPath = path.join(root, 'reports', 'photo-match-review.html');
const outputDirectory = path.dirname(outputPath);

const [catalog, matching, config] = await Promise.all([
  readCatalog(),
  readJson(matchingPath),
  readJson(configPath),
]);
const { state: reviewState } = await loadReviewState({ createIfMissing: true });
const catalogById = new Map(catalog.map((image) => [image.id, image]));

function relativeBrowserPath(filePath) {
  if (!filePath) return null;
  const absolutePath = path.join(root, filePath.replace(/^\//, ''));
  return encodeURI(path.relative(outputDirectory, absolutePath).split(path.sep).join('/'));
}

function roomCategory(image, classification) {
  const room = image.space
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (room.includes('living')) return 'living-room';
  if (room.includes('dormitorio')) return 'bedroom';
  if (room.includes('cocina')) return 'kitchen';
  if (room.includes('bano')) return 'bathroom';
  if (classification === 'exterior' || room.includes('fachada')) return 'exterior';
  if (classification === 'park') return 'park';
  if (classification === 'creek') return 'creek';
  if (classification === 'detail') return 'detail';
  return null;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

const duplicateCounts = new Map();
for (const record of matching.records) {
  if (!record.actualDiscoveredSourcePath) continue;
  duplicateCounts.set(
    record.actualDiscoveredSourcePath,
    (duplicateCounts.get(record.actualDiscoveredSourcePath) ?? 0) + 1,
  );
}

const dashboardItems = await Promise.all(
  matching.records.map(async (record) => {
    const image = catalogById.get(record.catalogId);
    if (!image) throw new Error(`Catalog entry not found for ${record.catalogId}.`);
    const classification = config.classifications[record.catalogId];
    const publishedPath = path.join('public', image.sources.large.replace(/^\//, ''));
    let publishedBytes = null;
    try {
      publishedBytes = (await fs.stat(path.join(root, publishedPath))).size;
    } catch {
      publishedBytes = null;
    }
    const confidencePercent = Math.round(record.confidenceScore * 100);
    const warnings = [];
    if (confidencePercent < 90) warnings.push('Confidence below 90%');
    if (!record.evidence?.exifMetadataAvailable) warnings.push('Missing EXIF metadata');
    if (record.evidence && !record.evidence.dimensions) warnings.push('Dimension mismatch');
    if (
      record.actualDiscoveredSourcePath &&
      duplicateCounts.get(record.actualDiscoveredSourcePath) > 1
    ) {
      warnings.push('Duplicate source match');
    }
    const locked = record.status === 'locked';
    const readyForProcessing = confidencePercent >= 95 && record.status === 'matched' && !locked;
    const category = roomCategory(image, classification);
    return {
      ...record,
      catalogId: image.id,
      propertyLabel: image.property === 'casa' ? 'House' : 'Apartment',
      room: image.space,
      classification,
      originalFilename: record.actualDiscoveredSourcePath
        ? path.basename(record.actualDiscoveredSourcePath)
        : record.expectedOriginalFilename,
      publishedFilename: path.basename(image.sources.large),
      publishedPath: image.sources.large,
      originalPreviewSource: locked ? null : relativeBrowserPath(record.actualDiscoveredSourcePath),
      publishedPreviewSource: locked ? null : relativeBrowserPath(publishedPath),
      originalResolution: record.sourceMetadata?.width
        ? `${record.sourceMetadata.width} × ${record.sourceMetadata.height}`
        : '—',
      originalFileSize: formatBytes(record.sourceMetadata?.fileSizeBytes),
      publishedFileSize: formatBytes(publishedBytes),
      confidencePercent,
      confidenceLevel:
        confidencePercent >= 95 ? 'green' : confidencePercent >= 80 ? 'yellow' : 'red',
      locked,
      readyForProcessing,
      reviewDecision: reviewState.decisions[record.catalogId],
      warnings,
      filterKeys: [
        'all',
        image.property === 'casa' ? 'house' : 'apartment',
        locked ? 'locked' : null,
        category,
      ].filter(Boolean),
      searchText: [
        image.id,
        record.actualDiscoveredSourcePath,
        record.expectedOriginalFilename,
        image.sources.large,
        image.space,
        classification,
        image.property === 'casa' ? 'house casa' : 'apartment departamento',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  }),
);

const averageConfidence = dashboardItems.length
  ? Math.round(
      dashboardItems.reduce((sum, item) => sum + item.confidencePercent, 0) / dashboardItems.length,
    )
  : 0;

const dashboardData = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalOriginals: matching.summary.totalOriginalFilesDiscovered,
    matched: matching.summary.automaticallyMatchedSources,
    locked: matching.summary.lockedImages,
    ambiguous: matching.summary.ambiguousMatches,
    unmatched: matching.summary.unmatchedCatalogEntries,
    averageConfidence,
    housePhotos: dashboardItems.filter((item) => item.property === 'casa').length,
    apartmentPhotos: dashboardItems.filter((item) => item.property === 'departamento').length,
  },
  reviewState,
  items: dashboardItems,
};
const serializedData = JSON.stringify(dashboardData).replaceAll('<', '\\u003c');

function dashboardClient() {
  const data = JSON.parse(document.getElementById('dashboard-data').textContent);
  const grid = document.getElementById('comparison-grid');
  const resultCount = document.getElementById('result-count');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search');
  const sortSelect = document.getElementById('sort');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const viewer = document.getElementById('viewer');
  const viewerTitle = document.getElementById('viewer-title');
  const viewerPosition = document.getElementById('viewer-position');
  const viewerSide = document.getElementById('viewer-side');
  const viewerOverlay = document.getElementById('viewer-overlay');
  const viewerOriginalImages = [...document.querySelectorAll('[data-viewer-original]')];
  const viewerPublishedImages = [...document.querySelectorAll('[data-viewer-published]')];
  const viewerSlider = document.getElementById('viewer-slider');
  const viewerDivider = document.getElementById('viewer-divider');
  const viewerPublishedLayer = document.getElementById('viewer-published-layer');
  const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:4317' : '';
  const approvalFilterStatuses = new Map([
    ['review-approved', 'approved'],
    ['review-skipped', 'skipped'],
    ['review-manual', 'manual'],
    ['review-pending', 'pending'],
  ]);

  let activeFilter = 'all';
  let reviewState = data.reviewState;
  let apiAvailable = false;
  let saveQueue = Promise.resolve();
  let visibleItems = [];
  let viewerIndex = -1;
  let overlayMode = false;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const approvalLabels = {
    approved: 'Approved for enhancement',
    skipped: 'Skip',
    manual: 'Needs manual editing',
    pending: 'Pending',
  };

  function decisionFor(item) {
    return (
      reviewState.decisions[item.catalogId] ?? {
        status: item.locked ? 'skipped' : 'pending',
        locked: item.locked,
      }
    );
  }

  const cardTemplate = (item, index) => {
    const decision = decisionFor(item);
    const warnings = item.warnings.length
      ? `<div class="warning-list">${item.warnings
          .map((warning) => `<span>⚠ ${escapeHtml(warning)}</span>`)
          .join('')}</div>`
      : '';
    const originalImage = item.originalPreviewSource
      ? `<img class="qa-image original-preview" src="${escapeHtml(item.originalPreviewSource)}" alt="Original preview for ${escapeHtml(item.catalogId)}" loading="lazy">`
      : '';
    const originalFallback = `<div class="image-fallback" ${item.originalPreviewSource ? 'hidden' : ''}><strong>Original preview unavailable</strong><span>${escapeHtml(item.actualDiscoveredSourcePath || 'No matched source')}</span></div>`;
    const comparisonViews = item.locked
      ? `<div class="locked-comparison-block"><strong>LOCKED · comparison prohibited</strong><span>This owner-approved production image is listed for policy verification only. Neither the original nor published pixels are loaded into the comparison interface.</span></div>`
      : `<div class="card-view side-view">
          <button class="image-panel" type="button" data-open-viewer="${escapeHtml(item.catalogId)}" aria-label="Open fullscreen original comparison for ${escapeHtml(item.catalogId)}">
            <span class="panel-label">Original source</span>
            <div class="image-stage">${originalImage}${originalFallback}</div>
          </button>
          <button class="image-panel" type="button" data-open-viewer="${escapeHtml(item.catalogId)}" aria-label="Open fullscreen published comparison for ${escapeHtml(item.catalogId)}">
            <span class="panel-label">Published WebP</span>
            <div class="image-stage"><img class="qa-image published-preview" src="${escapeHtml(item.publishedPreviewSource)}" alt="Published preview for ${escapeHtml(item.catalogId)}" loading="lazy"><div class="image-fallback" hidden><strong>Published image unavailable</strong></div></div>
          </button>
        </div>

        <div class="card-view overlay-view" hidden>
          <div class="card-overlay-stage">
            ${originalImage.replace('original-preview', 'original-preview overlay-original')}${originalFallback}
            <div class="card-published-layer" style="clip-path: inset(0 50% 0 0)"><img class="qa-image" src="${escapeHtml(item.publishedPreviewSource)}" alt="Published overlay for ${escapeHtml(item.catalogId)}" loading="lazy"></div>
            <div class="card-overlay-divider" style="left: 50%"></div>
            <span class="overlay-caption overlay-caption-left">Original</span><span class="overlay-caption overlay-caption-right">Published</span>
          </div>
        </div>

        <div class="overlay-toolbar">
          <button class="secondary-button" type="button" data-overlay-toggle>Overlay mode</button>
          <label class="card-slider" hidden><span>Original</span><input type="range" min="0" max="100" value="50" data-overlay-slider aria-label="Original to published overlay"><span>Published</span></label>
        </div>`;
    const publishedResolution = item.locked
      ? 'published preview intentionally not loaded'
      : '<span data-published-resolution>loading published…</span>';
    return `
      <article class="match-card ${item.locked ? 'is-locked' : ''} approval-${decision.status}" data-id="${escapeHtml(item.catalogId)}" data-locked="${item.locked}">
        <header class="card-header">
          <div>
            <span class="eyebrow">${String(index + 1).padStart(2, '0')} · ${escapeHtml(item.propertyLabel)} · ${escapeHtml(item.room)}</span>
            <h2>${escapeHtml(item.catalogId)}</h2>
          </div>
          <div class="badges">
            <span class="confidence confidence-${item.confidenceLevel}">${item.confidencePercent}%</span>
            ${item.locked ? '<span class="badge badge-locked">Locked</span>' : ''}
            <span class="badge ${item.readyForProcessing ? 'badge-ready' : 'badge-review'}">${item.readyForProcessing ? '✓ Ready for enhancement' : 'Manual Review Required'}</span>
            <span class="badge approval-badge approval-badge-${decision.status}">${escapeHtml(approvalLabels[decision.status])}</span>
          </div>
        </header>

        ${comparisonViews}

        <fieldset class="approval-controls" ${item.locked || !apiAvailable ? 'disabled' : ''}>
          <legend>Enhancement approval decision</legend>
          <label><input type="radio" name="decision-${escapeHtml(item.catalogId)}" value="approved" data-review-decision="${escapeHtml(item.catalogId)}" ${decision.status === 'approved' ? 'checked' : ''}> <span>Approved for enhancement</span></label>
          <label><input type="radio" name="decision-${escapeHtml(item.catalogId)}" value="skipped" data-review-decision="${escapeHtml(item.catalogId)}" ${decision.status === 'skipped' ? 'checked' : ''}> <span>Skip</span></label>
          <label><input type="radio" name="decision-${escapeHtml(item.catalogId)}" value="manual" data-review-decision="${escapeHtml(item.catalogId)}" ${decision.status === 'manual' ? 'checked' : ''}> <span>Needs manual editing</span></label>
          ${item.locked ? '<small>LOCKED policy forces Skip and cannot be overridden.</small>' : !apiAvailable ? '<small>Start the local review server to save decisions.</small>' : ''}
        </fieldset>

        <dl class="metadata-grid">
          <div><dt>Property</dt><dd>${escapeHtml(item.propertyLabel)}</dd></div>
          <div><dt>Room classification</dt><dd>${escapeHtml(item.room)} · ${escapeHtml(item.classification)}</dd></div>
          <div><dt>Original filename</dt><dd title="${escapeHtml(item.actualDiscoveredSourcePath)}">${escapeHtml(item.originalFilename)}</dd></div>
          <div><dt>Published filename</dt><dd title="${escapeHtml(item.publishedPath)}">${escapeHtml(item.publishedFilename)}</dd></div>
          <div><dt>Resolution</dt><dd>${escapeHtml(item.originalResolution)} original · ${publishedResolution}</dd></div>
          <div><dt>File size</dt><dd>${escapeHtml(item.originalFileSize)} original · ${escapeHtml(item.publishedFileSize)} published</dd></div>
          <div><dt>Confidence</dt><dd>${item.confidencePercent}%</dd></div>
          <div class="method"><dt>Matching method</dt><dd>${escapeHtml(item.matchingMethod || 'No automatic match')}</dd></div>
        </dl>
        ${warnings}
      </article>`;
  };

  function sortedAndFilteredItems() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = data.items.filter((item) => {
      const approvalStatus = approvalFilterStatuses.get(activeFilter);
      const filterMatches = approvalStatus
        ? decisionFor(item).status === approvalStatus
        : activeFilter === 'all' || item.filterKeys.includes(activeFilter);
      return filterMatches && (!query || item.searchText.includes(query));
    });
    const sorters = {
      confidence: (left, right) =>
        right.confidencePercent - left.confidencePercent ||
        left.catalogId.localeCompare(right.catalogId),
      property: (left, right) =>
        left.propertyLabel.localeCompare(right.propertyLabel) ||
        left.catalogId.localeCompare(right.catalogId),
      room: (left, right) =>
        left.room.localeCompare(right.room) || left.catalogId.localeCompare(right.catalogId),
      catalog: (left, right) => left.catalogId.localeCompare(right.catalogId),
      filename: (left, right) => left.originalFilename.localeCompare(right.originalFilename),
    };
    return filtered.sort(sorters[sortSelect.value]);
  }

  function installImageFallbacks() {
    grid.querySelectorAll('.qa-image').forEach((image) => {
      image.addEventListener('error', () => {
        image.hidden = true;
        const fallback = image.nextElementSibling;
        if (fallback?.classList.contains('image-fallback')) fallback.hidden = false;
      });
    });
    grid.querySelectorAll('.published-preview').forEach((image) => {
      image.addEventListener('load', () => {
        const card = image.closest('.match-card');
        const target = card?.querySelector('[data-published-resolution]');
        if (target) target.textContent = `${image.naturalWidth} × ${image.naturalHeight} published`;
      });
    });
  }

  function render() {
    visibleItems = sortedAndFilteredItems();
    grid.innerHTML = visibleItems.map(cardTemplate).join('');
    resultCount.textContent = `${visibleItems.length} of ${data.items.length} catalog entries`;
    emptyState.hidden = visibleItems.length > 0;
    installImageFallbacks();
    updateApprovalSummary();
  }

  function updateApprovalSummary() {
    const decisions = data.items.map((item) => decisionFor(item));
    const counts = {
      approved: decisions.filter((decision) => decision.status === 'approved').length,
      skipped: decisions.filter((decision) => decision.status === 'skipped').length,
      manual: decisions.filter((decision) => decision.status === 'manual').length,
      pending: decisions.filter((decision) => decision.status === 'pending').length,
    };
    document.getElementById('approval-approved').textContent = counts.approved;
    document.getElementById('approval-skipped').textContent = counts.skipped;
    document.getElementById('approval-manual').textContent = counts.manual;
    document.getElementById('approval-pending').textContent = counts.pending;
    document.getElementById('processing-image-estimate').textContent = counts.approved;
  }

  function setPersistenceStatus(message, mode) {
    const status = document.getElementById('persistence-status');
    status.textContent = message;
    status.dataset.mode = mode;
    document.getElementById('approve-high-confidence').disabled = !apiAvailable;
    document.getElementById('generate-processing-batch').disabled = !apiAvailable;
  }

  async function apiRequest(pathname, options = {}) {
    const response = await fetch(`${apiBase}${pathname}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `Review API failed (${response.status}).`);
    return body;
  }

  function persistReviewState() {
    setPersistenceStatus('Saving decisions…', 'saving');
    saveQueue = saveQueue
      .then(() =>
        apiRequest('/api/photo-review-state', {
          method: 'PUT',
          body: JSON.stringify({ decisions: reviewState.decisions }),
        }),
      )
      .then((state) => {
        reviewState = state;
        setPersistenceStatus('All decisions saved', 'saved');
        updateApprovalSummary();
      })
      .catch((error) => {
        setPersistenceStatus(`Save failed: ${error.message}`, 'error');
      });
    return saveQueue;
  }

  async function initializePersistence() {
    try {
      reviewState = await apiRequest('/api/photo-review-state');
      apiAvailable = true;
      setPersistenceStatus(
        'Connected · decisions persist to reports/photo-review-state.json',
        'saved',
      );
    } catch {
      apiAvailable = false;
      setPersistenceStatus(
        'Read-only · run npm run photos:review-server to persist decisions',
        'error',
      );
    }
    render();
  }

  function updateViewerTransform() {
    document.querySelectorAll('.viewer-transform').forEach((image) => {
      image.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    });
    document.getElementById('zoom-level').textContent = `${Math.round(scale * 100)}%`;
  }

  function resetViewerTransform() {
    scale = 1;
    panX = 0;
    panY = 0;
    updateViewerTransform();
  }

  function setViewerImage(image, source, fallbackText) {
    const fallback = image.nextElementSibling;
    image.hidden = !source;
    fallback.hidden = Boolean(source);
    fallback.querySelector('span').textContent = fallbackText;
    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
    };
    if (source) image.src = source;
  }

  function showViewerItem(index) {
    if (!visibleItems.length) return;
    viewerIndex = (index + visibleItems.length) % visibleItems.length;
    const item = visibleItems[viewerIndex];
    viewerTitle.textContent = `${item.catalogId} · ${item.propertyLabel} · ${item.room}`;
    viewerPosition.textContent = `${viewerIndex + 1} / ${visibleItems.length}`;
    viewerOriginalImages.forEach((image) =>
      setViewerImage(
        image,
        item.originalPreviewSource,
        item.actualDiscoveredSourcePath || 'No source',
      ),
    );
    viewerPublishedImages.forEach((image) =>
      setViewerImage(image, item.publishedPreviewSource, item.publishedPath),
    );
    resetViewerTransform();
  }

  function openViewer(id) {
    const index = visibleItems.findIndex((item) => item.catalogId === id);
    if (index < 0) return;
    viewer.hidden = false;
    document.body.classList.add('viewer-open');
    showViewerItem(index);
    document.getElementById('viewer-close').focus();
  }

  function closeViewer() {
    viewer.hidden = true;
    document.body.classList.remove('viewer-open');
  }

  function setViewerOverlay(enabled) {
    overlayMode = enabled;
    viewerSide.hidden = enabled;
    viewerOverlay.hidden = !enabled;
    document.getElementById('viewer-overlay-toggle').classList.toggle('is-active', enabled);
    document.getElementById('viewer-slider-wrap').hidden = !enabled;
    resetViewerTransform();
  }

  function setViewerSlider(value) {
    viewerPublishedLayer.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
    viewerDivider.style.left = `${value}%`;
  }

  function download(filename, type, content) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportRows() {
    return visibleItems.map((item) => ({
      catalogId: item.catalogId,
      property: item.property,
      room: item.room,
      classification: item.classification,
      expectedOriginalFilename: item.expectedOriginalFilename,
      actualDiscoveredSourcePath: item.actualDiscoveredSourcePath,
      publishedPath: item.publishedPath,
      matchingMethod: item.matchingMethod,
      confidenceScore: item.confidenceScore,
      status: item.status,
      reviewDecision: decisionFor(item).status,
      warnings: item.warnings,
    }));
  }

  function csvValue(value) {
    const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      filterButtons.forEach((item) => item.classList.toggle('is-active', item === button));
      render();
    });
  });
  searchInput.addEventListener('input', render);
  sortSelect.addEventListener('change', render);
  document.getElementById('export-json').addEventListener('click', () => {
    download(
      'photo-source-matching-review.json',
      'application/json',
      JSON.stringify(exportRows(), null, 2),
    );
  });
  document.getElementById('export-csv').addEventListener('click', () => {
    const rows = exportRows();
    const headers = Object.keys(rows[0] ?? {});
    const csv = [
      headers.map(csvValue).join(','),
      ...rows.map((row) => headers.map((key) => csvValue(row[key])).join(',')),
    ].join('\n');
    download('photo-source-matching-review.csv', 'text/csv;charset=utf-8', csv);
  });

  grid.addEventListener('click', (event) => {
    const viewerButton = event.target.closest('[data-open-viewer]');
    if (viewerButton) return openViewer(viewerButton.dataset.openViewer);
    const overlayButton = event.target.closest('[data-overlay-toggle]');
    if (!overlayButton) return;
    const card = overlayButton.closest('.match-card');
    const side = card.querySelector('.side-view');
    const overlay = card.querySelector('.overlay-view');
    const sliderLabel = card.querySelector('.card-slider');
    const enabled = overlay.hidden;
    overlay.hidden = !enabled;
    side.hidden = enabled;
    sliderLabel.hidden = !enabled;
    overlayButton.classList.toggle('is-active', enabled);
    overlayButton.textContent = enabled ? 'Side-by-side mode' : 'Overlay mode';
  });
  grid.addEventListener('input', (event) => {
    if (!event.target.matches('[data-overlay-slider]')) return;
    const card = event.target.closest('.match-card');
    const value = Number(event.target.value);
    card.querySelector('.card-published-layer').style.clipPath = `inset(0 ${100 - value}% 0 0)`;
    card.querySelector('.card-overlay-divider').style.left = `${value}%`;
  });
  grid.addEventListener('change', (event) => {
    if (!event.target.matches('[data-review-decision]') || !apiAvailable) return;
    const item = data.items.find(
      (candidate) => candidate.catalogId === event.target.dataset.reviewDecision,
    );
    if (!item || item.locked) return;
    reviewState.decisions[item.catalogId] = {
      status: event.target.value,
      updatedAt: new Date().toISOString(),
      locked: false,
      reason: null,
    };
    const scrollPosition = window.scrollY;
    render();
    window.scrollTo(0, scrollPosition);
    persistReviewState();
  });

  document.getElementById('approve-high-confidence').addEventListener('click', () => {
    if (!apiAvailable) return;
    const timestamp = new Date().toISOString();
    for (const item of data.items) {
      if (item.confidencePercent < 98 || item.locked || item.status !== 'matched') continue;
      reviewState.decisions[item.catalogId] = {
        status: 'approved',
        updatedAt: timestamp,
        locked: false,
        reason: 'Approved by high-confidence bulk action.',
      };
    }
    render();
    persistReviewState();
  });
  document.getElementById('generate-processing-batch').addEventListener('click', async () => {
    if (!apiAvailable) return;
    const message = document.getElementById('batch-message');
    message.textContent = 'Generating batch…';
    try {
      await saveQueue;
      const result = await apiRequest('/api/photo-processing-batch', { method: 'POST' });
      message.textContent = `Generated reports/photo-processing-batch.json with ${result.batch.totalApproved} approved images.`;
    } catch (error) {
      message.textContent = `Batch generation failed: ${error.message}`;
    }
  });

  document.getElementById('viewer-close').addEventListener('click', closeViewer);
  document
    .getElementById('viewer-prev')
    .addEventListener('click', () => showViewerItem(viewerIndex - 1));
  document
    .getElementById('viewer-next')
    .addEventListener('click', () => showViewerItem(viewerIndex + 1));
  document.getElementById('viewer-zoom-in').addEventListener('click', () => {
    scale = Math.min(5, scale + 0.25);
    updateViewerTransform();
  });
  document.getElementById('viewer-zoom-out').addEventListener('click', () => {
    scale = Math.max(0.5, scale - 0.25);
    updateViewerTransform();
  });
  document.getElementById('viewer-reset').addEventListener('click', resetViewerTransform);
  document
    .getElementById('viewer-overlay-toggle')
    .addEventListener('click', () => setViewerOverlay(!overlayMode));
  viewerSlider.addEventListener('input', () => setViewerSlider(Number(viewerSlider.value)));
  document.getElementById('viewer-stage').addEventListener('wheel', (event) => {
    event.preventDefault();
    scale = Math.max(0.5, Math.min(5, scale + (event.deltaY < 0 ? 0.2 : -0.2)));
    updateViewerTransform();
  });
  document.getElementById('viewer-stage').addEventListener('pointerdown', (event) => {
    dragging = true;
    dragStartX = event.clientX - panX;
    dragStartY = event.clientY - panY;
    event.currentTarget.setPointerCapture(event.pointerId);
  });
  document.getElementById('viewer-stage').addEventListener('pointermove', (event) => {
    if (!dragging) return;
    panX = event.clientX - dragStartX;
    panY = event.clientY - dragStartY;
    updateViewerTransform();
  });
  document.getElementById('viewer-stage').addEventListener('pointerup', () => {
    dragging = false;
  });
  document.addEventListener('keydown', (event) => {
    if (viewer.hidden) return;
    if (event.key === 'Escape') closeViewer();
    if (event.key === 'ArrowLeft') showViewerItem(viewerIndex - 1);
    if (event.key === 'ArrowRight') showViewerItem(viewerIndex + 1);
    if (event.key === '+' || event.key === '=') {
      scale = Math.min(5, scale + 0.25);
      updateViewerTransform();
    }
    if (event.key === '-') {
      scale = Math.max(0.5, scale - 0.25);
      updateViewerTransform();
    }
  });

  setViewerSlider(50);
  initializePersistence();
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Casa La Arbolada · Photo matching QA</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; --bg: #10120e; --panel: #1b1e17; --panel-2: #22261d; --line: #3b4134; --text: #f3f0e5; --muted: #a4aa99; --green: #72d69a; --yellow: #e7c968; --red: #ef7b72; --gold: #d8b968; }
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      html { scroll-behavior: smooth; }
      body { margin: 0; background: radial-gradient(circle at 10% 0%, #20251a 0, transparent 32rem), var(--bg); color: var(--text); }
      body.viewer-open { overflow: hidden; }
      button, input, select { font: inherit; }
      button { color: inherit; }
      .shell { width: min(1540px, calc(100% - 40px)); margin: 0 auto; }
      .hero { padding: 48px 0 24px; }
      .hero-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; }
      .kicker { margin: 0 0 8px; color: var(--gold); font-size: 12px; font-weight: 750; letter-spacing: .16em; text-transform: uppercase; }
      h1 { max-width: 900px; margin: 0; font: 500 clamp(38px, 6vw, 74px)/.98 Georgia, serif; letter-spacing: -.035em; }
      .hero-copy { max-width: 510px; margin: 0 0 5px; color: var(--muted); line-height: 1.65; }
      .summary-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 10px; margin-top: 32px; }
      .stat { min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: rgba(27, 30, 23, .88); }
      .stat strong { display: block; margin-bottom: 5px; font: 500 26px/1 Georgia, serif; }
      .stat span { color: var(--muted); font-size: 11px; line-height: 1.25; }
      .approval-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
      .approval-stat { min-width: 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: rgba(20, 23, 18, .92); }
      .approval-stat strong { display: block; margin-bottom: 4px; font-size: 22px; }
      .approval-stat span { color: var(--muted); font-size: 10px; }
      .approval-stat.credits { border-color: rgba(114, 214, 154, .38); }
      .control-panel { position: sticky; z-index: 20; top: 0; padding: 14px 0; border-block: 1px solid var(--line); background: rgba(16, 18, 14, .92); backdrop-filter: blur(18px); }
      .control-row { display: flex; align-items: center; gap: 10px; }
      .search-wrap { position: relative; flex: 1; min-width: 220px; }
      .search-wrap span { position: absolute; top: 50%; left: 14px; color: var(--muted); transform: translateY(-50%); }
      input[type="search"], select { width: 100%; height: 44px; border: 1px solid var(--line); border-radius: 9px; outline: none; background: var(--panel); color: var(--text); }
      input[type="search"] { padding: 0 15px 0 40px; }
      select { min-width: 175px; padding: 0 34px 0 12px; }
      input:focus, select:focus { border-color: #7f8a70; box-shadow: 0 0 0 3px rgba(127, 138, 112, .14); }
      .primary-button, .secondary-button { min-height: 40px; border: 1px solid var(--line); border-radius: 8px; padding: 0 13px; background: var(--panel-2); cursor: pointer; }
      .primary-button:hover, .secondary-button:hover, .secondary-button.is-active { border-color: #7f8a70; background: #2a3024; }
      button:disabled { cursor: not-allowed; opacity: .45; }
      .filters { display: flex; gap: 7px; margin-top: 11px; padding-bottom: 2px; overflow-x: auto; scrollbar-width: thin; }
      .filter-button { flex: none; border: 1px solid var(--line); border-radius: 999px; padding: 7px 11px; background: transparent; color: var(--muted); cursor: pointer; font-size: 11px; }
      .filter-button:hover, .filter-button.is-active { border-color: #818d71; background: #293022; color: var(--text); }
      .workflow-actions { display: flex; align-items: center; gap: 9px; margin-top: 11px; }
      .workflow-actions .generate { border-color: rgba(114, 214, 154, .5); color: var(--green); }
      #persistence-status { margin-left: auto; color: var(--muted); font-size: 10px; }
      #persistence-status[data-mode="saved"] { color: var(--green); }
      #persistence-status[data-mode="error"] { color: var(--yellow); }
      #batch-message { min-height: 16px; margin: 8px 0 0; color: var(--muted); font-size: 10px; }
      .results-bar { display: flex; justify-content: space-between; gap: 20px; padding: 26px 0 13px; color: var(--muted); font-size: 12px; }
      #comparison-grid { display: grid; gap: 24px; padding-bottom: 60px; }
      .match-card { overflow: hidden; border: 1px solid var(--line); border-radius: 16px; background: rgba(27, 30, 23, .96); box-shadow: 0 20px 65px rgba(0, 0, 0, .18); }
      .match-card.is-locked { border-color: #8f7944; }
      .locked-comparison-block { display: grid; min-height: 180px; place-content: center; gap: 8px; padding: 32px; border-bottom: 1px solid var(--line); background: #211f16; text-align: center; }
      .locked-comparison-block strong { color: var(--gold); letter-spacing: .04em; text-transform: uppercase; }
      .locked-comparison-block span { max-width: 680px; color: var(--muted); font-size: 12px; line-height: 1.6; }
      .card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 20px 22px; }
      .eyebrow { color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
      h2 { margin: 6px 0 0; font-size: clamp(18px, 2vw, 25px); letter-spacing: -.02em; }
      .badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
      .badge, .confidence { border: 1px solid var(--line); border-radius: 999px; padding: 6px 9px; font-size: 10px; font-weight: 800; letter-spacing: .055em; text-transform: uppercase; }
      .confidence-green { border-color: rgba(114, 214, 154, .5); background: rgba(114, 214, 154, .1); color: var(--green); }
      .confidence-yellow { border-color: rgba(231, 201, 104, .5); background: rgba(231, 201, 104, .1); color: var(--yellow); }
      .confidence-red { border-color: rgba(239, 123, 114, .5); background: rgba(239, 123, 114, .1); color: var(--red); }
      .badge-locked { border-color: rgba(216, 185, 104, .55); color: var(--gold); }
      .badge-ready { border-color: rgba(114, 214, 154, .5); color: var(--green); }
      .badge-review { border-color: rgba(231, 201, 104, .5); color: var(--yellow); }
      .approval-badge-approved { border-color: rgba(114, 214, 154, .5); color: var(--green); }
      .approval-badge-skipped { border-color: #687061; color: #bdc3b5; }
      .approval-badge-manual { border-color: rgba(239, 123, 114, .5); color: var(--red); }
      .approval-badge-pending { color: var(--muted); }
      .card-view { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); }
      .image-panel { min-width: 0; border: 0; padding: 0; background: #090a08; text-align: left; cursor: zoom-in; }
      .panel-label { display: block; padding: 8px 12px; background: #151812; color: #c1c7b6; font-size: 10px; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
      .image-stage, .card-overlay-stage { position: relative; display: grid; width: 100%; aspect-ratio: 4 / 3; place-items: center; overflow: hidden; background: #060705; }
      .qa-image { display: block; width: 100%; height: 100%; object-fit: contain; }
      .image-fallback { position: absolute; inset: 0; display: grid; place-content: center; gap: 7px; padding: 24px; color: var(--muted); text-align: center; }
      .image-fallback[hidden] { display: none; }
      .image-fallback strong { color: #d7dacc; font-size: 13px; }
      .image-fallback span { overflow-wrap: anywhere; font-size: 10px; }
      .overlay-view { background: #060705; }
      .card-overlay-stage { grid-column: 1 / -1; }
      .card-overlay-stage > .qa-image, .card-published-layer { position: absolute; inset: 0; }
      .card-published-layer img { width: 100%; height: 100%; object-fit: contain; }
      .card-overlay-divider { position: absolute; z-index: 3; top: 0; bottom: 0; width: 2px; background: white; box-shadow: 0 0 0 1px rgba(0, 0, 0, .3); }
      .overlay-caption { position: absolute; z-index: 4; top: 12px; border-radius: 999px; padding: 5px 8px; background: rgba(0, 0, 0, .72); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .overlay-caption-left { left: 12px; } .overlay-caption-right { right: 12px; }
      .overlay-toolbar { display: flex; align-items: center; gap: 16px; padding: 11px 18px; border-bottom: 1px solid var(--line); }
      .card-slider { display: flex; flex: 1; align-items: center; gap: 10px; color: var(--muted); font-size: 10px; }
      .card-slider[hidden] { display: none; }
      input[type="range"] { width: 100%; accent-color: #d9c374; }
      .approval-controls { display: flex; align-items: center; gap: 10px; margin: 0; padding: 14px 18px; border: 0; border-bottom: 1px solid var(--line); }
      .approval-controls legend { float: left; margin-right: 8px; color: var(--muted); font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
      .approval-controls label { display: flex; align-items: center; gap: 6px; border: 1px solid #41483a; border-radius: 999px; padding: 7px 10px; cursor: pointer; font-size: 11px; }
      .approval-controls label:has(input:checked) { border-color: #899675; background: #293022; }
      .approval-controls input { accent-color: #9fb287; }
      .approval-controls small { margin-left: auto; color: var(--gold); font-size: 10px; }
      .metadata-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 8px 18px 18px; }
      .metadata-grid > div { min-width: 0; padding: 12px; border-bottom: 1px solid #30362b; }
      .metadata-grid .method { grid-column: span 2; }
      dt { margin-bottom: 5px; color: var(--muted); font-size: 9px; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
      dd { margin: 0; overflow-wrap: anywhere; color: #e2e4da; font-size: 12px; line-height: 1.45; }
      .warning-list { display: flex; flex-wrap: wrap; gap: 7px; padding: 0 30px 22px; }
      .warning-list span { border-radius: 7px; padding: 7px 9px; background: rgba(239, 123, 114, .1); color: var(--red); font-size: 10px; }
      #empty-state { margin: 25px 0 60px; padding: 48px; border: 1px dashed var(--line); border-radius: 14px; color: var(--muted); text-align: center; }
      #viewer { position: fixed; z-index: 100; inset: 0; background: rgba(5, 6, 4, .97); }
      #viewer[hidden] { display: none; }
      .viewer-header { position: absolute; z-index: 4; top: 0; right: 0; left: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 68px; padding: 10px 18px; border-bottom: 1px solid #34392f; background: rgba(12, 14, 11, .9); backdrop-filter: blur(14px); }
      .viewer-heading { min-width: 0; } .viewer-heading strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .viewer-heading span { color: var(--muted); font-size: 11px; }
      .viewer-controls { display: flex; align-items: center; gap: 6px; }
      .viewer-controls button { min-width: 38px; height: 38px; border: 1px solid #3f4538; border-radius: 8px; background: #20241c; cursor: pointer; }
      .viewer-controls button:hover, .viewer-controls button.is-active { background: #30372a; }
      #viewer-stage { position: absolute; inset: 68px 0 58px; overflow: hidden; cursor: grab; touch-action: none; }
      #viewer-stage:active { cursor: grabbing; }
      .viewer-side { display: grid; grid-template-columns: 1fr 1fr; width: 100%; height: 100%; gap: 1px; background: #33382e; }
      .viewer-pane, .viewer-overlay-stage { position: relative; display: grid; place-items: center; overflow: hidden; background: #050604; }
      .viewer-pane .panel-label { position: absolute; z-index: 2; top: 12px; left: 12px; border-radius: 999px; background: rgba(0, 0, 0, .7); }
      .viewer-transform { width: 100%; height: 100%; object-fit: contain; transform-origin: center; will-change: transform; }
      .viewer-overlay { width: 100%; height: 100%; }
      .viewer-overlay-stage { width: 100%; height: 100%; }
      .viewer-overlay-stage > img, .viewer-published-layer { position: absolute; inset: 0; }
      .viewer-published-layer { overflow: hidden; }
      .viewer-published-layer img { width: 100%; height: 100%; object-fit: contain; }
      .viewer-divider { position: absolute; z-index: 3; top: 0; bottom: 0; width: 2px; background: white; }
      .viewer-footer { position: absolute; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; gap: 14px; height: 58px; border-top: 1px solid #34392f; background: rgba(12, 14, 11, .94); }
      .viewer-slider { display: flex; width: min(520px, 60vw); align-items: center; gap: 10px; color: var(--muted); font-size: 10px; }
      .viewer-slider[hidden] { display: none; }
      @media (max-width: 1050px) { .summary-grid { grid-template-columns: repeat(4, 1fr); } .approval-summary { grid-template-columns: repeat(3, 1fr); } .hero-top { align-items: flex-start; flex-direction: column; } .hero-copy { max-width: 800px; } .metadata-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .approval-controls { align-items: flex-start; flex-wrap: wrap; } .approval-controls small { flex-basis: 100%; margin-left: 0; } }
      @media (max-width: 720px) { .shell { width: min(100% - 24px, 1540px); } .hero { padding-top: 30px; } .summary-grid, .approval-summary { grid-template-columns: repeat(2, 1fr); } .control-row, .workflow-actions { flex-wrap: wrap; } .search-wrap { flex-basis: 100%; } select { flex: 1; } #persistence-status { flex-basis: 100%; margin-left: 0; } .card-header { align-items: flex-start; flex-direction: column; } .badges { justify-content: flex-start; } .card-view { grid-template-columns: 1fr; } .approval-controls { align-items: stretch; flex-direction: column; } .approval-controls legend { float: none; } .metadata-grid { grid-template-columns: 1fr; } .metadata-grid .method { grid-column: auto; } .overlay-toolbar { align-items: stretch; flex-direction: column; } .viewer-heading { max-width: 42vw; } .viewer-controls button:nth-child(4), .viewer-controls button:nth-child(5), #zoom-level { display: none; } .viewer-side { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; } #viewer-stage { inset-top: 68px; } }
      @media print { .control-panel, .overlay-toolbar, #viewer { display: none !important; } body { background: white; color: #111; } .summary-grid { grid-template-columns: repeat(4, 1fr); } .stat, .match-card { background: white; box-shadow: none; } .match-card { break-after: page; } }
    </style>
  </head>
  <body>
    <header class="hero shell">
      <div class="hero-top">
        <div><p class="kicker">Casa La Arbolada · Source matching</p><h1>Photography QA dashboard</h1></div>
        <p class="hero-copy">Human verification of original source files against the currently published website images. This interface references existing files directly and performs no image correction, conversion, or upload.</p>
      </div>
      <section class="summary-grid" aria-label="Review summary">
        <div class="stat"><strong>${dashboardData.summary.totalOriginals}</strong><span>Total originals</span></div>
        <div class="stat"><strong>${dashboardData.summary.matched}</strong><span>Matched</span></div>
        <div class="stat"><strong>${dashboardData.summary.locked}</strong><span>Locked</span></div>
        <div class="stat"><strong>${dashboardData.summary.ambiguous}</strong><span>Ambiguous</span></div>
        <div class="stat"><strong>${dashboardData.summary.unmatched}</strong><span>Unmatched</span></div>
        <div class="stat"><strong>${dashboardData.summary.averageConfidence}%</strong><span>Average confidence</span></div>
        <div class="stat"><strong>${dashboardData.summary.housePhotos}</strong><span>House photos</span></div>
        <div class="stat"><strong>${dashboardData.summary.apartmentPhotos}</strong><span>Apartment photos</span></div>
      </section>
      <section class="approval-summary" aria-label="Approval summary">
        <div class="approval-stat"><strong id="approval-approved">0</strong><span>Approved</span></div>
        <div class="approval-stat"><strong id="approval-skipped">0</strong><span>Skipped</span></div>
        <div class="approval-stat"><strong id="approval-manual">0</strong><span>Needs manual editing</span></div>
        <div class="approval-stat"><strong id="approval-pending">0</strong><span>Pending</span></div>
        <div class="approval-stat credits"><strong id="processing-image-estimate">0</strong><span>Approved images to process</span></div>
      </section>
    </header>

    <section class="control-panel">
      <div class="shell">
        <div class="control-row">
          <label class="search-wrap"><span>⌕</span><input id="search" type="search" placeholder="Search ID, filename, room or property" autocomplete="off"></label>
          <select id="sort" aria-label="Sort comparisons"><option value="confidence">Sort: Confidence</option><option value="property">Sort: Property</option><option value="room">Sort: Room</option><option value="catalog">Sort: Catalog ID</option><option value="filename">Sort: Filename</option></select>
          <button class="primary-button" id="export-json" type="button">Export JSON</button><button class="primary-button" id="export-csv" type="button">Export CSV</button>
        </div>
        <nav class="filters" aria-label="Photo filters">
          <button class="filter-button is-active" data-filter="all">All</button><button class="filter-button" data-filter="review-approved">Approved</button><button class="filter-button" data-filter="review-skipped">Skipped</button><button class="filter-button" data-filter="review-manual">Needs manual editing</button><button class="filter-button" data-filter="review-pending">Pending</button><button class="filter-button" data-filter="house">House</button><button class="filter-button" data-filter="apartment">Apartment</button><button class="filter-button" data-filter="locked">Locked</button><button class="filter-button" data-filter="living-room">Living room</button><button class="filter-button" data-filter="bedroom">Bedroom</button><button class="filter-button" data-filter="kitchen">Kitchen</button><button class="filter-button" data-filter="bathroom">Bathroom</button><button class="filter-button" data-filter="exterior">Exterior</button><button class="filter-button" data-filter="park">Park</button><button class="filter-button" data-filter="creek">Creek</button><button class="filter-button" data-filter="detail">Detail</button>
        </nav>
        <div class="workflow-actions"><button class="primary-button" id="approve-high-confidence" type="button" disabled>Approve All High Confidence</button><button class="primary-button generate" id="generate-processing-batch" type="button" disabled>Generate Processing Batch</button><span id="persistence-status" data-mode="saving">Connecting to local review state…</span></div>
        <p id="batch-message"></p>
      </div>
    </section>

    <main class="shell">
      <div class="results-bar"><span id="result-count"></span><span>Click any preview for fullscreen comparison</span></div>
      <section id="comparison-grid" aria-live="polite"></section>
      <div id="empty-state" hidden>No catalog entries match the current filters.</div>
    </main>

    <section id="viewer" role="dialog" aria-modal="true" aria-label="Fullscreen photo comparison" hidden>
      <header class="viewer-header">
        <div class="viewer-heading"><strong id="viewer-title"></strong><span id="viewer-position"></span></div>
        <div class="viewer-controls"><button id="viewer-prev" type="button" title="Previous (←)">←</button><button id="viewer-next" type="button" title="Next (→)">→</button><button id="viewer-overlay-toggle" type="button">Overlay</button><button id="viewer-zoom-out" type="button" title="Zoom out">−</button><span id="zoom-level">100%</span><button id="viewer-zoom-in" type="button" title="Zoom in">+</button><button id="viewer-reset" type="button">Reset</button><button id="viewer-close" type="button" title="Close (Esc)">×</button></div>
      </header>
      <div id="viewer-stage">
        <div class="viewer-side" id="viewer-side"><div class="viewer-pane"><span class="panel-label">Original</span><img class="viewer-transform" data-viewer-original alt="Original fullscreen preview"><div class="image-fallback" hidden><strong>Original preview unavailable</strong><span></span></div></div><div class="viewer-pane"><span class="panel-label">Published</span><img class="viewer-transform" data-viewer-published alt="Published fullscreen preview"><div class="image-fallback" hidden><strong>Published preview unavailable</strong><span></span></div></div></div>
        <div class="viewer-overlay" id="viewer-overlay" hidden><div class="viewer-overlay-stage"><img class="viewer-transform" data-viewer-original alt="Original overlay preview"><div class="image-fallback" hidden><strong>Original preview unavailable</strong><span></span></div><div class="viewer-published-layer" id="viewer-published-layer"><img class="viewer-transform" data-viewer-published alt="Published overlay preview"><div class="image-fallback" hidden><strong>Published preview unavailable</strong><span></span></div></div><div class="viewer-divider" id="viewer-divider"></div><span class="overlay-caption overlay-caption-left">Original</span><span class="overlay-caption overlay-caption-right">Published</span></div></div>
      </div>
      <footer class="viewer-footer"><span>Scroll to zoom · drag to pan · arrows to navigate · ESC to close</span><label class="viewer-slider" id="viewer-slider-wrap" hidden><span>Original</span><input id="viewer-slider" type="range" min="0" max="100" value="50" aria-label="Fullscreen original to published overlay"><span>Published</span></label></footer>
    </section>

    <script id="dashboard-data" type="application/json">${serializedData}</script>
    <script>(${dashboardClient.toString()})();</script>
  </body>
</html>
`;

await fs.writeFile(outputPath, html);
console.log(`Generated ${path.relative(root, outputPath)} (${dashboardItems.length} QA records).`);
