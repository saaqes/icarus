/** Vista previa a pantalla completa: el sitio real (sin interfaz del editor) en un iframe aislado con ancho de dispositivo. */
import { buildSite } from "../../shared/export/render";
import { Device, Doc, DEVICE_WIDTHS } from "../../shared/model/types";
import { h, ic, clamp } from "../lib/dom";

export interface PreviewOptions { doc: Doc; pageId: string; device?: Device; onClose?: () => void }

export function openPreview(o: PreviewOptions): { close(): void } {
  let doc = o.doc;
  let pageId = o.pageId;
  let device: Device = o.device ?? "desktop";
  let width = DEVICE_WIDTHS[device];
  const prevFocus = document.activeElement as HTMLElement | null;

  const iframe = h("iframe", { class: "pv-frame", title: "Vista previa del sitio", sandbox: "allow-scripts allow-popups allow-forms" }) as HTMLIFrameElement;
  const stage = h("div", { class: "pv-stage" }, h("div", { class: "pv-wrap" }, iframe));
  const wrap = stage.firstElementChild as HTMLElement;
  const pageSel = h("select", { class: "st-select st-select--sm", "aria-label": "Página" }) as HTMLSelectElement;
  const widthIn = h("input", { class: "st-input st-input--sm pv-w", type: "number", min: "280", max: "2400", "aria-label": "Ancho de la vista previa en píxeles" }) as HTMLInputElement;
  const note = h("span", { class: "pv-note" });

  const devBtn = (d: Device, label: string) =>
    h("button", { type: "button", class: "pv-dev", dataset: { d }, "aria-pressed": "false", "data-tip": label, "aria-label": label, onclick: () => { device = d; width = DEVICE_WIDTHS[d]; fit(); } }, ic(d, 17), h("span", null, label));

  const pageOptions = () => pageSel.replaceChildren(...doc.pages.map((p) => h("option", { value: p.id }, p.id === doc.settings.homePageId ? `${p.name} (principal)` : p.name)));

  function load() {
    const site = buildSite(doc, { mode: "preview" });
    const page = site.pages.find((p) => p.page.id === pageId) ?? site.pages[0];
    pageId = page.page.id;
    iframe.srcdoc = page.html;
    pageSel.value = pageId;
    note.textContent = site.warnings.length ? `${site.warnings.length} aviso(s): ${site.warnings[0]}` : "";
  }

  function fit() {
    widthIn.value = String(width);
    const avail = stage.clientWidth - 24;
    const scale = Math.min(1, avail / width);
    const availH = stage.clientHeight - 24;
    iframe.style.width = `${width}px`;
    iframe.style.height = `${availH / scale}px`;
    iframe.style.transform = `scale(${scale})`;
    wrap.style.width = `${width * scale}px`;
    wrap.style.height = `${availH}px`;
    bar.querySelectorAll<HTMLElement>(".pv-dev").forEach((b) => { const on = b.dataset.d === device && width === DEVICE_WIDTHS[device]; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    note.dataset.scale = scale < 1 ? `Escala ${Math.round(scale * 100)} %` : "";
  }

  const bar = h("div", { class: "pv-bar" },
    h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => close() }, ic("chevron-left", 14), "Volver al editor"),
    h("div", { class: "pv-devs" }, devBtn("desktop", "Escritorio"), devBtn("tablet", "Tableta"), devBtn("mobile", "Móvil")),
    h("label", { class: "pv-wlabel" }, widthIn, h("span", null, "px")),
    pageSel,
    h("button", { type: "button", class: "st-icon-btn", "aria-label": "Recargar vista previa", "data-tip": "Recargar", onclick: () => load() }, ic("redo", 15)),
    note);
  const root = h("div", { class: "pv", role: "dialog", "aria-modal": "true", "aria-label": "Vista previa del sitio" }, bar, stage);
  document.body.appendChild(root);

  pageOptions();
  pageSel.addEventListener("change", () => { pageId = pageSel.value; load(); });
  widthIn.addEventListener("change", () => { width = clamp(Math.round(Number(widthIn.value) || 390), 280, 2400); fit(); });

  const onMsg = (e: MessageEvent) => {
    if (e.source !== iframe.contentWindow) return;
    const d = e.data;
    if (d && d.type === "icarus-preview-esc") { close(); return; }
    if (d && d.type === "icarus-preview-nav" && typeof d.page === "string" && doc.pages.some((p) => p.id === d.page)) { pageId = d.page; load(); }
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  const ro = new ResizeObserver(() => fit());
  ro.observe(stage);
  window.addEventListener("message", onMsg);
  document.addEventListener("keydown", onKey, true);
  document.body.classList.add("has-preview");
  load();
  fit();
  (bar.querySelector(".st-btn") as HTMLElement).focus();

  function close() {
    ro.disconnect();
    window.removeEventListener("message", onMsg);
    document.removeEventListener("keydown", onKey, true);
    document.body.classList.remove("has-preview");
    root.remove();
    prevFocus?.focus?.();
    o.onClose?.();
  }
  return { close };
}
