/** Panel de capas: árbol del diseño sincronizado con el lienzo (seleccionar, renombrar, mover, ocultar, bloquear…). */
import { isContainer } from "../../shared/model/doc";
import { Node } from "../../shared/model/types";
import { Editor } from "../core/editor";
import { h, ic, menu } from "../lib/dom";

const TYPE_ICON: Record<string, string> = {
  root: "file", section: "rows", container: "box", text: "type", button: "button", image: "image", video: "play", icon: "star", divider: "minus", shape: "square", form: "mail", field: "input",
};

export class LayersPanel {
  readonly el: HTMLElement;
  private list: HTMLElement;
  private raf = 0;
  private drag: { ids: string[]; x: number; y: number; started: boolean; ghost?: HTMLElement; target?: { id: string; where: "before" | "after" | "inside" } } | null = null;

  constructor(private ed: Editor, private onReveal: (id: string) => void) {
    this.list = h("div", { class: "ly-list", role: "tree", "aria-label": "Capas de la página" });
    this.el = h("div", { class: "ly" }, this.list);
    ed.store.subscribe((s, p) => { if (s.doc !== p.doc || s.selection !== p.selection || s.pageId !== p.pageId || s.collapsed !== p.collapsed) this.schedule(); });
    this.render();
  }

  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  render(): void {
    const ed = this.ed;
    const rows: HTMLElement[] = [];
    const sel = new Set(ed.s.selection);
    const walk = (id: string, depth: number) => {
      const n = ed.doc.nodes[id];
      if (!n) return;
      const hasKids = n.children.length > 0;
      const collapsed = !!ed.s.collapsed[id];
      rows.push(this.row(n, depth, sel.has(id), hasKids, collapsed));
      if (hasKids && !collapsed) for (const c of n.children) walk(c, depth + 1);
    };
    walk(ed.rootId, 0);
    this.list.replaceChildren(...rows);
  }

