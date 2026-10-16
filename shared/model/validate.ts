/**
 * Validación y saneamiento del documento. Se usa al importar proyectos (cliente) y SIEMPRE en el
 * servidor antes de guardar o exportar. Nunca confía en la estructura recibida: reconstruye un
 * documento limpio, descarta lo desconocido y repara referencias rotas.
 */
import { isKnownFont } from "./fonts";
import { ICONS } from "./icons";
import { sanitizeCssDecls } from "./style";
import { STATIC_IMAGE_PREFIXES } from "../library";
import { slugify } from "./doc";
import {
  Anim, CONTAINER_TYPES, DEFAULT_BREAKPOINTS, Doc, Node, NODE_TYPES, NodeType, Page, PartialStyle, Settings, Theme,
} from "./types";

export const LIMITS = { maxNodes: 4000, maxPages: 30, maxDepth: 40, maxText: 20000 };

export interface ValidationResult {
  ok: boolean;
  doc?: Doc;
  errors: string[];
  warnings: string[];
}

/* ---------- Primitivas ---------- */

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 500): string => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "");
const num = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const bool = (v: unknown): boolean => v === true;
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)|hsla?\(\s*[\d.]+(?:deg)?\s*[, ]\s*[\d.]+%\s*[, ]\s*[\d.]+%\s*(?:[,/]\s*[\d.]+%?\s*)?\)|transparent|currentcolor|\$[a-z0-9_-]{1,24})$/i;
export function isSafeColor(c: unknown): c is string {
  return typeof c === "string" && c.length <= 64 && COLOR_RE.test(c.trim());
}
const color = (v: unknown, def: string | null = null): string | null => (isSafeColor(v) ? (v as string).trim() : def);

