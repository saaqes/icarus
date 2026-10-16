/** Servidor de archivos estáticos (dist/) con las mismas cabeceras de seguridad que tenía render.yaml. */
import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { gzipSync } from "node:zlib";

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self'",
  "frame-src 'self' https://saaqes.github.io https://star-crumbs.onrender.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export function securityHeaders(production: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Security-Policy": production ? CSP : CSP.replace("; upgrade-insecure-requests", ""),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };
  if (production) h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return h;
}

/** Redirecciones heredadas de render.yaml. */
export const REDIRECTS: Record<string, string> = {
  "/forja/demos/tienda": "/forja/demos/tienda-virtual/",
  "/forja/demos/sistema": "/forja/demos/sistema-administrativo/",
  "/forja/demos/reservas": "/forja/demos/sistema-reservas/",
  "/forja/demos/landing": "/forja/demos/landing-page/",
};

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml",
  ".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt; charset=utf-8", ".woff2": "font/woff2", ".map": "application/json",
};
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml", ".webmanifest", ".vtt"]);

const gzipCache = new Map<string, { mtime: number; data: Buffer }>();

export function createStaticHandler(distDir: string, production: boolean) {
  const sec = securityHeaders(production);
  return async function serve(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const head = req.method === "HEAD";
    if (req.method !== "GET" && !head) { res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return; }
    const clean = url.pathname.replace(/\/+$/, "") || "/";
    const redirect = REDIRECTS[clean];
    if (redirect) { res.writeHead(301, { Location: redirect, ...sec }); res.end(); return; }

    let rel: string;
    try { rel = path.normalize(decodeURIComponent(url.pathname)); } catch { rel = "/"; }
    let file = path.join(distDir, rel);
    if (!file.startsWith(distDir)) { res.writeHead(403, sec); res.end(); return; }
    let st = await stat(file).catch(() => null);
    if (st?.isDirectory()) {
      if (!url.pathname.endsWith("/")) { res.writeHead(301, { Location: url.pathname + "/" + url.search, ...sec }); res.end(); return; }
      file = path.join(file, "index.html");
      st = await stat(file).catch(() => null);
    }
    let status = 200;
    if (!st?.isFile()) {
      file = path.join(distDir, "404.html");
      st = await stat(file).catch(() => null);
      status = 404;
      if (!st) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...sec }); res.end("No encontrado"); return; }
    }
    const ext = path.extname(file).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    let body: Buffer = await readFile(file);
    const headers: Record<string, string | number> = { "Content-Type": type, ...sec, Vary: "Accept-Encoding" };
    if (status === 200) {
      const rel2 = file.slice(distDir.length);
      headers["Cache-Control"] = /\.(html)$/.test(ext) || rel2 === "/sw.js" ? "no-cache" : rel2.includes("/assets/") || rel2.startsWith("/assets/") ? "public, max-age=86400" : "public, max-age=3600";
      headers.ETag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`;
      if (req.headers["if-none-match"] === headers.ETag) { res.writeHead(304, headers as any); res.end(); return; }
    }
    if (COMPRESSIBLE.has(ext) && String(req.headers["accept-encoding"] || "").includes("gzip") && body.length > 800) {
      const cached = gzipCache.get(file);
      if (cached && cached.mtime === st.mtimeMs) body = cached.data;
      else { body = Buffer.from(gzipSync(body)); gzipCache.set(file, { mtime: st.mtimeMs, data: body }); }
      headers["Content-Encoding"] = "gzip";
    }
    headers["Content-Length"] = body.length;
    res.writeHead(status, headers as any);
    res.end(head ? undefined : body);
  };
}
