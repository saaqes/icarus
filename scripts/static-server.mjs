// Servidor estático mínimo para dist/ (desarrollo local y pruebas). En producción lo sirve Render como sitio estático.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain", ".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt", ".woff2": "font/woff2" };
const REDIRECTS = { "/forja/demos/tienda": "/forja/demos/tienda-virtual/", "/forja/demos/sistema": "/forja/demos/sistema-administrativo/", "/forja/demos/reservas": "/forja/demos/sistema-reservas/", "/forja/demos/landing": "/forja/demos/landing-page/" };

/** `config`: si se indica, sustituye el contenido de /forja/studio/config.json (pruebas). */
export function startStatic({ dist, port = 0, host = "127.0.0.1", config = null, quiet = false }) {
  const root = path.resolve(dist);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      const redirect = REDIRECTS[url.pathname.replace(/\/$/, "")];
      if (redirect) { res.writeHead(301, { Location: redirect }); res.end(); return; }
      if (config && url.pathname === "/forja/studio/config.json") {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(config)); return;
      }
      if (url.pathname === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return; }
      const p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      let file = path.join(root, p);
      if (!file.startsWith(root)) throw new Error("fuera de dist");
      if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
      res.end(body);
    } catch {
      const body = await readFile(path.join(root, "404.html")).catch(() => "No encontrado");
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
    }
  });
  return new Promise((resolve) => server.listen(port, host, () => {
    const { port: p } = server.address();
    if (!quiet) console.log(`ICARUS en http://localhost:${p}`);
    resolve({ server, port: p, base: `http://${host}:${p}`, close: () => new Promise((r) => server.close(() => r())) });
  }));
}
