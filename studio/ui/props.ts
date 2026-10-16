/** Panel de propiedades: muestra solo los controles que corresponden al tipo de elemento seleccionado. */
import { Border, Device, DEVICES, Fill, Node } from "../../shared/model/types";
import { effectiveLayout, resolveStyle } from "../../shared/model/style";
import { TEXT_STYLES } from "../../shared/model/presets";
import { TYPE_LABELS } from "../../shared/model/doc";
import { Editor } from "../core/editor";
import { h, ic, toast } from "../lib/dom";
import {
  buttonIconField, colorField, Ctl, dimStyle, fillField, focalField, fontField, iconPickerField, imageSourceField, linkField, numStyle, PanelCtx,
  propSelect, propSlider, propText, propToggle, readProp, readStyle, row, section, segStyle, selectField, shadowField, sidesStyle, sliderStyle, styleColor, styleToggle,
} from "./controls";

const cond = (c: Ctl, fn: () => boolean): Ctl => ({ el: c.el, refresh() { const show = fn(); c.el.hidden = !show; if (show) c.refresh(); } });

const DEVICE_LABEL: Record<Device, string> = { desktop: "Escritorio", tablet: "Tableta", mobile: "Móvil" };

export class PropertiesPanel {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private key = "";
  private parts: { refresh(): void }[] = [];
  private header: { refresh(): void } | null = null;
  playAnim: (id: string) => void = () => {};

  constructor(private ed: Editor) {
    this.body = h("div", { class: "pf-body" });
    this.el = h("div", { class: "pf" }, this.body);
    ed.store.subscribe((s, prev) => {
      if (s.selection !== prev.selection || s.device !== prev.device || s.doc !== prev.doc || s.uiState !== prev.uiState || s.pageId !== prev.pageId) this.update();
    });
    this.update();
  }

  /** Reconstruye solo si cambia la «forma» de la selección; si no, refresca los valores. */
  update(): void {
    const ed = this.ed;
    const nodes = ed.selected;
    if (!nodes.length) { this.showEmpty(); return; }
    const key = `${nodes.map((n) => n.id).join(",")}|${ed.device}|${nodes.map((n) => n.type).join(",")}|${ed.s.uiState}`;
    if (key !== this.key) {
      this.key = key;
      this.build(nodes);
    }
    this.header?.refresh();
    for (const p of this.parts) p.refresh();
  }

  /** Fuerza la reconstrucción (p. ej. al asignar `emptyBuilder`). */
  reset(): void { this.key = ""; this.update(); }

  private emptyHost: HTMLElement | null = null;
  emptyBuilder: ((host: HTMLElement) => void) | null = null;
  private showEmpty(): void {
    if (this.key === "__empty") { return; }
    this.key = "__empty";
    this.parts = []; this.header = null;
    this.body.replaceChildren();
    this.emptyHost = h("div", { class: "pf-empty" });
    this.body.appendChild(this.emptyHost);
    this.emptyBuilder?.(this.emptyHost);
  }

