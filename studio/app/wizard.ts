/** Asistente de creación: 1) datos del proyecto · 2) elegir diseño · 3) personalizar en el editor. */
import { blankDoc, TEMPLATES, TemplateDef } from "../../shared/templates";
import { thumbnailSvg } from "../../shared/thumb";
import { ProjectFull } from "../../shared/model/types";
import { Api, ApiError } from "../lib/api";
import { confirmDialog, h, ic, toast } from "../lib/dom";
import { openPreview } from "../ui/preview";
import { svgEl, templateThumb } from "../ui/templates";
import { pageShell } from "./shell";

const CATEGORIES: { id: string; label: string; icon: string; templates: string[] }[] = [
  { id: "Negocio o empresa", label: "Negocio o empresa", icon: "briefcase", templates: ["corporativa", "minimalista"] },
  { id: "Portafolio personal", label: "Portafolio personal", icon: "user", templates: ["portafolio", "minimalista"] },
  { id: "Agencia de marketing", label: "Agencia de marketing", icon: "rocket", templates: ["agencia", "tecnologica"] },
  { id: "Tienda visual", label: "Tienda visual", icon: "cart", templates: ["ecommerce", "elegante"] },
  { id: "Servicios profesionales", label: "Servicios profesionales", icon: "shield", templates: ["corporativa", "minimalista"] },
  { id: "Marca personal", label: "Marca personal", icon: "star", templates: ["elegante", "portafolio"] },
  { id: "Producto digital", label: "Producto digital", icon: "zap", templates: ["tecnologica", "ventas"] },
  { id: "Landing page", label: "Landing page", icon: "globe", templates: ["ventas", "tecnologica"] },
  { id: "Página para redes sociales", label: "Página para redes sociales", icon: "camera", templates: ["creativa"] },
  { id: "Otro tipo de página", label: "Otro tipo de página", icon: "file", templates: ["editorial", "minimalista"] },
];

const STYLES = ["Minimalista", "Corporativo", "Tecnológico", "Elegante", "Creativo", "Comercio", "Portafolio", "Agencia", "Ventas", "Editorial"];

interface Draft {
  name: string; siteName: string; owner: string; description: string; category: string; email: string; phone: string; country: string; language: string;
  colors: [string, string]; style: string;
}

const KEY = "studio.wizard.draft";
const emptyDraft = (): Draft => ({ name: "", siteName: "", owner: "", description: "", category: "", email: "", phone: "", country: "Colombia", language: "es", colors: ["#b3261e", "#d9472b"], style: "" });

