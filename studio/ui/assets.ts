/** Selector de recursos (mis archivos, biblioteca incluida, enlace externo) y subida validada. */
import { LIBRARY, libSrc, SITE_IMAGES } from "../../shared/library";
import { Api, ApiError, Asset } from "../lib/api";
import { clear, h, ic, modal, toast } from "../lib/dom";
import { session } from "../core/session";

const MAX_IMAGE = 5 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm"];

export function validateFile(f: File, kind: "image" | "video" | "any"): string | null {
  if (!OK_TYPES.includes(f.type)) return "Formato no admitido. Usa PNG, JPG, WebP, GIF, AVIF, MP4 o WebM.";
  if (kind === "image" && !f.type.startsWith("image/")) return "Aquí solo se admiten imágenes.";
  if (kind === "video" && !f.type.startsWith("video/")) return "Aquí solo se admiten vídeos.";
  const max = f.type.startsWith("image/") ? MAX_IMAGE : (session.config?.maxUploadMb ?? 8) * 1024 * 1024;
  if (f.size > max) return `El archivo pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo es ${Math.round(max / 1048576)} MB.`;
  return null;
}

export async function uploadFile(f: File, kind: "image" | "video" | "any" = "any"): Promise<Asset | null> {
  const err = validateFile(f, kind);
  if (err) { toast(err, "error", 5000); return null; }
  try {
    const { asset } = await Api.upload(f, session.projectId ?? undefined);
    toast("Archivo subido", "ok", 1500);
    return asset;
  } catch (e) {
    const a = e as ApiError;
    toast(a.status === 401 ? "Inicia sesión para subir archivos." : a.message, "error", 5000);
    return null;
  }
}

/** Abre un diálogo para elegir un recurso. Devuelve la URL elegida o null. */
export function pickAsset(kind: "image" | "video" | "any" = "image", title = "Elegir recurso"): Promise<string | null> {
  return new Promise((resolve) => {
    let chosen: string | null = null;
    const content = h("div", { class: "ap-content" });
    const tabs = h("div", { class: "st-tabs", role: "tablist" });
    const fileIn = h("input", { type: "file", hidden: true, accept: kind === "video" ? "video/mp4,video/webm" : kind === "image" ? "image/png,image/jpeg,image/webp,image/gif,image/avif" : "image/*,video/mp4,video/webm" });

    const choose = (url: string) => { chosen = url; (document.querySelector(".st-modal .st-btn--primary") as HTMLElement | null)?.click(); };

    const thumb = (url: string, name: string, isVideo = false, onDelete?: () => void) =>
      h("div", { class: "ap-item" },
        h("button", { type: "button", class: "ap-thumb", title: name, "aria-label": `Usar ${name}`, onclick: () => choose(url) },
          isVideo ? h("div", { class: "ap-video" }, ic("play", 22)) : h("img", { src: url, alt: "", loading: "lazy", decoding: "async" }), h("span", null, name)),
        onDelete ? h("button", { type: "button", class: "ap-del st-icon-btn", "aria-label": `Eliminar ${name}`, onclick: onDelete }, ic("trash", 14)) : null);

    const tabMine = async () => {
      clear(content);
      const grid = h("div", { class: "ap-grid" });
      content.append(
        h("div", { class: "ap-bar" }, h("button", { type: "button", class: "st-btn st-btn--primary st-btn--sm", onclick: () => fileIn.click() }, ic("upload", 14), "Subir archivo"),
          h("span", { class: "st-hint" }, "PNG, JPG, WebP, GIF, AVIF (5 MB) · MP4, WebM")), grid);
      if (!session.user) { grid.append(h("p", { class: "st-empty" }, "Inicia sesión para ver y subir tus archivos.")); return; }
      grid.append(h("p", { class: "st-empty" }, "Cargando…"));
      try {
        const { assets } = await Api.assets();
        clear(grid);
        const list = assets.filter((a) => kind === "any" || a.kind === kind);
        if (!list.length) grid.append(h("p", { class: "st-empty" }, "Todavía no has subido archivos. Pulsa «Subir archivo»."));
        for (const a of list) grid.append(thumb(a.url, a.name, a.kind === "video", async () => {
          try { await Api.deleteAsset(a.id); toast("Archivo eliminado", "info", 1500); void tabMine(); }
          catch (e) { const er = e as ApiError; if (er.code === "in_use") { if (confirm(`${er.message}\n\nSi lo eliminas dejará de verse en esos proyectos. ¿Eliminar de todos modos?`)) { await Api.deleteAsset(a.id, true); void tabMine(); } } else toast(er.message, "error"); }
        }));
      } catch (e) { clear(grid); grid.append(h("p", { class: "st-empty" }, (e as Error).message)); }
    };

    const tabLib = () => {
      clear(content);
      if (kind === "video") { content.append(h("p", { class: "st-empty" }, "La biblioteca incluida solo contiene imágenes. Sube un vídeo o pega un enlace.")); return; }
      const cats = [...new Set(LIBRARY.map((l) => l.category))];
      for (const c of cats) {
        content.append(h("h4", { class: "ap-cat" }, c[0].toUpperCase() + c.slice(1)), h("div", { class: "ap-grid" }, LIBRARY.filter((l) => l.category === c).map((l) => thumb(libSrc(l.id), l.name))));
      }
      content.append(h("h4", { class: "ap-cat" }, "Capturas de las demos de ICARUS"), h("div", { class: "ap-grid" }, SITE_IMAGES.map((l) => thumb(l.src, l.name))));
    };

    const tabUrl = () => {
      clear(content);
      const input = h("input", { class: "st-input", type: "url", placeholder: "https://…", "aria-label": "Dirección del archivo" });
      content.append(h("div", { class: "ap-url" }, h("label", { class: "st-field" }, h("span", { class: "st-field__label" }, "Enlace al archivo (solo https)"), input),
        h("button", { type: "button", class: "st-btn st-btn--primary st-btn--sm", onclick: () => { const v = input.value.trim(); if (!/^https:\/\/[^\s"'()<>\\]+$/i.test(v)) { toast("Escribe una dirección https válida.", "error"); return; } choose(v); } }, "Usar enlace"),
        h("p", { class: "st-hint" }, "Asegúrate de tener permiso para usar el archivo. Los enlaces externos no se incluyen en el ZIP: dependen de ese servidor.")));
    };

    const tabDefs: [string, () => void][] = [["Mis archivos", () => void tabMine()], ["Biblioteca", tabLib], ["Enlace", tabUrl]];
    const select = (i: number) => { tabs.querySelectorAll("button").forEach((b, k) => { b.setAttribute("aria-selected", String(k === i)); b.classList.toggle("is-on", k === i); }); tabDefs[i][1](); };
    tabDefs.forEach(([label], i) => tabs.append(h("button", { type: "button", role: "tab", class: "st-tab", onclick: () => select(i) }, label)));

    fileIn.addEventListener("change", async () => {
      const f = fileIn.files?.[0];
      fileIn.value = "";
      if (!f) return;
      const a = await uploadFile(f, kind);
      if (a) choose(a.url);
    });

    const body = h("div", { class: "ap" }, tabs, content, fileIn);
    void modal({ title, body, wide: true, actions: [{ label: "Cancelar", kind: "ghost" }, { label: "Aceptar", kind: "primary", onClick: () => { if (!chosen) return false; } }] }).then(() => resolve(chosen));
    select(0);
  });
}
