/** Utilidades mínimas de DOM (sin framework): creación de elementos, iconos, avisos, diálogos y menús. */
import { ICONS } from "../../shared/model/icons";

export type Child = Node | string | number | false | null | undefined | Child[];
export type Props = {
  class?: string;
  style?: string | Partial<CSSStyleDeclaration> | Record<string, string>;
  dataset?: Record<string, string>;
  [k: string]: any;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = String(v);
      else if (k === "style") {
        if (typeof v === "string") el.setAttribute("style", v);
        else for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith("--")) el.style.setProperty(sk, String(sv)); else (el.style as any)[sk] = sv; }
      } else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === "value" || k === "checked" || k === "disabled" || k === "selected") (el as any)[k] = v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el: Node): void { while (el.firstChild) el.removeChild(el.firstChild); }

export function $<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null { return root.querySelector<T>(sel); }

/* ---------- Iconos de interfaz ---------- */

const UI: Record<string, string> = {
  pointer: "M5 3l14 7-6 2-2 6z",
  hand: "M8 13V6a1.5 1.5 0 0 1 3 0v5m0-6a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-3-5a1.5 1.5 0 0 1 2.5-1.5L8 14",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  "zoom-in": "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3M11 8v6M8 11h6",
  "zoom-out": "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3M8 11h6",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  copy: "M9 9h11v11H9zM5 15V4h11",
  duplicate: "M8 8h12v12H8zM4 16V4h12",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  unlock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.5-2",
  "eye-off": "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.6 6.7C3.9 8.5 2 12 2 12s4 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-up": "M6 15l6-6 6 6",
  "chevron-left": "M15 6l-6 6 6 6",
  grip: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
  save: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  play: "M7 4v16l13-8z",
  pause: "M8 5v14M16 5v14",
  type: "M5 6V4h14v2M12 4v16M9 20h6",
  align: "M4 6h16M4 10h10M4 14h16M4 18h10",
  button: "M3 8h18v8H3zM8 12h8",
  square: "M4 4h16v16H4z",
  circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  columns: "M4 4h7v16H4zM13 4h7v16h-7z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  move: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
  card: "M4 5h16v14H4zM4 10h16",
  input: "M3 8h18v8H3zM6 12h.01M7 12h3",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01",
  folder: "M3 6h6l2 2h10v11H3z",
  "folder-plus": "M3 6h6l2 2h10v11H3zM12 11v5M9.5 13.5h5",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  "dots-v": "M12 5h.01M12 12h.01M12 19h.01",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  home: "M3 11 12 3l9 8M5 10v10h14V10M10 20v-6h4v6",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  panel: "M4 4h16v16H4zM9 4v16",
  "panel-r": "M4 4h16v16H4zM15 4v16",
  desktop: "M3 4h18v12H3zM8 21h8M12 16v5",
  tablet: "M5 2h14v20H5zM11 18h2",
  mobile: "M7 2h10v20H7zM11 18h2",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  group: "M3 3h8v8H3zM13 13h8v8h-8zM11 7h4v4M7 11v4h4",
  ungroup: "M3 3h8v8H3zM13 13h8v8h-8z",
  front: "M8 8h12v12H8zM4 16V4h12",
  back: "M4 4h12v12H4zM8 20h12V8",
  "align-left": "M4 3v18M8 7h12M8 14h8",
  "align-hcenter": "M12 3v18M5 7h14M8 14h8",
  "align-right": "M20 3v18M4 7h12M8 14h8",
  "align-top": "M3 4h18M7 8v12M14 8v8",
  "align-vcenter": "M3 12h18M7 5v14M14 8v8",
  "align-bottom": "M3 20h18M7 4v12M14 8v8",
  "text-left": "M4 6h16M4 10h10M4 14h16M4 18h10",
  "text-center": "M4 6h16M7 10h10M4 14h16M7 18h10",
  "text-right": "M4 6h16M10 10h10M4 14h16M10 18h10",
  "text-justify": "M4 6h16M4 10h16M4 14h16M4 18h16",
  bold: "M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z",
  italic: "M10 4h8M6 20h8M14 4 10 20",
  underline: "M7 4v7a5 5 0 0 0 10 0V4M5 21h14",
  spinner: "M12 3a9 9 0 1 0 9 9",
  alert: "M12 3 2 20h20zM12 10v5M12 18h.01",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01",
  cloud: "M7 18a5 5 0 0 1-.5-10 6 6 0 0 1 11.5 1.5A4 4 0 0 1 17 18z",
  "cloud-off": "M3 3l18 18M7 18a5 5 0 0 1-.5-10c.4 0 .8 0 1.2.1M10 6.2A6 6 0 0 1 18 9.5 4 4 0 0 1 20 17",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3",
  sliders: "M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  tool: "M14 6l4 4-9 9H5v-4zM12 8l4 4",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v5l3 2",
  logout: "M10 4H4v16h6M16 8l4 4-4 4M20 12H9",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  wa: "M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zM9 8c0 4 3 7 7 7l1-2-2-1-1 1c-1-.4-2-1.4-2.5-2.5l1-1-1-2z",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  rows: "M4 5h16v6H4zM4 13h16v6H4z",
  ratio: "M4 7h16v10H4zM8 11h.01",
  crop: "M6 2v16h16M2 6h16v16",
};