  private build(nodes: Node[]): void {
    const ed = this.ed;
    const ctx: PanelCtx = { ed, nodes: () => ed.selected, ids: () => ed.s.selection.filter((id) => ed.doc.nodes[id]), device: () => ed.device };
    const types = new Set(nodes.map((n) => n.type));
    const single = nodes.length === 1;
    const t = nodes[0].type;
    const all = (...ts: string[]) => nodes.every((n) => ts.includes(n.type));
    const any = (...ts: string[]) => nodes.some((n) => ts.includes(n.type));
    const containerish = all("section", "container", "form", "root");
    const sections: { el: HTMLElement; refresh(): void }[] = [];
    const freeChild = () => ctx.ids().length > 0 && ctx.ids().every((id) => ed.isFreeChild(id));
    const parentGrid = () => ctx.ids().some((id) => ed.parentLayout(id) === "grid");
    const layoutOf = () => { const n = ed.selected[0]; return n ? effectiveLayout(n, ed.device) : "stack"; };

    /* ----- Cabecera ----- */
    const nameIn = h("input", { class: "st-input pf-name", type: "text", "aria-label": "Nombre de la capa", maxlength: "120" });
    nameIn.addEventListener("change", () => { if (single) ed.rename(nodes[0].id, nameIn.value); });
    nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter") nameIn.blur(); });
    const kind = h("span", { class: "pf-kind" });
    const actions = h("div", { class: "pf-actions" },
      h("button", { type: "button", class: "st-icon-btn", "aria-label": "Duplicar", "data-tip": "Duplicar (Ctrl D)", onclick: () => ed.duplicateNodes() }, ic("duplicate", 15)),
      h("button", { type: "button", class: "st-icon-btn", "aria-label": "Bloquear o desbloquear", "data-tip": "Bloquear", onclick: () => ed.toggleLock() }, ic("lock", 15)),
      h("button", { type: "button", class: "st-icon-btn", "aria-label": "Ocultar", "data-tip": "Ocultar", onclick: () => ed.toggleHidden() }, ic("eye-off", 15)),
      h("button", { type: "button", class: "st-icon-btn is-danger", "aria-label": "Eliminar", "data-tip": "Eliminar (Supr)", onclick: () => ed.deleteNodes() }, ic("trash", 15)));
    const devNote = h("div", { class: "pf-devnote" });
    const head = h("div", { class: "pf-head" }, single ? nameIn : h("div", { class: "pf-multi" }, `${nodes.length} elementos`), kind, actions, devNote);
    this.header = {
      refresh: () => {
        const ns = ed.selected;
        if (!ns.length) return;
        if (single && document.activeElement !== nameIn) nameIn.value = ns[0].name;
        kind.textContent = single ? TYPE_LABELS[ns[0].type] : [...types].map((x) => TYPE_LABELS[x]).join(" · ");
        const d = ed.device;
        devNote.hidden = d === "desktop";
        devNote.replaceChildren(ic("info", 13), h("span", null, d === "tablet" ? "Editando Tableta: los cambios se heredan en Móvil." : "Editando Móvil: los cambios solo afectan a este tamaño."));
      },
    };

    /* ----- Diseño (posición y tamaño) ----- */
    const design: Ctl[] = [
      cond(numStyle(ctx, { label: "X", key: "x", step: 1, unit: "px" }), freeChild),
      cond(numStyle(ctx, { label: "Y", key: "y", step: 1, unit: "px" }), freeChild),
      dimStyle(ctx, "Ancho", "w"),
      cond(dimStyle(ctx, "Alto", "h"), () => !(all("text") && !freeChild() && false)),
      numStyle(ctx, { label: "Rotación", key: "rotate", min: -360, max: 360, step: 1, unit: "°" }),
      sliderStyle(ctx, { label: "Opacidad", key: "opacity", min: 0, max: 100, step: 1, scale: 0.01, def: 100 }),
      cond(segStyle(ctx, { label: "Alineación propia", key: "alignSelf", def: "auto", options: [
        { value: "auto", label: "Auto", title: "Automática" }, { value: "start", icon: "align-left", title: "Al inicio" }, { value: "center", icon: "align-hcenter", title: "Centrada" },
        { value: "end", icon: "align-right", title: "Al final" }, { value: "stretch", label: "↔", title: "Estirar" }] }), () => !freeChild()),
      cond(numStyle(ctx, { label: "Columnas que ocupa", key: "colSpan", min: 1, max: 12, step: 1 }), parentGrid),
    ];
    if (any("image", "video")) design.push(propToggle(ctx, "Mantener proporción", "lock", "Al redimensionar con las asas se conserva la proporción."));
    sections.push(section("design", "Diseño", design));

    /* ----- Alinear (varios elementos / libres) ----- */
    const alignBar = h("div", { class: "pf-alignbar", role: "group", "aria-label": "Alinear" },
      ([["left", "align-left", "Alinear a la izquierda"], ["hcenter", "align-hcenter", "Centrar horizontalmente"], ["right", "align-right", "Alinear a la derecha"], ["top", "align-top", "Alinear arriba"], ["vcenter", "align-vcenter", "Centrar verticalmente"], ["bottom", "align-bottom", "Alinear abajo"]] as const).map(([k, icon, title]) =>
        h("button", { type: "button", class: "st-icon-btn", "aria-label": title, "data-tip": title, onclick: () => ed.align(k) }, ic(icon, 16))),
      h("button", { type: "button", class: "st-icon-btn", "aria-label": "Distribuir horizontalmente", "data-tip": "Distribuir horizontalmente", onclick: () => ed.distribute("x") }, ic("columns", 16)),
      h("button", { type: "button", class: "st-icon-btn", "aria-label": "Distribuir verticalmente", "data-tip": "Distribuir verticalmente", onclick: () => ed.distribute("y") }, ic("rows", 16)),
    );
    const arrange = h("div", { class: "pf-arrange" },
      h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => ed.group() }, ic("group", 14), "Agrupar"),
      h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => ed.ungroup() }, ic("ungroup", 14), "Desagrupar"),
      h("button", { type: "button", class: "st-icon-btn", "aria-label": "Traer al frente", "data-tip": "Traer al frente", onclick: () => ed.reorder("front") }, ic("front", 16)),
      h("button", { type: "button", class: "st-icon-btn", "aria-label": "Enviar al fondo", "data-tip": "Enviar al fondo", onclick: () => ed.reorder("back") }, ic("back", 16)));
    sections.push(section("align", "Alinear y ordenar", [{ el: alignBar, refresh() {} }, { el: arrange, refresh() {} }], { open: nodes.length > 1 }));

    /* ----- Disposición de contenedores ----- */
    if (containerish) {
      const layoutCtl: Ctl = (() => {
        const group = h("div", { class: "pf-seg pf-seg--4", role: "radiogroup", "aria-label": "Disposición" },
          ([["stack", "rows", "Pila vertical"], ["row", "columns", "Fila (Flexbox)"], ["grid", "grid", "Cuadrícula (Grid)"], ["free", "move", "Lienzo libre"]] as const).map(([v, icon, title]) =>
            h("button", { type: "button", role: "radio", class: "pf-seg__btn", dataset: { v }, title, "aria-label": title, "data-tip": title, onclick: () => ctx.ids().forEach((id) => ed.setLayout(id, v)) }, ic(icon, 15), h("span", null, { stack: "Pila", row: "Fila", grid: "Grid", free: "Libre" }[v]))));
        const r = row(ctx, "Disposición", group, { key: "layout", wide: true });
        return { el: r.el, refresh() { r.refresh(); const cur = layoutOf(); group.querySelectorAll<HTMLElement>("button").forEach((b) => { const on = b.dataset.v === cur; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); }); } };
      })();
      const hint = h("p", { class: "pf-hint" });
      const hintCtl: Ctl = { el: hint, refresh() {
        const n = ed.selected[0];
        if (!n) return;
        const base = n.s.base.layout ?? "stack";
        hint.textContent = ed.device !== "desktop" && base === "free" && layoutOf() !== "free"
          ? "En pantallas pequeñas el lienzo libre se muestra apilado por orden de posición. Elige «Libre» aquí para colocar los elementos manualmente en este tamaño."
          : layoutOf() === "free" ? "Los elementos se colocan con coordenadas. Arrástralos y usa las guías de alineación." : "Los elementos fluyen en orden y se adaptan al ancho disponible.";
      } };
      const ls = (l: string[]) => () => l.includes(layoutOf());
      const layoutSec: Ctl[] = [
        layoutCtl, hintCtl,
        cond(numStyle(ctx, { label: "Espacio entre elementos", key: "gap", min: 0, max: 200, step: 1, unit: "px" }), ls(["stack", "row", "grid"])),
        cond(numStyle(ctx, { label: "Columnas", key: "columns", min: 1, max: 12, step: 1 }), ls(["grid"])),
        cond(styleToggle(ctx, "Saltar de línea", "wrap"), ls(["row"])),
        cond(segStyle(ctx, { label: "Alinear (eje cruzado)", key: "align", def: "stretch", options: [
          { value: "start", icon: "align-top", title: "Inicio" }, { value: "center", icon: "align-vcenter", title: "Centro" }, { value: "end", icon: "align-bottom", title: "Final" }, { value: "stretch", label: "↕", title: "Estirar" }] }), ls(["stack", "row", "grid"])),
        cond(segStyle(ctx, { label: "Distribuir (eje principal)", key: "justify", def: "start", options: [
          { value: "start", label: "Inicio", title: "Al inicio" }, { value: "center", label: "Centro", title: "Centrado" }, { value: "end", label: "Final", title: "Al final" }, { value: "between", label: "Entre", title: "Espacio entre" }, { value: "around", label: "Alred.", title: "Espacio alrededor" }] , wide: true }), ls(["stack", "row", "grid"])),
        numStyle(ctx, { label: t === "section" ? "Ancho máx. del contenido" : "Ancho máximo", key: "maxWidth", min: 0, max: 4000, step: 10, unit: "px", placeholder: "Sin límite" }),
        numStyle(ctx, { label: "Altura mínima", key: "minHeight", min: 0, max: 5000, step: 10, unit: "px" }),
        styleToggle(ctx, "Recortar el contenido", "overflow" as any),
      ];
      // «overflow» es un enumerado, no un booleano: control propio
      layoutSec[layoutSec.length - 1] = toggleOverflow(ctx);
      sections.push(section("layout", "Disposición", layoutSec));
    }

    /* ----- Texto ----- */
    const textLike = all("text", "button");
    if (all("text")) {
      const styleSel = h("select", { class: "st-select st-select--sm", "aria-label": "Estilo de texto" }, h("option", { value: "" }, "Aplicar estilo…"), TEXT_STYLES.map((s) => h("option", { value: s.id }, s.label)));
      styleSel.addEventListener("change", () => { const s = TEXT_STYLES.find((x) => x.id === styleSel.value); if (s) ed.applyTextStyle(ctx.ids(), s.style, s.tag); styleSel.value = ""; });
      const tc: Ctl[] = [
        { el: row(ctx, "Estilos", styleSel).el, refresh() {} },
        propText(ctx, { label: "Contenido", key: "text", multiline: true, max: 20000 }),
        propSelect(ctx, "Etiqueta HTML", "tag", [{ value: "h1", label: "Título 1 (h1)" }, { value: "h2", label: "Título 2 (h2)" }, { value: "h3", label: "Título 3 (h3)" }, { value: "h4", label: "Título 4 (h4)" }, { value: "p", label: "Párrafo (p)" }, { value: "span", label: "Línea (span)" }, { value: "blockquote", label: "Cita" }], "p"),
      ];
      sections.push(section("textcontent", "Contenido", tc));
    }
    if (textLike || containerish || all("field")) {
      const typo: Ctl[] = [
        fontField(ctx, { label: "Tipografía", key: "font", allowTokens: true, get: () => { const s = readStyle<string>(ctx, "font"); return { value: s.value, mixed: s.mixed }; }, set: (v) => ed.setStyle(ctx.ids(), { font: v }, { label: "Tipografía" }) }),
        numStyle(ctx, { label: "Tamaño", key: "size", min: 6, max: 300, step: 1, unit: "px" }),
        selectField(ctx, { label: "Peso", key: "weight", options: [["100", "Fina 100"], ["200", "Extra ligera 200"], ["300", "Ligera 300"], ["400", "Normal 400"], ["500", "Media 500"], ["600", "Seminegrita 600"], ["700", "Negrita 700"], ["800", "Extra negrita 800"], ["900", "Black 900"]].map(([value, label]) => ({ value, label })), get: () => { const s = readStyle<number>(ctx, "weight"); return s.mixed ? "mixed" : String(s.value ?? 400); }, set: (v) => ed.setStyle(ctx.ids(), { weight: Number(v) }, { label: "Peso" }) }),
        styleColor(ctx, "Color", "color"),
        segStyle(ctx, { label: "Alineación del texto", key: "textAlign", options: [{ value: "left", icon: "text-left", title: "Izquierda" }, { value: "center", icon: "text-center", title: "Centro" }, { value: "right", icon: "text-right", title: "Derecha" }, { value: "justify", icon: "text-justify", title: "Justificado" }] }),
        numStyle(ctx, { label: "Interlineado", key: "lh", min: 0.6, max: 4, step: 0.05 }),
        numStyle(ctx, { label: "Espacio entre letras", key: "ls", min: -10, max: 40, step: 0.1, unit: "px" }),
        segStyle(ctx, { label: "Mayúsculas", key: "transform", def: "none", options: [{ value: "none", label: "Aa", title: "Normal" }, { value: "uppercase", label: "AA", title: "MAYÚSCULAS" }, { value: "lowercase", label: "aa", title: "minúsculas" }, { value: "capitalize", label: "Ab", title: "Capitalizar" }] }),
        styleToggle(ctx, "Cursiva", "italic"),
        styleToggle(ctx, "Subrayado", "underline"),
      ];
      sections.push(section("typo", containerish ? "Tipografía heredable" : "Tipografía", typo, { open: !containerish }));
    }
    if (all("text")) {
      sections.push(section("textlink", "Enlace", linkField(ctx, "Convertir en enlace"), { open: false }));
    }

    /* ----- Botón ----- */
    if (all("button")) {
      const hoverMode = () => ed.s.uiState === "hover";
      const stateSeg = h("div", { class: "pf-seg", role: "radiogroup", "aria-label": "Estado del botón" },
        [["normal", "Normal"], ["hover", "Hover"]].map(([v, l]) => h("button", { type: "button", role: "radio", class: "pf-seg__btn", dataset: { v }, onclick: () => ed.store.set({ uiState: v as "normal" | "hover" }) }, h("span", null, l))));
      const stateRow = row(ctx, "Estado", stateSeg);
      const hoverColor = (label: string, key: "bg" | "color"): Ctl => colorField(ctx, {
        label: `${label} (hover)`, allowNone: key === "bg",
        get: () => { const nodes = ed.selected; const v = nodes[0]?.hover?.[key]; const fallback = resolveStyle(nodes[0], ed.device)[key]; return { value: typeof (v ?? fallback) === "string" ? ((v ?? fallback) as string) : undefined, mixed: false }; },
        set: (v, final) => ed.setHover(ctx.ids(), { [key]: v ?? undefined }, { coalesce: final ? undefined : `hover:${key}` }),
      });
      const hoverBorder = colorField(ctx, {
        label: "Borde (hover)", allowNone: true,
        get: () => { const b = ed.selected[0]?.hover?.border as Border | undefined; return { value: b?.color, mixed: false }; },
        set: (v, final) => { const base = (resolveStyle(ed.selected[0], ed.device).border as Border | null) ?? { w: 1, color: "#ffffff", style: "solid" as const }; ed.setHover(ctx.ids(), { border: v ? { ...base, color: v } : undefined }, { coalesce: final ? undefined : "hover:border" }); },
      });
      const bc: Ctl[] = [
        propText(ctx, { label: "Texto", key: "text", max: 200 }),
        buttonIconField(ctx),
        cond(propSelect(ctx, "Posición del icono", "iconPos", [{ value: "left", label: "Izquierda" }, { value: "right", label: "Derecha" }], "left"), () => !!readProp(ctx, "icon").value),
        { el: stateRow.el, refresh() { stateRow.refresh(); stateSeg.querySelectorAll<HTMLElement>("button").forEach((b) => { const on = (b.dataset.v === "hover") === hoverMode(); b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); }); } },
        cond(styleColor(ctx, "Fondo", "bg", true), () => !hoverMode()),
        cond(styleColor(ctx, "Color del texto", "color"), () => !hoverMode()),
        cond(hoverColor("Fondo", "bg"), hoverMode),
        cond(hoverColor("Texto", "color"), hoverMode),
        cond(hoverBorder, hoverMode),
        propToggle(ctx, "Deshabilitado", "disabled", "Aspecto atenuado y sin acción."),
        propToggle(ctx, "Botón de envío del formulario", "submit"),
      ];
      sections.push(section("button", "Botón", bc));
      sections.push(section("buttonlink", "Enlace del botón", linkField(ctx, "Destino"), { open: true }));
    }

    /* ----- Imagen / vídeo / icono ----- */
    if (all("image")) {
      const ic2: Ctl[] = [
        imageSourceField(ctx, { key: "src", label: "Imagen", kind: "image" }),
        propText(ctx, { label: "Texto alternativo", key: "alt", max: 300, placeholder: "Describe la imagen" }),
        segStyle(ctx, { label: "Ajuste", key: "fit", def: "cover", options: [{ value: "cover", label: "Cubrir", title: "Cubrir el marco (recorta)" }, { value: "contain", label: "Contener", title: "Mostrar completa" }, { value: "fill", label: "Estirar", title: "Estirar al marco" }] }),
        focalField(ctx),
        propSlider(ctx, { label: "Recorte (zoom)", key: "zoom", min: 1, max: 4, step: 0.05, def: 1 }),
        ratioField(ctx),
      ];
      sections.push(section("image", "Imagen", ic2));
      sections.push(section("imglink", "Enlace", linkField(ctx, "Al hacer clic"), { open: false }));
    }
    if (all("video")) {
      sections.push(section("video", "Vídeo", [
        imageSourceField(ctx, { key: "src", label: "Archivo de vídeo", kind: "video" }),
        imageSourceField(ctx, { key: "poster", label: "Imagen de portada", kind: "image" }),
        propText(ctx, { label: "Título accesible", key: "title", max: 200 }),
        propToggle(ctx, "Mostrar controles", "controls"),
        propToggle(ctx, "Reproducción automática (silenciado)", "autoplay"),
        propToggle(ctx, "Repetir", "loop"),
        propToggle(ctx, "Silenciar", "muted"),
        segStyle(ctx, { label: "Ajuste", key: "fit", def: "cover", options: [{ value: "cover", label: "Cubrir", title: "Cubrir" }, { value: "contain", label: "Contener", title: "Contener" }] }),
        ratioField(ctx),
      ]));
    }
    if (all("icon")) {
      sections.push(section("icon", "Icono", [
        iconPickerField(ctx),
        styleColor(ctx, "Color", "color"),
        sizeBoth(ctx),
        propSlider(ctx, { label: "Grosor del trazo", key: "stroke", min: 0.5, max: 4, step: 0.25, def: 2 }),
        propText(ctx, { label: "Etiqueta accesible", key: "label", max: 120, placeholder: "Opcional" }),
      ]));
    }
    if (all("shape")) sections.push(section("shape", "Forma", [propSelect(ctx, "Tipo", "shape", [{ value: "rect", label: "Rectángulo" }, { value: "ellipse", label: "Círculo / elipse" }, { value: "line", label: "Línea" }], "rect")]));

    /* ----- Formularios ----- */
    if (all("form")) {
      sections.push(section("form", "Formulario", [
        propSelect(ctx, "Al enviar", "mode", [{ value: "whatsapp", label: "Abrir WhatsApp" }, { value: "mailto", label: "Abrir correo" }], "whatsapp"),
        propText(ctx, { label: "Destino (número o correo)", key: "to", max: 120, placeholder: "573001112233 o hola@tusitio.com", validate: (v) => v.replace(/[^\w@.+\-]/g, "") }),
        propText(ctx, { label: "Mensaje de éxito", key: "successText", max: 300 }),
        { el: h("p", { class: "pf-hint" }, "Los formularios del sitio exportado no envían datos a un servidor: preparan el mensaje en WhatsApp o en el correo del visitante."), refresh() {} },
      ]));
    }
    if (all("field")) {
      sections.push(section("field", "Campo", [
        propText(ctx, { label: "Etiqueta", key: "label", max: 120 }),
        propSelect(ctx, "Tipo", "kind", [{ value: "text", label: "Texto" }, { value: "email", label: "Correo" }, { value: "tel", label: "Teléfono" }, { value: "number", label: "Número" }, { value: "textarea", label: "Párrafo" }], "text"),
        propText(ctx, { label: "Nombre interno", key: "name", max: 40, validate: (v) => v.replace(/[^a-z0-9_]/gi, "_") }),
        propText(ctx, { label: "Texto de ayuda", key: "placeholder", max: 120 }),
        propToggle(ctx, "Obligatorio", "required"),
      ]));
    }

    /* ----- Relleno, borde, sombra, espaciado ----- */
    if (any("section", "container", "form", "root", "button", "shape", "divider", "field", "icon", "text") && !all("image", "video")) {
      const bgAllowed = all("section", "container", "form", "root", "button", "shape", "divider", "text");
      if (bgAllowed) sections.push(section("fill", all("text") ? "Resaltado (fondo)" : "Relleno", fillField(ctx, { image: all("section", "container", "form", "root") }), { open: containerish || all("shape", "divider") }));
    }
    const hasBorder = !all("icon", "divider");
    if (hasBorder) {
      const bw = numBorder(ctx);
      const sections2: Ctl[] = [
        bw.w, bw.style, bw.color,
        sliderStyle(ctx, { label: "Radio de esquinas", key: "radius", min: 0, max: 200, step: 1, def: 0 }),
      ];
      sections.push(section("border", "Borde y esquinas", sections2, { open: false }));
      sections.push(section("shadow", "Sombra", shadowField(ctx), { open: false }));
    }
    if (!all("icon", "divider")) {
      const sp: Ctl[] = [];
      if (!all("image", "video", "shape")) sp.push(sidesStyle(ctx, "Relleno interno (padding)", "padding"));
      sp.push(cond(sidesStyle(ctx, "Margen", "margin"), () => !freeChild()));
      sections.push(section("spacing", "Espaciado", sp, { open: all("button", "container", "section", "form") }));
    }

    /* ----- Animación ----- */
    sections.push(section("anim", "Animación", this.animControls(ctx), { open: false }));

    /* ----- Responsive ----- */
    sections.push(section("responsive", "Responsive", this.responsiveControls(ctx), { open: false }));

    /* ----- Avanzado ----- */
    if (single) sections.push(section("advanced", "Avanzado", this.advancedControls(ctx, nodes[0]), { open: false }));

    this.body.replaceChildren(head, ...sections.map((s) => s.el));
    this.parts = sections;
  }

  private animControls(ctx: PanelCtx): Ctl[] {
    const ed = this.ed;
    const cur = (): any => ed.selected[0]?.anim ?? { type: "none", trigger: "scroll", duration: 700, delay: 0, intensity: 50, stagger: false, hover: "none" };
    const has = (): boolean => (ed.selected.length === 1 ? cur().type !== "none" : false);
    const set = (patch: Record<string, unknown>) => ed.setAnim(ctx.ids(), patch);
    const typeSel = selectField(ctx, {
      label: "Entrada", options: [["none", "Sin animación"], ["fade", "Aparecer (fundido)"], ["slide-up", "Deslizar hacia arriba"], ["slide-down", "Deslizar hacia abajo"], ["slide-left", "Deslizar desde la izquierda"], ["slide-right", "Deslizar desde la derecha"], ["scale", "Escala de entrada"], ["zoom-out", "Zoom suave"], ["blur", "Desenfoque"], ["rotate", "Giro"]].map(([value, label]) => ({ value, label })),
      get: () => (ctx.nodes().length === 1 ? cur().type : "mixed"), set: (v) => set({ type: v }),
    });
    const sl = (label: string, k: string, min: number, max: number, step: number, unit: string): Ctl => {
      const range = h("input", { type: "range", class: "pf-range", min: String(min), max: String(max), step: String(step), "aria-label": label });
      const num = h("input", { type: "number", class: "st-input st-input--sm pf-num pf-num--s", min: String(min), max: String(max), step: String(step), "aria-label": `${label} (valor)` });
      const r = row(ctx, label, h("div", { class: "pf-slider" }, range, num, h("span", { class: "pf-unit" }, unit)));
      range.addEventListener("input", () => { num.value = range.value; set({ [k]: Number(range.value) }); });
      num.addEventListener("input", () => { if (num.value !== "") { range.value = num.value; set({ [k]: clamp(Number(num.value), min, max) }); } });
      return { el: r.el, refresh() { const v = cur()[k]; if (document.activeElement !== num) num.value = String(v); range.value = String(v); } };
    };
    const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
    const play = h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => this.playAnim(ctx.ids()[0]) }, ic("play", 13), "Probar animación");
    const trigger = selectField(ctx, { label: "Cuándo", options: [{ value: "scroll", label: "Al aparecer en pantalla (scroll)" }, { value: "load", label: "Al cargar la página" }], get: () => (ctx.nodes().length === 1 ? cur().trigger : "mixed"), set: (v) => set({ trigger: v }) });
    const note = h("p", { class: "pf-hint" });
    return [
      { el: note, refresh() { note.hidden = ed.doc.settings.animations; note.textContent = "Las animaciones están desactivadas para todo el sitio (Ajustes del sitio)."; } },
      typeSel,
      cond(trigger, has),
      cond(sl("Duración", "duration", 100, 3000, 50, "ms"), has),
      cond(sl("Retraso", "delay", 0, 3000, 50, "ms"), has),
      cond(sl("Intensidad", "intensity", 0, 100, 5, "%"), () => has() && !["fade"].includes(cur().type)),
      cond(toggleAnim(ctx, "Escalonar a los hijos", () => !!cur().stagger, (v) => set({ stagger: v })), () => ctx.nodes().length === 1 && ctx.nodes()[0].children.length > 1),
      selectField(ctx, { label: "Al pasar el cursor", options: [["none", "Ninguno"], ["lift", "Elevar"], ["grow", "Crecer"], ["shrink", "Encoger"], ["glow", "Resplandor"]].map(([value, label]) => ({ value, label })), get: () => (ctx.nodes().length === 1 ? cur().hover : "mixed"), set: (v) => set({ hover: v }) }),
      { el: h("div", { class: "pf-row pf-row--wide" }, play), refresh() { play.hidden = !has(); } },
    ];
  }

  private responsiveControls(ctx: PanelCtx): Ctl[] {
    const ed = this.ed;
    const checks = h("div", { class: "pf-devs", role: "group", "aria-label": "Mostrar en dispositivos" }, DEVICES.map((d) => {
      const input = h("input", { type: "checkbox", id: `pf-dev-${d}`, dataset: { d } });
      input.addEventListener("change", () => {
        // Se escribe en la capa del dispositivo: `hide: true` oculta, `false` muestra aunque lo herede oculto.
        const hide = !input.checked;
        ed.commit("Visibilidad por dispositivo", (tx) => { for (const id of ctx.ids()) tx.setStyle(id, d, { hide: hide ? true : (d === "desktop" ? undefined : false) }); });
      });
      return h("label", { for: `pf-dev-${d}` }, input, ic(d, 15), h("span", null, DEVICE_LABEL[d]));
    }));
    const r = row(ctx, "Mostrar en", checks, { wide: true });
    const reset = h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => {
      const d = ed.device;
      if (d === "desktop") return;
      ed.commit("Restablecer dispositivo", (tx) => { for (const id of ctx.ids()) { const n = tx.node(id); delete n.s[d]; } });
      toast(`Se restablecieron los ajustes específicos de ${DEVICE_LABEL[d]}.`, "info", 1800);
    } }, ic("undo", 13), "Restablecer ajustes de este dispositivo");
    const info = h("p", { class: "pf-hint" }, "Lo que cambias en Escritorio se hereda en Tableta y Móvil. Al editar en Tableta o Móvil, solo se guarda la diferencia.");
    return [
      { el: r.el, refresh() { const nodes = ctx.nodes(); checks.querySelectorAll<HTMLInputElement>("input").forEach((inp) => { const d = inp.dataset.d as Device; const hidden = nodes.every((n) => resolveStyle(n, d).hide); const mixed = nodes.some((n) => !!resolveStyle(n, d).hide) && !hidden; inp.checked = !hidden; inp.indeterminate = mixed; }); } },
      { el: info, refresh() {} },
      { el: h("div", { class: "pf-row pf-row--wide" }, reset), refresh() { reset.hidden = ed.device === "desktop"; reset.disabled = !ctx.nodes().some((n) => Object.keys(n.s[ed.device as "tablet" | "mobile"] ?? {}).length); } },
    ];
  }

  private advancedControls(ctx: PanelCtx, node: Node): Ctl[] {
    const ed = this.ed;
    const mk = (label: string, key: "elId" | "className" | "css", multi = false, ph = ""): Ctl => {
      const input = multi ? h("textarea", { class: "st-input st-textarea", rows: "4", spellcheck: "false", placeholder: ph, "aria-label": label }) : h("input", { class: "st-input st-input--sm", type: "text", spellcheck: "false", placeholder: ph, "aria-label": label });
      const r = row(ctx, label, input, { wide: multi });
      input.addEventListener("change", () => {
        let v = (input as HTMLInputElement).value;
        if (key === "elId") { v = v.trim().replace(/[^A-Za-z0-9_-]/g, ""); if (/^[0-9-]/.test(v)) v = "s" + v; if (v && ed.doc.pages.some((p) => Object.values(ed.doc.nodes).some((o) => o.id !== node.id && o.attrs?.elId === v))) { toast("Ese identificador ya está en uso.", "error"); v = ""; } }
        if (key === "className") v = v.split(/\s+/).filter((c) => /^[A-Za-z_][\w-]{0,40}$/.test(c)).join(" ");
        ed.setAttrs(node.id, { [key]: v });
      });
      return { el: r.el, refresh() { if (document.activeElement !== input) (input as HTMLInputElement).value = ed.node(node.id)?.attrs?.[key] ?? ""; } };
    };
    return [
      mk("Identificador (id)", "elId", false, "contacto"),
      mk("Clases CSS", "className", false, "mi-clase otra-clase"),
      mk("CSS personalizado", "css", true, "color: red;\nletter-spacing: 1px;"),
      { el: h("p", { class: "pf-hint" }, "Solo se admiten declaraciones simples «propiedad: valor;». Se ignoran url(), @import, llaves y scripts, y solo afectan a este elemento."), refresh() {} },
    ];
  }
}

