import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.SITE_URL ?? 'http://127.0.0.1:4321';
const whatsappUrl =
  'https://wa.me/5492494567808?text=Hola%2C%20quisiera%20consultar%20disponibilidad%20en%20La%20Arbolada.';
const directionsUrl =
  'https://www.google.com/maps/search/?api=1&query=La+Arbolada%2C+Tandil%2C+Buenos+Aires';

async function goto(page: Page, path: string) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
}

test.use({ viewport: { width: 390, height: 844 } });

test('homepage is concise and links to both crawlable property routes', async ({ page }) => {
  await goto(page, '/');
  await expect(page.locator('h1')).toContainText('La Arbolada');
  await expect(page.locator('.room-chapter')).toHaveCount(0);
  await expect(page.locator('.horizontal-gallery')).toHaveCount(0);
  await expect(page.locator('main > section')).toHaveCount(6);
  await expect(page.locator('.immersive-nav__links a.is-active')).toHaveCount(1);
  await expect(page.locator('.immersive-nav__links a.is-active')).toHaveAttribute(
    'href',
    '/#inicio',
  );
  await expect(page.getByRole('link', { name: 'Ver Residencia principal' })).toHaveAttribute(
    'href',
    '/casa-principal',
  );
  await expect(page.getByRole('link', { name: 'Ver el departamento' })).toHaveAttribute(
    'href',
    '/alojamiento-independiente',
  );
  await expect(page.locator('body')).not.toContainText(/Ver mapa|View map/i);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Cómo llegar' }).first()).toHaveAttribute(
    'href',
    directionsUrl,
  );
});

test('dedicated routes work directly and keep complete, non-duplicated galleries', async ({
  page,
}) => {
  const expected = [
    { path: '/casa-principal', title: 'Residencia principal', rooms: 12, property: 'casa' },
    {
      path: '/alojamiento-independiente',
      title: 'Departamento independiente',
      rooms: 6,
      property: 'departamento',
    },
  ];

  for (const route of expected) {
    await goto(page, route.path);
    await expect(page.locator('h1')).toHaveText(route.title);
    await expect(page.locator(`.room-chapter[data-property="${route.property}"]`)).toHaveCount(
      route.rooms,
    );
    await expect(page.locator('.booking-action--primary')).toHaveCount(2);
    const imageIds = await page
      .locator('.room-chapter')
      .evaluateAll((chapters) =>
        chapters.flatMap((chapter) => JSON.parse(chapter.getAttribute('data-image-ids') ?? '[]')),
      );
    expect(new Set(imageIds).size).toBe(imageIds.length);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(
      process.env.PUBLIC_SITE_URL ? 1 : 0,
    );
    await expect(page).toHaveTitle(new RegExp(`${route.title}.*La Arbolada`));
    await expect(page.locator('nav a[aria-current="location"]').first()).toHaveAttribute(
      'href',
      '#espacios',
    );
  }
});

