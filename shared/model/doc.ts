/**
 * Operaciones puras sobre el documento: creación de nodos, edición con copy-on-write (Tx),
 * recorridos de árbol y clonado de subárboles con identificadores nuevos.
 */
import {
  CONTAINER_TYPES, DEFAULT_BREAKPOINTS, Doc, Node, NodeType, Page, PartialStyle, Settings, Theme,
} from "./types";

/* ---------- Identificadores ---------- */

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export function uid(prefix = "n"): string {
  const bytes = new Uint8Array(9);
  (globalThis as unknown as { crypto: { getRandomValues(a: Uint8Array): Uint8Array } }).crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export function slugify(input: string): string {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "pagina";
}

export function uniqueSlug(base: string, taken: string[]): string {
  const b = slugify(base);
  if (!taken.includes(b)) return b;
  let i = 2;
  while (taken.includes(`${b}-${i}`)) i++;
  return `${b}-${i}`;
}

/* ---------- Valores por defecto ---------- */

export const DEFAULT_THEME: Theme = {
  colors: {
    primary: "#b3261e",
    secondary: "#d9472b",
    accent: "#c9a35a",
    bg: "#0b0b0d",
    surface: "#17171b",
    text: "#f3f1ec",
    muted: "#9a9ca5",
    light: "#ffffff",
    dark: "#060607",
    onprimary: "#ffffff",
  },
  fonts: { heading: "Manrope", body: "Manrope" },
};

export function defaultSettings(siteName = "Mi sitio"): Settings {
  return {
    siteName,
    lang: "es",
    title: siteName,
    description: "",
    favicon: "",
    homePageId: "",
    breakpoints: { ...DEFAULT_BREAKPOINTS },
    animations: true,
    siteUrl: "",
  };
}

export const TYPE_LABELS: Record<NodeType, string> = {
  root: "Página",
  section: "Sección",
  container: "Contenedor",
  text: "Texto",
  button: "Botón",
  image: "Imagen",
  video: "Vídeo",
  icon: "Icono",
  divider: "Separador",
  shape: "Forma",
  form: "Formulario",
  field: "Campo",
};

export function makeNode(type: NodeType, init: Partial<Omit<Node, "id" | "type">> & { id?: string } = {}): Node {
  return {
    id: init.id ?? uid(),
    type,
    name: init.name ?? TYPE_LABELS[type],
    parent: init.parent ?? null,
    children: init.children ?? [],
    props: init.props ?? {},
    s: init.s ?? { base: {} },
    ...(init.hover ? { hover: init.hover } : {}),
    ...(init.locked ? { locked: true } : {}),
    ...(init.hidden ? { hidden: true } : {}),
    ...(init.anim ? { anim: init.anim } : {}),
    ...(init.attrs ? { attrs: init.attrs } : {}),
  };
}

/** Documento mínimo: una página «Inicio» con raíz vacía. */
export function createEmptyDoc(siteName = "Mi sitio"): Doc {
  const root = makeNode("root", {
    name: "Inicio",
    s: { base: { layout: "stack", gap: 0, bg: "$bg", color: "$text", font: "$body", size: 16, lh: 1.6, align: "stretch" } },
  });
  const page: Page = { id: uid("pg"), name: "Inicio", slug: "index", rootId: root.id };
  const settings = defaultSettings(siteName);
  settings.homePageId = page.id;
  return {
    v: 1,
    pages: [page],
    nodes: { [root.id]: root },
    theme: structuredClone(DEFAULT_THEME),
    savedColors: [],
    settings,
  };
}

/* ---------- Lectura ---------- */

export function isContainer(node: Node): boolean {
  return CONTAINER_TYPES.includes(node.type);
}

export function getNode(doc: Doc, id: string): Node | undefined {
  return doc.nodes[id];
}

export function pageById(doc: Doc, id: string): Page | undefined {
  return doc.pages.find((p) => p.id === id);
}

/** Ids de todos los descendientes (sin incluir el nodo). */
export function descendants(doc: Doc, id: string): string[] {
  const out: string[] = [];
  const stack = [...(doc.nodes[id]?.children ?? [])].reverse();
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    const n = doc.nodes[cur];
    if (n) for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
  }
  return out;
}

