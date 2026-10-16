/**
 * Miniatura esquemática de una página (SVG). Es una maqueta fiel a la estructura y a los colores
 * del diseño — no una captura —, barata de generar en el servidor en cada guardado.
 */
import { isGradient, literalColor, resolveStyle, effectiveLayout } from "./model/style";
import { Doc, Node } from "./model/types";

const W = 1000;

interface Shape { svg: string }

function safeColor(c: string): string {
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\))$/i.test(c) ? c : "#888888";
}

function colorOf(doc: Doc, c: unknown, fallback: string): string {
  if (typeof c !== "string") return fallback;
  const lit = literalColor(c, doc.theme);
  return lit === "transparent" ? fallback : safeColor(lit);
}

interface Out { shapes: string[]; defs: string[]; grad: number }

function sidesOf(v: unknown): [number, number, number, number] {
  return Array.isArray(v) && v.length === 4 ? (v as [number, number, number, number]) : [0, 0, 0, 0];
}

function paint(doc: Doc, out: Out, node: Node, x: number, y: number, w: number, h: number): void {
  const st = resolveStyle(node, "desktop");
  const r = typeof st.radius === "number" ? Math.min(st.radius, 40) : 0;
  const bg = st.bg;
  if (bg) {
    if (isGradient(bg)) {
      const id = `g${out.grad++}`;
      const stops = bg.stops.map((s) => `<stop offset="${Math.round(s.p)}%" stop-color="${colorOf(doc, s.c, "#444")}"/>`).join("");
      out.defs.push(`<linearGradient id="${id}" gradientTransform="rotate(${Math.round(bg.angle - 90)} .5 .5)">${stops}</linearGradient>`);
      out.shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${id})"/>`);
    } else {
      const lit = literalColor(bg, doc.theme);
      if (lit !== "transparent") out.shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${safeColor(lit)}"/>`);
    }
  }
  if (st.border && st.border.w > 0) out.shapes.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="${colorOf(doc, st.border.color, "#888")}" stroke-opacity=".5"/>`);
}

