import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const baseUrl = process.env.SITE_URL ?? 'http://localhost:4321';
const outputDirectory = path.resolve('reports/screenshots');
const requestedViewports = [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
];

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const failures = [];
const measurements = [];

async function loadPage(context, viewport) {
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport[0], height: viewport[1] });
  page.on('pageerror', (error) =>
    failures.push(`pageerror ${viewport.join('x')}: ${error.message}`),
  );
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(`console ${viewport.join('x')}: ${message.text()}`);
    }
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('main').waitFor();
  return page;
}

async function inspectViewport(viewport) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport[0], height: viewport[1] },
  });
  const page = await loadPage(context, viewport);

  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const broken = [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src);
    const tooSmall = [...document.querySelectorAll('main p, main li')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const visible = element.getBoundingClientRect().height > 0;
        return visible && Number.parseFloat(style.fontSize) < 18;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className || ''}`);
    const tooSmallControls = [...document.querySelectorAll('main a, main button')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const visible = element.getBoundingClientRect().height > 0;
        const hasText = Boolean(element.textContent?.trim());
        return visible && hasText && Number.parseFloat(style.fontSize) < 17;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className || ''}`);
    const undersizedButtons = [...document.querySelectorAll('button')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
      })
      .map(
        (element) => element.getAttribute('aria-label') || element.textContent?.trim() || 'button',
      );
    const overflowing = [...document.querySelectorAll('body *')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className || ''}`)
      .slice(0, 20);
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      overflow: Math.ceil(root.scrollWidth - root.clientWidth),
      hero: Math.round(
        document.querySelector('#inicio .immersive-hero__stage')?.getBoundingClientRect().height ??
          0,
      ),
      broken,
      tooSmall,
      tooSmallControls,
      undersizedButtons,
      overflowing,
      leakedPlaceholder: document.body.innerText.includes('Espacio 5'),
    };
  });
  measurements.push(result);
  if (result.overflow > 1)
    failures.push(`horizontal overflow ${result.viewport}: ${result.overflow}px`);
  if (result.hero !== viewport[1]) {
    failures.push(`hero height ${result.viewport}: expected ${viewport[1]}, got ${result.hero}`);
  }
  if (result.broken.length)
    failures.push(`broken images ${result.viewport}: ${result.broken.join(', ')}`);
  if (viewport[0] <= 430 && result.tooSmall.length) {
    failures.push(`mobile text below 18px ${result.viewport}: ${result.tooSmall.join(', ')}`);
  }
  if (viewport[0] <= 430 && result.tooSmallControls.length) {
    failures.push(
      `mobile controls below 17px ${result.viewport}: ${result.tooSmallControls.join(', ')}`,
    );
  }
  if (viewport[0] <= 430 && result.undersizedButtons.length) {
    failures.push(
      `mobile buttons below 44px ${result.viewport}: ${result.undersizedButtons.join(', ')}`,
    );
  }
  if (result.leakedPlaceholder)
    failures.push(`placeholder classification visible ${result.viewport}`);

  await context.close();
}

if (!process.env.INTERACTION_ONLY && !process.env.SKIP_MATRIX) {
  for (const viewport of requestedViewports) {
    await inspectViewport(viewport);
  }
}

if (process.env.MATRIX_ONLY) {
  await browser.close();
  console.log(JSON.stringify({ measurements, failures }, null, 2));
  process.exit(failures.length ? 1 : 0);
}

async function warmLazyImages(page) {
  await page.evaluate(async () => {
    const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
    for (
      let position = 0;
      position < document.documentElement.scrollHeight;
      position += innerHeight * 0.85
    ) {
      scrollTo(0, position);
      await delay(80);
    }
    scrollTo(0, 0);
    await delay(240);
  });
  await page
    .waitForFunction(() => [...document.images].every((image) => image.complete), null, {
      timeout: 12_000,
    })
    .catch(() => {});
  await page.evaluate(async () => {
    const visibleImages = [...document.images].filter((image) => image.getClientRects().length > 0);
    await Promise.allSettled(
      visibleImages.map((image) =>
        typeof image.decode === 'function' ? image.decode() : undefined,
      ),
    );
  });
}

async function captureLongMobilePage(page, outputPath, width, viewportHeight) {
  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const requestedPositions = [];
  for (let top = 0; top < totalHeight; top += viewportHeight) {
    requestedPositions.push(Math.min(top, Math.max(totalHeight - viewportHeight, 0)));
  }
  const positions = [...new Set(requestedPositions)];
  const pieces = [];

  for (const [index, requestedTop] of positions.entries()) {
    const actualTop = await page.evaluate((top) => {
      scrollTo(0, top);
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(scrollY))));
      });
    }, requestedTop);
    await page.waitForTimeout(150);
    const buffer = await page.screenshot();
    pieces.push({ input: buffer, left: 0, top: actualTop });

    if (index === 0) {
      await page.evaluate(() => {
        const nav = document.querySelector('.immersive-navbar');
        if (nav instanceof HTMLElement) nav.style.visibility = 'hidden';
      });
    }
  }

  await sharp({
    create: {
      width,
      height: totalHeight,
      channels: 3,
      background: '#FFF9F1',
    },
  })
    .composite(pieces)
    .png()
    .toFile(outputPath);

  await page.evaluate(() => {
    const nav = document.querySelector('.immersive-navbar');
    if (nav instanceof HTMLElement) nav.style.removeProperty('visibility');
    scrollTo(0, 0);
  });
}

async function captureSet(width, height, suffix) {
  const context = await browser.newContext({
    reducedMotion: 'no-preference',
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await loadPage(context, [width, height]);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
  });
  if (!process.env.FOCUSED_CAPTURE) {
    await warmLazyImages(page);
  }
  await page.waitForTimeout(700);

  const imageState = await page.evaluate(() => ({
    pending: [...document.images]
      .filter((image) => !image.complete && image.getClientRects().length > 0)
      .map((image) => image.currentSrc || image.src),
    broken: [...document.images]
      .filter(
        (image) => image.complete && image.naturalWidth === 0 && image.getClientRects().length > 0,
      )
      .map((image) => image.currentSrc || image.src),
  }));
  if (!process.env.FOCUSED_CAPTURE && imageState.pending.length) {
    failures.push(`pending images ${width}x${height}: ${imageState.pending.join(', ')}`);
  }
  if (imageState.broken.length) {
    failures.push(`broken images ${width}x${height}: ${imageState.broken.join(', ')}`);
  }

  if (!process.env.FOCUSED_CAPTURE) {
    const homeScreenshot = path.join(outputDirectory, `home-${suffix}.png`);
    if (suffix === 'mobile-390') {
      await captureLongMobilePage(page, homeScreenshot, width, height);
    } else {
      await page.screenshot({ path: homeScreenshot, fullPage: true });
    }
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outputDirectory, `hero-${suffix}.png`) });
  if (suffix === 'mobile-390') {
    for (const [frame, progress] of [
      [2, 0.39],
      [3, 0.62],
      [4, 0.9],
    ]) {
      await page.evaluate((ratio) => {
        const hero = document.querySelector('.immersive-hero');
        const distance = Math.max(
          (hero?.getBoundingClientRect().height ?? innerHeight) - innerHeight,
          0,
        );
        window.scrollTo({ top: distance * ratio, behavior: 'instant' });
      }, progress);
      await page.waitForTimeout(650);
      await page.screenshot({
        path: path.join(outputDirectory, `hero-mobile-390-frame-${frame}.png`),
      });
    }
  }
  const roomTop = await page.locator('#casa-ambiente-3').evaluate((element) => {
    const navHeight = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
    );
    return element.getBoundingClientRect().top + scrollY - navHeight - 24;
  });
  await page.evaluate((top) => scrollTo({ top: top + 140, behavior: 'instant' }), roomTop);
  await page.waitForTimeout(120);
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), roomTop);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outputDirectory, `room-${suffix}.png`) });
  const independentRoomTop = await page.locator('#departamento-ambiente-4').evaluate((element) => {
    const navHeight = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
    );
    return element.getBoundingClientRect().top + scrollY - navHeight - 24;
  });
  await page.evaluate(
    (top) => scrollTo({ top: top + 140, behavior: 'instant' }),
    independentRoomTop,
  );
  await page.waitForTimeout(120);
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), independentRoomTop);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outputDirectory, `independent-room-${suffix}.png`) });
  const locationTop = await page.locator('#ubicacion').evaluate((element) => {
    const navHeight = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
    );
    return element.getBoundingClientRect().top + scrollY - navHeight - 24;
  });
  await page.evaluate((top) => scrollTo({ top: top + 140, behavior: 'instant' }), locationTop);
  await page.waitForTimeout(120);
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), locationTop);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outputDirectory, `location-${suffix}.png`) });

  await context.close();
}

if (!process.env.INTERACTION_ONLY) {
  await captureSet(390, 844, 'mobile-390');
  await captureSet(1440, 900, 'desktop-1440');
}

const interactionContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'no-preference',
});
const interactionPage = await loadPage(interactionContext, [390, 844]);

const journeyIntegrity = await interactionPage.evaluate(() => {
  const expected = {
    casa: [
      'Entorno y llegada',
      'Fachada',
      'Living y comedor',
      'Cocina',
      'Dormitorio 1',
      'Dormitorio 2',
      'Dormitorio 3',
      'Dormitorio 4',
      'Baño 1',
      'Baño 2',
      'Patio',
      'Parque, arroyo y entorno verde',
    ],
    departamento: ['Acceso y entorno', 'Living', 'Cocina', 'Dormitorio', 'Baño', 'Entorno verde'],
  };

  return Object.entries(expected).flatMap(([property, titles]) => {
    const chapters = [...document.querySelectorAll(`.room-chapter[data-property="${property}"]`)];
    return titles.flatMap((title, index) => {
      const chapter = chapters[index];
      if (!chapter) return [`${property}: falta el capítulo ${index + 1} (${title})`];
      const issues = [];
      const number = index + 1;
      const imageRooms = JSON.parse(chapter.dataset.imageRooms ?? '[]');
      const heading = chapter.querySelector('h3')?.textContent?.trim();
      const progress = chapter.querySelector('.room-chapter__progress')?.textContent?.trim();
      const gallery = chapter.querySelector('.horizontal-gallery');
      const previous = chapter.querySelector('[data-direction="previous"]');
      const next = chapter.querySelector('[data-direction="next"]');

      if (chapter.dataset.room !== title || heading !== title) {
        issues.push(
          `${property} ${number}: título desincronizado (${chapter.dataset.room} / ${heading})`,
        );
      }
      if (Number(chapter.dataset.roomNumber) !== number) {
        issues.push(`${property} ${title}: número ${chapter.dataset.roomNumber}`);
      }
      if (!progress?.includes(String(number).padStart(2, '0'))) {
        issues.push(`${property} ${title}: progreso ${progress}`);
      }
      if (gallery?.dataset.room !== title) {
        issues.push(`${property} ${title}: galería ${gallery?.dataset.room}`);
      }
      if (imageRooms.some((room) => room !== title)) {
        issues.push(`${property} ${title}: imágenes de ${imageRooms.join(', ')}`);
      }
      if (number > 1 && previous?.getAttribute('href') !== `#${property}-ambiente-${number - 1}`) {
        issues.push(`${property} ${title}: anterior incorrecto`);
      }
      if (
        number < titles.length &&
        next?.getAttribute('href') !== `#${property}-ambiente-${number + 1}`
      ) {
        issues.push(`${property} ${title}: siguiente incorrecto`);
      }
      return issues;
    });
  });
});
if (journeyIntegrity.length) {
  failures.push(`journey integrity: ${journeyIntegrity.join('; ')}`);
}

