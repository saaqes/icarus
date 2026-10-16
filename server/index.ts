/** Punto de entrada: sirve el sitio estático (dist/) y la API del constructor en el mismo proceso. */
import { createServer, type Server } from "node:http";
import { createApi } from "./app";
import { loadConfig, type Config } from "./config";
import { openDb, type Db } from "./db";
import { migrate } from "./migrations";
import { createStaticHandler, securityHeaders } from "./static";
import { createStore } from "./storage";

export interface Running { server: Server; db: Db; cfg: Config; close(): Promise<void> }

export async function start(overrides: Partial<Config> = {}, opts: { fetchImpl?: typeof fetch; quiet?: boolean } = {}): Promise<Running> {
  const cfg = loadConfig(process.env, overrides);
  const db = await openDb(cfg);
  const applied = await migrate(db);
  const store = createStore(cfg, db);
  const api = createApi({ cfg, db, store, fetchImpl: opts.fetchImpl });
  const serve = createStaticHandler(cfg.distDir, cfg.production);
  const sec = securityHeaders(cfg.production);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return; }
      if (url.pathname.startsWith("/api/")) {
        for (const [k, v] of Object.entries(sec)) if (k !== "Content-Security-Policy") res.setHeader(k, v);
        await api(req, res, url);
        return;
      }
      await serve(req, res, url);
    } catch (e) {
      console.error("[server] error:", e);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Error interno");
    }
  });
  await new Promise<void>((resolve) => server.listen(cfg.port, cfg.host, resolve));
  if (!opts.quiet) {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : cfg.port;
    console.log(`ICARUS escuchando en http://localhost:${port} · BD: ${db.kind}${applied ? ` (${applied} migración/es aplicada/s)` : ""} · archivos: ${store.driver}`);
    if (!cfg.whatsappNumber) console.log("Aviso: WHATSAPP_NUMBER no está configurado; la solicitud se registrará pero no se abrirá WhatsApp.");
    if (cfg.production && !cfg.databaseUrl) console.warn("ATENCIÓN: producción sin DATABASE_URL — se usaría SQLite en disco efímero.");
  }
  return {
    server, db, cfg,
    close: async () => { server.closeAllConnections(); await new Promise<void>((r) => server.close(() => r())); await db.close(); },
  };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  start().catch((e) => { console.error("No se pudo iniciar:", e); process.exit(1); });
  for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => process.exit(0));
}