/** Rutas de recursos permitidas: recursos subidos, biblioteca incluida o https. */
export function isSafeAssetSrc(src: unknown): src is string {
  if (typeof src !== "string") return false;
  if (src === "") return true;
  if (src.length > 2000 || /[\s"'()<>\\\u0000-\u001F]/.test(src)) return false;
  if (/^\/api\/assets\/[a-z0-9_-]{6,60}$/i.test(src)) return true;
  if (STATIC_IMAGE_PREFIXES.some((p) => src.startsWith(p) && !src.includes(".."))) return true;
  return /^https:\/\/[^/]+\/.*$|^https:\/\/[^/]+$/i.test(src);
}

/** Destinos de enlace permitidos. `page:<id>` apunta a otra página del proyecto. */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  if (href === "") return true;
  if (href.length > 2000 || /[\s"'<>\\\u0000-\u001F]/.test(href)) return false;
  return /^(#[\w-]*|page:[a-z0-9_]+|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\-().]+)$/i.test(href);
}

const href = (v: unknown): string => (isSafeHref(v) ? v : "");
const asset = (v: unknown): string => (isSafeAssetSrc(v) ? v : "");

/* ---------- Estilos ---------- */

const LAYOUTS = ["stack", "row", "grid", "free"] as const;
const JUSTIFY = ["start", "center", "end", "between", "around"] as const;
const ALIGN = ["start", "center", "end", "stretch"] as const;
const ALIGN_SELF = ["auto", "start", "center", "end", "stretch"] as const;
const TRANSFORMS = ["none", "uppercase", "lowercase", "capitalize"] as const;
const TEXT_ALIGN = ["left", "center", "right", "justify"] as const;
const FITS = ["cover", "contain", "fill"] as const;

function dim(v: unknown): number | string | undefined {
  if (v === "auto" || v === "fill") return v;
  if (typeof v === "number" && Number.isFinite(v)) return Math.min(20000, Math.max(0, v));
  if (typeof v === "string" && /^\d{1,3}(\.\d+)?%$/.test(v) && parseFloat(v) <= 1000) return v;
  return undefined;
}

function sides(v: unknown, max = 2000): [number, number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 4) return undefined;
  return v.map((x) => num(x, -max, max, 0)) as [number, number, number, number];
}

function fill(v: unknown): any {
  if (typeof v === "string") return color(v);
  if (isObj(v) && Array.isArray(v.stops)) {
    const stops = v.stops
      .slice(0, 8)
      .map((s: any) => ({ c: color(s?.c, "#000000")!, p: num(s?.p, 0, 100, 0) }))
      .filter(Boolean);
    if (stops.length >= 2) return { kind: v.kind === "radial" ? "radial" : "linear", angle: num(v.angle, -360, 360, 180), stops };
  }
  return null;
}

export function sanitizeStyle(raw: unknown): PartialStyle {
  if (!isObj(raw)) return {};
  const o: Record<string, any> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) o[k] = v; };
  if ("layout" in raw) set("layout", oneOf(raw.layout, LAYOUTS, "stack"));
  if ("gap" in raw) set("gap", num(raw.gap, 0, 400, 0));
  if ("columns" in raw) set("columns", Math.round(num(raw.columns, 1, 12, 2)));
  if ("wrap" in raw) set("wrap", bool(raw.wrap));
  if ("justify" in raw) set("justify", oneOf(raw.justify, JUSTIFY, "start"));
  if ("align" in raw) set("align", oneOf(raw.align, ALIGN, "stretch"));
  if ("maxWidth" in raw) set("maxWidth", raw.maxWidth === null ? null : num(raw.maxWidth, 0, 4000, 0));
  if ("minHeight" in raw) set("minHeight", raw.minHeight === null ? null : num(raw.minHeight, 0, 10000, 0));
  if ("x" in raw) set("x", num(raw.x, -10000, 10000, 0));
  if ("y" in raw) set("y", num(raw.y, -10000, 20000, 0));
  if ("w" in raw) set("w", dim(raw.w));
  if ("h" in raw) set("h", dim(raw.h));
  if ("colSpan" in raw) set("colSpan", Math.round(num(raw.colSpan, 1, 12, 1)));
  if ("alignSelf" in raw) set("alignSelf", oneOf(raw.alignSelf, ALIGN_SELF, "auto"));
  if ("rotate" in raw) set("rotate", num(raw.rotate, -360, 360, 0));
  if ("opacity" in raw) set("opacity", num(raw.opacity, 0, 1, 1));
  if ("margin" in raw) set("margin", sides(raw.margin, 1000));
  if ("padding" in raw) set("padding", sides(raw.padding, 1000));
  if ("bg" in raw) set("bg", raw.bg === null ? null : fill(raw.bg));
  if ("bgImage" in raw) {
    const b = raw.bgImage;
    set("bgImage", isObj(b) && asset(b.src)
      ? { src: asset(b.src), fit: oneOf(b.fit, ["cover", "contain", "repeat"] as const, "cover"), pos: /^[a-z0-9% ]{1,30}$/i.test(String(b.pos)) ? String(b.pos) : "center", ...(color(b.overlay) ? { overlay: color(b.overlay)! } : {}) }
      : null);
  }
  if ("border" in raw) {
    const b = raw.border;
    set("border", isObj(b) && num(b.w, 0, 40, 0) > 0
      ? { w: num(b.w, 0, 40, 0), color: color(b.color, "#888888")!, style: oneOf(b.style, ["solid", "dashed", "dotted"] as const, "solid") }
      : null);
  }
  if ("radius" in raw) set("radius", Array.isArray(raw.radius) ? sides(raw.radius, 999) : num(raw.radius, 0, 999, 0));
  if ("shadow" in raw && Array.isArray(raw.shadow)) {
    set("shadow", raw.shadow.slice(0, 4).filter(isObj).map((s: any) => ({
      x: num(s.x, -200, 200, 0), y: num(s.y, -200, 200, 0), blur: num(s.blur, 0, 300, 0), spread: num(s.spread, -200, 200, 0),
      color: color(s.color, "rgba(0,0,0,0.3)")!, ...(s.inset ? { inset: true } : {}),
    })));
  }
  if ("overflow" in raw) set("overflow", oneOf(raw.overflow, ["visible", "hidden"] as const, "visible"));
  if ("font" in raw) set("font", raw.font === "$heading" || raw.font === "$body" || (typeof raw.font === "string" && isKnownFont(raw.font)) ? raw.font : undefined);
  if ("size" in raw) set("size", num(raw.size, 6, 400, 16));
  if ("weight" in raw) set("weight", Math.round(num(raw.weight, 100, 900, 400) / 100) * 100);
  if ("italic" in raw) set("italic", bool(raw.italic));
  if ("underline" in raw) set("underline", bool(raw.underline));
  if ("transform" in raw) set("transform", oneOf(raw.transform, TRANSFORMS, "none"));
  if ("color" in raw) set("color", color(raw.color) ?? undefined);
  if ("textAlign" in raw) set("textAlign", oneOf(raw.textAlign, TEXT_ALIGN, "left"));
  if ("lh" in raw) set("lh", num(raw.lh, 0.6, 4, 1.5));
  if ("ls" in raw) set("ls", num(raw.ls, -10, 40, 0));
  if ("fit" in raw) set("fit", oneOf(raw.fit, FITS, "cover"));
  if ("hide" in raw) set("hide", bool(raw.hide));
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o as PartialStyle;
}

/* ---------- Props por tipo ---------- */

const TEXT_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "div", "blockquote"] as const;
const BOX_TAGS = ["div", "section", "header", "footer", "nav", "main", "article", "aside", "ul"] as const;

