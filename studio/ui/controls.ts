/** Controles reutilizables del panel de propiedades. Cada control sabe leer y escribir en la selección actual. */
import { FONTS, googleFontsPreviewUrl, fontInfo } from "../../shared/model/fonts";
import { ICON_NAMES, ICONS } from "../../shared/model/icons";
import { isGradient, isOverridden, literalColor, resolveStyle, cssColor } from "../../shared/model/style";
import { Device, Fill, Node, PartialStyle, Shadow, Sides } from "../../shared/model/types";
import { Editor } from "../core/editor";
import { clamp, h, ic, popover } from "../lib/dom";
import { pickAsset } from "./assets";
import { openColorPicker } from "./colorpicker";

export interface PanelCtx {
  ed: Editor;
  nodes: () => Node[];
  ids: () => string[];
  device: () => Device;
}

export interface Ctl { el: HTMLElement; refresh(): void }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Lee un valor de estilo en toda la selección (mixto si no coincide). */
export function readStyle<T = any>(ctx: PanelCtx, key: keyof PartialStyle): { value: T | undefined; mixed: boolean; overridden: boolean } {
  const nodes = ctx.nodes();
  const dev = ctx.device();
  const vals = nodes.map((n) => (resolveStyle(n, dev) as any)[key]);
  const mixed = vals.some((v) => !same(v, vals[0]));
  return { value: vals[0], mixed, overridden: dev !== "desktop" && nodes.length > 0 && nodes.every((n) => isOverridden(n, dev, key as string)) };
}

export function readProp<T = any>(ctx: PanelCtx, key: string): { value: T | undefined; mixed: boolean } {
  const vals = ctx.nodes().map((n) => n.props[key]);
  return { value: vals[0], mixed: vals.some((v) => !same(v, vals[0])) };
}

/* ---------- Fila con etiqueta y restablecimiento ---------- */

export interface RowOpts { key?: string; wide?: boolean; hint?: string; labelFor?: HTMLElement }

export function row(ctx: PanelCtx, label: string, control: HTMLElement, opts: RowOpts = {}): Ctl {
  const dot = h("button", { type: "button", class: "pf-reset", "aria-label": `Restablecer «${label}» al valor heredado`, "data-tip": "Restablecer al valor heredado", hidden: true, onclick: () => ctx.ed.setStyle(ctx.ids(), { [opts.key!]: undefined }, { label: "Restablecer estilo" }) }, ic("undo", 11));
  const lab = h("span", { class: "pf-label" }, label, dot);
  const el = h("div", { class: `pf-row${opts.wide ? " pf-row--wide" : ""}` }, lab, control);
  if (opts.hint) el.title = opts.hint;
  return {
    el,
    refresh() {
      if (!opts.key) return;
      const r = readStyle(ctx, opts.key as keyof PartialStyle);
      dot.hidden = !r.overridden;
      el.classList.toggle("is-overridden", r.overridden);
    },
  };
}

/** Hace que arrastrar sobre la etiqueta cambie el número (como en Figma). */
function scrub(label: HTMLElement, input: HTMLInputElement, step: number, onInput: () => void): void {
  label.style.cursor = "ew-resize";
  label.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    label.setPointerCapture(e.pointerId);
    const start = Number(input.value) || 0;
    const x0 = e.clientX;
    const move = (ev: PointerEvent) => {
      const d = Math.round((ev.clientX - x0) / 3) * (ev.shiftKey ? step * 10 : step);
      input.value = String(Math.round((start + d) * 100) / 100);
      onInput();
    };
    const up = () => { label.removeEventListener("pointermove", move); label.removeEventListener("pointerup", up); input.dispatchEvent(new Event("change")); };
    label.addEventListener("pointermove", move);
    label.addEventListener("pointerup", up);
  });
}

/* ---------- Número ---------- */

export interface NumOpts { label: string; key: keyof PartialStyle; min?: number; max?: number; step?: number; unit?: string; scale?: number; placeholder?: string; wide?: boolean; coalesce?: string }

