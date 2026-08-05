# Casa La Arbolada

Sitio web editorial de alquiler temporal para **Casa La Arbolada**, en Tandil, Buenos Aires. Presenta dos opciones dentro del mismo predio —la casa principal y un alojamiento independiente— y convierte la consulta de disponibilidad en contacto directo por WhatsApp.

## Qué ofrece la web

### Inicio (`/`)

La portada cuenta la experiencia general de La Arbolada: parque, piedra, árboles y arroyo. Incluye:

- Un hero fotográfico inmersivo que cambia con el scroll.
- Una introducción de la propiedad y sus datos principales: 4 dormitorios, 7 camas, 2 baños, Wi-Fi y estacionamiento.
- Un selector para comparar y acceder a cada alojamiento.
- La presentación del entorno compartido: parque arbolado, arroyo, parrilla, horno de barro, patio y estacionamiento.
- Servicios incluidos, ubicación en Tandil y acceso a Google Maps.
- Llamadas a la acción para consultar disponibilidad por WhatsApp.
- Aviso de que no se aceptan mascotas.

### Casa principal (`/casa-principal`)

Presenta la residencia principal: 4 dormitorios, 7 camas, 2 baños, cocina equipada, sala de estar/comedor, calefacción por radiadores, hogar a leña, Wi-Fi, Smart TV, ropa blanca y acceso al parque.

El recorrido fotográfico está organizado por ambientes: llegada y parque, exterior, sala de estar/comedor, cocina, cuatro dormitorios, dos baños, patio y parque/arroyo. También permite volver al conjunto o pasar al alojamiento independiente.

### Alojamiento independiente (`/alojamiento-independiente`)

Muestra una alternativa privada dentro del mismo predio: dormitorio, baño privado, cocina, sala de estar, acceso propio, Wi-Fi, Smart TV y ropa blanca. Su galería recorre acceso, estar, cocina, dormitorio, baño y entorno natural.

## Cómo funciona la experiencia

- La navegación es fija, cambia de contraste según la sección visible y se oculta al bajar para liberar espacio; en móvil usa un menú accesible.
- El hero usa GSAP y ScrollTrigger para una secuencia de imágenes ligada al scroll. Si la persona prefiere menos movimiento, las animaciones se reducen.
- Las galerías se hidratan como componentes React: permiten avanzar con flechas, miniaturas, teclado y gestos laterales; incluyen vista ampliada accesible.
- Las fotos se entregan de forma responsive, con variantes para móvil, escritorio y alta resolución, focal points definidos por imagen, carga diferida y prioridad para los recursos principales.
- Cada página genera metadatos SEO, Open Graph y datos estructurados de alojamiento turístico. La URL canónica se activa al configurar `PUBLIC_SITE_URL`.
- El contacto no requiere backend: los botones generan el enlace de WhatsApp configurado en `src/config/contact.ts`; el enlace de cómo llegar usa Google Maps.

## Cómo está armado el proyecto

La aplicación es un sitio estático de Astro con tres rutas públicas. Astro compone las páginas y los componentes React se usan sólo donde hay interacción en el navegador.

```text
src/
├── pages/                 # Inicio y las dos páginas de alojamiento
├── components/            # Hero, navegación, galerías, CTA, ubicación y secciones
├── data/                  # Catálogo de fotos, orden, recorridos y focal points
├── config/                # Identidad SEO y datos de contacto
├── layouts/               # Layout global y metadatos
└── styles/                # Tokens, tipografía, animación y estilos globales

public/
├── images/                # Fotografías actualmente publicadas
└── images-processed/      # Candidatas procesadas; no se publican automáticamente

photo-processing/          # Pipeline y perfiles para la curaduría asistida de fotos
scripts/                   # Inventario, generación de derivados y herramientas de revisión
reports/                   # Informes, comparadores y estado de aprobaciones
tests/                     # Integridad de recorridos y pruebas del pipeline fotográfico
```

### Datos y fotos

- `src/data/images.generated.ts` es el catálogo generado de imágenes y variantes.
- `src/data/images.ts` elige entre las fotos originales y las procesadas mediante `PUBLIC_IMAGE_SET`; el valor seguro y actual es `original`.
- `src/data/imageOverrides.ts` conserva ajustes manuales: ambiente, orden, textos alternativos y punto focal.
- `src/data/journeys.ts` construye los recorridos curados y mantiene separadas Casa y Departamento.
- Los originales viven en `assets-raw`; `scripts/process-images.mjs` genera las variantes web y actualiza el catálogo.

### Tecnologías

- Astro 7, TypeScript estricto y React 19.
- Tailwind CSS 4 y CSS propio para la dirección visual.
- GSAP/ScrollTrigger para el hero y Motion para microinteracciones.
- Radix Dialog para menú móvil y lightbox accesibles.
- Sharp para normalización y derivados fotográficos.
- Fuentes locales DM Sans e Instrument Serif.

El alias `@/*` apunta a `src/*`.

## Edición fotográfica asistida con Gemini: plan en curso