export function sanitizeProps(type: NodeType, p: unknown): Record<string, any> {
  const r = isObj(p) ? p : {};
  switch (type) {
    case "text":
      return { text: str(r.text, 20000), tag: oneOf(r.tag, TEXT_TAGS, "p"), href: href(r.href), target: oneOf(r.target, ["_self", "_blank"] as const, "_self") };
    case "button":
      return {
        text: str(r.text, 200), href: href(r.href), target: oneOf(r.target, ["_self", "_blank"] as const, "_self"),
        icon: typeof r.icon === "string" && (r.icon in ICONS || r.icon === "whatsapp") ? r.icon : "", iconPos: oneOf(r.iconPos, ["left", "right"] as const, "left"),
        submit: bool(r.submit), disabled: bool(r.disabled),
      };
    case "image":
      return {
        src: asset(r.src), alt: str(r.alt, 300), focalX: num(r.focalX, 0, 100, 50), focalY: num(r.focalY, 0, 100, 50),
        zoom: num(r.zoom, 1, 4, 1), ratio: num(r.ratio, 0.1, 10, 1.5), lock: bool(r.lock), href: href(r.href),
      };
    case "video":
      return {
        src: asset(r.src), poster: asset(r.poster), controls: r.controls !== false, autoplay: bool(r.autoplay), loop: bool(r.loop),
        muted: bool(r.muted) || bool(r.autoplay), ratio: num(r.ratio, 0.1, 10, 1.7778), focalX: num(r.focalX, 0, 100, 50), focalY: num(r.focalY, 0, 100, 50),
        title: str(r.title, 200),
      };
    case "icon":
      return { name: typeof r.name === "string" && (r.name in ICONS || r.name === "whatsapp") ? r.name : "star", stroke: num(r.stroke, 0.5, 4, 2), label: str(r.label, 120) };
    case "shape":
      return { shape: oneOf(r.shape, ["rect", "ellipse", "line"] as const, "rect") };
    case "form":
      return { mode: oneOf(r.mode, ["whatsapp", "mailto"] as const, "whatsapp"), to: str(r.to, 120).replace(/[^\w@.+\-]/g, ""), successText: str(r.successText, 300), tag: "div" };
    case "field":
      return {
        label: str(r.label, 120), kind: oneOf(r.kind, ["text", "email", "tel", "number", "textarea"] as const, "text"),
        name: str(r.name, 40).replace(/[^a-z0-9_]/gi, "_") || "campo", placeholder: str(r.placeholder, 120), required: bool(r.required),
      };
    case "root":
    case "section":
    case "container":
      return { tag: oneOf(r.tag, BOX_TAGS, type === "section" ? "section" : "div") };
    default:
      return {};
  }
}