export async function mountWizard(host: HTMLElement, args: string[]): Promise<() => void> {
  const projectId = args[0] || "";
  let draft: Draft = emptyDraft();
  let project: ProjectFull | null = null;
  try { Object.assign(draft, JSON.parse(sessionStorage.getItem(KEY) || "{}")); } catch { /* borrador vacío */ }

  if (projectId) {
    try {
      project = (await Api.project(projectId)).project;
      draft = {
        ...draft, name: project.name, siteName: project.siteName, owner: project.contact.owner || draft.owner, description: project.description,
        category: project.category || project.pageType || draft.category, email: project.contact.email || "", phone: project.contact.phone || "",
        country: project.contact.country || draft.country, language: project.contact.language || draft.language,
        colors: (project.brand.colors.length === 2 ? project.brand.colors : draft.colors) as [string, string], style: project.brand.style || draft.style,
      };
    } catch (e) {
      toast((e as ApiError).message, "error");
      location.hash = "#/new";
      return () => {};
    }
  }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* sin almacenamiento */ } };
  const editInfo = args[1] === "info";
  const step = projectId && !editInfo ? 2 : 1;

  const body = h("div");
  const steps = h("ol", { class: "wz-steps", "aria-label": "Progreso" },
    [["1", "Tu proyecto"], ["2", "Elige un diseño"], ["3", "Personaliza"]].map(([n, l], i) =>
      h("li", { style: { display: "contents" } }, h("button", { type: "button", class: `wz-step${i + 1 === step ? " is-on" : i + 1 < step ? " is-done" : ""}`, disabled: !(i + 1 < step), "aria-current": i + 1 === step ? "step" : undefined,
        onclick: () => { if (i === 0 && projectId) location.hash = `#/new/${projectId}/info`; } }, h("i"), `${n}. ${l}`))));
  host.replaceChildren(pageShell("new", h("div", null,
    h("h1", { class: "sh-title" }, step === 1 ? "Crea tu página web" : "Elige un diseño"),
    h("p", { class: "sh-sub" }, step === 1 ? "Cuéntanos lo básico. Tu proyecto se guarda en este dispositivo y no necesitas cuenta. Tu nombre y WhatsApp te los pedimos al final." : "Cada plantilla es un diseño real y editable: podrás cambiar textos, imágenes, colores, tipografías y animaciones."),
    steps, body), { narrow: step === 1 }));

  if (step === 1) stepOne(); else stepTwo();

  /* ---------- Paso 1 ---------- */
  function stepOne() {
    const bind = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, key: keyof Draft) => { el.value = String(draft[key] ?? ""); el.addEventListener("input", () => { (draft as any)[key] = el.value; save(); }); return el; };
    const input = (key: keyof Draft, label: string, o: { type?: string; ph?: string; req?: boolean; max?: number; hint?: string } = {}) =>
      h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, label, o.req ? " *" : " (opcional)"), bind(h("input", { class: "st-input", type: o.type ?? "text", placeholder: o.ph ?? "", maxlength: String(o.max ?? 120), autocomplete: "off" }), key), o.hint ? h("span", { class: "st-hint" }, o.hint) : null);
    const err = h("p", { class: "st-error", role: "alert", hidden: true });
    const desc = bind(h("textarea", { class: "st-input st-textarea", rows: "3", maxlength: "600", placeholder: "¿Qué hace tu negocio o proyecto? ¿A quién le habla?" }), "description");
    const typeBox = h("div", { class: "wz-types", role: "radiogroup", "aria-label": "Tipo de página" }, CATEGORIES.map((c) =>
      h("button", { type: "button", role: "radio", class: `wz-type${draft.category === c.id ? " is-on" : ""}`, "aria-checked": String(draft.category === c.id), onclick: () => {
        draft.category = c.id; save();
        typeBox.querySelectorAll("button").forEach((b) => { const on = b.textContent === c.label; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); });
      } }, ic(c.icon, 17), c.label)));
    const lang = bind(h("select", { class: "st-select" }, [["es", "Español"], ["en", "English"], ["pt", "Português"]].map(([v, l]) => h("option", { value: v }, l))), "language");
    const styleBox = h("div", { class: "wz-types", role: "radiogroup", "aria-label": "Estilo visual" }, STYLES.map((s) =>
      h("button", { type: "button", role: "radio", class: `wz-type${draft.style === s ? " is-on" : ""}`, "aria-checked": String(draft.style === s), onclick: () => {
        draft.style = draft.style === s ? "" : s; save();
        styleBox.querySelectorAll("button").forEach((b) => { const on = b.textContent === draft.style; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); });
      } }, s)));
    const colorIn = (i: 0 | 1, label: string) => {
      const inp = h("input", { type: "color", value: draft.colors[i], "aria-label": label });
      inp.addEventListener("input", () => { draft.colors[i] = inp.value; save(); });
      return h("label", { class: "wz-colors" }, h("span", { class: "wz-color" }, inp), h("span", { class: "st-field__label" }, label));
    };

    const saveBtn = h("button", { type: "button", class: "st-btn st-btn--ghost" }, ic("save", 15), "Guardar borrador");
    const next = h("button", { type: "submit", class: "st-btn st-btn--primary st-btn--lg" }, "Continuar", ic("chevron-right", 16));
    const form = h("form", { class: "wz-card", novalidate: true },
      h("div", { class: "wz-grid" },
        input("name", "Nombre del proyecto", { req: true, ph: "Ej.: Agencia Digital", hint: "Es el nombre interno que ves en «Mis proyectos»." }),
        input("siteName", "Nombre público del sitio", { req: true, ph: "Ej.: Pulso Agency", hint: "Es el que verán los visitantes. Puede ser distinto." }),
        input("category", "Actividad o categoría", { ph: "Ej.: cafetería, abogados, fotografía…" }),
        h("div", { class: "wide" }, h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Descripción del negocio (opcional)"), desc)),
        h("div", { class: "wide st-field" }, h("span", { class: "st-field__label" }, "Tipo de página que quieres crear"), typeBox),
        h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Idioma del sitio"), lang),
        h("div", { class: "wide st-field" }, h("span", { class: "st-field__label" }, "Colores principales"), h("div", { class: "wz-colors" }, colorIn(0, "Principal"), colorIn(1, "Secundario"))),
        h("div", { class: "wide st-field" }, h("span", { class: "st-field__label" }, "Estilo visual preferido (opcional)"), styleBox)),
      err, h("div", { class: "wz-actions" }, saveBtn, next));

    // el nombre interno se sugiere desde el público si está vacío
    const nameIn = form.querySelector<HTMLInputElement>('input[maxlength="120"]')!;
    void nameIn;

    const persist = async (go: boolean) => {
      err.hidden = true;
      if (!draft.name.trim() && draft.siteName.trim()) draft.name = draft.siteName.trim();
      if (!draft.siteName.trim() && draft.name.trim()) draft.siteName = draft.name.trim();
      if (!draft.name.trim()) { err.textContent = "Escribe el nombre del proyecto para continuar."; err.hidden = false; form.querySelector<HTMLInputElement>("input")!.focus(); return; }
      if (project) {
        try {
          next.setAttribute("disabled", "");
          const cat0 = CATEGORIES.find((c) => c.id === draft.category);
          await Api.patchProject(project.id, {
            name: draft.name.trim(), siteName: draft.siteName.trim(), description: draft.description.trim(), pageType: cat0?.id ?? draft.category, category: draft.category,
            contact: { ...(project?.contact ?? {}), language: draft.language }, brand: { colors: draft.colors, style: draft.style },
          });
          toast("Datos del proyecto actualizados", "ok", 1500);
          location.hash = go ? `#/new/${project.id}` : "#/projects";
        } catch (e) { err.textContent = (e as ApiError).message; err.hidden = false; next.removeAttribute("disabled"); }
        return;
      }
      const doc = blankDoc(draft.siteName.trim());
      doc.settings.lang = draft.language;
      doc.settings.description = draft.description.slice(0, 160);
      const cat = CATEGORIES.find((c) => c.id === draft.category);
      try {
        (go ? next : saveBtn).setAttribute("disabled", "");
        const { project: p } = await Api.createProject({
          name: draft.name.trim(), siteName: draft.siteName.trim(), description: draft.description.trim(), pageType: cat?.id ?? draft.category, category: draft.category,
          contact: { language: draft.language },
          brand: { colors: draft.colors, style: draft.style }, doc,
        });
        sessionStorage.removeItem(KEY);
        toast("Borrador guardado en este dispositivo", "ok", 1800);
        location.hash = go ? `#/new/${p.id}` : "#/projects";
      } catch (e) {
        err.textContent = (e as ApiError).message; err.hidden = false;
        (go ? next : saveBtn).removeAttribute("disabled");
      }
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); void persist(true); });
    saveBtn.addEventListener("click", () => void persist(false));
    body.append(form);
    setTimeout(() => form.querySelector("input")?.focus(), 40);
  }

  /* ---------- Paso 2 ---------- */
  function stepTwo() {
    const p = project!;
    const edited = p.rev > 1;
    let preselected = "";
    try { preselected = sessionStorage.getItem("studio.tpl") || ""; } catch { /* sin almacenamiento */ }
    const recommended = new Set([...(preselected ? [preselected] : []), ...(CATEGORIES.find((c) => c.id === draft.category || c.id === p.pageType)?.templates ?? []), ...TEMPLATES.filter((t) => t.style === draft.style).map((t) => t.id)]);
    let filter = "all";
    const chips = h("div", { class: "ad-tabs", role: "group", "aria-label": "Filtrar diseños" },
      [["all", "Todos"], ["rec", "Recomendados"], ...TEMPLATES.map((t) => [t.id, t.style])].slice(0, 2).map(([v, l]) => h("button", { type: "button", class: `ad-chip${v === filter ? " is-on" : ""}`, onclick: (e: Event) => { filter = v; chips.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b === e.currentTarget)); render(); } }, l)));
    const grid = h("div", { class: "wz-tplgrid" });
    const apply = async (t: TemplateDef | null) => {
      if (edited && !(await confirmDialog("Reemplazar el diseño", "Este proyecto ya tiene cambios. Al elegir otro diseño se reemplazará todo el contenido (tus datos básicos se conservan).", "Reemplazar diseño", true))) return;
      const doc = t ? t.build() : blankDoc(p.siteName);
      doc.settings.siteName = p.siteName || p.name;
      doc.settings.title = p.siteName || p.name;
      doc.settings.description = (p.description || doc.settings.description || "").slice(0, 160);
      doc.settings.lang = p.contact.language || "es";
      if (t && p.brand.colors.length === 2 && JSON.stringify(p.brand.colors) !== JSON.stringify(["#b3261e", "#d9472b"])) { doc.theme.colors.primary = p.brand.colors[0]; doc.theme.colors.secondary = p.brand.colors[1]; }
      try {
        await Api.saveProject(p.id, doc, p.rev, true);
        await Api.patchProject(p.id, { templateId: t?.id ?? null });
        try { sessionStorage.removeItem("studio.tpl"); } catch { /* sin almacenamiento */ }
        toast(t ? `Diseño «${t.name}» aplicado` : "Proyecto en blanco", "ok", 1600);
        location.hash = `#/edit/${p.id}`;
      } catch (e) { toast((e as ApiError).message, "error"); }
    };
    const render = () => {
      const list = TEMPLATES.filter((t) => filter === "all" || (filter === "rec" && recommended.has(t.id)));
      grid.replaceChildren(
        ...list.map((t) => h("article", { class: `tc${p.templateId === t.id ? " is-on" : ""}` },
          h("button", { type: "button", class: "tc-thumb", "aria-label": `Vista previa de ${t.name}`, onclick: () => openPreview({ doc: t.build(), pageId: "" }) }, svgEl(templateThumb(t.id))),
          h("div", { class: "tc-body", style: { gap: "6px" } }, h("span", { class: "tc-cat" }, t.category), h("h3", null, t.name, recommended.has(t.id) ? h("small", { class: "pj-status pj-status--ready" }, t.id === preselected ? "Elegida" : "Recomendada") : null),
            h("p", null, t.description), h("div", { class: "tc-sw", "aria-hidden": "true" }, t.swatch.map((c) => h("i", { style: { background: c } })))),
          h("div", { class: "tc-actions" },
            h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => openPreview({ doc: t.build(), pageId: "" }) }, ic("play", 13), "Vista previa"),
            h("button", { type: "button", class: "st-btn st-btn--primary st-btn--sm", onclick: () => void apply(t) }, "Usar esta plantilla")))),
        h("article", { class: "tc" },
          h("div", { class: "tc-thumb", style: { display: "grid", placeItems: "center", color: "var(--st-muted)", cursor: "default" } }, ic("plus", 36)),
          h("div", { class: "tc-body" }, h("h3", null, "Empezar desde cero"), h("p", null, "Una página en blanco con una sección de ejemplo. Construye todo con los elementos y secciones prediseñadas.")),
          h("div", { class: "tc-actions" }, h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => void apply(null) }, "Empezar en blanco"))));
    };
    void thumbnailSvg;
    render();
    body.append(
      h("div", { class: "pj-bar" }, chips,
        h("span", { class: "st-hint" }, `Proyecto: ${p.name}`),
        h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", style: { marginLeft: "auto" }, onclick: () => { location.hash = `#/edit/${p.id}`; } }, "Saltar al editor", ic("chevron-right", 14))),
      grid);
  }
  return () => {};
}
