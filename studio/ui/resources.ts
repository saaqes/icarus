/** Panel «Recursos»: imágenes, iconos, tipografías y colores globales del proyecto. */
import { FONT_PAIRS, FONTS, googleFontsPreviewUrl } from "../../shared/model/fonts";
import { ICON_NAMES } from "../../shared/model/icons";
import { PALETTES, COLOR_NAMES } from "../../shared/model/presets";
import { N } from "../../shared/model/build";
import { LIBRARY, libSrc, SITE_IMAGES } from "../../shared/library";
import { Editor } from "../core/editor";
import { Api, Asset } from "../lib/api";
import { assetUrl } from "../lib/assetres";
import { cssColor } from "../../shared/model/style";
import { h, ic, promptDialog, toast } from "../lib/dom";
import { uploadFile } from "./assets";
import { openColorPicker } from "./colorpicker";

type Sub = "images" | "icons" | "fonts" | "colors";

export class ResourcesPanel {
  readonly el: HTMLElement;
  private sub: Sub = "images";
  private body: HTMLElement;
  private mine: Asset[] | null = null;
  private fontsLoaded = false;
  private raf = 0;

  constructor(private ed: Editor) {
    this.body = h("div", { class: "rs-body" });
    const tabs = h("div", { class: "st-tabs st-tabs--sm", role: "tablist" },
      ([["images", "Imágenes"], ["icons", "Iconos"], ["fonts", "Fuentes"], ["colors", "Colores"]] as const).map(([k, l]) =>
        h("button", { type: "button", role: "tab", class: `st-tab${k === this.sub ? " is-on" : ""}`, dataset: { k }, onclick: (e: Event) => { this.sub = k; tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b === e.currentTarget)); this.render(); } }, l)));
    this.el = h("div", { class: "rs" }, tabs, this.body);
    ed.store.subscribe((s, p) => { if ((this.sub === "colors" || this.sub === "fonts") && (s.doc.theme !== p.doc.theme || s.doc.savedColors !== p.doc.savedColors)) this.schedule(); });
    this.render();
  }

  private schedule(): void { if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); }); }

  render(): void {
    this.body.replaceChildren();
    if (this.sub === "images") this.images();
    else if (this.sub === "icons") this.icons();
    else if (this.sub === "fonts") this.fonts();
    else this.colors();
  }

  /* ----- Imágenes ----- */
  private useImage(src: string, alt: string): void {
    const ed = this.ed;
    const sel = ed.selected;
    if (sel.length === 1 && sel[0].type === "image") { ed.setProps([sel[0].id], { src, alt: sel[0].props.alt || alt }, { label: "Cambiar imagen" }); toast("Imagen reemplazada", "ok", 1200); return; }
    if (sel.length === 1 && ["section", "container"].includes(sel[0].type) && false) return;
    ed.insert(N.image(src, alt, { s: { w: "fill", h: "auto" }, props: { ratio: 1.5 } }), { size: { w: 420, h: 280 } });
  }

  private images(): void {
    const grid = (items: { src: string; name: string }[]) => h("div", { class: "rs-grid" }, items.map((i) =>
      h("button", { type: "button", class: "rs-img", title: `Usar «${i.name}»`, "aria-label": `Usar ${i.name}`, onclick: () => this.useImage(i.src, i.name) }, h("img", { src: assetUrl(i.src), alt: "", loading: "lazy", decoding: "async" }), h("span", null, i.name))));
    const file = h("input", { type: "file", hidden: true, accept: "image/png,image/jpeg,image/webp,image/gif,image/avif" });
    file.addEventListener("change", async () => {
      const f = file.files?.[0]; file.value = "";
      if (!f) return;
      const a = await uploadFile(f, "image");
      if (a) { this.mine = null; this.render(); this.useImage(a.url, a.name.replace(/\.[^.]+$/, "")); }
    });
    this.body.append(
      h("div", { class: "rs-bar" }, h("button", { type: "button", class: "st-btn st-btn--primary st-btn--sm", onclick: () => file.click() }, ic("upload", 14), "Subir imagen"), file),
      h("h3", { class: "in-title" }, "Mis imágenes"));
    const mineBox = h("div", null);
    this.body.append(mineBox);
    if (this.mine) mineBox.append(this.mine.length ? grid(this.mine.filter((a) => a.kind === "image").map((a) => ({ src: a.url, name: a.name }))) : h("p", { class: "st-empty" }, "Aún no has subido imágenes."));
    else {
      mineBox.append(h("p", { class: "st-empty" }, "Cargando…"));
      Api.assets().then(({ assets }) => { this.mine = assets; if (this.sub === "images") this.render(); }).catch(() => { mineBox.replaceChildren(h("p", { class: "st-empty" }, "No se pudieron cargar tus imágenes.")); });
    }
    const cats = [...new Set(LIBRARY.map((l) => l.category))];
    for (const c of cats) this.body.append(h("h3", { class: "in-title" }, c[0].toUpperCase() + c.slice(1)), grid(LIBRARY.filter((l) => l.category === c).map((l) => ({ src: libSrc(l.id), name: l.name }))));
    this.body.append(h("h3", { class: "in-title" }, "Demos de ICARUS"), grid(SITE_IMAGES.map((s) => ({ src: s.src, name: s.name }))));
  }

  /* ----- Iconos ----- */
  private icons(): void {
    const search = h("input", { class: "st-input st-input--sm", type: "search", placeholder: "Buscar icono…", "aria-label": "Buscar icono" });
    const grid = h("div", { class: "rs-icons" });
    const render = () => grid.replaceChildren(...[...ICON_NAMES, "whatsapp"].filter((n) => n.includes(search.value.toLowerCase())).map((n) =>
      h("button", { type: "button", class: "rs-icon", title: n, "aria-label": `Usar icono ${n}`, onclick: () => {
        const sel = this.ed.selected;
        if (sel.length === 1 && sel[0].type === "icon") this.ed.setProps([sel[0].id], { name: n }, { label: "Cambiar icono" });
        else this.ed.insert(N.icon(n, { size: 36 }), { size: { w: 40, h: 40 } });
      } }, ic(n, 22))));
    search.addEventListener("input", render);
    render();
    this.body.append(h("p", { class: "pf-hint" }, "Clic: inserta el icono, o cambia el del icono seleccionado."), search, grid);
  }

  /* ----- Fuentes ----- */
  private fonts(): void {
    if (!this.fontsLoaded) {
      this.fontsLoaded = true;
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = googleFontsPreviewUrl(FONTS.map((f) => f.family));
      document.head.appendChild(l);
    }
    const t = this.ed.doc.theme;
    const pick = (label: string, role: "heading" | "body") => {
      const sel = h("select", { class: "st-select st-select--sm", "aria-label": label }, FONTS.map((f) => h("option", { value: f.family }, f.family)));
      sel.value = t.fonts[role];
      sel.addEventListener("change", () => this.ed.setThemeFont(role, sel.value));
      return h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, label), sel);
    };
    this.body.append(
      h("h3", { class: "in-title" }, "Tipografías globales"),
      pick("Títulos", "heading"), pick("Texto", "body"),
      h("p", { class: "pf-hint" }, "Los elementos con «Títulos» o «Texto» como tipografía se actualizan al instante."),
      h("h3", { class: "in-title" }, "Combinaciones recomendadas"),
      h("div", { class: "rs-pairs" }, FONT_PAIRS.map((p) =>
        h("button", { type: "button", class: "rs-pair", onclick: () => this.ed.applyFontPair(p.heading, p.body) },
          h("strong", { style: { fontFamily: `"${p.heading}", serif` } }, p.heading), h("span", { style: { fontFamily: `"${p.body}", sans-serif` } }, `${p.body} · ${p.label}`)))),
      h("h3", { class: "in-title" }, "Aplicar a la selección"),
      h("div", { class: "rs-fontlist" }, FONTS.map((f) =>
        h("button", { type: "button", class: "rs-font", style: { fontFamily: `"${f.family}", sans-serif` }, onclick: () => {
          const ids = this.ed.s.selection.filter((id) => ["text", "button", "field", "section", "container", "form"].includes(this.ed.doc.nodes[id]?.type ?? ""));
          if (!ids.length) { toast("Selecciona un texto o contenedor para aplicarle la fuente.", "info"); return; }
          this.ed.setStyle(ids, { font: f.family }, { label: "Tipografía" });
        } }, f.family))));
  }

  /* ----- Colores ----- */
  private colors(): void {
    const ed = this.ed;
    const t = ed.doc.theme;
    const rows = Object.entries(t.colors).map(([k, v]) => {
      const sw = h("button", { type: "button", class: "pf-swatch", "aria-label": `Editar color ${COLOR_NAMES[k] ?? k}`, onclick: () => openColorPicker(sw, { value: v, theme: t, saved: ed.doc.savedColors, onChange: (c, final) => { if (c && !c.startsWith("$")) ed.setThemeColor(k, c); void final; }, onSave: (c) => ed.saveColor(c) }) }, h("i", { style: { background: cssColor(v) } }));
      return h("div", { class: "rs-color" }, sw, h("div", null, h("strong", null, COLOR_NAMES[k] ?? k), h("small", null, `${v} · $${k}`)),
        ["primary", "bg", "text"].includes(k) ? null : h("button", { type: "button", class: "st-icon-btn", "aria-label": `Eliminar color ${k}`, onclick: () => ed.removeThemeColor(k) }, ic("x", 13)));
    });
    this.body.append(
      h("h3", { class: "in-title" }, "Paletas completas"),
      h("div", { class: "rs-palettes" }, PALETTES.map((p) =>
        h("button", { type: "button", class: "rs-palette", title: `Aplicar paleta ${p.label}`, onclick: () => { ed.applyPalette(p.colors); toast(`Paleta «${p.label}» aplicada`, "ok", 1400); } },
          h("span", { class: "rs-palette__sw" }, [p.colors.bg, p.colors.surface, p.colors.primary, p.colors.secondary, p.colors.text].map((c) => h("i", { style: { background: c } }))), h("span", null, p.label)))),
      h("h3", { class: "in-title" }, "Colores globales"),
      h("p", { class: "pf-hint" }, "Al cambiar un color global se actualizan todos los elementos enlazados a él (en el selector de color aparecen con un icono de enlace)."),
      h("div", { class: "rs-colors" }, rows),
      h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: async () => {
        const name = await promptDialog("Nuevo color global", "Nombre (sin espacios)", "", "Añadir");
        if (name) ed.addThemeColor(name, "#7c5cff");
      } }, ic("plus", 14), "Añadir color global"),
      h("h3", { class: "in-title" }, "Colores guardados"),
      h("div", { class: "rs-saved" }, ed.doc.savedColors.length ? ed.doc.savedColors.map((c) => h("button", { type: "button", class: "cp-sw", style: { "--c": c }, title: `${c} (clic para quitar)`, "aria-label": `Quitar color guardado ${c}`, onclick: () => ed.removeSavedColor(c) })) : h("span", { class: "pf-hint" }, "Guarda colores desde el selector de color.")));
  }
}