const ANIM_TYPES = ["none", "fade", "slide-up", "slide-down", "slide-left", "slide-right", "scale", "zoom-out", "blur", "rotate"] as const;
function sanitizeAnim(a: unknown): Anim | null {
  if (!isObj(a)) return null;
  const type = oneOf(a.type, ANIM_TYPES, "none");
  const hover = oneOf(a.hover, ["none", "lift", "grow", "glow", "shrink"] as const, "none");
  if (type === "none" && hover === "none") return null;
  return {
    type, trigger: oneOf(a.trigger, ["load", "scroll"] as const, "scroll"), duration: num(a.duration, 50, 5000, 700),
    delay: num(a.delay, 0, 5000, 0), intensity: num(a.intensity, 0, 100, 50), stagger: bool(a.stagger), hover,
  };
}

/* ---------- Documento ---------- */

export function validateDoc(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (m: string): ValidationResult => ({ ok: false, errors: [m, ...errors], warnings });

  if (!isObj(input)) return fail("El documento no es un objeto válido.");
  if (input.v !== 1) return fail("Versión de documento no soportada.");
  if (!Array.isArray(input.pages) || input.pages.length < 1) return fail("El proyecto debe tener al menos una página.");
  if (input.pages.length > LIMITS.maxPages) return fail(`Máximo ${LIMITS.maxPages} páginas.`);
  if (!isObj(input.nodes)) return fail("Falta el árbol de elementos.");
  const keys = Object.keys(input.nodes);
  if (keys.length > LIMITS.maxNodes) return fail(`Demasiados elementos (máximo ${LIMITS.maxNodes}).`);

  /* nodos */
  const nodes: Record<string, Node> = {};
  const ID_RE = /^[a-z0-9_]{3,40}$/;
  for (const key of keys) {
    const r = input.nodes[key];
    if (!isObj(r) || !ID_RE.test(key) || r.id !== key) { warnings.push(`Elemento descartado: ${key}`); continue; }
    if (!NODE_TYPES.includes(r.type)) { warnings.push(`Tipo desconocido en ${key}`); continue; }
    const type = r.type as NodeType;
    const s: Node["s"] = { base: sanitizeStyle(r.s?.base) };
    const t = sanitizeStyle(r.s?.tablet);
    const m = sanitizeStyle(r.s?.mobile);
    if (Object.keys(t).length) s.tablet = t;
    if (Object.keys(m).length) s.mobile = m;
    const node: Node = {
      id: key, type, name: str(r.name, 120) || type, parent: typeof r.parent === "string" ? r.parent : null,
      children: Array.isArray(r.children) ? r.children.filter((c: unknown) => typeof c === "string" && ID_RE.test(c)) : [],
      props: sanitizeProps(type, r.props), s,
    };
    if (isObj(r.hover)) { const h = sanitizeStyle(r.hover); if (Object.keys(h).length) node.hover = h; }
    if (r.locked === true) node.locked = true;
    if (r.hidden === true) node.hidden = true;
    const an = sanitizeAnim(r.anim);
    if (an) node.anim = an;
    if (isObj(r.attrs)) {
      const attrs: Node["attrs"] = {};
      const elId = str(r.attrs.elId, 60);
      if (/^[A-Za-z][\w-]*$/.test(elId)) attrs.elId = elId;
      const cls = str(r.attrs.className, 200).split(/\s+/).filter((c) => /^[A-Za-z_][\w-]{0,40}$/.test(c)).join(" ");
      if (cls) attrs.className = cls;
      const css = sanitizeCssDecls(str(r.attrs.css, 2000));
      if (css) attrs.css = css;
      if (Object.keys(attrs).length) node.attrs = attrs;
    }
    nodes[key] = node;
  }

  /* páginas */
  const pages: Page[] = [];
  const slugs = new Set<string>();
  const pageIds = new Set<string>();
  for (const rp of input.pages) {
    if (!isObj(rp) || typeof rp.id !== "string" || !ID_RE.test(rp.id) || pageIds.has(rp.id)) { warnings.push("Página descartada (id inválido)."); continue; }
    const root = typeof rp.rootId === "string" ? nodes[rp.rootId] : undefined;
    if (!root || root.type !== "root") { warnings.push(`Página «${str(rp.name, 40)}» sin raíz válida: descartada.`); continue; }
    let slug = slugify(str(rp.slug, 60) || str(rp.name, 60));
    const base = slug;
    let i = 2;
    while (slugs.has(slug)) slug = `${base}-${i++}`;
    slugs.add(slug);
    pageIds.add(rp.id);
    const page: Page = { id: rp.id, name: str(rp.name, 80) || "Página", slug, rootId: root.id };
    if (isObj(rp.seo)) page.seo = { title: str(rp.seo.title, 120), description: str(rp.seo.description, 300) };
    pages.push(page);
  }
  if (!pages.length) return fail("Ninguna página válida.");

  /* integridad del árbol: alcanzables desde las raíces, sin ciclos, con padres coherentes */
  const reachable = new Set<string>();
  const rootIds = new Set(pages.map((p) => p.rootId));
  const visit = (id: string, parent: string | null, depth: number): boolean => {
    if (reachable.has(id)) { warnings.push("Elemento duplicado en el árbol."); return false; }
    const n = nodes[id];
    if (!n) return false;
    if (depth > LIMITS.maxDepth) { warnings.push("Anidación demasiado profunda: recortada."); return false; }
    reachable.add(id);
    n.parent = parent;
    n.children = n.children.filter((c) => visit(c, id, depth + 1));
    if (!CONTAINER_TYPES.includes(n.type) && n.children.length) n.children = [];
    return true;
  };
  for (const p of pages) visit(p.rootId, null, 0);
  for (const id of Object.keys(nodes)) if (!reachable.has(id)) delete nodes[id];
  for (const id of rootIds) if (nodes[id]) nodes[id].parent = null;

  /* tema */
  const theme: Theme = { colors: {}, fonts: { heading: "Manrope", body: "Manrope" } };
  if (isObj(input.theme?.colors)) {
    for (const [k, v] of Object.entries(input.theme.colors).slice(0, 30)) {
      if (/^[a-z0-9_-]{1,24}$/.test(k) && isSafeColor(v) && !String(v).startsWith("$")) theme.colors[k] = String(v).trim();
    }
  }
  for (const req of ["primary", "bg", "text"]) if (!theme.colors[req]) theme.colors[req] = req === "primary" ? "#b3261e" : req === "bg" ? "#0b0b0d" : "#f3f1ec";
  if (isObj(input.theme?.fonts)) {
    if (isKnownFont(input.theme.fonts.heading)) theme.fonts.heading = input.theme.fonts.heading;
    if (isKnownFont(input.theme.fonts.body)) theme.fonts.body = input.theme.fonts.body;
  }
  const savedColors = Array.isArray(input.savedColors) ? input.savedColors.filter((c: unknown) => isSafeColor(c) && !String(c).startsWith("$")).slice(0, 24) : [];

  /* ajustes */
  const rs = isObj(input.settings) ? input.settings : {};
  const bp = isObj(rs.breakpoints) ? rs.breakpoints : {};
  const homePageId = typeof rs.homePageId === "string" && pageIds.has(rs.homePageId) ? rs.homePageId : pages[0].id;
  const settings: Settings = {
    siteName: str(rs.siteName, 80) || "Mi sitio",
    lang: /^[a-z]{2}(-[A-Z]{2})?$/.test(str(rs.lang, 8)) ? str(rs.lang, 8) : "es",
    title: str(rs.title, 120),
    description: str(rs.description, 300),
    favicon: asset(rs.favicon),
    homePageId,
    breakpoints: {
      tablet: Math.round(num(bp.tablet, 480, 1600, DEFAULT_BREAKPOINTS.tablet)),
      mobile: Math.round(num(bp.mobile, 320, 1200, DEFAULT_BREAKPOINTS.mobile)),
    },
    animations: rs.animations !== false,
    siteUrl: typeof rs.siteUrl === "string" && /^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w\-./]*)?$/i.test(rs.siteUrl) ? rs.siteUrl : "",
  };
  if (settings.breakpoints.mobile >= settings.breakpoints.tablet) settings.breakpoints.mobile = Math.max(320, settings.breakpoints.tablet - 200);

  /* tokens de color inexistentes → se avisan (no se rompen: el CSS usa var() con alternativa) */
  const doc: Doc = { v: 1, pages, nodes, theme, savedColors, settings };
  return { ok: true, doc, errors, warnings };
}
