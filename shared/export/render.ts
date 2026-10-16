/**
 * Generador de sitio: convierte el documento en HTML + CSS + JS estáticos.
 * Es una función pura (sin DOM ni Node): se ejecuta en el navegador (vista previa) y en el servidor (ZIP).
 */
import { resolveFontFamily, diffDecls, declsToString, hoverDecls, innerDecls, nodeDecls, sanitizeCssDecls, Decls } from "../model/style";
import { googleFontsUrl } from "../model/fonts";
import { ICONS, WHATSAPP_PATH } from "../model/icons";
import { Anim, Device, Doc, Node, Page } from "../model/types";
import { ANIM_CSS, BASE_CSS, SITE_JS } from "./runtime";

export interface ExportFile { path: string; content: string }
export interface AssetRef { src: string; path: string }

export interface BuiltPage { page: Page; file: string; html: string }
export interface BuiltSite {
  pages: BuiltPage[];
  css: string;
  js: string;
  /** Recursos locales que deben copiarse junto al sitio (origen → ruta dentro del paquete). */
  assets: AssetRef[];
  files: ExportFile[];
  warnings: string[];
}

export interface BuildOptions {
  /** Nombre de archivo de salida para recursos locales (el servidor lo deduce del tipo real del archivo). */
  assetName?: (src: string) => string | undefined;
  /** Sin etiquetas <script> (miniaturas dentro de un iframe sin permisos de scripts). */
  noScript?: boolean;
  /** `preview`: CSS en línea, recursos sin reescribir y enlaces entre páginas gestionados por el editor. */
  mode: "export" | "preview";
  projectName?: string;
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const cssId = (id: string) => id.replace(/[^a-z0-9_]/gi, "");
const sel = (id: string) => `.n-${cssId(id)}`;

function extOf(src: string): string {
  const m = src.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : "img";
}

class AssetMap {
  private map = new Map<string, string>();
  private used = new Set<string>();
  list: AssetRef[] = [];
  constructor(private readonly keep: boolean, private readonly nameFor?: (src: string) => string | undefined) {}

