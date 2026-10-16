/**
 * Área de trabajo: desplazamiento, zoom, selección, arrastre, redimensionado, rotación, guías,
 * edición de texto, gestos táctiles y menú contextual. Es la pieza más sensible del editor.
 */
import { isAncestor, isContainer } from "../../shared/model/doc";
import { effectiveLayout, resolveStyle } from "../../shared/model/style";
import { Node } from "../../shared/model/types";
import { Editor, EditorState, Rect } from "../core/editor";
import { clamp, h, ic, menu, MenuItem, toast } from "../lib/dom";
import { CanvasView } from "./view";

const PAD = 56;
const SNAP_PX = 6;
const DRAG_THRESHOLD = 4;
const LONG_PRESS_MS = 380;
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

type Mode =
  | null
  | { kind: "pan"; sx: number; sy: number; l: number; t: number }
  | { kind: "candidate"; id: string; sx: number; sy: number; shift: boolean; touch: boolean; timer?: number; wasSelected: boolean }
  | { kind: "freemove"; ids: string[]; sx: number; sy: number; start: Map<string, { x: number; y: number; w: number; h: number }>; parent: string; dropTarget: string | null }
  | { kind: "flowmove"; ids: string[]; ox: number; oy: number; w: number; h: number; target: DropTarget | null }
  | { kind: "resize"; id: string; handle: Handle; sx: number; sy: number; x: number; y: number; w: number; h: number; rot: number; free: boolean; ratio: number; isText: boolean; isMedia: boolean }
  | { kind: "rotate"; id: string; cx: number; cy: number; start: number; base: number }
  | { kind: "marquee"; sx: number; sy: number; container: string; additive: boolean; base: string[] }
  | { kind: "pinch"; d0: number; z0: number; mx: number; my: number };

interface DropTarget {
  parentId: string;
  index?: number;
  /** Posición cuando el destino es un contenedor libre. */
  pos?: { x: number; y: number };
  /** Línea indicadora en coordenadas de pantalla. */
  line?: { x: number; y: number; w: number; h: number };
  box?: DOMRect;
}

export class Workspace {
  readonly el: HTMLElement;
  readonly view: CanvasView;
  private scroller: HTMLElement;
  private world: HTMLElement;
  private frame: HTMLElement;
  private overlay: HTMLElement;
  private controls: HTMLElement;
  private zoomLabel!: HTMLElement;
  private mode: Mode = null;
  private pointers = new Map<number, { x: number; y: number; touch: boolean }>();
  private spaceDown = false;
  private raf = 0;
  private ro: ResizeObserver;
  private lastClick: { id: string | null; at: number } = { id: null, at: 0 };
  private editEl: HTMLElement | null = null;
  private editId: string | null = null;
  private frameLeft = PAD;
  private unsub: () => void;
  private cleanups: (() => void)[] = [];
  private guideLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  private labels: { x: number; y: number; text: string; kind?: "dist" | "size" }[] = [];
  private ghost: { x: number; y: number; w: number; h: number; text: string } | null = null;
  private dropTarget: DropTarget | null = null;
  private marqueeRect: { x: number; y: number; w: number; h: number } | null = null;
  private prev: EditorState;

