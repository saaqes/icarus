/**
 * Constructor declarativo de nodos (DSL). Lo usan los elementos del panel «Insertar»,
 * las secciones prediseñadas y las plantillas, para que todo sea documento editable real.
 */
import { makeNode, uid } from "./doc";
import { Anim, AnimType, Node, NodeAttrs, NodeType, PartialStyle, Sides } from "./types";

export interface Spec {
  type: NodeType;
  name?: string;
  props?: Record<string, any>;
  s?: PartialStyle;
  tablet?: PartialStyle;
  mobile?: PartialStyle;
  hover?: PartialStyle;
  anim?: Anim | null;
  attrs?: NodeAttrs;
  locked?: boolean;
  children?: Spec[];
}

/** Convierte una especificación en nodos con ids nuevos (raíz primero, `parent` enlazado). */
export function materialize(spec: Spec, parentId: string | null = null): Node[] {
  const id = uid();
  const out: Node[] = [];
  const s: Node["s"] = { base: { ...(spec.s ?? {}) } };
  if (spec.tablet && Object.keys(spec.tablet).length) s.tablet = { ...spec.tablet };
  if (spec.mobile && Object.keys(spec.mobile).length) s.mobile = { ...spec.mobile };
  const node = makeNode(spec.type, {
    id,
    name: spec.name,
    parent: parentId,
    props: structuredClone(spec.props ?? {}),
    s: structuredClone(s),
    hover: spec.hover ? { ...spec.hover } : undefined,
    anim: spec.anim ?? undefined,
    attrs: spec.attrs ? { ...spec.attrs } : undefined,
    locked: spec.locked,
  });
  out.push(node);
  for (const c of spec.children ?? []) {
    const sub = materialize(c, id);
    node.children.push(sub[0].id);
    out.push(...sub);
  }
  return out;
}

export function anim(type: AnimType, o: Partial<Anim> = {}): Anim {
  return { type, trigger: "scroll", duration: 700, delay: 0, intensity: 50, stagger: false, hover: "none", ...o };
}

export function pad(a: number, b?: number, c?: number, d?: number): Sides {
  if (b === undefined) return [a, a, a, a];
  if (c === undefined) return [a, b, a, b];
  return [a, b, c, d ?? b];
}

/* ---------- Atajos de construcción ---------- */

type Opt = Partial<Omit<Spec, "type" | "children">>;

