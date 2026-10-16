/** Genera el paquete descargable (ZIP) del sitio a partir del documento. Puro: corre en el navegador y en pruebas. */
import { buildSite, collectLocalAssets } from "./render";
import { checkAccessibility } from "./a11y";
import { slugify } from "../model/doc";
import { sniff } from "../sniff";
import type { Doc } from "../model/types";
import { createZip, listZip, ZipEntry } from "../zip";

export type AssetLoader = (src: string) => Promise<Uint8Array | null>;

export interface PackageResult { zip: Uint8Array; filename: string; files: string[]; warnings: string[] }

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function buildPackage(doc: Doc, projectName: string, loadAsset: AssetLoader): Promise<PackageResult> {
  // se leen primero los recursos para nombrarlos con su extensión real (según la firma del archivo)
  const loaded = new Map<string, Uint8Array | null>();
  const outNames = new Map<string, string>();
  let n = 0;
  for (const src of collectLocalAssets(doc)) {
    const data = await loadAsset(src).catch(() => null);
    loaded.set(src, data);
    const last = (src.split("/").pop() || "recurso").split("?")[0];
    if (/\.[a-z0-9]{2,5}$/i.test(last)) outNames.set(src, last.replace(/[^a-z0-9._-]/gi, "-").toLowerCase());
    else outNames.set(src, `recurso-${++n}.${(data && sniff(data)?.ext) || "bin"}`);
  }
  const site = buildSite(doc, { mode: "export", projectName, assetName: (s) => outNames.get(s) });
  const warnings = [...site.warnings];
  const entries: ZipEntry[] = site.files.map((f) => ({ path: f.path, data: enc.encode(f.content) }));
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
    const html = dec.decode(back.find((e) => e.path === p.file)!.data);
    for (const m of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) {
      if (!names.has(m[1])) warnings.push(`El archivo ${p.file} referencia ${m[1]}, que no está en el paquete.`);
    }
  }
  return { zip, filename: `${slugify(doc.settings.siteName || projectName)}.zip`, files: back.map((e) => e.path), warnings };
}

export { describeDoc } from "./summary";

export function accessibilityCounts(doc: Doc): { errors: number; warnings: number } {
  const i = checkAccessibility(doc);
  return { errors: i.filter((x) => x.level === "error").length, warnings: i.filter((x) => x.level === "warning").length };
}
