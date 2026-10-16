/** Selector de color: HSV, HEX/RGB, transparencia, colores globales del proyecto, guardados y paletas. */
import { PALETTES, COLOR_NAMES } from "../../shared/model/presets";
import { literalColor, parseColor } from "../../shared/model/style";
import { Theme } from "../../shared/model/types";
import { clamp, h, ic, popover, PopoverHandle, toast } from "../lib/dom";

export interface PickerOptions {
  /** Valor actual: «#rrggbb», «rgba(...)» o un token «$nombre». */
  value: string | null;
  theme: Theme;
  saved: string[];
  allowNone?: boolean;
  onChange: (v: string | null, final: boolean) => void;
  onSave?: (c: string) => void;
}

function hsv2rgb(hh: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => { const k = (n + hh / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}
function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hh = 0;
  if (d) { if (max === r) hh = ((g - b) / d) % 6; else if (max === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
  return [hh, max ? d / max : 0, max];
}
const hex2 = (n: number) => n.toString(16).padStart(2, "0");
export function toCss(r: number, g: number, b: number, a: number): string {
  return a >= 1 ? `#${hex2(r)}${hex2(g)}${hex2(b)}` : `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
}

export function colorToRgba(v: string | null, theme: Theme): [number, number, number, number] {
  if (!v) return [0, 0, 0, 0];
  const p = parseColor(literalColor(v, theme));
  return p ?? [0, 0, 0, 1];
}

export function openColorPicker(anchor: HTMLElement, o: PickerOptions): PopoverHandle {
  const [r0, g0, b0, a0] = colorToRgba(o.value, o.theme);
  let [hue, sat, val] = rgb2hsv(r0, g0, b0);
  let alpha = a0;
  let token: string | null = o.value && o.value.startsWith("$") ? o.value : null;

  const area = h("div", { class: "cp-area", tabindex: "0", role: "slider", "aria-label": "Saturación y brillo" }, h("i", { class: "cp-knob" }));
  const hueBar = h("div", { class: "cp-bar cp-bar--hue", tabindex: "0", role: "slider", "aria-label": "Tono" }, h("i", { class: "cp-knob" }));
  const alphaBar = h("div", { class: "cp-bar cp-bar--alpha", tabindex: "0", role: "slider", "aria-label": "Transparencia" }, h("i", { class: "cp-knob" }));
  const hexIn = h("input", { class: "st-input st-input--sm", "aria-label": "Valor HEX", spellcheck: "false", maxlength: "9" });
  const rIn = h("input", { class: "st-input st-input--sm", type: "number", min: "0", max: "255", "aria-label": "Rojo" });
  const gIn = h("input", { class: "st-input st-input--sm", type: "number", min: "0", max: "255", "aria-label": "Verde" });
  const bIn = h("input", { class: "st-input st-input--sm", type: "number", min: "0", max: "255", "aria-label": "Azul" });
  const aIn = h("input", { class: "st-input st-input--sm", type: "number", min: "0", max: "100", "aria-label": "Transparencia %" });
  const preview = h("div", { class: "cp-preview" });
  const linkInfo = h("div", { class: "cp-link" });

  const current = () => { const [r, g, b] = hsv2rgb(hue, sat, val); return toCss(r, g, b, alpha); };
  const sync = (emit: boolean, final = false) => {
    const [r, g, b] = hsv2rgb(hue, sat, val);
    area.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hue},100%,50%))`;
    (area.firstElementChild as HTMLElement).style.cssText = `left:${sat * 100}%;top:${(1 - val) * 100}%`;
    (hueBar.firstElementChild as HTMLElement).style.left = `${(hue / 360) * 100}%`;
    alphaBar.style.setProperty("--c", `rgb(${r},${g},${b})`);
    (alphaBar.firstElementChild as HTMLElement).style.left = `${alpha * 100}%`;
    preview.style.setProperty("--c", `rgba(${r},${g},${b},${alpha})`);
    if (document.activeElement !== hexIn) hexIn.value = `#${hex2(r)}${hex2(g)}${hex2(b)}${alpha < 1 ? hex2(Math.round(alpha * 255)) : ""}`;
    if (document.activeElement !== rIn) rIn.value = String(r);
    if (document.activeElement !== gIn) gIn.value = String(g);
    if (document.activeElement !== bIn) bIn.value = String(b);
    if (document.activeElement !== aIn) aIn.value = String(Math.round(alpha * 100));
    linkInfo.replaceChildren(token ? h("span", null, ic("link", 12), ` Vinculado al color global «${COLOR_NAMES[token.slice(1)] ?? token.slice(1)}»`) : "");
    if (emit) o.onChange(token ?? current(), final);
  };

  const drag = (el: HTMLElement, fn: (x: number, y: number) => void) => {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => { const r = el.getBoundingClientRect(); token = null; fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); };
      move(e);
      const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); sync(true, true); };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    });
  };
  drag(area, (x, y) => { sat = x; val = 1 - y; sync(true); });
  drag(hueBar, (x) => { hue = x * 359.99; sync(true); });
  drag(alphaBar, (x) => { alpha = Math.round(x * 100) / 100; sync(true); });
  const keyStep = (el: HTMLElement, fn: (dx: number, dy: number) => void) => el.addEventListener("keydown", (e) => {
    const d = e.shiftKey ? 0.1 : 0.01;
    const m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
    if (m[e.key]) { e.preventDefault(); token = null; fn(...m[e.key]); sync(true, true); }
  });
  keyStep(area, (dx, dy) => { sat = clamp(sat + dx, 0, 1); val = clamp(val - dy, 0, 1); });
  keyStep(hueBar, (dx) => { hue = clamp(hue + dx * 360, 0, 359.99); });
  keyStep(alphaBar, (dx) => { alpha = clamp(alpha + dx, 0, 1); });

  const fromRgbInputs = () => {
    token = null;
    const r = clamp(Number(rIn.value) || 0, 0, 255), g = clamp(Number(gIn.value) || 0, 0, 255), b = clamp(Number(bIn.value) || 0, 0, 255);
    [hue, sat, val] = rgb2hsv(r, g, b);
    alpha = clamp((Number(aIn.value) || 0) / 100, 0, 1);
    sync(true);
  };
  for (const i of [rIn, gIn, bIn, aIn]) i.addEventListener("input", fromRgbInputs);
  hexIn.addEventListener("input", () => {
    let t = hexIn.value.trim();
    if (!t.startsWith("#")) t = "#" + t;
    const p = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t) ? parseColor(t) : null;
    if (!p) return;
    token = null;
    [hue, sat, val] = rgb2hsv(p[0], p[1], p[2]);
    alpha = p[3];
    sync(true);
  });
  hexIn.addEventListener("blur", () => sync(false));

  const swatch = (css: string, title: string, onClick: () => void, extra = "") =>
    h("button", { type: "button", class: `cp-sw ${extra}`, title, "aria-label": title, style: { "--c": css }, onclick: onClick });

  const setFrom = (css: string, tok: string | null = null) => {
    const [r, g, b, a] = colorToRgba(css, o.theme);
    [hue, sat, val] = rgb2hsv(r, g, b);
    alpha = a;
    token = tok;
    sync(true, true);
  };

  const globals = h("div", { class: "cp-row" }, Object.entries(o.theme.colors).map(([k, v]) =>
    swatch(v, `${COLOR_NAMES[k] ?? k} (global)`, () => setFrom(v, `$${k}`), token === `$${k}` ? "is-on" : "")));
  const savedRow = h("div", { class: "cp-row" });
  const renderSaved = () => {
    savedRow.replaceChildren(...o.saved.slice(0, 16).map((c) => swatch(c, c, () => setFrom(c))));
    if (!o.saved.length) savedRow.appendChild(h("span", { class: "cp-hint" }, "Aún no hay colores guardados."));
  };
  renderSaved();

  const paletteRows = PALETTES.slice(0, 6).map((p) => h("div", { class: "cp-pal", title: p.label }, [p.colors.primary, p.colors.secondary, p.colors.accent, p.colors.bg, p.colors.surface, p.colors.text].map((c) => swatch(c, c, () => setFrom(c)))));

  const eye = (window as any).EyeDropper
    ? h("button", { type: "button", class: "st-icon-btn", "aria-label": "Cuentagotas", "data-tip": "Cuentagotas", onclick: async () => { try { const r = await new (window as any).EyeDropper().open(); setFrom(r.sRGBHex); } catch { /* cancelado */ } } }, ic("tool", 15))
    : null;

  const body = h("div", { class: "cp" },
    area, h("div", { class: "cp-sliders" }, h("div", { class: "cp-bars" }, hueBar, alphaBar), preview, eye),
    h("div", { class: "cp-inputs" }, h("label", null, h("span", null, "HEX"), hexIn), h("label", null, h("span", null, "R"), rIn), h("label", null, h("span", null, "G"), gIn), h("label", null, h("span", null, "B"), bIn), h("label", null, h("span", null, "A %"), aIn)),
    linkInfo,
    h("div", { class: "cp-sec" }, h("div", { class: "cp-title" }, "Colores globales"), globals),
    h("div", { class: "cp-sec" }, h("div", { class: "cp-title" }, "Guardados", o.onSave ? h("button", { type: "button", class: "st-link", onclick: () => { const c = current(); o.onSave!(c); if (!o.saved.includes(c)) o.saved = [c, ...o.saved]; renderSaved(); toast("Color guardado", "ok", 1200); } }, "+ Guardar este color") : null), savedRow),
    h("div", { class: "cp-sec" }, h("div", { class: "cp-title" }, "Paletas"), paletteRows),
    o.allowNone ? h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: () => { o.onChange(null, true); pop.close(); } }, "Sin color") : null,
  );
  const pop = popover(anchor, body, { className: "st-popover--cp" });
  sync(false);
  return pop;
}
