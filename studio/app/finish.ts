/** Finalizar: resumen, verificación del guardado, descarga del sitio y botón «QUIERO ESTA PÁGINA» (registro + WhatsApp). */
import { checkAccessibility } from "../../shared/export/a11y";
import { describeDoc } from "../../shared/export/summary";
import { ProjectFull } from "../../shared/model/types";
import { Api, ApiError, RequestResult } from "../lib/api";
import { session } from "../core/session";
import { h, ic, toast } from "../lib/dom";
import { openPreview } from "../ui/preview";
import { svgEl } from "../ui/templates";
import { pageShell } from "./shell";

export async function mountFinish(host: HTMLElement, args: string[]): Promise<() => void> {
  const id = args[0];
  let project: ProjectFull;
  try { project = (await Api.project(id)).project; }
  catch (e) { toast((e as ApiError).message, "error"); location.hash = "#/projects"; return () => {}; }

  const issues = checkAccessibility(project.doc);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const features = describeDoc(project.doc);
  const c = project.contact;
  const cfg = session.config;
  const body = h("div");

  const row = (cls: string, icon: string, text: string) => h("li", { class: cls }, ic(icon, 16), h("span", null, text));
  const checks = h("ul", { class: "fn-checks" },
    row("fn-ok", "check", `Guardado en tu cuenta (revisión ${project.rev}). Lo que ves aquí es exactamente lo que se enviará.`),
    errors.length ? row("fn-bad", "alert", `${errors.length} problema(s) impiden generar el sitio: ${errors[0].message}`) : row("fn-ok", "check", "El sitio se puede generar sin errores."),
    warnings.length ? row("fn-warn", "info", `${warnings.length} aviso(s) de calidad o accesibilidad (no bloquean). Ej.: ${warnings[0].message}`) : row("fn-ok", "check", "Sin avisos de accesibilidad básica."));

  const note = h("textarea", { class: "st-input st-textarea", rows: "3", maxlength: "600", placeholder: "Opcional: horarios de contacto, dominio que quieres usar, dudas…", "aria-label": "Nota para el equipo de ICARUS" });
  const status = h("p", { class: "st-hint", role: "status", "aria-live": "polite" });
  const wa = h("button", { type: "button", class: "st-btn st-btn--primary st-btn--lg", disabled: errors.length > 0 }, ic("wa", 18), "QUIERO ESTA PÁGINA");
  const dl = h("button", { type: "button", class: "st-btn st-btn--ghost" }, ic("download", 15), "Descargar sitio (.zip)");
  const prev = h("button", { type: "button", class: "st-btn st-btn--ghost", onclick: () => openPreview({ doc: project.doc, pageId: project.doc.settings.homePageId }) }, ic("play", 15), "Vista previa");

  dl.addEventListener("click", async () => {
    dl.setAttribute("disabled", ""); status.textContent = "Generando el sitio…";
    try {
      const { export: ex } = await Api.exportZip(id);
      const a = h("a", { href: ex.downloadUrl, download: ex.filename }); document.body.appendChild(a); a.click(); a.remove();
      status.textContent = `Descargando ${ex.filename} · ${(ex.size / 1024).toFixed(0)} KB · ${ex.files} archivos.${ex.warnings.length ? ` Avisos: ${ex.warnings.join(" ")}` : ""}`;
    } catch (e) { status.textContent = (e as Error).message; toast((e as Error).message, "error"); }
    dl.removeAttribute("disabled");
  });

  wa.addEventListener("click", async () => {
    // La ventana se abre dentro del gesto del usuario (los navegadores bloquean ventanas abiertas tras una espera).
    const win = cfg?.whatsappConfigured ? window.open("about:blank", "_blank") : null;
    wa.setAttribute("disabled", ""); status.textContent = "Verificando el guardado, generando el sitio y registrando tu solicitud…";
    try {
      const fresh = (await Api.project(id)).project;
      const res = await Api.requestSite(id, fresh.rev, note.value.trim());
      if (win && res.whatsapp.url) { try { win.opener = null; } catch { /* ya sin opener */ } win.location.href = res.whatsapp.url; }
      else win?.close();
      showDone(res, !!(win && res.whatsapp.url));
    } catch (e) {
      win?.close();
      const err = e as ApiError;
      status.textContent = err.message;
      toast(err.message, "error", 6000);
      wa.removeAttribute("disabled");
    }
  });

  function showDone(res: RequestResult, opened: boolean) {
    const exp = new Date(res.export.expiresAt).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
    const copy = h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: async () => { try { await navigator.clipboard.writeText(res.export.downloadUrl); toast("Enlace copiado", "ok", 1400); } catch { toast("No se pudo copiar; selecciónalo manualmente.", "error"); } } }, ic("copy", 13), "Copiar enlace");
    body.replaceChildren(h("div", { class: "fn-card fn-done" },
      ic("check", 34),
      h("h2", null, "¡Solicitud registrada!"),
      h("p", { style: { color: "var(--st-muted)", maxWidth: "52ch" } }, "El equipo de ICARUS ya puede ver tu proyecto. Guarda este identificador:"),
      h("div", { class: "fn-code", "aria-label": "Identificador de solicitud" }, res.request.id),
      res.whatsapp.configured
        ? h("div", { class: "fn-note" }, h("strong", null, opened ? "Abrimos WhatsApp con tu mensaje listo. " : "No pudimos abrir WhatsApp automáticamente. "), "Pulsa «Enviar» en WhatsApp para que el equipo lo reciba. ",
          "WhatsApp solo recibe el mensaje y el enlace de descarga: el archivo ZIP no se adjunta automáticamente.",
          h("div", { style: { marginTop: "10px" } }, h("a", { class: "st-btn st-btn--primary st-btn--sm", href: res.whatsapp.url ?? "#", target: "_blank", rel: "noopener noreferrer" }, ic("wa", 15), opened ? "Abrir WhatsApp otra vez" : "Abrir WhatsApp")))
        : h("div", { class: "fn-note" }, h("strong", null, "WhatsApp aún no está configurado en este sitio. "), "Tu solicitud quedó registrada y el equipo la verá en su panel. Puedes compartir el enlace de descarga de abajo."),
      res.notify.attempted ? h("p", { class: "st-hint" }, res.notify.ok ? "También se notificó al equipo de ICARUS por WhatsApp Business." : `No se pudo notificar por WhatsApp Business: ${res.notify.detail}`) : null,
      h("div", { class: "fn-card", style: { width: "100%", textAlign: "left" } },
        h("dl", { class: "fn-dl" }, h("dt", null, "Archivo"), h("dd", null, `${res.export.filename} · ${(res.export.size / 1024).toFixed(0)} KB · ${res.export.files} archivos`), h("dt", null, "Enlace seguro"), h("dd", null, h("a", { href: res.export.downloadUrl }, res.export.downloadUrl)), h("dt", null, "Caduca"), h("dd", null, exp)),
        h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, h("a", { class: "st-btn st-btn--primary st-btn--sm", href: res.export.downloadUrl, download: res.export.filename }, ic("download", 14), "Descargar ZIP"), copy)),
      res.export.warnings.length ? h("p", { class: "st-hint" }, `Avisos al generar: ${res.export.warnings.join(" ")}`) : null,
      h("a", { class: "st-btn st-btn--ghost", href: "#/projects" }, "Ir a Mis proyectos")));
  }

  body.append(h("div", { class: "fn-grid" },
    h("div", null, h("div", { class: "fn-thumb" }, project.thumb ? svgEl(project.thumb) : h("div", { style: { padding: "60px" } }, "Sin miniatura")),
      h("div", { style: { display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" } }, prev, h("a", { class: "st-btn st-btn--ghost", href: `#/edit/${id}` }, ic("edit", 15), "Seguir editando"), dl)),
    h("div", { class: "fn-card" },
      h("h2", { style: { font: "800 18px var(--st-font)" } }, "Resumen de tu solicitud"),
      h("dl", { class: "fn-dl" },
        h("dt", null, "Proyecto"), h("dd", null, project.name),
        h("dt", null, "Nombre del sitio"), h("dd", null, project.siteName || "—"),
        h("dt", null, "Tipo de diseño"), h("dd", null, project.pageType || project.category || "—"),
        h("dt", null, "Páginas"), h("dd", null, String(project.pageCount)),
        h("dt", null, "Características"), h("dd", null, features.join(" · ")),
        h("dt", null, "Responsable"), h("dd", null, c.owner || session.user?.name || "—"),
        h("dt", null, "Teléfono"), h("dd", null, c.phone || "No indicado")),
      checks,
      h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Nota para el equipo (opcional)"), note),
      h("div", { class: "fn-cta" }, wa, h("p", { class: "st-hint" }, cfg?.whatsappConfigured ? "Se registrará tu solicitud, se generará el sitio y se abrirá WhatsApp con el resumen y un enlace seguro de descarga." : "WhatsApp no está configurado: tu solicitud se registrará y recibirás el enlace de descarga."), status))));

  host.replaceChildren(pageShell("none", h("div", null, h("h1", { class: "sh-title" }, "Finalizar y solicitar tu página"), h("p", { class: "sh-sub" }, "Revisa el resumen. Al pulsar el botón verificamos que todo esté guardado, generamos tu sitio y lo registramos."), h("div", { style: { height: "18px" } }), body), { narrow: false }));
  return () => {};
}
