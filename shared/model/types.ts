/**
 * ICARUS Website Builder — modelo de documento.
 *
 * El documento es 100 % serializable (JSON) y se mantiene normalizado:
 *   - `nodes`: mapa plano id → nodo (estructura vía `parent` / `children`)
 *   - `pages`: lista ordenada de páginas, cada una apunta a su nodo raíz
 *   - `theme`: colores y tipografías globales (los nodos pueden enlazarlos con `$nombre`)
 *   - `settings`: SEO, idioma, puntos de quiebre…
 *
 * Contenido (`props`), estilos (`s`), estructura (`parent`/`children`) y estado del editor
 * (selección, zoom… → ver studio/core/store.ts) están separados a propósito.
 */

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICES: Device[] = ["desktop", "tablet", "mobile"];

export type NodeType =
  | "root"
  | "section"
  | "container"
  | "text"
  | "button"
  | "image"
  | "video"
  | "icon"
  | "divider"
  | "shape"
  | "form"
  | "field";

export const NODE_TYPES: NodeType[] = [
  "root", "section", "container", "text", "button", "image", "video", "icon", "divider", "shape", "form", "field",
];

/** Tipos que pueden tener hijos. */
export const CONTAINER_TYPES: NodeType[] = ["root", "section", "container", "form"];

export type Layout = "stack" | "row" | "grid" | "free";

/** Dimensión: px, "auto", "fill" (ocupa el espacio disponible) o porcentaje ("50%"). */
export type Dim = number | "auto" | "fill" | `${number}%`;

/** [arriba, derecha, abajo, izquierda] en px */
export type Sides = [number, number, number, number];

export interface GradientStop { c: string; p: number }
export interface Gradient { kind: "linear" | "radial"; angle: number; stops: GradientStop[] }
export type Fill = string | Gradient;

export interface Shadow { x: number; y: number; blur: number; spread: number; color: string; inset?: boolean }
export interface Border { w: number; color: string; style: "solid" | "dashed" | "dotted" }
export interface BgImage { src: string; fit: "cover" | "contain" | "repeat"; pos: string; overlay?: string }

export interface Style {
  /* Disposición (contenedores) */
  layout: Layout;
  gap: number;
  columns: number;
  wrap: boolean;
  justify: "start" | "center" | "end" | "between" | "around";
  align: "start" | "center" | "end" | "stretch";
  maxWidth: number | null;
  minHeight: number | null;
  /* Caja */
  x: number;
  y: number;
  w: Dim;
  h: Dim;
  colSpan: number;
  alignSelf: "auto" | "start" | "center" | "end" | "stretch";
  rotate: number;
  opacity: number;
  margin: Sides;
  padding: Sides;
  bg: Fill | null;
  bgImage: BgImage | null;
  border: Border | null;
  radius: number | Sides;
  shadow: Shadow[];
  overflow: "visible" | "hidden";
  /* Texto */
  font: string;
  size: number;
  weight: number;
  italic: boolean;
  underline: boolean;
  transform: "none" | "uppercase" | "lowercase" | "capitalize";
  color: string;
  textAlign: "left" | "center" | "right" | "justify";
  lh: number;
  ls: number;
  /* Imagen / vídeo */
  fit: "cover" | "contain" | "fill";
  /* Visibilidad por dispositivo */
  hide: boolean;
}

export type StyleKey = keyof Style;
export type PartialStyle = Partial<Style>;

export type AnimType =
  | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "scale" | "zoom-out" | "blur" | "rotate";
export type AnimTrigger = "load" | "scroll";
export type HoverFx = "none" | "lift" | "grow" | "glow" | "shrink";

export interface Anim {
  type: AnimType | "none";
  trigger: AnimTrigger;
  /** ms */
  duration: number;
  /** ms */
  delay: number;
  /** 0–100 */
  intensity: number;
  /** Si es contenedor: anima a los hijos de forma escalonada. */
  stagger: boolean;
  hover: HoverFx;
}

export interface NodeAttrs { elId?: string; className?: string; css?: string }

export interface Node {
  id: string;
  type: NodeType;
  name: string;
  parent: string | null;
  children: string[];
  /** Contenido propio de cada tipo (texto, src, href…). */
  props: Record<string, any>;
  /** Estilos por dispositivo. tablet/mobile heredan de base y solo guardan diferencias. */
  s: { base: PartialStyle; tablet?: PartialStyle; mobile?: PartialStyle };
  hover?: PartialStyle;
  locked?: boolean;
  /** Oculto en el editor y en el sitio (todas las pantallas). */
  hidden?: boolean;
  anim?: Anim | null;
  attrs?: NodeAttrs;
}

export interface Page {
  id: string;
  name: string;
  slug: string;
  rootId: string;
  seo?: { title?: string; description?: string };
}

export interface Theme {
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
}

export interface Settings {
  siteName: string;
  lang: string;
  title: string;
  description: string;
  /** Ruta de imagen (biblioteca o recurso subido). */
  favicon: string;
  homePageId: string;
  breakpoints: { tablet: number; mobile: number };
  animations: boolean;
  /** URL pública prevista del sitio (opcional; permite generar sitemap.xml). */
  siteUrl: string;
}

export interface Doc {
  v: 1;
  pages: Page[];
  nodes: Record<string, Node>;
  theme: Theme;
  savedColors: string[];
  settings: Settings;
}

/* ---------- Metadatos de proyecto (los gestiona el servidor) ---------- */

export type ProjectStatus = "draft" | "editing" | "ready" | "published";

export interface ProjectContact {
  owner?: string;
  email?: string;
  phone?: string;
  country?: string;
  language?: string;
}

export interface ProjectMeta {
  id: string;
  folderId: string | null;
  name: string;
  siteName: string;
  description: string;
  pageType: string;
  category: string;
  contact: ProjectContact;
  brand: { colors: string[]; style: string };
  status: ProjectStatus;
  archived: boolean;
  pageCount: number;
  rev: number;
  thumb: string;
  createdAt: string;
  updatedAt: string;
  templateId: string | null;
}

export interface ProjectFull extends ProjectMeta { doc: Doc }

export const DEFAULT_BREAKPOINTS = { tablet: 1024, mobile: 640 };
/** Anchos del lienzo para cada dispositivo (px). */
export const DEVICE_WIDTHS: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };
