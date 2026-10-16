/** Genera el paquete descargable (ZIP) del sitio a partir del documento guardado. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildSite, collectLocalAssets } from "../shared/export/render";
import { sniff } from "./storage";
import { checkAccessibility } from "../shared/export/a11y";
import { slugify } from "../shared/model/doc";
import { resolveFontFamily } from "../shared/model/style";
import { STATIC_IMAGE_PREFIXES } from "../shared/library";
import type { Doc } from "../shared/model/types";
import { createZip, listZip, ZipEntry } from "./zip";

export type AssetLoader = (src: string) => Promise<Buffer | null>;

export interface PackageResult {
  zip: Buffer;
  filename: string;
  files: string[];
  warnings: string[];
}

export async function buildPackage(doc: Doc, projectName: string, loadAsset: AssetLoader): Promise<PackageResult> {
  // se leen primero los recursos para nombrarlos con su extensión real (según la firma del archivo)
  const loaded = new Map<string, Buffer | null>();
  const outNames = new Map<string, string>();
  let n = 0;
  for (const src of collectLocalAssets(doc)) {
    const data = await loadAsset(src);
    loaded.set(src, data);
    const last = (src.split("/").pop() || "recurso").split("?")[0];
    if (/\.[a-z0-9]{2,5}$/i.test(last)) outNames.set(src, last.replace(/[^a-z0-9._-]/gi, "-").toLowerCase());
    else {
      const kind = data ? sniff(data) : null;
      outNames.set(src, `recurso-${++n}.${kind?.ext ?? "bin"}`);
    }
  }
  const site = buildSite(doc, { mode: "export", projectName, assetName: (s) => outNames.get(s) });
  const warnings = [...site.warnings];
  const entries: ZipEntry[] = site.files.map((f) => ({ path: f.path, data: Buffer.from(f.content, "utf8") }));
  const seen = new Set(entries.map((e) => e.path));
  for (const a of site.assets) {
    if (seen.has(a.path)) continue;
    const data = loaded.get(a.src) ?? null;
    if (!data) { warnings.push(`No se encontró el recurso ${a.src}; no se incluyó en el paquete.`); continue; }
    seen.add(a.path);
    entries.push({ path: a.path, data });
  }
  const zip = createZip(entries);
  // verificación: el ZIP se puede leer, trae las páginas y todos los recursos locales referenciados existen
  const back = listZip(zip);
  const names = new Set(back.map((e) => e.path));
  if (!names.has("index.html") || !names.has("assets/styles.css")) throw new Error("El paquete generado está incompleto.");
  for (const p of site.pages) {
    const html = back.find((e) => e.path === p.file)!.data.toString("utf8");
    for (const m of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) {
      if (!names.has(m[1])) warnings.push(`El archivo ${p.file} referencia ${m[1]}, que no está en el paquete.`);
    }
  }
  return { zip, filename: `${slugify(doc.settings.siteName || projectName)}.zip`, files: back.map((e) => e.path), warnings };
}

/** Lector de recursos locales: subidos (almacenamiento) o de la biblioteca incluida en dist/. */
export function makeAssetLoader(opts: { distDir: string; uploaded: (id: string) => Promise<Buffer | null> }): AssetLoader {
  return async (src) => {
    const up = /^\/api\/assets\/([a-z0-9_-]+)$/i.exec(src);
    if (up) return opts.uploaded(up[1]);
    if (STATIC_IMAGE_PREFIXES.some((p) => src.startsWith(p)) && !src.includes("..")) {
      const file = path.join(opts.distDir, src);
      if (!file.startsWith(opts.distDir)) return null;
      try { return await readFile(file); } catch { return null; }
    }
    return null;
  };
}

/** Resumen legible de las características del diseño (para la solicitud y el mensaje de WhatsApp). */
export function describeDoc(doc: Doc): string[] {
  const nodes = Object.values(doc.nodes).filter((n) => !n.hidden);
  const count = (t: string) => nodes.filter((n) => n.type === t).length;
  const out: string[] = [];
  out.push(`${doc.pages.length} página${doc.pages.length === 1 ? "" : "s"}`);
  out.push(`${count("section")} secciones`);
  if (count("image")) out.push(`${count("image")} imágenes`);
  if (count("video")) out.push(`${count("video")} vídeos`);
  if (count("form")) out.push("formulario de contacto");
  if (doc.settings.animations && nodes.some((n) => n.anim && n.anim.type !== "none")) out.push("animaciones");
  out.push("diseño responsive (escritorio, tableta y móvil)");
  const fonts = new Set<string>();
  fonts.add(doc.theme.fonts.heading); fonts.add(doc.theme.fonts.body);
  for (const n of nodes) if (n.s.base.font) fonts.add(resolveFontFamily(n.s.base.font, doc.theme));
  out.push(`tipografías: ${[...fonts].filter(Boolean).join(", ")}`);
  return out;
}

export function accessibilityCounts(doc: Doc): { errors: number; warnings: number } {
  const i = checkAccessibility(doc);
  return { errors: i.filter((x) => x.level === "error").length, warnings: i.filter((x) => x.level === "warning").length };
}