export function ic(name: string, size = 16, stroke = 1.75): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(stroke));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ic");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", UI[name] ?? ICONS[name] ?? ICONS.star);
  svg.appendChild(p);
  return svg;
}

/* ---------- Avisos ---------- */

let toastBox: HTMLElement | null = null;
export function toast(message: string, kind: "ok" | "error" | "info" = "info", ms = 3200): void {
  if (!toastBox) {
    toastBox = h("div", { class: "st-toasts", role: "status", "aria-live": "polite" });
    document.body.appendChild(toastBox);
  }
  const el = h("div", { class: `st-toast st-toast--${kind}` }, ic(kind === "ok" ? "check" : kind === "error" ? "alert" : "info", 16), h("span", null, message));
  toastBox.appendChild(el);
  setTimeout(() => { el.classList.add("is-out"); setTimeout(() => el.remove(), 250); }, ms);
}

/* ---------- Diálogos ---------- */

export interface ModalOptions {
  title: string;
  body: Node | string;
  actions?: { label: string; kind?: "primary" | "danger" | "ghost"; value?: any; keepOpen?: boolean; onClick?: () => boolean | void | Promise<boolean | void> }[];
  wide?: boolean;
  /** Elemento que recibe el foco al abrir. */
  focus?: () => HTMLElement | null;
}

