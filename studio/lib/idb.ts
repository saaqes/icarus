/** Copia de seguridad local (IndexedDB) para recuperar cambios no guardados tras un fallo de red o un cierre accidental. */
import type { Doc } from "../../shared/model/types";

export interface Backup { projectId: string; doc: Doc; baseRev: number; at: number; dirty: boolean }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("icarus-studio", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("backups", { keyPath: "projectId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBackup(b: Backup): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => { const tx = db.transaction("backups", "readwrite"); tx.objectStore("backups").put(b); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch { /* IndexedDB no disponible (modo privado): se ignora */ }
}

export async function getBackup(projectId: string): Promise<Backup | null> {
  try {
    const db = await open();
    const r = await new Promise<Backup | null>((res, rej) => { const q = db.transaction("backups").objectStore("backups").get(projectId); q.onsuccess = () => res((q.result as Backup) ?? null); q.onerror = () => rej(q.error); });
    db.close();
    return r;
  } catch { return null; }
}

export async function clearBackup(projectId: string): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => { const tx = db.transaction("backups", "readwrite"); tx.objectStore("backups").delete(projectId); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch { /* nada */ }
}
