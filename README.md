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

scripts/                   # Inventario y generación de variantes de imágenes
reports/                   # Inventario de fuentes y verificaciones del sitio
tests/                     # Integridad de recorridos

```

### Datos y fotos

- `src/data/images.generated.ts` es el catálogo generado de imágenes y variantes.
- `src/data/images.ts` expone el catálogo de las fotografías actualmente publicadas.
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

## Gestión de imágenes

```bash
npm run assets:inventory       # Inventaría las fuentes
npm run assets:process         # Genera variantes y catálogo de imágenes
```

## Configuración

- Los datos de contacto están en `src/config/contact.ts`.
- La identidad SEO está en `src/config/site.ts`.
- Copiar `.env.example` a `.env` para la configuración local si se necesita definir `PUBLIC_SITE_URL`.

## Recorrido 3D

Existe una preparación futura en `src/features/tour-3d/README.md`. El sitio actual sólo deja una mención discreta y no carga dependencias 3D.
