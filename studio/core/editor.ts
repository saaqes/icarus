/**
 * Núcleo del editor: estado, historial (deshacer/rehacer) y todas las operaciones sobre el documento.
 * La interfaz (lienzo y paneles) solo llama a estos métodos; nunca modifica el documento directamente.
 */
import { copyName, cloneSubtree, descendants, isAncestor, isContainer, makeNode, pageOfNode, produce, slugify, Tx, uid, uniqueSlug, walk } from "../../shared/model/doc";
import { materialize, Spec } from "../../shared/model/build";
import { effectiveLayout, resolveStyle } from "../../shared/model/style";
import { blankDoc } from "../../shared/templates";
import { Device, Doc, DEVICE_WIDTHS, Node, Page, PartialStyle, Theme } from "../../shared/model/types";
import { toast } from "../lib/dom";
import { Store } from "./store";

export type LeftTab = "insert" | "layers" | "pages" | "templates" | "assets";
export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict" | "offline" | "local";

export interface EditorState {
  doc: Doc;
  pageId: string;
  selection: string[];
  device: Device;
  /** Anchos personalizados del lienzo por dispositivo. */
  widths: Record<Device, number>;
  zoom: number;
  tool: "select" | "hand";
  editingText: string | null;
  hoverId: string | null;
  /** Estado que se está editando en el panel (botones): normal o hover. */
  uiState: "normal" | "hover";
  leftTab: LeftTab;
  /** Panel desplegable en pantallas pequeñas. */
  sheet: null | "left" | "right";
  snapGrid: boolean;
  guides: boolean;
  /** Se incrementa en cada cambio del documento (para el autoguardado). */
  docRev: number;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
  save: { status: SaveStatus; message: string; at: number | null };
  /** Ids colapsados en el árbol de capas. */
  collapsed: Record<string, boolean>;
}

export interface Rect { x: number; y: number; w: number; h: number }

interface Snapshot { doc: Doc; selection: string[]; pageId: string; label: string }

const HISTORY_LIMIT = 100;
const CLIP_KEY = "icarus.studio.clipboard";

export class Editor {
  readonly store: Store<EditorState>;
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private lastCoalesce: { key: string; at: number } | null = null;
  private gesture: { base: Snapshot; label: string; moved: boolean } | null = null;
  /** Lo inyecta el lienzo: mide un nodo (px sin escalar, relativo a su contenedor posicionado). */
  measure: (id: string) => Rect | null = () => null;
  /** Lo inyecta el lienzo: tamaño visible del área de trabajo (para centrar inserciones). */
  private clip: Node[][] | null = null;

  constructor(doc: Doc) {
    this.store = new Store<EditorState>({
      doc,
      pageId: doc.pages[0].id,
      selection: [],
      device: "desktop",
      widths: { ...DEVICE_WIDTHS },
      zoom: 1,
      tool: "select",
      editingText: null,
      hoverId: null,
      uiState: "normal",
      leftTab: "insert",
      sheet: null,
      snapGrid: false,
      guides: true,
      docRev: 0,
      canUndo: false,
      canRedo: false,
      undoLabel: "",
      redoLabel: "",
      save: { status: "saved", message: "Todos los cambios guardados", at: null },
      collapsed: {},
    });
  }

  /* ---------- Lectura ---------- */
  get s(): EditorState { return this.store.get(); }
  get doc(): Doc { return this.s.doc; }
  get device(): Device { return this.s.device; }
  get page(): Page { return this.doc.pages.find((p) => p.id === this.s.pageId) ?? this.doc.pages[0]; }
  get rootId(): string { return this.page.rootId; }
  node(id: string): Node | undefined { return this.doc.nodes[id]; }
  /** Selección con nodos existentes. */
  get selected(): Node[] { return this.s.selection.map((id) => this.doc.nodes[id]).filter(Boolean); }
  parentLayout(id: string): string {
    const n = this.doc.nodes[id];
    const p = n?.parent ? this.doc.nodes[n.parent] : undefined;
    return p ? effectiveLayout(p, this.device) : "stack";
  }
  isFreeChild(id: string): boolean { return this.parentLayout(id) === "free" && this.doc.nodes[id]?.type !== "root"; }

  /* ---------- Historial ---------- */

  private snap(label: string): Snapshot {
    return { doc: this.doc, selection: this.s.selection, pageId: this.s.pageId, label };
  }

  private syncHistoryFlags(): void {
    const u = this.undoStack[this.undoStack.length - 1];
    const r = this.redoStack[this.redoStack.length - 1];
    this.store.set({ canUndo: !!u, canRedo: !!r, undoLabel: u?.label ?? "", redoLabel: r?.label ?? "" });
  }

  private setDoc(doc: Doc, extra: Partial<EditorState> = {}): void {
    const pageId = doc.pages.some((p) => p.id === this.s.pageId) ? this.s.pageId : doc.pages[0].id;
    const selection = (extra.selection ?? this.s.selection).filter((id) => doc.nodes[id]);
    const editing = this.s.editingText && doc.nodes[this.s.editingText] ? this.s.editingText : null;
    this.store.set({ ...extra, doc, pageId, selection, editingText: editing, docRev: this.s.docRev + 1, save: this.s.save.status === "saving" ? this.s.save : { status: this.s.save.status === "local" ? "local" : "dirty", message: "Cambios sin guardar", at: this.s.save.at } });
  }

