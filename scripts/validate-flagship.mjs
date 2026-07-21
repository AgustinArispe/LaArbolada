import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SITE_URL ?? 'http://127.0.0.1:4321';
const outputDirectory = path.resolve('reports/screenshots/architecture');
const viewports = [
  [320, 568],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
];
const routes = [
  { slug: 'home', path: '/' },
  { slug: 'casa-principal', path: '/casa-principal' },
  { slug: 'alojamiento-independiente', path: '/alojamiento-independiente' },
];
const failures = [];
const measurements = [];

await Promise.all(
  routes.flatMap((route) => [
    mkdir(path.join(outputDirectory, route.slug, 'viewports'), { recursive: true }),
    mkdir(path.join(outputDirectory, route.slug, 'sections'), { recursive: true }),
  ]),
);

const browser = await chromium.launch();

async function open(context, route, label) {
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(`page error ${route.slug} ${label}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console error ${route.slug} ${label}: ${message.text()}`);
  });
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
  return page;
}

async function warm(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * 0.9) {
      scrollTo(0, top);
      await new Promise((resolve) => setTimeout(resolve, 24));
    }
    scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 180));
  });
}

async function inspect(route, viewport) {
  const label = `${viewport[0]}x${viewport[1]}`;
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    reducedMotion: 'no-preference',
  });
  const page = await open(context, route, label);
  await warm(page);
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length,
    visibleMapCopy: /Ver mapa|View map/i.test(document.body.innerText),
    iframeCount: document.querySelectorAll('iframe').length,
    bubble: (() => {
      const rect = document.querySelector('.whatsapp-bubble')?.getBoundingClientRect();
      return rect ? { width: rect.width, height: rect.height } : null;
    })(),
  }));
  measurements.push({ route: route.slug, viewport: label, ...result });
  if (result.overflow > 1) failures.push(`overflow ${route.slug} ${label}: ${result.overflow}px`);
  if (result.brokenImages) failures.push(`broken images ${route.slug} ${label}: ${result.brokenImages}`);
  if (result.visibleMapCopy) failures.push(`visible map activation copy ${route.slug} ${label}`);
  if (route.slug === 'home' && result.iframeCount) failures.push(`map iframe loaded on homepage ${label}`);
  if (result.bubble && Math.abs(result.bubble.width - result.bubble.height) > 0.5)
    failures.push(`non-square WhatsApp ${route.slug} ${label}`);
  await page.screenshot({
    path: path.join(outputDirectory, route.slug, 'viewports', `${label}.png`),
    fullPage: true,
  });
  await context.close();
}

async function shot(page, selector, filename, route) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(selector.includes('horizontal-gallery') ? 800 : 180);
  if (selector.includes('horizontal-gallery')) {
    const bubbleVisible = await page.locator('.whatsapp-bubble').evaluate(
      (element) => getComputedStyle(element).visibility !== 'hidden',
    );
    if (bubbleVisible) failures.push(`WhatsApp overlaps gallery viewport ${route.slug} ${filename}`);
  }
  await locator.screenshot({ path: path.join(outputDirectory, route.slug, 'sections', filename) });
}

async function sectionSet(route, viewport, mode) {
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await open(context, route, mode);
  if (route.slug === 'home') {
    await shot(page, '.whatsapp-bubble', `whatsapp-${mode}.png`, route);
    for (const [selector, name] of [
      ['.immersive-hero__stage', 'hero'],
      ['.property-introduction', 'introduction'],
      ['.accommodation-selector', 'accommodation-selector'],
      ['.outdoor-experience', 'outdoor-experience'],
      ['.compact-services', 'compact-services'],
      ['.location-card-section', 'location-card'],
      ['.booking-cta', 'contact'],
    ]) await shot(page, selector, `${name}-${mode}.png`, route);
  } else {
    for (const [selector, name] of [
      ['.property-hero', 'hero'],
      ['.property-quick-facts', 'quick-facts'],
      ['.room-chapter .horizontal-gallery', 'first-gallery'],
      ['.room-chapter .horizontal-gallery__controls', 'gallery-controls'],
      ['#consultar-antes-galeria', 'booking-before-gallery'],
      ['#contacto', 'booking-after-gallery'],
    ]) await shot(page, selector, `${name}-${mode}.png`, route);
  }
  await context.close();
}

for (const route of routes) {
  for (const viewport of viewports) await inspect(route, viewport);
  await sectionSet(route, { width: 390, height: 844 }, 'mobile');
  await sectionSet(route, { width: 1440, height: 900 }, 'desktop');
}

await browser.close();
console.log(JSON.stringify({ outputDirectory, measurements, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
