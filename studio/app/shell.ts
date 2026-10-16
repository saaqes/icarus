/** Marco común de las pantallas que no son el editor (cabecera con navegación y contenedor). */
import { h, ic } from "../lib/dom";

export function pageShell(active: "projects" | "new" | "none", content: HTMLElement, opts: { narrow?: boolean } = {}): HTMLElement {
  const link = (href: string, label: string, key: string, icon: string) =>
    h("a", { class: `sh-link${active === key ? " is-on" : ""}`, href, "aria-current": active === key ? "page" : undefined }, ic(icon, 15), h("span", null, label));
  const nav = h("nav", { class: "sh-nav", "aria-label": "Principal" },
    link("#/projects", "Mis proyectos", "projects", "folder"),
    link("#/new", "Nueva página web", "new", "plus"));
  return h("div", { class: "sh" },
    h("header", { class: "sh-head" },
      h("a", { class: "sh-brand", href: "/forja/", "aria-label": "ICARUS Website Builder" }, h("img", { src: "/forja/assets/img/icarus-symbol.webp", alt: "", width: "30", height: "30" }), h("span", null, "ICARUS"), h("small", null, "Website Builder")),
      nav,
      h("div", { class: "sh-right" }, h("a", { class: "sh-link sh-link--ghost", href: "/", "data-tip": "Volver a ICARUS Marketing" }, ic("external", 14), h("span", null, "ICARUS Marketing")))),
    h("main", { class: `sh-main${opts.narrow ? " sh-main--narrow" : ""}`, id: "main" }, content),
  );
}
