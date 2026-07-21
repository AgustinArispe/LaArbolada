import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SITE_URL ?? 'http://127.0.0.1:4321';
const outputDirectory = path.resolve('reports/screenshots/flagship');
const matrixDirectory = path.join(outputDirectory, 'viewports');
const transitionDirectory = path.join(outputDirectory, 'transitions');
const viewports = [
  [320, 568],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
];

await Promise.all([
  mkdir(outputDirectory, { recursive: true }),
  mkdir(matrixDirectory, { recursive: true }),
  mkdir(transitionDirectory, { recursive: true }),
]);

const browser = await chromium.launch();
const failures = [];
const measurements = [];

async function loadPage(context, viewport) {
  const page = await context.newPage();
  const label = viewport.join('x');
  page.on('pageerror', (error) => failures.push(`page error ${label}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console error ${label}: ${message.text()}`);
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('main').waitFor();
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
  });
  return page;
}

async function warmImages(page) {
  await page.evaluate(async () => {
    const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
    for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * 0.92) {
      scrollTo(0, top);
      await wait(35);
    }
    scrollTo(0, 0);
    await wait(220);
  });
}

async function inspectViewport(viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    reducedMotion: 'no-preference',
  });
  const page = await loadPage(context, viewport);
  await warmImages(page);

  const result = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
    };
    const controls = [...document.querySelectorAll('button, a')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map((element) => element.getAttribute('aria-label') || element.textContent?.trim());
    const bodyText = [...document.querySelectorAll('main p, main li')]
      .filter(visible)
      .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 18)
      .map((element) => `${element.tagName}.${element.className}`);
    const brokenImages = [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src);
    const navButtons = [
      ...document.querySelectorAll('#casa-ambiente-3 .gallery-navigation-button'),
    ].slice(0, 2);
    const navDimensions = navButtons.map((button) => {
      const style = getComputedStyle(button);
      return [
        style.width,
        style.height,
        style.padding,
        style.borderWidth,
        style.borderRadius,
        style.boxShadow,
      ];
    });
    const ctas = [...document.querySelectorAll('.contact-panel__action')].map(
      (element) => element.getBoundingClientRect().height,
    );
    const headingFonts = [...document.querySelectorAll('h1, h2, h3')].map(
      (heading) => getComputedStyle(heading).fontFamily,
    );
    const thumbnails = [...document.querySelectorAll('.horizontal-gallery__thumbnails img')].map(
      (image) => ({
        fit: getComputedStyle(image).objectFit,
        width: image.getBoundingClientRect().width,
        height: image.getBoundingClientRect().height,
      }),
    );
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls,
      bodyText,
      brokenImages,
      navDimensions,
      ctas,
      headingFonts,
      thumbnails,
      frameTransform: getComputedStyle(
        document.querySelector('#casa-ambiente-3 .horizontal-gallery__frame'),
      ).transform,
      mapPointerEvents: getComputedStyle(document.querySelector('.interactive-map iframe'))
        .pointerEvents,
      obsoleteCopy:
        /Explore|Discover|Select|Photo by photo|Chapter \d|Environment \d|Space 5|The house|The apartment|Pets are not allowed|Important information|Check availability|Get directions|View map|Plan your stay/i.test(
          document.body.innerText,
        ),
    };
  });

  measurements.push(result);
  if (result.overflow > 1)
    failures.push(`horizontal overflow ${result.viewport}: ${result.overflow}px`);
  if (viewport[0] <= 430 && result.controls.length)
    failures.push(`controls below 44px ${result.viewport}: ${result.controls.join(', ')}`);
  if (viewport[0] <= 430 && result.bodyText.length)
    failures.push(`body text below 18px ${result.viewport}: ${result.bodyText.join(', ')}`);
  if (result.brokenImages.length)
    failures.push(`broken images ${result.viewport}: ${result.brokenImages.join(', ')}`);
  if (JSON.stringify(result.navDimensions[0]) !== JSON.stringify(result.navDimensions[1]))
    failures.push(`asymmetrical gallery buttons ${result.viewport}`);
  if (result.ctas.length === 2 && Math.abs(result.ctas[0] - result.ctas[1]) > 0.5)
    failures.push(`CTA heights differ ${result.viewport}: ${result.ctas.join(', ')}`);
  if (result.frameTransform !== 'none')
    failures.push(`gallery frame transformed ${result.viewport}: ${result.frameTransform}`);
  if (result.mapPointerEvents !== 'none')
    failures.push(`map captures scroll before activation ${result.viewport}`);
  if (result.headingFonts.some((font) => !font.includes('DM Sans')))
    failures.push(`non-DM Sans heading ${result.viewport}`);
  if (
    result.thumbnails.some(
      (thumbnail) => thumbnail.fit !== 'cover' || thumbnail.width <= 0 || thumbnail.height <= 0,
    )
  )
    failures.push(`distorted thumbnail setup ${result.viewport}`);
  if (result.obsoleteCopy) failures.push(`obsolete copy found ${result.viewport}`);

  await page.screenshot({ path: path.join(matrixDirectory, `${viewport[0]}x${viewport[1]}.png`) });
  await context.close();
}

async function screenshotLocator(page, selector, filename) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  if (selector === '#ubicacion') {
    await page.locator('#location-title').scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(selector === '.amenity-summary' ? 850 : 320);
  await locator.waitFor({ state: 'visible' });
  await locator.screenshot({ path: path.join(outputDirectory, filename) });
}