export function numStyle(ctx: PanelCtx, o: NumOpts): Ctl {
  const scale = o.scale ?? 1;
  const input = h("input", { class: "st-input st-input--sm pf-num", type: "number", step: String(o.step ?? 1), min: o.min !== undefined ? String(o.min) : undefined, max: o.max !== undefined ? String(o.max) : undefined, "aria-label": o.label, placeholder: o.placeholder ?? "" });
  const unit = o.unit ? h("span", { class: "pf-unit" }, o.unit) : null;
  const wrap = h("div", { class: "pf-numwrap" }, input, unit);
  const r = row(ctx, o.label, wrap, { key: o.key as string });
  const commit = () => {
    if (input.value === "") { ctx.ed.setStyle(ctx.ids(), { [o.key]: undefined }, { coalesce: `num:${o.key}` }); return; }
    let v = Number(input.value);
    if (!Number.isFinite(v)) return;
    v = clamp(v, o.min ?? -Infinity, o.max ?? Infinity);
    ctx.ed.setStyle(ctx.ids(), { [o.key]: Math.round((v / scale) * 1000) / 1000 }, { coalesce: o.coalesce ?? `num:${o.key}` });
  };
  input.addEventListener("input", commit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  scrub(r.el.querySelector(".pf-label") as HTMLElement, input, o.step ?? 1, commit);
  return {
    el: r.el,
    refresh() {
      r.refresh();
      const s = readStyle<number>(ctx, o.key);
      if (document.activeElement !== input) input.value = s.mixed ? "" : s.value === undefined || typeof s.value !== "number" ? "" : String(Math.round(s.value * scale * 100) / 100);
      input.placeholder = s.mixed ? "Mixto" : o.placeholder ?? "";
    },
  };
}

/* ---------- Dimensión (px, %, auto, llenar) ---------- */

export function dimStyle(ctx: PanelCtx, label: string, key: "w" | "h", autoLabel = "Auto"): Ctl {
  const sel = h("select", { class: "st-select st-select--sm", "aria-label": `${label}: modo` },
    h("option", { value: "px" }, "px"), h("option", { value: "%" }, "%"), h("option", { value: "auto" }, autoLabel), h("option", { value: "fill" }, "Llenar"));
  const input = h("input", { class: "st-input st-input--sm pf-num", type: "number", min: "0", step: "1", "aria-label": label });
  const wrap = h("div", { class: "pf-dim" }, input, sel);
  const r = row(ctx, label, wrap, { key });
  const apply = (final: boolean) => {
    const mode = sel.value;
    let v: any;
    if (mode === "auto" || mode === "fill") v = mode;
    else if (input.value === "") return;
    else v = mode === "%" ? `${clamp(Number(input.value), 0, 1000)}%` : Math.max(0, Number(input.value));
    ctx.ed.setStyle(ctx.ids(), { [key]: v }, { coalesce: `dim:${key}${final ? "" : ""}` });
  };
  input.addEventListener("input", () => apply(false));
  sel.addEventListener("change", () => {
    if (sel.value === "px" && input.value === "") input.value = String(Math.round(ctx.nodes()[0] ? ctx.ed.measure(ctx.ids()[0])?.[key] ?? 100 : 100));
    if (sel.value === "%" && input.value === "") input.value = "100";
    apply(true);
  });
  scrub(r.el.querySelector(".pf-label") as HTMLElement, input, 1, () => apply(false));
  return {
    el: r.el,
    refresh() {
      r.refresh();
      const s = readStyle<any>(ctx, key);
      const v = s.value;
      const defaultMode = key === "w" ? ctx.nodes().every((n) => n.type === "image" || n.type === "video" || n.type === "divider") ? "fill" : "auto" : "auto";
      if (document.activeElement === input) return;
      if (s.mixed) { sel.value = "px"; input.value = ""; input.placeholder = "Mixto"; return; }
      input.placeholder = "";
      if (v === undefined) { sel.value = defaultMode; input.value = ""; }
      else if (v === "auto" || v === "fill") { sel.value = v; input.value = ""; }
      else if (typeof v === "string") { sel.value = "%"; input.value = String(parseFloat(v)); }
      else { sel.value = "px"; input.value = String(Math.round(v)); }
      input.disabled = sel.value === "auto" || sel.value === "fill";
    },
  };
}

/* ---------- Deslizador ---------- */

export function sliderStyle(ctx: PanelCtx, o: { label: string; key: keyof PartialStyle; min: number; max: number; step: number; scale?: number; unit?: string; def?: number }): Ctl {
  const scale = o.scale ?? 1;
  const range = h("input", { type: "range", class: "pf-range", min: String(o.min), max: String(o.max), step: String(o.step), "aria-label": o.label });
  const num = h("input", { type: "number", class: "st-input st-input--sm pf-num pf-num--s", min: String(o.min), max: String(o.max), step: String(o.step), "aria-label": `${o.label} (valor)` });
  const r = row(ctx, o.label, h("div", { class: "pf-slider" }, range, num), { key: o.key as string });
  const commit = (v: number) => ctx.ed.setStyle(ctx.ids(), { [o.key]: Math.round((clamp(v, o.min, o.max) / scale) * 1000) / 1000 }, { coalesce: `slider:${o.key}` });
  range.addEventListener("input", () => { num.value = range.value; commit(Number(range.value)); });
  num.addEventListener("input", () => { if (num.value !== "") { range.value = num.value; commit(Number(num.value)); } });
  return {
    el: r.el,
    refresh() {
      r.refresh();
      const s = readStyle<number>(ctx, o.key);
      const v = s.mixed ? o.def ?? o.min : typeof s.value === "number" ? s.value * scale : o.def ?? o.min;
      if (document.activeElement !== num) num.value = String(Math.round(v * 100) / 100);
      range.value = String(v);
    },
  };
}

/* ---------- Segmentado / selección / interruptor ---------- */

export interface SegOpt { value: string; label?: string; icon?: string; title: string }

export function segStyle(ctx: PanelCtx, o: { label: string; key: keyof PartialStyle; options: SegOpt[]; def?: string; wide?: boolean }): Ctl {
  const group = h("div", { class: "pf-seg", role: "radiogroup", "aria-label": o.label },
    o.options.map((op) => h("button", {
      type: "button", role: "radio", class: "pf-seg__btn", dataset: { v: op.value }, title: op.title, "aria-label": op.title, "data-tip": op.title,
      onclick: () => ctx.ed.setStyle(ctx.ids(), { [o.key]: op.value }, { label: o.label }),
    }, op.icon ? ic(op.icon, 15) : null, op.label ? h("span", null, op.label) : null)));
  const r = row(ctx, o.label, group, { key: o.key as string, wide: o.wide });
  return {
    el: r.el,
    refresh() {
      r.refresh();
      const s = readStyle<string>(ctx, o.key);
      const cur = s.mixed ? undefined : s.value ?? o.def;
      group.querySelectorAll<HTMLElement>("button").forEach((b) => { const on = b.dataset.v === cur; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); });
    },
  };
}

export function selectField(ctx: PanelCtx, o: { label: string; options: { value: string; label: string }[]; get: () => string | undefined | "mixed"; set: (v: string) => void; key?: string }): Ctl {
  const sel = h("select", { class: "st-select st-select--sm", "aria-label": o.label }, o.options.map((op) => h("option", { value: op.value }, op.label)));
  sel.addEventListener("change", () => o.set(sel.value));
  const r = row(ctx, o.label, sel, { key: o.key });
  return { el: r.el, refresh() { r.refresh(); const v = o.get(); if (document.activeElement !== sel) sel.value = v === "mixed" || v === undefined ? o.options[0].value : v; } };
}