/** Recorrido en profundidad (orden visual) de un subárbol, incluyendo la raíz. */
export function walk(doc: Doc, id: string, fn: (n: Node, depth: number) => void, depth = 0): void {
  const n = doc.nodes[id];
  if (!n) return;
  fn(n, depth);
  for (const c of n.children) walk(doc, c, fn, depth + 1);
}

export function isAncestor(doc: Doc, ancestorId: string, id: string): boolean {
  let cur = doc.nodes[id]?.parent ?? null;
  let guard = 0;
  while (cur && guard++ < 1000) {
    if (cur === ancestorId) return true;
    cur = doc.nodes[cur]?.parent ?? null;
  }
  return false;
}

/** Página a la que pertenece un nodo. */
export function pageOfNode(doc: Doc, id: string): Page | undefined {
  let cur: Node | undefined = doc.nodes[id];
  let guard = 0;
  while (cur && cur.parent && guard++ < 1000) cur = doc.nodes[cur.parent];
  if (!cur) return undefined;
  return doc.pages.find((p) => p.rootId === cur!.id);
}

export function pathTo(doc: Doc, id: string): Node[] {
  const out: Node[] = [];
  let cur: Node | undefined = doc.nodes[id];
  let guard = 0;
  while (cur && guard++ < 1000) {
    out.unshift(cur);
    cur = cur.parent ? doc.nodes[cur.parent] : undefined;
  }
  return out;
}

export function countNodes(doc: Doc): number {
  return Object.keys(doc.nodes).length;
}

/* ---------- Escritura con copy-on-write ---------- */

/**
 * Transacción de edición. Los nodos no tocados conservan su identidad (referencia), por lo que
 * el lienzo y los paneles pueden detectar qué cambió comparando referencias.
 */
export class Tx {
  nodes: Record<string, Node>;
  pages: Page[];
  theme: Theme;
  settings: Settings;
  savedColors: string[];
  private cloned = new Set<string>();
  private pagesCloned = false;
  private themeCloned = false;
  private settingsCloned = false;
  private colorsCloned = false;

  constructor(public readonly base: Doc) {
    this.nodes = { ...base.nodes };
    this.pages = base.pages;
    this.theme = base.theme;
    this.settings = base.settings;
    this.savedColors = base.savedColors;
  }

  /** Lectura sin copiar. */
  peek(id: string): Node | undefined {
    return this.nodes[id];
  }

  /** Devuelve una copia editable (una sola por transacción). */
  node(id: string): Node {
    const cur = this.nodes[id];
    if (!cur) throw new Error(`Nodo inexistente: ${id}`);
    if (!this.cloned.has(id)) {
      const copy = structuredClone(cur);
      this.nodes[id] = copy;
      this.cloned.add(id);
      return copy;
    }
    return cur;
  }

  editPages(): Page[] {
    if (!this.pagesCloned) { this.pages = this.pages.map((p) => ({ ...p, seo: p.seo ? { ...p.seo } : undefined })); this.pagesCloned = true; }
    return this.pages;
  }
  editTheme(): Theme {
    if (!this.themeCloned) { this.theme = structuredClone(this.theme); this.themeCloned = true; }
    return this.theme;
  }
  editSettings(): Settings {
    if (!this.settingsCloned) { this.settings = structuredClone(this.settings); this.settingsCloned = true; }
    return this.settings;
  }
  editSavedColors(): string[] {
    if (!this.colorsCloned) { this.savedColors = [...this.savedColors]; this.colorsCloned = true; }
    return this.savedColors;
  }

  /** Inserta un nodo nuevo (y, si trae hijos ya presentes en `nodes`, los respeta). */
  add(node: Node, parentId: string, index?: number): Node {
    const parent = this.node(parentId);
    node.parent = parentId;
    this.nodes[node.id] = node;
    this.cloned.add(node.id);
    const i = index === undefined || index < 0 || index > parent.children.length ? parent.children.length : index;
    parent.children.splice(i, 0, node.id);
    return node;
  }

  /** Inserta un subárbol completo (lista de nodos con la raíz primero). */
  addSubtree(nodes: Node[], parentId: string, index?: number): string {
    if (!nodes.length) throw new Error("Subárbol vacío");
    for (const n of nodes) { this.nodes[n.id] = n; this.cloned.add(n.id); }
    const root = nodes[0];
    const parent = this.node(parentId);
    root.parent = parentId;
    const i = index === undefined || index < 0 || index > parent.children.length ? parent.children.length : index;
    parent.children.splice(i, 0, root.id);
    return root.id;
  }