  constructor(private ed: Editor) {
    this.prev = ed.s;
    this.frame = h("div", { class: "cv-frame" });
    this.world = h("div", { class: "cv-world" }, this.frame);
    this.scroller = h("div", { class: "cv-scroll", tabindex: "-1", "aria-label": "Lienzo de edición" }, this.world);
    this.overlay = h("div", { class: "cv-overlay" });
    this.controls = this.buildControls();
    this.el = h("div", { class: "cv" }, this.scroller, this.overlay, this.controls);
    this.view = new CanvasView(this.frame);
    ed.measure = (id) => this.view.measure(id);

    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: string, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opts);
      this.cleanups.push(() => t.removeEventListener(type, fn, opts));
    };
    on(this.scroller, "pointerdown", (e: PointerEvent) => this.onDown(e), { capture: true });
    on(this.scroller, "pointermove", (e: PointerEvent) => this.onMove(e));
    on(this.scroller, "pointerup", (e: PointerEvent) => this.onUp(e));
    on(this.scroller, "pointercancel", (e: PointerEvent) => this.onCancel(e));
    on(this.scroller, "dblclick", (e: MouseEvent) => this.onDblClick(e));
    on(this.scroller, "contextmenu", (e: MouseEvent) => this.onContext(e));
    on(this.scroller, "wheel", (e: WheelEvent) => this.onWheel(e), { passive: false });
    on(this.scroller, "scroll", () => this.scheduleOverlay());
    on(this.scroller, "touchmove", (e: TouchEvent) => { if (this.mode && ["freemove", "flowmove", "resize", "rotate", "pinch", "marquee"].includes(this.mode.kind)) e.preventDefault(); }, { passive: false });
    on(this.overlay, "pointerdown", (e: PointerEvent) => this.onOverlayDown(e));
    on(document, "keydown", (e: KeyboardEvent) => { if (e.code === "Space" && !this.typing(e)) { if (!this.spaceDown) { this.spaceDown = true; this.el.classList.add("cv--hand"); } e.preventDefault(); } });
    on(document, "keyup", (e: KeyboardEvent) => { if (e.code === "Space") { this.spaceDown = false; this.updateCursor(); } });

    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.scroller);
    this.ro.observe(this.frame);
    this.unsub = ed.store.subscribe((s, prev) => this.onState(s, prev));
    this.renderDoc();
    requestAnimationFrame(() => this.fit("width"));
  }

  destroy(): void {
    this.unsub();
    this.ro.disconnect();
    this.cleanups.forEach((f) => f());
    cancelAnimationFrame(this.raf);
    this.el.remove();
  }

  /* ---------- Estado → vista ---------- */

  private onState(s: EditorState, prev: EditorState): void {
    this.prev = prev;
    const docChanged = s.doc !== prev.doc || s.pageId !== prev.pageId || s.device !== prev.device || s.editingText !== prev.editingText || s.uiState !== prev.uiState || s.selection !== prev.selection && s.uiState === "hover";
    if (docChanged) this.renderDoc();
    if (s.zoom !== prev.zoom || s.widths !== prev.widths || s.device !== prev.device) this.layout();
    if (s.tool !== prev.tool) this.updateCursor();
    this.scheduleOverlay();
    if (s.editingText !== prev.editingText) this.syncEditing();
  }

  private renderDoc(): void {
    const s = this.ed.s;
    this.view.render(s.doc, this.ed.rootId, {
      device: s.device,
      hoverStateId: s.uiState === "hover" && s.selection.length === 1 ? s.selection[0] : null,
      editingId: s.editingText,
    });
    this.view.syncFonts(s.doc);
    this.layout();
  }

  /** Dimensiona el marco y el mundo según el zoom y el ancho del dispositivo. */
  layout(): void {
    const s = this.ed.s;
    const fw = s.widths[s.device];
    const z = s.zoom;
    const vw = this.scroller.clientWidth;
    const contentH = Math.max(this.view.contentHeight(), this.frame.offsetHeight, 640);
    const worldW = Math.max(vw, fw * z + PAD * 2);
    this.frameLeft = Math.max(PAD, (worldW - fw * z) / 2);
    this.frame.style.width = `${fw}px`;
    this.frame.style.minHeight = `${Math.max(640, Math.round(this.scroller.clientHeight / z - PAD / z))}px`;
    this.frame.style.transform = `scale(${z})`;
    this.frame.style.left = `${this.frameLeft}px`;
    this.frame.style.top = `${PAD}px`;
    this.world.style.width = `${worldW}px`;
    this.world.style.height = `${Math.max(this.frame.offsetHeight, contentH) * z + PAD * 2}px`;
    if (this.zoomLabel) this.zoomLabel.textContent = `${Math.round(z * 100)}%`;
    this.scheduleOverlay();
  }

  fit(mode: "width" | "page" = "width"): void {
    const s = this.ed.s;
    const fw = s.widths[s.device];
    const vw = this.scroller.clientWidth - PAD * 2;
    let z = vw / fw;
    if (mode === "page") z = Math.min(z, (this.scroller.clientHeight - PAD * 2) / Math.max(400, this.frame.offsetHeight));
    this.ed.setZoom(clamp(z, 0.1, 1));
    this.scroller.scrollLeft = 0;
  }

  zoomAt(newZ: number, cx: number, cy: number): void {
    const s = this.ed.s;
    const oldZ = s.zoom;
    z: {
      newZ = clamp(Math.round(newZ * 100) / 100, 0.1, 4);
      if (newZ === oldZ) break z;
      const fw = s.widths[s.device];
      const fx = (this.scroller.scrollLeft + cx - this.frameLeft) / oldZ;
      const fy = (this.scroller.scrollTop + cy - PAD) / oldZ;
      this.ed.setZoom(newZ);
      this.layout();
      const left = Math.max(PAD, (Math.max(this.scroller.clientWidth, fw * newZ + PAD * 2) - fw * newZ) / 2);
      this.scroller.scrollLeft = fx * newZ + left - cx;
      this.scroller.scrollTop = fy * newZ + PAD - cy;
    }
  }

  zoomBy(f: number): void {
    this.zoomAt(this.ed.s.zoom * f, this.scroller.clientWidth / 2, this.scroller.clientHeight / 2);
  }

  /** Lleva un nodo a la vista (p. ej. al elegirlo en el panel de capas). */
  reveal(id: string): void {
    const r = this.view.clientRect(id);
    if (!r) return;
    const sr = this.scroller.getBoundingClientRect();
    if (r.top < sr.top + 40 || r.bottom > sr.bottom - 40) this.scroller.scrollTop += r.top - sr.top - sr.height / 3;
    if (r.left < sr.left || r.right > sr.right) this.scroller.scrollLeft += r.left - sr.left - 60;
  }

  private updateCursor(): void {
    this.el.classList.toggle("cv--hand", this.ed.s.tool === "hand" || this.spaceDown);
  }

  private typing(e: Event): boolean {
    const t = (e.composedPath()[0] ?? e.target) as HTMLElement;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  /* ---------- Controles flotantes ---------- */

  private buildControls(): HTMLElement {
    const ed = this.ed;
    this.zoomLabel = h("button", { type: "button", class: "cv-zoomval", "aria-label": "Restablecer zoom al 100 %", "data-tip": "Zoom 100 %", onclick: () => this.zoomAt(1, this.scroller.clientWidth / 2, this.scroller.clientHeight / 2) }, "100%");
    const toolBtn = (tool: "select" | "hand", icon: string, tip: string) =>
      h("button", { type: "button", class: "cv-btn", "data-tool": tool, "aria-label": tip, "data-tip": tip, onclick: () => ed.setTool(tool) }, ic(icon, 17));
    const bar = h("div", { class: "cv-controls", role: "toolbar", "aria-label": "Herramientas del lienzo" },
      h("div", { class: "cv-group" }, toolBtn("select", "pointer", "Seleccionar (V)"), toolBtn("hand", "hand", "Mover el lienzo (H)")),
      h("div", { class: "cv-group" },
        h("button", { type: "button", class: "cv-btn", "aria-label": "Alejar", "data-tip": "Alejar (Ctrl −)", onclick: () => this.zoomBy(1 / 1.2) }, ic("zoom-out", 17)),
        this.zoomLabel,
        h("button", { type: "button", class: "cv-btn", "aria-label": "Acercar", "data-tip": "Acercar (Ctrl +)", onclick: () => this.zoomBy(1.2) }, ic("zoom-in", 17)),
        h("button", { type: "button", class: "cv-btn", "aria-label": "Ajustar al ancho visible", "data-tip": "Ajustar al área visible (Ctrl 0)", onclick: () => this.fit("width") }, ic("fit", 17))),
    );
    ed.store.subscribe((s) => {
      bar.querySelectorAll<HTMLElement>("[data-tool]").forEach((b) => b.classList.toggle("is-on", b.dataset.tool === s.tool));
    });
    bar.querySelectorAll<HTMLElement>("[data-tool]").forEach((b) => b.classList.toggle("is-on", b.dataset.tool === ed.s.tool));
    return bar;
  }

  /* ---------- Hit testing ---------- */

  /** Elemento seleccionable a partir del que está bajo el puntero (respeta bloqueos y grupos). */
  private pick(id: string | null, fromPoint?: { x: number; y: number }): string | null {
    if (!id) return null;
    const doc = this.ed.doc;
    let node: Node | undefined = doc.nodes[id];
    if (!node) return null;
    // grupos: se selecciona el grupo salvo que ya se esté dentro de él
    const sel = this.ed.s.selection;
    const chain: Node[] = [];
    for (let n: Node | undefined = node; n; n = n.parent ? doc.nodes[n.parent] : undefined) chain.unshift(n);
    for (const n of chain) {
      if (n.type === "container" && n.props.group && !sel.some((sid) => sid === n.id || isAncestor(doc, n.id, sid))) { node = n; break; }
    }
    while (node && (node.locked || node.type === "root")) {
      if (node.type === "root") return null;
      node = node.parent ? doc.nodes[node.parent] : undefined;
    }
    void fromPoint;
    return node?.id ?? null;
  }

  /** Con captura de puntero el destino del evento es el contenedor de scroll, así que se consulta por posición. */
  private rawIdAt(e: PointerEvent | MouseEvent): string | null {
    return this.view.idsAt(e.clientX, e.clientY)[0] ?? this.view.idFromPath(e.composedPath());
  }

  private hitId(e: PointerEvent | MouseEvent): string | null {
    return this.pick(this.rawIdAt(e));
  }

  /* ---------- Puntero ---------- */

  private onDown(e: PointerEvent): void {
    const touch = e.pointerType === "touch";
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch });
    const ed = this.ed;

    // edición de texto en curso: los clics dentro del texto son del navegador; fuera, terminan la edición
    if (this.editEl) {
      const inside = e.composedPath().includes(this.editEl);
      if (inside) return;
      this.finishEdit(true);
    }

    if (touch && [...this.pointers.values()].filter((p) => p.touch).length === 2) {
      this.abortMode();
      const [a, b] = [...this.pointers.values()];
      this.mode = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: ed.s.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (e.button === 2) return;

    const handTool = ed.s.tool === "hand" || this.spaceDown || e.button === 1;
    if (handTool) {
      e.preventDefault();
      this.scroller.setPointerCapture(e.pointerId);
      this.mode = { kind: "pan", sx: e.clientX, sy: e.clientY, l: this.scroller.scrollLeft, t: this.scroller.scrollTop };
      this.el.classList.add("cv--panning");
      return;
    }

    const id = this.hitId(e);
    const shift = e.shiftKey || e.ctrlKey || e.metaKey;
    if (id) {
      if (shift && !touch) { ed.toggleSelect(id); this.mode = null; return; }
      const wasSelected = ed.s.selection.includes(id);
      if (!touch && !wasSelected) ed.select([id]);
      this.mode = { kind: "candidate", id, sx: e.clientX, sy: e.clientY, shift, touch, wasSelected };
      if (!touch) this.scroller.setPointerCapture(e.pointerId);
      else {
        const m = this.mode;
        m.timer = window.setTimeout(() => {
          if (this.mode !== m) return;
          ed.select([id]);
          navigator.vibrate?.(12);
          this.beginMove(id, m.sx, m.sy);
        }, LONG_PRESS_MS);
      }
      return;
    }
    // fondo de la página o fuera de ella
    if (touch) { this.mode = { kind: "candidate", id: "", sx: e.clientX, sy: e.clientY, shift: false, touch: true, wasSelected: false }; return; }
    if (!shift) ed.clearSelection();
    this.scroller.setPointerCapture(e.pointerId);
    const container = this.marqueeContainer(e);
    this.mode = { kind: "marquee", sx: e.clientX, sy: e.clientY, container, additive: shift, base: shift ? [...ed.s.selection] : [] };
  }

  private marqueeContainer(e: PointerEvent): string {
    const raw = this.rawIdAt(e);
    const doc = this.ed.doc;
    let n = raw ? doc.nodes[raw] : undefined;
    while (n && !(isContainer(n) && effectiveLayout(n, this.ed.device) === "free") && n.type !== "root") n = n.parent ? doc.nodes[n.parent] : undefined;
    return n?.id ?? this.ed.rootId;
  }

  private onMove(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    const m = this.mode;
    if (!m) {
      if (e.pointerType === "mouse" && !this.editEl && this.ed.s.tool === "select" && !this.spaceDown) {
        const id = this.hitId(e);
        if (id !== this.ed.s.hoverId) this.ed.store.set({ hoverId: id });
      }
      return;
    }
    switch (m.kind) {
      case "pan":
        this.scroller.scrollLeft = m.l - (e.clientX - m.sx);
        this.scroller.scrollTop = m.t - (e.clientY - m.sy);
        break;
      case "pinch": {
        const pts = [...this.pointers.values()].filter((q) => q.touch);
        if (pts.length < 2) break;
        const [a, b] = pts;
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const r = this.scroller.getBoundingClientRect();
        this.zoomAt(m.z0 * (d / m.d0), mx - r.left, my - r.top);
        this.scroller.scrollLeft -= mx - m.mx;
        this.scroller.scrollTop -= my - m.my;
        m.mx = mx; m.my = my;
        break;
      }
      case "candidate": {
        const dist = Math.hypot(e.clientX - m.sx, e.clientY - m.sy);
        if (m.touch) { if (dist > 8) { if (m.timer) clearTimeout(m.timer); this.mode = null; } break; }
        if (dist > DRAG_THRESHOLD && m.id) {
          if (!this.ed.s.selection.includes(m.id)) this.ed.select([m.id]);
          this.beginMove(m.id, m.sx, m.sy);
          this.onMove(e);
        }
        break;
      }
      case "freemove": this.moveFree(m, e); break;
      case "flowmove": this.moveFlow(m, e); break;
      case "resize": this.doResize(m, e); break;
      case "rotate": this.doRotate(m, e); break;
      case "marquee": this.doMarquee(m, e); break;
    }
  }

  private onUp(e: PointerEvent): void {
    const m = this.mode;
    this.pointers.delete(e.pointerId);
    if (m?.kind === "pinch") { if ([...this.pointers.values()].filter((p) => p.touch).length < 2) this.mode = null; return; }
    try { this.scroller.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
    if (!m) return;
    this.mode = null;
    this.el.classList.remove("cv--panning");
    switch (m.kind) {
      case "candidate": {
        if (m.timer) clearTimeout(m.timer);
        if (m.touch && m.id) {
          if (e.shiftKey) this.ed.toggleSelect(m.id); else this.ed.select([m.id]);
        } else if (!m.touch && m.wasSelected && !m.shift && this.ed.s.selection.length > 1) {
          this.ed.select([m.id]);
        }
        if (m.touch && !m.id) this.ed.clearSelection();
        this.registerClick(m.id || null, e);
        break;
      }
      case "freemove": this.endFreeMove(m, e); break;
      case "flowmove": this.endFlowMove(m); break;
      case "resize":
      case "rotate": this.ed.endGesture(); this.afterGesture(); break;
      case "marquee": this.marqueeRect = null; this.scheduleOverlay(); break;
    }
    this.clearTransient();
  }

  private onCancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    const m = this.mode;
    if (m?.kind === "candidate" && m.timer) clearTimeout(m.timer);
    if (m?.kind === "pinch") { if ([...this.pointers.values()].filter((p) => p.touch).length < 2) this.mode = null; return; }
    if (m && m.kind !== "candidate") this.abortMode();
    this.mode = null;
    this.el.classList.remove("cv--panning");
  }

  private abortMode(): void {
    const m = this.mode;
    if (m?.kind === "candidate" && m.timer) clearTimeout(m.timer);
    if (this.ed.inGesture) this.ed.cancelGesture();
    this.mode = null;
    this.clearTransient();
  }

  /** Cancela el gesto actual (Escape). Devuelve true si había algo que cancelar. */
  cancelInteraction(): boolean {
    if (this.editEl) { this.finishEdit(false); return true; }
    if (this.mode && this.mode.kind !== "candidate") { this.abortMode(); return true; }
    return false;
  }

  private clearTransient(): void {
    this.guideLines = []; this.labels = []; this.ghost = null; this.dropTarget = null; this.marqueeRect = null;
    this.scheduleOverlay();
  }

  private registerClick(id: string | null, e: PointerEvent): void {
    const now = Date.now();
    if (id && this.lastClick.id === id && now - this.lastClick.at < 380 && e.pointerType === "touch") this.openEditorFor(id, e);
    this.lastClick = { id, at: now };
  }

  /* ---------- Doble clic: editar texto / entrar en grupo ---------- */

  private onDblClick(e: MouseEvent): void {
    if (this.editEl) return;
    const raw = this.rawIdAt(e);
    if (!raw) return;
    this.openEditorFor(raw, e);
  }

  private openEditorFor(rawId: string, e: MouseEvent | PointerEvent): void {
    const doc = this.ed.doc;
    const node = doc.nodes[rawId];
    if (!node) return;
    const own = this.ed.s.selection[0];
    // doble clic sobre un grupo: selecciona el hijo bajo el cursor
    const sel = own ? doc.nodes[own] : undefined;
    if (sel && sel.type === "container" && sel.props.group) {
      const inside = this.view.idsAt(e.clientX, e.clientY).find((id) => id !== sel.id && isAncestor(doc, sel.id, id));
      if (inside) { this.ed.select([inside]); return; }
    }
    const target = this.pick(rawId) ?? rawId;
    const tn = doc.nodes[target];
    if (tn && !tn.locked && (tn.type === "text" || tn.type === "button")) this.startEdit(target);
  }

  startEdit(id: string): void {
    const n = this.ed.doc.nodes[id];
    if (!n || n.locked || (n.type !== "text" && n.type !== "button")) return;
    if (this.mode) this.abortMode();
    this.ed.select([id]);
    this.ed.store.set({ editingText: id });
  }

  private syncEditing(): void {
    const id = this.ed.s.editingText;
    if (id && id !== this.editId) {
      this.finishEdit(false, true);
      // el nodo se vuelve a renderizar con la clave «e»; esperamos al ciclo siguiente
      requestAnimationFrame(() => {
        const el = this.view.startEditing(id);
        if (!el) return;
        this.editEl = el; this.editId = id;
        el.focus({ preventScroll: true });
        const sel = el.ownerDocument.getSelection?.();
        const range = document.createRange();
        range.selectNodeContents(el);
        (this.view.shadow as any).getSelection?.()?.removeAllRanges?.();
        sel?.removeAllRanges();
        sel?.addRange(range);
        const isBtn = this.ed.doc.nodes[id]?.type === "button";
        const onKey = (ev: KeyboardEvent) => {
          ev.stopPropagation();
          if (ev.key === "Escape") { ev.preventDefault(); this.finishEdit(false); }
          else if ((ev.key === "Enter" && (isBtn || ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); this.finishEdit(true); }
        };
        const onBlur = () => setTimeout(() => { if (this.editEl === el) this.finishEdit(true); }, 0);
        el.addEventListener("keydown", onKey);
        el.addEventListener("blur", onBlur);
        (el as any).__off = () => { el.removeEventListener("keydown", onKey); el.removeEventListener("blur", onBlur); };
        this.scheduleOverlay();
      });
    } else if (!id && this.editEl) this.finishEdit(true, true);
  }

  /** Termina la edición de texto. `commit=false` descarta los cambios (Escape). */
  finishEdit(commit: boolean, silent = false): void {
    const id = this.editId;
    const el = this.editEl;
    if (!id || !el) return;
    (el as any).__off?.();
    this.editEl = null; this.editId = null;
    const text = this.view.stopEditing(id);
    getSelection()?.removeAllRanges();
    if (!silent) this.ed.store.set({ editingText: null });
    if (commit && text !== null) {
      const n = this.ed.doc.nodes[id];
      if (n) {
        if (n.type === "text") this.ed.setText(id, text);
        else if (text.trim() && n.props.text !== text) this.ed.setProps([id], { text }, { label: "Editar texto" });
      }
    }
    this.renderDoc();
    this.scroller.focus({ preventScroll: true });
  }

  /* ---------- Mover ---------- */

  private beginMove(id: string, sx: number, sy: number): void {
    const ed = this.ed;
    const ids = ed.topLevel(ed.s.selection).filter((x) => !ed.doc.nodes[x].locked);
    if (!ids.length) { this.mode = null; return; }
    const dev = ed.device;
    const allFree = ids.every((x) => ed.isFreeChild(x));
    if (allFree) {
      const start = new Map<string, { x: number; y: number; w: number; h: number }>();
      for (const x of ids) {
        const st = resolveStyle(ed.doc.nodes[x], dev);
        const m = this.view.measure(x) ?? { x: 0, y: 0, w: 100, h: 40 };
        start.set(x, { x: st.x ?? m.x, y: st.y ?? m.y, w: m.w, h: m.h });
      }
      ed.beginGesture(ids.length > 1 ? `Mover ${ids.length} elementos` : `Mover ${ed.doc.nodes[ids[0]].name}`);
      this.mode = { kind: "freemove", ids, sx, sy, start, parent: ed.doc.nodes[ids[0]].parent!, dropTarget: null };
    } else {
      const flowIds = ids.filter((x) => !ed.isFreeChild(x));
      const r = this.view.clientRect(id) ?? new DOMRect(sx, sy, 100, 40);
      this.mode = { kind: "flowmove", ids: flowIds.length ? flowIds : ids, ox: sx - r.left, oy: sy - r.top, w: r.width, h: r.height, target: null };
    }
    this.el.classList.add("cv--dragging");
  }

  private candidateLines(ids: string[], parentId: string): { xs: number[]; ys: number[] } {
    const xs: number[] = [], ys: number[] = [];
    const doc = this.ed.doc;
    const parent = doc.nodes[parentId];
    const pm = this.view.measure(parentId);
    if (pm) { xs.push(0, pm.w / 2, pm.w); ys.push(0, pm.h / 2, pm.h); }
    for (const cid of parent.children) {
      if (ids.includes(cid) || doc.nodes[cid].hidden) continue;
      const r = this.view.measure(cid);
      if (!r) continue;
      xs.push(r.x, r.x + r.w / 2, r.x + r.w);
      ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    }
    return { xs, ys };
  }

  private moveFree(m: Extract<Mode, { kind: "freemove" }>, e: PointerEvent): void {
    const ed = this.ed;
    const z = ed.s.zoom;
    let dx = (e.clientX - m.sx) / z, dy = (e.clientY - m.sy) / z;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    // caja que ocupa toda la selección
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of m.start.values()) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x + s.w); y1 = Math.max(y1, s.y + s.h); }
    this.guideLines = []; this.labels = [];
    const thr = SNAP_PX / z;
    let snappedX = false, snappedY = false;
    if (ed.s.guides && !e.altKey) {
      const { xs, ys } = this.candidateLines(m.ids, m.parent);
      const mine = (a: number, b: number) => [a, (a + b) / 2, b];
      let best = thr + 1, adj = 0, line = 0;
      for (const v of mine(x0 + dx, x1 + dx)) for (const c of xs) { const d = c - v; if (Math.abs(d) < best) { best = Math.abs(d); adj = d; line = c; } }
      if (best <= thr) { dx += adj; snappedX = true; this.addGuide("v", line, m.parent); }
      best = thr + 1; adj = 0; line = 0;
      for (const v of mine(y0 + dy, y1 + dy)) for (const c of ys) { const d = c - v; if (Math.abs(d) < best) { best = Math.abs(d); adj = d; line = c; } }
      if (best <= thr) { dy += adj; snappedY = true; this.addGuide("h", line, m.parent); }
    }
    if (ed.s.snapGrid) {
      if (!snappedX) dx = Math.round((x0 + dx) / 8) * 8 - x0;
      if (!snappedY) dy = Math.round((y0 + dy) / 8) * 8 - y0;
    }
    ed.applyGesture((tx) => {
      for (const [id, s] of m.start) tx.setStyle(id, ed.device, { x: Math.round(s.x + dx), y: Math.round(s.y + dy) });
    });
    // distancias al contenedor
    const pm = this.view.measure(m.parent);
    if (pm) {
      const L = Math.round(x0 + dx), T = Math.round(y0 + dy);
      const box = this.view.clientRect(m.ids[0]);
      const o = this.overlay.getBoundingClientRect();
      if (box && m.ids.length === 1) {
        this.labels.push({ x: box.left - o.left - 6, y: box.top - o.top + box.height / 2, text: `${L}`, kind: "dist" });
        this.labels.push({ x: box.left - o.left + box.width / 2, y: box.top - o.top - 8, text: `${T}`, kind: "dist" });
      }
    }
    // ¿se está soltando sobre otro contenedor?
    const target = this.findDrop(e.clientX, e.clientY, m.ids, 0, 0);
    const parentRect = this.view.clientRect(m.parent);
    const outside = parentRect && (e.clientX < parentRect.left || e.clientX > parentRect.right || e.clientY < parentRect.top - 10 || e.clientY > parentRect.bottom + 10);
    m.dropTarget = outside && target && target.parentId !== m.parent ? target.parentId : null;
    this.dropTarget = m.dropTarget && target ? target : null;
    this.autoScroll(e);
    this.scheduleOverlay();
  }

  private addGuide(axis: "v" | "h", at: number, parentId: string): void {
    const pr = this.view.clientRect(parentId);
    const o = this.overlay.getBoundingClientRect();
    if (!pr) return;
    const z = this.ed.s.zoom;
    if (axis === "v") { const x = pr.left - o.left + at * z; this.guideLines.push({ x1: x, y1: pr.top - o.top, x2: x, y2: pr.bottom - o.top }); }
    else { const y = pr.top - o.top + at * z; this.guideLines.push({ x1: pr.left - o.left, y1: y, x2: pr.right - o.left, y2: y }); }
  }

  private endFreeMove(m: Extract<Mode, { kind: "freemove" }>, e: PointerEvent): void {
    const ed = this.ed;
    if (m.dropTarget) {
      const t = this.findDrop(e.clientX, e.clientY, m.ids, 0, 0);
      ed.cancelGesture();
      if (t) { ed.moveNodes(m.ids, t.parentId, t.index, { pos: t.pos }); this.afterGesture(); }
      return;
    }
    ed.endGesture();
    this.afterGesture();
  }

  private moveFlow(m: Extract<Mode, { kind: "flowmove" }>, e: PointerEvent): void {
    const o = this.overlay.getBoundingClientRect();
    this.ghost = { x: e.clientX - o.left - m.ox, y: e.clientY - o.top - m.oy, w: m.w, h: m.h, text: this.ed.doc.nodes[m.ids[0]]?.name ?? "" };
    m.target = this.findDrop(e.clientX, e.clientY, m.ids, m.ox, m.oy);
    this.dropTarget = m.target;
    this.autoScroll(e);
    this.scheduleOverlay();
  }

  private endFlowMove(m: Extract<Mode, { kind: "flowmove" }>): void {
    const t = m.target;
    if (t) this.ed.moveNodes(m.ids, t.parentId, t.index, { pos: t.pos });
    this.afterGesture();
  }

  /** Tras mover/redimensionar elementos libres, el contenedor crece si hace falta. */
  private afterGesture(): void {
    this.el.classList.remove("cv--dragging");
    this.layout();
  }

  private autoScroll(e: PointerEvent): void {
    const r = this.scroller.getBoundingClientRect();
    const edge = 48;
    if (e.clientY < r.top + edge) this.scroller.scrollTop -= 14;
    else if (e.clientY > r.bottom - edge) this.scroller.scrollTop += 14;
    if (e.clientX < r.left + edge) this.scroller.scrollLeft -= 14;
    else if (e.clientX > r.right - edge) this.scroller.scrollLeft += 14;
  }

  /** Contenedor y posición de destino bajo el puntero. */
  private findDrop(cx: number, cy: number, ids: string[], ox: number, oy: number): DropTarget | null {
    const ed = this.ed;
    const doc = ed.doc;
    const o = this.overlay.getBoundingClientRect();
    let parent: Node | undefined;
    for (const id of this.view.idsAt(cx, cy)) {
      const n = doc.nodes[id];
      if (!n || !isContainer(n) || n.hidden) continue;
      if (ids.includes(id) || ids.some((d) => isAncestor(doc, d, id))) continue;
      if (!ed.canDropInto(ids, id)) continue;
      parent = n;
      break;
    }
    parent ??= doc.nodes[ed.rootId];
    const pr = this.view.clientRect(parent.id);
    if (!pr) return null;
    const z = ed.s.zoom;
    const layout = effectiveLayout(parent, ed.device);
    if (layout === "free") {
      const x = (cx - pr.left - ox) / z, y = (cy - pr.top - oy) / z;
      return { parentId: parent.id, pos: { x: Math.max(0, x), y: Math.max(0, y) }, box: pr };
    }
    const kids = parent.children.filter((c) => !ids.includes(c) && !doc.nodes[c].hidden);
    if (!kids.length) return { parentId: parent.id, index: 0, box: pr, line: { x: pr.left - o.left + 8, y: pr.top - o.top + pr.height / 2 - 1, w: pr.width - 16, h: 3 } };
    const rects = kids.map((c) => ({ id: c, r: this.view.clientRect(c)! })).filter((k) => k.r);
    const vertical = layout === "stack";
    let index = kids.length;
    let line: DropTarget["line"];
    if (vertical) {
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i].r;
        if (cy < r.top + r.height / 2) { index = parent.children.indexOf(rects[i].id); line = { x: r.left - o.left, y: r.top - o.top - 2, w: r.width, h: 3 }; break; }
      }
      if (!line) { const r = rects[rects.length - 1].r; index = parent.children.indexOf(rects[rects.length - 1].id) + 1; line = { x: r.left - o.left, y: r.bottom - o.top - 1, w: r.width, h: 3 }; }
    } else {
      // fila o cuadrícula: el hijo más cercano decide, antes o después según el lado
      let best = Infinity, bi = 0;
      rects.forEach((k, i) => { const d = Math.hypot(cx - (k.r.left + k.r.width / 2), cy - (k.r.top + k.r.height / 2)); if (d < best) { best = d; bi = i; } });
      const r = rects[bi].r;
      const before = cx < r.left + r.width / 2;
      index = parent.children.indexOf(rects[bi].id) + (before ? 0 : 1);
      line = { x: (before ? r.left : r.right) - o.left - 1, y: r.top - o.top, w: 3, h: r.height };
    }
    return { parentId: parent.id, index, line, box: pr };
  }

  /* ---------- Redimensionar y rotar ---------- */

  private onOverlayDown(e: PointerEvent): void {
    const t = e.target as HTMLElement;
    const handle = t.dataset.handle as Handle | "rot" | "move" | undefined;
    if (!handle) return;
    const ed = this.ed;
    const id = ed.s.selection[0];
    const node = id ? ed.doc.nodes[id] : undefined;
    if (!node || ed.s.selection.length !== 1 || node.locked) return;
    e.preventDefault();
    e.stopPropagation();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" });
    this.scroller.setPointerCapture(e.pointerId);
    const st = resolveStyle(node, ed.device);
    const m = this.view.measure(id) ?? { x: 0, y: 0, w: 100, h: 100 };
    if (handle === "rot") {
      const r = this.view.clientRect(id)!;
      this.mode = { kind: "rotate", id, cx: r.left + r.width / 2, cy: r.top + r.height / 2, start: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)), base: st.rotate ?? 0 };
      ed.beginGesture("Rotar");
      return;
    }
    if (handle === "move") { this.beginMove(id, e.clientX, e.clientY); return; }
    const free = ed.isFreeChild(id);
    this.mode = {
      kind: "resize", id, handle, sx: e.clientX, sy: e.clientY, x: st.x ?? m.x, y: st.y ?? m.y, w: m.w, h: m.h, rot: st.rotate ?? 0, free,
      ratio: m.w / Math.max(1, m.h), isText: node.type === "text", isMedia: node.type === "image" || node.type === "video",
    };
    ed.beginGesture(`Redimensionar ${node.name}`);
  }

  private doResize(m: Extract<Mode, { kind: "resize" }>, e: PointerEvent): void {
    const ed = this.ed;
    const z = ed.s.zoom;
    const rad = (m.rot * Math.PI) / 180;
    const dxs = (e.clientX - m.sx) / z, dys = (e.clientY - m.sy) / z;
    // desplazamiento en el sistema local del elemento (rotado)
    const dx = dxs * Math.cos(rad) + dys * Math.sin(rad);
    const dy = -dxs * Math.sin(rad) + dys * Math.cos(rad);
    const hasE = m.handle.includes("e"), hasW = m.handle.includes("w"), hasN = m.handle.includes("n"), hasS = m.handle.includes("s");
    let w = m.w + (hasE ? dx : hasW ? -dx : 0);
    let hh = m.h + (hasS ? dy : hasN ? -dy : 0);
    const node = ed.doc.nodes[m.id];
    const keep = e.shiftKey || (node && node.props.lock) || false;
    if (keep && (hasE || hasW) && (hasN || hasS)) {
      if (Math.abs(w - m.w) / m.w > Math.abs(hh - m.h) / m.h) hh = w / m.ratio; else w = hh * m.ratio;
    } else if (keep && (hasE || hasW)) hh = w / m.ratio;
    else if (keep && (hasN || hasS)) w = hh * m.ratio;
    w = Math.max(8, w); hh = Math.max(8, hh);
    if (ed.s.snapGrid) { w = Math.round(w / 8) * 8; hh = Math.round(hh / 8) * 8; }
    const patch: Record<string, unknown> = {};
    if (hasE || hasW || keep) patch.w = Math.round(w);
    if ((hasN || hasS || keep) && !m.isText) patch.h = Math.round(hh);
    if (m.free) {
      // el centro se desplaza media diferencia sobre los ejes locales para anclar el borde opuesto
      const shiftX = (hasE || hasW) ? (hasE ? (w - m.w) / 2 : -(w - m.w) / 2) : 0;
      const shiftY = (hasS || hasN) ? (hasS ? (hh - m.h) / 2 : -(hh - m.h) / 2) : 0;
      const cx = m.x + m.w / 2 + shiftX * Math.cos(rad) - shiftY * Math.sin(rad);
      const cy = m.y + m.h / 2 + shiftX * Math.sin(rad) + shiftY * Math.cos(rad);
      patch.x = Math.round(cx - w / 2);
      patch.y = Math.round(cy - hh / 2);
    }
    ed.applyGesture((tx) => tx.setStyle(m.id, ed.device, patch));
    const o = this.overlay.getBoundingClientRect();
    this.labels = [];
    const box = this.view.clientRect(m.id);
    if (box) this.labels.push({ x: box.left - o.left + box.width / 2, y: box.bottom - o.top + 16, text: `${Math.round(w)} × ${m.isText ? Math.round(this.view.measure(m.id)?.h ?? hh) : Math.round(hh)}`, kind: "size" });
    this.scheduleOverlay();
  }

  private doRotate(m: Extract<Mode, { kind: "rotate" }>, e: PointerEvent): void {
    const ed = this.ed;
    const a = Math.atan2(e.clientY - m.cy, e.clientX - m.cx);
    let deg = m.base + ((a - m.start) * 180) / Math.PI;
    deg = ((deg + 540) % 360) - 180;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
    deg = Math.round(deg * 10) / 10;
    ed.applyGesture((tx) => tx.setStyle(m.id, ed.device, { rotate: deg === 0 ? undefined : deg }));
    const o = this.overlay.getBoundingClientRect();
    const box = this.view.clientRect(m.id);
    this.labels = box ? [{ x: box.left - o.left + box.width / 2, y: box.top - o.top - 28, text: `${deg}°`, kind: "size" }] : [];
    this.scheduleOverlay();
  }

  /* ---------- Selección por área ---------- */

  private doMarquee(m: Extract<Mode, { kind: "marquee" }>, e: PointerEvent): void {
    const o = this.overlay.getBoundingClientRect();
    const x0 = Math.min(m.sx, e.clientX), y0 = Math.min(m.sy, e.clientY), x1 = Math.max(m.sx, e.clientX), y1 = Math.max(m.sy, e.clientY);
    this.marqueeRect = { x: x0 - o.left, y: y0 - o.top, w: x1 - x0, h: y1 - y0 };
    const doc = this.ed.doc;
    const container = doc.nodes[m.container];
    const hit: string[] = [];
    for (const cid of container?.children ?? []) {
      const n = doc.nodes[cid];
      if (!n || n.hidden || n.locked) continue;
      const r = this.view.clientRect(cid);
      if (r && r.left < x1 && r.right > x0 && r.top < y1 && r.bottom > y0) hit.push(cid);
    }
    this.ed.select(m.additive ? [...new Set([...m.base, ...hit])] : hit);
    this.autoScroll(e);
    this.scheduleOverlay();
  }

  /* ---------- Arrastrar desde el panel «Insertar» ---------- */

  /** ¿El punto está sobre el área de trabajo? */
  isOver(cx: number, cy: number): boolean {
    const r = this.scroller.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  private dropFor(spec: { type: string }, cx: number, cy: number, size: { w: number; h: number }): DropTarget | null {
    const t = this.findDrop(cx, cy, [], size.w / 2, 12);
    if (!t) return null;
    if (spec.type === "section") {
      // las secciones siempre van en la raíz, según la posición vertical
      const doc = this.ed.doc;
      const root = doc.nodes[this.ed.rootId];
      const o = this.overlay.getBoundingClientRect();
      let index = root.children.length;
      let line: DropTarget["line"];
      for (let i = 0; i < root.children.length; i++) {
        const r = this.view.clientRect(root.children[i]);
        if (r && cy < r.top + r.height / 2) { index = i; line = { x: r.left - o.left, y: r.top - o.top - 2, w: r.width, h: 4 }; break; }
      }
      if (!line && root.children.length) { const r = this.view.clientRect(root.children[root.children.length - 1]); if (r) line = { x: r.left - o.left, y: r.bottom - o.top - 2, w: r.width, h: 4 }; }
      return { parentId: root.id, index, line };
    }
    return t;
  }

  /** Muestra dónde caería un elemento arrastrado desde el panel. */
  previewDrop(spec: { type: string }, cx: number, cy: number, size: { w: number; h: number }): void {
    this.dropTarget = this.isOver(cx, cy) ? this.dropFor(spec, cx, cy, size) : null;
    this.scheduleOverlay();
  }
  endPreviewDrop(): void { this.dropTarget = null; this.scheduleOverlay(); }

  /** Inserta un elemento en el punto de pantalla indicado. Devuelve false si el punto no está sobre el lienzo. */
  insertAt(spec: any, size: { w: number; h: number }, cx: number, cy: number): boolean {
    if (!this.isOver(cx, cy)) return false;
    const t = this.dropFor(spec, cx, cy, size);
    this.dropTarget = null;
    if (!t) return false;
    this.ed.insert(spec, { parentId: t.parentId, index: t.index, x: t.pos?.x, y: t.pos?.y, size });
    return true;
  }

  /* ---------- Rueda y menú contextual ---------- */

  private onWheel(e: WheelEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const r = this.scroller.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
    this.zoomAt(this.ed.s.zoom * factor, e.clientX - r.left, e.clientY - r.top);
  }

  private onContext(e: MouseEvent): void {
    e.preventDefault();
    const ed = this.ed;
    const id = this.hitId(e);
    if (id && !ed.s.selection.includes(id)) ed.select([id]);
    const sel = ed.selected;
    const has = sel.length > 0;
    const single = sel.length === 1 ? sel[0] : null;
    const items: MenuItem[] = [];
    if (has) {
      if (single && (single.type === "text" || single.type === "button")) items.push({ label: "Editar texto", icon: "edit", shortcut: "Enter", onClick: () => this.startEdit(single.id) });
      items.push(
        { label: "Copiar", icon: "copy", shortcut: "Ctrl C", onClick: () => { ed.copy(); toast("Copiado", "info", 1200); } },
        { label: "Cortar", icon: "copy", shortcut: "Ctrl X", onClick: () => ed.cut() },
      );
    }
    items.push({ label: "Pegar", icon: "copy", shortcut: "Ctrl V", onClick: () => ed.paste() });
    if (has) {
      items.push(
        { label: "Duplicar", icon: "duplicate", shortcut: "Ctrl D", onClick: () => ed.duplicateNodes() },
        { separator: true, label: "" },
        { label: "Agrupar", icon: "group", shortcut: "Ctrl G", onClick: () => ed.group(), disabled: false },
        { label: "Desagrupar", icon: "ungroup", shortcut: "Ctrl ⇧ G", onClick: () => ed.ungroup() },
        { separator: true, label: "" },
        { label: "Traer al frente", icon: "front", shortcut: "]", onClick: () => ed.reorder("forward") },
        { label: "Enviar atrás", icon: "back", shortcut: "[", onClick: () => ed.reorder("backward") },
        { separator: true, label: "" },
        { label: sel.every((n) => n.locked) ? "Desbloquear" : "Bloquear", icon: "lock", onClick: () => ed.toggleLock() },
        { label: "Ocultar", icon: "eye-off", onClick: () => ed.toggleHidden() },
        { separator: true, label: "" },
        { label: "Eliminar", icon: "trash", shortcut: "Supr", danger: true, onClick: () => ed.deleteNodes() },
      );
    }
    menu({ x: e.clientX, y: e.clientY }, items);
  }

  /* ---------- Superposición (selección, guías, asas) ---------- */

  scheduleOverlay(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.drawOverlay(); });
  }

  private box(cls: string): HTMLElement {
    return h("div", { class: cls });
  }

  private drawOverlay(): void {
    const ed = this.ed;
    const s = ed.s;
    const o = this.overlay.getBoundingClientRect();
    const z = s.zoom;
    const parts: HTMLElement[] = [];
    const place = (id: string, cls: string): HTMLElement | null => {
      const r = this.view.clientRect(id);
      const el = this.view.el(id);
      if (!r || !el || (r.width === 0 && r.height === 0)) return null;
      const st = resolveStyle(ed.doc.nodes[id], s.device);
      const w = el.offsetWidth * z, hgt = el.offsetHeight * z;
      const cx = r.left - o.left + r.width / 2, cy = r.top - o.top + r.height / 2;
      const b = this.box(cls);
      b.style.cssText = `left:${cx - w / 2}px;top:${cy - hgt / 2}px;width:${w}px;height:${hgt}px;${st.rotate ? `transform:rotate(${st.rotate}deg)` : ""}`;
      return b;
    };

    if (s.hoverId && !s.selection.includes(s.hoverId) && !this.mode && !this.editEl) {
      const b = place(s.hoverId, "ov-hover");
      if (b) { b.appendChild(h("span", { class: "ov-tag" }, ed.doc.nodes[s.hoverId]?.name ?? "")); parts.push(b); }
    }

    const sel = s.selection.filter((id) => ed.doc.nodes[id] && !ed.doc.nodes[id].hidden);
    sel.forEach((id) => {
      const node = ed.doc.nodes[id];
      const b = place(id, `ov-sel${node.locked ? " is-locked" : ""}${this.editEl ? " is-editing" : ""}`);
      if (!b) return;
      parts.push(b);
      if (sel.length === 1 && !node.locked && !this.editEl) {
        const free = ed.isFreeChild(id);
        const isText = node.type === "text";
        const handles = free ? HANDLES : (["e", "s", "se"] as const);
        for (const hd of handles) {
          if (isText && (hd === "n" || hd === "s")) continue;
          b.appendChild(h("i", { class: `ov-h ov-h--${hd}`, "data-handle": hd, "aria-hidden": "true" }));
        }
        b.appendChild(h("i", { class: "ov-rot", "data-handle": "rot", "aria-hidden": "true" }));
        if (!this.mode) {
          b.appendChild(h("button", { type: "button", class: "ov-move", "data-handle": "move", "aria-label": "Mover elemento", tabindex: "-1" }, ic("move", 14)));
          const el = this.view.el(id);
          b.appendChild(h("span", { class: "ov-tag ov-tag--sel" }, `${node.name} · ${Math.round(el?.offsetWidth ?? 0)} × ${Math.round(el?.offsetHeight ?? 0)}`));
        }
      } else if (sel.length === 1 && node.locked) {
        b.appendChild(h("span", { class: "ov-tag ov-tag--sel" }, [ic("lock", 11), ` ${node.name}`]));
      }
    });

    // caja envolvente de selección múltiple
    if (sel.length > 1) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const id of sel) {
        const r = this.view.clientRect(id);
        if (!r) continue;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      if (isFinite(x0)) {
        const b = this.box("ov-multi");
        b.style.cssText = `left:${x0 - o.left}px;top:${y0 - o.top}px;width:${x1 - x0}px;height:${y1 - y0}px`;
        b.appendChild(h("span", { class: "ov-tag ov-tag--sel" }, `${sel.length} elementos`));
        parts.push(b);
      }
    }

    for (const g of this.guideLines) {
      const l = this.box("ov-guide");
      l.style.cssText = `left:${Math.min(g.x1, g.x2)}px;top:${Math.min(g.y1, g.y2)}px;width:${Math.max(1, Math.abs(g.x2 - g.x1))}px;height:${Math.max(1, Math.abs(g.y2 - g.y1))}px`;
      parts.push(l);
    }
    for (const t of this.labels) {
      const l = h("span", { class: `ov-label ov-label--${t.kind ?? "dist"}` }, t.text);
      l.style.cssText = `left:${t.x}px;top:${t.y}px`;
      parts.push(l);
    }
    if (this.dropTarget) {
      const t = this.dropTarget;
      if (t.box) { const b = this.box("ov-drop"); b.style.cssText = `left:${t.box.left - o.left}px;top:${t.box.top - o.top}px;width:${t.box.width}px;height:${t.box.height}px`; parts.push(b); }
      if (t.line) { const l = this.box("ov-line"); l.style.cssText = `left:${t.line.x}px;top:${t.line.y}px;width:${t.line.w}px;height:${t.line.h}px`; parts.push(l); }
    }
    if (this.ghost) {
      const g = this.box("ov-ghost");
      g.style.cssText = `left:${this.ghost.x}px;top:${this.ghost.y}px;width:${Math.min(this.ghost.w, 420)}px;height:${Math.min(this.ghost.h, 160)}px`;
      g.textContent = this.ghost.text;
      parts.push(g);
    }
    if (this.marqueeRect) {
      const r = this.marqueeRect;
      const b = this.box("ov-marquee");
      b.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
      parts.push(b);
    }
    // indicador del dispositivo / rejilla de la página
    const fr = this.frame.getBoundingClientRect();
    const dev = this.box("ov-frame-label");
    dev.textContent = `${{ desktop: "Escritorio", tablet: "Tableta", mobile: "Móvil" }[s.device]} · ${s.widths[s.device]} px`;
    dev.style.cssText = `left:${fr.left - o.left}px;top:${Math.max(4, fr.top - o.top - 24)}px`;
    parts.push(dev);

    this.overlay.replaceChildren(...parts);
  }
}
