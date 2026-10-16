/** Panel administrativo: revisar solicitudes, cambiar su estado, ver la vista previa y gestionar enlaces de descarga. */
import { buildSite } from "../../shared/export/render";
import { Api, ApiError, STATUS_LABEL } from "../lib/api";
import { confirmDialog, debounce, formatDate, formatDateTime, h, ic, toast } from "../lib/dom";
import { pageShell } from "./shell";

const STATUSES = ["pending", "review", "in_progress", "delivered", "cancelled"] as const;

export function mountAdmin(host: HTMLElement, args: string[]): () => void {
  if (args[0]) return detail(host, args[0]);
  return list(host);
}

function list(host: HTMLElement): () => void {
  let status = "";
  let q = "";
  const tabs = h("div", { class: "ad-tabs", role: "group", "aria-label": "Filtrar por estado" });
  const table = h("div");
  const search = h("input", { class: "st-input", type: "search", placeholder: "Buscar por ID, nombre, correo o proyecto…", "aria-label": "Buscar solicitudes", style: { maxWidth: "420px" } });
  host.replaceChildren(pageShell("admin", h("div", null,
    h("h1", { class: "sh-title" }, "Solicitudes de páginas web"),
    h("p", { class: "sh-sub" }, "Páginas que los usuarios quieren recibir. Solo visible para el equipo de ICARUS."),
    h("div", { style: { height: "14px" } }), search, tabs, table)));

  async function load() {
    table.replaceChildren(h("div", { class: "st-loading" }, h("span", { class: "st-spin" })));
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (q) params.q = q;
      const { requests, counts } = await Api.adminRequests(params);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      tabs.replaceChildren(...[["", "Todas", total] as const, ...STATUSES.map((s) => [s, STATUS_LABEL[s], counts[s] ?? 0] as const)].map(([v, l, n]) =>
        h("button", { type: "button", class: `ad-chip${status === v ? " is-on" : ""}`, onclick: () => { status = v; void load(); } }, l, h("b", null, String(n)))));
      if (!requests.length) { table.replaceChildren(h("div", { class: "pj-empty" }, ic("shield", 30), h("h2", null, "Sin solicitudes"), h("p", null, "Cuando un usuario pulse «QUIERO ESTA PÁGINA» aparecerá aquí."))); return; }
      table.replaceChildren(h("table", { class: "ad-table" },
        h("thead", null, h("tr", null, ["Solicitud", "Usuario", "Proyecto", "Fecha", "Estado"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", null, requests.map((r) => h("tr", { class: "ad-row", tabindex: "0", onclick: () => { location.hash = `#/admin/${r.id}`; }, onkeydown: (e: KeyboardEvent) => { if (e.key === "Enter") location.hash = `#/admin/${r.id}`; } },
          h("td", null, h("code", null, r.id)),
          h("td", null, h("strong", null, r.userName), h("div", { class: "st-hint" }, r.userEmail)),
          h("td", null, String(r.summary.projectName ?? "—"), h("div", { class: "st-hint" }, `${r.summary.pageCount ?? 1} pág. · ${r.summary.pageType || "—"}`)),
          h("td", null, formatDate(r.createdAt)),
          h("td", null, h("span", { class: `ad-badge ad-badge--${r.status}` }, STATUS_LABEL[r.status] ?? r.status)))))));
    } catch (e) { table.replaceChildren(h("p", { class: "st-error" }, (e as ApiError).message)); }
  }
  search.addEventListener("input", debounce(() => { q = search.value.trim(); void load(); }, 250));
  void load();
  return () => {};
}