export function toggleField(ctx: PanelCtx, o: { label: string; get: () => boolean | "mixed"; set: (v: boolean) => void; hint?: string; key?: string }): Ctl {
  const input = h("input", { type: "checkbox", class: "pf-switch", role: "switch", "aria-label": o.label });
  input.addEventListener("change", () => o.set(input.checked));
  const r = row(ctx, o.label, h("label", { class: "pf-switchwrap" }, input, h("span", { class: "pf-switch__ui" })), { hint: o.hint, key: o.key });
  return { el: r.el, refresh() { r.refresh(); const v = o.get(); input.checked = v === true; input.indeterminate = v === "mixed"; } };
}

export function styleToggle(ctx: PanelCtx, label: string, key: keyof PartialStyle): Ctl {
  return toggleField(ctx, {
    label, key: key as string,
    get: () => { const s = readStyle<boolean>(ctx, key); return s.mixed ? "mixed" : !!s.value; },
    set: (v) => ctx.ed.setStyle(ctx.ids(), { [key]: v ? true : undefined }, { label }),
  });
}

/* ---------- Texto ---------- */

export function propText(ctx: PanelCtx, o: { label: string; key: string; multiline?: boolean; placeholder?: string; max?: number; validate?: (v: string) => string }): Ctl {
  const input = o.multiline
    ? h("textarea", { class: "st-input st-textarea", rows: "3", "aria-label": o.label, placeholder: o.placeholder ?? "" })
    : h("input", { class: "st-input st-input--sm", type: "text", "aria-label": o.label, placeholder: o.placeholder ?? "", maxlength: String(o.max ?? 300) });
  input.addEventListener("input", () => {
    const v = o.validate ? o.validate(input.value) : input.value;
    ctx.ed.setProps(ctx.ids(), { [o.key]: v }, { coalesce: `prop:${o.key}`, label: o.label });
  });
  const r = row(ctx, o.label, input, { wide: o.multiline });
  return {
    el: r.el,
    refresh() { const s = readProp<string>(ctx, o.key); if (document.activeElement !== input) input.value = s.mixed ? "" : String(s.value ?? ""); (input as HTMLInputElement).placeholder = s.mixed ? "Mixto" : o.placeholder ?? ""; },
  };
}

export function propToggle(ctx: PanelCtx, label: string, key: string, hint?: string): Ctl {
  return toggleField(ctx, { label, hint, get: () => { const s = readProp<boolean>(ctx, key); return s.mixed ? "mixed" : !!s.value; }, set: (v) => ctx.ed.setProps(ctx.ids(), { [key]: v }, { label }) });
}

export function propSelect(ctx: PanelCtx, label: string, key: string, options: { value: string; label: string }[], def?: string): Ctl {
  return selectField(ctx, { label, options, get: () => { const s = readProp<string>(ctx, key); return s.mixed ? "mixed" : s.value ?? def; }, set: (v) => ctx.ed.setProps(ctx.ids(), { [key]: v }, { label }) });
}

export function propSlider(ctx: PanelCtx, o: { label: string; key: string; min: number; max: number; step: number; def: number }): Ctl {
  const range = h("input", { type: "range", class: "pf-range", min: String(o.min), max: String(o.max), step: String(o.step), "aria-label": o.label });
  const num = h("input", { type: "number", class: "st-input st-input--sm pf-num pf-num--s", min: String(o.min), max: String(o.max), step: String(o.step), "aria-label": `${o.label} (valor)` });
  const r = row(ctx, o.label, h("div", { class: "pf-slider" }, range, num));
  const commit = (v: number) => ctx.ed.setProps(ctx.ids(), { [o.key]: clamp(v, o.min, o.max) }, { coalesce: `prop:${o.key}`, label: o.label });
  range.addEventListener("input", () => { num.value = range.value; commit(Number(range.value)); });
  num.addEventListener("input", () => { if (num.value !== "") { range.value = num.value; commit(Number(num.value)); } });
  return { el: r.el, refresh() { const s = readProp<number>(ctx, o.key); const v = s.mixed ? o.def : Number(s.value ?? o.def); if (document.activeElement !== num) num.value = String(v); range.value = String(v); } };
}

/* ---------- Color ---------- */

export interface ColorOpts { label: string; get: () => { value: string | null | undefined; mixed: boolean; overridden?: boolean }; set: (v: string | null, final: boolean) => void; allowNone?: boolean; key?: string }

