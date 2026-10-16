/**
 * Autoguardado con control de frecuencia. Reglas:
 *  - nunca se muestra «guardado» antes de que el almacenamiento local (IndexedDB) lo confirme;
 *  - un solo guardado en vuelo; si hay cambios nuevos, se encadena otro desde la revisión devuelta;
 *  - copia de seguridad aparte mientras haya cambios sin confirmar;
 *  - reintento automático con espera creciente (p. ej. si el dispositivo se quedó sin espacio).
 */
import { Doc } from "../../shared/model/types";
import { ApiError, Api } from "../lib/api";
import { clearBackup, putBackup } from "../lib/idb";
import { debounce } from "../lib/dom";
import { Editor } from "./editor";

export class Persistence {
  rev: number;
  private inflight: Promise<boolean> | null = null;
  private savedDocRev: number;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retries = 0;
  private lastSavedDoc: Doc;
  private maxWait: ReturnType<typeof setTimeout> | undefined;
  private unsub: () => void;
  private stopped = false;
  onConflict: (serverRev: number) => void = () => {};
  onSaved: (meta: { rev: number }) => void = () => {};
  private schedule = debounce(() => { void this.save(false); }, 1600);

  constructor(private ed: Editor, private projectId: string, rev: number) {
    this.rev = rev;
    this.savedDocRev = ed.s.docRev;
    this.lastSavedDoc = ed.doc;
    let last = ed.s.docRev;
    this.unsub = ed.store.subscribe((s) => {
      if (s.docRev === last) return;
      last = s.docRev;
      if (this.stopped) return;
      this.backup();
      this.schedule();
      this.maxWait ??= setTimeout(() => { this.maxWait = undefined; void this.save(false); }, 15000);
    });
    window.addEventListener("beforeunload", this.onUnload);
  }

  private backup = debounce(() => {
    void putBackup({ projectId: this.projectId, doc: this.ed.doc, baseRev: this.rev, at: Date.now(), dirty: this.isDirty });
  }, 700);

  get isDirty(): boolean { return this.ed.s.docRev !== this.savedDocRev; }

  private onUnload = (e: BeforeUnloadEvent) => {
    if (this.isDirty) { e.preventDefault(); e.returnValue = ""; }
  };

  /** Guarda ahora. `snapshot` crea además una versión en el historial de versiones. */
  async save(snapshot: boolean): Promise<boolean> {
    this.schedule.cancel();
    if (this.maxWait) { clearTimeout(this.maxWait); this.maxWait = undefined; }
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = undefined; }
    if (this.inflight) { await this.inflight.catch(() => false); if (!this.isDirty && !snapshot) return true; }
    if (!this.isDirty && !snapshot) {
      this.ed.setSave("saved", "Todos los cambios guardados");
      return true;
    }
    this.inflight = this.doSave(snapshot).finally(() => { this.inflight = null; });
    return this.inflight;
  }

  private async doSave(snapshot: boolean): Promise<boolean> {
    const ed = this.ed;
    const docRev = ed.s.docRev;
    const doc = ed.doc;
    ed.setSave("saving", "Guardando…");
    try {
      const { project } = await Api.saveProject(this.projectId, doc, this.rev, snapshot);
      this.rev = project.rev;
      this.savedDocRev = docRev;
      this.lastSavedDoc = doc;
      this.retries = 0;
      this.onSaved({ rev: project.rev });
      if (ed.s.docRev !== docRev) {
        // hubo cambios mientras se guardaba: se guardan a continuación
        ed.setSave("dirty", "Cambios sin guardar");
        this.schedule();
        void putBackup({ projectId: this.projectId, doc: ed.doc, baseRev: this.rev, at: Date.now(), dirty: true });
      } else {
        ed.setSave("saved", "Todos los cambios guardados", Date.now());
        void clearBackup(this.projectId);
      }
      return true;
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409 && err.code === "conflict") {
        ed.setSave("conflict", "Conflicto: el proyecto cambió en otra pestaña de este navegador");
        this.onConflict(Number(err.data?.rev));
        return false;
      }
      if (err.status === 422) { ed.setSave("error", `El documento no es válido: ${err.message}`); return false; }
      ed.setSave("error", `No se pudo guardar en este dispositivo (${err.message})`);
      const wait = Math.min(60000, 3000 * 2 ** this.retries++);
      this.retryTimer = setTimeout(() => { void this.save(false); }, wait);
      return false;
    }
  }

  /** Tras resolver un conflicto: continuar desde la revisión del servidor. */
  rebase(serverRev: number): void { this.rev = serverRev; }

  async flush(): Promise<boolean> {
    this.backup.flush();
    return this.save(false);
  }

  dispose(): void {
    this.stopped = true;
    this.unsub();
    this.schedule.cancel();
    this.backup.cancel();
    if (this.maxWait) clearTimeout(this.maxWait);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    window.removeEventListener("beforeunload", this.onUnload);
  }
}
