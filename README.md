# ICARUS (TypeScript · sitio estático)

- `/` → ICARUS (herramientas) · `/forja/` → icarus-web (Forja tu página web) · `/herramientas/trading-lab/` → ICARUS Trading Lab (simulación)

## Local
    npm install
    npm run build      # typecheck (tsc) + compila TS con esbuild → dist/
    npm run preview    # http://localhost:8080

## Desplegar en Render (paso a paso)
1. Sube esta carpeta a un repositorio de GitHub (`node_modules/` y `dist/` ya están en .gitignore; incluye `package-lock.json`).
2. En https://dashboard.render.com → **New +** → **Blueprint** → elige el repo → Render lee `render.yaml` → **Apply**.
   (Alternativa manual: New + → Static Site → Build Command `npm ci && npm run build` → Publish Directory `dist` → variable `NODE_VERSION=22`.)
3. Espera el build; tu sitio quedará en `https://icarus.onrender.com` (o el nombre que elijas).
4. Verifica: `/`, `/forja/`, `/herramientas/trading-lab/`. Cabeceras: `curl -I https://TU-SITIO.onrender.com` (debe mostrar Content-Security-Policy, X-Frame-Options, HSTS…).
5. Dominio propio: Settings → Custom Domains → agrega el dominio y crea el CNAME que indica Render (HTTPS automático).
6. Cada `git push` a la rama principal redespliega solo. El servicio antiguo `icarus-web-eft3` se puede suspender: ahora vive en `/forja/`.

## Seguridad aplicada
CSP estricta (sin scripts inline, `script-src 'self'`), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS. Sin cookies ni analítica. Única petición de terceros: Google Fonts.