export function colorField(ctx: PanelCtx, o: ColorOpts): Ctl {
  const sw = h("button", { type: "button", class: "pf-swatch", "aria-label": `${o.label}: abrir selector de color` }, h("i"));
  const hex = h("input", { class: "st-input st-input--sm", type: "text", "aria-label": `${o.label} (valor)`, spellcheck: "false", maxlength: "40" });
  const tok = h("span", { class: "pf-token", hidden: true, title: "Vinculado a un color global" }, ic("link", 11));
  const wrap = h("div", { class: "pf-color" }, sw, hex, tok);
  const r = row(ctx, o.label, wrap, { key: o.key });
  sw.addEventListener("click", () => {
    const cur = o.get();
    openColorPicker(sw, {
      value: cur.mixed ? null : cur.value ?? null, theme: ctx.ed.doc.theme, saved: ctx.ed.doc.savedColors, allowNone: o.allowNone,
      onChange: (v, final) => o.set(v, final), onSave: (c) => ctx.ed.saveColor(c),
    });
  });
  hex.addEventListener("change", () => {
    const v = hex.value.trim();
    if (!v && o.allowNone) { o.set(null, true); return; }
    const t = v.startsWith("$") || v.startsWith("#") || v.startsWith("rgb") ? v : "#" + v;
    if (/^(#[0-9a-f]{3,8}|rgba?\(.+\)|\$[a-z0-9_-]+)$/i.test(t)) o.set(t, true);
    else hex.value = o.get().value ?? "";
  });
  hex.addEventListener("keydown", (e) => { if (e.key === "Enter") hex.blur(); });
  return {
    el: r.el,
    refresh() {
      r.refresh();
      const c = o.get();
      const v = c.mixed ? null : c.value ?? null;
      (sw.firstElementChild as HTMLElement).style.background = v ? cssColor(v) : "";
      sw.classList.toggle("is-empty", !v);
      tok.hidden = !(v && v.startsWith("$"));
      if (document.activeElement !== hex) hex.value = c.mixed ? "" : v ? (v.startsWith("$") ? `$${v.slice(1)}` : v) : "";
      hex.placeholder = c.mixed ? "Mixto" : o.allowNone ? "Sin color" : "";
      if (v && v.startsWith("$")) sw.title = `Color global: ${literalColor(v, ctx.ed.doc.theme)}`;
    },
  };
}

export function styleColor(ctx: PanelCtx, label: string, key: "color" | "bg", allowNone = false): Ctl {
  return colorField(ctx, {
    label, key, allowNone,
    get: () => { const s = readStyle<Fill>(ctx, key); return { value: typeof s.value === "string" ? s.value : undefined, mixed: s.mixed }; },
    set: (v, final) => ctx.ed.setStyle(ctx.ids(), { [key]: v ?? (key === "bg" ? null : undefined) }, { label, coalesce: final ? undefined : `color:${key}` }),
  });
}

/* ---------- Márgenes y rellenos ---------- */

export function sidesStyle(ctx: PanelCtx, label: string, key: "padding" | "margin"): Ctl {
  const names = ["Arriba", "Derecha", "Abajo", "Izquierda"];
  const inputs = names.map((n) => h("input", { class: "st-input st-input--sm pf-num", type: "number", step: "1", "aria-label": `${label} ${n.toLowerCase()}`, title: n }));
  let linked = false;
  const link = h("button", { type: "button", class: "st-icon-btn pf-link", "aria-label": "Vincular los cuatro lados", "aria-pressed": "false", "data-tip": "Vincular lados", onclick: () => { linked = !linked; link.classList.toggle("is-on", linked); link.setAttribute("aria-pressed", String(linked)); } }, ic("link", 13));
  const grid = h("div", { class: "pf-sides" }, inputs);
  const r = row(ctx, label, h("div", { class: "pf-sidesrow" }, grid, link), { key, wide: true });
  inputs.forEach((inp, i) => inp.addEventListener("input", () => {
    const cur: Sides = [...((readStyle<Sides>(ctx, key).value ?? [0, 0, 0, 0]) as Sides)] as Sides;
    const v = Math.round(Number(inp.value) || 0);
    if (linked) { cur.fill(v); inputs.forEach((x) => { if (x !== inp) x.value = String(v); }); } else cur[i] = v;
    ctx.ed.setStyle(ctx.ids(), { [key]: cur }, { coalesce: `sides:${key}` });
  }));
  return {
    el: r.el,
    refresh() {
      r.refresh();
      const s = readStyle<Sides>(ctx, key);
      const v = s.value ?? [0, 0, 0, 0];
      inputs.forEach((inp, i) => { if (document.activeElement !== inp) inp.value = s.mixed ? "" : String(v[i]); });
    },
  };
}

/* ---------- Tipografía ---------- */

let previewLoaded = false;
export function fontField(ctx: PanelCtx, o: { label: string; get: () => { value: string | undefined; mixed: boolean }; set: (v: string | undefined) => void; allowTokens?: boolean; key?: string }): Ctl {
  const btn = h("button", { type: "button", class: "pf-fontbtn", "aria-haspopup": "listbox" }, h("span", { class: "pf-fontbtn__name" }), ic("chevron-down", 13));
  const r = row(ctx, o.label, btn, { key: o.key });
  btn.addEventListener("click", () => {
    if (!previewLoaded) {
      previewLoaded = true;
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = googleFontsPreviewUrl(FONTS.map((f) => f.family));
      document.head.appendChild(l);
    }
    const search = h("input", { class: "st-input st-input--sm", type: "search", placeholder: "Buscar tipografía…", "aria-label": "Buscar tipografía" });
    const list = h("div", { class: "pf-fontlist", role: "listbox", tabindex: "-1" });
    const render = () => {
      const q = search.value.toLowerCase();
      list.replaceChildren();
      const items: { value: string; label: string; family: string; note?: string }[] = [];
      if (o.allowTokens) items.push({ value: "$heading", label: "Títulos (global)", family: ctx.ed.doc.theme.fonts.heading, note: ctx.ed.doc.theme.fonts.heading }, { value: "$body", label: "Texto (global)", family: ctx.ed.doc.theme.fonts.body, note: ctx.ed.doc.theme.fonts.body });
      for (const f of FONTS) items.push({ value: f.family, label: f.family, family: f.family, note: f.cat === "serif" ? "Serif" : f.cat === "monospace" ? "Mono" : f.cat === "display" ? "Display" : f.cat === "script" ? "Manuscrita" : "Sans" });
      for (const it of items) {
        if (q && !it.label.toLowerCase().includes(q)) continue;
        list.appendChild(h("button", { type: "button", role: "option", class: "pf-fontitem", onclick: () => { o.set(it.value); pop.close(); } },
          h("span", { class: "pf-fontitem__name", style: { fontFamily: `"${it.family}", sans-serif` } }, it.label), h("span", { class: "pf-fontitem__note" }, it.note ?? "")));
      }
    };
    search.addEventListener("input", render);
    render();
    const pop = popover(btn, h("div", { class: "pf-fontpop" }, search, list), { className: "st-popover--font" });
    search.focus();
  });
  return {
    el: r.el,
    refresh() {
      r.refresh();
      const c = o.get();
      const name = c.mixed ? "Mixto" : c.value === "$heading" ? `Títulos · ${ctx.ed.doc.theme.fonts.heading}` : c.value === "$body" ? `Texto · ${ctx.ed.doc.theme.fonts.body}` : c.value ?? "Heredada";
      const fam = c.value === "$heading" ? ctx.ed.doc.theme.fonts.heading : c.value === "$body" ? ctx.ed.doc.theme.fonts.body : c.value;
      const nm = btn.querySelector(".pf-fontbtn__name") as HTMLElement;
      nm.textContent = name;
      nm.style.fontFamily = fam && fontInfo(fam) ? `"${fam}", sans-serif` : "";
    },
  };
}

/* ---------- Sombras ---------- */

const SHADOWS: { id: string; label: string; v: Shadow[] }[] = [
  { id: "none", label: "Ninguna", v: [] },
  { id: "soft", label: "Suave", v: [{ x: 0, y: 6, blur: 18, spread: -6, color: "rgba(0,0,0,0.28)" }] },
  { id: "medium", label: "Media", v: [{ x: 0, y: 14, blur: 34, spread: -10, color: "rgba(0,0,0,0.45)" }] },
  { id: "strong", label: "Fuerte", v: [{ x: 0, y: 30, blur: 70, spread: -18, color: "rgba(0,0,0,0.65)" }] },
  { id: "glow", label: "Brillo", v: [{ x: 0, y: 0, blur: 36, spread: 0, color: "$primary" }] },
];

export function shadowField(ctx: PanelCtx): Ctl[] {
  const sel = h("select", { class: "st-select st-select--sm", "aria-label": "Sombra" }, [...SHADOWS.map((s) => h("option", { value: s.id }, s.label)), h("option", { value: "custom" }, "Personalizada")]);
  const preset = row(ctx, "Sombra", sel, { key: "shadow" });
  sel.addEventListener("change", () => {
    const p = SHADOWS.find((s) => s.id === sel.value);
    ctx.ed.setStyle(ctx.ids(), { shadow: p ? p.v : [{ x: 0, y: 8, blur: 24, spread: 0, color: "rgba(0,0,0,0.4)" }] }, { label: "Sombra" });
  });
  const mk = (label: string, k: keyof Shadow, min: number, max: number) => numShadow(ctx, label, k, min, max);
  const sx = mk("X", "x", -200, 200), sy = mk("Y", "y", -200, 200), sb = mk("Desenfoque", "blur", 0, 300), ss = mk("Expansión", "spread", -200, 200);
  const sc = colorField(ctx, {
    label: "Color de sombra", allowNone: false,
    get: () => { const s = readStyle<Shadow[]>(ctx, "shadow"); return { value: s.value?.[0]?.color, mixed: s.mixed }; },
    set: (v, final) => { const cur = readStyle<Shadow[]>(ctx, "shadow").value ?? []; if (!cur.length || !v) return; ctx.ed.setStyle(ctx.ids(), { shadow: [{ ...cur[0], color: v }, ...cur.slice(1)] }, { coalesce: final ? undefined : "shadow:color", label: "Sombra" }); },
  });
  const details = [sx, sy, sb, ss, sc];
  const out: Ctl = {
    el: preset.el,
    refresh() {
      preset.refresh();
      const s = readStyle<Shadow[]>(ctx, "shadow");
      const cur = s.value ?? [];
      const match = SHADOWS.find((p) => same(p.v, cur));
      sel.value = s.mixed ? "none" : match ? match.id : "custom";
      for (const d of details) d.el.hidden = !(cur.length && !match) ;
      details.forEach((d) => d.refresh());
    },
  };
  return [out, ...details];
}

function numShadow(ctx: PanelCtx, label: string, k: keyof Shadow, min: number, max: number): Ctl {
  const input = h("input", { class: "st-input st-input--sm pf-num", type: "number", min: String(min), max: String(max), "aria-label": `Sombra ${label}` });
  const r = row(ctx, label, input);
  input.addEventListener("input", () => {
    const cur = readStyle<Shadow[]>(ctx, "shadow").value ?? [];
    if (!cur.length) return;
    ctx.ed.setStyle(ctx.ids(), { shadow: [{ ...cur[0], [k]: clamp(Number(input.value) || 0, min, max) }, ...cur.slice(1)] }, { coalesce: `shadow:${k}`, label: "Sombra" });
  });
  return { el: r.el, refresh() { const cur = readStyle<Shadow[]>(ctx, "shadow").value ?? []; if (document.activeElement !== input) input.value = cur[0] ? String((cur[0] as any)[k]) : ""; } };
}

/* ---------- Relleno (color, degradado, imagen) ---------- */

export function fillField(ctx: PanelCtx, opts: { image?: boolean } = {}): Ctl[] {
  const seg = h("div", { class: "pf-seg", role: "radiogroup", "aria-label": "Tipo de relleno" },
    [["none", "Ninguno"], ["solid", "Color"], ["gradient", "Degradado"], ...(opts.image ? [["image", "Imagen"]] : [])].map(([v, l]) =>
      h("button", { type: "button", role: "radio", class: "pf-seg__btn", dataset: { v }, onclick: () => setKind(v) }, h("span", null, l))));
  const kindRow = row(ctx, "Relleno", seg, { key: "bg", wide: true });

  const kindOf = (): string => {
    const nodes = ctx.nodes();
    const st = nodes.map((n) => resolveStyle(n, ctx.device()));
    const bg = st[0].bg;
    if (opts.image && st[0].bgImage?.src) return "image";
    if (isGradient(bg)) return "gradient";
    return bg ? "solid" : "none";
  };

  const setKind = (v: string) => {
    const bg = readStyle<Fill>(ctx, "bg").value;
    const solid = typeof bg === "string" ? bg : "$primary";
    if (v === "none") ctx.ed.setStyle(ctx.ids(), { bg: null, bgImage: null }, { label: "Quitar relleno" });
    else if (v === "solid") ctx.ed.setStyle(ctx.ids(), { bg: solid, bgImage: null }, { label: "Relleno de color" });
    else if (v === "gradient") ctx.ed.setStyle(ctx.ids(), { bg: isGradient(bg) ? bg : { kind: "linear", angle: 135, stops: [{ c: solid, p: 0 }, { c: "$secondary", p: 100 }] }, bgImage: null }, { label: "Relleno degradado" });
    else if (v === "image") void chooseBgImage();
  };

  const chooseBgImage = async () => {
    const src = await pickAsset("image", "Imagen de fondo");
    if (!src) return;
    const cur = readStyle<any>(ctx, "bgImage").value;
    ctx.ed.setStyle(ctx.ids(), { bgImage: { src, fit: cur?.fit ?? "cover", pos: cur?.pos ?? "center", overlay: cur?.overlay } }, { label: "Imagen de fondo" });
  };

  const solid = styleColor(ctx, "Color", "bg", true);

  // degradado
  const bar = h("div", { class: "pf-gradbar" });
  const stopsBox = h("div", { class: "pf-stops" });
  const kind = selectField(ctx, { label: "Tipo", options: [{ value: "linear", label: "Lineal" }, { value: "radial", label: "Radial" }], get: () => { const g = readStyle<Fill>(ctx, "bg").value; return isGradient(g) ? g.kind : "linear"; }, set: (v) => editGrad((g) => { g.kind = v as any; }) });
  const angle = (() => {
    const range = h("input", { type: "range", class: "pf-range", min: "0", max: "360", step: "1", "aria-label": "Ángulo del degradado" });
    const r = row(ctx, "Ángulo", range);
    range.addEventListener("input", () => editGrad((g) => { g.angle = Number(range.value); }, "grad:angle"));
    return { el: r.el, refresh() { const g = readStyle<Fill>(ctx, "bg").value; if (isGradient(g)) range.value = String(((g.angle % 360) + 360) % 360); } } as Ctl;
  })();
  function editGrad(fn: (g: any) => void, coalesce?: string) {
    const g = readStyle<Fill>(ctx, "bg").value;
    if (!isGradient(g)) return;
    const copy = structuredClone(g);
    fn(copy);
    ctx.ed.setStyle(ctx.ids(), { bg: copy }, { label: "Editar degradado", coalesce });
  }
  const gradCtl: Ctl = {
    el: h("div", { class: "pf-grad" }, bar, stopsBox),
    refresh() {
      const g = readStyle<Fill>(ctx, "bg").value;
      if (!isGradient(g)) return;
      const css = `linear-gradient(90deg, ${g.stops.map((s) => `${cssColor(s.c)} ${s.p}%`).join(",")})`;
      bar.style.background = css;
      stopsBox.replaceChildren(...g.stops.map((s, i) => {
        const sw = h("button", { type: "button", class: "pf-swatch", "aria-label": `Color de la parada ${i + 1}`, onclick: () => openColorPicker(sw, { value: s.c, theme: ctx.ed.doc.theme, saved: ctx.ed.doc.savedColors, onChange: (v, final) => v && editGrad((gg) => { gg.stops[i].c = v; }, final ? undefined : `grad:c${i}`), onSave: (c) => ctx.ed.saveColor(c) }) }, h("i", { style: { background: cssColor(s.c) } }));
        const pos = h("input", { class: "st-input st-input--sm pf-num", type: "number", min: "0", max: "100", value: String(Math.round(s.p)), "aria-label": `Posición de la parada ${i + 1}` });
        pos.addEventListener("input", () => editGrad((gg) => { gg.stops[i].p = clamp(Number(pos.value) || 0, 0, 100); }, `grad:p${i}`));
        return h("div", { class: "pf-stop" }, sw, pos, h("span", { class: "pf-unit" }, "%"),
          g.stops.length > 2 ? h("button", { type: "button", class: "st-icon-btn", "aria-label": `Quitar parada ${i + 1}`, onclick: () => editGrad((gg) => { gg.stops.splice(i, 1); }) }, ic("x", 12)) : null);
      }), g.stops.length < 5 ? h("button", { type: "button", class: "st-link", onclick: () => editGrad((gg) => { gg.stops.push({ c: "#ffffff", p: 100 }); gg.stops.sort((a: any, b: any) => a.p - b.p); }) }, "+ Añadir parada") : "");
    },
  };

  // imagen de fondo
  const imgPreview = h("button", { type: "button", class: "pf-imgprev", "aria-label": "Cambiar imagen de fondo", onclick: () => void chooseBgImage() });
  const imgRow = row(ctx, "Imagen", imgPreview);
  const imgFit = selectField(ctx, { label: "Ajuste", options: [{ value: "cover", label: "Cubrir" }, { value: "contain", label: "Contener" }, { value: "repeat", label: "Repetir" }], get: () => readStyle<any>(ctx, "bgImage").value?.fit ?? "cover", set: (v) => editBg({ fit: v }) });
  const imgPos = selectField(ctx, { label: "Posición", options: [["center", "Centro"], ["top", "Arriba"], ["bottom", "Abajo"], ["left", "Izquierda"], ["right", "Derecha"], ["center top", "Centro arriba"], ["center bottom", "Centro abajo"]].map(([value, label]) => ({ value, label })), get: () => readStyle<any>(ctx, "bgImage").value?.pos ?? "center", set: (v) => editBg({ pos: v }) });
  const overlay = colorField(ctx, { label: "Capa de color", allowNone: true, get: () => ({ value: readStyle<any>(ctx, "bgImage").value?.overlay, mixed: false }), set: (v, final) => editBg({ overlay: v ?? undefined }, final) });
  function editBg(patch: Record<string, unknown>, final = true) {
    const cur = readStyle<any>(ctx, "bgImage").value;
    if (!cur?.src) return;
    ctx.ed.setStyle(ctx.ids(), { bgImage: { ...cur, ...patch } }, { label: "Imagen de fondo", coalesce: final ? undefined : "bgimg" });
  }

  const groups: { kind: string; ctls: Ctl[] }[] = [
    { kind: "solid", ctls: [solid] },
    { kind: "gradient", ctls: [kind, angle, gradCtl] },
    { kind: "image", ctls: [imgRow, imgFit, imgPos, overlay] },
  ];
  const main: Ctl = {
    el: kindRow.el,
    refresh() {
      kindRow.refresh();
      const k = kindOf();
      seg.querySelectorAll<HTMLElement>("button").forEach((b) => { const on = b.dataset.v === k; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); });
      for (const g of groups) { for (const c of g.ctls) { c.el.hidden = g.kind !== k; if (g.kind === k) c.refresh(); } }
      const bi = readStyle<any>(ctx, "bgImage").value;
      if (k === "image" && bi?.src) imgPreview.style.backgroundImage = `url("${bi.src.replace(/"/g, "")}")`;
    },
  };
  return [main, ...groups.flatMap((g) => g.ctls)];
}

/* ---------- Icono, enlace, imagen ---------- */

export function iconPickerField(ctx: PanelCtx): Ctl {
  const btn = h("button", { type: "button", class: "pf-iconbtn", "aria-label": "Elegir icono" });
  const r = row(ctx, "Icono", btn);
  btn.addEventListener("click", () => {
    const search = h("input", { class: "st-input st-input--sm", type: "search", placeholder: "Buscar icono…", "aria-label": "Buscar icono" });
    const grid = h("div", { class: "pf-icongrid" });
    const render = () => {
      grid.replaceChildren(...[...ICON_NAMES, "whatsapp"].filter((n) => n.includes(search.value.toLowerCase())).map((n) =>
        h("button", { type: "button", class: "pf-iconitem", title: n, "aria-label": n, onclick: () => { ctx.ed.setProps(ctx.ids(), { name: n }, { label: "Cambiar icono" }); pop.close(); } }, ic(n, 20))));
    };
    search.addEventListener("input", render);
    render();
    const pop = popover(btn, h("div", { class: "pf-iconpop" }, search, grid));
    search.focus();
  });
  return { el: r.el, refresh() { const s = readProp<string>(ctx, "name"); btn.replaceChildren(ic(s.value && (s.value in ICONS || s.value === "whatsapp") ? s.value : "star", 20), h("span", null, s.mixed ? "Mixto" : s.value ?? "")); } };
}

export function buttonIconField(ctx: PanelCtx): Ctl {
  const sel = h("select", { class: "st-select st-select--sm", "aria-label": "Icono del botón" }, h("option", { value: "" }, "Sin icono"), [...ICON_NAMES, "whatsapp"].map((n) => h("option", { value: n }, n)));
  sel.addEventListener("change", () => ctx.ed.setProps(ctx.ids(), { icon: sel.value }, { label: "Icono del botón" }));
  const r = row(ctx, "Icono", sel);
  return { el: r.el, refresh() { const s = readProp<string>(ctx, "icon"); if (document.activeElement !== sel) sel.value = s.mixed ? "" : s.value ?? ""; } };
}

/** Destino de un enlace: página, URL, ancla, correo, teléfono o WhatsApp. */
export function linkField(ctx: PanelCtx, label = "Destino"): Ctl[] {
  const types = [["none", "Sin enlace"], ["page", "Página del sitio"], ["url", "Dirección web"], ["anchor", "Sección (ancla)"], ["mail", "Correo"], ["tel", "Teléfono"], ["wa", "WhatsApp"]];
  const sel = h("select", { class: "st-select st-select--sm", "aria-label": label }, types.map(([v, l]) => h("option", { value: v }, l)));
  const typeRow = row(ctx, label, sel);
  const pageSel = h("select", { class: "st-select st-select--sm", "aria-label": "Página de destino" });
  const text = h("input", { class: "st-input st-input--sm", type: "text", "aria-label": "Valor del enlace", spellcheck: "false" });
  const valueRow = row(ctx, "Valor", h("div", { class: "pf-linkval" }, pageSel, text));
  const blank = propToggle(ctx, "Abrir en pestaña nueva", "target");
  // propToggle guarda booleano; el target es _blank/_self
  const blankCtl: Ctl = toggleField(ctx, { label: "Abrir en pestaña nueva", get: () => { const s = readProp<string>(ctx, "target"); return s.mixed ? "mixed" : s.value === "_blank"; }, set: (v) => ctx.ed.setProps(ctx.ids(), { target: v ? "_blank" : "_self" }, { label: "Destino del enlace" }) });
  void blank;

  const kindOf = (href: string): string => {
    if (!href) return "none";
    if (href.startsWith("page:")) return "page";
    if (href.startsWith("#")) return "anchor";
    if (href.startsWith("mailto:")) return "mail";
    if (href.startsWith("tel:")) return "tel";
    if (/^https:\/\/wa\.me\//.test(href)) return "wa";
    return "url";
  };
  const write = (href: string) => ctx.ed.setProps(ctx.ids(), { href }, { coalesce: "href", label: "Cambiar enlace" });
  const fromInputs = () => {
    const t = sel.value;
    const v = text.value.trim();
    if (t === "none") write("");
    else if (t === "page") write(pageSel.value ? `page:${pageSel.value}` : "");
    else if (t === "url") write(/^https?:\/\//i.test(v) ? v : v ? `https://${v}` : "");
    else if (t === "anchor") write(`#${v.replace(/^#/, "").replace(/[^\w-]/g, "")}`);
    else if (t === "mail") write(v ? `mailto:${v}` : "");
    else if (t === "tel") write(v ? `tel:${v.replace(/[^\d+\-().]/g, "")}` : "");
    else if (t === "wa") write(v ? `https://wa.me/${v.replace(/\D/g, "")}` : "");
  };
  sel.addEventListener("change", () => {
    if (sel.value === "page") { pageSel.value = ctx.ed.doc.pages[0]?.id ?? ""; text.value = ""; }
    else if (sel.value !== kindOf(readProp<string>(ctx, "href").value ?? "")) text.value = sel.value === "anchor" ? "" : "";
    fromInputs();
  });
  pageSel.addEventListener("change", fromInputs);
  text.addEventListener("input", fromInputs);

  const ctls: Ctl[] = [
    { el: typeRow.el, refresh() { const s = readProp<string>(ctx, "href"); if (document.activeElement !== sel) sel.value = s.mixed ? "none" : kindOf(s.value ?? ""); } },
    {
      el: valueRow.el,
      refresh() {
        const s = readProp<string>(ctx, "href");
        const href = s.mixed ? "" : s.value ?? "";
        const k = kindOf(href);
        valueRow.el.hidden = k === "none" && sel.value === "none";
        pageSel.hidden = sel.value !== "page";
        text.hidden = sel.value === "page" || sel.value === "none";
        pageSel.replaceChildren(...ctx.ed.doc.pages.map((p) => h("option", { value: p.id }, p.name)));
        if (k === "page") pageSel.value = href.slice(5);
        if (document.activeElement !== text) text.value = k === "anchor" ? href.slice(1) : k === "mail" ? href.slice(7) : k === "tel" ? href.slice(4) : k === "wa" ? href.replace("https://wa.me/", "") : k === "url" ? href : "";
        text.placeholder = { url: "https://ejemplo.com", anchor: "id-de-la-sección", mail: "hola@tusitio.com", tel: "+57 300 000 0000", wa: "573001112233" }[sel.value] ?? "";
      },
    },
    { el: blankCtl.el, refresh() { blankCtl.refresh(); blankCtl.el.hidden = sel.value === "none" || sel.value === "anchor" || sel.value === "page"; } },
  ];
  return ctls;
}

export function imageSourceField(ctx: PanelCtx, o: { key: string; label: string; kind: "image" | "video" }): Ctl {
  const prev = h("button", { type: "button", class: "pf-imgprev", "aria-label": `Cambiar ${o.label.toLowerCase()}` });
  const clearBtn = h("button", { type: "button", class: "st-link", onclick: () => ctx.ed.setProps(ctx.ids(), { [o.key]: "" }, { label: "Quitar archivo" }) }, "Quitar");
  const r = row(ctx, o.label, h("div", { class: "pf-imgsrc" }, prev, clearBtn), { wide: true });
  prev.addEventListener("click", async () => {
    const src = await pickAsset(o.kind, o.label);
    if (src) ctx.ed.setProps(ctx.ids(), { [o.key]: src }, { label: "Cambiar archivo" });
  });
  return {
    el: r.el,
    refresh() {
      const s = readProp<string>(ctx, o.key);
      const src = s.mixed ? "" : String(s.value ?? "");
      prev.classList.toggle("is-empty", !src);
      prev.style.backgroundImage = src && o.kind === "image" ? `url("${src.replace(/"/g, "")}")` : "";
      prev.replaceChildren(src ? (o.kind === "video" ? ic("play", 20) : "") : h("span", null, ic("image", 18), o.kind === "video" ? "Elegir vídeo" : "Elegir imagen"));
      clearBtn.hidden = !src;
    },
  };
}

/** Selector del punto focal de una imagen (clic sobre la miniatura). */
export function focalField(ctx: PanelCtx): Ctl {
  const dot = h("i", { class: "pf-focal__dot" });
  const box = h("div", { class: "pf-focal", role: "slider", tabindex: "0", "aria-label": "Punto focal de la imagen" }, dot);
  const r = row(ctx, "Encuadre", box, { wide: true });
  const set = (x: number, y: number) => ctx.ed.setProps(ctx.ids(), { focalX: Math.round(clamp(x, 0, 1) * 100), focalY: Math.round(clamp(y, 0, 1) * 100) }, { coalesce: "focal", label: "Encuadre" });
  box.addEventListener("pointerdown", (e) => {
    box.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => { const b = box.getBoundingClientRect(); set((ev.clientX - b.left) / b.width, (ev.clientY - b.top) / b.height); };
    mv(e);
    const up = () => { box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); };
    box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up);
  });
  box.addEventListener("keydown", (e) => {
    const x = Number(readProp(ctx, "focalX").value ?? 50), y = Number(readProp(ctx, "focalY").value ?? 50);
    const d = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") { e.preventDefault(); set((x - d) / 100, y / 100); }
    if (e.key === "ArrowRight") { e.preventDefault(); set((x + d) / 100, y / 100); }
    if (e.key === "ArrowUp") { e.preventDefault(); set(x / 100, (y - d) / 100); }
    if (e.key === "ArrowDown") { e.preventDefault(); set(x / 100, (y + d) / 100); }
  });
  return {
    el: r.el,
    refresh() {
      const src = String(readProp<string>(ctx, "src").value ?? "");
      box.style.backgroundImage = src ? `url("${src.replace(/"/g, "")}")` : "";
      dot.style.left = `${Number(readProp(ctx, "focalX").value ?? 50)}%`;
      dot.style.top = `${Number(readProp(ctx, "focalY").value ?? 50)}%`;
    },
  };
}

/* ---------- Secciones plegables ---------- */

const OPEN_KEY = "icarus.studio.sections";
function openState(): Record<string, boolean> { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || "{}"); } catch { return {}; } }

export function section(id: string, title: string, controls: Ctl[], opts: { open?: boolean; badge?: () => string } = {}): { el: HTMLElement; refresh(): void } {
  const st = openState();
  let open = st[id] ?? opts.open ?? true;
  const body = h("div", { class: "pf-secbody" }, controls.map((c) => c.el));
  const head = h("button", { type: "button", class: "pf-sechead", "aria-expanded": String(open), onclick: () => {
    open = !open;
    head.setAttribute("aria-expanded", String(open));
    el.classList.toggle("is-closed", !open);
    try { const s = openState(); s[id] = open; localStorage.setItem(OPEN_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
    if (open) controls.forEach((c) => c.refresh());
  } }, ic("chevron-down", 13), h("span", null, title));
  const el = h("section", { class: `pf-sec${open ? "" : " is-closed"}`, dataset: { sec: id } }, head, body);
  return { el, refresh() { if (open) controls.forEach((c) => c.refresh()); } };
}