/** Maquetación mínima: devuelve la altura ocupada y dibuja las formas. */
function layout(doc: Doc, out: Out, id: string, x: number, y: number, w: number, depth = 0): number {
  const node = doc.nodes[id];
  if (!node || node.hidden || depth > 12) return 0;
  const st = resolveStyle(node, "desktop");
  const pad = sidesOf(st.padding);
  const margin = sidesOf(st.margin);
  const mx = typeof st.maxWidth === "number" && st.maxWidth > 0 && node.type === "section" ? Math.max(pad[3], (w - st.maxWidth) / 2) : pad[3];
  const mr = typeof st.maxWidth === "number" && st.maxWidth > 0 && node.type === "section" ? Math.max(pad[1], (w - st.maxWidth) / 2) : pad[1];
  const innerX = x + mx;
  const innerW = Math.max(10, w - mx - mr);
  const fg = colorOf(doc, st.color, "#999999");

  const leaf = (h: number, draw: (hh: number) => void): number => {
    const top = y + margin[0];
    paintAt(top, h);
    draw(h);
    return h + margin[0] + margin[2];
    function paintAt(t: number, hh: number) { paint(doc, out, node, x, t, w, hh); }
  };

  switch (node.type) {
    case "text": {
      const size = Math.min(st.size ?? 16, 80);
      const chars = String(node.props.text ?? "").length;
      const lines = Math.max(1, Math.min(6, Math.ceil((chars * size * 0.52) / w)));
      const lh = size * (st.lh ?? 1.4);
      const h = lines * lh;
      return leaf(h, () => {
        for (let i = 0; i < lines; i++) {
          const lw = i === lines - 1 && lines > 1 ? w * 0.6 : Math.min(w, chars * size * 0.52);
          const lx = st.textAlign === "center" ? x + (w - lw) / 2 : st.textAlign === "right" ? x + w - lw : x;
          out.shapes.push(`<rect x="${lx.toFixed(1)}" y="${(y + margin[0] + i * lh + lh * 0.2).toFixed(1)}" width="${Math.max(8, lw).toFixed(1)}" height="${(size * 0.62).toFixed(1)}" rx="${(size * 0.3).toFixed(1)}" fill="${fg}" fill-opacity="${(st.weight ?? 400) >= 600 ? 0.9 : 0.5}"/>`);
        }
      });
    }
    case "button": {
      const h = Math.min(60, (st.size ?? 15) * 1.2 + pad[0] + pad[2]);
      const bw = typeof st.w === "number" ? st.w : Math.min(w, String(node.props.text ?? "").length * 9 + pad[1] + pad[3]);
      const bx = st.alignSelf === "center" ? x + (w - bw) / 2 : x;
      return leaf(h, () => {
        const fake = { ...node, parent: null } as Node;
        paint(doc, out, fake, bx, y + margin[0], bw, h);
        out.shapes.push(`<rect x="${(bx + bw * 0.25).toFixed(1)}" y="${(y + margin[0] + h / 2 - 4).toFixed(1)}" width="${(bw * 0.5).toFixed(1)}" height="8" rx="4" fill="${fg}" fill-opacity=".85"/>`);
      });
    }
    case "image":
    case "video": {
      const ratio = Number(node.props.ratio) || 1.5;
      const bw = typeof st.w === "number" ? Math.min(st.w, w) : w;
      const h = typeof st.h === "number" ? st.h : bw / ratio;
      const r = typeof st.radius === "number" ? Math.min(st.radius, 40) : 0;
      return leaf(h, () => {
        out.shapes.push(`<rect x="${x}" y="${y + margin[0]}" width="${bw}" height="${h}" rx="${r}" fill="#7a7a8a" fill-opacity=".35"/>`);
        out.shapes.push(`<path d="M${x + bw * 0.1} ${y + margin[0] + h * 0.85} l${bw * 0.25} -${h * 0.35} l${bw * 0.18} ${h * 0.2} l${bw * 0.2} -${h * 0.3} l${bw * 0.27} ${h * 0.45} z" fill="#fff" fill-opacity=".18"/>`);
      });
    }
    case "icon": {
      const s = typeof st.w === "number" ? st.w : 28;
      return leaf(s, () => out.shapes.push(`<circle cx="${x + s / 2}" cy="${y + margin[0] + s / 2}" r="${s / 2.4}" fill="${fg}" fill-opacity=".7"/>`));
    }
    case "divider":
      return leaf(2, () => out.shapes.push(`<rect x="${x}" y="${y + margin[0]}" width="${w}" height="2" fill="${fg}" fill-opacity=".25"/>`));
    case "shape": {
      const sw = typeof st.w === "number" ? st.w : 100;
      const sh = typeof st.h === "number" ? st.h : 100;
      return leaf(sh, () => paint(doc, out, node, x, y + margin[0], sw, sh));
    }
    case "field":
      return leaf(54, () => out.shapes.push(`<rect x="${x}" y="${y + margin[0] + 18}" width="${w}" height="34" rx="8" fill="none" stroke="#999" stroke-opacity=".5"/>`));
    default:
      break;
  }

  /* contenedores */
  const L = effectiveLayout(node, "desktop");
  const gap = st.gap ?? 0;
  const startY = y + margin[0];
  let cursor = startY + pad[0];
  let used = 0;
  const idx = out.shapes.length;
  const kids = node.children.filter((c) => doc.nodes[c] && !doc.nodes[c].hidden);
  if (L === "free") {
    let maxB = 0;
    for (const c of kids) {
      const cs = resolveStyle(doc.nodes[c], "desktop");
      const cw = typeof cs.w === "number" ? cs.w : innerW * 0.4;
      const hh = layout(doc, out, c, innerX + (cs.x ?? 0), startY + pad[0] + (cs.y ?? 0), cw, depth + 1);
      maxB = Math.max(maxB, (cs.y ?? 0) + hh);
    }
    used = maxB;
  } else if (L === "row") {
    const widths = kids.map((c) => {
      const cs = resolveStyle(doc.nodes[c], "desktop");
      return typeof cs.w === "number" ? cs.w : cs.w === "fill" ? -1 : doc.nodes[c].type === "text" || doc.nodes[c].type === "button" ? Math.min(innerW / Math.max(kids.length, 1), 200) : -1;
    });
    const fixed = widths.filter((v) => v >= 0).reduce((a, b) => a + b, 0) + gap * Math.max(0, kids.length - 1);
    const fills = widths.filter((v) => v < 0).length;
    const fw = fills ? Math.max(30, (innerW - fixed) / fills) : 0;
    let cx = innerX;
    let maxH = 0;
    kids.forEach((c, i) => {
      const cw = widths[i] >= 0 ? widths[i] : fw;
      const hh = layout(doc, out, c, cx, cursor, cw, depth + 1);
      maxH = Math.max(maxH, hh);
      cx += cw + gap;
    });
    used = maxH;
  } else if (L === "grid") {
    const cols = Math.max(1, st.columns ?? 2);
    const cw = (innerW - gap * (cols - 1)) / cols;
    let rowH = 0;
    let total = 0;
    kids.forEach((c, i) => {
      const col = i % cols;
      if (col === 0 && i > 0) { total += rowH + gap; rowH = 0; }
      const hh = layout(doc, out, c, innerX + col * (cw + gap), cursor + total, cw, depth + 1);
      rowH = Math.max(rowH, hh);
    });
    used = total + rowH;
  } else {
    kids.forEach((c, i) => {
      const hh = layout(doc, out, c, innerX, cursor, innerW, depth + 1);
      cursor += hh + (i < kids.length - 1 ? gap : 0);
    });
    used = cursor - (startY + pad[0]);
  }
  const minH = (typeof st.h === "number" ? st.h : 0) || st.minHeight || 0;
  const h = Math.max(minH, used + pad[0] + pad[2]);
  // el fondo del contenedor debe quedar DEBAJO de sus hijos
  const bgOut: Out = { shapes: [], defs: out.defs, grad: out.grad };
  paint(doc, bgOut, node, x, startY, w, h);
  out.grad = bgOut.grad;
  out.shapes.splice(idx, 0, ...bgOut.shapes);
  return h + margin[0] + margin[2];
}

/** Miniatura SVG de la página de inicio (parte superior, formato 5:3). */
export function thumbnailSvg(doc: Doc, pageId?: string): string {
  const page = doc.pages.find((p) => p.id === (pageId ?? doc.settings.homePageId)) ?? doc.pages[0];
  const root = doc.nodes[page.rootId];
  const out: Out = { shapes: [], defs: [], grad: 0 };
  const pageBg = colorOf(doc, resolveStyle(root, "desktop").bg as string, "#111114");
  layout(doc, out, root.id, 0, 0, W);
  const H = 600;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice" role="img" aria-label="Miniatura de la página">` +
    `<defs>${out.defs.join("")}<clipPath id="c"><rect width="${W}" height="${H}"/></clipPath></defs>` +
    `<rect width="${W}" height="${H}" fill="${pageBg}"/><g clip-path="url(#c)">${out.shapes.join("")}</g></svg>`
  );
}
