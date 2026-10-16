/** ICARUS Studio — punto de entrada: sesión, enrutado por hash y vistas. */
import { session } from "../core/session";
import { Api } from "../lib/api";
import { h, toast } from "../lib/dom";
import { mountAuth } from "../app/auth";

type View = (host: HTMLElement, args: string[]) => Promise<() => void> | (() => void);

const routes: { re: RegExp; auth: "none" | "user" | "admin"; load: () => Promise<View> }[] = [
  { re: /^#\/login$/, auth: "none", load: async () => (host) => mountAuth(host, () => { location.hash = sessionStorage.getItem("studio.next") || "#/projects"; sessionStorage.removeItem("studio.next"); }) },
  { re: /^#\/projects$/, auth: "user", load: async () => (await import("../app/projects")).mountProjects },
  { re: /^#\/new(?:\/([\w-]+))?$/, auth: "user", load: async () => (await import("../app/wizard")).mountWizard },
  { re: /^#\/edit\/([\w-]+)$/, auth: "user", load: async () => (await import("../app/edit-route")).mountEditRoute },
  { re: /^#\/finish\/([\w-]+)$/, auth: "user", load: async () => (await import("../app/finish")).mountFinish },
  { re: /^#\/admin(?:\/([\w-]+))?$/, auth: "admin", load: async () => (await import("../app/admin")).mountAdmin },
];

let dispose: (() => void) | null = null;
let token = 0;

async function route(): Promise<void> {
  const host = document.getElementById("app")!;
  const my = ++token;
  dispose?.();
  dispose = null;
  document.body.classList.remove("in-editor");
  const hash = location.hash || "#/projects";
  const r = routes.find((x) => x.re.test(hash));
  if (!r) { location.hash = "#/projects"; return; }
  if (r.auth !== "none" && !session.user) {
    sessionStorage.setItem("studio.next", hash);
    location.hash = "#/login";
    return;
  }
  if (r.auth === "admin" && session.user?.role !== "admin") {
    host.replaceChildren(h("div", { class: "st-fullmsg" }, h("h1", null, "Acceso restringido"), h("p", null, "Esta sección es solo para el equipo de ICARUS."), h("a", { class: "st-btn st-btn--primary", href: "#/projects" }, "Ir a Mis proyectos")));
    return;
  }
  host.replaceChildren(h("div", { class: "st-loading", role: "status" }, h("span", { class: "st-spin" }), "Cargando…"));
  try {
    const view = await r.load();
    if (my !== token) return;
    const args = (r.re.exec(hash) ?? []).slice(1);
    const d = await view(host, args);
    if (my !== token) { d(); return; }
    dispose = d;
  } catch (e) {
    console.error(e);
    host.replaceChildren(h("div", { class: "st-fullmsg" }, h("h1", null, "No se pudo cargar esta pantalla"), h("p", null, (e as Error).message || "Inténtalo de nuevo."), h("button", { class: "st-btn st-btn--primary", onclick: () => location.reload() }, "Recargar")));
  }
}

async function boot(): Promise<void> {
  const [config, me] = await Promise.all([Api.config().catch(() => null), Api.me().catch(() => ({ user: null }))]);
  session.config = config;
  session.user = me.user;
  window.addEventListener("hashchange", () => void route());
  window.addEventListener("unhandledrejection", (e) => { console.error(e.reason); });
  if (!config) toast("No se pudo contactar con el servidor. Comprueba tu conexión.", "error", 6000);
  await route();
}

void boot();
