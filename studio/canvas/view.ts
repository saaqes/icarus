/**
 * Renderizador del lienzo. Dibuja la página dentro de un Shadow DOM (los estilos del diseño no afectan a
 * la interfaz del editor, ni al revés) reutilizando el MISMO motor de estilos que la exportación.
 * Es incremental: solo se vuelven a aplicar los nodos cuya referencia cambió.
 */
import { collectFonts } from "../../shared/export/render";
import { BASE_CSS } from "../../shared/export/runtime";
import { googleFontsUrl } from "../../shared/model/fonts";
import { ICONS, WHATSAPP_PATH } from "../../shared/model/icons";
import { declsToString, innerDecls, isFreeFallback, nodeDecls, resolveStyle } from "../../shared/model/style";
import { Device, Doc, Node } from "../../shared/model/types";
import { Rect } from "../core/editor";
import { assetUrl, resolveCss } from "../lib/assetres";

const EDITOR_CSS = `
:host{all:initial;display:block;contain:layout style}
.__root{position:relative;min-height:100%;isolation:isolate}
*{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
[data-nid]{-webkit-tap-highlight-color:transparent}
img,video,svg,.ph{pointer-events:none}
.n-image,.n-video{background:rgba(127,127,140,.18)}
.ph{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.55);font:600 13px system-ui,sans-serif;background:repeating-linear-gradient(45deg,rgba(127,127,140,.25) 0 10px,rgba(127,127,140,.12) 10px 20px)}
.is-empty{min-height:72px!important;outline:1px dashed rgba(167,139,250,.65);outline-offset:-1px;background-image:linear-gradient(rgba(167,139,250,.07),rgba(167,139,250,.07))}
.is-empty::after{content:"Suelta elementos aquí";position:absolute;inset:0;display:grid;place-items:center;font:500 12px system-ui,sans-serif;color:rgba(167,139,250,.9);pointer-events:none}
.is-dev-hidden{opacity:.28!important;outline:1px dashed #f59e0b;outline-offset:-1px}
.n-text:empty::before{content:"Texto vacío";opacity:.4}
.is-editing{-webkit-user-select:text!important;user-select:text!important;cursor:text!important;outline:2px solid #a78bfa!important;outline-offset:2px;caret-color:currentColor}
.is-editing *{-webkit-user-select:text;user-select:text}
.fake-input{border:1px solid rgba(128,128,128,.45);border-radius:10px;padding:12px 14px;min-height:44px;font-size:.95em;opacity:.7}
.n-field label{font-size:.875em;font-weight:600}
.n-button .lbl{pointer-events:none}
.n-button[data-disabled]{opacity:.5}
`;

interface Entry { el: HTMLElement; inner: HTMLElement | null; node: Node; parentNode: Node | undefined; key: string }

export interface RenderOpts {
  device: Device;
  /** Id con el que se previsualiza el estado hover (el seleccionado, si el panel lo pide). */
  hoverStateId: string | null;
  /** Id del texto en edición: su contenido no se sobrescribe. */
  editingId: string | null;
}

const NS = "http://www.w3.org/2000/svg";

function svgIcon(name: string, stroke: number): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const p = document.createElementNS(NS, "path");
  if (name === "whatsapp") { svg.setAttribute("fill", "currentColor"); p.setAttribute("d", WHATSAPP_PATH); }
  else {
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", String(stroke));
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    p.setAttribute("d", ICONS[name] ?? ICONS.star);
  }
  svg.appendChild(p);
  return svg;
}

