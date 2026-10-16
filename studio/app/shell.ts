/** Marco común de las pantallas que no son el editor (cabecera con navegación y contenedor). */
import { session } from "../core/session";
import { Api } from "../lib/api";
import { h, ic } from "../lib/dom";

export function pageShell(active: "projects" | "new" | "admin" | "none", content: HTMLElement, opts: { narrow?: boolean } = {}): HTMLElement {
  const u = session.user;
  const link = (href: string, label: string, key: string, icon: string) =>
    h("a", { class: `sh-link${active === key ? " is-on" : ""}`, href, "aria-current": active === key ? "page" : undefined }, ic(icon, 15), h("span", null, label));
  const nav = h("nav", { class: "sh-nav", "aria-label": "Principal" },
    link("#/projects", "Mis proyectos", "projects", "folder"),
    link("#/new", "Nueva página web", "new", "plus"),
    u?.role === "admin" ? link("#/admin", "Solicitudes", "admin", "shield") : null);
  const user = u
    ? h("div", { class: "sh-user" }, h("span", { class: "sh-avatar", "aria-hidden": "true" }, u.name.slice(0, 1).toUpperCase()), h("span", { class: "sh-uname" }, u.name),
      h("button", { type: "button", class: "st-icon-btn", "aria-label": "Cerrar sesión", "data-tip": "Cerrar sesión", onclick: async () => { await Api.logout().catch(() => undefined); session.user = null; location.hash = "#/login"; } }, ic("logout", 16)))
    : null;
  return h("div", { class: "sh" },
    h("header", { class: "sh-head" },
      h("a", { class: "sh-brand", href: "/forja/", "aria-label": "ICARUS Website Builder" }, h("img", { src: "/forja/assets/img/icarus-symbol.webp", alt: "", width: "30", height: "30" }), h("span", null, "ICARUS"), h("small", null, "Website Builder")),
      nav,
      h("div", { class: "sh-right" }, h("a", { class: "sh-link sh-link--ghost", href: "/", "data-tip": "Volver a ICARUS Marketing" }, ic("external", 14), h("span", null, "ICARUS Marketing")), user)),
    h("main", { class: `sh-main${opts.narrow ? " sh-main--narrow" : ""}`, id: "main" }, content),
  );
}
