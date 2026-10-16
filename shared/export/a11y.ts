/** Revisión básica de accesibilidad y calidad del diseño (no sustituye una auditoría completa). */
import { contrastRatio, literalColor, resolveStyle, isGradient } from "../model/style";
import { pageOfNode, walk } from "../model/doc";
import { Doc, Node } from "../model/types";

export type IssueLevel = "error" | "warning";

export interface A11yIssue {
  level: IssueLevel;
  code: string;
  message: string;
  nodeId?: string;
  pageId?: string;
}

/** Fondo sólido más cercano (hacia arriba) para estimar el contraste del texto. */
function backgroundOf(doc: Doc, node: Node): string | null {
  let cur: Node | undefined = node;
  while (cur) {
    const st = resolveStyle(cur, "desktop");
    if (st.bgImage?.src) return st.bgImage.overlay ? literalColor(st.bgImage.overlay, doc.theme) : null;
    const bg = st.bg;
    if (bg) {
      if (isGradient(bg)) return literalColor(bg.stops[0]?.c, doc.theme);
      const lit = literalColor(bg, doc.theme);
      if (lit !== "transparent") return lit;
    }
    cur = cur.parent ? doc.nodes[cur.parent] : undefined;
  }
  return null;
}

export function checkAccessibility(doc: Doc): A11yIssue[] {
  const issues: A11yIssue[] = [];
  for (const page of doc.pages) {
    let h1 = 0;
    let lastLevel = 0;
    const seenIds = new Set<string>();
    walk(doc, page.rootId, (n) => {
      if (n.hidden) return;
      const at = { nodeId: n.id, pageId: page.id };
      const p = n.props;
      if (n.type === "image" && p.src && !String(p.alt ?? "").trim()) {
        issues.push({ level: "warning", code: "img-alt", message: `La imagen «${n.name}» no tiene texto alternativo.`, ...at });
      }
      if (n.type === "image" && !p.src) issues.push({ level: "warning", code: "img-empty", message: `La imagen «${n.name}» no tiene archivo y no se publicará.`, ...at });
      if (n.type === "text") {
        const m = /^h([1-6])$/.exec(p.tag ?? "");
        if (m) {
          const lvl = Number(m[1]);
          if (lvl === 1) h1++;
          if (lastLevel && lvl > lastLevel + 1) issues.push({ level: "warning", code: "heading-skip", message: `Salto de nivel de encabezado (h${lastLevel} → h${lvl}) en «${n.name}».`, ...at });
          lastLevel = lvl;
        }
        if (!String(p.text ?? "").trim()) issues.push({ level: "warning", code: "text-empty", message: `El texto «${n.name}» está vacío.`, ...at });
        const fg = literalColor(resolveStyle(n, "desktop").color ?? inheritedColor(doc, n), doc.theme);
        const bg = backgroundOf(doc, n);
        if (fg && bg && String(p.text ?? "").trim()) {
          const ratio = contrastRatio(fg, bg);
          const size = resolveStyle(n, "desktop").size ?? 16;
          const min = size >= 24 ? 3 : 4.5;
          if (ratio !== null && ratio < min) {
            issues.push({ level: "warning", code: "contrast", message: `Poco contraste (${ratio.toFixed(1)}:1) en «${n.name}». Se recomienda al menos ${min}:1.`, ...at });
          }
        }
      }
      if (n.type === "button") {
        if (!String(p.text ?? "").trim() && !p.icon) issues.push({ level: "error", code: "button-name", message: `El botón «${n.name}» no tiene texto.`, ...at });
        if (!p.submit && !p.href) issues.push({ level: "warning", code: "button-link", message: `El botón «${n.name}» no tiene destino.`, ...at });
        if (p.href && p.href.startsWith("page:") && !doc.pages.some((x) => x.id === p.href.slice(5))) issues.push({ level: "error", code: "broken-link", message: `El botón «${n.name}» apunta a una página que ya no existe.`, ...at });
      }
      if (n.type === "text" && p.href && p.href.startsWith("page:") && !doc.pages.some((x) => x.id === p.href.slice(5))) {
        issues.push({ level: "error", code: "broken-link", message: `El enlace «${n.name}» apunta a una página que ya no existe.`, ...at });
      }
      if (n.type === "form" && !p.to) issues.push({ level: "warning", code: "form-dest", message: `El formulario «${n.name}» no tiene destino (WhatsApp o correo).`, ...at });
      if (n.type === "field" && !String(p.label ?? "").trim()) issues.push({ level: "error", code: "field-label", message: `El campo «${n.name}» no tiene etiqueta.`, ...at });
      if (n.type === "video" && !p.src) issues.push({ level: "warning", code: "video-empty", message: `El vídeo «${n.name}» no tiene archivo.`, ...at });
      if (n.attrs?.elId) {
        if (seenIds.has(n.attrs.elId)) issues.push({ level: "error", code: "dup-id", message: `Identificador repetido: «${n.attrs.elId}».`, ...at });
        seenIds.add(n.attrs.elId);
      }
    });
    if (h1 === 0) issues.push({ level: "warning", code: "no-h1", message: `La página «${page.name}» no tiene un título principal (h1).`, pageId: page.id });
    if (h1 > 1) issues.push({ level: "warning", code: "multi-h1", message: `La página «${page.name}» tiene ${h1} títulos principales (h1).`, pageId: page.id });
  }
  if (!doc.settings.description) issues.push({ level: "warning", code: "seo-desc", message: "Falta la descripción SEO del sitio." });
  if (!doc.settings.title.trim()) issues.push({ level: "warning", code: "seo-title", message: "Falta el título SEO del sitio." });
  return issues;
}

function inheritedColor(doc: Doc, n: Node): string | undefined {
  let cur: Node | undefined = n.parent ? doc.nodes[n.parent] : undefined;
  while (cur) {
    const c = resolveStyle(cur, "desktop").color;
    if (c) return c;
    cur = cur.parent ? doc.nodes[cur.parent] : undefined;
  }
  return undefined;
}

export function summarize(doc: Doc, id: string): string {
  const page = pageOfNode(doc, id);
  return page ? page.name : "";
}
