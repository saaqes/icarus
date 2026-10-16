/**
 * Motor de estilos: resuelve la herencia entre dispositivos y compila los estilos de un nodo a CSS.
 *
 * Esta única implementación alimenta tanto el lienzo del editor (estilos en línea para el
 * dispositivo seleccionado) como la exportación (reglas CSS + @media), de modo que lo que se ve
 * en el editor es lo que se publica.
 */
import { fontStack } from "./fonts";
import {
  Device, Doc, Fill, Gradient, Layout, Node, PartialStyle, Shadow, Sides, Theme,
} from "./types";

export type Decls = Record<string, string>;

/* ---------- Herencia entre dispositivos ---------- */

/** Estilo efectivo en un dispositivo: base ← tablet ← móvil. */
export function resolveStyle(node: Node, device: Device): PartialStyle {
  if (device === "desktop") return node.s.base;
  if (device === "tablet") return { ...node.s.base, ...node.s.tablet };
  return { ...node.s.base, ...node.s.tablet, ...node.s.mobile };
}

/** ¿Este nodo tiene un valor propio (no heredado) para `key` en `device`? */
export function isOverridden(node: Node, device: Device, key: string): boolean {
  if (device === "desktop") return key in node.s.base;
  const layer = device === "tablet" ? node.s.tablet : node.s.mobile;
  return !!layer && key in layer;
}

export function defaultLayout(node: Node): Layout {
  return node.s.base.layout ?? "stack";
}

/**
 * Disposición real de un contenedor en un dispositivo. Una disposición «libre» definida solo en
 * escritorio se convierte en pila en tableta/móvil (las coordenadas absolutas de un diseño de
 * escritorio romperían las pantallas pequeñas) salvo que el usuario la haya definido ahí.
 */
export function effectiveLayout(node: Node, device: Device): Layout {
  const base = defaultLayout(node);
  if (device === "desktop") return base;
  const t = node.s.tablet?.layout;
  const m = node.s.mobile?.layout;
  const fallback: Layout = base === "free" ? "stack" : base;
  if (device === "tablet") return t ?? fallback;
  return m ?? t ?? fallback;
}

/** ¿La disposición libre de este contenedor ha caído a pila por el respaldo responsive? */
export function isFreeFallback(node: Node, device: Device): boolean {
  return defaultLayout(node) === "free" && effectiveLayout(node, device) !== "free";
}

/** Hijos en el orden en que se muestran. En el respaldo (libre → pila) se ordenan por posición. */
export function orderedChildren(doc: Doc, node: Node, device: Device): string[] {
  if (!isFreeFallback(node, device)) return node.children;
  const pos = (id: string) => {
    const s = doc.nodes[id]?.s.base ?? {};
    return [s.y ?? 0, s.x ?? 0] as const;
  };
  return [...node.children].sort((a, b) => {
    const [ay, ax] = pos(a);
    const [by, bx] = pos(b);
    return ay - by || ax - bx;
  });
}

/* ---------- Valores: colores, fuentes, rellenos ---------- */

export function isToken(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("$");
}

/** Color CSS (los tokens `$nombre` se convierten en variables CSS). */
export function cssColor(c: string | undefined | null): string {
  if (!c) return "transparent";
  if (c.startsWith("$")) return `var(--c-${c.slice(1).replace(/[^a-z0-9_-]/gi, "")})`;
  return c;
}

/** Color literal (para cálculos como el contraste). */
export function literalColor(c: string | undefined | null, theme: Theme): string {
  if (!c) return "transparent";
  if (c.startsWith("$")) return theme.colors[c.slice(1)] ?? "#000000";
  return c;
}

export function cssFont(f: string | undefined, theme: Theme): string {
  if (!f) return "";
  if (f === "$heading") return `var(--f-heading)`;
  if (f === "$body") return `var(--f-body)`;
  return fontStack(f);
}

export function resolveFontFamily(f: string | undefined, theme: Theme): string {
  if (f === "$heading") return theme.fonts.heading;
  if (f === "$body") return theme.fonts.body;
  return f ?? "";
}

export function gradientCss(g: Gradient): string {
  const stops = g.stops.map((s) => `${cssColor(s.c)} ${Math.round(s.p)}%`).join(", ");
  return g.kind === "radial" ? `radial-gradient(circle at center, ${stops})` : `linear-gradient(${Math.round(g.angle)}deg, ${stops})`;
}

export function isGradient(f: Fill | null | undefined): f is Gradient {
  return !!f && typeof f === "object" && "stops" in f;
}

function px(n: number): string {
  return `${Math.round(n * 100) / 100}px`;
}

function sidesCss(s: Sides): string {
  return s.map(px).join(" ");
}