/** Abre un diálogo modal accesible. Se resuelve con el `value` del botón pulsado (o undefined al cerrar). */
export function modal(opts: ModalOptions): Promise<any> {
  return new Promise((resolve) => {
    const prev = document.activeElement as HTMLElement | null;
    const close = (v?: any) => { document.removeEventListener("keydown", onKey, true); back.remove(); prev?.focus?.(); resolve(v); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(undefined); }
      if (e.key === "Tab") {
        const f = [...box.querySelectorAll<HTMLElement>("button,input,select,textarea,[href],[tabindex]:not([tabindex='-1'])")].filter((x) => !x.hasAttribute("disabled") && x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const actions = (opts.actions ?? [{ label: "Cerrar", kind: "primary", value: true }]).map((a) =>
      h("button", {
        type: "button", class: `st-btn st-btn--${a.kind ?? "ghost"}`,
        onclick: async () => {
          if (a.onClick) { const r = await a.onClick(); if (r === false) return; }
          if (!a.keepOpen) close(a.value);
        },
      }, a.label));
    const titleId = "st-modal-" + Math.random().toString(36).slice(2, 8);
    const box = h("div", { class: `st-modal${opts.wide ? " st-modal--wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-labelledby": titleId },
      h("header", { class: "st-modal__head" }, h("h2", { id: titleId }, opts.title), h("button", { type: "button", class: "st-icon-btn", "aria-label": "Cerrar", onclick: () => close(undefined) }, ic("x"))),
      h("div", { class: "st-modal__body" }, typeof opts.body === "string" ? h("p", null, opts.body) : opts.body),
      h("footer", { class: "st-modal__foot" }, actions));
    const back = h("div", { class: "st-backdrop", onpointerdown: (e: Event) => { if (e.target === back) close(undefined); } }, box);
    document.body.appendChild(back);
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => {
      const f = opts.focus?.() ?? box.querySelector<HTMLElement>("input,textarea,select") ?? (box.querySelector(".st-btn--primary,.st-btn--danger") as HTMLElement | null) ?? box.querySelector<HTMLElement>("button");
      f?.focus();
    });
  });
}

export async function confirmDialog(title: string, message: string, confirmLabel = "Confirmar", danger = false): Promise<boolean> {
  const r = await modal({ title, body: message, actions: [{ label: "Cancelar", kind: "ghost", value: false }, { label: confirmLabel, kind: danger ? "danger" : "primary", value: true }] });
  return r === true;
}

export async function promptDialog(title: string, label: string, value = "", confirmLabel = "Aceptar"): Promise<string | null> {
  const input = h("input", { class: "st-input", type: "text", value, "aria-label": label, maxlength: "120" });
  let result: string | null = null;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") (input.closest(".st-modal")?.querySelector(".st-btn--primary") as HTMLElement | null)?.click(); });
  await modal({
    title,
    body: h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, label), input),
    actions: [{ label: "Cancelar", kind: "ghost" }, { label: confirmLabel, kind: "primary", onClick: () => { result = input.value.trim(); if (!result) { input.focus(); return false; } } }],
    focus: () => { input.select(); return input; },
  });
  return result;
}

/* ---------- Popovers y menús ---------- */

export interface PopoverHandle { el: HTMLElement; close(): void }

export function popover(anchor: HTMLElement | { x: number; y: number }, content: Node, opts: { align?: "start" | "end"; className?: string; onClose?: () => void } = {}): PopoverHandle {
  const el = h("div", { class: `st-popover ${opts.className ?? ""}`, role: "dialog" }, content);
  document.body.appendChild(el);
  const place = () => {
    const r = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : new DOMRect(anchor.x, anchor.y, 0, 0);
    const pw = el.offsetWidth, ph = el.offsetHeight;
    let x = opts.align === "end" ? r.right - pw : r.left;
    let y = r.bottom + 6;
    if (y + ph > window.innerHeight - 8) y = Math.max(8, r.top - ph - 6);
    x = Math.min(Math.max(8, x), window.innerWidth - pw - 8);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };
  place();
  requestAnimationFrame(place);
  const onDown = (e: PointerEvent) => { if (!el.contains(e.target as Node) && !(anchor instanceof HTMLElement && anchor.contains(e.target as Node))) close(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  const onResize = () => close();
  function close() {
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    el.remove();
    opts.onClose?.();
  }
  setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize);
  return { el, close };
}

export interface MenuItem { label: string; icon?: string; shortcut?: string; danger?: boolean; disabled?: boolean; onClick?: () => void; separator?: boolean; checked?: boolean }

export function menu(anchor: HTMLElement | { x: number; y: number }, items: MenuItem[], opts: { align?: "start" | "end" } = {}): PopoverHandle {
  const list = h("div", { class: "st-menu", role: "menu" }, items.map((it) =>
    it.separator
      ? h("hr", { class: "st-menu__sep" })
      : h("button", {
        type: "button", role: "menuitem", class: `st-menu__item${it.danger ? " is-danger" : ""}`, disabled: it.disabled,
        onclick: () => { pop.close(); it.onClick?.(); },
      }, it.icon ? ic(it.icon, 15) : h("span", { class: "st-menu__ic" }), h("span", { class: "st-menu__label" }, it.label), it.checked ? ic("check", 14) : null, it.shortcut ? h("kbd", null, it.shortcut) : null)));
  const pop = popover(anchor, list, { align: opts.align, className: "st-popover--menu" });
  list.addEventListener("keydown", (e) => {
    const btns = [...list.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
  });
  requestAnimationFrame(() => list.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus());
  return pop;
}

/* ---------- Varios ---------- */

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): ((...a: A) => void) & { flush(): void; cancel(): void } {
  let t: ReturnType<typeof setTimeout> | undefined;
  let last: A | undefined;
  const run = () => { t = undefined; if (last) { const a = last; last = undefined; fn(...a); } };
  const d = ((...a: A) => { last = a; if (t) clearTimeout(t); t = setTimeout(run, ms); }) as ((...a: A) => void) & { flush(): void; cancel(): void };
  d.flush = () => { if (t) { clearTimeout(t); run(); } };
  d.cancel = () => { if (t) clearTimeout(t); t = undefined; last = undefined; };
  return d;
}

export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "hace un momento";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `hace ${d} d`;
  return formatDate(iso);
}
export function clamp(n: number, min: number, max: number): number { return Math.min(max, Math.max(min, n)); }
export function round(n: number, p = 100): number { return Math.round(n * p) / p; }
