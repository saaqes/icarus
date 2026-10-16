/** Cliente de la API de ICARUS (mismo origen, sesión por cookie HttpOnly). */
import type { Doc, ProjectFull, ProjectMeta } from "../../shared/model/types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "error", public data: any = {}) { super(message); }
  get isNetwork(): boolean { return this.status === 0; }
}

export async function api<T = any>(method: string, path: string, body?: unknown, init: { headers?: Record<string, string>; raw?: BodyInit } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
      body: init.raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, "Sin conexión con el servidor.", "network");
  }
  let data: any = null;
  const type = res.headers.get("content-type") || "";
  if (type.includes("json")) data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || `Error ${res.status}`, data?.code || "error", data ?? {});
  if (data === null && res.status !== 204 && type && !/octet|zip|image|video|audio/.test(type)) {
    throw new ApiError(res.status, "El servidor no respondió como API. Comprueba que el servicio Node esté desplegado y DATABASE_URL configurada.", "bad_response");
  }
  return data as T;
}

export interface User { id: string; name: string; email: string; role: "user" | "admin" }
export interface Folder { id: string; parentId: string | null; name: string; createdAt: string; updatedAt: string }
export interface Asset { id: string; url: string; kind: "image" | "video"; name: string; mime: string; size: number; createdAt: string }
export interface ServerConfig { whatsappConfigured: boolean; cloudApiConfigured: boolean; registrationOpen: boolean; maxUploadMb: number; exportTtlDays: number; storage: string; database: string }

export const Api = {
  config: () => api<ServerConfig>("GET", "/api/config"),
  me: () => api<{ user: User | null }>("GET", "/api/auth/me"),
  login: (email: string, password: string) => api<{ user: User }>("POST", "/api/auth/login", { email, password }),
  register: (name: string, email: string, password: string) => api<{ user: User }>("POST", "/api/auth/register", { name, email, password }),
  logout: () => api("POST", "/api/auth/logout", {}),

  folders: () => api<{ folders: Folder[] }>("GET", "/api/folders"),
  createFolder: (name: string, parentId: string | null) => api<{ folder: Folder }>("POST", "/api/folders", { name, parentId }),
  updateFolder: (id: string, patch: { name?: string; parentId?: string | null }) => api<{ folder: Folder }>("PATCH", `/api/folders/${id}`, patch),
  deleteFolder: (id: string) => api("DELETE", `/api/folders/${id}`),

  projects: (q: Record<string, string>) => api<{ projects: ProjectMeta[] }>("GET", `/api/projects?${new URLSearchParams(q)}`),
  project: (id: string) => api<{ project: ProjectFull }>("GET", `/api/projects/${id}`),
  createProject: (body: Record<string, unknown>) => api<{ project: ProjectMeta }>("POST", "/api/projects", body),
  saveProject: (id: string, doc: Doc, baseRev: number, snapshot = false) => api<{ project: ProjectMeta }>("PUT", `/api/projects/${id}`, { doc, baseRev, snapshot }),
  patchProject: (id: string, patch: Record<string, unknown>) => api<{ project: ProjectMeta }>("PATCH", `/api/projects/${id}`, patch),
  deleteProject: (id: string) => api("DELETE", `/api/projects/${id}`),
  duplicateProject: (id: string, name?: string) => api<{ project: ProjectMeta }>("POST", `/api/projects/${id}/duplicate`, { name }),
  versions: (id: string) => api<{ versions: { version: number; label: string; createdAt: string }[] }>("GET", `/api/projects/${id}/versions`),
  versionDoc: (id: string, v: number) => api<{ doc: Doc }>("GET", `/api/projects/${id}/versions/${v}`),
  exportZip: (id: string) => api<{ export: { downloadUrl: string; expiresAt: string; filename: string; size: number; files: number; warnings: string[] }; accessibility: number }>("POST", `/api/projects/${id}/export`, {}),
  requestSite: (id: string, rev: number, note: string) => api<RequestResult>("POST", `/api/projects/${id}/request`, { rev, note }),
  myRequests: () => api<{ requests: RequestDto[] }>("GET", "/api/requests"),

  assets: () => api<{ assets: Asset[] }>("GET", "/api/assets"),
  upload: (file: File, projectId?: string) =>
    api<{ asset: Asset }>("POST", "/api/assets", undefined, {
      headers: { "X-Requested-With": "icarus", "X-Filename": encodeURIComponent(file.name), ...(projectId ? { "X-Project-Id": projectId } : {}), "Content-Type": "application/octet-stream" },
      raw: file,
    }),
  deleteAsset: (id: string, force = false) => api("DELETE", `/api/assets/${id}${force ? "?force=1" : ""}`),

  adminRequests: (q: Record<string, string>) => api<{ requests: (RequestDto & { userName: string; userEmail: string })[]; counts: Record<string, number> }>("GET", `/api/admin/requests?${new URLSearchParams(q)}`),
  adminRequest: (id: string) => api<AdminRequestDetail>("GET", `/api/admin/requests/${id}`),
  adminSetStatus: (id: string, status: string, note: string) => api("PATCH", `/api/admin/requests/${id}`, { status, note }),
  adminLink: (id: string) => api<{ downloadUrl: string; expiresAt: string }>("POST", `/api/admin/requests/${id}/link`, {}),
  adminRevoke: (id: string) => api("POST", `/api/admin/requests/${id}/revoke`, {}),
};

export interface RequestDto {
  id: string; projectId: string | null; userId: string; status: "draft" | "pending" | "review" | "in_progress" | "delivered" | "cancelled";
  contact: Record<string, string>; summary: Record<string, any>; note: string; exportId: string | null; createdAt: string; updatedAt: string;
}
export interface RequestResult {
  request: { id: string; status: string; createdAt: string };
  export: { downloadUrl: string; expiresAt: string; filename: string; size: number; files: number; warnings: string[] };
  whatsapp: { configured: boolean; url: string | null; message: string; note: string };
  notify: { attempted: boolean; ok: boolean; detail: string };
}
export interface AdminRequestDetail {
  request: RequestDto & { userName: string; userEmail: string };
  events: { id: string; type: string; from: string | null; to: string | null; note: string; actor: string | null; createdAt: string }[];
  export: { id: string; filename: string; size: number; expiresAt: string; expired: boolean; revoked: boolean; downloads: number } | null;
  project: ProjectMeta | null;
  doc: Doc | null;
  baseUrl: string;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", pending: "Solicitud pendiente", review: "En revisión", in_progress: "En proceso", delivered: "Entregada", cancelled: "Cancelada",
};
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", editing: "En edición", ready: "Listo para solicitar", published: "Entregado",
};
