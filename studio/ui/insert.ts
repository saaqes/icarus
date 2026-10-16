/** Panel «Insertar»: elementos básicos y secciones prediseñadas (clic o arrastrar al lienzo). */
import { ELEMENTS, ElementDef, SECTIONS } from "../../shared/model/presets";
import { thumbnailSvg } from "../../shared/thumb";
import { Spec } from "../../shared/model/build";
import { blankDoc } from "../../shared/templates";
import { materialize } from "../../shared/model/build";
import { Editor } from "../core/editor";
import { Workspace } from "../canvas/workspace";
import { h, ic, toast } from "../lib/dom";

export class InsertPanel {
  readonly el: HTMLElement;
  private query = "";
  private content: HTMLElement;

  constructor(private ed: Editor, private ws: () => Workspace | null) {
    const search = h("input", { class: "st-input st-input--sm", type: "search", placeholder: "Buscar elementos…", "aria-label": "Buscar elementos" });
    search.addEventListener("input", () => { this.query = search.value.toLowerCase(); this.render(); });
    this.content = h("div", { class: "in-content" });
    this.el = h("div", { class: "in" }, h("div", { class: "in-search" }, ic("search", 14), search), this.content);
    this.render();
  }

  private render(): void {
    const q = this.query;
    const groups = new Map<string, ElementDef[]>();
    for (const e of ELEMENTS) {
      if (q && !e.label.toLowerCase().includes(q) && !e.group.toLowerCase().includes(q)) continue;
      groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
    }
    const parts: HTMLElement[] = [];
    for (const [g, list] of groups) {
      parts.push(h("h3", { class: "in-title" }, g), h("div", { class: "in-grid" }, list.map((d) => this.tile(d))));
    }
    const secs = SECTIONS.filter((s) => !q || s.label.toLowerCase().includes(q) || "sección secciones prediseñadas".includes(q));
    if (secs.length) {
      parts.push(h("h3", { class: "in-title" }, "Secciones prediseñadas"), h("div", { class: "in-secs" }, secs.map((s) => {
        const spec = s.build();
        return this.sectionCard(s.label, s.description, spec, s.icon);
      })));
    }
    if (!parts.length) parts.push(h("p", { class: "st-empty" }, "No hay elementos que coincidan con tu búsqueda."));
    this.content.replaceChildren(...parts);
  }

  private tile(d: ElementDef): HTMLElement {
    const b = h("button", { type: "button", class: "in-tile", title: `Insertar ${d.label}`, "aria-label": `Insertar ${d.label}` }, ic(d.icon, 20), h("span", null, d.label));
    this.attachDrag(b, d.label, () => d.build(), d.size);
    return b;
  }

  private sectionCard(label: string, desc: string, spec: Spec, icon: string): HTMLElement {
    // miniatura esquemática de la sección
    let thumb: string = "";
    try {
      const doc = blankDoc("x");
      const nodes = materialize(spec);
      const root = doc.pages[0].rootId;
      const rootNode = doc.nodes[root];
      for (const id of [...rootNode.children]) delete doc.nodes[id];
      rootNode.children = [nodes[0].id];
      for (const n of nodes) doc.nodes[n.id] = n;
      nodes[0].parent = root;
      thumb = thumbnailSvg({ ...doc, theme: this.ed.doc.theme });
    } catch { thumb = ""; }
    const b = h("button", { type: "button", class: "in-sec", "aria-label": `Insertar sección ${label}` },
      h("div", { class: "in-sec__thumb" }, thumb ? (() => { const d = document.createElement("div"); d.innerHTML = thumb; return d.firstElementChild as Element; })() : ic(icon, 22)),
      h("div", { class: "in-sec__meta" }, h("strong", null, label), h("span", null, desc)));
    this.attachDrag(b, label, () => spec, { w: 800, h: 300 }, true);
    return b;
  }

  /** Clic = insertar; arrastre con ratón = soltar sobre el lienzo. */
  private attachDrag(btn: HTMLElement, label: string, build: () => Spec, size: { w: number; h: number }, isSection = false): void {
    btn.addEventListener("click", (e) => {
      if ((btn as any).__dragged) { (btn as any).__dragged = false; return; }
      void e;
      const spec = isSection ? this.freshSection(build) : build();
      this.ed.insert(spec, { size });
      const id = this.ed.s.selection[0];
      if (id) this.ws()?.reveal(id);
      if (window.matchMedia("(max-width: 900px)").matches) this.ed.store.set({ sheet: null });
      toast(`${label} insertado`, "ok", 1100);
    });
    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY;
      let ghost: HTMLElement | null = null;
      let spec: Spec | null = null;
      const move = (ev: PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          (btn as any).__dragged = true;
          ghost = h("div", { class: "in-ghost" }, label);
          document.body.appendChild(ghost);
          spec = isSection ? this.freshSection(build) : build();
        }
        ghost.style.cssText = `left:${ev.clientX + 10}px;top:${ev.clientY + 10}px`;
        this.ws()?.previewDrop(spec!, ev.clientX, ev.clientY, size);
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        ghost?.remove();
        this.ws()?.endPreviewDrop();
        if (ghost && spec) {
          const ok = this.ws()?.insertAt(spec, size, ev.clientX, ev.clientY);
          if (!ok) toast("Suelta el elemento sobre la página.", "info", 1500);
        }
        setTimeout(() => { (btn as any).__dragged = false; }, 0);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  /** Cada inserción necesita ids nuevos; las especificaciones no los llevan, así que se pueden reutilizar. */
  private freshSection(build: () => Spec): Spec { return build(); }
}
