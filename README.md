# ICARUS — Marketing + Website Builder

Sitio **100 % estático** (sin servidor, sin base de datos, sin cuentas). Todo lo que crea una persona se guarda **en su propio dispositivo**.

| Ruta | Qué es |
|---|---|
| `/` | **ICARUS Marketing** — la página comercial. **No se modificó.** |
| `/forja/` | **ICARUS Website Builder** — presentación: vídeo real del editor, galería de plantillas, cómo funciona y preguntas (más el servicio a medida que ya existía). |
| `/forja/studio/` | **ICARUS Studio** — el editor visual: *Mis proyectos*, asistente, editor, vista previa y envío. |

## Cómo funciona (sin cuentas ni servidor)

1. **Crear un proyecto** (2 pasos) → se guarda como borrador en el dispositivo.
2. **Elegir una de 10 plantillas** (o empezar en blanco). Cada una es un documento real y editable.
3. **Editar**: seleccionar, arrastrar, redimensionar, rotar, texto en el lienzo, capas, alinear, guías, zoom, táctil, deshacer/rehacer, colores y tipografías globales, animaciones, versiones para escritorio / tableta / móvil.
4. **Guardado local**: autoguardado en **IndexedDB** del navegador, con confirmación real antes de mostrar «guardado», historial de versiones y carpetas. Las imágenes subidas también quedan en el dispositivo.
5. **Vista previa** real (sin interfaz del editor) en tres anchos.
6. **Finalizar**: aquí —y solo aquí— se piden **nombre y WhatsApp**. Dos caminos:
   * **Descargar sitio (.zip)**: HTML + CSS + JS + imágenes, generado en el navegador.
   * **QUIERO ESTA PÁGINA**: descarga el ZIP, guarda la solicitud en el historial local y abre **WhatsApp** (chat de ICARUS) con un mensaje listo: nombre, número, proyecto, tipo, páginas, características y código `ICA-XXXXXX`.
7. **Mover un proyecto a otro dispositivo**: *Exportar proyecto* (`.icarus.json`, incluye las imágenes) y *Importar proyecto* en «Mis proyectos».

### Qué no puede hacer (y por qué)

* **WhatsApp no recibe archivos desde un enlace.** `wa.me` solo abre el chat con el mensaje escrito. El ZIP lo adjunta la persona (clip 📎 → Documento) o con el botón **«Compartir el archivo»**, que usa el menú de compartir del dispositivo (Web Share) donde el navegador lo permite (móviles y algunos escritorios). **No existe envío automático sin un servidor** y la aplicación no finge que lo haya.
* **Los datos viven en el navegador.** Si la persona borra los datos del sitio, usa otro navegador/dispositivo o el modo privado (que se vacía al cerrar), no verá sus proyectos: por eso existe *Exportar proyecto*. Se pide al navegador almacenamiento persistente, pero no todos lo conceden.
* **ICARUS no ve los proyectos** hasta que la persona los envía por WhatsApp. No hay panel de administración.

## Configurar el número de WhatsApp

Define la variable de entorno **`WHATSAPP_NUMBER`** (solo dígitos, con código de país, p. ej. `573001112233`). El script de compilación la escribe en `dist/forja/studio/config.json`; **no está en el código fuente ni en el repositorio**.

* **Render**: servicio `icarus` → *Environment* → `WHATSAPP_NUMBER` → *Manual Deploy* (se lee al compilar; si la cambias, vuelve a desplegar).
* **Local**: `WHATSAPP_NUMBER=573001112233 npm run build`.

Sin número, el botón igualmente descarga el ZIP y guarda la solicitud, pero no abre WhatsApp (la pantalla lo explica).

## Desarrollo local

Requisitos: Node ≥ 22.

```bash
npm install
WHATSAPP_NUMBER=573001112233 npm run build   # typecheck (3 tsconfig) + compila TS + empaqueta Studio → dist/
npm start                                    # http://localhost:8080 (servidor estático de dist/)
```

### Pruebas

```bash
npm test             # unitarias: modelo, plantillas, exportación, ZIP, WhatsApp, validación (43)
npm run test:e2e     # + navegador real (Chromium de Playwright; requiere `npm run build`)
```

## Despliegue en Render

`render.yaml` define un **Static Site** (publica `dist/`, con cabeceras de seguridad y las redirecciones heredadas). Sube el repositorio y en Render: **New + → Blueprint** → *Apply*. Después define `WHATSAPP_NUMBER`. No hace falta base de datos.

La CSP permite `blob:` en imágenes y vídeo (los archivos subidos viven en el dispositivo) y `https:` (enlaces que pone la persona).

## Seguridad (resumen)

Todo corre en el navegador de la persona. El documento se **valida y sanea al guardar** (`shared/model/validate.ts`: tipos, enlaces `javascript:` descartados, URLs de recursos limitadas a archivos locales / biblioteca / https, CSS personalizado restringido a declaraciones simples). Las subidas se aceptan por **firma de bytes** (SVG excluido) con límites de tamaño. La vista previa se muestra en un `iframe sandbox`. El sitio exportado no incluye código del editor ni datos personales. No hay secretos en el repositorio.

## Estructura del código

```
shared/   modelo del documento, motor de estilos, validación, generador de sitio, ZIP, plantillas, mensaje de WhatsApp (puro)
studio/   editor (core/, canvas/, ui/, app/), almacenamiento local (lib/local.ts, lib/api.ts) y entradas (entries/)
src/      sitios estáticos existentes + HTML/CSS de Studio (src/forja/studio) y de la presentación
scripts/  build, servidor estático, tests, generador de ilustraciones y grabador del vídeo
tests/    pruebas unitarias y e2e
```

`studio/lib/api.ts` conserva la forma de la antigua API (proyectos, carpetas, versiones, archivos) pero trabaja sobre IndexedDB; el editor no sabe de dónde vienen los datos.

## Vídeo de presentación

`src/forja/studio/assets/media/tour.*` es una **grabación real del editor** hecha con `node scripts/record-tour.mjs` (Playwright + ffmpeg). Para regenerarlo tras cambiar la interfaz: `npm run build && node scripts/record-tour.mjs`.

## Limitaciones actuales

* Sin publicación automática ni dominio propio: el sitio se descarga o lo entrega ICARUS.
* Los formularios del sitio exportado abren WhatsApp o el correo del visitante; no envían datos a un servidor.
* Texto en línea con formato mixto (negrita/cursiva por palabra) no está soportado: el estilo se aplica al elemento completo.
* Vídeos: archivos MP4/WebM subidos o enlaces `https` (no incrustaciones de YouTube/Vimeo).
* Sin colaboración en tiempo real ni biblioteca de bloques compartidos.