/* ---------- Auxiliares de panel ---------- */

function toggleOverflow(ctx: PanelCtx): Ctl {
  const input = h("input", { type: "checkbox", class: "pf-switch", role: "switch", "aria-label": "Recortar el contenido" });
  input.addEventListener("change", () => ctx.ed.setStyle(ctx.ids(), { overflow: input.checked ? "hidden" : undefined }, { label: "Recortar contenido" }));
  const r = row(ctx, "Recortar el contenido", h("label", { class: "pf-switchwrap" }, input, h("span", { class: "pf-switch__ui" })), { key: "overflow" });
  return { el: r.el, refresh() { r.refresh(); input.checked = readStyle<string>(ctx, "overflow").value === "hidden"; } };
}

function toggleAnim(ctx: PanelCtx, label: string, get: () => boolean, set: (v: boolean) => void): Ctl {
  const input = h("input", { type: "checkbox", class: "pf-switch", role: "switch", "aria-label": label });
  input.addEventListener("change", () => set(input.checked));
  const r = row(ctx, label, h("label", { class: "pf-switchwrap" }, input, h("span", { class: "pf-switch__ui" })));
  return { el: r.el, refresh() { input.checked = get(); } };
}

function ratioField(ctx: PanelCtx): Ctl {
  const opts = [["1.7778", "16:9"], ["1.5", "3:2"], ["1.3333", "4:3"], ["1", "1:1"], ["0.75", "3:4"], ["0.6667", "2:3"], ["2.3333", "21:9"], ["2", "2:1"]];
  return selectField(ctx, {
    label: "Proporción", options: opts.map(([value, label]) => ({ value, label })),
    get: () => { const s = readProp<number>(ctx, "ratio"); if (s.mixed) return "mixed"; const v = Number(s.value ?? 1.5); const m = opts.find(([x]) => Math.abs(Number(x) - v) < 0.01); return m ? m[0] : opts[1][0]; },
    set: (v) => ctx.ed.setProps(ctx.ids(), { ratio: Number(v) }, { label: "Proporción" }),
  });
}

