# Casa La Arbolada

Sitio editorial para el alquiler temporal de Casa La Arbolada y su alojamiento independiente, en Tandil.

## Stack

- Astro con TypeScript estricto y React.
- Tailwind CSS 4.
- GSAP y ScrollTrigger sólo para la secuencia narrativa del hero.
- Motion para microinteracciones de componentes React.
- Radix Dialog para menú móvil y lightbox accesibles.
- Sharp y el pipeline local de imágenes WebP.
- Instrument Serif y Manrope instaladas localmente.

El alias `@/*` apunta a `src/*`.

## Comandos

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
npm run assets:inventory
npm run assets:process
```

Para iniciar el servidor de desarrollo en este proyecto:

```bash
astro dev --background
```

Se administra con `astro dev status`, `astro dev logs` y `astro dev stop`.

## Fotografías y curaduría

- Los originales permanecen en `assets-raw`.
- `scripts/process-images.mjs` genera las variantes WebP y `src/data/images.generated.ts`.
- `src/data/imageOverrides.ts` documenta las correcciones manuales de ambientes, orden y focal points.
- `src/data/journeys.ts` define el recorrido curado y mantiene Casa y Departamento separados.

## Contacto

Los datos reales se configuran en `src/config/contact.ts`. Los canales incompletos no se renderizan en producción.

## Recorrido 3D

La preparación futura se conserva en `src/features/tour-3d/README.md`. La página actual sólo muestra una mención discreta y no carga dependencias 3D.
