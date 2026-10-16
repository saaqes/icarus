/** API HTTP del constructor: autenticación, proyectos, carpetas, recursos, exportación, solicitudes y administración. */
import type { IncomingMessage, ServerResponse } from "node:http";
import { checkAccessibility } from "../shared/export/a11y";
import { validateDoc } from "../shared/model/validate";
import { blankDoc, templateById } from "../shared/templates";
import type { Doc, ProjectStatus } from "../shared/model/types";
import type { Config } from "./config";
import * as D from "./data";
import type { Db } from "./db";
import { buildPackage, describeDoc, makeAssetLoader } from "./exporter";
import type { BlobStore } from "./storage";
import { sniff } from "./storage";
import { clientIp, hashPassword, HttpError, newId, nowIso, parseCookies, RateLimiter, readBody, readJson, requestCode, sendJson, sha256, token, verifyPassword } from "./util";
import { buildMessage, notifyAdmin, waUrl } from "./whatsapp";

export interface AppDeps { cfg: Config; db: Db; store: BlobStore; fetchImpl?: typeof fetch }

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: string[];
  user: D.UserRow | null;
}

type Handler = (c: Ctx) => Promise<void>;
interface Route { method: string; re: RegExp; auth: "none" | "user" | "admin"; h: Handler }

const COOKIE = "icarus_sid";

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function createApi(deps: AppDeps) {
  const { cfg, db, store } = deps;
  const limiter = new RateLimiter();
  const routes: Route[] = [];
  const add = (method: string, path: string, auth: Route["auth"], h: Handler) =>
    routes.push({ method, re: new RegExp(`^${path.replace(/:[a-z]+/gi, "([^/]+)")}$`), auth, h });

  /* ---------- utilidades ---------- */
  const baseUrl = (req: IncomingMessage): string => {
    if (cfg.publicBaseUrl) return cfg.publicBaseUrl;
    const proto = String(req.headers["x-forwarded-proto"] || (cfg.production ? "https" : "http")).split(",")[0];
    return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
  };
  const secure = (req: IncomingMessage) => cfg.production || String(req.headers["x-forwarded-proto"] || "").includes("https");
  const setCookie = (req: IncomingMessage, value: string, maxAge: number) =>
    `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req) ? "; Secure" : ""}`;

  async function promoteAdmin(u: D.UserRow): Promise<D.UserRow> {
    if (u.role !== "admin" && cfg.adminEmails.includes(u.email)) {
      await db.run(`UPDATE users SET role = 'admin' WHERE id = ?`, [u.id]);
      return { ...u, role: "admin" };
    }
    return u;
  }

  async function createExport(userId: string, projectId: string, rev: number, doc: Doc, projectName: string, req: IncomingMessage) {
    const loader = makeAssetLoader({
      distDir: cfg.distDir,
      uploaded: async (id) => {
        const a = await D.getAsset(db, id);
        return a ? store.get(a.storage_key) : null;
      },
    });
    const pkg = await buildPackage(doc, projectName, loader);
    const id = newId("exp");
    const key = `export-${id}.zip`;
    await store.put(key, pkg.zip);
    const tok = token(32);
    const expires = new Date(Date.now() + cfg.exportTtlDays * 86400_000).toISOString();
    await D.insertExport(db, { id, project_id: projectId, user_id: userId, rev, filename: pkg.filename, size: pkg.zip.length, storage: store.driver, storage_key: key, token_hash: sha256(tok), expires_at: expires });
    return { exportId: id, downloadUrl: `${baseUrl(req)}/api/downloads/${tok}`, expiresAt: expires, filename: pkg.filename, size: pkg.zip.length, files: pkg.files.length, warnings: pkg.warnings };
  }

  const parseDoc = (raw: unknown): Doc => {
    const r = validateDoc(raw);
    if (!r.ok || !r.doc) throw new HttpError(422, `Documento inválido: ${r.errors[0] ?? "estructura incorrecta"}`, "invalid_doc");
    return r.doc;
  };

  /* ---------- config ---------- */
  add("GET", "/api/config", "none", async ({ res }) => {
    sendJson(res, 200, {
      whatsappConfigured: !!cfg.whatsappNumber,
      cloudApiConfigured: !!(cfg.cloudApi.token && cfg.cloudApi.phoneNumberId && cfg.cloudApi.notifyTo && cfg.cloudApi.template),
      registrationOpen: cfg.registrationOpen,
      maxUploadMb: cfg.maxUploadMb,
      exportTtlDays: cfg.exportTtlDays,
      storage: store.driver,
      database: db.kind,
    });
  });

  /* ---------- autenticación ---------- */
  add("POST", "/api/auth/register", "none", async ({ req, res }) => {
    if (!cfg.registrationOpen) throw new HttpError(403, "El registro está cerrado.");
    if (!limiter.check(`reg:${clientIp(req)}`, 10, 3600_000)) throw new HttpError(429, "Demasiados intentos. Inténtalo más tarde.", "rate_limited");
    const b = await readJson(req, 20_000);
    const name = clean(b.name, 80), email = clean(b.email, 254).toLowerCase(), password = typeof b.password === "string" ? b.password : "";
    if (!name) throw new HttpError(400, "Escribe tu nombre.", "invalid");
    if (!EMAIL_RE.test(email)) throw new HttpError(400, "Escribe un correo válido.", "invalid");
    if (password.length < 8 || password.length > 128) throw new HttpError(400, "La contraseña debe tener entre 8 y 128 caracteres.", "invalid");
    if (await D.userByEmail(db, email)) throw new HttpError(409, "Ya existe una cuenta con ese correo.", "email_taken");
    let u = await D.createUser(db, name, email, await hashPassword(password), "user");
    u = await promoteAdmin(u);
    const tok = await D.createSession(db, u.id, cfg.sessionTtlDays, String(req.headers["user-agent"] || ""));
    sendJson(res, 201, { user: D.publicUser(u) }, { "Set-Cookie": setCookie(req, tok, cfg.sessionTtlDays * 86400) });
  });

  add("POST", "/api/auth/login", "none", async ({ req, res }) => {
    const b = await readJson(req, 20_000);
    const email = clean(b.email, 254).toLowerCase();
    if (!limiter.check(`login:${clientIp(req)}:${email}`, 8, 15 * 60_000)) throw new HttpError(429, "Demasiados intentos. Espera unos minutos.", "rate_limited");
    const u = await D.userByEmail(db, email);
    const ok = u && typeof b.password === "string" && (await verifyPassword(b.password, u.password_hash));
    if (!u || !ok) throw new HttpError(401, "Correo o contraseña incorrectos.", "bad_credentials");
    const user = await promoteAdmin(u);
    const tok = await D.createSession(db, user.id, cfg.sessionTtlDays, String(req.headers["user-agent"] || ""));
    sendJson(res, 200, { user: D.publicUser(user) }, { "Set-Cookie": setCookie(req, tok, cfg.sessionTtlDays * 86400) });
  });

  add("POST", "/api/auth/logout", "none", async ({ req, res }) => {
    const tok = parseCookies(req.headers.cookie)[COOKIE];
    if (tok) await D.deleteSession(db, tok);
    sendJson(res, 200, { ok: true }, { "Set-Cookie": setCookie(req, "", 0) });
  });

  add("GET", "/api/auth/me", "none", async ({ res, user }) => {
    sendJson(res, 200, { user: user ? D.publicUser(user) : null });
  });

  /* ---------- carpetas ---------- */
  add("GET", "/api/folders", "user", async ({ res, user }) => {
    sendJson(res, 200, { folders: (await D.listFolders(db, user!.id)).map(D.folderDto) });
  });
  add("POST", "/api/folders", "user", async ({ req, res, user }) => {
    const b = await readJson(req, 10_000);
    const name = clean(b.name, 80);
    if (!name) throw new HttpError(400, "La carpeta necesita un nombre.", "invalid");
    const f = await D.createFolder(db, user!.id, name, typeof b.parentId === "string" ? b.parentId : null);
    sendJson(res, 201, { folder: D.folderDto(f) });
  });
  add("PATCH", "/api/folders/:id", "user", async ({ req, res, user, params }) => {
    const b = await readJson(req, 10_000);
    const patch: { name?: string; parentId?: string | null } = {};
    if ("name" in b) { patch.name = clean(b.name, 80); if (!patch.name) throw new HttpError(400, "El nombre no puede estar vacío.", "invalid"); }
    if ("parentId" in b) patch.parentId = typeof b.parentId === "string" ? b.parentId : null;
    sendJson(res, 200, { folder: D.folderDto(await D.updateFolder(db, user!.id, params[0], patch)) });
  });
  add("DELETE", "/api/folders/:id", "user", async ({ res, user, params }) => {
    await D.deleteFolder(db, user!.id, params[0]);
    sendJson(res, 200, { ok: true });
  });

  /* ---------- proyectos ---------- */
  add("GET", "/api/projects", "user", async ({ res, url, user }) => {
    const q = url.searchParams;
    const projects = await D.listProjects(db, user!.id, {
      q: clean(q.get("q"), 80), folder: q.get("folder") || "all", archived: q.get("archived") === "1",
      status: q.get("status") || undefined, sort: q.get("sort") || "updated", dir: q.get("dir") || "desc",
    });
    sendJson(res, 200, { projects });
  });

  add("POST", "/api/projects", "user", async ({ req, res, user }) => {
    const b = await readJson(req);
    const name = clean(b.name, 120);
    if (!name) throw new HttpError(400, "El proyecto necesita un nombre.", "invalid");
    const siteName = clean(b.siteName, 80) || name;
    let doc: Doc;
    if (b.doc) doc = parseDoc(b.doc);
    else {
      const t = typeof b.templateId === "string" ? templateById(b.templateId) : undefined;
      doc = t ? t.build() : blankDoc(siteName);
      doc.settings.siteName = siteName;
      if (!doc.settings.title) doc.settings.title = siteName;
    }
    const contact = b.contact && typeof b.contact === "object"
      ? { owner: clean(b.contact.owner, 120), email: clean(b.contact.email, 254), phone: clean(b.contact.phone, 40), country: clean(b.contact.country, 60), language: clean(b.contact.language, 20) }
      : {};
    const brand = b.brand && typeof b.brand === "object"
      ? { colors: Array.isArray(b.brand.colors) ? b.brand.colors.filter((c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4) : [], style: clean(b.brand.style, 40) }
      : { colors: [], style: "" };
    const p = await D.createProject(db, user!.id, {
      name, siteName, description: clean(b.description, 1000), pageType: clean(b.pageType, 60), category: clean(b.category, 60), contact, brand,
      folderId: typeof b.folderId === "string" ? b.folderId : null, templateId: typeof b.templateId === "string" ? b.templateId.slice(0, 40) : null, doc,
    });
    sendJson(res, 201, { project: p });
  });

  add("GET", "/api/projects/:id", "user", async ({ res, user, params }) => {
    sendJson(res, 200, { project: await D.getProjectFull(db, user!.id, params[0]) });
  });

  add("PUT", "/api/projects/:id", "user", async ({ req, res, user, params }) => {
    const b = await readJson(req);
    const baseRev = Number(b.baseRev);
    if (!Number.isInteger(baseRev)) throw new HttpError(400, "Falta la revisión base.", "invalid");
    const doc = parseDoc(b.doc);
    const p = await D.saveProject(db, user!.id, params[0], doc, { baseRev, snapshot: b.snapshot === true, label: clean(b.label, 80) });
    sendJson(res, 200, { project: p });
  });

  add("PATCH", "/api/projects/:id", "user", async ({ req, res, user, params }) => {
    const b = await readJson(req, 50_000);
    const patch: D.MetaPatch = {};
    if ("name" in b) { patch.name = clean(b.name, 120); if (!patch.name) throw new HttpError(400, "El nombre no puede estar vacío.", "invalid"); }
    if ("siteName" in b) patch.siteName = clean(b.siteName, 80);
    if ("description" in b) patch.description = clean(b.description, 1000);
    if ("pageType" in b) patch.pageType = clean(b.pageType, 60);
    if ("category" in b) patch.category = clean(b.category, 60);
    if (b.contact && typeof b.contact === "object") patch.contact = { owner: clean(b.contact.owner, 120), email: clean(b.contact.email, 254), phone: clean(b.contact.phone, 40), country: clean(b.contact.country, 60), language: clean(b.contact.language, 20) };
    if (b.brand && typeof b.brand === "object") patch.brand = { colors: Array.isArray(b.brand.colors) ? b.brand.colors.filter((c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4) : [], style: clean(b.brand.style, 40) };
    if ("folderId" in b) patch.folderId = typeof b.folderId === "string" ? b.folderId : null;
    if ("status" in b) {
      if (!["draft", "editing", "ready"].includes(b.status)) throw new HttpError(400, "Estado no permitido.", "invalid");
      patch.status = b.status as ProjectStatus;
    }
    if ("archived" in b) patch.archived = b.archived === true;
    if ("templateId" in b) patch.templateId = typeof b.templateId === "string" ? b.templateId.slice(0, 40) : null;
    sendJson(res, 200, { project: await D.updateProjectMeta(db, user!.id, params[0], patch) });
  });

  add("DELETE", "/api/projects/:id", "user", async ({ res, user, params }) => {
    await D.deleteProject(db, user!.id, params[0]);
    sendJson(res, 200, { ok: true });
  });

  add("POST", "/api/projects/:id/duplicate", "user", async ({ req, res, user, params }) => {
    const b = await readJson(req, 10_000).catch(() => ({} as any));
    const src = await D.getProjectRow(db, user!.id, params[0]);
    if (!src) throw new HttpError(404, "Proyecto no encontrado.");
    const name = clean(b.name, 120) || `${src.name} copia`;
    sendJson(res, 201, { project: await D.duplicateProject(db, user!.id, params[0], name) });
  });

  add("GET", "/api/projects/:id/versions", "user", async ({ res, user, params }) => {
    if (!(await D.getProjectRow(db, user!.id, params[0]))) throw new HttpError(404, "Proyecto no encontrado.");
    sendJson(res, 200, { versions: (await D.listVersions(db, params[0])).map((v) => ({ version: Number(v.version), label: v.label, createdAt: v.created_at })) });
  });
  add("GET", "/api/projects/:id/versions/:n", "user", async ({ res, user, params }) => {
    if (!(await D.getProjectRow(db, user!.id, params[0]))) throw new HttpError(404, "Proyecto no encontrado.");
    const doc = await D.versionDoc(db, params[0], Number(params[1]));
    if (!doc) throw new HttpError(404, "Versión no encontrada.");
    sendJson(res, 200, { doc });
  });

  /* ---------- exportación y solicitud ---------- */
  add("POST", "/api/projects/:id/export", "user", async ({ req, res, user, params }) => {
    const full = await D.getProjectFull(db, user!.id, params[0]);
    const out = await createExport(user!.id, full.id, full.rev, full.doc, full.name, req);
    sendJson(res, 200, { export: out, accessibility: checkAccessibility(full.doc).length });
  });

  add("POST", "/api/projects/:id/request", "user", async ({ req, res, user, params }) => {
    const b = await readJson(req, 20_000);
    const full = await D.getProjectFull(db, user!.id, params[0]);
    if (Number(b.rev) !== full.rev) throw new HttpError(409, "El proyecto cambió desde la última vez que lo guardaste. Guarda de nuevo antes de solicitarlo.", "stale", { rev: full.rev });
    const blocking = checkAccessibility(full.doc).filter((i) => i.level === "error");
    if (blocking.length) throw new HttpError(422, `Hay ${blocking.length} problema(s) que impiden generar el sitio: ${blocking[0].message}`, "blocked", { issues: blocking.slice(0, 10) });
    const exp = await createExport(user!.id, full.id, full.rev, full.doc, full.name, req);
    const t = nowIso();
    const id = requestCode();
    const features = describeDoc(full.doc);
    const summary = { projectName: full.name, siteName: full.siteName, pageType: full.pageType || full.category, pageCount: full.pageCount, features, rev: full.rev, thumb: full.thumb };
    const contact = { ...full.contact, name: user!.name, accountEmail: user!.email };
    await db.tx(async (tx) => {
      await tx.run(`INSERT INTO requests (id, project_id, user_id, status, contact, summary, note, export_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, full.id, user!.id, "pending", JSON.stringify(contact), JSON.stringify(summary), clean(b.note, 600), exp.exportId, t, t]);
      await D.addEvent(tx, id, user!.id, "created", null, "pending", clean(b.note, 600));
      await tx.run(`UPDATE projects SET status = 'ready' WHERE id = ? AND status <> 'published'`, [full.id]);
    });
    const rs = { requestId: id, projectName: full.name, siteName: full.siteName, pageType: summary.pageType, pageCount: full.pageCount, features, downloadUrl: exp.downloadUrl, expiresAt: exp.expiresAt };
    const message = buildMessage(rs);
    const notify = await notifyAdmin(cfg, rs, deps.fetchImpl);
    if (notify.attempted) await D.addEvent(db, id, null, "notify", null, null, notify.detail);
    sendJson(res, 201, {
      request: { id, status: "pending", createdAt: t },
      export: exp,
      whatsapp: { configured: !!cfg.whatsappNumber, url: cfg.whatsappNumber ? waUrl(cfg.whatsappNumber, message) : null, message, note: "WhatsApp solo recibe el mensaje y el enlace de descarga; el archivo no se adjunta automáticamente." },
      notify,
    });
  });

  add("GET", "/api/requests", "user", async ({ res, user }) => {
    const rows = await db.all<D.RequestRow>(`SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, [user!.id]);
    sendJson(res, 200, { requests: rows.map(D.requestDto) });
  });

  /* ---------- descargas públicas con token ---------- */
  add("GET", "/api/downloads/:token", "none", async ({ req, res, params }) => {
    if (!limiter.check(`dl:${clientIp(req)}`, 60, 60_000)) throw new HttpError(429, "Demasiadas descargas. Espera un momento.", "rate_limited");
    const e = await D.exportByToken(db, params[0]);
    if (!e || e.revoked) throw new HttpError(404, "El enlace de descarga no existe o fue revocado.", "not_found");
    if (e.expires_at < nowIso()) throw new HttpError(410, "El enlace de descarga caducó. Solicita uno nuevo.", "expired");
    const data = await store.get(e.storage_key);
    if (!data) throw new HttpError(404, "El archivo ya no está disponible.", "not_found");
    await db.run(`UPDATE exports SET downloads = downloads + 1 WHERE id = ?`, [e.id]);
    res.writeHead(200, {
      "Content-Type": "application/zip", "Content-Length": data.length, "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${e.filename.replace(/[^\w.-]/g, "_")}"`, "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  });

  /* ---------- recursos ---------- */
  add("GET", "/api/assets", "user", async ({ res, user }) => {
    sendJson(res, 200, { assets: (await D.listAssets(db, user!.id)).map(D.assetDto) });
  });

  add("POST", "/api/assets", "user", async ({ req, res, user }) => {
    if (req.headers["x-requested-with"] !== "icarus") throw new HttpError(400, "Petición no válida.", "invalid");
    const buf = await readBody(req, cfg.maxUploadMb * 1024 * 1024);
    const kind = sniff(buf);
    if (!kind) throw new HttpError(415, "Formato no admitido. Usa PNG, JPG, WebP, GIF, AVIF, MP4 o WebM.", "bad_type");
    if (kind.kind === "image" && buf.length > 5 * 1024 * 1024) throw new HttpError(413, "Las imágenes pueden pesar hasta 5 MB.", "too_large");
    if ((await D.assetsBytes(db, user!.id)) + buf.length > cfg.userQuotaMb * 1024 * 1024) throw new HttpError(413, "Superaste tu espacio de almacenamiento.", "quota");
    let filename = "archivo";
    try { filename = decodeURIComponent(String(req.headers["x-filename"] || "archivo")); } catch { /* usa el nombre por defecto */ }
    filename = filename.replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ()]/g, "_").slice(0, 100) || "archivo";
    const id = newId("ast", 20);
    const key = `asset-${id}`;
    await store.put(key, buf);
    const projectId = String(req.headers["x-project-id"] || "");
    const row = await D.insertAsset(db, {
      id, user_id: user!.id, project_id: projectId && (await D.getProjectRow(db, user!.id, projectId)) ? projectId : null,
      kind: kind.kind, filename, mime: kind.mime, size: buf.length, storage: store.driver, storage_key: key,
    });
    sendJson(res, 201, { asset: D.assetDto(row) });
  });

  add("GET", "/api/assets/:id", "none", async ({ req, res, params }) => {
    const a = await D.getAsset(db, params[0]);
    if (!a) throw new HttpError(404, "Recurso no encontrado.", "not_found");
    const data = await store.get(a.storage_key);
    if (!data) throw new HttpError(404, "Recurso no disponible.", "not_found");
    const headers: Record<string, string | number> = {
      "Content-Type": a.mime, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "cross-origin",
      "Content-Disposition": `inline; filename="${a.filename.replace(/[^\w.-]/g, "_")}"`,
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      if (start > end || start >= data.length) { res.writeHead(416, { "Content-Range": `bytes */${data.length}` }); res.end(); return; }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": end - start + 1 });
      res.end(data.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { ...headers, "Content-Length": data.length });
    res.end(data);
  });

  add("DELETE", "/api/assets/:id", "user", async ({ res, url, user, params }) => {
    const a = await D.getAsset(db, params[0]);
    if (!a || a.user_id !== user!.id) throw new HttpError(404, "Recurso no encontrado.", "not_found");
    const used = await D.assetUsage(db, user!.id, a.id);
    if (used.length && url.searchParams.get("force") !== "1") throw new HttpError(409, `Este recurso se usa en: ${used.join(", ")}.`, "in_use", { projects: used });
    await store.delete(a.storage_key);
    await db.run(`DELETE FROM assets WHERE id = ?`, [a.id]);
    sendJson(res, 200, { ok: true });
  });

  /* ---------- administración ---------- */
  const reqDetail = async (id: string) => {
    const r = await db.get<D.RequestRow & { user_name: string; user_email: string }>(
      `SELECT r.*, u.name AS user_name, u.email AS user_email FROM requests r JOIN users u ON u.id = r.user_id WHERE r.id = ?`, [id]);
    if (!r) throw new HttpError(404, "Solicitud no encontrada.", "not_found");
    return r;
  };

  add("GET", "/api/admin/requests", "admin", async ({ res, url }) => {
    const where: string[] = [];
    const params: unknown[] = [];
    const st = url.searchParams.get("status");
    if (st && (D.REQUEST_STATUSES as readonly string[]).includes(st)) { where.push("r.status = ?"); params.push(st); }
    const q = clean(url.searchParams.get("q"), 60).toLowerCase().replace(/[%_]/g, "");
    if (q) { where.push("(lower(r.id) LIKE ? OR lower(u.name) LIKE ? OR lower(u.email) LIKE ? OR lower(r.summary) LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    const rows = await db.all<D.RequestRow & { user_name: string; user_email: string }>(
      `SELECT r.*, u.name AS user_name, u.email AS user_email FROM requests r JOIN users u ON u.id = r.user_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY r.created_at DESC LIMIT 300`, params);
    const counts = await db.all<{ status: string; n: number | string }>(`SELECT status, COUNT(*) AS n FROM requests GROUP BY status`);
    sendJson(res, 200, {
      requests: rows.map((r) => ({ ...D.requestDto(r), userName: r.user_name, userEmail: r.user_email })),
      counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
    });
  });

  add("GET", "/api/admin/requests/:id", "admin", async ({ req, res, params }) => {
    const r = await reqDetail(params[0]);
    const events = (await D.listEvents(db, r.id)).map((e) => ({ id: e.id, type: e.type, from: e.from_status, to: e.to_status, note: e.note, actor: e.actor_name, createdAt: e.created_at }));
    const exp = r.export_id ? await D.exportById(db, r.export_id) : undefined;
    let doc: Doc | null = null;
    let project = null;
    if (r.project_id) {
      const p = await D.getProjectFull(db, null, r.project_id).catch(() => null);
      if (p) { doc = p.doc; const { doc: _d, ...meta } = p; project = meta; }
    }
    sendJson(res, 200, {
      request: { ...D.requestDto(r), userName: r.user_name, userEmail: r.user_email },
      events,
      export: exp ? { id: exp.id, filename: exp.filename, size: Number(exp.size), expiresAt: exp.expires_at, expired: exp.expires_at < nowIso(), revoked: !!exp.revoked, downloads: Number(exp.downloads) } : null,
      project, doc, baseUrl: baseUrl(req),
    });
  });

  add("PATCH", "/api/admin/requests/:id", "admin", async ({ req, res, user, params }) => {
    const b = await readJson(req, 10_000);
    const r = await reqDetail(params[0]);
    const status = b.status as string;
    if (!(D.REQUEST_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Estado no válido.", "invalid");
    const note = clean(b.note, 600);
    await db.tx(async (tx) => {
      await tx.run(`UPDATE requests SET status = ?, updated_at = ?, note = CASE WHEN ? <> '' THEN ? ELSE note END WHERE id = ?`, [status, nowIso(), note, note, r.id]);
      await D.addEvent(tx, r.id, user!.id, status === r.status ? "note" : "status", r.status, status, note);
      if (status === "delivered" && r.project_id) await tx.run(`UPDATE projects SET status = 'published' WHERE id = ?`, [r.project_id]);
    });
    sendJson(res, 200, { request: D.requestDto(await reqDetail(r.id)) });
  });

  /** Genera un enlace de descarga nuevo (el anterior puede haber caducado) sobre el mismo paquete. */
  add("POST", "/api/admin/requests/:id/link", "admin", async ({ req, res, user, params }) => {
    const r = await reqDetail(params[0]);
    const old = r.export_id ? await D.exportById(db, r.export_id) : undefined;
    if (!old) throw new HttpError(404, "La solicitud no tiene paquete asociado.", "not_found");
    const tok = token(32);
    const id = newId("exp");
    const expires = new Date(Date.now() + cfg.exportTtlDays * 86400_000).toISOString();
    await D.insertExport(db, { id, project_id: old.project_id, user_id: old.user_id, rev: old.rev, filename: old.filename, size: old.size, storage: old.storage, storage_key: old.storage_key, token_hash: sha256(tok), expires_at: expires });
    await db.run(`UPDATE requests SET export_id = ?, updated_at = ? WHERE id = ?`, [id, nowIso(), r.id]);
    await D.addEvent(db, r.id, user!.id, "link", null, null, "Nuevo enlace de descarga generado");
    sendJson(res, 200, { downloadUrl: `${baseUrl(req)}/api/downloads/${tok}`, expiresAt: expires });
  });

  add("POST", "/api/admin/requests/:id/revoke", "admin", async ({ res, user, params }) => {
    const r = await reqDetail(params[0]);
    if (r.export_id) await db.run(`UPDATE exports SET revoked = 1 WHERE id = ?`, [r.export_id]);
    await D.addEvent(db, r.id, user!.id, "revoke", null, null, "Enlace de descarga revocado");
    sendJson(res, 200, { ok: true });
  });

  /* ---------- despacho ---------- */
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
    if (!route) {
      if (url.pathname.startsWith("/api/")) { sendJson(res, 404, { error: "Ruta no encontrada.", code: "not_found" }); return true; }
      return false;
    }
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.origin;
        if (origin && origin !== "null") {
          let host = "";
          try { host = new URL(origin).host; } catch { /* origen inválido */ }
          const own = String(req.headers["x-forwarded-host"] || req.headers.host || "");
          if (host !== own) throw new HttpError(403, "Origen no permitido.", "csrf");
        }
      }
      if (!limiter.check(`api:${clientIp(req)}`, 600, 60_000)) throw new HttpError(429, "Demasiadas peticiones.", "rate_limited");
      let user: D.UserRow | null = null;
      const tok = parseCookies(req.headers.cookie)[COOKIE];
      if (tok) user = (await D.sessionUser(db, tok)) ?? null;
      if (user) user = await promoteAdmin(user);
      if (route.auth !== "none" && !user) throw new HttpError(401, "Inicia sesión para continuar.", "unauthenticated");
      if (route.auth === "admin" && user!.role !== "admin") throw new HttpError(403, "No tienes permiso para esta acción.", "forbidden");
      const params = (route.re.exec(url.pathname) ?? []).slice(1).map((p) => decodeURIComponent(p));
      await route.h({ req, res, url, params, user });
    } catch (e) {
      if (e instanceof HttpError) sendJson(res, e.status, { error: e.message, code: e.code, ...e.extra });
      else {
        console.error("[api] error no controlado:", e);
        sendJson(res, 500, { error: "Ocurrió un error en el servidor.", code: "server_error" });
      }
    }
    return true;
  };
}
