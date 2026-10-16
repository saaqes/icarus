/**
 * Almacenamiento local del Studio (IndexedDB). Todo vive en este dispositivo: proyectos, versiones, carpetas,
 * archivos subidos y solicitudes enviadas. Si IndexedDB no está disponible (algunos modos privados) se usa memoria
 * y se avisa a la persona (`localStore.volatile`).
 */
export type StoreName = "projects" | "versions" | "folders" | "assets" | "requests" | "kv";
const STORES: StoreName[] = ["projects", "versions", "folders", "assets", "requests", "kv"];

let dbp: Promise<IDBDatabase> | null = null;
const mem = new Map<StoreName, Map<string, any>>(STORES.map((s) => [s, new Map()]));
export const localStore = { volatile: false };

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("sin IndexedDB")); return; }
    const req = indexedDB.open("icarus-local", 1);
    req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: s === "kv" ? "k" : "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("bloqueada"));
  });
  return dbp.catch((e) => { localStore.volatile = true; throw e; });
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(r.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("transacción cancelada"));
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  try { return await run<T[]>(store, "readonly", (s) => s.getAll()); }
  catch { return [...mem.get(store)!.values()] as T[]; }
}
export async function get<T>(store: StoreName, id: string): Promise<T | undefined> {
  try { return (await run<T | undefined>(store, "readonly", (s) => s.get(id))) ?? undefined; }
  catch { return mem.get(store)!.get(id) as T | undefined; }
}
export async function put<T extends { id?: string; k?: string }>(store: StoreName, value: T): Promise<void> {
  try { await run(store, "readwrite", (s) => s.put(value)); }
  catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") throw new Error("No hay espacio en este dispositivo para guardar. Libera espacio o exporta y elimina proyectos.");
    if (!localStore.volatile) throw e;
    mem.get(store)!.set((value.id ?? value.k)!, value);
  }
}
export async function del(store: StoreName, id: string): Promise<void> {
  try { await run(store, "readwrite", (s) => s.delete(id)); }
  catch { mem.get(store)!.delete(id); }
}

export async function kvGet<T>(k: string): Promise<T | undefined> { return (await get<{ k: string; v: T }>("kv", k))?.v; }
export async function kvSet(k: string, v: unknown): Promise<void> { await put("kv", { k, v }); }

/** Pide al navegador que no borre los datos del sitio cuando haya poco espacio. */
export async function requestPersistence(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
export async function storageEstimate(): Promise<{ used: number; quota: number } | null> {
  try { const e = await navigator.storage?.estimate?.(); return e ? { used: e.usage ?? 0, quota: e.quota ?? 0 } : null; } catch { return null; }
}

export function newId(prefix: string, len = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return `${prefix}_${[...bytes].map((b) => (b % 36).toString(36)).join("")}`;
}
