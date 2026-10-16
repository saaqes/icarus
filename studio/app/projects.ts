/** Mis proyectos: carpetas, búsqueda, orden, miniaturas y acciones sobre cada proyecto. */
import { ProjectMeta } from "../../shared/model/types";
import { Api, ApiError, Folder, PROJECT_STATUS_LABEL, RequestRec } from "../lib/api";
import { confirmDialog, debounce, formatDate, h, ic, menu, modal, promptDialog, timeAgo, toast } from "../lib/dom";
import { pageShell } from "./shell";
import { svgEl } from "../ui/templates";

interface State { folder: string; q: string; sort: string; status: string; archived: boolean }

export function mountProjects(host: HTMLElement): () => void {
  const state: State = { folder: sessionStorage.getItem("studio.folder") || "all", q: "", sort: "updated", status: "", archived: false };
  let folders: Folder[] = [];
  let projects: ProjectMeta[] = [];
  let requests: RequestRec[] = [];
  let dragId: string | null = null;
  let disposed = false;

  const side = h("aside", { class: "pj-side", "aria-label": "Carpetas" });
  const grid = h("div", { class: "pj-grid", "aria-live": "polite" });
  const reqBox = h("section", { class: "pj-reqs" });
  const search = h("input", { class: "st-input", type: "search", placeholder: "Buscar proyectos…", "aria-label": "Buscar proyectos" });
  const sortSel = h("select", { class: "st-select", "aria-label": "Ordenar por" },
    ([["updated", "Última modificación"], ["created", "Fecha de creación"], ["name", "Nombre"]] as const).map(([v, l]) => h("option", { value: v }, l)));
  const statusSel = h("select", { class: "st-select", "aria-label": "Filtrar por estado" }, h("option", { value: "" }, "Todos los estados"),
    Object.entries(PROJECT_STATUS_LABEL).map(([v, l]) => h("option", { value: v }, l)));
  const dirBtn = h("button", { type: "button", class: "st-btn st-btn--ghost", "aria-label": "Invertir orden", "data-tip": "Invertir orden" }, ic("chevron-down", 15));
  let dir = "desc";
  const title = h("h1", { class: "sh-title" }, "Mis proyectos");
  const sub = h("p", { class: "sh-sub" }, "Tus proyectos se guardan en este dispositivo (sin cuenta). Organízalos en carpetas, sigue editando y, cuando estén listos, envíanos tu diseño. Para llevarlos a otro dispositivo usa «Exportar proyecto» y luego «Importar proyecto».");

  const importIn = h("input", { type: "file", accept: ".json,application/json", hidden: true });
  importIn.addEventListener("change", async () => {
    const f = importIn.files?.[0]; importIn.value = "";
    if (!f) return;
    try {
      if (f.size > 60 * 1024 * 1024) throw new Error("El archivo es demasiado grande.");
      const raw = JSON.parse(await f.text());
      const { project } = await Api.importProject(raw);
      if (!["all", "root"].includes(state.folder)) await Api.patchProject(project.id, { folderId: state.folder });
      toast("Proyecto importado", "ok");
      location.hash = `#/edit/${project.id}`;
    } catch (e) { toast((e as Error).message || "No se pudo importar el proyecto.", "error", 5000); }
  });

  const content = h("div", null,
    h("div", { class: "pj-top" }, h("div", null, title, sub), h("div", { class: "pj-topbtns", style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
      h("button", { type: "button", class: "st-btn st-btn--ghost", onclick: () => importIn.click() }, ic("upload", 15), "Importar proyecto"), importIn,
      h("a", { class: "st-btn st-btn--primary", href: "#/new" }, ic("plus", 15), "Nueva página web"))),
    h("div", { class: "pj-layout" }, side,
      h("div", null,
        h("div", { class: "pj-bar" }, h("div", { class: "pj-search" }, ic("search", 15), search), statusSel, sortSel, dirBtn),
        grid, reqBox)));
  host.replaceChildren(pageShell("projects", content));

  /* ---------- Datos ---------- */
  async function loadFolders() { folders = (await Api.folders()).folders; renderSide(); }
  async function loadProjects() {
    const q: Record<string, string> = { folder: state.folder, sort: state.sort, dir };
    if (state.q) q.q = state.q;
    if (state.status) q.status = state.status;
    if (state.archived) q.archived = "1";
    try { projects = (await Api.projects(q)).projects; } catch (e) { toast((e as Error).message, "error"); projects = []; }
    if (!disposed) renderGrid();
  }

  /* ---------- Carpetas ---------- */
  const count = async (id: string) => id;
  void count;
  function folderBtn(id: string, label: string, icon: string, depth: number, f?: Folder): HTMLElement {
    const on = state.folder === id;
    const b = h("div", { class: `pj-folder${on ? " is-on" : ""}`, role: "button", tabindex: "0", style: { paddingLeft: `${8 + depth * 14}px` }, dataset: { folder: id }, "aria-current": on ? "true" : undefined },
      ic(icon, 15), h("span", { class: "pj-fname" }, label),
      f ? h("button", { type: "button", class: "st-icon-btn pj-fmore", "aria-label": `Acciones de la carpeta ${label}`, onclick: (e: Event) => { e.stopPropagation(); folderMenu(e.currentTarget as HTMLElement, f); } }, ic("dots", 14)) : null);
    const go = () => { state.folder = id; sessionStorage.setItem("studio.folder", id); renderSide(); void loadProjects(); };
    b.addEventListener("click", go);
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    if (id !== "all") {
      b.addEventListener("dragover", (e) => { if (dragId) { e.preventDefault(); b.classList.add("is-drop"); } });
      b.addEventListener("dragleave", () => b.classList.remove("is-drop"));
      b.addEventListener("drop", async (e) => {
        e.preventDefault(); b.classList.remove("is-drop");
        if (dragId) await moveProject(dragId, id === "root" ? null : id);
      });
    }
    return b;
  }

  function renderSide() {
    const tree = (parent: string | null, depth: number): HTMLElement[] =>
      folders.filter((f) => f.parentId === parent).flatMap((f) => [folderBtn(f.id, f.name, "folder", depth, f), ...tree(f.id, depth + 1)]);
    side.replaceChildren(
      h("div", { class: "pj-sidehead" }, h("span", null, "Carpetas"),
        h("button", { type: "button", class: "st-icon-btn", "aria-label": "Nueva carpeta", "data-tip": "Nueva carpeta", onclick: () => void newFolder(null) }, ic("folder-plus", 16))),
      folderBtn("all", "Todos los proyectos", "layers", 0), folderBtn("root", "Sin carpeta", "file", 0), ...tree(null, 0),
      h("hr", { class: "st-menu__sep" }),
      h("button", { type: "button", class: `pj-folder${state.archived ? " is-on" : ""}`, onclick: () => { state.archived = !state.archived; renderSide(); void loadProjects(); } }, ic("history", 15), h("span", { class: "pj-fname" }, state.archived ? "Viendo archivados" : "Ver archivados")));
  }

  async function newFolder(parent: string | null) {
    const name = await promptDialog(parent ? "Nueva subcarpeta" : "Nueva carpeta", "Nombre de la carpeta", "", "Crear");
    if (!name) return;
    try { await Api.createFolder(name, parent); await loadFolders(); toast("Carpeta creada", "ok", 1200); } catch (e) { toast((e as Error).message, "error"); }
  }

  function folderMenu(anchor: HTMLElement, f: Folder) {
    menu(anchor, [
      { label: "Nueva subcarpeta", icon: "folder-plus", onClick: () => void newFolder(f.id) },
      { label: "Renombrar", icon: "edit", onClick: async () => { const n = await promptDialog("Renombrar carpeta", "Nombre", f.name, "Guardar"); if (n) { await Api.updateFolder(f.id, { name: n }).catch((e) => toast(e.message, "error")); await loadFolders(); } } },
      { label: "Mover a…", icon: "folder", onClick: async () => { const t = await chooseFolder("Mover carpeta a…", f.id); if (t !== undefined) { await Api.updateFolder(f.id, { parentId: t }).catch((e) => toast(e.message, "error")); await loadFolders(); } } },
      { separator: true, label: "" },
      { label: "Eliminar carpeta", icon: "trash", danger: true, onClick: async () => {
        if (await confirmDialog("Eliminar carpeta", `Se eliminará la carpeta «${f.name}». Sus proyectos y subcarpetas NO se borran: pasan al nivel superior.`, "Eliminar carpeta", true)) {
          await Api.deleteFolder(f.id).catch((e) => toast(e.message, "error"));
          if (state.folder === f.id) state.folder = "all";
          await loadFolders(); await loadProjects();
        }
      } },
    ]);
  }

  /** Diálogo para elegir una carpeta de destino. undefined = cancelado, null = raíz. */
  async function chooseFolder(titleText: string, exclude?: string): Promise<string | null | undefined> {
    let chosen: string | null | undefined;
    const descendants = new Set<string>();
    if (exclude) { const walk = (id: string) => { descendants.add(id); folders.filter((f) => f.parentId === id).forEach((c) => walk(c.id)); }; walk(exclude); }
    const rows: HTMLElement[] = [];
    const add = (parent: string | null, depth: number) => folders.filter((f) => f.parentId === parent && !descendants.has(f.id)).forEach((f) => {
      rows.push(radio(f.id, f.name, depth)); add(f.id, depth + 1);
    });
    function radio(id: string | null, label: string, depth: number) {
      const input = h("input", { type: "radio", name: "dest", value: id ?? "" });
      input.addEventListener("change", () => { chosen = id; });
      return h("label", { class: "pj-folder", style: { paddingLeft: `${8 + depth * 14}px` } }, input, ic(id ? "folder" : "file", 15), h("span", { class: "pj-fname" }, label));
    }
    rows.push(radio(null, "Sin carpeta (nivel principal)", 0));
    add(null, 0);
    const r = await modal({ title: titleText, body: h("div", { style: { display: "grid", gap: "2px", maxHeight: "50vh", overflow: "auto" } }, rows), actions: [{ label: "Cancelar", kind: "ghost", value: "no" }, { label: "Mover aquí", kind: "primary", value: "ok", onClick: () => { if (chosen === undefined) { toast("Elige una carpeta.", "info"); return false; } } }] });
    return r === "ok" ? chosen : undefined;
  }

  async function moveProject(id: string, folderId: string | null) {
    try { await Api.patchProject(id, { folderId }); toast("Proyecto movido", "ok", 1200); await loadProjects(); } catch (e) { toast((e as Error).message, "error"); }
  }

  /* ---------- Tarjetas ---------- */
  function card(p: ProjectMeta): HTMLElement {
    const open = () => { location.hash = `#/edit/${p.id}`; };
    const el = h("article", { class: "pj-card", draggable: "true", dataset: { id: p.id } },
      h("button", { type: "button", class: "pj-thumb", "aria-label": `Abrir ${p.name}`, onclick: open }, p.thumb ? svgEl(p.thumb) : ic("file", 28)),
      h("div", { class: "pj-info" },
        h("div", { class: "pj-name", title: p.name }, p.name),
        h("div", { class: "pj-meta" }, h("span", null, `Modificado ${timeAgo(p.updatedAt)}`), h("span", null, `Creado ${formatDate(p.createdAt)}`), h("span", null, `${p.pageCount} pág.`))),
      h("div", { class: "pj-foot" },
        h("span", { class: `pj-status pj-status--${p.status}` }, PROJECT_STATUS_LABEL[p.status] ?? p.status),
        h("div", { class: "pj-actions" },
          h("button", { type: "button", class: "st-icon-btn", "aria-label": `Editar ${p.name}`, "data-tip": "Editar", onclick: open }, ic("edit", 15)),
          h("button", { type: "button", class: "st-icon-btn", "aria-label": `Duplicar ${p.name}`, "data-tip": "Duplicar", onclick: () => void duplicate(p) }, ic("duplicate", 15)),
          h("button", { type: "button", class: "st-icon-btn", "aria-label": `Más acciones de ${p.name}`, onclick: (e: Event) => projectMenu(e.currentTarget as HTMLElement, p) }, ic("dots", 15)))));
    el.addEventListener("dragstart", (e) => { dragId = p.id; e.dataTransfer?.setData("text/plain", p.id); el.classList.add("is-dragging"); });
    el.addEventListener("dragend", () => { dragId = null; el.classList.remove("is-dragging"); });
    return el;
  }

  async function duplicate(p: ProjectMeta) {
    try { await Api.duplicateProject(p.id); toast("Proyecto duplicado", "ok", 1400); await loadProjects(); } catch (e) { toast((e as Error).message, "error"); }
  }

  function projectMenu(anchor: HTMLElement, p: ProjectMeta) {
    menu(anchor, [
      { label: "Abrir y editar", icon: "edit", onClick: () => { location.hash = `#/edit/${p.id}`; } },
      { label: "Cambiar nombre", icon: "type", onClick: async () => { const n = await promptDialog("Cambiar nombre", "Nombre del proyecto", p.name, "Guardar"); if (n) { await Api.patchProject(p.id, { name: n }).catch((e) => toast(e.message, "error")); await loadProjects(); } } },
      { label: "Duplicar", icon: "duplicate", onClick: () => void duplicate(p) },
      { label: "Mover a carpeta…", icon: "folder", onClick: async () => { const t = await chooseFolder("Mover proyecto a…"); if (t !== undefined) await moveProject(p.id, t); } },
      { separator: true, label: "" },
      { label: p.archived ? "Restaurar" : "Archivar", icon: "history", onClick: async () => { await Api.patchProject(p.id, { archived: !p.archived }).catch((e) => toast(e.message, "error")); toast(p.archived ? "Proyecto restaurado" : "Proyecto archivado", "ok", 1400); await loadProjects(); } },
      { label: "Eliminar", icon: "trash", danger: true, onClick: async () => {
        if (await confirmDialog("Eliminar proyecto", `Se eliminará «${p.name}» con todas sus páginas y versiones. Esta acción no se puede deshacer.`, "Eliminar proyecto", true)) {
          try { await Api.deleteProject(p.id); toast("Proyecto eliminado", "ok", 1400); await loadProjects(); } catch (e) { toast((e as Error).message, "error"); }
        }
      } },
    ]);
  }

  function renderGrid() {
    const inFolder = folders.find((f) => f.id === state.folder);
    title.textContent = state.archived ? "Proyectos archivados" : inFolder ? inFolder.name : state.folder === "root" ? "Sin carpeta" : "Mis proyectos";
    if (!projects.length) {
      const filtered = !!(state.q || state.status || state.archived || state.folder !== "all");
      grid.replaceChildren(h("div", { class: "pj-empty", style: { gridColumn: "1 / -1" } },
        ic("layers", 34),
        h("h2", null, filtered ? "No hay proyectos aquí" : "Aún no has creado ninguna página"),
        h("p", null, filtered ? "Prueba con otra búsqueda, otra carpeta o crea un proyecto nuevo." : "Crea tu primer sitio web a partir de una plantilla o desde cero. Se guardará automáticamente en este dispositivo."),
        h("a", { class: "st-btn st-btn--primary", href: "#/new" }, ic("plus", 15), "Crear mi primera página")));
      return;
    }
    grid.replaceChildren(...projects.map(card), ...(state.archived ? [] : [h("a", { class: "pj-new", href: "#/new" }, ic("plus", 22), "Nueva página web")]));
  }

  async function loadRequests() {
    try { requests = (await Api.myRequests()).requests; } catch { requests = []; }
    if (!requests.length) { reqBox.replaceChildren(); return; }
    reqBox.replaceChildren(h("h2", { class: "sh-title", style: { fontSize: "20px" } }, "Enviadas desde este dispositivo"),
      ...requests.map((r) => h("div", { class: "pj-req" }, h("code", null, r.id), h("div", null, h("strong", null, r.projectName), h("div", { class: "st-hint" }, `${formatDate(r.createdAt)} · ${r.summary.pageCount ?? 1} página(s) · ${r.filename}`)),
        h("a", { class: "st-btn st-btn--ghost st-btn--sm", href: `#/finish/${r.projectId}` }, "Volver a enviar"))));
  }

  /* ---------- Eventos ---------- */
  const onSearch = debounce(() => { state.q = search.value.trim(); void loadProjects(); }, 250);
  search.addEventListener("input", onSearch);
  sortSel.addEventListener("change", () => { state.sort = sortSel.value; void loadProjects(); });
  statusSel.addEventListener("change", () => { state.status = statusSel.value; void loadProjects(); });
  dirBtn.addEventListener("click", () => { dir = dir === "desc" ? "asc" : "desc"; dirBtn.style.transform = dir === "asc" ? "rotate(180deg)" : ""; void loadProjects(); });

  grid.replaceChildren(h("div", { class: "st-loading", style: { gridColumn: "1 / -1" } }, h("span", { class: "st-spin" })));
  void (async () => {
    try { await loadFolders(); } catch (e) { toast((e as ApiError).message, "error"); }
    await loadProjects();
    await loadRequests();
  })();
  return () => { disposed = true; };
}