  /** Devuelve la ruta de salida para una URL de recurso. `from`: contexto desde el que se referencia. */
  ref(src: string, from: "html" | "css"): string {
    if (!src) return "";
    if (this.keep || !src.startsWith("/")) return src;
    let out = this.map.get(src);
    if (!out) {
      const given = this.nameFor?.(src);
      const base = given ?? (src.split("/").pop() || "recurso").split("?")[0].replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
      const hasExt = /\.[a-z0-9]{2,5}$/.test(base);
      let name = hasExt ? base : `${base}.${extOf(src)}`;
      let i = 2;
      while (this.used.has(name)) name = name.replace(/(-\d+)?(\.[a-z0-9]+)$/, `-${i++}$2`);
      this.used.add(name);
      out = `assets/img/${name}`;
      this.map.set(src, out);
      this.list.push({ src, path: out });
    }
    return from === "css" ? out.replace(/^assets\//, "") : out;
  }
}

/* ---------- Utilidades de documento ---------- */

function pageFile(doc: Doc, page: Page): string {
  return page.id === doc.settings.homePageId ? "index.html" : `${page.slug}.html`;
}

export function collectFonts(doc: Doc): Map<string, Set<number>> {
  const used = new Map<string, Set<number>>();
  const add = (family: string, w: number) => {
    if (!family) return;
    if (!used.has(family)) used.set(family, new Set());
    used.get(family)!.add(w);
  };
  add(doc.theme.fonts.heading, 400); add(doc.theme.fonts.heading, 700);
  add(doc.theme.fonts.body, 400); add(doc.theme.fonts.body, 600); add(doc.theme.fonts.body, 700);
  for (const n of Object.values(doc.nodes)) {
    for (const layer of [n.s.base, n.s.tablet, n.s.mobile, n.hover]) {
      if (!layer) continue;
      const fam = resolveFontFamily(layer.font, doc.theme);
      if (fam) add(fam, layer.weight ?? 400);
    }
  }
  return used;
}

function hrefFor(doc: Doc, raw: string, mode: BuildOptions["mode"]): { href: string; page?: string } {
  if (raw.startsWith("page:")) {
    const page = doc.pages.find((p) => p.id === raw.slice(5));
    if (!page) return { href: "#" };
    return mode === "preview" ? { href: "#", page: page.id } : { href: pageFile(doc, page) };
  }
  return { href: raw };
}

function animAttrs(a: Anim | null | undefined, extraDelay = 0, enabled: boolean): string {
  if (!enabled || !a || a.type === "none") return "";
  const style = `--ad:${Math.round(a.duration)}ms;--adl:${Math.round(a.delay + extraDelay)}ms;--ai:${Math.round(a.intensity)}`;
  return ` data-anim="${a.type}" data-anim-trigger="${a.trigger}" style="${style}"`;
}

/* ---------- HTML ---------- */

function iconSvg(name: string, stroke: number): string {
  if (name === "whatsapp") return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${WHATSAPP_PATH}"/></svg>`;
  const d = ICONS[name] ?? ICONS.star;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

interface Ctx {
  doc: Doc;
  assets: AssetMap;
  mode: BuildOptions["mode"];
  warnings: string[];
  animations: boolean;
}

function renderNode(ctx: Ctx, id: string, inherited?: { anim: Anim; index: number }): string {
  const node = ctx.doc.nodes[id];
  if (!node || node.hidden) return "";
  const own = node.anim && node.anim.type !== "none" ? node.anim : null;
  let anim: Anim | null = own;
  let extraDelay = 0;
  if (!own && inherited) { anim = inherited.anim; extraDelay = inherited.index * 90; }
  const staggerChildren = node.anim?.stagger && node.anim.type !== "none" ? node.anim : null;
  const hover = node.anim?.hover && node.anim.hover !== "none" ? ` hfx hfx-${node.anim.hover}` : "";
  const cls = `n n-${node.type} n-${cssId(node.id)}${hover}${node.attrs?.className ? " " + esc(node.attrs.className) : ""}`;
  const idAttr = node.attrs?.elId ? ` id="${esc(node.attrs.elId)}"` : "";
  const a = staggerChildren ? "" : animAttrs(anim, extraDelay, ctx.animations);
  const common = `class="${cls}"${idAttr}${a}`;
  const kids = (inheritStagger = true) => node.children.map((c, i) => renderNode(ctx, c, staggerChildren && ctx.animations && inheritStagger ? { anim: staggerChildren, index: i } : undefined)).join("");
  const p = node.props;

  switch (node.type) {
    case "root": {
      const hasLandmarks = node.children.some((c) => ["header", "footer", "nav"].includes(ctx.doc.nodes[c]?.props.tag));
      return `<div ${common.replace(idAttr, "")} id="${node.attrs?.elId ? esc(node.attrs.elId) : "ic-main"}" tabindex="-1"${hasLandmarks ? "" : ' role="main"'}>${kids()}</div>`;
    }
    case "section":
    case "container": {
      const tag = p.tag || (node.type === "section" ? "section" : "div");
      return `<${tag} ${common}>${kids()}</${tag}>`;
    }
    case "text": {
      const tag = p.tag || "p";
      const text = esc(String(p.text ?? ""));
      const inner = p.href ? `<a href="${esc(hrefFor(ctx.doc, p.href, ctx.mode).href)}"${linkAttrs(ctx, p)}>${text}</a>` : text;
      return `<${tag} ${common}>${inner}</${tag}>`;
    }
    case "button": {
      const icon = p.icon ? iconSvg(p.icon, 2) : "";
      const label = `<span>${esc(String(p.text ?? ""))}</span>`;
      const content = p.iconPos === "right" ? label + icon : icon + label;
      if (p.submit || !p.href) {
        return `<button ${common} type="${p.submit ? "submit" : "button"}"${p.disabled ? " disabled" : ""}>${content}</button>`;
      }
      const h = hrefFor(ctx.doc, p.href, ctx.mode);
      const dis = p.disabled ? ' aria-disabled="true" tabindex="-1"' : "";
      return `<a ${common} href="${esc(h.href)}"${h.page ? ` data-ic-page="${esc(h.page)}"` : ""}${linkAttrs(ctx, p)}${dis}>${content}</a>`;
    }
    case "image": {
      if (!p.src) { ctx.warnings.push(`Imagen sin archivo: «${node.name}»`); return ""; }
      const img = `<img src="${esc(ctx.assets.ref(p.src, "html"))}" alt="${esc(String(p.alt ?? ""))}" loading="lazy" decoding="async">`;
      const inner = p.href ? `<a href="${esc(hrefFor(ctx.doc, p.href, ctx.mode).href)}">${img}</a>` : img;
      return `<div ${common}>${inner}</div>`;
    }
    case "video": {
      if (!p.src) { ctx.warnings.push(`Vídeo sin archivo: «${node.name}»`); return ""; }
      const attrs = [
        p.controls !== false ? "controls" : "", p.autoplay ? "autoplay" : "", p.loop ? "loop" : "", p.muted || p.autoplay ? "muted" : "", "playsinline", 'preload="metadata"',
        p.poster ? `poster="${esc(ctx.assets.ref(p.poster, "html"))}"` : "", p.title ? `title="${esc(p.title)}"` : "",
      ].filter(Boolean).join(" ");
      return `<div ${common}><video src="${esc(ctx.assets.ref(p.src, "html"))}" ${attrs}></video></div>`;
    }
    case "icon": {
      const label = p.label ? ` role="img" aria-label="${esc(p.label)}"` : "";
      return `<span ${common}${label}>${iconSvg(p.name, Number(p.stroke) || 2)}</span>`;
    }
    case "divider":
      return `<hr ${common}>`;
    case "shape":
      return `<div ${common} aria-hidden="true"></div>`;
    case "form": {
      return `<form ${common.replace('class="', 'class="ic-form ')} data-ic-mode="${esc(p.mode || "whatsapp")}" data-ic-to="${esc(p.to || "")}" data-ic-success="${esc(p.successText || "")}">${kids()}</form>`;
    }
    case "field": {
      const fid = `f-${cssId(node.id)}`;
      const req = p.required ? " required" : "";
      const label = esc(String(p.label ?? ""));
      const ph = p.placeholder ? ` placeholder="${esc(p.placeholder)}"` : "";
      const control = p.kind === "textarea"
        ? `<textarea id="${fid}" name="${esc(p.name)}" data-label="${label}" rows="4"${ph}${req}></textarea>`
        : `<input id="${fid}" name="${esc(p.name)}" data-label="${label}" type="${esc(p.kind)}"${ph}${req}${p.kind === "email" ? ' autocomplete="email"' : ""}>`;
      return `<div ${common.replace('class="', 'class="ic-field ')}><label for="${fid}">${label}${p.required ? ' <span aria-hidden="true">*</span>' : ""}</label>${control}</div>`;
    }
  }
  return "";
}

function linkAttrs(ctx: Ctx, p: Record<string, any>): string {
  if (p.target === "_blank") return ' target="_blank" rel="noopener noreferrer"';
  return "";
}

/* ---------- CSS ---------- */

function buildCss(doc: Doc, assets: AssetMap, animations: boolean): string {
  const t = doc.theme;
  const root: string[] = [];
  for (const [k, v] of Object.entries(t.colors)) root.push(`--c-${k.replace(/[^a-z0-9_-]/gi, "")}:${v}`);
  const fam = (f: string) => `"${f.replace(/[^A-Za-z0-9 \-]/g, "")}"`;
  root.push(`--f-heading:${fam(t.fonts.heading)},sans-serif`);
  root.push(`--f-body:${fam(t.fonts.body)},sans-serif`);

  const base: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];
  const bp = doc.settings.breakpoints;

  const emit = (id: string) => {
    const node = doc.nodes[id];
    if (!node || node.hidden) return;
    const d: Record<Device, Decls> = {
      desktop: nodeDecls(doc, node, "desktop"),
      tablet: nodeDecls(doc, node, "tablet"),
      mobile: nodeDecls(doc, node, "mobile"),
    };
    const rewriteUrls = (decls: Decls): Decls => {
      const out: Decls = {};
      for (const [k, v] of Object.entries(decls)) {
        out[k] = k.startsWith("background") ? v.replace(/url\("([^"]+)"\)/g, (_m, u) => `url("${assets.ref(u, "css")}")`) : v;
      }
      return out;
    };
    const s = sel(id);
    const dd = rewriteUrls(d.desktop), dt = rewriteUrls(d.tablet), dm = rewriteUrls(d.mobile);
    // la raíz del documento no necesita position:relative redundante, pero es inocuo
    base.push(`${s}{${declsToString(dd)}}`);
    const ft = diffDecls(dd, dt);
    if (Object.keys(ft).length) tablet.push(`${s}{${declsToString(ft)}}`);
    const fm = diffDecls(dt, dm);
    if (Object.keys(fm).length) mobile.push(`${s}{${declsToString(fm)}}`);

    const inner = innerDecls(node, "desktop");
    if (inner) {
      base.push(`${s}>${inner.sel}{${declsToString(inner.decls)}}`);
      for (const dev of ["tablet", "mobile"] as const) {
        const i2 = innerDecls(node, dev);
        const prev = innerDecls(node, dev === "tablet" ? "desktop" : "tablet");
        if (i2 && prev) {
          const fd = diffDecls(prev.decls, i2.decls);
          if (Object.keys(fd).length) (dev === "tablet" ? tablet : mobile).push(`${s}>${inner.sel}{${declsToString(fd)}}`);
        }
      }
    }
    const hv = hoverDecls(doc, node);
    if (Object.keys(hv).length) base.push(`${s}:hover{${declsToString(hv)}}`);
    if (node.attrs?.css) {
      const css = sanitizeCssDecls(node.attrs.css);
      if (css) base.push(`${s}{${css}}`);
    }
    for (const c of node.children) emit(c);
  };
  for (const p of doc.pages) emit(p.rootId);

  const parts = [
    `:root{${root.join(";")}}`,
    BASE_CSS,
    animations ? ANIM_CSS : "",
    "/* Diseño */",
    ...base,
    tablet.length ? `@media (max-width:${bp.tablet}px){\n${tablet.join("\n")}\n}` : "",
    mobile.length ? `@media (max-width:${bp.mobile}px){\n${mobile.join("\n")}\n}` : "",
  ];
  return parts.filter(Boolean).join("\n");
}

/* ---------- Página y sitio ---------- */

function head(doc: Doc, page: Page, assets: AssetMap, mode: BuildOptions["mode"], css: string, fontsUrl: string | null, noScript = false): string {
  const s = doc.settings;
  const isHome = page.id === s.homePageId;
  const title = page.seo?.title || (isHome ? s.title || s.siteName : `${page.name} — ${s.siteName}`);
  const desc = page.seo?.description || s.description;
  const out: string[] = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
  ];
  if (desc) out.push(`<meta name="description" content="${esc(desc)}">`);
  out.push(`<meta property="og:title" content="${esc(title)}">`, `<meta property="og:type" content="website">`);
  if (desc) out.push(`<meta property="og:description" content="${esc(desc)}">`);
  if (s.favicon) {
    const ref = assets.ref(s.favicon, "html");
    out.push(`<link rel="icon" href="${esc(ref)}">`);
  } else out.push(`<link rel="icon" href="data:,">`);
  if (fontsUrl) out.push(`<link rel="preconnect" href="https://fonts.googleapis.com">`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, `<link rel="stylesheet" href="${esc(fontsUrl)}">`);
  if (mode === "preview") { out.push(`<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`); if (!noScript) out.push(`<script src="/forja/studio/assets/js/site.js"></script>`); }
  else out.push(`<link rel="stylesheet" href="assets/styles.css">`, `<script src="assets/site.js"></script>`);
  return out.join("\n");
}

export function buildSite(doc: Doc, opts: BuildOptions): BuiltSite {
  const warnings: string[] = [];
  const assets = new AssetMap(opts.mode === "preview", opts.assetName);
  const animations = doc.settings.animations;
  const ctx: Ctx = { doc, assets, mode: opts.mode, warnings, animations };
  const css = buildCss(doc, assets, animations);
  const fontsUrl = googleFontsUrl(collectFonts(doc));
  const pages: BuiltPage[] = [];
  for (const page of doc.pages) {
    const body = renderNode(ctx, page.rootId);
    const html = `<!doctype html>\n<html lang="${esc(doc.settings.lang)}">\n<head>\n${head(doc, page, assets, opts.mode, css, fontsUrl, opts.noScript)}\n</head>\n<body>\n<a class="ic-skip" href="#${esc(doc.nodes[page.rootId]?.attrs?.elId || "ic-main")}">Saltar al contenido</a>\n${body}\n</body>\n</html>\n`;
    pages.push({ page, file: pageFile(doc, page), html });
  }
  const files: ExportFile[] = [];
  if (opts.mode === "export") {
    for (const p of pages) files.push({ path: p.file, content: p.html });
    files.push({ path: "assets/styles.css", content: css });
    files.push({ path: "assets/site.js", content: SITE_JS });
    files.push({ path: "robots.txt", content: robots(doc) });
    if (doc.settings.siteUrl) files.push({ path: "sitemap.xml", content: sitemap(doc, pages) });
    files.push({ path: "README.md", content: readme(doc, opts.projectName ?? doc.settings.siteName, pages) });
  }
  return { pages, css, js: SITE_JS, assets: assets.list, files, warnings };
}

function robots(doc: Doc): string {
  const base = doc.settings.siteUrl.replace(/\/$/, "");
  return `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ""}`;
}

function sitemap(doc: Doc, pages: BuiltPage[]): string {
  const base = doc.settings.siteUrl.replace(/\/$/, "");
  const urls = pages.map((p) => `  <url><loc>${esc(base + "/" + (p.file === "index.html" ? "" : p.file))}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function readme(doc: Doc, name: string, pages: BuiltPage[]): string {
  const list = pages.map((p) => `- \`${p.file}\` — ${p.page.name}`).join("\n");
  return `# ${name}

Sitio web estático generado con **ICARUS Website Builder**.

## Contenido

${list}
- \`assets/styles.css\` — estilos (incluye la versión para tableta y móvil)
- \`assets/site.js\` — animaciones y formularios
- \`assets/img/\` — imágenes y recursos del sitio
- \`robots.txt\`${doc.settings.siteUrl ? ", `sitemap.xml`" : ""}

## Cómo verlo

Abre \`index.html\` en tu navegador. No necesita instalación ni servidor.

## Cómo publicarlo

Sube **todo el contenido de esta carpeta** (manteniendo la estructura) a cualquier alojamiento de sitios estáticos:
Netlify, Vercel, GitHub Pages, Cloudflare Pages o el hosting de tu proveedor. Si tienes hosting tradicional, copia los archivos a la carpeta pública (\`public_html\`).

## Notas

- Las tipografías se cargan desde Google Fonts (se necesita conexión a internet la primera vez). Si no están disponibles, el navegador usa una fuente alternativa.
- Los formularios abren WhatsApp o tu aplicación de correo con el mensaje preparado; este paquete no incluye un servidor que reciba formularios.
- Las animaciones respetan la preferencia de «reducir movimiento» del sistema operativo.
- Este paquete no contiene el editor ni datos personales del proyecto.

Generado el ${new Date().toISOString().slice(0, 10)}.
`;
}

/** Todas las URLs locales (empiezan por «/») que el documento referencia. */
export function collectLocalAssets(doc: Doc): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => { if (typeof v === "string" && v.startsWith("/")) out.add(v); };
  add(doc.settings.favicon);
  for (const n of Object.values(doc.nodes)) {
    if (n.hidden) continue;
    add(n.props.src); add(n.props.poster);
    for (const layer of [n.s.base, n.s.tablet, n.s.mobile]) add(layer?.bgImage?.src);
  }
  return [...out];
}
