/** Galería de plantillas de /forja/: miniaturas reales (el sitio renderizado), filtros, vista previa y «usar plantilla». */
import { buildSite } from "../../shared/export/render";
import { TEMPLATES, TemplateDef } from "../../shared/templates";

const GROUPS: { id: string; label: string; ids: string[] }[] = [
  { id: "all", label: "Todas", ids: [] },
  { id: "negocios", label: "Negocios", ids: ["corporativa", "minimalista"] },
  { id: "portafolios", label: "Portafolios", ids: ["portafolio"] },
  { id: "landing", label: "Landing pages", ids: ["ventas", "tecnologica"] },
  { id: "agencias", label: "Agencias de marketing", ids: ["agencia"] },
  { id: "tiendas", label: "Tiendas visuales", ids: ["ecommerce", "elegante"] },
  { id: "marcas", label: "Marcas personales", ids: ["elegante", "portafolio", "creativa"] },
  { id: "servicios", label: "Páginas de servicios", ids: ["corporativa", "minimalista"] },
  { id: "digital", label: "Productos digitales", ids: ["tecnologica", "ventas"] },
  { id: "creadores", label: "Creadores de contenido", ids: ["creativa"] },
  { id: "editorial", label: "Editorial", ids: ["editorial"] },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const htmlCache = new Map<string, string>();
function templateHtml(t: TemplateDef, noScript = false): string {
  const key = `${t.id}:${noScript}`;
  let h = htmlCache.get(key);
  if (!h) {
    const site = buildSite(t.build(), { mode: "preview", noScript });
    h = site.pages[0].html;
    htmlCache.set(key, h);
  }
  return h;
}

/** Miniatura viva: el sitio real a 1280 px de ancho, reducido; sin scripts (no ejecuta nada). */
function liveThumb(t: TemplateDef): HTMLElement {
  const box = el("button", "bld-thumb");
  box.type = "button";
  box.setAttribute("aria-label", `Vista previa de la plantilla ${t.name}`);
  const frame = el("iframe");
  frame.setAttribute("sandbox", "");
  frame.setAttribute("title", `Miniatura de ${t.name}`);
  frame.setAttribute("tabindex", "-1");
  frame.setAttribute("aria-hidden", "true");
  frame.loading = "lazy";
  frame.style.width = "1280px";
  frame.style.height = "800px";
  box.appendChild(frame);
  const fit = () => { const s = box.clientWidth / 1280; frame.style.transform = `scale(${s})`; frame.style.height = `${box.clientHeight / s}px`; };
  new ResizeObserver(fit).observe(box);
  const io = new IntersectionObserver((e) => {
    if (!e.some((x) => x.isIntersecting)) return;
    io.disconnect();
    frame.addEventListener("load", () => frame.classList.add("is-ready"), { once: true });
    frame.srcdoc = templateHtml(t, true);
  }, { rootMargin: "300px" });
  io.observe(box);
  return box;
}

function openPreview(t: TemplateDef, opener: HTMLElement): void {
  const iframe = el("iframe");
  iframe.setAttribute("sandbox", "allow-scripts allow-popups");
  iframe.setAttribute("title", `Vista previa de ${t.name}`);
  iframe.srcdoc = templateHtml(t, true);
  let width = 0;
  const stage = el("div", "bld-pv__stage");
  const apply = (w: number) => { width = w; iframe.style.width = w ? `${w}px` : "100%"; iframe.style.height = `${stage.clientHeight - 28}px`; bar.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.w) === width))); };
  const bar = el("div", "bld-pv__bar");
  const title = el("strong", undefined, `${t.name} · vista previa`);
  const dev = (label: string, w: number) => { const b = el("button", "btn btn--ghost btn--sm", label); b.type = "button"; b.dataset.w = String(w); b.addEventListener("click", () => apply(w)); return b; };
  const use = el("a", "btn btn--blood btn--sm", "Usar esta plantilla");
  use.href = "studio/#/new";
  use.addEventListener("click", () => { try { sessionStorage.setItem("studio.tpl", t.id); } catch { /* sin almacenamiento */ } });
  const close = el("button", "btn btn--ghost btn--sm", "Cerrar"); close.type = "button";
  bar.append(title, dev("Escritorio", 0), dev("Tableta", 820), dev("Móvil", 390), use, close);
  stage.appendChild(iframe);
  const root = el("div", "bld-pv");
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", `Vista previa de ${t.name}`);
  root.append(bar, stage);
  document.body.append(root);
  document.body.classList.add("has-bld-pv");
  apply(0);
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") end(); };
  const end = () => { document.removeEventListener("keydown", onKey); root.remove(); document.body.classList.remove("has-bld-pv"); opener.focus(); };
  close.addEventListener("click", end);
  document.addEventListener("keydown", onKey);
  close.focus();
}

export function mountGallery(box: HTMLElement, filters: HTMLElement): void {
  let current = "all";
  const render = () => {
    const g = GROUPS.find((x) => x.id === current)!;
    const list = current === "all" ? TEMPLATES : TEMPLATES.filter((t) => g.ids.includes(t.id));
    box.replaceChildren(...list.map((t) => {
      const card = el("article", "bld-card reveal");
      const thumb = liveThumb(t);
      thumb.addEventListener("click", () => openPreview(t, thumb));
      const body = el("div", "bld-card__body");
      const sw = el("div", "bld-card__sw"); sw.setAttribute("aria-hidden", "true");
      for (const c of t.swatch) { const i = el("i"); i.style.background = c; sw.appendChild(i); }
      body.append(el("span", "bld-card__cat", t.category), el("h3", undefined, t.name), el("p", undefined, t.description), sw);
      const actions = el("div", "bld-card__actions");
      const prev = el("button", "btn btn--ghost btn--sm", "Vista previa"); prev.type = "button";
      prev.addEventListener("click", () => openPreview(t, prev));
      const use = el("a", "btn btn--blood btn--sm", "Usar esta plantilla"); use.href = "studio/#/new";
      use.addEventListener("click", () => { try { sessionStorage.setItem("studio.tpl", t.id); } catch { /* sin almacenamiento */ } });
      actions.append(prev, use);
      card.append(thumb, body, actions);
      return card;
    }));
    (window as any).ICARUS?.reveal?.(box);
    // las tarjetas nuevas deben verse aunque el observador de «reveal» ya haya terminado
    box.querySelectorAll(".reveal:not(.is-in)").forEach((c) => c.classList.add("is-in"));
  };
  filters.replaceChildren(...GROUPS.map((g) => {
    const b = el("button", `bld-chip${g.id === current ? " is-on" : ""}`, g.label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(g.id === current));
    b.addEventListener("click", () => {
      current = g.id;
      filters.querySelectorAll("button").forEach((x) => { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", String(on)); });
      render();
    });
    return b;
  }));
  render();
}