  /**
   * Aplica un cambio y lo registra en el historial. `coalesce` agrupa cambios consecutivos del mismo
   * tipo (p. ej. teclear en un campo o arrastrar un control deslizante) en una sola entrada.
   */
  commit(label: string, fn: (tx: Tx) => void, opts: { coalesce?: string; selection?: string[] } = {}): boolean {
    const before = this.snap(label);
    const next = produce(this.doc, fn);
    if (next === this.doc) return false;
    if (this.gesture) {
      this.gesture.moved = true;
      this.setDoc(next, opts.selection ? { selection: opts.selection } : {});
      return true;
    }
    const now = Date.now();
    const merge = opts.coalesce && this.lastCoalesce && this.lastCoalesce.key === opts.coalesce && now - this.lastCoalesce.at < 1200 && this.undoStack.length;
    if (!merge) {
      this.undoStack.push(before);
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    }
    this.lastCoalesce = opts.coalesce ? { key: opts.coalesce, at: now } : null;
    this.redoStack = [];
    this.setDoc(next, opts.selection ? { selection: opts.selection } : {});
    this.syncHistoryFlags();
    return true;
  }

  /** Inicio de un gesto continuo (arrastrar, redimensionar): todos los cambios hasta `endGesture` son UNA entrada del historial. */
  beginGesture(label: string): void {
    if (this.gesture) return;
    this.gesture = { base: this.snap(label), label, moved: false };
    this.lastCoalesce = null;
  }

  /** Aplica el estado del gesto calculado desde la base (idempotente: siempre parte del documento inicial). */
  applyGesture(fn: (tx: Tx) => void, selection?: string[]): void {
    if (!this.gesture) return;
    const next = produce(this.gesture.base.doc, fn);
    this.gesture.moved = true;
    this.setDoc(next, selection ? { selection } : {});
  }

  endGesture(): void {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    if (g.moved && this.doc !== g.base.doc) {
      this.undoStack.push(g.base);
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
      this.syncHistoryFlags();
    }
  }

  cancelGesture(): void {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    if (this.doc !== g.base.doc) this.setDoc(g.base.doc, { selection: g.base.selection });
  }

  get inGesture(): boolean { return !!this.gesture; }

  undo(): void {
    if (this.gesture) this.cancelGesture();
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push({ ...this.snap(prev.label), label: prev.label });
    this.lastCoalesce = null;
    this.setDoc(prev.doc, { selection: prev.selection, pageId: prev.pageId });
    this.syncHistoryFlags();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push({ ...this.snap(next.label), label: next.label });
    this.lastCoalesce = null;
    this.setDoc(next.doc, { selection: next.selection, pageId: next.pageId });
    this.syncHistoryFlags();
  }

  /** Marca el documento como guardado/error (lo usa la capa de persistencia). */
  setSave(status: SaveStatus, message: string, at: number | null = this.s.save.at): void {
    this.store.set({ save: { status, message, at } });
  }

  /* ---------- Selección y vista ---------- */

  select(ids: string[], opts: { keepEditing?: boolean } = {}): void {
    const valid = ids.filter((id) => this.doc.nodes[id]);
    const same = valid.length === this.s.selection.length && valid.every((v, i) => v === this.s.selection[i]);
    if (same && (opts.keepEditing || !this.s.editingText)) return;
    this.store.set({ selection: valid, editingText: opts.keepEditing ? this.s.editingText : null, uiState: "normal" });
  }
  toggleSelect(id: string): void {
    const cur = this.s.selection;
    this.select(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }
  clearSelection(): void { this.select([]); }
  setDevice(d: Device): void { this.store.set({ device: d, uiState: "normal", editingText: null }); }
  setZoom(z: number): void { this.store.set({ zoom: Math.min(4, Math.max(0.1, Math.round(z * 100) / 100)) }); }
  setTool(t: "select" | "hand"): void { this.store.set({ tool: t, editingText: null }); }
  setWidth(d: Device, w: number): void { this.store.set({ widths: { ...this.s.widths, [d]: Math.round(Math.min(2400, Math.max(280, w))) } }); }
  switchPage(id: string): void {
    if (!this.doc.pages.some((p) => p.id === id) || id === this.s.pageId) return;
    this.store.set({ pageId: id, selection: [], editingText: null });
  }
  toggleCollapsed(id: string): void { this.store.set({ collapsed: { ...this.s.collapsed, [id]: !this.s.collapsed[id] } }); }

  /* ---------- Estilos y propiedades ---------- */

  /** Escribe estilos en la capa del dispositivo actual (escritorio = base). `undefined` borra la clave. */
  setStyle(ids: string[], patch: PartialStyle | Record<string, unknown>, opts: { coalesce?: string; label?: string; device?: Device } = {}): void {
    const dev = opts.device ?? this.device;
    this.commit(opts.label ?? "Cambiar estilo", (tx) => { for (const id of ids) if (tx.peek(id)) tx.setStyle(id, dev, patch as Record<string, unknown>); },
      { coalesce: opts.coalesce ?? `style:${ids.join(",")}:${dev}:${Object.keys(patch).join(",")}` });
  }

  setHover(ids: string[], patch: Record<string, unknown>, opts: { coalesce?: string } = {}): void {
    this.commit("Cambiar estado hover", (tx) => {
      for (const id of ids) {
        const n = tx.node(id);
        const h = (n.hover ??= {});
        for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete (h as any)[k]; else (h as any)[k] = v; }
        if (!Object.keys(h).length) delete n.hover;
      }
    }, { coalesce: opts.coalesce ?? `hover:${ids.join(",")}:${Object.keys(patch).join(",")}` });
  }