  /** Elimina un nodo y todos sus descendientes. */
  remove(id: string): void {
    const n = this.nodes[id];
    if (!n) return;
    if (n.parent) {
      const p = this.node(n.parent);
      p.children = p.children.filter((c) => c !== id);
    }
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      const node = this.nodes[cur];
      if (!node) continue;
      stack.push(...node.children);
      delete this.nodes[cur];
      this.cloned.delete(cur);
    }
  }

  /** Mueve un nodo a otro padre / posición. `index` se interpreta DESPUÉS de retirarlo del origen. */
  move(id: string, parentId: string, index?: number): void {
    const n = this.node(id);
    if (n.parent) {
      const old = this.node(n.parent);
      old.children = old.children.filter((c) => c !== id);
    }
    const parent = this.node(parentId);
    n.parent = parentId;
    const i = index === undefined || index < 0 || index > parent.children.length ? parent.children.length : index;
    parent.children.splice(i, 0, id);
  }

  /** Aplica estilos a un dispositivo; `undefined` borra la clave (vuelve a heredar). */
  setStyle(id: string, device: "desktop" | "tablet" | "mobile", patch: Record<string, unknown>): void {
    const n = this.node(id);
    const key = device === "desktop" ? "base" : device;
    const target: PartialStyle = (n.s[key] ??= {});
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete (target as any)[k];
      else (target as any)[k] = v;
    }
    if (key !== "base" && Object.keys(target).length === 0) delete n.s[key];
  }

  finish(): Doc {
    return {
      v: 1,
      pages: this.pages,
      nodes: this.nodes,
      theme: this.theme,
      savedColors: this.savedColors,
      settings: this.settings,
    };
  }
}

/** Atajo: aplica `fn` en una transacción y devuelve el documento nuevo. */
export function produce(doc: Doc, fn: (tx: Tx) => void): Doc {
  const tx = new Tx(doc);
  fn(tx);
  return tx.finish();
}

/* ---------- Clonado ---------- */

/**
 * Copia profunda de un subárbol con identificadores nuevos.
 * Devuelve los nodos (raíz primero). La raíz queda con `parent = null`.
 */
export function cloneSubtree(nodes: Record<string, Node>, rootId: string, rename?: (n: Node) => string): Node[] {
  const out: Node[] = [];
  const map = new Map<string, string>();
  const order: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.shift()!;
    if (!nodes[cur]) continue;
    order.push(cur);
    map.set(cur, uid());
    stack.push(...nodes[cur].children);
  }
  for (const oldId of order) {
    const src = nodes[oldId];
    const copy = structuredClone(src);
    copy.id = map.get(oldId)!;
    copy.parent = oldId === rootId ? null : map.get(src.parent!) ?? null;
    copy.children = src.children.map((c) => map.get(c)!).filter(Boolean);
    if (oldId === rootId && rename) copy.name = rename(src);
    if (copy.attrs?.elId) delete copy.attrs.elId; // los ids HTML deben ser únicos
    out.push(copy);
  }
  return out;
}

/** Nombre de copia: «Título» → «Título copia», «Título copia» → «Título copia 2». */
export function copyName(name: string): string {
  const m = name.match(/^(.*) copia(?: (\d+))?$/);
  if (!m) return `${name} copia`;
  return `${m[1]} copia ${m[2] ? Number(m[2]) + 1 : 2}`;
}

/** Duplica una página entera (nodos incluidos). */
export function duplicatePage(doc: Doc, pageId: string): Doc {
  const page = pageById(doc, pageId);
  if (!page) return doc;
  return produce(doc, (tx) => {
    const cloned = cloneSubtree(doc.nodes, page.rootId);
    for (const n of cloned) { tx.nodes[n.id] = n; }
    const pages = tx.editPages();
    const idx = pages.findIndex((p) => p.id === pageId);
    const slug = uniqueSlug(page.slug + "-copia", pages.map((p) => p.slug));
    pages.splice(idx + 1, 0, {
      id: uid("pg"),
      name: copyName(page.name),
      slug,
      rootId: cloned[0].id,
      seo: page.seo ? { ...page.seo } : undefined,
    });
    tx.nodes[cloned[0].id].name = copyName(page.name);
  });
}
