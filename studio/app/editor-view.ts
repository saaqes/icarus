/** Vista del editor: barra superior, paneles laterales, lienzo, vista previa, exportación y guardado. */
import { Doc, DEVICES, Device, ProjectFull, ProjectMeta } from "../../shared/model/types";
import { checkAccessibility } from "../../shared/export/a11y";
import { Workspace } from "../canvas/workspace";
import { Editor, LeftTab, EditorState } from "../core/editor";
import { Persistence } from "../core/persistence";
import { session } from "../core/session";
import { Api, ApiError, PROJECT_STATUS_LABEL } from "../lib/api";
import { downloadBlob, safeName, zipBlob } from "../lib/download";
import { confirmDialog, debounce, formatDateTime, h, ic, menu, modal, timeAgo, toast } from "../lib/dom";
import { InsertPanel } from "../ui/insert";
import { LayersPanel } from "../ui/layers";
import { PagesPanel } from "../ui/pages";
import { openPreview } from "../ui/preview";
import { PropertiesPanel } from "../ui/props";
import { ResourcesPanel } from "../ui/resources";
import { attachShortcuts, showShortcuts } from "../ui/shortcuts";
import { buildSitePanel } from "../ui/sitepanel";
import { TemplatesPanel } from "../ui/templates";

export interface EditorViewOptions {
  project: ProjectFull;
  restored?: Doc;
  onExit: () => void;
  onFinish: (id: string) => void;
}

const LEFT_TABS: { id: LeftTab; label: string; icon: string }[] = [
  { id: "insert", label: "Insertar", icon: "plus" },
  { id: "layers", label: "Capas", icon: "layers" },
  { id: "pages", label: "Páginas", icon: "file" },
  { id: "templates", label: "Plantillas", icon: "grid" },
  { id: "assets", label: "Recursos", icon: "image" },
];

const PANEL_KEY = "icarus.studio.panels";