const mobileJourneyProgress = await interactionPage
  .locator('.journey-progress')
  .first()
  .evaluate((element) => ({
    display: getComputedStyle(element).display,
    position: getComputedStyle(element).position,
  }));
if (mobileJourneyProgress.display === 'none' || mobileJourneyProgress.position === 'sticky') {
  failures.push(
    `mobile journey selector should be visible and non-sticky: ${JSON.stringify(mobileJourneyProgress)}`,
  );
}

const menuButton = interactionPage.getByRole('button', { name: /abrir men/i });
await menuButton.click();
await interactionPage.getByRole('navigation', { name: /navegaci/i }).waitFor();
await interactionPage.keyboard.press('Escape');
await interactionPage.waitForTimeout(350);

await interactionPage.evaluate(() => scrollTo(0, innerHeight * 1.15));
await interactionPage.waitForTimeout(950);
const heroMotion = await interactionPage.evaluate(() => {
  const progress = getComputedStyle(document.querySelector('[data-hero-progress]')).transform;
  const secondFrame = getComputedStyle(document.querySelectorAll('[data-hero-frame]')[1]).clipPath;
  return {
    progress,
    secondFrame,
    scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    heroHeight: document.querySelector('#inicio')?.getBoundingClientRect().height,
    pinSpacers: document.querySelectorAll('.pin-spacer').length,
    bodyOverflow: getComputedStyle(document.body).overflow,
    scrollLocked: document.body.hasAttribute('data-scroll-locked'),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
});
if (heroMotion.progress === 'none' || heroMotion.progress.includes('matrix(0,')) {
  failures.push(`hero progress did not animate: ${JSON.stringify(heroMotion)}`);
}
if (heroMotion.secondFrame.includes('100%')) {
  failures.push(`hero second frame did not enter: ${heroMotion.secondFrame}`);
}

await interactionPage.locator('#casa-ambiente-3').scrollIntoViewIfNeeded();
const nextPhoto = interactionPage
  .locator('#casa-ambiente-3')
  .getByRole('button', { name: /siguiente/i });
await nextPhoto.click();
await interactionPage.waitForTimeout(700);
const galleryStatus = await interactionPage
  .locator('#casa-ambiente-3 .horizontal-gallery__status span')
  .textContent();
if (!galleryStatus?.includes('02 / 04'))
  failures.push(`flip gallery did not advance: ${galleryStatus}`);
const galleryRoom = await interactionPage
  .locator('#casa-ambiente-3 .horizontal-gallery')
  .getAttribute('data-room');
const visibleImageRoom = await interactionPage
  .locator('#casa-ambiente-3 .horizontal-gallery__image')
  .getAttribute('data-image-room');
if (galleryRoom !== 'Living y comedor' || visibleImageRoom !== 'Living y comedor') {
  failures.push(`living gallery desynchronized: ${galleryRoom} / ${visibleImageRoom}`);
}

await interactionPage.locator('#ubicacion').scrollIntoViewIfNeeded();
await interactionPage.waitForTimeout(300);
await interactionPage.evaluate(() => scrollBy({ top: -120, behavior: 'instant' }));
await interactionPage.waitForTimeout(400);
const activeNav = await interactionPage
  .locator('.immersive-nav a[aria-current="location"]')
  .textContent();
if (activeNav?.trim() !== 'Ubicación') failures.push(`navbar active section is ${activeNav}`);
const visibleNavbar = await interactionPage.locator('.immersive-nav').evaluate((element) => {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && getComputedStyle(element).visibility !== 'hidden';
});
if (!visibleNavbar) failures.push('navbar did not return after upward scroll');
const fullscreenButton = interactionPage
  .locator('#casa-ambiente-3')
  .getByRole('button', { name: /pantalla completa/i });
await fullscreenButton.click();
await interactionPage.getByRole('dialog').waitFor();
await interactionPage.keyboard.press('ArrowRight');
await interactionPage.keyboard.press('Escape');

await interactionContext.close();
await browser.close();

console.log(JSON.stringify({ measurements, failures }, null, 2));
if (failures.length) process.exitCode = 1;