function shadowCss(list: Shadow[]): string {
  return list.map((s) => `${s.inset ? "inset " : ""}${px(s.x)} ${px(s.y)} ${px(s.blur)} ${px(s.spread)} ${cssColor(s.color)}`).join(", ");
}

/** Escapa una URL para `url("...")`. */
export function cssUrl(u: string): string {
  return `url("${u.replace(/["\\\n\r]/g, "")}")`;
}

/* ---------- Compilación ---------- */

/** Valores por defecto que deben restablecerse cuando un dispositivo deja de definir la clave. */
export const RESET: Decls = {
  position: "relative", left: "auto", top: "auto", width: "auto", height: "auto", "min-height": "0", "max-width": "none",
  "min-width": "0", margin: "0", "margin-left": "0", "margin-right": "0", padding: "0", "padding-left": "0", "padding-right": "0",
  flex: "0 1 auto", "flex-grow": "0", "align-self": "auto", "grid-column": "auto", transform: "none", opacity: "1",
  "background-color": "transparent", "background-image": "none", "background-size": "auto", "background-position": "0 0",
  "background-repeat": "repeat", border: "0", "border-radius": "0", "box-shadow": "none", overflow: "visible",
  display: "block", "flex-direction": "row", "flex-wrap": "nowrap", gap: "0", "align-items": "stretch", "justify-content": "flex-start",
  "grid-template-columns": "none", "font-family": "inherit", "font-size": "inherit", "font-weight": "inherit", "font-style": "inherit",
  "text-decoration": "none", "text-transform": "none", color: "inherit", "text-align": "inherit", "line-height": "inherit",
  "letter-spacing": "normal", "aspect-ratio": "auto", order: "0",
};

const JUSTIFY: Record<string, string> = {
  start: "flex-start", center: "center", end: "flex-end", between: "space-between", around: "space-around",
};
const ALIGN: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };

const CONTAINERS = new Set(["root", "section", "container", "form"]);

export interface CompileOptions {
  /** Estado de edición: fuerza el aspecto «hover» del botón seleccionado. */
  state?: "normal" | "hover";
  /** En el editor los elementos ocultos por dispositivo siguen siendo visibles (atenuados). */
  forEditor?: boolean;
}

/**
 * Declaraciones CSS del nodo (sin selector) para un dispositivo.
 * Siempre devuelve un conjunto completo y determinista: la exportación calcula diferencias entre
 * dispositivos para generar solo lo necesario en cada @media.
 */