  private row(n: Node, depth: number, selected: boolean, hasKids: boolean, collapsed: boolean): HTMLElement {
    const ed = this.ed;
    const isRoot = n.type === "root";
    const caret = hasKids
      ? h("button", { type: "button", class: "ly-caret", "aria-label": collapsed ? "Expandir" : "Contraer", tabindex: "-1", onclick: (e: Event) => { e.stopPropagation(); ed.toggleCollapsed(n.id); } }, ic(collapsed ? "chevron-right" : "chevron-down", 12))
      : h("span", { class: "ly-caret ly-caret--none" });
    const name = h("span", { class: "ly-name", title: "Doble clic para renombrar" }, n.name);
    const isGroup = n.type === "container" && n.props.group;
    const actions = h("span", { class: "ly-actions" },
      isRoot ? null : [
        h("button", { type: "button", class: "ly-btn", "aria-label": n.hidden ? "Mostrar" : "Ocultar", "data-tip": n.hidden ? "Mostrar" : "Ocultar", onclick: (e: Event) => { e.stopPropagation(); ed.toggleHidden([n.id]); } }, ic(n.hidden ? "eye-off" : "eye", 13)),
        h("button", { type: "button", class: "ly-btn", "aria-label": n.locked ? "Desbloquear" : "Bloquear", "data-tip": n.locked ? "Desbloquear" : "Bloquear", onclick: (e: Event) => { e.stopPropagation(); ed.toggleLock([n.id]); } }, ic(n.locked ? "lock" : "unlock", 13)),
        h("button", { type: "button", class: "ly-btn ly-btn--more", "aria-label": "Más acciones", onclick: (e: Event) => { e.stopPropagation(); this.moreMenu(e.currentTarget as HTMLElement, n); } }, ic("dots", 13)),
      ]);
    const el = h("div", {
      class: `ly-row${selected ? " is-sel" : ""}${n.hidden ? " is-off" : ""}${n.locked ? " is-locked" : ""}`, role: "treeitem", "aria-selected": String(selected), "aria-level": String(depth + 1),
      "aria-expanded": hasKids ? String(!collapsed) : undefined, dataset: { id: n.id }, tabindex: selected ? "0" : "-1", style: { paddingLeft: `${6 + depth * 14}px` },
    }, caret, h("span", { class: "ly-ic" }, ic(isGroup ? "group" : TYPE_ICON[n.type] ?? "square", 14)), name, actions);
    el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey) ed.toggleSelect(n.id); else ed.select([n.id]);
      this.onReveal(n.id);
    });
    el.addEventListener("dblclick", (e) => { if (!isRoot && !(e.target as HTMLElement).closest("button")) this.rename(name, n); });
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!ed.s.selection.includes(n.id)) ed.select([n.id]); if (!isRoot) this.moreMenu({ x: e.clientX, y: e.clientY } as any, n); });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ed.select([n.id]); this.onReveal(n.id); }
      if (e.key === "F2" && !isRoot) this.rename(name, n);
      if (e.key === "ArrowDown") { e.preventDefault(); (el.nextElementSibling as HTMLElement | null)?.focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (el.previousElementSibling as HTMLElement | null)?.focus(); }
      if (e.key === "ArrowRight" && hasKids && collapsed) ed.toggleCollapsed(n.id);
      if (e.key === "ArrowLeft" && hasKids && !collapsed) ed.toggleCollapsed(n.id);
    });
    if (!isRoot) el.addEventListener("pointerdown", (e) => this.startDrag(e, n));
    return el;
  }

  private moreMenu(anchor: HTMLElement | { x: number; y: number }, n: Node): void {
    const ed = this.ed;
    if (!ed.s.selection.includes(n.id)) ed.select([n.id]);
    menu(anchor, [
      { label: "Renombrar", icon: "edit", shortcut: "F2", onClick: () => { const nm = this.list.querySelector(`[data-id="${n.id}"] .ly-name`) as HTMLElement | null; if (nm) this.rename(nm, n); } },
      { label: "Duplicar", icon: "duplicate", shortcut: "Ctrl D", onClick: () => ed.duplicateNodes([n.id]) },
      { label: "Agrupar", icon: "group", shortcut: "Ctrl G", onClick: () => ed.group() },
      { label: "Desagrupar", icon: "ungroup", onClick: () => ed.ungroup([n.id]) },
      { separator: true, label: "" },
      { label: "Subir capa", icon: "chevron-up", onClick: () => ed.reorder("forward", [n.id]) },
      { label: "Bajar capa", icon: "chevron-down", onClick: () => ed.reorder("backward", [n.id]) },
      { separator: true, label: "" },
      { label: "Eliminar", icon: "trash", danger: true, shortcut: "Supr", onClick: () => ed.deleteNodes([n.id]) },
    ]);
  }

  private rename(label: HTMLElement, n: Node): void {
    const input = h("input", { class: "ly-rename", type: "text", value: n.name, "aria-label": "Nombre de la capa", maxlength: "120" });
    label.replaceWith(input);
    input.focus(); input.select();
    let done = false;
    const finish = (ok: boolean) => { if (done) return; done = true; if (ok) this.ed.rename(n.id, input.value); this.render(); };
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") finish(true); if (e.key === "Escape") finish(false); });
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("dblclick", (e) => e.stopPropagation());
  }

  /* ---------- Arrastrar para reorganizar ---------- */

  private startDrag(e: PointerEvent, n: Node): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button,input")) return;
    const ed = this.ed;
    const ids = ed.s.selection.includes(n.id) ? ed.topLevel(ed.s.selection) : [n.id];
    this.drag = { ids, x: e.clientX, y: e.clientY, started: false };
    const touch = e.pointerType === "touch";
    let timer: number | undefined;
    const row = e.currentTarget as HTMLElement;
    const begin = () => {
      const d = this.drag;
      if (!d || d.started) return;
      d.started = true;
      d.ghost = h("div", { class: "ly-ghost" }, d.ids.length > 1 ? `${d.ids.length} elementos` : n.name);
      document.body.appendChild(d.ghost);
      row.classList.add("is-dragging");
    };
    if (touch) timer = window.setTimeout(begin, 350);
    const move = (ev: PointerEvent) => {
      const d = this.drag;
      if (!d) return;
      if (!d.started) {
        if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > (touch ? 10 : 5)) { if (touch) { if (timer) clearTimeout(timer); end(false); return; } begin(); }
        else return;
      }
      ev.preventDefault();
      d.ghost!.style.cssText = `left:${ev.clientX + 12}px;top:${ev.clientY + 8}px`;
      this.clearMarks();
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>(".ly-row");
      if (!under || under === row) { d.target = undefined; return; }
      const tid = under.dataset.id!;
      const tn = ed.doc.nodes[tid];
      const r = under.getBoundingClientRect();
      const fy = (ev.clientY - r.top) / r.height;
      let where: "before" | "after" | "inside" = fy < 0.28 ? "before" : fy > 0.72 ? "after" : "inside";
      if (where === "inside" && !(isContainer(tn))) where = fy < 0.5 ? "before" : "after";
      if (tn.type === "root") where = "inside";
      const parentId = where === "inside" ? tid : tn.parent!;
      if (!ed.canDropInto(d.ids, parentId)) { d.target = undefined; under.classList.add("is-bad"); return; }
      d.target = { id: tid, where };
      under.classList.add(`is-drop-${where}`);
    };
    const end = (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (timer) clearTimeout(timer);
      const d = this.drag;
      this.drag = null;
      row.classList.remove("is-dragging");
      this.clearMarks();
      d?.ghost?.remove();
      if (commit && d?.started && d.target) {
        const tn = ed.doc.nodes[d.target.id];
        if (d.target.where === "inside") ed.moveNodes(d.ids, tn.id, undefined, { label: "Mover capa" });
        else {
          const parent = ed.doc.nodes[tn.parent!];
          ed.moveNodes(d.ids, parent.id, parent.children.indexOf(tn.id) + (d.target.where === "after" ? 1 : 0), { label: "Reordenar capas" });
        }
      }
    };
    const up = () => end(true);
    const cancel = () => end(false);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  private clearMarks(): void {
    this.list.querySelectorAll(".is-drop-before,.is-drop-after,.is-drop-inside,.is-bad").forEach((e) => e.classList.remove("is-drop-before", "is-drop-after", "is-drop-inside", "is-bad"));
  }
}