function sizeBoth(ctx: PanelCtx): Ctl {
  const input = h("input", { class: "st-input st-input--sm pf-num", type: "number", min: "8", max: "600", "aria-label": "Tamaño del icono" });
  const r = row(ctx, "Tamaño", h("div", { class: "pf-numwrap" }, input, h("span", { class: "pf-unit" }, "px")));
  input.addEventListener("input", () => { const v = Math.max(8, Math.min(600, Number(input.value) || 24)); ctx.ed.setStyle(ctx.ids(), { w: v, h: v }, { coalesce: "iconsize" }); });
  return { el: r.el, refresh() { const w = readStyle<any>(ctx, "w").value; if (document.activeElement !== input) input.value = typeof w === "number" ? String(Math.round(w)) : ""; } };
}

function numBorder(ctx: PanelCtx): { w: Ctl; style: Ctl; color: Ctl } {
  const cur = (): Border | null => readStyle<Border | null>(ctx, "border").value ?? null;
  const write = (patch: Partial<Border>, coalesce?: string) => {
    const b = cur() ?? { w: 1, color: "$muted", style: "solid" as const };
    const next = { ...b, ...patch };
    ctx.ed.setStyle(ctx.ids(), { border: next.w > 0 ? next : null }, { label: "Borde", coalesce });
  };
  const input = h("input", { class: "st-input st-input--sm pf-num", type: "number", min: "0", max: "40", "aria-label": "Grosor del borde" });
  const w = row(ctx, "Grosor", h("div", { class: "pf-numwrap" }, input, h("span", { class: "pf-unit" }, "px")), { key: "border" });
  input.addEventListener("input", () => write({ w: Math.max(0, Math.min(40, Number(input.value) || 0)) }, "border:w"));
  const style = selectField(ctx, { label: "Estilo", options: [{ value: "solid", label: "Continuo" }, { value: "dashed", label: "Guiones" }, { value: "dotted", label: "Puntos" }], get: () => cur()?.style ?? "solid", set: (v) => write({ style: v as Border["style"] }) });
  const color = colorField(ctx, { label: "Color del borde", get: () => ({ value: cur()?.color, mixed: false }), set: (v, final) => v && write({ color: v }, final ? undefined : "border:c") });
  return {
    w: { el: w.el, refresh() { w.refresh(); if (document.activeElement !== input) input.value = String(cur()?.w ?? 0); } },
    style, color,
  };
}

export type { Fill };