export function nodeDecls(doc: Doc, node: Node, device: Device, opts: CompileOptions = {}): Decls {
  const base = resolveStyle(node, device);
  const st: PartialStyle = opts.state === "hover" && node.hover ? { ...base, ...node.hover } : base;
  const theme = doc.theme;
  const d: Decls = {};
  const parent = node.parent ? doc.nodes[node.parent] : undefined;
  const parentLayout: Layout = parent ? effectiveLayout(parent, device) : "stack";
  const freeChild = parentLayout === "free" && node.type !== "root";
  const isCont = CONTAINERS.has(node.type);
  const isLeafMedia = node.type === "image" || node.type === "video";

  d.position = freeChild ? "absolute" : "relative";

  /* ----- tamaño y posición ----- */
  const defW = node.type === "image" || node.type === "video" || node.type === "divider" ? "fill" : "auto";
  const w = st.w ?? defW;
  const h = st.h ?? "auto";

  if (freeChild) {
    d.left = px(st.x ?? 0);
    d.top = px(st.y ?? 0);
  }

  if (typeof w === "number") {
    d.width = px(w);
    if (!freeChild) d["max-width"] = "100%";
  } else if (w === "fill") {
    if (!freeChild && parentLayout === "row") { d.flex = "1 1 0%"; d["min-width"] = "0"; }
    else d.width = "100%";
  } else if (typeof w === "string" && w.endsWith("%")) {
    d.width = w;
  }

  if (typeof h === "number") {
    if (isCont) d["min-height"] = px(Math.max(h, st.minHeight ?? 0));
    else d.height = px(h);
  } else if (h === "fill") {
    if (!freeChild && parentLayout === "row") d["align-self"] = "stretch";
    else if (!freeChild && parentLayout === "stack") d["flex-grow"] = "1";
    else d.height = "100%";
  } else if (typeof h === "string" && h.endsWith("%")) {
    d.height = h;
  }
  if (isCont && typeof h !== "number" && st.minHeight) d["min-height"] = px(st.minHeight);

  if (isLeafMedia && h === "auto") {
    const ratio = Number(node.props.ratio);
    if (ratio > 0) d["aspect-ratio"] = String(Math.round(ratio * 1000) / 1000);
  }

  if (!freeChild) {
    if (parent && isFreeFallback(parent, device)) d.order = String(orderedChildren(doc, parent, device).indexOf(node.id));
    if (st.alignSelf && st.alignSelf !== "auto") d["align-self"] = ALIGN[st.alignSelf] ?? st.alignSelf;
    if (st.colSpan && st.colSpan > 1) d["grid-column"] = `span ${Math.round(st.colSpan)}`;
    if (st.margin && st.margin.some((v) => v)) d.margin = sidesCss(st.margin);
  }

  if (st.rotate) d.transform = `rotate(${st.rotate}deg)`;
  if (st.opacity !== undefined && st.opacity < 1) d.opacity = String(Math.max(0, st.opacity));

  /* ----- relleno interno ----- */
  const pad = st.padding;
  if (pad && pad.some((v) => v)) d.padding = sidesCss(pad);
  if (node.type === "section" && typeof st.maxWidth === "number" && st.maxWidth > 0) {
    d["padding-left"] = `max(${px(pad?.[3] ?? 0)}, calc((100% - ${px(st.maxWidth)}) / 2))`;
    d["padding-right"] = `max(${px(pad?.[1] ?? 0)}, calc((100% - ${px(st.maxWidth)}) / 2))`;
  } else if (node.type !== "section" && node.type !== "root" && typeof st.maxWidth === "number" && st.maxWidth > 0) {
    d["max-width"] = px(st.maxWidth);
    if (!freeChild) {
      d["margin-left"] = "auto";
      d["margin-right"] = "auto";
      if (typeof w !== "number") d.width = "100%";
    }
  }

  /* ----- fondo ----- */
  const layers: string[] = [];
  const sizes: string[] = [];
  const poses: string[] = [];
  const repeats: string[] = [];
  if (st.bgImage?.src) {
    const bi = st.bgImage;
    if (bi.overlay) { layers.push(`linear-gradient(${cssColor(bi.overlay)}, ${cssColor(bi.overlay)})`); sizes.push("auto"); poses.push("0 0"); repeats.push("no-repeat"); }
    layers.push(cssUrl(bi.src));
    sizes.push(bi.fit === "repeat" ? "auto" : bi.fit);
    poses.push(bi.pos || "center");
    repeats.push(bi.fit === "repeat" ? "repeat" : "no-repeat");
  }
  if (st.bg) {
    if (isGradient(st.bg)) { layers.push(gradientCss(st.bg)); sizes.push("auto"); poses.push("0 0"); repeats.push("no-repeat"); }
    else d["background-color"] = cssColor(st.bg);
  }
  if (layers.length) {
    d["background-image"] = layers.join(", ");
    d["background-size"] = sizes.join(", ");
    d["background-position"] = poses.join(", ");
    d["background-repeat"] = repeats.join(", ");
  }

  /* ----- borde, radio, sombra ----- */
  if (st.border && st.border.w > 0) d.border = `${px(st.border.w)} ${st.border.style} ${cssColor(st.border.color)}`;
  if (typeof st.radius === "number") { if (st.radius) d["border-radius"] = px(st.radius); }
  else if (Array.isArray(st.radius)) d["border-radius"] = sidesCss(st.radius);
  if (node.type === "shape" && node.props.shape === "ellipse") d["border-radius"] = "50%";
  if (st.shadow && st.shadow.length) d["box-shadow"] = shadowCss(st.shadow);
  if (st.overflow === "hidden" || isLeafMedia) d.overflow = "hidden";

  /* ----- disposición de los hijos ----- */
  if (isCont) {
    const L = effectiveLayout(node, device);
    const gap = st.gap ?? 0;
    if (L === "free") {
      d.display = "block";
    } else if (L === "grid") {
      d.display = "grid";
      d["grid-template-columns"] = `repeat(${Math.max(1, Math.round(st.columns ?? 2))}, minmax(0, 1fr))`;
      d.gap = px(gap);
      d["align-items"] = ALIGN[st.align ?? "stretch"] ?? "stretch";
      if (st.justify) d["justify-content"] = JUSTIFY[st.justify] ?? "flex-start";
    } else {
      d.display = "flex";
      d["flex-direction"] = L === "row" ? "row" : "column";
      if (L === "row") d["flex-wrap"] = st.wrap ? "wrap" : "nowrap";
      d.gap = px(gap);
      d["align-items"] = ALIGN[st.align ?? (L === "row" ? "center" : "stretch")] ?? "stretch";
      d["justify-content"] = JUSTIFY[st.justify ?? "start"] ?? "flex-start";
    }
  } else if (node.type === "button") {
    d.display = "inline-flex";
    d["align-items"] = "center";
    d["justify-content"] = "center";
    d.gap = "8px";
  } else if (node.type === "icon") {
    d.display = "inline-flex";
  } else if (node.type === "field") {
    d.display = "flex";
    d["flex-direction"] = "column";
    d.gap = "6px";
  }

  /* ----- tipografía (heredable: solo se emite lo definido) ----- */
  if (st.font) d["font-family"] = cssFont(st.font, theme);
  if (st.size) d["font-size"] = px(st.size);
  if (st.weight) d["font-weight"] = String(st.weight);
  if (st.italic) d["font-style"] = "italic";
  if (st.underline) d["text-decoration"] = "underline";
  if (st.transform && st.transform !== "none") d["text-transform"] = st.transform;
  if (st.color) d.color = cssColor(st.color);
  if (st.textAlign) d["text-align"] = st.textAlign;
  if (st.lh) d["line-height"] = String(st.lh);
  if (st.ls) d["letter-spacing"] = `${st.ls}px`;

  if (st.hide && !opts.forEditor) d.display = "none";
  return d;
}

