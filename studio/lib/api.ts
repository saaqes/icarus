/**
 * «API» local del Studio: proyectos, carpetas, versiones, archivos y solicitudes se guardan en este dispositivo
 * (IndexedDB, ver local.ts). No hay servidor ni cuentas. Mantiene la forma de la antigua API para que el editor no cambie.
 */
import { buildPackage, describeDoc } from "../../shared/export/package";
import { checkAccessibility } from "../../shared/export/a11y";
import { sniff } from "../../shared/sniff";
import { blankDoc, templateById } from "../../shared/templates";
import { thumbnailSvg } from "../../shared/thumb";
import { STATIC_IMAGE_PREFIXES } from "../../shared/library";
import { validateDoc } from "../../shared/model/validate";
import type { Doc, ProjectFull, ProjectMeta, ProjectStatus } from "../../shared/model/types";
import { forgetBlob, isLocalRef, registerBlob } from "./assetres";
import { del, get, getAll, kvGet, kvSet, newId, put } from "./local";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "error", public data: any = {}) { super(message); }
  get isNetwork(): boolean { return this.status === 0; }
}

export interface Folder { id: string; parentId: string | null; name: string; createdAt: string; updatedAt: string }
export interface Asset { id: string; url: string; kind: "image" | "video"; name: string; mime: string; size: number; createdAt: string }

interface ProjectRec extends ProjectMeta { doc: Doc }
interface VersionRec { id: string; projectId: string; version: number; label: string; createdAt: string; doc: Doc }
interface AssetRec { id: string; kind: "image" | "video"; name: string; mime: string; size: number; createdAt: string; blob: Blob }

export interface Customer { name: string; phone: string }
export interface RequestRec {
  id: string; projectId: string; projectName: string; createdAt: string; rev: number;
  customer: Customer; note: string; filename: string; size: number; files: number; summary: Record<string, any>;
}

const now = () => new Date().toISOString();
const nf = (what = "Proyecto") => new ApiError(404, `${what} no encontrado.`, "not_found");
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001F]/g, " ").trim().slice(0, max) : "");
const strip = ({ doc: _d, ...meta }: ProjectRec): ProjectMeta => meta;
const MAX_VERSIONS = 40;

function parseDoc(raw: unknown): Doc {
  const r = validateDoc(raw);
  if (!r.ok || !r.doc) throw new ApiError(422, `Documento inválido: ${r.errors[0] ?? "estructura incorrecta"}`, "invalid_doc");
  return r.doc;
}

async function addVersion(projectId: string, version: number, doc: Doc, label: string): Promise<void> {
  await put("versions", { id: `${projectId}:${version}`, projectId, version, label, createdAt: now(), doc } satisfies VersionRec);
  const old = (await getAll<VersionRec>("versions")).filter((v) => v.projectId === projectId && v.version <= version - MAX_VERSIONS);
  for (const v of old) await del("versions", v.id);
}

const contactOf = (c: any) => c && typeof c === "object"
  ? { owner: clean(c.owner, 120), email: clean(c.email, 254), phone: clean(c.phone, 40), country: clean(c.country, 60), language: clean(c.language, 20) } : {};
