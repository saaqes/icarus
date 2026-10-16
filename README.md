# ICARUS — Marketing + Website Builder

Este repositorio contiene **dos páginas** y un **servidor** pequeño (Node, sin framework):

| Ruta | Qué es | Tecnología |
|---|---|---|
| `/` | **ICARUS Marketing** — la página comercial (herramientas y servicios). **No se modificó.** | HTML + TypeScript estático (`src/site`) |
| `/forja/` | **ICARUS Website Builder** — presentación del constructor: vídeo, galería de plantillas, cómo funciona y FAQ (además del servicio de desarrollo a medida que ya existía). | `src/forja` + `studio/entries/welcome.ts` |
| `/forja/studio/` | **ICARUS Studio** — el editor visual: cuentas, *Mis proyectos*, asistente, editor, vista previa, exportación, solicitud por WhatsApp y panel de administración (`#/admin`). | `studio/` (TypeScript, sin framework) |
| `/api/*` | API: autenticación, proyectos, carpetas, recursos, descargas, solicitudes, administración. | `server/` |
| `/herramientas/trading-lab/` | Herramienta existente (sin cambios). | `src/site` |

Lo que hace el constructor:

1. **Crear un proyecto** (asistente en 2 pasos) y guardarlo como borrador desde el primer paso.
2. **Elegir una de 10 plantillas** (minimalista, corporativa, tecnológica, elegante, creativa, e-commerce, portafolio, agencia, landing de ventas, editorial) o empezar en blanco. Cada plantilla es un documento real y editable.
3. **Editar visualmente**: seleccionar, arrastrar, redimensionar, rotar, texto directamente sobre el lienzo, capas, agrupar, alinear, guías, zoom, gestos táctiles, deshacer/rehacer, colores globales, tipografías, animaciones, versiones para escritorio / tableta / móvil.
4. **Guardar** en base de datos (autoguardado con confirmación real del servidor, versiones, carpetas).
5. **Previsualizar** el sitio real (sin interfaz del editor) en tres anchos.
6. **Descargar** el sitio como ZIP (HTML + CSS + JS + imágenes) o pulsar **«QUIERO ESTA PÁGINA»**: se registra la solicitud, se genera el ZIP, se crea un enlace de descarga con caducidad y se abre WhatsApp con el resumen.
7. **Administrar** las solicitudes (`/forja/studio/#/admin`, solo rol administrador).

## Desarrollo local

Requisitos: Node ≥ 22.

```bash
npm install
npm run build          # typecheck (3 tsconfig) + compila TS + empaqueta Studio y servidor → dist/ y dist-server/
cp .env.example .env   # opcional; ver «Variables de entorno»
npm start              # http://localhost:8080  (SQLite en .data/icarus.db si no hay DATABASE_URL)
```

Para probar el panel de administración y WhatsApp en local:

```bash
ADMIN_EMAILS=tu@correo.com WHATSAPP_NUMBER=573001112233 npm start
# registra una cuenta con ese correo en /forja/studio/#/login → verás «Solicitudes»
```

`npm run preview` sigue sirviendo solo el sitio estático de `dist/` (sin API).

### Pruebas

```bash
npm test                                   # unitarias + API (SQLite en memoria)
TEST_DATABASE_URL=postgres://… npm test    # las mismas pruebas de API contra PostgreSQL real
npm run test:e2e                           # + navegador (Chromium de Playwright; requiere `npm run build`)
```

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Las importantes:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | PostgreSQL (producción). Sin ella se usa SQLite local. |
| `ADMIN_EMAILS` | Correos que reciben rol de administrador. |
| `WHATSAPP_NUMBER` | Número de ICARUS (solo dígitos, formato internacional). **No está en el código.** |
| `PUBLIC_BASE_URL` | URL pública para los enlaces de descarga (opcional; se deduce de la petición). |
| `EXPORT_TTL_DAYS` | Validez de los enlaces de descarga (14 por defecto). |
| `STORAGE_DRIVER` / `STORAGE_DIR` | `db` (por defecto) o `fs` con disco persistente. |
| `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_NOTIFY_TO`, `WHATSAPP_TEMPLATE` | Automatización opcional con la WhatsApp Business Platform. |

### Cómo configurar el número de WhatsApp

Pon `WHATSAPP_NUMBER=57XXXXXXXXXX` (solo dígitos) en las variables de entorno de Render (*Environment*) o en tu `.env`. Reinicia. Si falta, la solicitud se registra y el usuario recibe el enlace de descarga, pero no se abre WhatsApp (la pantalla lo dice claramente).

> **Abrir WhatsApp no adjunta archivos.** Un enlace `wa.me` solo abre el chat con el mensaje preparado, que incluye un **enlace seguro de descarga** del ZIP. Para notificar al administrador de forma automática hay que usar la API oficial: configura las cuatro variables `WHATSAPP_CLOUD_*` (plantilla aprobada con 3 variables: id, proyecto, enlace). Esa vía envía una notificación con el enlace, no un adjunto, y **no se ha podido probar en este entorno** (necesita credenciales de Meta); el código está en `server/whatsapp.ts` y cubierto con una prueba que simula la API.

## Cómo se generan y descargan las páginas