function detail(host: HTMLElement, id: string): () => void {
  const content = h("div", null, h("div", { class: "st-loading" }, h("span", { class: "st-spin" })));
  host.replaceChildren(pageShell("admin", content));

  async function load() {
    try {
      const d = await Api.adminRequest(id);
      const r = d.request;
      const note = h("textarea", { class: "st-input st-textarea", rows: "3", maxlength: "600", placeholder: "Nota interna (opcional)", "aria-label": "Nota" });
      const sel = h("select", { class: "st-select", "aria-label": "Estado de la solicitud" }, STATUSES.map((s) => h("option", { value: s, selected: s === r.status }, STATUS_LABEL[s])));
      const linkOut = h("div", { class: "st-hint", role: "status" });
      let previewHtml = "";
      if (d.doc) { try { const site = buildSite(d.doc, { mode: "preview" }); previewHtml = (site.pages.find((p) => p.page.id === d.doc!.settings.homePageId) ?? site.pages[0]).html; } catch { previewHtml = ""; } }
      const frame = h("iframe", { title: "Vista previa del diseño solicitado", sandbox: "allow-scripts", style: { width: "100%", height: "100%", border: "0" } }) as HTMLIFrameElement;
      if (previewHtml) frame.srcdoc = previewHtml;

      content.replaceChildren(
        h("a", { class: "sh-link", href: "#/admin", style: { marginLeft: "-12px" } }, ic("chevron-left", 14), "Todas las solicitudes"),
        h("div", { style: { display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", margin: "6px 0 18px" } },
          h("h1", { class: "sh-title" }, r.id), h("span", { class: `ad-badge ad-badge--${r.status}` }, STATUS_LABEL[r.status] ?? r.status)),
        h("div", { class: "ad-detail" },
          h("div", { style: { display: "grid", gap: "18px" } },
            h("div", { class: "ad-box" }, h("h3", null, "Diseño solicitado"), previewHtml ? h("div", { class: "ad-previewframe" }, frame) : h("p", { class: "st-empty" }, "El proyecto ya no existe; solo se conserva el paquete entregado.")),
            h("div", { class: "ad-box" }, h("h3", null, "Historial"),
              h("ul", { class: "ad-timeline" }, d.events.map((e) => h("li", null,
                h("strong", null, e.type === "created" ? "Solicitud creada" : e.type === "status" ? `Estado: ${STATUS_LABEL[e.from ?? ""] ?? e.from} → ${STATUS_LABEL[e.to ?? ""] ?? e.to}` : e.type === "link" ? "Enlace de descarga regenerado" : e.type === "revoke" ? "Enlace revocado" : e.type === "notify" ? "Notificación WhatsApp Business" : "Nota"),
                e.note ? h("div", null, e.note) : null, h("small", null, `${e.actor ?? "Sistema"} · ${formatDateTime(e.createdAt)}`)))))),
          h("div", { style: { display: "grid", gap: "18px" } },
            h("div", { class: "ad-box" }, h("h3", null, "Cliente"),
              h("dl", { class: "fn-dl" },
                h("dt", null, "Cuenta"), h("dd", null, `${r.userName} · ${r.userEmail}`),
                h("dt", null, "Responsable"), h("dd", null, String(r.contact.owner || "—")),
                h("dt", null, "Correo"), h("dd", null, String(r.contact.email || "—")),
                h("dt", null, "Teléfono"), h("dd", null, String(r.contact.phone || "—")),
                h("dt", null, "País"), h("dd", null, String(r.contact.country || "—")))),
            h("div", { class: "ad-box" }, h("h3", null, "Proyecto"),
              h("dl", { class: "fn-dl" },
                h("dt", null, "Nombre"), h("dd", null, String(r.summary.projectName ?? "—")),
                h("dt", null, "Sitio"), h("dd", null, String(r.summary.siteName ?? "—")),
                h("dt", null, "Tipo"), h("dd", null, String(r.summary.pageType || "—")),
                h("dt", null, "Páginas"), h("dd", null, String(r.summary.pageCount ?? "—")),
                h("dt", null, "Características"), h("dd", null, Array.isArray(r.summary.features) ? r.summary.features.join(" · ") : "—"),
                h("dt", null, "Fecha"), h("dd", null, formatDateTime(r.createdAt)),
                h("dt", null, "Nota del cliente"), h("dd", null, r.note || "—")),
              d.project ? h("a", { class: "st-hint", href: "#/admin" }, "") : null),
            h("div", { class: "ad-box" }, h("h3", null, "Actualizar estado"), sel, note,
              h("button", { type: "button", class: "st-btn st-btn--primary", onclick: async () => {
                try { await Api.adminSetStatus(id, sel.value, note.value.trim()); toast("Estado actualizado", "ok", 1400); await load(); } catch (e) { toast((e as Error).message, "error"); }
              } }, "Guardar estado")),
            h("div", { class: "ad-box" }, h("h3", null, "Entrega (ZIP)"),
              d.export ? h("dl", { class: "fn-dl" }, h("dt", null, "Archivo"), h("dd", null, `${d.export.filename} · ${(d.export.size / 1024).toFixed(0)} KB`), h("dt", null, "Enlace"), h("dd", null, d.export.revoked ? "Revocado" : d.export.expired ? "Caducado" : `Vigente hasta ${formatDate(d.export.expiresAt)}`), h("dt", null, "Descargas"), h("dd", null, String(d.export.downloads))) : h("p", { class: "st-empty" }, "Sin paquete asociado."),
              h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
                h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: async () => {
                  try {
                    const l = await Api.adminLink(id);
                    linkOut.replaceChildren(h("a", { href: l.downloadUrl }, l.downloadUrl), h("div", null, `Caduca ${formatDate(l.expiresAt)}. Se muestra una sola vez.`));
                    try { await navigator.clipboard.writeText(l.downloadUrl); toast("Enlace nuevo copiado", "ok", 1400); } catch { /* sin portapapeles */ }
                  } catch (e) { toast((e as Error).message, "error"); }
                } }, ic("link", 13), "Generar enlace nuevo"),
                h("button", { type: "button", class: "st-btn st-btn--ghost st-btn--sm", onclick: async () => {
                  if (await confirmDialog("Revocar enlace", "El enlace de descarga actual dejará de funcionar.", "Revocar", true)) { await Api.adminRevoke(id).catch((e) => toast(e.message, "error")); await load(); }
                } }, "Revocar enlace")),
              linkOut))));
    } catch (e) {
      content.replaceChildren(h("div", { class: "st-fullmsg" }, h("h1", null, "Solicitud no encontrada"), h("p", null, (e as ApiError).message), h("a", { class: "st-btn st-btn--primary", href: "#/admin" }, "Volver")));
    }
  }
  void load();
  return () => {};
}
