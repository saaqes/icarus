/** Acceso a datos: usuarios, sesiones, carpetas, proyectos (con páginas y versiones), recursos, exportaciones y solicitudes. */
import { walk } from "../shared/model/doc";
import { thumbnailSvg } from "../shared/thumb";
import type { Doc, Node, ProjectFull, ProjectMeta, ProjectStatus } from "../shared/model/types";
import type { Db } from "./db";
import { HttpError, newId, nowIso, sha256 } from "./util";

/* ---------- Usuarios y sesiones ---------- */

export interface UserRow { id: string; name: string; email: string; password_hash: string; role: "user" | "admin"; created_at: string }
export interface PublicUser { id: string; name: string; email: string; role: "user" | "admin" }
export const publicUser = (u: UserRow): PublicUser => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export async function createUser(db: Db, name: string, email: string, passwordHash: string, role: "user" | "admin"): Promise<UserRow> {
  const row: UserRow = { id: newId("usr"), name, email, password_hash: passwordHash, role, created_at: nowIso() };
  await db.run(`INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)`, [row.id, name, email, passwordHash, role, row.created_at]);
  return row;
}
export const userByEmail = (db: Db, email: string) => db.get<UserRow>(`SELECT * FROM users WHERE email = ?`, [email]);
export const userById = (db: Db, id: string) => db.get<UserRow>(`SELECT * FROM users WHERE id = ?`, [id]);

