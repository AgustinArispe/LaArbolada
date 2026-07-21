import { expect, test } from '@playwright/test';

const baseUrl = process.env.SITE_URL ?? 'http://127.0.0.1:4321';

const expected = {
  casa: [
    'Parque y llegada',
    'Exterior',
    'Sala de estar y comedor',
    'Cocina',
    'Dormitorio 1',
    'Dormitorio 2',
    'Dormitorio 3',
    'Dormitorio 4',
    'Baño 1',
    'Baño 2',
    'Patio',
    'Parque y arroyo',
  ],
  departamento: [
    'Acceso privado',
    'Sala de estar',
    'Cocina',
    'Dormitorio',
    'Baño',
    'Entorno natural',
  ],
} as const;

test.use({
  viewport: { width: 390, height: 844 },
  contextOptions: { reducedMotion: 'no-preference' },
});

test.beforeEach(async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
});

test('page hierarchy places amenities between introduction and main house', async ({ page }) => {
  const order = await page
    .locator('main > *')
    .evaluateAll((elements) => elements.map((element) => element.id || element.className));
  const introIndex = order.findIndex((value) => String(value).includes('property-prelude'));
  const amenitiesIndex = order.indexOf('amenities');
  const houseIndex = await page
    .locator('#casa')
    .evaluate((element) =>
      [...(element.parentElement?.parentElement?.children ?? [])].indexOf(element.parentElement!),
    );
  expect(introIndex).toBeGreaterThan(-1);
  expect(amenitiesIndex).toBeGreaterThan(introIndex);
  expect(houseIndex).toBeGreaterThan(amenitiesIndex);
});

test('las comodidades confirmadas se muestran en español', async ({ page }) => {
  const amenities = page.locator('#amenities');
  const amenitiesText = (await amenities.innerText()).replace(/\s+/g, ' ');
  for (const text of [
    '4 habitaciones',
    '7 camas',
    '8 personas',
    '1 habitación · 3 camas',
    'Alojamiento independiente',
    'Calefacción por radiadores',
    'Hogar a leña',
    'Wi-Fi',
    'Smart TV',
    'Ropa de cama incluida',
    'Toallas incluidas',
    'Parrilla',
    'Horno de barro',
    'Disponibles para uso de los huéspedes',
    'Amplio estacionamiento interno',
    'Parque arbolado',
    'Arroyo',
  ]) {
    expect(amenitiesText.toLowerCase()).toContain(text.toLowerCase());
  }
  await expect(amenities).not.toContainText(/pets|mascotas/i);
  await expect(page.locator('#casa')).toContainText('4 habitaciones · 7 camas · hasta 8 personas');
  await expect(page.locator('#alojamiento-independiente')).toContainText('1 habitación · 3 camas');
});

test('el desplazamiento nativo avanza con fluidez y no queda bloqueado', async ({ page }) => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.mouse.wheel(0, 720);
  await page.waitForTimeout(350);

  const state = await page.evaluate(() => ({
    scrollY,
    bodyOverflow: getComputedStyle(document.body).overflowY,
    heroHeight: document.querySelector('.immersive-hero')?.getBoundingClientRect().height ?? 0,
    viewportHeight: innerHeight,
  }));

  expect(state.scrollY).toBeGreaterThan(100);
  expect(state.bodyOverflow).not.toBe('hidden');
  expect(state.heroHeight).toBeLessThanOrEqual(state.viewportHeight * 2.31);
});

test('each room keeps its title, sequence, images, and manual presentation synchronized', async ({
  page,
}) => {
  for (const [property, titles] of Object.entries(expected)) {
    const chapters = page.locator(`.room-chapter[data-property="${property}"]`);
    await expect(chapters).toHaveCount(titles.length);

    for (const [index, title] of titles.entries()) {
      const chapter = chapters.nth(index);
      await expect(chapter).toHaveAttribute('data-room', title);
      await expect(chapter).toHaveAttribute('data-room-number', String(index + 1));
      await expect(chapter.locator('h3')).toHaveText(title);
      await expect(chapter.locator('.room-chapter__progress')).toHaveCount(0);
      await expect(chapter.locator('.room-chapter__image-count')).toHaveCount(0);
      await expect(chapter.locator('.horizontal-gallery')).toHaveAttribute('data-room', title);
      const imageRooms = JSON.parse((await chapter.getAttribute('data-image-rooms')) ?? '[]');
      expect(imageRooms.every((room: string) => room === title)).toBeTruthy();
      expect(await chapter.getAttribute('class')).toMatch(
        /room-chapter--(hero-media|framed|split|dark|panoramic|detail)/,
      );
    }
  }
});