/** Reglas para elementos internos (imagen dentro de su marco, svg de icono…). */
export function innerDecls(node: Node, device: Device): { sel: string; decls: Decls } | null {
  const st = resolveStyle(node, device);
  if (node.type === "image" || node.type === "video") {
    const decls: Decls = { display: "block", width: "100%", height: "100%", "object-fit": st.fit ?? "cover" };
    const fx = Number(node.props.focalX ?? 50);
    const fy = Number(node.props.focalY ?? 50);
    decls["object-position"] = `${clampNum(fx, 0, 100)}% ${clampNum(fy, 0, 100)}%`;
    const z = Number(node.props.zoom ?? 1);
    if (z > 1) decls.transform = `scale(${clampNum(z, 1, 4)})`;
    decls["transform-origin"] = `${clampNum(fx, 0, 100)}% ${clampNum(fy, 0, 100)}%`;
    return { sel: node.type === "image" ? "img" : "video", decls };
  }
  if (node.type === "icon") {
    return { sel: "svg", decls: { width: "100%", height: "100%", display: "block" } };
  }
  return null;
}

function clampNum(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

/** Estilos del estado `hover` (solo propiedades visuales, nunca tamaño ni posición). */
export function hoverDecls(doc: Doc, node: Node): Decls {
  if (!node.hover) return {};
  const allowed: PartialStyle = {};
  const keys = ["bg", "bgImage", "color", "border", "radius", "shadow", "opacity", "rotate", "underline", "transform"] as const;
  for (const k of keys) if (k in node.hover) (allowed as any)[k] = (node.hover as any)[k];
  const fake: Node = { ...node, s: { base: allowed }, parent: null };
  const decls = nodeDecls(doc, fake, "desktop");
  const out: Decls = {};
  for (const k of Object.keys(decls)) {
    if (["background-color", "background-image", "background-size", "background-position", "background-repeat", "color", "border", "border-radius", "box-shadow", "opacity", "transform", "text-decoration"].includes(k)) out[k] = decls[k];
  }
  return out;
}

/** Diferencias entre dos conjuntos (para generar @media mínimos). */
export function diffDecls(prev: Decls, next: Decls): Decls {
  const out: Decls = {};
  for (const k of Object.keys(next)) if (prev[k] !== next[k]) out[k] = next[k];
  for (const k of Object.keys(prev)) if (!(k in next)) out[k] = RESET[k] ?? "initial";
  return out;
}

export function declsToString(d: Decls, important = false): string {
  return Object.entries(d).map(([k, v]) => `${k}:${v}${important ? " !important" : ""}`).join(";");
}

/* ---------- CSS personalizado (saneado) ---------- */

const CSS_PROP = /^[a-z][a-z-]{0,40}$/;
const CSS_FORBIDDEN = /(url\s*\(|expression\s*\(|@import|javascript:|behavior|-moz-binding|\\|<|>|\{|\}|\/\*)/i;

/** Acepta solo declaraciones `propiedad: valor;` simples. Descarta lo demás. */
export function sanitizeCssDecls(input: string, max = 2000): string {
  const out: string[] = [];
  for (const raw of input.slice(0, max).split(";")) {
    const i = raw.indexOf(":");
    if (i < 1) continue;
    const prop = raw.slice(0, i).trim().toLowerCase();
    const value = raw.slice(i + 1).trim();
    if (!CSS_PROP.test(prop) || !value || value.length > 200) continue;
    if (CSS_FORBIDDEN.test(value) || /^(behavior|-moz-binding)$/.test(prop)) continue;
    out.push(`${prop}:${value}`);
  }
  return out.join(";");
}

/* ---------- Contraste ---------- */

export function parseColor(c: string): [number, number, number, number] | null {
  const s = c.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  if (s === "transparent") return [0, 0, 0, 0];
  return null;
}

export function luminance([r, g, b]: [number, number, number, number] | number[]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return null;
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