export async function createSession(db: Db, userId: string, ttlDays: number, ua: string): Promise<string> {
  const tok = (await import("./util")).token(32);
  const exp = new Date(Date.now() + ttlDays * 86400_000).toISOString();
  await db.run(`INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent) VALUES (?,?,?,?,?)`, [sha256(tok), userId, nowIso(), exp, ua.slice(0, 200)]);
  return tok;
}
export async function sessionUser(db: Db, tok: string): Promise<UserRow | undefined> {
  const r = await db.get<UserRow & { expires_at: string }>(
    `SELECT u.*, s.expires_at AS expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, [sha256(tok)]);
  if (!r) return undefined;
  if (r.expires_at < nowIso()) { await db.run(`DELETE FROM sessions WHERE id = ?`, [sha256(tok)]); return undefined; }
  return r;
}
export const deleteSession = (db: Db, tok: string) => db.run(`DELETE FROM sessions WHERE id = ?`, [sha256(tok)]);

/* ---------- Carpetas ---------- */

export interface FolderRow { id: string; user_id: string; parent_id: string | null; name: string; created_at: string; updated_at: string }
export const folderDto = (f: FolderRow) => ({ id: f.id, parentId: f.parent_id, name: f.name, createdAt: f.created_at, updatedAt: f.updated_at });

export const listFolders = (db: Db, userId: string) => db.all<FolderRow>(`SELECT * FROM folders WHERE user_id = ? ORDER BY lower(name)`, [userId]);
export const getFolder = (db: Db, userId: string, id: string) => db.get<FolderRow>(`SELECT * FROM folders WHERE id = ? AND user_id = ?`, [id, userId]);

export async function createFolder(db: Db, userId: string, name: string, parentId: string | null): Promise<FolderRow> {
  if (parentId && !(await getFolder(db, userId, parentId))) throw new HttpError(404, "La carpeta padre no existe.");
  const t = nowIso();
  const f: FolderRow = { id: newId("fld"), user_id: userId, parent_id: parentId, name, created_at: t, updated_at: t };
  await db.run(`INSERT INTO folders (id, user_id, parent_id, name, created_at, updated_at) VALUES (?,?,?,?,?,?)`, [f.id, userId, parentId, name, t, t]);
  return f;
}

/** ¿`candidate` es descendiente (o igual) de `id`? Evita ciclos al mover carpetas. */
async function isInside(db: Db, userId: string, candidate: string, id: string): Promise<boolean> {
  let cur: string | null = candidate;
  for (let i = 0; cur && i < 100; i++) {
    if (cur === id) return true;
    cur = (await getFolder(db, userId, cur))?.parent_id ?? null;
  }
  return false;
}

export async function updateFolder(db: Db, userId: string, id: string, patch: { name?: string; parentId?: string | null }): Promise<FolderRow> {
  const f = await getFolder(db, userId, id);
  if (!f) throw new HttpError(404, "Carpeta no encontrada.");
  let parent = f.parent_id;
  if (patch.parentId !== undefined) {
    if (patch.parentId) {
      if (!(await getFolder(db, userId, patch.parentId))) throw new HttpError(404, "La carpeta destino no existe.");
      if (await isInside(db, userId, patch.parentId, id)) throw new HttpError(400, "No puedes mover una carpeta dentro de sí misma.");
    }
    parent = patch.parentId;
  }
  const name = patch.name ?? f.name;
  await db.run(`UPDATE folders SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?`, [name, parent, nowIso(), id]);
  return { ...f, name, parent_id: parent };
}

/** Elimina la carpeta; sus subcarpetas y proyectos suben al nivel superior (no se pierde nada). */
export async function deleteFolder(db: Db, userId: string, id: string): Promise<void> {
  const f = await getFolder(db, userId, id);
  if (!f) throw new HttpError(404, "Carpeta no encontrada.");
  await db.tx(async (t) => {
    await t.run(`UPDATE folders SET parent_id = ? WHERE parent_id = ? AND user_id = ?`, [f.parent_id, id, userId]);
    await t.run(`UPDATE projects SET folder_id = ? WHERE folder_id = ? AND user_id = ?`, [f.parent_id, id, userId]);
    await t.run(`DELETE FROM folders WHERE id = ?`, [id]);
  });
}

/* ---------- Proyectos ---------- */

interface ProjectRow {
  id: string; user_id: string; folder_id: string | null; name: string; site_name: string; description: string; page_type: string;
  category: string; contact: string; brand: string; status: ProjectStatus; archived: number; doc_meta: string; responsive: string;
  seo: string; thumb: string; template_id: string | null; page_count: number; rev: number; created_at: string; updated_at: string;
}

const parse = <T>(s: string, d: T): T => { try { return JSON.parse(s) as T; } catch { return d; } };

export function projectDto(r: ProjectRow): ProjectMeta {
  return {
    id: r.id, folderId: r.folder_id, name: r.name, siteName: r.site_name, description: r.description, pageType: r.page_type,
    category: r.category, contact: parse(r.contact, {}), brand: parse(r.brand, { colors: [], style: "" }), status: r.status,
    archived: !!r.archived, pageCount: Number(r.page_count), rev: Number(r.rev), thumb: r.thumb, createdAt: r.created_at,
    updatedAt: r.updated_at, templateId: r.template_id,
  };
}

const META_COLS = `id, user_id, folder_id, name, site_name, description, page_type, category, contact, brand, status, archived, responsive, seo, thumb, template_id, page_count, rev, created_at, updated_at`;

export async function getProjectRow(db: Db, userId: string | null, id: string): Promise<ProjectRow | undefined> {
  return userId
    ? db.get<ProjectRow>(`SELECT * FROM projects WHERE id = ? AND user_id = ?`, [id, userId])
    : db.get<ProjectRow>(`SELECT * FROM projects WHERE id = ?`, [id]);
}

export interface ListQuery { q?: string; folder?: string; archived?: boolean; status?: string; sort?: string; dir?: string }

export async function listProjects(db: Db, userId: string, q: ListQuery): Promise<ProjectMeta[]> {
  const where = ["user_id = ?", "archived = ?"];
  const params: unknown[] = [userId, q.archived ? 1 : 0];
  if (q.q) { where.push("(lower(name) LIKE ? OR lower(site_name) LIKE ?)"); const like = `%${q.q.toLowerCase().replace(/[%_]/g, "")}%`; params.push(like, like); }
  if (q.folder === "root") where.push("folder_id IS NULL");
  else if (q.folder && q.folder !== "all") { where.push("folder_id = ?"); params.push(q.folder); }
  if (q.status && ["draft", "editing", "ready", "published"].includes(q.status)) { where.push("status = ?"); params.push(q.status); }
  const col = q.sort === "name" ? "lower(name)" : q.sort === "created" ? "created_at" : "updated_at";
  const dir = q.dir === "asc" ? "ASC" : "DESC";
  const rows = await db.all<ProjectRow>(`SELECT ${META_COLS} FROM projects WHERE ${where.join(" AND ")} ORDER BY ${col} ${dir} LIMIT 500`, params);
  return rows.map(projectDto);
}

function splitPages(doc: Doc): { id: string; name: string; slug: string; position: number; rootId: string; content: string; settings: string }[] {
  return doc.pages.map((p, i) => {
    const nodes: Record<string, Node> = {};
    walk(doc, p.rootId, (n) => { nodes[n.id] = n; });
    return { id: p.id, name: p.name, slug: p.slug, position: i, rootId: p.rootId, content: JSON.stringify({ nodes }), settings: JSON.stringify({ seo: p.seo ?? {} }) };
  });
}

async function writeDoc(t: Db, projectId: string, doc: Doc): Promise<void> {
  await t.run(`DELETE FROM project_pages WHERE project_id = ?`, [projectId]);
  for (const p of splitPages(doc)) {
    await t.run(`INSERT INTO project_pages (pk, id, project_id, name, slug, position, root_id, content, settings) VALUES (?,?,?,?,?,?,?,?,?)`,
      [`${projectId}:${p.id}`, p.id, projectId, p.name, p.slug, p.position, p.rootId, p.content, p.settings]);
  }
}

const docMeta = (doc: Doc) => JSON.stringify({ v: 1, theme: doc.theme, savedColors: doc.savedColors, settings: doc.settings });

export async function loadDoc(db: Db, row: Pick<ProjectRow, "id" | "doc_meta">): Promise<Doc> {
  const meta = parse<any>(row.doc_meta, {});
  const pages = await db.all<{ id: string; name: string; slug: string; root_id: string; content: string; settings: string }>(
    `SELECT id, name, slug, root_id, content, settings FROM project_pages WHERE project_id = ? ORDER BY position`, [row.id]);
  const nodes: Record<string, Node> = {};
  for (const p of pages) Object.assign(nodes, parse<any>(p.content, { nodes: {} }).nodes);
  return {
    v: 1,
    pages: pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, rootId: p.root_id, seo: parse<any>(p.settings, {}).seo })),
    nodes,
    theme: meta.theme,
    savedColors: meta.savedColors ?? [],
    settings: meta.settings,
  };
}

export async function getProjectFull(db: Db, userId: string | null, id: string): Promise<ProjectFull> {
  const row = await getProjectRow(db, userId, id);
  if (!row) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
  return { ...projectDto(row), doc: await loadDoc(db, row) };
}

export interface NewProject {
  name: string; siteName: string; description: string; pageType: string; category: string; contact: object; brand: object;
  folderId: string | null; templateId: string | null; doc: Doc;
}

export async function createProject(db: Db, userId: string, p: NewProject): Promise<ProjectMeta> {
  if (p.folderId && !(await getFolder(db, userId, p.folderId))) throw new HttpError(404, "La carpeta no existe.");
  const id = newId("prj");
  const t = nowIso();
  await db.tx(async (tx) => {
    await tx.run(
      `INSERT INTO projects (id, user_id, folder_id, name, site_name, description, page_type, category, contact, brand, status, archived, doc_meta, responsive, seo, thumb, template_id, page_count, rev, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?, 'draft', 0, ?,?,?,?,?,?, 1, ?, ?)`,
      [id, userId, p.folderId, p.name, p.siteName, p.description, p.pageType, p.category, JSON.stringify(p.contact), JSON.stringify(p.brand),
        docMeta(p.doc), JSON.stringify(p.doc.settings.breakpoints), JSON.stringify({ title: p.doc.settings.title, description: p.doc.settings.description }),
        thumbnailSvg(p.doc), p.templateId, p.doc.pages.length, t, t]);
    await writeDoc(tx, id, p.doc);
    await addVersion(tx, id, 1, p.doc, "Versión inicial");
  });
  return projectDto((await getProjectRow(db, userId, id))!);
}

async function addVersion(t: Db, projectId: string, version: number, doc: Doc, label: string): Promise<void> {
  await t.run(`INSERT INTO project_versions (id, project_id, version, doc, label, created_at) VALUES (?,?,?,?,?,?)`,
    [newId("ver"), projectId, version, JSON.stringify(doc), label, nowIso()]);
  await t.run(`DELETE FROM project_versions WHERE project_id = ? AND version <= ?`, [projectId, version - 40]);
}

export interface SaveOptions { baseRev: number; snapshot?: boolean; label?: string }

/** Guarda el documento con bloqueo optimista: si `baseRev` no coincide, otra sesión lo modificó. */
export async function saveProject(db: Db, userId: string, id: string, doc: Doc, opts: SaveOptions): Promise<ProjectMeta> {
  return db.tx(async (t) => {
    const row = await getProjectRow(t, userId, id);
    if (!row) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
    if (Number(row.rev) !== opts.baseRev) throw new HttpError(409, "El proyecto se modificó en otra pestaña o dispositivo.", "conflict", { rev: Number(row.rev) });
    const rev = Number(row.rev) + 1;
    const status: ProjectStatus = row.status === "draft" ? "editing" : row.status;
    const siteName = doc.settings.siteName || row.site_name;
    await t.run(
      `UPDATE projects SET doc_meta = ?, responsive = ?, seo = ?, thumb = ?, page_count = ?, rev = ?, status = ?, site_name = ?, updated_at = ? WHERE id = ?`,
      [docMeta(doc), JSON.stringify(doc.settings.breakpoints), JSON.stringify({ title: doc.settings.title, description: doc.settings.description, favicon: doc.settings.favicon }),
        thumbnailSvg(doc), doc.pages.length, rev, status, siteName, nowIso(), id]);
    await writeDoc(t, id, doc);
    const last = await t.get<{ version: number; created_at: string }>(`SELECT version, created_at FROM project_versions WHERE project_id = ? ORDER BY version DESC LIMIT 1`, [id]);
    const stale = !last || Date.now() - Date.parse(last.created_at) > 15 * 60_000;
    if (opts.snapshot || stale) await addVersion(t, id, rev, doc, opts.label || (opts.snapshot ? "Guardado manual" : "Autoguardado"));
    return projectDto((await getProjectRow(t, userId, id))!);
  });
}

export interface MetaPatch {
  name?: string; siteName?: string; description?: string; pageType?: string; category?: string; contact?: object; brand?: object;
  folderId?: string | null; status?: ProjectStatus; archived?: boolean;
}

export async function updateProjectMeta(db: Db, userId: string, id: string, p: MetaPatch): Promise<ProjectMeta> {
  const row = await getProjectRow(db, userId, id);
  if (!row) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
  if (p.folderId && !(await getFolder(db, userId, p.folderId))) throw new HttpError(404, "La carpeta no existe.");
  const m = {
    name: p.name ?? row.name, site_name: p.siteName ?? row.site_name, description: p.description ?? row.description,
    page_type: p.pageType ?? row.page_type, category: p.category ?? row.category,
    contact: p.contact ? JSON.stringify(p.contact) : row.contact, brand: p.brand ? JSON.stringify(p.brand) : row.brand,
    folder_id: p.folderId === undefined ? row.folder_id : p.folderId, status: p.status ?? row.status,
    archived: p.archived === undefined ? row.archived : p.archived ? 1 : 0,
  };
  await db.run(
    `UPDATE projects SET name=?, site_name=?, description=?, page_type=?, category=?, contact=?, brand=?, folder_id=?, status=?, archived=?, updated_at=? WHERE id=?`,
    [m.name, m.site_name, m.description, m.page_type, m.category, m.contact, m.brand, m.folder_id, m.status, m.archived, nowIso(), id]);
  return projectDto((await getProjectRow(db, userId, id))!);
}

export async function duplicateProject(db: Db, userId: string, id: string, name: string): Promise<ProjectMeta> {
  const full = await getProjectFull(db, userId, id);
  // los ids de nodos pueden repetirse entre proyectos: pertenecen a su propio documento
  return createProject(db, userId, {
    name, siteName: full.siteName, description: full.description, pageType: full.pageType, category: full.category,
    contact: full.contact, brand: full.brand, folderId: full.folderId, templateId: full.templateId, doc: full.doc,
  });
}

export async function deleteProject(db: Db, userId: string, id: string): Promise<void> {
  const r = await db.run(`DELETE FROM projects WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!r.changes) throw new HttpError(404, "Proyecto no encontrado.", "not_found");
}

