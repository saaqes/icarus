/** Panel de páginas: crear, renombrar, duplicar, eliminar (con confirmación), reordenar y fijar la principal. */
import { Editor } from "../core/editor";
import { confirmDialog, h, ic, menu, promptDialog, toast } from "../lib/dom";

export class PagesPanel {
  readonly el: HTMLElement;
  private raf = 0;
  private dragId: string | null = null;

  constructor(private ed: Editor) {
    this.el = h("div", { class: "pg" });
    ed.store.subscribe((s, p) => { if (s.doc.pages !== p.doc.pages || s.pageId !== p.pageId || s.doc.settings.homePageId !== p.doc.settings.homePageId) this.schedule(); });
    this.render();
  }

  private schedule(): void { if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); }); }

  private render(): void {
    const ed = this.ed;
    const home = ed.doc.settings.homePageId;
    const list = h("ul", { class: "pg-list", role: "listbox", "aria-label": "Páginas del sitio" }, ed.doc.pages.map((p, i) => {
      const active = p.id === ed.s.pageId;
      const li = h("li", { class: `pg-item${active ? " is-on" : ""}`, role: "option", "aria-selected": String(active), draggable: "true", dataset: { id: p.id } },
        h("button", { type: "button", class: "pg-main", onclick: () => ed.switchPage(p.id), ondblclick: () => void this.rename(p.id) },
          ic(p.id === home ? "home" : "file", 15), h("span", { class: "pg-name" }, p.name), h("small", null, p.id === home ? "Principal · /" : `/${p.slug}`)),
        h("button", { type: "button", class: "st-icon-btn", "aria-label": `Más acciones de ${p.name}`, onclick: (e: Event) => this.more(e.currentTarget as HTMLElement, p.id, i) }, ic("dots", 15)));
      li.addEventListener("dragstart", (e) => { this.dragId = p.id; e.dataTransfer?.setData("text/plain", p.id); li.classList.add("is-drag"); });
      li.addEventListener("dragend", () => { this.dragId = null; li.classList.remove("is-drag"); });
      li.addEventListener("dragover", (e) => { if (this.dragId && this.dragId !== p.id) { e.preventDefault(); li.classList.add("is-over"); } });
      li.addEventListener("dragleave", () => li.classList.remove("is-over"));
      li.addEventListener("drop", (e) => { e.preventDefault(); li.classList.remove("is-over"); if (this.dragId) ed.reorderPage(this.dragId, i); });
      return li;
    }));
    const add = h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm st-btn--block", onclick: async () => {
      const name = await promptDialog("Nueva página", "Nombre de la página", `Página ${ed.doc.pages.length + 1}`, "Crear");
      if (name) { ed.addPage(name); toast("Página creada", "ok", 1200); }
    } }, ic("plus", 14), "Nueva página");
    this.el.replaceChildren(list, add, this.seo());
  }

  private seo(): HTMLElement {
    const ed = this.ed;
    const p = ed.page;
    const slug = h("input", { class: "st-input st-input--sm", type: "text", value: p.slug, "aria-label": "Dirección de la página", maxlength: "40", disabled: p.id === ed.doc.settings.homePageId });
    slug.addEventListener("change", () => ed.setPageSlug(p.id, slug.value));
    const title = h("input", { class: "st-input st-input--sm", type: "text", value: p.seo?.title ?? "", maxlength: "120", "aria-label": "Título SEO de la página", placeholder: "Título para buscadores" });
    title.addEventListener("input", () => ed.setPageSeo(p.id, { title: title.value }));
    const desc = h("textarea", { class: "st-input st-textarea", rows: "3", maxlength: "300", "aria-label": "Descripción SEO de la página", placeholder: "Descripción breve (máx. 160 recomendado)" });
    desc.value = p.seo?.description ?? "";
    desc.addEventListener("input", () => ed.setPageSeo(p.id, { description: desc.value }));
    return h("div", { class: "pg-seo" },
      h("h3", { class: "in-title" }, `Ajustes de «${p.name}»`),
      h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Dirección (archivo .html)"), slug),
      h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Título SEO"), title),
      h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Descripción SEO"), desc));
  }

  private async rename(id: string): Promise<void> {
    const p = this.ed.doc.pages.find((x) => x.id === id);
    if (!p) return;
    const name = await promptDialog("Renombrar página", "Nombre de la página", p.name, "Guardar");
    if (name) this.ed.renamePage(id, name);
  }

  private more(anchor: HTMLElement, id: string, i: number): void {
    const ed = this.ed;
    const p = ed.doc.pages.find((x) => x.id === id)!;
    menu(anchor, [
      { label: "Renombrar", icon: "edit", onClick: () => void this.rename(id) },
      { label: "Duplicar", icon: "duplicate", onClick: () => ed.duplicatePageById(id) },
      { label: "Establecer como principal", icon: "home", disabled: ed.doc.settings.homePageId === id, onClick: () => ed.setHomePage(id) },
      { separator: true, label: "" },
      { label: "Subir", icon: "chevron-up", disabled: i === 0, onClick: () => ed.movePage(id, -1) },
      { label: "Bajar", icon: "chevron-down", disabled: i === ed.doc.pages.length - 1, onClick: () => ed.movePage(id, 1) },
      { separator: true, label: "" },
      { label: "Eliminar", icon: "trash", danger: true, disabled: ed.doc.pages.length <= 1, onClick: async () => {
        if (await confirmDialog("Eliminar página", `¿Eliminar «${p.name}» y todo su contenido? Los enlaces que apuntaban a ella se vaciarán. Podrás deshacerlo con Ctrl Z.`, "Eliminar", true)) ed.deletePage(id);
      } },
    ]);
  }
}