export function mountEditor(host: HTMLElement, opts: EditorViewOptions): () => void {
  let meta: ProjectMeta = opts.project;
  const ed = new Editor(opts.project.doc);
  session.projectId = meta.id;
  const persistence = new Persistence(ed, meta.id, meta.rev);
  if (opts.restored) ed.replaceDoc(opts.restored, "Recuperar cambios locales");
  let ws: Workspace | null = null;
  const getWs = () => ws;
  const disposers: (() => void)[] = [];

  /* ---------- Paneles ---------- */
  const insert = new InsertPanel(ed, getWs);
  const layers = new LayersPanel(ed, (id) => ws?.reveal(id));
  const pages = new PagesPanel(ed);
  const templates = new TemplatesPanel(ed);
  const resources = new ResourcesPanel(ed);
  const props = new PropertiesPanel(ed);
  props.emptyBuilder = (el) => buildSitePanel(ed, el);
  props.reset();

  const panelBodies: Record<LeftTab, HTMLElement> = {
    insert: insert.el, layers: layers.el, pages: pages.el, templates: templates.el, assets: resources.el,
  };
  const tabBtns = LEFT_TABS.map((t) =>
    h("button", { type: "button", role: "tab", class: "ed-tab", dataset: { tab: t.id }, "aria-label": t.label, "data-tip": t.label, onclick: () => ed.store.set({ leftTab: t.id }) }, ic(t.icon, 17), h("span", null, t.label)));
  const left = h("aside", { class: "ed-left", "aria-label": "Herramientas y elementos" },
    h("div", { class: "ed-tabs", role: "tablist" }, tabBtns),
    h("div", { class: "ed-panelbody" }, LEFT_TABS.map((t) => h("div", { class: "ed-pane", dataset: { pane: t.id }, role: "tabpanel" }, panelBodies[t.id]))),
    h("button", { type: "button", class: "ed-sheetclose st-btn st-btn--ghost st-btn--sm", onclick: () => ed.store.set({ sheet: null }) }, ic("x", 14), "Cerrar"));
  const right = h("aside", { class: "ed-right", "aria-label": "Propiedades" },
    h("header", { class: "ed-righthead" }, h("strong", null, "Propiedades"), h("button", { type: "button", class: "ed-sheetclose st-icon-btn", "aria-label": "Cerrar panel", onclick: () => ed.store.set({ sheet: null }) }, ic("x", 16))),
    h("div", { class: "ed-panelbody" }, props.el));

  /* ---------- Barra superior ---------- */
  const nameIn = h("input", { class: "tb-name", type: "text", value: meta.name, "aria-label": "Nombre del proyecto", maxlength: "120" });
  const commitName = async () => {
    const v = nameIn.value.trim();
    if (!v) { nameIn.value = meta.name; return; }
    if (v === meta.name) return;
    try { meta = { ...meta, ...(await Api.patchProject(meta.id, { name: v })).project, doc: undefined } as ProjectMeta; toast("Nombre actualizado", "ok", 1200); }
    catch (e) { nameIn.value = meta.name; toast((e as Error).message, "error"); }
  };
  nameIn.addEventListener("change", () => void commitName());
  nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter") nameIn.blur(); });

  const saveChip = h("button", { type: "button", class: "tb-save", "aria-live": "polite" });
  saveChip.addEventListener("click", () => {
    const st = ed.s.save.status;
    if (st === "conflict") void resolveConflict();
    else if (st === "error" || st === "offline" || st === "dirty") void persistence.save(false);
  });
  const renderSave = (s: EditorState) => {
    const st = s.save.status;
    const icon = { saved: "cloud", saving: "spinner", dirty: "cloud", error: "alert", offline: "cloud-off", conflict: "alert", local: "cloud-off" }[st];
    const text = st === "saved" && s.save.at ? `Guardado ${timeAgo(new Date(s.save.at).toISOString())}` : s.save.message;
    saveChip.className = `tb-save tb-save--${st}`;
    saveChip.replaceChildren(ic(icon, 14), h("span", null, text), st === "error" || st === "offline" ? h("em", null, "Reintentar") : st === "conflict" ? h("em", null, "Resolver") : "");
    saveChip.title = s.save.message;
  };

  const undoBtn = h("button", { type: "button", class: "tb-btn", "aria-label": "Deshacer", onclick: () => ed.undo() }, ic("undo", 17));
  const redoBtn = h("button", { type: "button", class: "tb-btn", "aria-label": "Rehacer", onclick: () => ed.redo() }, ic("redo", 17));
  const devBtns = DEVICES.map((d) =>
    h("button", { type: "button", class: "tb-dev", dataset: { d }, "aria-label": { desktop: "Escritorio", tablet: "Tableta", mobile: "Móvil" }[d], "data-tip": { desktop: "Escritorio", tablet: "Tableta", mobile: "Móvil" }[d], "aria-pressed": "false", onclick: () => ed.setDevice(d) }, ic(d, 17)));
  const widthIn = h("input", { class: "tb-width", type: "number", min: "280", max: "2400", "aria-label": "Ancho del lienzo en píxeles", "data-tip": "Ancho del lienzo" });
  widthIn.addEventListener("change", () => ed.setWidth(ed.device, Number(widthIn.value) || 390));

  const doSave = async () => {
    const ok = await persistence.save(true);
    if (ok) toast("Proyecto guardado", "ok", 1400);
  };

  const exportMenu = (anchor: HTMLElement) => menu(anchor, [
    { label: "Descargar sitio (.zip)", icon: "download", onClick: () => void downloadZip() },
    { label: "Exportar proyecto (.icarus.json)", icon: "file", onClick: () => void exportJson() },
    { separator: true, label: "" },
    { label: "Historial de versiones", icon: "history", onClick: () => void showVersions() },
    { label: "Atajos de teclado", icon: "keyboard", shortcut: "?", onClick: () => showShortcuts() },
  ], { align: "end" });

  async function downloadZip(): Promise<void> {
    const issues = checkAccessibility(ed.doc).filter((i) => i.level === "error");
    if (issues.length) { toast(`Antes de exportar, corrige: ${issues[0].message}`, "error", 5000); return; }
    toast("Preparando el sitio…", "info", 1500);
    if (!(await persistence.flush()) && persistence.isDirty) { toast("No se pudo guardar el proyecto; inténtalo de nuevo.", "error"); return; }
    try {
      const r = await Api.buildZip(meta.id, ed.doc);
      downloadBlob(zipBlob(r.zip), r.filename);
      toast(`Descargando ${r.filename} (${(r.zip.length / 1024).toFixed(0)} KB, ${r.files.length} archivos)`, "ok", 3500);
      if (r.warnings.length) await modal({ title: "El sitio se generó con avisos", body: h("ul", { class: "st-list" }, r.warnings.map((w) => h("li", null, w))) });
    } catch (e) { toast((e as Error).message, "error", 5000); }
  }

  async function exportJson(): Promise<void> {
    try {
      const file = await Api.exportProjectFile(meta.id, ed.doc);
      downloadBlob(new Blob([JSON.stringify(file)], { type: "application/json" }), `${safeName(meta.name)}.icarus.json`);
      toast("Proyecto exportado. Impórtalo en «Mis proyectos» desde otro dispositivo.", "ok", 3500);
    } catch (e) { toast((e as Error).message, "error", 5000); }
  }

  async function showVersions(): Promise<void> {
    let versions: { version: number; label: string; createdAt: string }[] = [];
    try { versions = (await Api.versions(meta.id)).versions; } catch (e) { toast((e as Error).message, "error"); return; }
    const list = h("ul", { class: "st-list st-list--rows" }, versions.map((v) =>
      h("li", null, h("div", null, h("strong", null, `Versión ${v.version}`), h("small", null, ` · ${v.label || "Autoguardado"} · ${formatDateTime(v.createdAt)}`)),
        h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: async () => {
          if (!(await confirmDialog("Restaurar versión", `Se cargará la versión ${v.version} en el editor. Tu estado actual se podrá recuperar con Ctrl Z.`, "Restaurar"))) return;
          try { const { doc } = await Api.versionDoc(meta.id, v.version); ed.replaceDoc(doc, `Restaurar versión ${v.version}`); toast("Versión restaurada", "ok"); document.querySelector<HTMLElement>(".st-backdrop .st-icon-btn")?.click(); }
          catch (e) { toast((e as Error).message, "error"); }
        } }, "Restaurar"))));
    await modal({ title: "Historial de versiones", body: versions.length ? list : h("p", { class: "st-empty" }, "Aún no hay versiones guardadas. Se crea una al guardar manualmente."), wide: true });
  }

  async function resolveConflict(): Promise<void> {
    const r = await modal({
      title: "El proyecto cambió en otro lugar", body: "Se guardó una versión más reciente desde otra pestaña o dispositivo. Elige qué hacer con tus cambios de esta pestaña.",
      actions: [{ label: "Cancelar", kind: "ghost", value: "" }, { label: "Cargar la versión guardada", kind: "ghost", value: "reload" }, { label: "Sobrescribir con mi versión", kind: "danger", value: "force" }],
    });
    if (r === "reload") { location.reload(); }
    else if (r === "force") {
      try { const { project } = await Api.project(meta.id); persistence.rebase(project.rev); await persistence.save(true); } catch (e) { toast((e as Error).message, "error"); }
    }
  }
  persistence.onConflict = () => void resolveConflict();

  const previewBtn = h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm tb-preview", onclick: () => { ws?.finishEdit(true); openPreview({ doc: ed.doc, pageId: ed.s.pageId, device: ed.device }); } }, ic("play", 14), h("span", null, "Vista previa"));
  const saveBtn = h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => void doSave() }, ic("save", 14), h("span", null, "Guardar"));
  const exportBtn = h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", "aria-haspopup": "menu", onclick: (e: Event) => exportMenu(e.currentTarget as HTMLElement) }, ic("download", 14), h("span", null, "Exportar"));
  const finishBtn = h("button", { type: "button", class: "st-btn st-btn--primary st-btn--sm tb-finish", onclick: async () => {
    ws?.finishEdit(true);
    const ok = await persistence.save(true);
    if (!ok) { toast("Guarda el proyecto antes de finalizar.", "error"); return; }
    opts.onFinish(meta.id);
  } }, h("span", null, "Finalizar"), ic("chevron-right", 14));

  const topbar = h("header", { class: "tb", role: "banner" },
    h("div", { class: "tb-left" },
      h("button", { type: "button", class: "tb-back", "aria-label": "Volver a Mis proyectos", "data-tip": "Mis proyectos", onclick: async () => {
        ws?.finishEdit(true);
        if (persistence.isDirty && !(await persistence.flush())) { if (!(await confirmDialog("Cambios sin guardar", "No se pudieron guardar los últimos cambios. Si sales ahora solo quedarán en una copia local de este navegador.", "Salir de todos modos", true))) return; }
        opts.onExit();
      } }, ic("chevron-left", 18)),
      h("img", { class: "tb-logo", src: "/forja/assets/img/icarus-symbol.webp", alt: "", width: "26", height: "26" }),
      h("span", { class: "tb-brand" }, "STUDIO"),
      nameIn, saveChip),
    h("div", { class: "tb-center" }, undoBtn, redoBtn, h("span", { class: "tb-sep" }), h("div", { class: "tb-devs", role: "group", "aria-label": "Dispositivo" }, devBtns), widthIn, h("span", { class: "tb-unit" }, "px")),
    h("div", { class: "tb-right" }, previewBtn, saveBtn, exportBtn, finishBtn));

  const renderTop = (s: EditorState) => {
    undoBtn.disabled = !s.canUndo; redoBtn.disabled = !s.canRedo;
    undoBtn.title = s.canUndo ? `Deshacer: ${s.undoLabel} (Ctrl Z)` : "Nada que deshacer";
    redoBtn.title = s.canRedo ? `Rehacer: ${s.redoLabel} (Ctrl Shift Z)` : "Nada que rehacer";
    devBtns.forEach((b) => { const on = b.dataset.d === s.device; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    if (document.activeElement !== widthIn) widthIn.value = String(s.widths[s.device]);
    renderSave(s);
  };

  /* ---------- Estructura ---------- */
  const resizerL = h("div", { class: "ed-resizer ed-resizer--l", role: "separator", "aria-orientation": "vertical", "aria-label": "Redimensionar panel izquierdo", tabindex: "0" });
  const resizerR = h("div", { class: "ed-resizer ed-resizer--r", role: "separator", "aria-orientation": "vertical", "aria-label": "Redimensionar panel derecho", tabindex: "0" });
  const center = h("main", { class: "ed-center" });
  const bottom = h("nav", { class: "ed-bottom", "aria-label": "Paneles" },
    h("button", { type: "button", class: "ed-bbtn", onclick: () => ed.store.set({ sheet: ed.s.sheet === "left" ? null : "left" }) }, ic("plus", 18), h("span", null, "Insertar")),
    h("button", { type: "button", class: "ed-bbtn", onclick: () => ed.store.set({ sheet: ed.s.sheet === "left" ? null : "left", leftTab: "layers" }) }, ic("layers", 18), h("span", null, "Capas")),
    h("button", { type: "button", class: "ed-bbtn", onclick: () => ed.store.set({ sheet: ed.s.sheet === "right" ? null : "right" }) }, ic("sliders", 18), h("span", null, "Propiedades")));
  const scrim = h("div", { class: "ed-scrim", onclick: () => ed.store.set({ sheet: null }) });
  const body = h("div", { class: "ed-body" }, left, resizerL, center, resizerR, right, scrim);
  const root = h("div", { class: "ed", dataset: { sheet: "" } }, topbar, body, bottom);
  host.replaceChildren(root);

  if (window.matchMedia("(max-width: 700px)").matches) ed.setDevice("mobile");
  ws = new Workspace(ed);
  center.appendChild(ws.el);
  props.playAnim = (id) => playAnim(id);

  function playAnim(id: string): void {
    const n = ed.doc.nodes[id];
    const a = n?.anim;
    const el = ws?.view.el(id);
    if (!a || a.type === "none" || !el) return;
    const k = a.intensity * 0.8;
    const frames: Record<string, Keyframe[]> = {
      fade: [{ opacity: 0 }, { opacity: 1 }],
      "slide-up": [{ opacity: 0, translate: `0 ${k}px` }, { opacity: 1, translate: "0 0" }],
      "slide-down": [{ opacity: 0, translate: `0 ${-k}px` }, { opacity: 1, translate: "0 0" }],
      "slide-left": [{ opacity: 0, translate: `${-k}px 0` }, { opacity: 1, translate: "0 0" }],
      "slide-right": [{ opacity: 0, translate: `${k}px 0` }, { opacity: 1, translate: "0 0" }],
      scale: [{ opacity: 0, scale: String(1 - a.intensity / 250) }, { opacity: 1, scale: "1" }],
      "zoom-out": [{ opacity: 0, scale: String(1 + a.intensity / 100) }, { opacity: 1, scale: "1" }],
      blur: [{ opacity: 0, filter: `blur(${a.intensity * 0.2}px)` }, { opacity: 1, filter: "blur(0)" }],
      rotate: [{ opacity: 0, rotate: `${-a.intensity * 0.2}deg` }, { opacity: 1, rotate: "0deg" }],
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { toast("Tu sistema tiene activado «reducir movimiento»: la animación no se reproduce.", "info", 2500); return; }
    el.animate(frames[a.type] ?? frames.fade, { duration: a.duration, delay: a.delay, easing: "cubic-bezier(.2,.7,.1,1)", fill: "backwards" });
  }

  /* ---------- Variables del tema (para muestras de color y tipografías de los paneles) ---------- */
  const syncThemeVars = (doc: Doc) => {
    for (const [k, v] of Object.entries(doc.theme.colors)) root.style.setProperty(`--c-${k.replace(/[^a-z0-9_-]/gi, "")}`, v);
    root.style.setProperty("--f-heading", `"${doc.theme.fonts.heading}", sans-serif`);
    root.style.setProperty("--f-body", `"${doc.theme.fonts.body}", sans-serif`);
  };
  syncThemeVars(ed.doc);
  disposers.push(ed.store.subscribe((s, p) => { if (s.doc.theme !== p.doc.theme) syncThemeVars(s.doc); }));

  /* ---------- Reacciones al estado ---------- */
  const applyState = (s: EditorState, prev?: EditorState) => {
    renderTop(s);
    root.dataset.sheet = s.sheet ?? "";
    tabBtns.forEach((b) => { const on = b.dataset.tab === s.leftTab; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); });
    left.querySelectorAll<HTMLElement>(".ed-pane").forEach((p) => { p.hidden = p.dataset.pane !== s.leftTab; });
    if (prev && s.selection !== prev.selection && s.selection.length === 1 && s.leftTab !== "layers" && false) ed.store.set({ leftTab: "layers" });
  };
  applyState(ed.s);
  try { if (localStorage.getItem("icarus.debug")) (window as any).__studio = { ed, ws, persistence }; } catch { /* sin almacenamiento */ }
  disposers.push(ed.store.subscribe((s, p) => applyState(s, p)));
  const tick = setInterval(() => { if (ed.s.save.status === "saved") renderSave(ed.s); }, 30000);
  disposers.push(() => clearInterval(tick));

  /* ---------- Paneles redimensionables ---------- */
  const saved = (() => { try { return JSON.parse(localStorage.getItem(PANEL_KEY) || "{}"); } catch { return {}; } })();
  const setW = (side: "l" | "r", w: number) => {
    const v = Math.max(220, Math.min(side === "l" ? 460 : 480, w));
    root.style.setProperty(side === "l" ? "--left-w" : "--right-w", `${v}px`);
    saved[side] = v;
    try { localStorage.setItem(PANEL_KEY, JSON.stringify(saved)); } catch { /* sin almacenamiento */ }
    ws?.layout();
  };
  if (saved.l) root.style.setProperty("--left-w", `${saved.l}px`);
  if (saved.r) root.style.setProperty("--right-w", `${saved.r}px`);
  const drag = (el: HTMLElement, side: "l" | "r") => {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const x0 = e.clientX, w0 = (side === "l" ? left : right).getBoundingClientRect().width;
      const mv = (ev: PointerEvent) => setW(side, w0 + (side === "l" ? ev.clientX - x0 : x0 - ev.clientX));
      const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); };
      el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up);
    });
    el.addEventListener("keydown", (e) => {
      const cur = (side === "l" ? left : right).getBoundingClientRect().width;
      if (e.key === "ArrowLeft") { e.preventDefault(); setW(side, cur + (side === "l" ? -16 : 16)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setW(side, cur + (side === "l" ? 16 : -16)); }
    });
  };
  drag(resizerL, "l"); drag(resizerR, "r");

  disposers.push(attachShortcuts(ed, getWs, () => void doSave()));

  // al seleccionar en móvil se mantiene el lienzo visible: el panel de propiedades se abre desde la barra inferior
  return () => {
    disposers.forEach((f) => f());
    persistence.dispose();
    ws?.destroy();
    session.projectId = null;
    document.getElementById("studio-doc-fonts")?.remove();
  };
}

export { PROJECT_STATUS_LABEL, ApiError, debounce };
export type { Device };