test('gallery controls are symmetrical and frame remains static through transition', async ({
  page,
}) => {
  const chapter = page.locator('#casa-ambiente-3');
  await chapter.scrollIntoViewIfNeeded();
  const gallery = chapter.locator('.horizontal-gallery');
  const next = chapter.getByRole('button', { name: 'Fotografía siguiente' });
  const counter = chapter.locator('.horizontal-gallery__status');
  const frame = chapter.locator('.horizontal-gallery__frame');

  const dimensions = await page.locator('.gallery-navigation-button').evaluateAll((buttons) =>
    buttons.slice(0, 2).map((button) => {
      const style = getComputedStyle(button);
      return {
        width: style.width,
        height: style.height,
        padding: style.padding,
        border: style.borderWidth,
        radius: style.borderRadius,
      };
    }),
  );
  expect(dimensions[0]).toEqual(dimensions[1]);
  const counterWidth = await counter.evaluate((element) => getComputedStyle(element).width);
  await next.click();
  await expect(gallery).toHaveAttribute('data-transitioning', 'true');
  expect(await frame.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await expect(gallery).toHaveAttribute('data-transitioning', 'false');
  expect(await counter.evaluate((element) => getComputedStyle(element).width)).toBe(counterWidth);
  await expect(counter).toContainText('02 / 04');
  await expect(chapter.locator('.horizontal-gallery__image')).toHaveAttribute(
    'data-image-room',
    'Sala de estar y comedor',
  );
});

test('thumbnails, swipe, keyboard, and lightbox select the correct image', async ({ page }) => {
  const chapter = page.locator('#casa-ambiente-3');
  await chapter.scrollIntoViewIfNeeded();
  const gallery = chapter.locator('.horizontal-gallery');
  const secondThumbnail = chapter.getByRole('button', { name: 'Ver fotografía 2 de 4' });
  await secondThumbnail.click();
  await expect(gallery).toHaveAttribute('data-gallery-index', '2');
  await expect(secondThumbnail).toHaveAttribute('aria-current', 'true');
  await expect(gallery).toHaveAttribute('data-transitioning', 'false');

  await gallery.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gallery).toHaveAttribute('data-gallery-index', '3');
  await expect(gallery).toHaveAttribute('data-transitioning', 'false');

  const frame = chapter.locator('.horizontal-gallery__frame');
  const box = await frame.boundingBox();
  if (!box) throw new Error('Gallery frame missing');
  await page.mouse.move(box.x + box.width * 0.78, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(gallery).toHaveAttribute('data-gallery-index', '4');
  await expect(gallery).toHaveAttribute('data-transitioning', 'false');

  const imageId = await chapter.locator('.horizontal-gallery__image').getAttribute('data-image-id');
  await chapter
    .getByRole('button', { name: /Abrir Sala de estar y comedor en pantalla completa/ })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.gallery-dialog__media img')).toHaveAttribute(
    'data-image-id',
    imageId ?? '',
  );
  await page.keyboard.press('Escape');
});

test('mobile menu, WhatsApp, and equal contact actions work', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('link', { name: 'Comodidades' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  const url =
    'https://wa.me/5492494567808?text=Hola%2C%20quisiera%20consultar%20disponibilidad%20en%20Casa%20La%20Arbolada.';
  await expect(page.locator('.whatsapp-bubble')).toHaveAttribute('href', url);
  await expect(page.locator('.contact-panel__action--primary')).toHaveAttribute('href', url);
  const bubble = page.locator('.whatsapp-bubble');
  await expect(bubble).toBeVisible();
  await page.locator('.contact-panel__action--primary').scrollIntoViewIfNeeded();
  await expect(bubble).toHaveCSS('pointer-events', 'none');
  await expect(bubble).toHaveCSS('visibility', 'hidden');
  const primary = await page.locator('.contact-panel__action--primary').boundingBox();
  const secondary = await page.locator('.contact-panel__action--secondary').boundingBox();
  expect(primary?.height).toBe(secondary?.height);
});

test('mobile layout has no overflow or undersized controls', async ({ page }) => {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    undersized: [...document.querySelectorAll('button, a')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
      })
      .map((element) => element.getAttribute('aria-label') || element.textContent?.trim()),
    smallBody: [...document.querySelectorAll('main p, main li')]
      .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 18)
      .map((element) => element.className),
  }));
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.undersized).toEqual([]);
  expect(result.smallBody).toEqual([]);
});
