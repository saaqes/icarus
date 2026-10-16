/** Ruta #/edit/:id — carga el proyecto, ofrece recuperar cambios locales y abre el editor. */
import { validateDoc } from "../../shared/model/validate";
import { Api, ApiError } from "../lib/api";
import { clearBackup, getBackup } from "../lib/idb";
import { h, modal, toast } from "../lib/dom";
import { mountEditor } from "./editor-view";

export async function mountEditRoute(host: HTMLElement, args: string[]): Promise<() => void> {
  const id = args[0];
  let project;
  try {
    project = (await Api.project(id)).project;
  } catch (e) {
    const err = e as ApiError;
    host.replaceChildren(h("div", { class: "st-fullmsg" },
      h("h1", null, err.status === 404 ? "No encontramos este proyecto" : "No se pudo abrir el proyecto"),
      h("p", null, err.status === 404 ? "Puede que se haya eliminado o que pertenezca a otra cuenta." : err.message),
      h("a", { class: "st-btn st-btn--primary", href: "#/projects" }, "Ir a Mis proyectos")));
    return () => {};
  }
  // ¿quedaron cambios sin confirmar en este navegador?
  let restored: typeof project.doc | undefined;
  const b = await getBackup(id);
  if (b && b.dirty && b.baseRev === project.rev && JSON.stringify(b.doc) !== JSON.stringify(project.doc)) {
    const ok = validateDoc(b.doc);
    if (ok.ok) {
      const r = await modal({
        title: "Recuperar cambios sin guardar",
        body: `Encontramos cambios de tu última sesión (${new Date(b.at).toLocaleString("es-CO")}) que no llegaron a guardarse en tu cuenta. ¿Quieres recuperarlos?`,
        actions: [{ label: "Descartarlos", kind: "ghost", value: "no" }, { label: "Recuperar cambios", kind: "primary", value: "yes" }],
      });
      if (r === "yes") restored = ok.doc;
      else await clearBackup(id);
    }
  }
  document.body.classList.add("in-editor");
  const dispose = mountEditor(host, {
    project, restored,
    onExit: () => { location.hash = "#/projects"; },
    onFinish: (pid) => { location.hash = `#/finish/${pid}`; },
  });
  if (restored) toast("Cambios recuperados. Se guardarán automáticamente.", "ok", 3000);
  return dispose;
}