export const N = {
  section(o: Opt, children: Spec[] = []): Spec {
    return { type: "section", name: "Sección", ...o, s: { layout: "stack", padding: pad(80, 24), maxWidth: 1160, gap: 24, ...o.s }, children };
  },
  box(o: Opt, children: Spec[] = []): Spec {
    return { type: "container", name: "Contenedor", ...o, s: { layout: "stack", gap: 16, ...o.s }, children };
  },
  row(o: Opt, children: Spec[] = []): Spec {
    return { type: "container", name: "Fila", ...o, s: { layout: "row", gap: 16, align: "center", ...o.s }, children };
  },
  grid(o: Opt, children: Spec[] = []): Spec {
    return { type: "container", name: "Cuadrícula", ...o, s: { layout: "grid", columns: 3, gap: 24, align: "stretch", ...o.s }, children };
  },
  free(o: Opt, children: Spec[] = []): Spec {
    return { type: "container", name: "Lienzo libre", ...o, s: { layout: "free", minHeight: 320, ...o.s }, children };
  },
  text(text: string, o: Opt & { tag?: string } = {}): Spec {
    const { tag, ...rest } = o;
    return { type: "text", name: rest.name ?? text.slice(0, 28), ...rest, props: { text, tag: tag ?? "p", ...rest.props }, s: { ...rest.s } };
  },
  heading(text: string, level: 1 | 2 | 3 | 4, o: Opt = {}): Spec {
    const size = { 1: 56, 2: 40, 3: 24, 4: 19 }[level];
    const tabletSize = { 1: 46, 2: 34, 3: 22, 4: 18 }[level];
    const mobileSize = { 1: 36, 2: 28, 3: 20, 4: 17 }[level];
    return {
      type: "text", name: o.name ?? `Título ${level}`, ...o,
      props: { text, tag: `h${level}`, ...o.props },
      s: { font: "$heading", size, weight: 700, lh: level === 1 ? 1.08 : 1.2, color: "$text", ...o.s },
      tablet: { size: tabletSize, ...o.tablet },
      mobile: { size: mobileSize, ...o.mobile },
    };
  },
  para(text: string, o: Opt = {}): Spec {
    return {
      type: "text", name: o.name ?? "Párrafo", ...o,
      props: { text, tag: "p", ...o.props },
      s: { size: 17, lh: 1.65, color: "$muted", ...o.s },
      tablet: o.tablet, mobile: { size: 16, ...o.mobile },
    };
  },
  eyebrow(text: string, o: Opt = {}): Spec {
    return {
      type: "text", name: "Sobretítulo", ...o,
      props: { text, tag: "p", ...o.props },
      s: { size: 13, weight: 700, ls: 2.4, transform: "uppercase", color: "$primary", ...o.s },
      tablet: o.tablet, mobile: o.mobile,
    };
  },
  button(text: string, o: Opt & { variant?: "solid" | "outline" | "ghost" } = {}): Spec {
    const { variant = "solid", ...rest } = o;
    const look: PartialStyle =
      variant === "solid"
        ? { bg: "$primary", color: "$light", border: null }
        : variant === "outline"
          ? { bg: null, color: "$text", border: { w: 1, color: "$muted", style: "solid" } }
          : { bg: null, color: "$text" };
    const hover: PartialStyle =
      variant === "solid" ? { bg: "$secondary" } : variant === "outline" ? { border: { w: 1, color: "$text", style: "solid" } } : { color: "$primary" };
    return {
      type: "button", name: rest.name ?? "Botón", ...rest,
      props: { text, href: "#", target: "_self", icon: "", ...rest.props },
      s: { padding: pad(14, 26), radius: 10, size: 15, weight: 600, alignSelf: "start", ...look, ...rest.s },
      hover: { ...hover, ...rest.hover },
      tablet: rest.tablet, mobile: rest.mobile,
    };
  },
  image(src: string, alt: string, o: Opt = {}): Spec {
    return {
      type: "image", name: o.name ?? "Imagen", ...o,
      props: { src, alt, focalX: 50, focalY: 50, zoom: 1, ratio: 1.6, ...o.props },
      s: { w: "fill", radius: 16, fit: "cover", ...o.s },
    };
  },
  icon(name: string, o: Opt & { size?: number } = {}): Spec {
    const { size = 28, ...rest } = o;
    return {
      type: "icon", name: rest.name ?? "Icono", ...rest,
      props: { name, stroke: 2, ...rest.props },
      s: { w: size, h: size, color: "$primary", ...rest.s },
    };
  },
  divider(o: Opt = {}): Spec {
    return { type: "divider", name: "Separador", ...o, s: { w: "fill", h: 1, bg: "$muted", opacity: 0.3, ...o.s } };
  },
  shape(shape: "rect" | "ellipse" | "line", o: Opt = {}): Spec {
    const line = shape === "line";
    return {
      type: "shape", name: shape === "rect" ? "Rectángulo" : shape === "ellipse" ? "Círculo" : "Línea", ...o,
      props: { shape, ...o.props },
      s: { w: line ? 200 : 140, h: line ? 3 : 140, bg: "$primary", radius: shape === "rect" ? 12 : 0, ...o.s },
    };
  },
  video(src: string, o: Opt = {}): Spec {
    return {
      type: "video", name: "Vídeo", ...o,
      props: { src, poster: "", controls: true, autoplay: false, loop: false, muted: false, ratio: 1.7778, ...o.props },
      s: { w: "fill", radius: 16, fit: "cover", ...o.s },
    };
  },
  field(label: string, o: Opt & { kind?: string; name?: string; required?: boolean } = {}): Spec {
    const { kind = "text", name, required = false, ...rest } = o;
    return {
      type: "field", name: `Campo: ${label}`, ...rest,
      props: { label, kind, name: name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), placeholder: "", required, ...rest.props },
      s: { w: "fill", color: "$text", ...rest.s },
    };
  },
  form(o: Opt & { mode?: "whatsapp" | "mailto"; to?: string }, children: Spec[] = []): Spec {
    const { mode = "whatsapp", to = "", ...rest } = o;
    return {
      type: "form", name: "Formulario", ...rest,
      props: { mode, to, successText: "¡Gracias! Abrimos tu aplicación de mensajería con los datos.", ...rest.props },
      s: { layout: "stack", gap: 14, ...rest.s },
      children,
    };
  },
  card(o: Opt, children: Spec[] = []): Spec {
    return N.box({
      name: "Tarjeta", ...o,
      s: { padding: pad(28), bg: "$surface", radius: 18, gap: 12, border: { w: 1, color: "rgba(255,255,255,0.08)", style: "solid" }, ...o.s },
      hover: { shadow: [{ x: 0, y: 18, blur: 40, spread: -12, color: "rgba(0,0,0,0.5)" }], ...o.hover },
      anim: o.anim ?? undefined,
    }, children);
  },
};