export class CanvasView {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  private mount: HTMLElement;
  private themeStyle: HTMLStyleElement;
  private entries = new Map<string, Entry>();
  private themeKey = "";
  private fontLink: HTMLLinkElement | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.shadow = host.attachShadow({ mode: "open" });
    const base = document.createElement("style");
    base.textContent = BASE_CSS.replace(/html\{[^}]*\}/, "").replace(/body\{[^}]*\}/, "") + EDITOR_CSS;
    this.themeStyle = document.createElement("style");
    this.mount = document.createElement("div");
    this.mount.className = "__root";
    this.shadow.append(base, this.themeStyle, this.mount);
  }

  /* ---------- Tema y tipografías ---------- */

  private syncTheme(doc: Doc): void {
    const key = JSON.stringify(doc.theme);
    if (key === this.themeKey) return;
    this.themeKey = key;
    const vars: string[] = [];
    for (const [k, v] of Object.entries(doc.theme.colors)) vars.push(`--c-${k.replace(/[^a-z0-9_-]/gi, "")}:${v}`);
    const fam = (f: string) => `"${f.replace(/[^A-Za-z0-9 \-]/g, "")}"`;
    vars.push(`--f-heading:${fam(doc.theme.fonts.heading)},sans-serif`, `--f-body:${fam(doc.theme.fonts.body)},sans-serif`);
    this.themeStyle.textContent = `.__root{${vars.join(";")}}`;
  }

  /** Carga solo las tipografías que el diseño usa. */
  syncFonts(doc: Doc): void {
    const url = googleFontsUrl(collectFonts(doc));
    if (!url) return;
    if (!this.fontLink) {
      this.fontLink = document.createElement("link");
      this.fontLink.rel = "stylesheet";
      this.fontLink.id = "studio-doc-fonts";
      document.head.appendChild(this.fontLink);
    }
    if (this.fontLink.getAttribute("href") !== url) this.fontLink.setAttribute("href", url);
  }

  /* ---------- Renderizado ---------- */

  render(doc: Doc, rootId: string, o: RenderOpts): void {
    this.syncTheme(doc);
    const seen = new Set<string>();
    const rootEl = this.renderNode(doc, rootId, o, seen);
    if (this.mount.firstChild !== rootEl || this.mount.childNodes.length !== 1) this.mount.replaceChildren(rootEl);
    for (const id of [...this.entries.keys()]) {
      if (!seen.has(id)) { this.entries.get(id)!.el.remove(); this.entries.delete(id); }
    }
  }

  private create(node: Node): Entry {
    const el = document.createElement("div");
    el.dataset.nid = node.id;
    return { el, inner: null, node, parentNode: undefined, key: "" };
  }

  private renderNode(doc: Doc, id: string, o: RenderOpts, seen: Set<string>): HTMLElement {
    const node = doc.nodes[id];
    seen.add(id);
    let ent = this.entries.get(id);
    if (ent && ent.node.type !== node.type) { ent.el.remove(); this.entries.delete(id); ent = undefined; }
    if (!ent) { ent = this.create(node); this.entries.set(id, ent); }
    const parentNode = node.parent ? doc.nodes[node.parent] : undefined;
    const key = `${o.device}|${o.hoverStateId === id ? "h" : "n"}|${o.editingId === id ? "e" : ""}`;
    const fallbackKids = !!parentNode && isFreeFallback(parentNode, o.device);
    if (ent.node !== node || ent.parentNode !== parentNode || ent.key !== key || fallbackKids) {
      this.apply(ent, doc, node, o);
      ent.node = node; ent.parentNode = parentNode; ent.key = key;
    }
    if (node.children.length || ent.el.firstElementChild?.hasAttribute("data-nid")) {
      // primero se dibujan los hijos (pueden moverse entre contenedores) y después se ordena este nivel
      const kids = node.children.map((cid) => this.renderNode(doc, cid, o, seen));
      let ref: ChildNode | null = ent.el.firstChild;
      for (const k of kids) {
        if (k === ref) ref = ref.nextSibling;
        else ent.el.insertBefore(k, ref);
      }
      while (ref) { const next = ref.nextSibling; ref.remove(); ref = next; }
    }
    return ent.el;
  }

  private apply(ent: Entry, doc: Doc, node: Node, o: RenderOpts): void {
    const el = ent.el;
    const st = resolveStyle(node, o.device);
    const decls = nodeDecls(doc, node, o.device, { state: o.hoverStateId === node.id ? "hover" : "normal", forEditor: true });
    let css = resolveCss(declsToString(decls));
    if (node.hidden) css += ";display:none";
    el.style.cssText = css;
    el.className = `n n-${node.type}`;
    el.classList.toggle("is-dev-hidden", !!st.hide);
    const isCont = node.type === "root" || node.type === "section" || node.type === "container" || node.type === "form";
    el.classList.toggle("is-empty", isCont && node.type !== "root" && node.children.length === 0);
    const p = node.props;
    const inner = innerDecls(node, o.device);

    switch (node.type) {
      case "text":
        if (o.editingId !== node.id && el.textContent !== String(p.text ?? "")) el.textContent = String(p.text ?? "");
        break;
      case "button": {
        if (o.editingId === node.id) break;
        el.replaceChildren();
        const lbl = document.createElement("span");
        lbl.className = "lbl";
        lbl.textContent = String(p.text ?? "");
        if (p.icon) { const ic = svgIcon(p.icon, 2); ic.setAttribute("width", "1.1em"); ic.setAttribute("height", "1.1em"); p.iconPos === "right" ? el.append(lbl, ic) : el.append(ic, lbl); }
        else el.append(lbl);
        if (p.disabled) el.dataset.disabled = ""; else delete el.dataset.disabled;
        break;
      }
      case "image": {
        let img = el.querySelector("img");
        if (p.src) {
          el.querySelector(".ph")?.remove();
          if (!img) { img = document.createElement("img"); img.alt = ""; img.draggable = false; img.decoding = "async"; el.appendChild(img); }
          const u = assetUrl(p.src);
          if (img.getAttribute("src") !== u) img.setAttribute("src", u);
          if (inner) img.style.cssText = declsToString(inner.decls);
        } else {
          img?.remove();
          if (!el.querySelector(".ph")) { const ph = document.createElement("div"); ph.className = "ph"; ph.textContent = "Imagen"; el.appendChild(ph); }
        }
        break;
      }
      case "video": {
        let v = el.querySelector("video");
        if (p.src) {
          el.querySelector(".ph")?.remove();
          if (!v) { v = document.createElement("video"); v.muted = true; v.preload = "metadata"; v.playsInline = true; el.appendChild(v); }
          const u = assetUrl(p.src);
          if (v.getAttribute("src") !== u) v.setAttribute("src", u);
          if (p.poster) v.setAttribute("poster", assetUrl(p.poster)); else v.removeAttribute("poster");
          if (inner) v.style.cssText = declsToString(inner.decls);
        } else {
          v?.remove();
          if (!el.querySelector(".ph")) { const ph = document.createElement("div"); ph.className = "ph"; ph.textContent = "Vídeo"; el.appendChild(ph); }
        }
        break;
      }
      case "icon": {
        const want = `${p.name}|${p.stroke}`;
        if (el.dataset.icon !== want) { el.dataset.icon = want; el.replaceChildren(svgIcon(p.name, Number(p.stroke) || 2)); }
        const svg = el.firstElementChild as SVGElement | null;
        if (svg && inner) svg.setAttribute("style", declsToString(inner.decls));
        break;
      }
      case "field": {
        el.replaceChildren();
        const lab = document.createElement("label");
        lab.textContent = String(p.label ?? "") + (p.required ? " *" : "");
        const fake = document.createElement("div");
        fake.className = "fake-input";
        if (p.kind === "textarea") fake.style.minHeight = "96px";
        fake.textContent = String(p.placeholder ?? "");
        el.append(lab, fake);
        break;
      }
      default:
        break;
    }
  }

  /* ---------- Consultas ---------- */

  el(id: string): HTMLElement | undefined { return this.entries.get(id)?.el; }

  /** Id del nodo bajo un evento (atraviesa el Shadow DOM). */
  idFromPath(path: EventTarget[]): string | null {
    for (const t of path) {
      const e = t as HTMLElement;
      if (e && e.dataset && e.dataset.nid) return e.dataset.nid;
      if (t === this.host) break;
    }
    return null;
  }

  /** Nodos en un punto de pantalla, de arriba abajo. */
  idsAt(x: number, y: number): string[] {
    const out: string[] = [];
    for (const e of this.shadow.elementsFromPoint(x, y)) {
      const id = (e as HTMLElement).dataset?.nid;
      if (id) out.push(id);
    }
    return out;
  }

  /** Medida en px sin escalar, relativa al contenedor posicionado. */
  measure(id: string): Rect | null {
    const el = this.entries.get(id)?.el;
    if (!el) return null;
    return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
  }

  clientRect(id: string): DOMRect | null {
    return this.entries.get(id)?.el.getBoundingClientRect() ?? null;
  }

  /** Altura natural del contenido. */
  contentHeight(): number {
    return this.mount.scrollHeight;
  }

  /** Convierte un nodo de texto en editable. Devuelve el elemento. */
  startEditing(id: string): HTMLElement | null {
    const ent = this.entries.get(id);
    if (!ent) return null;
    const target = ent.node.type === "button" ? (ent.el.querySelector(".lbl") as HTMLElement | null) : ent.el;
    if (!target) return null;
    target.setAttribute("contenteditable", "plaintext-only");
    if (target.contentEditable !== "plaintext-only") target.setAttribute("contenteditable", "true");
    target.classList.add("is-editing");
    target.style.pointerEvents = "auto";
    target.spellcheck = true;
    return target;
  }

  stopEditing(id: string): string | null {
    const ent = this.entries.get(id);
    if (!ent) return null;
    const target = ent.node.type === "button" ? (ent.el.querySelector(".lbl") as HTMLElement | null) : ent.el;
    if (!target) return null;
    const text = target.innerText.replace(/ /g, " ").replace(/\n$/, "");
    target.removeAttribute("contenteditable");
    target.classList.remove("is-editing");
    target.style.pointerEvents = "";
    return text;
  }
}
