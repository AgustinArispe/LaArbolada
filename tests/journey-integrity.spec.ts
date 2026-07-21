import { expect, test } from '@playwright/test';

const baseUrl = process.env.SITE_URL ?? 'http://127.0.0.1:4321';

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
} as const;

test.use({
  viewport: { width: 390, height: 844 },
  contextOptions: { reducedMotion: 'no-preference' },
});

test('cada capítulo mantiene título, contador, imágenes y navegación sincronizados', async ({
  page,
}) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  for (const [property, titles] of Object.entries(expected)) {
    const chapters = page.locator(`.room-chapter[data-property="${property}"]`);
    await expect(chapters).toHaveCount(titles.length);

    for (const [index, title] of titles.entries()) {
      const number = index + 1;
      const chapter = chapters.nth(index);
      await expect(chapter).toHaveAttribute('data-room', title);
      await expect(chapter).toHaveAttribute('data-room-number', String(number));
      await expect(chapter.locator('h3')).toHaveText(title);
      await expect(chapter.locator('.room-chapter__progress')).toContainText(
        String(number).padStart(2, '0'),
      );
      await expect(chapter.locator('.horizontal-gallery')).toHaveAttribute('data-room', title);

      const imageRooms = JSON.parse((await chapter.getAttribute('data-image-rooms')) ?? '[]');
      expect(imageRooms.every((room: string) => room === title)).toBeTruthy();

      if (number > 1) {
        await expect(chapter.locator('[data-direction="previous"]')).toHaveAttribute(
          'href',
          `#${property}-ambiente-${number - 1}`,
        );
      }
      if (number < titles.length) {
        await expect(chapter.locator('[data-direction="next"]')).toHaveAttribute(
          'href',
          `#${property}-ambiente-${number + 1}`,
        );
      }
    }
  }
});

test('Fachada y Living y comedor conservan sus clasificaciones curadas', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const fachada = page.locator('#casa-ambiente-2');
  const living = page.locator('#casa-ambiente-3');
  expect(JSON.parse((await fachada.getAttribute('data-image-rooms')) ?? '[]')).toEqual([
    'Fachada',
    'Fachada',
    'Fachada',
    'Fachada',
  ]);
  expect(JSON.parse((await living.getAttribute('data-image-rooms')) ?? '[]')).toEqual([
    'Living y comedor',
    'Living y comedor',
    'Living y comedor',
    'Living y comedor',
  ]);
});

test('la foto visible y el contador del Living avanzan juntos', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const chapter = page.locator('#casa-ambiente-3');
  await chapter.scrollIntoViewIfNeeded();

  const gallery = chapter.locator('.horizontal-gallery');
  await expect(gallery).toHaveAttribute('data-room', 'Living y comedor');
  await expect(chapter.locator('.horizontal-gallery__image')).toHaveAttribute(
    'data-image-room',
    'Living y comedor',
  );
  await expect(chapter.locator('.horizontal-gallery__status')).toContainText('01 / 04');

  await chapter.getByRole('button', { name: /siguiente/i }).click();
  await expect(chapter.locator('.horizontal-gallery__status')).toContainText('02 / 04');
  await expect(chapter.locator('.horizontal-gallery__image')).toHaveAttribute(
    'data-image-room',
    'Living y comedor',
  );
});

test('el selector móvil es horizontal, visible y no sticky', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const selector = page.locator('.journey-progress').first();
  await expect(selector).toBeVisible();
  expect(await selector.evaluate((element) => getComputedStyle(element).position)).not.toBe(
    'sticky',
  );
  await expect(page.locator('#casa-ambiente-3 .room-chapter__progress')).toBeVisible();
});

test('WhatsApp usa una única URL configurada', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const url =
    'https://wa.me/5492494567808?text=Hola%2C%20quisiera%20consultar%20disponibilidad%20en%20Casa%20La%20Arbolada.';
  await expect(page.locator('.whatsapp-bubble')).toHaveAttribute('href', url);
  await expect(page.locator('.contact-panel__action')).toHaveAttribute('href', url);
});

test('cada ambiente conserva apertura en pantalla completa', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const chapter = page.locator('#casa-ambiente-3');
  await chapter.scrollIntoViewIfNeeded();
  await chapter.getByRole('button', { name: /pantalla completa/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
});
