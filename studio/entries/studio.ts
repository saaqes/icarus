/** ICARUS Studio — punto de entrada: sesión, enrutado por hash y vistas. */
import { session } from "../core/session";
import { h, toast } from "../lib/dom";
import { Api } from "../lib/api";
import { requestPersistence } from "../lib/local";

type View = (host: HTMLElement, args: string[]) => Promise<() => void> | (() => void);

const routes: { re: RegExp; load: () => Promise<View> }[] = [
  { re: /^#\/projects$/, load: async () => (await import("../app/projects")).mountProjects },
  { re: /^#\/new(?:\/([\w-]+))?(?:\/(info))?$/, load: async () => (await import("../app/wizard")).mountWizard },
  { re: /^#\/edit\/([\w-]+)$/, load: async () => (await import("../app/edit-route")).mountEditRoute },
  { re: /^#\/finish\/([\w-]+)$/, load: async () => (await import("../app/finish")).mountFinish },
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
  try {
    const r = await fetch("/forja/studio/config.json", { cache: "no-store" });
    const c = r.ok ? await r.json() : null;
    if (c && typeof c.whatsappNumber === "string" && /^\d{8,15}$/.test(c.whatsappNumber)) session.config.whatsappNumber = c.whatsappNumber;
  } catch { /* sin configuración: WhatsApp no estará disponible */ }
  window.addEventListener("hashchange", () => void route());
  window.addEventListener("unhandledrejection", (e) => { console.error(e.reason); });
  void requestPersistence();
  await route();
}

try { if (localStorage.getItem("icarus.debug")) (window as any).__icarus = { Api }; } catch { /* sin almacenamiento */ }
void boot();