export const listVersions = (db: Db, id: string) =>
  db.all<{ version: number; label: string; created_at: string }>(`SELECT version, label, created_at FROM project_versions WHERE project_id = ? ORDER BY version DESC LIMIT 40`, [id]);

export async function versionDoc(db: Db, id: string, version: number): Promise<Doc | null> {
  const r = await db.get<{ doc: string }>(`SELECT doc FROM project_versions WHERE project_id = ? AND version = ?`, [id, version]);
  return r ? (JSON.parse(r.doc) as Doc) : null;
}

/* ---------- Recursos ---------- */

export interface AssetRow { id: string; user_id: string; project_id: string | null; kind: string; filename: string; mime: string; size: number; storage: string; storage_key: string; created_at: string }
export const assetDto = (a: AssetRow) => ({ id: a.id, url: `/api/assets/${a.id}`, kind: a.kind, name: a.filename, mime: a.mime, size: Number(a.size), createdAt: a.created_at, projectId: a.project_id });
export const listAssets = (db: Db, userId: string) => db.all<AssetRow>(`SELECT * FROM assets WHERE user_id = ? ORDER BY created_at DESC LIMIT 500`, [userId]);
export const getAsset = (db: Db, id: string) => db.get<AssetRow>(`SELECT * FROM assets WHERE id = ?`, [id]);
export async function assetsBytes(db: Db, userId: string): Promise<number> {
  const r = await db.get<{ s: number | string | null }>(`SELECT SUM(size) AS s FROM assets WHERE user_id = ?`, [userId]);
  return Number(r?.s ?? 0);
}
export async function insertAsset(db: Db, a: Omit<AssetRow, "created_at">): Promise<AssetRow> {
  const t = nowIso();
  await db.run(`INSERT INTO assets (id, user_id, project_id, kind, filename, mime, size, storage, storage_key, meta, created_at) VALUES (?,?,?,?,?,?,?,?,?,'{}',?)`,
    [a.id, a.user_id, a.project_id, a.kind, a.filename, a.mime, a.size, a.storage, a.storage_key, t]);
  return { ...a, created_at: t };
}

