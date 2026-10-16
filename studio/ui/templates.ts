/** Panel de plantillas dentro del editor: reemplazar el diseño (con confirmación) o añadir sus páginas. */
import { TEMPLATES } from "../../shared/templates";
import { thumbnailSvg } from "../../shared/thumb";
import { Editor } from "../core/editor";
import { confirmDialog, h, toast } from "../lib/dom";

const thumbCache = new Map<string, string>();
export function templateThumb(id: string): string {
  let t = thumbCache.get(id);
  if (!t) { t = thumbnailSvg(TEMPLATES.find((x) => x.id === id)!.build()); thumbCache.set(id, t); }
  return t;
}
export function svgEl(markup: string): Element {
  const d = document.createElement("div");
  d.innerHTML = markup;
  return d.firstElementChild as Element;
}

export class TemplatesPanel {
  readonly el: HTMLElement;
  constructor(private ed: Editor) {
    this.el = h("div", { class: "tp" },
      h("p", { class: "pf-hint" }, "Las plantillas son diseños reales y editables. «Reemplazar» cambia todo el diseño actual (puedes deshacerlo con Ctrl Z); «Añadir» suma sus páginas a las tuyas."),
      TEMPLATES.map((t) => h("div", { class: "tp-card" },
        h("div", { class: "tp-thumb" }, svgEl(templateThumb(t.id))),
        h("div", { class: "tp-meta" }, h("strong", null, t.name), h("span", null, t.category), h("small", null, t.description),
          h("div", { class: "tp-actions" },
            h("button", { type: "button", class: "st-btn st-btn--primary st-btn--sm", onclick: () => void this.replace(t.id) }, "Reemplazar"),
            h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => this.append(t.id) }, "Añadir páginas"))))));
  }

  private async replace(id: string): Promise<void> {
    const t = TEMPLATES.find((x) => x.id === id)!;
    if (!(await confirmDialog("Reemplazar el diseño", `Se sustituirá todo el contenido por la plantilla «${t.name}», conservando el nombre y los datos SEO del sitio. Puedes deshacerlo con Ctrl Z.`, "Reemplazar", true))) return;
    const cur = this.ed.doc.settings;
    const doc = t.build();
    doc.settings = { ...doc.settings, siteName: cur.siteName, title: cur.title || cur.siteName, description: cur.description, favicon: cur.favicon, lang: cur.lang, siteUrl: cur.siteUrl };
    this.ed.replaceDoc(doc, `Plantilla ${t.name}`);
    toast(`Plantilla «${t.name}» aplicada`, "ok");
  }

  private append(id: string): void {
    const t = TEMPLATES.find((x) => x.id === id)!;
    this.ed.appendPages(t.build());
    toast(`Se añadieron ${t.build().pages.length} página(s) de «${t.name}»`, "ok");
  }
}
