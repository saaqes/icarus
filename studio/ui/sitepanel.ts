/** Panel derecho sin selección: ajustes de la página, del sitio (SEO, responsive) y revisión de accesibilidad. */
import { checkAccessibility } from "../../shared/export/a11y";
import { Editor } from "../core/editor";
import { debounce, h, ic } from "../lib/dom";
import { pickAsset } from "./assets";
import { Ctl, fillField, PanelCtx, section, styleColor, numStyle, row, selectField, toggleField } from "./controls";

export function buildSitePanel(ed: Editor, host: HTMLElement): void {
  const root = () => ed.rootId;
  const ctx: PanelCtx = { ed, nodes: () => [ed.doc.nodes[root()]].filter(Boolean), ids: () => [root()], device: () => ed.device };
  const s = () => ed.doc.settings;

  const text = (label: string, get: () => string, set: (v: string) => void, o: { multiline?: boolean; max?: number; placeholder?: string; counter?: number } = {}): Ctl => {
    const input = o.multiline
      ? h("textarea", { class: "st-input st-textarea", rows: "3", maxlength: String(o.max ?? 300), "aria-label": label, placeholder: o.placeholder ?? "" })
      : h("input", { class: "st-input st-input--sm", type: "text", maxlength: String(o.max ?? 120), "aria-label": label, placeholder: o.placeholder ?? "" });
    const counter = o.counter ? h("small", { class: "pf-counter" }) : null;
    input.addEventListener("input", () => { set((input as HTMLInputElement).value); if (counter) counter.textContent = `${(input as HTMLInputElement).value.length}/${o.counter}`; });
    const r = row(ctx, label, h("div", { class: "pf-colwrap" }, input, counter), { wide: !!o.multiline });
    return { el: r.el, refresh() { if (document.activeElement !== input) (input as HTMLInputElement).value = get(); if (counter) counter.textContent = `${get().length}/${o.counter}`; } };
  };

  /* ----- Página ----- */
  const pageCtls: Ctl[] = [
    text("Nombre de la página", () => ed.page.name, (v) => v.trim() && ed.renamePage(ed.page.id, v), { max: 80 }),
    ...fillField(ctx),
    styleColor(ctx, "Color del texto", "color"),
  ];
  const pageSec = section("sp-page", "Página", pageCtls);

  /* ----- Sitio ----- */
  const fav = h("button", { type: "button", class: "pf-imgprev pf-imgprev--sm", "aria-label": "Elegir favicon", onclick: async () => { const src = await pickAsset("image", "Favicon del sitio"); if (src) ed.setSettings({ favicon: src }); } });
  const favRow = row(ctx, "Favicon", h("div", { class: "pf-imgsrc" }, fav, h("button", { type: "button", class: "st-link", onclick: () => ed.setSettings({ favicon: "" }) }, "Quitar")));
  const favCtl: Ctl = { el: favRow.el, refresh() { const f = s().favicon; fav.classList.toggle("is-empty", !f); fav.style.backgroundImage = f ? `url("${f.replace(/"/g, "")}")` : ""; fav.replaceChildren(f ? "" : ic("image", 16)); } };
  const bpNum = (label: string, k: "tablet" | "mobile", min: number, max: number): Ctl => {
    const input = h("input", { class: "st-input st-input--sm pf-num", type: "number", min: String(min), max: String(max), "aria-label": label });
    const r = row(ctx, label, h("div", { class: "pf-numwrap" }, input, h("span", { class: "pf-unit" }, "px")));
    input.addEventListener("change", () => {
      const v = Math.max(min, Math.min(max, Math.round(Number(input.value) || min)));
      const bp = { ...s().breakpoints, [k]: v };
      if (bp.mobile >= bp.tablet) { if (k === "tablet") bp.mobile = Math.max(320, v - 200); else bp.tablet = v + 200; }
      ed.setSettings({ breakpoints: bp });
    });
    return { el: r.el, refresh() { if (document.activeElement !== input) input.value = String(s().breakpoints[k]); } };
  };
  const siteCtls: Ctl[] = [
    text("Nombre del sitio", () => s().siteName, (v) => ed.setSettings({ siteName: v }), { max: 80 }),
    selectField(ctx, { label: "Idioma", options: [["es", "Español"], ["en", "English"], ["pt", "Português"], ["fr", "Français"], ["it", "Italiano"], ["de", "Deutsch"]].map(([value, label]) => ({ value, label })), get: () => s().lang, set: (v) => ed.setSettings({ lang: v }) }),
    text("Título SEO", () => s().title, (v) => ed.setSettings({ title: v }), { max: 120, counter: 60 }),
    text("Descripción SEO", () => s().description, (v) => ed.setSettings({ description: v }), { multiline: true, max: 300, counter: 160 }),
    favCtl,
    text("URL prevista del sitio", () => s().siteUrl, (v) => ed.setSettings({ siteUrl: v.trim() }), { placeholder: "https://tusitio.com (opcional; genera sitemap)", max: 200 }),
    toggleField(ctx, { label: "Animaciones", hint: "Desactiva todas las animaciones del sitio exportado.", get: () => s().animations, set: (v) => ed.setSettings({ animations: v }) }),
    bpNum("Punto de quiebre: tableta", "tablet", 600, 1600),
    bpNum("Punto de quiebre: móvil", "mobile", 320, 900),
    { el: h("p", { class: "pf-hint" }, "Los puntos de quiebre indican hasta qué ancho se aplican los ajustes de Tableta y Móvil en el sitio exportado."), refresh() {} },
  ];
  const siteSec = section("sp-site", "Sitio y SEO", siteCtls, { open: false });
  void numStyle;

  /* ----- Revisión ----- */
  const list = h("div", { class: "rv-list" });
  const summary = h("div", { class: "rv-sum" });
  const refreshReview = () => {
    const issues = checkAccessibility(ed.doc);
    const errs = issues.filter((i) => i.level === "error").length;
    summary.replaceChildren(
      h("strong", null, issues.length ? `${issues.length} aviso${issues.length === 1 ? "" : "s"}` : "Todo en orden"),
      h("span", null, issues.length ? ` · ${errs} error${errs === 1 ? "" : "es"}` : " · No se encontraron problemas básicos de accesibilidad."));
    list.replaceChildren(...issues.slice(0, 60).map((i) =>
      h("button", { type: "button", class: `rv-item rv-item--${i.level}`, onclick: () => { if (i.pageId) ed.switchPage(i.pageId); if (i.nodeId) { ed.select([i.nodeId]); ed.store.set({ sheet: ed.s.sheet }); } } },
        ic(i.level === "error" ? "alert" : "info", 14), h("span", null, i.message))));
  };
  const deb = debounce(refreshReview, 500);
  const unsub = ed.store.subscribe((st, p) => { if (!host.isConnected) { unsub(); return; } if (st.doc !== p.doc) deb(); });
  const reviewSec = { el: h("section", { class: "pf-sec" }, h("button", { type: "button", class: "pf-sechead", "aria-expanded": "true", onclick: (e: Event) => { const sec = (e.currentTarget as HTMLElement).parentElement!; const closed = sec.classList.toggle("is-closed"); (e.currentTarget as HTMLElement).setAttribute("aria-expanded", String(!closed)); } }, ic("chevron-down", 13), h("span", null, "Revisión de accesibilidad")), h("div", { class: "pf-secbody" }, summary, list)), refresh() {} };
  refreshReview();

  const hint = h("div", { class: "pf-emptyhint" }, ic("pointer", 18), h("p", null, "Selecciona un elemento en el lienzo o en Capas para editar sus propiedades. Aquí ajustas la página y el sitio."));
  host.replaceChildren(hint, pageSec.el, siteSec.el, reviewSec.el);
  const refreshAll = () => { pageSec.refresh(); siteSec.refresh(); };
  refreshAll();
  const unsub2 = ed.store.subscribe((st, p) => { if (!host.isConnected) { unsub2(); return; } if (st.doc !== p.doc || st.pageId !== p.pageId || st.device !== p.device) refreshAll(); });
}
