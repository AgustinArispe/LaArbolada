---
scope: src/pages/index.astro, src/components, src/styles, src/data
detector_findings: 0
playwright_viewport_failures: 0
playwright_journey_tests: 4
lighthouse:
  performance: 80
  accessibility: 100
  best_practices: 100
  seo: 100
score: 19
---

# Impeccable audit — tercera pasada final

## Veredicto

**Pass flagship.** La implementación ya no reproduce los problemas críticos de la baseline: no hay headings fantasma, capas sticky compitiendo, capítulos desincronizados ni fotografías horizontales recortadas dentro de bloques verticales. La identidad se apoya en fotografía real, Fraunces de peso medio, Source Sans 3 legible, color vivo y variación editorial controlada.

## Audit health score

| # | Dimensión | Puntaje | Evidencia |
|---|---|---:|---|
| 1 | Accessibility | 4/4 | Lighthouse 100; foco, Escape, focus trap, targets táctiles, contraste y reduced motion verificados |
| 2 | Performance | 3/4 | Lighthouse 80; CLS 0 y TBT 0 ms; LCP 5,1 s bajo emulación por el hero fotográfico |
| 3 | Responsive Design | 4/4 | Nueve viewports sin overflow, imágenes rotas, controles menores a 44 px ni texto móvil menor a 18 px |
| 4 | Theming | 4/4 | Estados photo/light/dark coherentes, tokens cromáticos y navbar estable |
| 5 | Anti-Patterns | 4/4 | Detector `[]`; sin pills, masonry móvil, cards repetidas ni placeholders inventados |
| **Total** | | **19/20** | **Excellent — oportunidad menor de optimización de LCP** |

## Animate

- Hero `100svh` con cuatro escenas controladas por scroll, máscara, crossfade y escala leve.
- Navbar direccional con retorno verificado, sin rebotes y sin ocultarse durante el menú.
- Flip Gallery con división horizontal superficial de 620 ms, bloqueo de input y crossfade reducido.
- Máscaras de entrada por variante, parallax leve, transiciones de estado y lightbox suave.
- Toda la capa de movimiento tiene alternativa `prefers-reduced-motion`.

## Polish

- Fraunces y Source Sans 3 locales, con pesos y tamaños de lectura reforzados.
- Contraste del selector inactivo corregido después del primer Lighthouse final.
- Una sola navbar, backgrounds sólidos sobre contenido y alineado de anclas mediante `--nav-height`.
- Radios editoriales, sombras suaves, controles de 44 px o más y foco visible.
- Ritmo vertical reducido; ningún progreso móvil permanece sticky sobre fotografías o párrafos.

## Adapt

- Validación en 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1366×768, 1440×900 y 1920×1080.
- Móvil usa progreso local, una fotografía por fila, `object-fit: contain`, menú fullscreen y capas contenidas para frames incompatibles con cover.
- Escritorio usa índice lateral sticky separado de la navbar y galerías amplias, sin cinta horizontal.
- La captura móvil larga se cose desde viewports reales para evitar límites de rasterizado de Chromium en páginas extremadamente altas.

## Integridad y evidencia

- `tests/journey-integrity.spec.ts`: 4/4.
- `scripts/verify-redesign.mjs`: 9/9 viewports, `failures: []`.
- Hero: alto exacto al viewport en las nueve resoluciones.
- DOM: ninguna aparición visible de `Espacio 5`.
- Casa y Departamento: título, contador, imagen, anterior y siguiente comparten la misma fuente de verdad.
- Lighthouse: 80 / 100 / 100 / 100; informe completo en `reports/lighthouse.json`.
- El proceso externo de Lighthouse devuelve una advertencia `EPERM` al limpiar su carpeta temporal después de escribir el informe; no es un fallo de la aplicación.

## Hallazgo restante

### [P3] LCP del hero bajo emulación

El hero prioriza una fotografía real de gran superficie y conserva variantes WebP/srcset. Una futura optimización puede evaluar una variante intermedia adicional o una compresión visualmente equivalente, sin degradar la imagen protagonista.