async function captureTransition(page, mode, duration) {
  const gallery = page.locator('#casa-ambiente-3 .horizontal-gallery');
  const frame = gallery.locator('.horizontal-gallery__frame');
  await frame.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await frame.screenshot({ path: path.join(transitionDirectory, `${mode}-0.png`) });
  await gallery.getByRole('button', { name: 'Fotografía siguiente' }).click();
  for (const [percent, wait] of [
    [25, duration * 0.25],
    [50, duration * 0.25],
    [75, duration * 0.25],
  ]) {
    await page.waitForTimeout(wait);
    await frame.screenshot({ path: path.join(transitionDirectory, `${mode}-${percent}.png`) });
    if (percent === 50)
      await frame.screenshot({
        path: path.join(outputDirectory, `gallery-transition-${mode}.png`),
      });
  }
  await page.waitForTimeout(duration * 0.3);
  await frame.screenshot({ path: path.join(transitionDirectory, `${mode}-100.png`) });
  const state = await gallery.evaluate((element) => ({
    index: element.getAttribute('data-gallery-index'),
    transitioning: element.getAttribute('data-transitioning'),
    transform: getComputedStyle(element.querySelector('.horizontal-gallery__frame')).transform,
  }));
  if (state.index !== '2' || state.transitioning !== 'false' || state.transform !== 'none') {
    failures.push(`invalid ${mode} transition final state: ${JSON.stringify(state)}`);
  }
}

async function captureSectionSet(viewport, mode) {
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    reducedMotion: 'no-preference',
  });
  const page = await loadPage(context, viewport);

  await screenshotLocator(page, '.immersive-hero__stage', `hero-${mode}.png`);
  await screenshotLocator(page, '.property-prelude__intro', `intro-${mode}.png`);
  await screenshotLocator(page, '.amenity-summary', `amenities-summary-${mode}.png`);
  await screenshotLocator(page, '.amenities-featured', `amenities-featured-${mode}.png`);
  await screenshotLocator(page, '.amenities-services', `amenities-services-${mode}.png`);
  await screenshotLocator(page, '#casa', `main-house-${mode}.png`);
  await screenshotLocator(
    page,
    '#casa-ambiente-3 .horizontal-gallery__controls',
    `gallery-controls-${mode}.png`,
  );
  await screenshotLocator(
    page,
    '#casa-ambiente-3 .horizontal-gallery__thumbnails',
    `gallery-thumbnails-${mode}.png`,
  );
  await captureTransition(page, mode, mode === 'mobile' ? 500 : 660);
  await screenshotLocator(page, '#alojamiento-independiente', `independent-${mode}.png`);
  await screenshotLocator(page, '#ubicacion', `location-${mode}.png`);
  await screenshotLocator(page, '#contacto', `contact-${mode}.png`);
  await page.locator('.contact-panel__action--primary').scrollIntoViewIfNeeded();
  await page.waitForTimeout(260);
  const contactBubble = await page.locator('.whatsapp-bubble').evaluate((element) => ({
    opacity: getComputedStyle(element).opacity,
    pointerEvents: getComputedStyle(element).pointerEvents,
  }));
  if (contactBubble.opacity !== '0' || contactBubble.pointerEvents !== 'none') {
    failures.push(
      `WhatsApp remains interactive over the contact CTA ${mode}: ${JSON.stringify(contactBubble)}`,
    );
  }
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await screenshotLocator(page, '.immersive-nav', `navbar-${mode}.png`);
  if (mode === 'mobile') await screenshotLocator(page, '.whatsapp-bubble', 'whatsapp-mobile.png');

  const overlap = await page.evaluate(() => {
    const whatsapp = document.querySelector('.whatsapp-bubble')?.getBoundingClientRect();
    const controls = document
      .querySelector('#casa-ambiente-3 .horizontal-gallery__controls')
      ?.getBoundingClientRect();
    if (!whatsapp || !controls) return false;
    return !(
      whatsapp.right <= controls.left ||
      whatsapp.left >= controls.right ||
      whatsapp.bottom <= controls.top ||
      whatsapp.top >= controls.bottom
    );
  });
  if (overlap) failures.push(`WhatsApp overlaps gallery controls ${mode}`);
  await context.close();
}

async function captureReduced(viewport, mode) {
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    reducedMotion: 'reduce',
  });
  const page = await loadPage(context, viewport);
  await page.screenshot({ path: path.join(outputDirectory, `reduced-${mode}.png`) });
  const result = await page.evaluate(() => ({
    heroHeight: document.querySelector('.immersive-hero')?.getBoundingClientRect().height,
    viewportHeight: innerHeight,
    visibleFrames: [...document.querySelectorAll('.immersive-hero__frame')].filter(
      (element) => getComputedStyle(element).display !== 'none',
    ).length,
  }));
  if (Math.abs(result.heroHeight - result.viewportHeight) > 1 || result.visibleFrames !== 1)
    failures.push(`reduced motion hero invalid ${mode}: ${JSON.stringify(result)}`);
  await context.close();
}

for (const viewport of viewports) await inspectViewport(viewport);
await captureSectionSet([390, 844], 'mobile');
await captureSectionSet([1440, 900], 'desktop');
await captureReduced([390, 844], 'mobile');
await captureReduced([1440, 900], 'desktop');

await browser.close();
console.log(JSON.stringify({ measurements, failures, outputDirectory }, null, 2));
process.exit(failures.length ? 1 : 0);