/** Proyectos del usuario que referencian un recurso. */
export async function assetUsage(db: Db, userId: string, assetId: string): Promise<string[]> {
  const rows = await db.all<{ name: string }>(
    `SELECT DISTINCT p.name AS name FROM project_pages g JOIN projects p ON p.id = g.project_id WHERE p.user_id = ? AND g.content LIKE ?`, [userId, `%/api/assets/${assetId}%`]);
  return rows.map((r) => r.name);
}

/* ---------- Exportaciones y solicitudes ---------- */

export interface ExportRow { id: string; project_id: string | null; user_id: string; rev: number; filename: string; size: number; storage: string; storage_key: string; token_hash: string; expires_at: string; revoked: number; downloads: number; created_at: string }

export async function insertExport(db: Db, e: Omit<ExportRow, "created_at" | "downloads" | "revoked">): Promise<void> {
  await db.run(`INSERT INTO exports (id, project_id, user_id, rev, filename, size, storage, storage_key, token_hash, expires_at, revoked, downloads, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?)`,
    [e.id, e.project_id, e.user_id, e.rev, e.filename, e.size, e.storage, e.storage_key, e.token_hash, e.expires_at, nowIso()]);
}
export const exportByToken = (db: Db, tok: string) => db.get<ExportRow>(`SELECT * FROM exports WHERE token_hash = ?`, [sha256(tok)]);
export const exportById = (db: Db, id: string) => db.get<ExportRow>(`SELECT * FROM exports WHERE id = ?`, [id]);