* El documento del proyecto es JSON estructurado (`shared/model`). El generador (`shared/export/render.ts`) lo convierte en `index.html` (+ una página por cada página del proyecto), `assets/styles.css` (con `@media` para tableta/móvil), `assets/site.js` (animaciones y formularios), `assets/img/*`, `robots.txt`, `sitemap.xml` (si defines la URL) y `README.md`.
* **Descarga directa**: botón *Exportar → Descargar sitio (.zip)* del editor, o en *Finalizar*.
* **Solicitud**: `POST /api/projects/:id/request` verifica que lo que se solicita es la revisión guardada, genera el ZIP en el servidor, lo guarda (tabla `blobs` o disco), crea un enlace `/api/downloads/<token>` con caducidad (se guarda solo el hash del token) y registra la solicitud y su historial. El administrador puede regenerar o revocar el enlace.
* El paquete solo contiene el sitio: ni el editor, ni datos personales del cliente, ni el documento interno.

## Base de datos

Migraciones versionadas en `server/migrations.ts` (se aplican solas al arrancar). Tablas: `users`, `sessions`, `folders`, `projects` (metadatos + tema/ajustes), `project_pages` (una fila por página con su árbol de componentes), `project_versions`, `assets`, `blobs`, `exports`, `requests`, `request_events`, `schema_migrations`. El mismo SQL corre en PostgreSQL y SQLite (`server/db.ts`).

## Despliegue en Render

`render.yaml` ahora define un **servicio web Node** + una base **PostgreSQL** (antes era un *Static Site*: el constructor necesita servidor y base de datos).

1. Sube el repositorio a GitHub y en Render: **New + → Blueprint** → elige el repo → **Apply**.
2. En el servicio `icarus` → *Environment*: define `WHATSAPP_NUMBER`, `ADMIN_EMAILS` y (opcional) `PUBLIC_BASE_URL`.
3. Verifica: `/`, `/forja/`, `/forja/studio/`, `/healthz`.

Notas importantes:
* El disco de Render es **efímero**: por eso proyectos, recursos subidos y ZIPs viven en PostgreSQL (`STORAGE_DRIVER=db`). Con un Render Disk montado puedes usar `STORAGE_DRIVER=fs`.
* El plan gratuito de PostgreSQL de Render caduca; para producción usa un plan de pago.
* El build usa `npm ci --include=dev` porque `NODE_ENV=production` omitiría las dependencias de compilación.
* Las cabeceras de seguridad y las redirecciones que estaban en `render.yaml` ahora las aplica `server/static.ts`. Un cambio en la CSP: `img-src` y `media-src` admiten `https:` (imágenes/vídeos que el usuario enlaza) y `blob:`.

## Seguridad (resumen)

Contraseñas con scrypt; sesiones en cookie `HttpOnly` + `SameSite=Lax` (hash en BD); comprobación de `Origin` en peticiones que modifican datos; límite de intentos en login/registro/descargas; propiedad de proyectos, carpetas y recursos **verificada en el servidor**; rol administrador verificado en cada petición `/api/admin/*`; validación y saneamiento del documento en servidor (`shared/model/validate.ts`: tipos, enlaces `javascript:` descartados, URLs de recursos limitadas, CSS personalizado restringido a declaraciones simples); subidas con tipo detectado por firma de bytes (SVG excluido), límites de tamaño y cuota; vista previa y miniaturas dentro de `iframe sandbox` (sin acceso a la sesión); el sitio exportado no incluye código del editor.

## Estructura del código

```
shared/   modelo del documento, motor de estilos, validación, generador de sitio, plantillas (puro: cliente + servidor)
server/   API HTTP, base de datos, migraciones, ZIP, WhatsApp, estáticos
studio/   editor (core/, canvas/, ui/, app/) y entradas (entries/studio, welcome, gallery)
src/      sitios estáticos existentes + HTML/CSS de Studio (src/forja/studio) y de la presentación (builder.css)
scripts/  build, tests, generador de ilustraciones y grabador del vídeo de presentación
tests/    pruebas unitarias, de API y e2e
```

## Vídeo de presentación

`src/forja/studio/assets/media/tour.*` es una **grabación real del editor** hecha con `node scripts/record-tour.mjs` (Playwright + ffmpeg): el mismo guion de este documento (plantilla, edición de texto, reordenar, tipografías y colores, imagen, animación, capas, responsive, vista previa). Para regenerarlo tras cambiar la interfaz: `npm run build && node scripts/record-tour.mjs`.

## Limitaciones actuales

* **No hay publicación automática** (URL pública, dominio propio): el sitio se descarga o lo entrega ICARUS. La arquitectura separa proyectos privados y sitio generado para añadirlo después.
* Los formularios del sitio exportado abren WhatsApp o el correo del visitante; no envían datos a un servidor.
* Texto en línea con formato mixto (negrita/cursiva por palabra) no está soportado: el estilo se aplica al elemento completo.
* Vídeos: archivos MP4/WebM subidos o enlaces `https` (no incrustaciones de YouTube/Vimeo).
* No hay colaboración en tiempo real ni biblioteca de bloques reutilizables compartidos (el modelo y el historial están pensados para añadirlos).
* La automatización por WhatsApp Business no se pudo probar sin credenciales.