test('history navigation and real route anchors remain functional', async ({ page }) => {
  await goto(page, '/');
  await page.getByRole('link', { name: 'Ver Residencia principal' }).click();
  await expect(page).toHaveURL(/\/casa-principal$/);
  await page.goBack({ waitUntil: 'networkidle' });
  await expect(page).toHaveURL(new RegExp(`${baseUrl}/?$`));
  await page.goForward({ waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/casa-principal$/);
});

test('mobile menu traps focus, closes cleanly, and uses route-aware links', async ({ page }) => {
  await goto(page, '/casa-principal');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(page.getByRole('link', { name: 'La Arbolada' }).first()).toHaveAttribute(
    'href',
    '/',
  );
});

test('gallery controls, keyboard navigation, thumbnails, and lightbox work', async ({ page }) => {
  await goto(page, '/casa-principal');
  const chapter = page.locator('#casa-ambiente-3');
  await chapter.scrollIntoViewIfNeeded();
  const gallery = chapter.locator('.horizontal-gallery');
  await expect(gallery).toHaveAttribute('data-gallery-total', '4');
  await expect(page.locator('.whatsapp-bubble')).toHaveCSS('visibility', 'hidden');
  await chapter.getByRole('button', { name: 'Ver fotografía 2 de 4' }).click();
  await expect(gallery).toHaveAttribute('data-gallery-index', '2');
  await expect(gallery).toHaveAttribute('data-transitioning', 'false');
  await gallery.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gallery).toHaveAttribute('data-gallery-index', '3');
  await expect(gallery).toHaveAttribute('data-transitioning', 'false');
  await chapter.getByRole('button', { name: /Abrir Sala de estar y comedor/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('slow scrolling and gallery hydration never reposition the document', async ({ page }) => {
  await goto(page, '/casa-principal');
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
  });

  for (let step = 0; step < 24; step += 1) {
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 96);
    await page.waitForTimeout(90);
    const after = await page.evaluate(() => window.scrollY);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after - before).toBeLessThanOrEqual(180);
  }

  const chapter = page.locator('#casa-ambiente-3');
  await chapter.scrollIntoViewIfNeeded();
  const beforeThumbnail = await page.evaluate(() => window.scrollY);
  await chapter.getByRole('button', { name: 'Ver fotografía 2 de 4' }).click();
  await expect(chapter.locator('.horizontal-gallery')).toHaveAttribute(
    'data-transitioning',
    'false',
  );
  const afterThumbnail = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterThumbnail - beforeThumbnail)).toBeLessThanOrEqual(1);
});

test('WhatsApp is branded, exact, non-overlapping, and contact actions are accessible', async ({
  page,
}) => {
  await goto(page, '/');
  const bubble = page.locator('.whatsapp-bubble');
  await expect(bubble).toHaveAttribute('href', whatsappUrl);
  await expect(bubble).toHaveAttribute('target', '_blank');
  await expect(bubble).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(bubble.locator('svg path')).toHaveCount(1);
  const dimensions = await bubble.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      radius: getComputedStyle(element).borderRadius,
    };
  });
  expect(dimensions.width).toBe(58);
  expect(dimensions.height).toBe(58);
  expect(dimensions.radius).toBe('50%');

  const cta = page.locator('.booking-action--primary').last();
  await expect(cta).toHaveAttribute('href', whatsappUrl);
  await cta.scrollIntoViewIfNeeded();
  await expect(bubble).toHaveCSS('pointer-events', 'none');
  await expect(bubble).toHaveCSS('visibility', 'hidden');
});

for (const path of ['/', '/casa-principal', '/alojamiento-independiente']) {
  test(`${path} has no overflow, broken images, undersized controls, or console errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await goto(page, path);
    await page.evaluate(async () => {
      for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight) {
        scrollTo(0, top);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      scrollTo(0, 0);
    });
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      brokenImages: [...document.images].filter(
        (image) => image.complete && image.naturalWidth === 0,
      ).length,
      undersized: [...document.querySelectorAll<HTMLElement>('button, a')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
        })
        .map((element) => element.getAttribute('aria-label') || element.textContent?.trim()),
    }));
    expect(result.overflow).toBeLessThanOrEqual(1);
    expect(result.brokenImages).toBe(0);
    expect(result.undersized).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('reduced motion disables long hero and route animations', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await goto(page, '/');
  const result = await page.evaluate(() => ({
    heroHeight: document.querySelector('.immersive-hero')?.getBoundingClientRect().height,
    viewportHeight: innerHeight,
    visibleFrames: [...document.querySelectorAll('.immersive-hero__frame')].filter(
      (element) => getComputedStyle(element).display !== 'none',
    ).length,
    bubbleAnimations: getComputedStyle(document.querySelector('.whatsapp-bubble')!)
      .animationDuration,
  }));
  expect(result.heroHeight).toBe(result.viewportHeight);
  expect(result.visibleFrames).toBe(1);
  expect(['1e-05s', '0.01ms']).toContain(result.bubbleAnimations.split(',')[0].trim());
  await context.close();
});