  setProps(ids: string[], patch: Record<string, unknown>, opts: { coalesce?: string; label?: string } = {}): void {
    this.commit(opts.label ?? "Cambiar propiedades", (tx) => {
      for (const id of ids) {
        if (!tx.peek(id)) continue;
        const n = tx.node(id);
        for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete n.props[k]; else n.props[k] = v; }
      }
    }, { coalesce: opts.coalesce ?? `props:${ids.join(",")}:${Object.keys(patch).join(",")}` });
  }

  setAttrs(id: string, patch: { elId?: string; className?: string; css?: string }): void {
    this.commit("Cambiar atributos", (tx) => {
      const n = tx.node(id);
      const a = (n.attrs ??= {});
      for (const [k, v] of Object.entries(patch)) { if (v) (a as any)[k] = v; else delete (a as any)[k]; }
      if (!Object.keys(a).length) delete n.attrs;
    }, { coalesce: `attrs:${id}` });
  }

  setAnim(ids: string[], patch: Record<string, unknown> | null): void {
    this.commit("Cambiar animación", (tx) => {
      for (const id of ids) {
        const n = tx.node(id);
        if (patch === null) { delete n.anim; continue; }
        n.anim = { type: "none", trigger: "scroll", duration: 700, delay: 0, intensity: 50, stagger: false, hover: "none", ...n.anim, ...patch } as any;
        if (n.anim!.type === "none" && n.anim!.hover === "none") delete n.anim;
      }
    }, { coalesce: `anim:${ids.join(",")}:${patch ? Object.keys(patch).join(",") : "x"}` });
  }

  rename(id: string, name: string): void {
    const clean = name.trim().slice(0, 120);
    if (!clean || clean === this.doc.nodes[id]?.name) return;
    this.commit("Renombrar capa", (tx) => { tx.node(id).name = clean; });
  }

  setText(id: string, text: string): void {
    const n = this.doc.nodes[id];
    if (!n || n.props.text === text) return;
    this.commit("Editar texto", (tx) => { tx.node(id).props.text = text; });
  }

  toggleLock(ids: string[] = this.s.selection): void {
    const lock = !ids.every((id) => this.doc.nodes[id]?.locked);
    this.commit(lock ? "Bloquear" : "Desbloquear", (tx) => { for (const id of ids) { const n = tx.node(id); if (lock) n.locked = true; else delete n.locked; } });
  }
  toggleHidden(ids: string[] = this.s.selection): void {
    const hide = !ids.every((id) => this.doc.nodes[id]?.hidden);
    this.commit(hide ? "Ocultar" : "Mostrar", (tx) => { for (const id of ids) { const n = tx.node(id); if (hide) n.hidden = true; else delete n.hidden; } });
  }

  /** Cambia la disposición de un contenedor; al pasar a «libre» congela las posiciones actuales de los hijos. */
  setLayout(id: string, layout: "stack" | "row" | "grid" | "free"): void {
    const node = this.doc.nodes[id];
    if (!node) return;
    const dev = this.device;
    const cur = effectiveLayout(node, dev);
    if (cur === layout) return;
    const rects = layout === "free" ? node.children.map((c) => [c, this.measure(c)] as const) : [];
    this.commit("Cambiar disposición", (tx) => {
      tx.setStyle(id, dev, { layout });
      if (layout === "free") {
        let maxB = 0;
        for (const [cid, r] of rects) {
          if (!r) continue;
          tx.setStyle(cid, dev, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: tx.peek(cid)!.type === "text" ? "auto" : Math.round(r.h) });
          maxB = Math.max(maxB, r.y + r.h);
        }
        if (maxB) tx.setStyle(id, dev, { minHeight: Math.max(Math.round(maxB + 24), resolveStyle(tx.peek(id)!, dev).minHeight ?? 0) });
      }
    });
  }

  /* ---------- Inserción ---------- */

  /** Dónde insertar un elemento nuevo según la selección actual. */
  insertTarget(spec: Spec): { parentId: string; index?: number } {
    const root = this.rootId;
    const sel = this.selected.length === 1 ? this.selected[0] : undefined;
    const isSection = spec.type === "section";
    if (isSection) {
      if (sel) {
        let cur: Node | undefined = sel;
        while (cur && cur.parent && cur.parent !== root) cur = this.doc.nodes[cur.parent];
        if (cur && cur.parent === root) return { parentId: root, index: this.doc.nodes[root].children.indexOf(cur.id) + 1 };
      }
      return { parentId: root };
    }
    if (sel) {
      if (isContainer(sel) && sel.type !== "root") return { parentId: sel.id };
      if (sel.parent) return { parentId: sel.parent, index: this.doc.nodes[sel.parent].children.indexOf(sel.id) + 1 };
    }
    // sin selección: al final de la última sección (o de la página)
    const kids = this.doc.nodes[root].children;
    const last = kids.length ? this.doc.nodes[kids[kids.length - 1]] : undefined;
    if (last && last.type === "section" && !isSection) return { parentId: last.id };
    return { parentId: root };
  }

  /** Inserta una especificación como nodos nuevos y la selecciona. Devuelve el id de la raíz insertada. */
  insert(spec: Spec, opts: { parentId?: string; index?: number; x?: number; y?: number; size?: { w: number; h: number } } = {}): string {
    const target = opts.parentId ? { parentId: opts.parentId, index: opts.index } : this.insertTarget(spec);
    const nodes = materialize(spec);
    const parent = this.doc.nodes[target.parentId];
    const parentFree = !!parent && effectiveLayout(parent, this.device) === "free";
    if (parentFree) {
      const dev = this.device;
      const count = parent.children.length;
      const size = opts.size ?? { w: 240, h: 80 };
      const x = opts.x ?? 40 + (count % 8) * 24;
      const y = opts.y ?? 40 + (count % 8) * 24;
      const key = dev === "desktop" ? "base" : dev;
      const s = (nodes[0].s[key] ??= {});
      Object.assign(s, { x: Math.round(x), y: Math.round(y), w: Math.round(size.w), h: nodes[0].type === "text" ? "auto" : Math.round(size.h) });
      if (nodes[0].type === "image" || nodes[0].type === "video") s.h = Math.round(size.h);
    }
    const newId = nodes[0].id;
    this.commit(`Insertar ${nodes[0].name}`, (tx) => {
      tx.addSubtree(nodes, target.parentId, target.index);
      if (parentFree) this.growFree(tx, target.parentId);
    }, { selection: [newId] });
    return newId;
  }

  /** Amplía la altura mínima de un contenedor libre para que sus hijos no queden fuera. */
  private growFree(tx: Tx, containerId: string): void {
    const c = tx.peek(containerId);
    if (!c) return;
    const dev = this.device;
    let maxB = 0;
    for (const cid of c.children) {
      const n = tx.peek(cid);
      if (!n) continue;
      const st = resolveStyle(n, dev);
      const r = this.measure(cid);
      const h = typeof st.h === "number" ? st.h : r?.h ?? 40;
      maxB = Math.max(maxB, (st.y ?? 0) + h);
    }
    const cs = resolveStyle(c, dev);
    const need = Math.ceil(maxB + 24);
    if (need > (cs.minHeight ?? 0) && need > (typeof cs.h === "number" ? cs.h : 0)) tx.setStyle(containerId, dev, { minHeight: need });
  }

  /* ---------- Eliminar, duplicar, copiar, pegar ---------- */

  /** Quita de una lista los nodos cuyo ancestro también está en ella (evita operar dos veces). */
  topLevel(ids: string[]): string[] {
    const set = new Set(ids);
    return ids.filter((id) => {
      let p = this.doc.nodes[id]?.parent ?? null;
      while (p) { if (set.has(p)) return false; p = this.doc.nodes[p]?.parent ?? null; }
      return !!this.doc.nodes[id] && this.doc.nodes[id].type !== "root";
    });
  }

  deleteNodes(ids: string[] = this.s.selection): void {
    const top = this.topLevel(ids).filter((id) => !this.doc.nodes[id].locked);
    if (!top.length) { if (ids.length) toast("Los elementos bloqueados no se pueden eliminar.", "info"); return; }
    this.commit(top.length > 1 ? `Eliminar ${top.length} elementos` : `Eliminar ${this.doc.nodes[top[0]].name}`, (tx) => { for (const id of top) tx.remove(id); }, { selection: [] });
  }

  duplicateNodes(ids: string[] = this.s.selection): void {
    const top = this.topLevel(ids);
    if (!top.length) return;
    const created: string[] = [];
    this.commit("Duplicar", (tx) => {
      for (const id of top) {
        const n = tx.peek(id)!;
        const copy = cloneSubtree(tx.nodes, id, (src) => copyName(src.name));
        const parent = tx.peek(n.parent!)!;
        const free = effectiveLayout(parent, this.device) === "free";
        if (free) {
          const dev = this.device === "desktop" ? "base" : this.device;
          const s = (copy[0].s[dev] ??= {});
          const st = resolveStyle(n, this.device);
          s.x = (st.x ?? 0) + 24; s.y = (st.y ?? 0) + 24;
          // las coordenadas heredadas se conservan en las otras capas
        }
        tx.addSubtree(copy, n.parent!, parent.children.indexOf(id) + 1);
        created.push(copy[0].id);
      }
    }, { selection: created });
  }

  copy(ids: string[] = this.s.selection): boolean {
    const top = this.topLevel(ids);
    if (!top.length) return false;
    this.clip = top.map((id) => cloneSubtree(this.doc.nodes, id));
    try { localStorage.setItem(CLIP_KEY, JSON.stringify(this.clip)); } catch { /* sin almacenamiento */ }
    return true;
  }
  cut(): void { if (this.copy()) { this.deleteNodes(); toast("Cortado", "info", 1200); } }

  paste(): void {
    let clip = this.clip;
    if (!clip) { try { clip = JSON.parse(localStorage.getItem(CLIP_KEY) || "null"); } catch { clip = null; } }
    if (!clip || !clip.length) { toast("No hay nada que pegar.", "info"); return; }
    const created: string[] = [];
    const first = clip[0][0];
    const target = this.insertTarget({ type: first.type } as Spec);
    this.commit("Pegar", (tx) => {
      let idx = target.index;
      for (const group of clip!) {
        // re-clona con ids nuevos para poder pegar varias veces
        const map = new Map<string, string>();
        const nodes = group.map((n) => { const c = structuredClone(n); map.set(n.id, uid()); return c; });
        for (const n of nodes) {
          const old = n.id;
          n.id = map.get(old)!;
          n.parent = n.parent ? map.get(n.parent) ?? null : null;
          n.children = n.children.map((c) => map.get(c)!).filter(Boolean);
        }
        const parent = tx.peek(target.parentId)!;
        if (effectiveLayout(parent, this.device) === "free") {
          const key = this.device === "desktop" ? "base" : this.device;
          const s = (nodes[0].s[key] ??= {});
          s.x = (s.x ?? 20) + 20; s.y = (s.y ?? 20) + 20;
        }
        tx.addSubtree(nodes, target.parentId, idx);
        if (idx !== undefined) idx++;
        created.push(nodes[0].id);
      }
    }, { selection: created });
  }

  /* ---------- Estructura: mover, orden, agrupar ---------- */

  canDropInto(ids: string[], parentId: string): boolean {
    const parent = this.doc.nodes[parentId];
    if (!parent || !isContainer(parent) || parent.locked && false) return false;
    for (const id of ids) {
      const n = this.doc.nodes[id];
      if (!n || n.type === "root") return false;
      if (id === parentId || isAncestor(this.doc, id, parentId)) return false;
    }
    return true;
  }

  moveNodes(ids: string[], parentId: string, index?: number, opts: { label?: string; keepPos?: boolean; pos?: { x: number; y: number } } = {}): void {
    const top = this.topLevel(ids);
    if (!top.length || !this.canDropInto(top, parentId)) return;
    const dev = this.device;
    const toFree = effectiveLayout(this.doc.nodes[parentId], dev) === "free";
    // medimos antes de mover para poder fijar coordenadas si el destino es libre
    const rects = top.map((id) => this.measure(id));
    this.commit(opts.label ?? "Mover elemento", (tx) => {
      let i = index;
      for (const id of top) {
        const old = tx.peek(id)!;
        let adj = i;
        // al mover dentro del mismo padre, el índice cuenta sin el nodo
        if (adj !== undefined && old.parent === parentId && tx.peek(parentId)!.children.indexOf(id) < adj) adj--;
        tx.move(id, parentId, adj);
        if (i !== undefined) i = (adj ?? 0) + 1 + (adj !== i ? 1 : 0);
      }
      if (toFree && !opts.keepPos) top.forEach((id, k) => {
        const r = rects[k];
        if (r) tx.setStyle(id, dev, { x: Math.round((opts.pos?.x ?? 24) + k * 16), y: Math.round((opts.pos?.y ?? 24) + k * 16), w: tx.peek(id)!.type === "text" ? Math.round(Math.min(r.w, 360)) : Math.round(r.w), h: tx.peek(id)!.type === "text" ? "auto" : Math.round(r.h) });
      });
    }, { selection: top });
  }

  /** Cambia el orden de apilamiento dentro del padre: front, back, forward, backward. */
  reorder(kind: "front" | "back" | "forward" | "backward", ids: string[] = this.s.selection): void {
    const top = this.topLevel(ids);
    if (!top.length) return;
    const labels = { front: "Traer al frente", back: "Enviar al fondo", forward: "Subir capa", backward: "Bajar capa" };
    this.commit(labels[kind], (tx) => {
      const byParent = new Map<string, string[]>();
      for (const id of top) { const p = tx.peek(id)!.parent!; byParent.set(p, [...(byParent.get(p) ?? []), id]); }
      for (const [pid, list] of byParent) {
        const parent = tx.node(pid);
        const kids = parent.children;
        const moving = kids.filter((k) => list.includes(k));
        const rest = kids.filter((k) => !list.includes(k));
        if (kind === "front") parent.children = [...rest, ...moving];
        else if (kind === "back") parent.children = [...moving, ...rest];
        else {
          const arr = [...kids];
          const seq = kind === "forward" ? [...list].reverse() : list;
          for (const id of seq) {
            const i = arr.indexOf(id);
            const j = kind === "forward" ? i + 1 : i - 1;
            if (j < 0 || j >= arr.length || list.includes(arr[j])) continue;
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          parent.children = arr;
        }
      }
    });
  }

  group(ids: string[] = this.s.selection): void {
    const top = this.topLevel(ids);
    if (top.length < 1) return;
    const parentId = this.doc.nodes[top[0]].parent!;
    if (top.some((id) => this.doc.nodes[id].parent !== parentId)) { toast("Para agrupar, los elementos deben estar en el mismo contenedor.", "info"); return; }
    const dev = this.device;
    const parentFree = effectiveLayout(this.doc.nodes[parentId], dev) === "free";
    const parent = this.doc.nodes[parentId];
    const ordered = parent.children.filter((c) => top.includes(c));
    const groupId = uid();
    this.commit("Agrupar", (tx) => {
      const g = makeNode("container", { id: groupId, name: "Grupo", props: { tag: "div", group: true }, s: { base: { layout: parentFree ? "free" : "stack", gap: 12 } } });
      const idx = tx.peek(parentId)!.children.indexOf(ordered[0]);
      if (parentFree) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const rs = ordered.map((id) => {
          const st = resolveStyle(tx.peek(id)!, dev);
          const m = this.measure(id);
          const w = typeof st.w === "number" ? st.w : m?.w ?? 100;
          const hh = typeof st.h === "number" ? st.h : m?.h ?? 40;
          return { id, x: st.x ?? 0, y: st.y ?? 0, w, h: hh };
        });
        for (const r of rs) { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); }
        const key = dev === "desktop" ? "base" : dev;
        g.s[key] = { ...g.s[key], x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY), layout: "free" };
        tx.add(g, parentId, idx);
        for (const r of rs) {
          tx.move(r.id, groupId);
          tx.setStyle(r.id, dev, { x: Math.round(r.x - minX), y: Math.round(r.y - minY) });
        }
      } else {
        tx.add(g, parentId, idx);
        for (const id of ordered) tx.move(id, groupId);
      }
    }, { selection: [groupId] });
  }

  ungroup(ids: string[] = this.s.selection): void {
    const groups = this.topLevel(ids).filter((id) => { const n = this.doc.nodes[id]; return n.type === "container" && n.children.length; });
    if (!groups.length) { toast("Selecciona un grupo o contenedor para desagrupar.", "info"); return; }
    const dev = this.device;
    const out: string[] = [];
    this.commit("Desagrupar", (tx) => {
      for (const gid of groups) {
        const g = tx.peek(gid)!;
        const parent = tx.peek(g.parent!)!;
        const gFree = effectiveLayout(parent, dev) === "free";
        const gst = resolveStyle(g, dev);
        let idx = parent.children.indexOf(gid);
        for (const cid of [...g.children]) {
          if (gFree && effectiveLayout(g, dev) === "free") {
            const cst = resolveStyle(tx.peek(cid)!, dev);
            tx.setStyle(cid, dev, { x: Math.round((cst.x ?? 0) + (gst.x ?? 0)), y: Math.round((cst.y ?? 0) + (gst.y ?? 0)) });
          }
          tx.move(cid, g.parent!, ++idx);
          out.push(cid);
        }
        tx.remove(gid);
      }
    }, { selection: out });
  }

  /** Alineación: con varios elementos libres, entre sí; con uno, respecto a su contenedor. En flujo usa `align-self`. */
  align(kind: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom"): void {
    const ids = this.topLevel(this.s.selection);
    if (!ids.length) return;
    const dev = this.device;
    const free = ids.filter((id) => this.isFreeChild(id));
    if (!free.length) {
      const horizontal = kind === "left" || kind === "hcenter" || kind === "right";
      const v = { left: "start", top: "start", hcenter: "center", vcenter: "center", right: "end", bottom: "end" }[kind];
      const okIds = ids.filter((id) => { const pl = this.parentLayout(id); return horizontal ? pl === "stack" : pl === "row"; });
      if (!okIds.length) { toast("En esta disposición la alineación se ajusta desde el contenedor (Alineación en el panel Disposición).", "info"); return; }
      this.setStyle(okIds, { alignSelf: v }, { label: "Alinear" });
      return;
    }
    const rects = free.map((id) => {
      const st = resolveStyle(this.doc.nodes[id], dev);
      const m = this.measure(id);
      return { id, x: st.x ?? 0, y: st.y ?? 0, w: typeof st.w === "number" ? st.w : m?.w ?? 100, h: typeof st.h === "number" ? st.h : m?.h ?? 40 };
    });
    let bounds: { x0: number; y0: number; x1: number; y1: number };
    if (rects.length > 1) {
      bounds = { x0: Math.min(...rects.map((r) => r.x)), y0: Math.min(...rects.map((r) => r.y)), x1: Math.max(...rects.map((r) => r.x + r.w)), y1: Math.max(...rects.map((r) => r.y + r.h)) };
    } else {
      const pr = this.measure(this.doc.nodes[free[0]].parent!);
      bounds = { x0: 0, y0: 0, x1: pr?.w ?? 800, y1: pr?.h ?? 400 };
    }
    this.commit("Alinear", (tx) => {
      for (const r of rects) {
        const patch: Record<string, number> = {};
        if (kind === "left") patch.x = bounds.x0;
        if (kind === "hcenter") patch.x = (bounds.x0 + bounds.x1) / 2 - r.w / 2;
        if (kind === "right") patch.x = bounds.x1 - r.w;
        if (kind === "top") patch.y = bounds.y0;
        if (kind === "vcenter") patch.y = (bounds.y0 + bounds.y1) / 2 - r.h / 2;
        if (kind === "bottom") patch.y = bounds.y1 - r.h;
        for (const k of Object.keys(patch)) patch[k] = Math.round(patch[k]);
        tx.setStyle(r.id, dev, patch);
      }
    });
  }

  /** Distribuye elementos libres de forma uniforme (3 o más). */
  distribute(axis: "x" | "y"): void {
    const ids = this.topLevel(this.s.selection).filter((id) => this.isFreeChild(id));
    if (ids.length < 3) { toast("Selecciona al menos 3 elementos libres para distribuir.", "info"); return; }
    const dev = this.device;
    const rs = ids.map((id) => {
      const st = resolveStyle(this.doc.nodes[id], dev);
      const m = this.measure(id);
      return { id, x: st.x ?? 0, y: st.y ?? 0, w: typeof st.w === "number" ? st.w : m?.w ?? 100, h: typeof st.h === "number" ? st.h : m?.h ?? 40 };
    }).sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y));
    const size = (r: (typeof rs)[number]) => (axis === "x" ? r.w : r.h);
    const pos = (r: (typeof rs)[number]) => (axis === "x" ? r.x : r.y);
    const total = pos(rs[rs.length - 1]) + size(rs[rs.length - 1]) - pos(rs[0]);
    const gap = (total - rs.reduce((a, r) => a + size(r), 0)) / (rs.length - 1);
    this.commit("Distribuir", (tx) => {
      let cur = pos(rs[0]);
      for (const r of rs) { tx.setStyle(r.id, dev, axis === "x" ? { x: Math.round(cur) } : { y: Math.round(cur) }); cur += size(r) + gap; }
    });
  }

  /** Mueve elementos libres (flechas del teclado). */
  nudge(dx: number, dy: number): void {
    const ids = this.topLevel(this.s.selection).filter((id) => this.isFreeChild(id) && !this.doc.nodes[id].locked);
    if (!ids.length) return;
    const dev = this.device;
    this.commit("Mover", (tx) => {
      for (const id of ids) { const st = resolveStyle(tx.peek(id)!, dev); tx.setStyle(id, dev, { x: (st.x ?? 0) + dx, y: (st.y ?? 0) + dy }); }
    }, { coalesce: `nudge:${ids.join(",")}` });
  }

  /** Aplica estilos de texto predefinidos. */
  applyTextStyle(ids: string[], style: PartialStyle, tag?: string): void {
    this.commit("Aplicar estilo de texto", (tx) => {
      for (const id of ids) {
        const n = tx.peek(id);
        if (!n || n.type !== "text") continue;
        tx.setStyle(id, this.device, { ...style });
        if (tag) tx.node(id).props.tag = tag;
      }
    });
  }

  /* ---------- Páginas ---------- */

  addPage(name: string): string {
    const pageId = uid("pg");
    this.commit("Nueva página", (tx) => {
      const root = makeNode("root", { name, s: { base: { layout: "stack", gap: 0, bg: "$bg", color: "$text", font: "$body", size: 16, lh: 1.6, align: "stretch" } } });
      const sec = materialize({
        type: "section", name: "Sección", s: { layout: "stack", padding: [96, 24, 96, 24], gap: 16, maxWidth: 1160, align: "stretch" }, children: [
          { type: "text", name: "Título", props: { text: name, tag: "h1" }, s: { font: "$heading", size: 48, weight: 700, color: "$text" }, tablet: { size: 40 }, mobile: { size: 32 } },
          { type: "text", name: "Párrafo", props: { text: "Escribe el contenido de esta página.", tag: "p" }, s: { size: 17, color: "$muted", lh: 1.65 } },
        ],
      });
      tx.nodes[root.id] = root;
      tx.addSubtree(sec, root.id);
      const pages = tx.editPages();
      pages.push({ id: pageId, name, slug: uniqueSlug(name, pages.map((p) => p.slug)), rootId: root.id });
    });
    this.store.set({ pageId, selection: [] });
    return pageId;
  }

  renamePage(id: string, name: string): void {
    const n = name.trim().slice(0, 80);
    if (!n) return;
    this.commit("Renombrar página", (tx) => {
      const pages = tx.editPages();
      const p = pages.find((x) => x.id === id);
      if (!p) return;
      p.name = n;
      tx.node(p.rootId).name = n;
    });
  }

  setPageSlug(id: string, slug: string): void {
    this.commit("Cambiar dirección de página", (tx) => {
      const pages = tx.editPages();
      const p = pages.find((x) => x.id === id);
      if (!p) return;
      p.slug = uniqueSlug(slugify(slug), pages.filter((x) => x.id !== id).map((x) => x.slug));
    }, { coalesce: `slug:${id}` });
  }

  setPageSeo(id: string, seo: { title?: string; description?: string }): void {
    this.commit("Cambiar SEO de página", (tx) => {
      const p = tx.editPages().find((x) => x.id === id);
      if (p) p.seo = { ...p.seo, ...seo };
    }, { coalesce: `seo:${id}` });
  }

  duplicatePageById(id: string): void {
    const page = this.doc.pages.find((p) => p.id === id);
    if (!page) return;
    const newId = uid("pg");
    this.commit("Duplicar página", (tx) => {
      const nodes = cloneSubtree(tx.nodes, page.rootId, (n) => copyName(n.name));
      for (const n of nodes) tx.nodes[n.id] = n;
      const pages = tx.editPages();
      const i = pages.findIndex((p) => p.id === id);
      pages.splice(i + 1, 0, { id: newId, name: copyName(page.name), slug: uniqueSlug(page.slug + "-copia", pages.map((p) => p.slug)), rootId: nodes[0].id, seo: page.seo ? { ...page.seo } : undefined });
    });
    this.store.set({ pageId: newId, selection: [] });
  }

  deletePage(id: string): void {
    if (this.doc.pages.length <= 1) { toast("El proyecto necesita al menos una página.", "info"); return; }
    const page = this.doc.pages.find((p) => p.id === id);
    if (!page) return;
    this.commit("Eliminar página", (tx) => {
      tx.remove(page.rootId);
      const pages = tx.editPages();
      pages.splice(pages.findIndex((p) => p.id === id), 1);
      const st = tx.editSettings();
      if (st.homePageId === id) st.homePageId = pages[0].id;
      // los enlaces hacia la página eliminada se vacían (no se dejan rotos)
      for (const n of Object.values(tx.nodes)) {
        if (n.props.href === `page:${id}`) tx.node(n.id).props.href = "";
      }
    });
    if (this.s.pageId === id) this.store.set({ pageId: this.doc.pages[0].id, selection: [] });
  }

  movePage(id: string, delta: -1 | 1): void {
    const i = this.doc.pages.findIndex((p) => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.doc.pages.length) return;
    this.commit("Reordenar páginas", (tx) => { const pages = tx.editPages(); [pages[i], pages[j]] = [pages[j], pages[i]]; });
  }

  reorderPage(id: string, toIndex: number): void {
    const i = this.doc.pages.findIndex((p) => p.id === id);
    if (i < 0 || toIndex === i) return;
    this.commit("Reordenar páginas", (tx) => { const pages = tx.editPages(); const [p] = pages.splice(i, 1); pages.splice(toIndex, 0, p); });
  }

  setHomePage(id: string): void {
    if (this.doc.settings.homePageId === id) return;
    this.commit("Página principal", (tx) => { tx.editSettings().homePageId = id; });
  }

  /* ---------- Tema y ajustes ---------- */

  setThemeColor(name: string, value: string): void {
    this.commit("Cambiar color global", (tx) => { tx.editTheme().colors[name] = value; }, { coalesce: `theme:${name}` });
  }
  addThemeColor(name: string, value: string): void {
    const key = name.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
    if (!key || this.doc.theme.colors[key]) { toast("Ese nombre de color ya existe o no es válido.", "info"); return; }
    this.commit("Añadir color global", (tx) => { tx.editTheme().colors[key] = value; });
  }
  removeThemeColor(name: string): void {
    if (["primary", "bg", "text"].includes(name)) return;
    this.commit("Eliminar color global", (tx) => {
      delete tx.editTheme().colors[name];
      // los elementos enlazados conservan el color actual como valor fijo
      const lit = this.doc.theme.colors[name];
      const fix = (obj: any) => {
        for (const k of Object.keys(obj)) {
          if (obj[k] === `$${name}`) obj[k] = lit;
          else if (obj[k] && typeof obj[k] === "object") fix(obj[k]);
        }
      };
      for (const id of Object.keys(tx.nodes)) {
        const json = JSON.stringify(tx.nodes[id].s) + JSON.stringify(tx.nodes[id].hover ?? {});
        if (json.includes(`"$${name}"`)) { const n = tx.node(id); fix(n.s); if (n.hover) fix(n.hover); }
      }
    });
  }
  setThemeFont(role: "heading" | "body", family: string): void {
    this.commit("Cambiar tipografía global", (tx) => { tx.editTheme().fonts[role] = family; });
  }
  applyPalette(colors: Partial<Theme["colors"]>): void {
    this.commit("Aplicar paleta", (tx) => { Object.assign(tx.editTheme().colors, colors); });
  }
  applyFontPair(heading: string, body: string): void {
    this.commit("Aplicar combinación tipográfica", (tx) => { const t = tx.editTheme(); t.fonts.heading = heading; t.fonts.body = body; });
  }
  saveColor(c: string): void {
    if (this.doc.savedColors.includes(c)) return;
    this.commit("Guardar color", (tx) => { const l = tx.editSavedColors(); l.unshift(c); l.splice(24); });
  }
  removeSavedColor(c: string): void {
    this.commit("Quitar color guardado", (tx) => { const l = tx.editSavedColors(); l.splice(l.indexOf(c), 1); });
  }
  setSettings(patch: Partial<Doc["settings"]>, coalesce?: string): void {
    this.commit("Cambiar ajustes del sitio", (tx) => { Object.assign(tx.editSettings(), patch); }, { coalesce: coalesce ?? `settings:${Object.keys(patch).join(",")}` });
  }

  /** Sustituye todo el documento (plantilla, restaurar versión). Es una entrada de historial. */
  replaceDoc(doc: Doc, label: string): void {
    const before = this.snap(label);
    this.undoStack.push(before);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.lastCoalesce = null;
    this.setDoc(doc, { selection: [], pageId: doc.pages[0].id });
    this.store.set({ pageId: doc.pages[0].id });
    this.syncHistoryFlags();
  }

  /** Añade las páginas de otro documento (p. ej. de una plantilla) al actual. */
  appendPages(other: Doc): void {
    this.commit("Añadir páginas de plantilla", (tx) => {
      const pages = tx.editPages();
      for (const p of other.pages) {
        const nodes: Node[] = [];
        walk(other, p.rootId, (n) => nodes.push(structuredClone(n)));
        const cloned = cloneSubtree(Object.fromEntries(nodes.map((n) => [n.id, n])), p.rootId);
        for (const n of cloned) tx.nodes[n.id] = n;
        pages.push({ id: uid("pg"), name: p.name, slug: uniqueSlug(p.slug === "index" ? "inicio" : p.slug, pages.map((x) => x.slug)), rootId: cloned[0].id, seo: p.seo });
      }
    });
  }

  /** Reinicia el documento a una página en blanco (usado al cambiar de plantilla). */
  blank(siteName: string): void { this.replaceDoc(blankDoc(siteName), "Documento en blanco"); }

  /* ---------- Utilidades de consulta ---------- */

  pageOf(id: string): Page | undefined { return pageOfNode(this.doc, id); }
  subtreeIds(id: string): string[] { return [id, ...descendants(this.doc, id)]; }
}