El proyecto está preparando un flujo de **revelado fotográfico controlado**, no generación libre de imágenes. Su objetivo es mejorar luz, color y lectura de las fotos arquitectónicas sin alterar la escena, la arquitectura, los objetos ni el encuadre.

### Flujo previsto

1. Se parte de una foto original aprobada y se excluyen las imágenes bloqueadas.
2. Gemini analiza la foto y devuelve JSON validado contra un esquema: categoría, necesidades y señales visuales.
3. El proyecto combina ese análisis con un perfil editorial versionado por tipo de ambiente (fachada, patio, baño, cocina, living, dormitorio, jardín, pileta o perfil conservador).
4. Gemini recibe la foto original y el plan concreto para hacer una sola edición source-to-image. La instrucción prohíbe agregar, quitar, mover o redibujar elementos; también prohíbe crop, rotación, espejo, reencuadre y upscale.
5. El pipeline conserva separadamente el original enviado, los bytes exactos devueltos por Gemini y una versión normalizada. Rechaza de inmediato cambios de relación de aspecto, rotación, espejo o recorte; si sólo varía la resolución, normaliza a las dimensiones originales con Lanczos3.
6. Después calcula métricas de estructura y calidad (SSIM, edge SSIM, PSNR, luminancia y color) y hace una segunda validación semántica con Gemini.
7. Cada resultado queda en reportes y comparadores para revisión humana. Nunca reemplaza fotos del sitio por sí mismo.

Los perfiles, las plantillas y los planes tienen versión y SHA-256. Esos hashes forman parte de la identidad de caché, por lo que un cambio editorial invalida los resultados previos de forma trazable.

### Protección y aprobación

- Tres fotos de living ya aprobadas por la propietaria están bloqueadas permanentemente: no se analizan, suben, editan, comparan ni reemplazan.
- La validación final puede ser `PASS`, `REJECT` o `MANUAL_REVIEW`. Cambios geométricos, semánticos, estructurales o sobreprocesamiento se rechazan; casos ambiguos pasan a revisión manual.
- El piloto está compuesto por cinco imágenes representativas: exterior con cielo, vegetación e interior no bloqueado.
- El lote completo sólo puede empezar tras aprobar explícitamente los cinco resultados actuales en `reports/photo-pilot-review-state.json`.
- Aun después de aprobar, activar procesadas requiere una decisión explícita: cambiar `PUBLIC_IMAGE_SET=processed`, reconstruir y desplegar. La publicación vigente sigue usando originales.

### Estado actual y próximos pasos

El piloto pagado **no debe ejecutarse todavía**. La auditoría de preparación (`reports/production-readiness.md`) marca el sistema como no listo para producción por tres bloqueos principales:

1. Gemini devuelve tamaños por niveles, que no cumplen el contrato actual de dimensiones/proporción exactas de las fotos fuente.
2. La política de metadatos no está resuelta: la conversión local puede perder EXIF/orientación, aunque la configuración declara preservarlos.
3. Los reportes y derivados todavía no se publican como un conjunto transaccional; además, la vuelta a originales exige rebuild/redeploy y no es un rollback inmediato.

Antes de gastar créditos, hay que decidir el contrato de tamaño/normalización, definir honestamente qué metadatos se preservan, hacer atómica la promoción de cada conjunto de archivos y acordar el mecanismo de rollback. Luego se regeneran los reportes del piloto, se revisan y aprueban sus cinco fotos, y recién entonces se habilita el procesamiento completo.

La documentación técnica detallada está en `photo-processing/README.md`; el diagnóstico vigente, en `reports/production-readiness.md`.

## Desarrollo local

Requiere Node.js 22.12 o superior.

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

Para iniciar el servidor de desarrollo en segundo plano:

```bash
astro dev --background
```

Se administra con `astro dev status`, `astro dev logs` y `astro dev stop`.

## Comandos de imágenes

```bash
npm run assets:inventory       # Inventaría las fuentes
npm run assets:process         # Genera variantes y catálogo de imágenes
npm run photos:review          # Actualiza la revisión de clasificación
npm run photos:match-review    # Actualiza el panel de correspondencias
npm run photos:gemini          # Valida perfiles, locks y configuración; no usa API key
npm run photos:test            # Ejecuta pruebas de seguridad del pipeline
npm run photos:review-server   # Sirve el dashboard local de revisión
```

Los comandos `photos:gemini-pilot -- --confirm-upload` y `photos:gemini-full -- --confirm-upload` están reservados para el momento en que se resuelvan los bloqueos de producción y exista una aprobación humana explícita.

## Configuración

- Los datos de contacto están en `src/config/contact.ts`.
- La identidad SEO está en `src/config/site.ts`.
- Copiar `.env.example` a `.env` para la configuración local. Mantener `PUBLIC_IMAGE_SET=original` hasta completar la revisión fotográfica.
- `GEMINI_API_KEY` sólo hace falta para análisis, edición o validación remotos aprobados; nunca debe versionarse.

## Recorrido 3D

Existe una preparación futura en `src/features/tour-3d/README.md`. El sitio actual sólo deja una mención discreta y no carga dependencias 3D.