export interface RequestRow { id: string; project_id: string | null; user_id: string; status: string; contact: string; summary: string; note: string; export_id: string | null; created_at: string; updated_at: string }
export const REQUEST_STATUSES = ["draft", "pending", "review", "in_progress", "delivered", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const requestDto = (r: RequestRow) => ({
  id: r.id, projectId: r.project_id, userId: r.user_id, status: r.status as RequestStatus, contact: parse(r.contact, {}), summary: parse(r.summary, {}),
  note: r.note, exportId: r.export_id, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function addEvent(db: Db, requestId: string, actorId: string | null, type: string, from: string | null, to: string | null, note = ""): Promise<void> {
  await db.run(`INSERT INTO request_events (id, request_id, actor_id, type, from_status, to_status, note, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    [newId("evt"), requestId, actorId, type, from, to, note.slice(0, 1000), nowIso()]);
}
export const listEvents = (db: Db, requestId: string) =>
  db.all<{ id: string; actor_id: string | null; type: string; from_status: string | null; to_status: string | null; note: string; created_at: string; actor_name: string | null }>(
    `SELECT e.id, e.actor_id, e.type, e.from_status, e.to_status, e.note, e.created_at, u.name AS actor_name FROM request_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.request_id = ? ORDER BY e.created_at, e.id`, [requestId]);