const brandOf = (b: any) => b && typeof b === "object"
  ? { colors: Array.isArray(b.colors) ? b.colors.filter((c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4) : [], style: clean(b.style, 40) }
  : { colors: [], style: "" };

async function rec(id: string): Promise<ProjectRec> {
  const r = await get<ProjectRec>("projects", id);
  if (!r) throw nf();
  return r;
}

export const Api = {
  /* ---------- carpetas ---------- */
  folders: async () => ({ folders: (await getAll<Folder>("folders")).sort((a, b) => a.name.localeCompare(b.name, "es")) }),
  async createFolder(name: string, parentId: string | null) {
    const n = clean(name, 60);
    if (!n) throw new ApiError(400, "La carpeta necesita un nombre.", "invalid");
    if (parentId && !(await get("folders", parentId))) throw nf("Carpeta");
    const t = now();
    const folder: Folder = { id: newId("fld"), parentId, name: n, createdAt: t, updatedAt: t };
    await put("folders", folder);
    return { folder };
  },
  async updateFolder(id: string, patch: { name?: string; parentId?: string | null }) {
    const f = await get<Folder>("folders", id);
    if (!f) throw nf("Carpeta");
    if (patch.parentId !== undefined && patch.parentId) {
      const all = await getAll<Folder>("folders");
      let cur: string | null = patch.parentId;
      for (let i = 0; cur && i < 100; i++) { if (cur === id) throw new ApiError(400, "No puedes mover una carpeta dentro de sí misma."); cur = all.find((x) => x.id === cur)?.parentId ?? null; }
    }
    const next: Folder = { ...f, name: patch.name !== undefined ? clean(patch.name, 60) || f.name : f.name, parentId: patch.parentId === undefined ? f.parentId : patch.parentId, updatedAt: now() };
    await put("folders", next);
    return { folder: next };
  },
  /** Elimina la carpeta; sus subcarpetas y proyectos suben al nivel superior (no se pierde nada). */
  async deleteFolder(id: string) {
    const f = await get<Folder>("folders", id);
    if (!f) throw nf("Carpeta");
    for (const c of (await getAll<Folder>("folders")).filter((x) => x.parentId === id)) await put("folders", { ...c, parentId: f.parentId });
    for (const p of (await getAll<ProjectRec>("projects")).filter((x) => x.folderId === id)) await put("projects", { ...p, folderId: f.parentId });
    await del("folders", id);
    return { ok: true };
  },

  /* ---------- proyectos ---------- */
  async projects(q: Record<string, string>) {
    let list = (await getAll<ProjectRec>("projects")).map(strip);
    list = list.filter((p) => p.archived === (q.archived === "1"));
    if (q.q) { const s = q.q.toLowerCase(); list = list.filter((p) => p.name.toLowerCase().includes(s) || p.siteName.toLowerCase().includes(s)); }
    if (q.folder === "root") list = list.filter((p) => !p.folderId);
    else if (q.folder && q.folder !== "all") list = list.filter((p) => p.folderId === q.folder);
    if (q.status) list = list.filter((p) => p.status === q.status);
    const key = q.sort === "name" ? (p: ProjectMeta) => p.name.toLowerCase() : q.sort === "created" ? (p: ProjectMeta) => p.createdAt : (p: ProjectMeta) => p.updatedAt;
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * (q.dir === "asc" ? 1 : -1));
    return { projects: list };
  },
  project: async (id: string) => ({ project: (await rec(id)) as ProjectFull }),
  async createProject(b: Record<string, any>) {
    const name = clean(b.name, 120);
    if (!name) throw new ApiError(400, "El proyecto necesita un nombre.", "invalid");
    const siteName = clean(b.siteName, 80) || name;
    let doc: Doc;
    if (b.doc) doc = parseDoc(b.doc);
    else {
      const t = typeof b.templateId === "string" ? templateById(b.templateId) : undefined;
      doc = t ? t.build() : blankDoc(siteName);
      doc.settings.siteName = siteName;
      if (!doc.settings.title) doc.settings.title = siteName;
    }
    const t = now();
    const p: ProjectRec = {
      id: newId("prj"), folderId: typeof b.folderId === "string" ? b.folderId : null, name, siteName, description: clean(b.description, 1000),
      pageType: clean(b.pageType, 60), category: clean(b.category, 60), contact: contactOf(b.contact), brand: brandOf(b.brand), status: "draft",
      archived: false, pageCount: doc.pages.length, rev: 1, thumb: thumbnailSvg(doc), createdAt: t, updatedAt: t,
      templateId: typeof b.templateId === "string" ? b.templateId.slice(0, 40) : null, doc,
    };
    await put("projects", p);
    await addVersion(p.id, 1, doc, "Versión inicial");
    return { project: strip(p) };
  },
  /** Guarda el documento con bloqueo optimista: si `baseRev` no coincide, otra pestaña lo modificó. */
  async saveProject(id: string, rawDoc: Doc, baseRev: number, snapshot = false, label = "") {
    const doc = parseDoc(rawDoc);
    const p = await rec(id);
    if (p.rev !== baseRev) throw new ApiError(409, "El proyecto se modificó en otra pestaña.", "conflict", { rev: p.rev });
    const rev = p.rev + 1;
    const next: ProjectRec = {
      ...p, doc, rev, pageCount: doc.pages.length, thumb: thumbnailSvg(doc), siteName: doc.settings.siteName || p.siteName,
      status: p.status === "draft" ? "editing" : p.status, updatedAt: now(),
    };
    await put("projects", next);
    const last = (await getAll<VersionRec>("versions")).filter((v) => v.projectId === id).sort((a, b) => b.version - a.version)[0];
    if (snapshot || !last || Date.now() - Date.parse(last.createdAt) > 15 * 60_000) await addVersion(id, rev, doc, label || (snapshot ? "Guardado manual" : "Autoguardado"));
    return { project: strip(next) };
  },
  async patchProject(id: string, b: Record<string, any>) {
    const p = await rec(id);
    const n: ProjectRec = { ...p, updatedAt: now() };
    if ("name" in b) { n.name = clean(b.name, 120); if (!n.name) throw new ApiError(400, "El nombre no puede estar vacío.", "invalid"); }
    if ("siteName" in b) n.siteName = clean(b.siteName, 80);
    if ("description" in b) n.description = clean(b.description, 1000);
    if ("pageType" in b) n.pageType = clean(b.pageType, 60);
    if ("category" in b) n.category = clean(b.category, 60);
    if (b.contact && typeof b.contact === "object") n.contact = contactOf(b.contact);
    if (b.brand && typeof b.brand === "object") n.brand = brandOf(b.brand);
    if ("folderId" in b) {
      n.folderId = typeof b.folderId === "string" ? b.folderId : null;
      if (n.folderId && !(await get("folders", n.folderId))) throw nf("Carpeta");
    }
    if ("status" in b) {
      if (!["draft", "editing", "ready"].includes(b.status)) throw new ApiError(400, "Estado no permitido.", "invalid");
      n.status = b.status as ProjectStatus;
    }
    if ("archived" in b) n.archived = b.archived === true;
    if ("templateId" in b) n.templateId = typeof b.templateId === "string" ? b.templateId.slice(0, 40) : null;
    await put("projects", n);
    return { project: strip(n) };
  },
  async deleteProject(id: string) {
    await rec(id);
    await del("projects", id);
    for (const v of (await getAll<VersionRec>("versions")).filter((x) => x.projectId === id)) await del("versions", v.id);
    return { ok: true };
  },
  async duplicateProject(id: string, name?: string) {
    const p = await rec(id);
    return Api.createProject({ ...p, name: clean(name, 120) || `${p.name} copia`, doc: p.doc });
  },
  async versions(id: string) {
    await rec(id);
    const list = (await getAll<VersionRec>("versions")).filter((v) => v.projectId === id).sort((a, b) => b.version - a.version).slice(0, MAX_VERSIONS);
    return { versions: list.map((v) => ({ version: v.version, label: v.label, createdAt: v.createdAt })) };
  },
  async versionDoc(id: string, v: number) {
    const r = await get<VersionRec>("versions", `${id}:${v}`);
    if (!r) throw nf("Versión");
    return { doc: r.doc };
  },
  /** Importa un archivo `.icarus.json` (exportado desde este u otro dispositivo), con sus imágenes. */
  async importProject(payload: any) {
    if (!payload || payload.format !== "icarus-studio-project") throw new ApiError(400, "El archivo no es un proyecto de ICARUS Studio.", "invalid");
    const map = new Map<string, string>();
    for (const a of Array.isArray(payload.assets) ? payload.assets : []) {
      if (!isLocalRef(a?.ref) || typeof a.data !== "string") continue;
      const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
      const asset = await Api.storeBytes(bytes, clean(a.name, 100) || "archivo");
      map.set(a.ref, asset.url);
    }
    let text = JSON.stringify(payload.doc);
    for (const [from, to] of map) text = text.split(from).join(to);
    const m = payload.meta ?? {};
    const { project } = await Api.createProject({ name: clean(m.name, 120) || "Proyecto importado", siteName: m.siteName, description: m.description, pageType: m.pageType, category: m.category, doc: JSON.parse(text) });
    return { project };
  },
  /** Archivo `.icarus.json` con el documento y las imágenes que usa. */
  async exportProjectFile(id: string, docOverride?: Doc) {
    const p = await rec(id);
    const doc = docOverride ?? p.doc;
    const refs = [...new Set(JSON.stringify(doc).match(/\/local\/[a-z0-9_-]{6,60}/gi) ?? [])];
    const assets: { ref: string; name: string; data: string }[] = [];
    for (const ref of refs) {
      const a = await get<AssetRec>("assets", ref.slice(7));
      if (!a) continue;
      const buf = new Uint8Array(await a.blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      assets.push({ ref, name: a.name, data: btoa(bin) });
    }
    return { format: "icarus-studio-project", version: 2, exportedAt: now(), meta: { name: p.name, siteName: p.siteName, description: p.description, pageType: p.pageType, category: p.category }, doc, assets };
  },

  /* ---------- paquete del sitio ---------- */
  /** Genera el ZIP del sitio en este dispositivo. */
  async buildZip(id: string, docOverride?: Doc) {
    const p = await rec(id);
    const doc = docOverride ?? p.doc;
    const res = await buildPackage(doc, p.name, async (src: string) => {
      if (isLocalRef(src)) { const a = await get<AssetRec>("assets", src.slice(7)); return a ? new Uint8Array(await a.blob.arrayBuffer()) : null; }
      if (STATIC_IMAGE_PREFIXES.some((x) => src.startsWith(x)) && !src.includes("..")) {
        const r = await fetch(src); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
      }
      return null;
    });
    return { ...res, project: p, accessibility: checkAccessibility(doc).length };
  },

  /* ---------- solicitudes enviadas desde este dispositivo ---------- */
  customer: async () => (await kvGet<Customer>("customer")) ?? { name: "", phone: "" },
  saveCustomer: (c: Customer) => kvSet("customer", c),
  async addRequest(r: RequestRec) { await put("requests", r); },
  myRequests: async () => ({ requests: (await getAll<RequestRec>("requests")).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) }),
  describe: (doc: Doc) => describeDoc(doc),

  /* ---------- archivos subidos ---------- */
  async assets() {
    const list = await getAll<AssetRec>("assets");
    for (const a of list) registerBlob(`/local/${a.id}`, a.blob);
    return { assets: list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(assetDto) };
  },
  async storeBytes(bytes: Uint8Array, name: string) {
    const kind = sniff(bytes);
    if (!kind) throw new ApiError(415, "Formato no admitido. Usa PNG, JPG, WebP, GIF, AVIF, MP4 o WebM.", "bad_type");
    if (kind.kind === "image" && bytes.length > 5 * 1024 * 1024) throw new ApiError(413, "Las imágenes pueden pesar hasta 5 MB.", "too_large");
    if (bytes.length > 25 * 1024 * 1024) throw new ApiError(413, "El archivo es demasiado grande (máximo 25 MB).", "too_large");
    const filename = name.replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ()]/g, "_").slice(0, 100) || "archivo";
    const a: AssetRec = { id: newId("ast", 20), kind: kind.kind, name: filename, mime: kind.mime, size: bytes.length, createdAt: now(), blob: new Blob([bytes as BlobPart], { type: kind.mime }) };
    await put("assets", a);
    registerBlob(`/local/${a.id}`, a.blob);
    return assetDto(a);
  },
  async upload(file: File) {
    return { asset: await Api.storeBytes(new Uint8Array(await file.arrayBuffer()), file.name) };
  },
  /** Proyectos que usan un archivo. */
  async assetUsage(id: string) {
    return (await getAll<ProjectRec>("projects")).filter((p) => JSON.stringify(p.doc).includes(`/local/${id}`)).map((p) => p.name);
  },
  async deleteAsset(id: string, force = false) {
    const used = await Api.assetUsage(id);
    if (used.length && !force) throw new ApiError(409, `Este archivo se usa en: ${used.join(", ")}.`, "in_use");
    await del("assets", id);
    forgetBlob(`/local/${id}`);
    return { ok: true };
  },
};

function assetDto(a: AssetRec): Asset {
  return { id: a.id, url: `/local/${a.id}`, kind: a.kind, name: a.name, mime: a.mime, size: a.size, createdAt: a.createdAt };
}

/** Registra en memoria los archivos que usa un documento (para poder mostrarlos en el lienzo). */
export async function preloadAssets(doc: Doc): Promise<void> {
  const refs = new Set(JSON.stringify(doc).match(/\/local\/[a-z0-9_-]{6,60}/gi) ?? []);
  for (const ref of refs) {
    const a = await get<AssetRec>("assets", ref.slice(7));
    if (a) registerBlob(ref, a.blob);
  }
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", pending: "Enviada", review: "En revisión", in_progress: "En proceso", delivered: "Entregada", cancelled: "Cancelada",
};
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", editing: "En edición", ready: "Listo para enviar", published: "Enviado",
};
