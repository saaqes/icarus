/** Finalizar: resumen, descarga local del sitio y «QUIERO ESTA PÁGINA» (pide nombre y WhatsApp, genera el ZIP y abre WhatsApp). */
import { checkAccessibility } from "../../shared/export/a11y";
import { describeDoc } from "../../shared/export/summary";
import { ProjectFull } from "../../shared/model/types";
import { buildMessage, cleanPhone, isValidPhone, waUrl } from "../../shared/whatsapp";
import { Api, ApiError } from "../lib/api";
import { preloadAssets } from "../lib/api";
import { downloadBlob, safeName, zipBlob } from "../lib/download";
import { session } from "../core/session";
import { h, ic, toast } from "../lib/dom";
import { newId } from "../lib/local";
import { openPreview } from "../ui/preview";
import { svgEl } from "../ui/templates";
import { pageShell } from "./shell";

export async function mountFinish(host: HTMLElement, args: string[]): Promise<() => void> {
  const id = args[0];
  let project: ProjectFull;
  try { project = (await Api.project(id)).project; await preloadAssets(project.doc); }
  catch (e) { toast((e as ApiError).message, "error"); location.hash = "#/projects"; return () => {}; }

  const issues = checkAccessibility(project.doc);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const features = describeDoc(project.doc);
  const number = session.config.whatsappNumber;
  const saved = await Api.customer();
  const body = h("div");

  const row = (cls: string, icon: string, text: string) => h("li", { class: cls }, ic(icon, 16), h("span", null, text));
  const checks = h("ul", { class: "fn-checks" },
    row("fn-ok", "check", `Guardado en este dispositivo (revisión ${project.rev}). Lo que ves aquí es exactamente lo que se enviará.`),
    errors.length ? row("fn-bad", "alert", `${errors.length} problema(s) impiden generar el sitio: ${errors[0].message}`) : row("fn-ok", "check", "El sitio se puede generar sin errores."),
    warnings.length ? row("fn-warn", "info", `${warnings.length} aviso(s) de calidad o accesibilidad (no bloquean). Ej.: ${warnings[0].message}`) : row("fn-ok", "check", "Sin avisos de accesibilidad básica."));

  const field = (label: string, input: HTMLElement, hint?: string) => h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, label), input, hint ? h("span", { class: "st-hint" }, hint) : null);
  const nameIn = h("input", { class: "st-input", type: "text", maxlength: "80", autocomplete: "name", placeholder: "Tu nombre completo", required: true, value: saved.name || project.contact.owner || "" }) as HTMLInputElement;
  const phoneIn = h("input", { class: "st-input", type: "tel", maxlength: "20", autocomplete: "tel", inputmode: "tel", placeholder: "+57 300 000 0000", required: true, value: saved.phone || project.contact.phone || "" }) as HTMLInputElement;
  const note = h("textarea", { class: "st-input st-textarea", rows: "2", maxlength: "600", placeholder: "Opcional: horarios de contacto, dominio que quieres usar, dudas…", "aria-label": "Nota para el equipo de ICARUS" }) as HTMLTextAreaElement;
  const err = h("p", { class: "st-error", role: "alert", hidden: true });
  const status = h("p", { class: "st-hint", role: "status", "aria-live": "polite" });
  const wa = h("button", { type: "button", class: "st-btn st-btn--primary st-btn--lg", disabled: errors.length > 0 }, ic("wa", 18), "QUIERO ESTA PÁGINA");
  const dl = h("button", { type: "button", class: "st-btn st-btn--ghost" }, ic("download", 15), "Descargar sitio (.zip)");
  const exp = h("button", { type: "button", class: "st-btn st-btn--ghost" }, ic("save", 15), "Exportar proyecto editable");
  const prev = h("button", { type: "button", class: "st-btn st-btn--ghost", onclick: () => openPreview({ doc: project.doc, pageId: project.doc.settings.homePageId }) }, ic("play", 15), "Vista previa");

  dl.addEventListener("click", async () => {
    dl.setAttribute("disabled", ""); status.textContent = "Generando el sitio…";
    try {
      const r = await Api.buildZip(id);
      downloadBlob(zipBlob(r.zip), r.filename);
      status.textContent = `Descargando ${r.filename} · ${(r.zip.length / 1024).toFixed(0)} KB · ${r.files.length} archivos.${r.warnings.length ? ` Avisos: ${r.warnings.join(" ")}` : ""}`;
    } catch (e) { status.textContent = (e as Error).message; toast((e as Error).message, "error"); }
    dl.removeAttribute("disabled");
  });

  exp.addEventListener("click", async () => {
    try {
      const file = await Api.exportProjectFile(id);
      downloadBlob(new Blob([JSON.stringify(file)], { type: "application/json" }), `${safeName(project.name)}.icarus.json`);
      toast("Proyecto exportado. Puedes importarlo en «Mis proyectos» desde otro dispositivo.", "ok", 3500);
    } catch (e) { toast((e as Error).message, "error"); }
  });

  wa.addEventListener("click", async () => {
    err.hidden = true;
    const name = nameIn.value.trim().replace(/\s+/g, " ");
    if (name.length < 2) { err.textContent = "Escribe tu nombre."; err.hidden = false; nameIn.focus(); return; }
    if (!isValidPhone(phoneIn.value)) { err.textContent = "Escribe tu número de WhatsApp con el código del país (solo dígitos, ej.: +57 300 000 0000)."; err.hidden = false; phoneIn.focus(); return; }
    const phone = cleanPhone(phoneIn.value);
    // La ventana se abre dentro del gesto del usuario (los navegadores bloquean ventanas abiertas tras una espera).
    const win = number ? window.open("about:blank", "_blank") : null;
    wa.setAttribute("disabled", ""); status.textContent = "Generando tu sitio y preparando el mensaje…";
    try {
      await Api.saveCustomer({ name, phone });
      await Api.patchProject(id, { contact: { ...project.contact, owner: name, phone }, status: "ready" });
      const built = await Api.buildZip(id);
      const requestId = `ICA-${newId("x", 6).slice(2).toUpperCase()}`;
      const summary = { projectName: project.name, siteName: project.siteName, pageType: project.pageType || project.category, pageCount: project.pageCount, features };
      const text = buildMessage({ requestId, customerName: name, customerPhone: phone, ...summary, filename: built.filename, note: note.value.trim() });
      await Api.addRequest({ id: requestId, projectId: id, projectName: project.name, createdAt: new Date().toISOString(), rev: project.rev, customer: { name, phone }, note: note.value.trim(), filename: built.filename, size: built.zip.length, files: built.files.length, summary });
      const blob = zipBlob(built.zip);
      downloadBlob(blob, built.filename);
      const url = number ? waUrl(number, text) : null;
      if (win && url) { try { win.opener = null; } catch { /* ya sin opener */ } win.location.href = url; } else win?.close();
      showDone({ requestId, filename: built.filename, size: built.zip.length, files: built.files.length, warnings: built.warnings, blob, text, url, opened: !!(win && url) });
    } catch (e) {
      win?.close();
      const m = (e as Error).message;
      status.textContent = m;
      toast(m, "error", 6000);
      wa.removeAttribute("disabled");
    }
  });

  interface Done { requestId: string; filename: string; size: number; files: number; warnings: string[]; blob: Blob; text: string; url: string | null; opened: boolean }
  function showDone(d: Done) {
    const file = new File([d.blob], d.filename, { type: "application/zip" });
    const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    const share = canShare ? h("button", { type: "button", class: "st-btn st-btn--primary", onclick: async () => {
      try { await navigator.share({ files: [file], text: d.text, title: "Mi página web ICARUS" }); } catch (e) { if ((e as Error).name !== "AbortError") toast("No se pudo abrir el menú de compartir; adjunta el archivo descargado manualmente.", "error", 5000); }
    } }, ic("wa", 15), "Compartir el archivo (WhatsApp)") : null;
    const copy = h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: async () => { try { await navigator.clipboard.writeText(d.text); toast("Mensaje copiado", "ok", 1400); } catch { toast("No se pudo copiar; selecciónalo manualmente.", "error"); } } }, ic("copy", 13), "Copiar mensaje");
    body.replaceChildren(h("div", { class: "fn-card fn-done" },
      ic("check", 34),
      h("h2", null, "¡Tu página está lista para enviar!"),
      h("p", { style: { color: "var(--st-muted)", maxWidth: "56ch" } }, "Guarda este código y envíalo con tu archivo:"),
      h("div", { class: "fn-code", "aria-label": "Código de solicitud" }, d.requestId),
      h("ol", { class: "fn-steps", style: { textAlign: "left", maxWidth: "58ch", display: "grid", gap: "8px", paddingLeft: "20px" } },
        h("li", null, h("strong", null, `Se descargó ${d.filename}`), ` (${(d.size / 1024).toFixed(0)} KB, ${d.files} archivos). Búscalo en la carpeta de descargas de tu dispositivo.`),
        h("li", null, d.url
          ? h("span", null, h("strong", null, d.opened ? "Abrimos WhatsApp con tu mensaje listo. " : "Abre WhatsApp con tu mensaje listo. "), "Pulsa «Enviar».")
          : h("span", null, h("strong", null, "WhatsApp aún no está configurado en este sitio. "), "Copia el mensaje y envíalo al equipo de ICARUS por el medio que ya conozcas.")),
        h("li", null, h("strong", null, "Adjunta el archivo "), canShare ? "con el botón «Compartir el archivo», o con el clip 📎 → Documento." : "con el clip 📎 → Documento de WhatsApp. (WhatsApp no permite adjuntar archivos automáticamente desde un enlace.)")),
      h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" } },
        d.url ? h("a", { class: `st-btn ${canShare ? "st-btn--ghost" : "st-btn--primary"}`, href: d.url, target: "_blank", rel: "noopener noreferrer" }, ic("wa", 15), d.opened ? "Abrir WhatsApp otra vez" : "Abrir WhatsApp") : null,
        share,
        h("button", { type: "button", class: "st-btn st-btn--ghost", onclick: () => downloadBlob(d.blob, d.filename) }, ic("download", 14), "Descargar ZIP otra vez"), copy),
      d.warnings.length ? h("p", { class: "st-hint" }, `Avisos al generar: ${d.warnings.join(" ")}`) : null,
      h("p", { class: "st-hint", style: { maxWidth: "56ch" } }, "Tu proyecto sigue guardado en este dispositivo en «Mis proyectos»."),
      h("a", { class: "st-btn st-btn--ghost", href: "#/projects" }, "Ir a Mis proyectos")));
  }

  body.append(h("div", { class: "fn-grid" },
    h("div", null, h("div", { class: "fn-thumb" }, project.thumb ? svgEl(project.thumb) : h("div", { style: { padding: "60px" } }, "Sin miniatura")),
      h("div", { style: { display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" } }, prev, h("a", { class: "st-btn st-btn--ghost", href: `#/edit/${id}` }, ic("edit", 15), "Seguir editando"), dl, exp)),
    h("div", { class: "fn-card" },
      h("h2", { style: { font: "800 18px var(--st-font)" } }, "Resumen de tu página"),
      h("dl", { class: "fn-dl" },
        h("dt", null, "Proyecto"), h("dd", null, project.name),
        h("dt", null, "Nombre del sitio"), h("dd", null, project.siteName || "—"),
        h("dt", null, "Tipo de diseño"), h("dd", null, project.pageType || project.category || "—"),
        h("dt", null, "Páginas"), h("dd", null, String(project.pageCount)),
        h("dt", null, "Características"), h("dd", null, features.join(" · "))),
      checks,
      h("h3", { style: { font: "700 15px var(--st-font)", marginTop: "6px" } }, "Tus datos para contactarte"),
      h("div", { class: "wz-grid" }, field("Nombre *", nameIn), field("WhatsApp *", phoneIn, "Con el código del país.")),
      h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Nota para el equipo (opcional)"), note),
      err,
      h("div", { class: "fn-cta" }, wa, h("p", { class: "st-hint" }, number
        ? "Descargaremos el archivo de tu página, guardaremos esta solicitud en tu dispositivo y abriremos WhatsApp con el resumen. Después adjuntas el archivo y envías."
        : "El número de WhatsApp de ICARUS no está configurado en este sitio: se descargará el archivo y podrás compartirlo manualmente."), status))));

  host.replaceChildren(pageShell("none", h("div", null, h("h1", { class: "sh-title" }, "Finalizar y enviar tu página"), h("p", { class: "sh-sub" }, "Revisa el resumen, escribe tu nombre y WhatsApp, y envíanos tu diseño. Tu proyecto no sale de tu dispositivo hasta que tú lo envías."), h("div", { style: { height: "18px" } }), body), { narrow: false }));
  return () => {};
}
