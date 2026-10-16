/**
 * Los archivos subidos viven en IndexedDB y el documento los nombra «/local/<id>». Este módulo los resuelve a URLs
 * que el navegador puede mostrar (blob: en el lienzo, data: en la vista previa aislada).
 */
const REF = /\/local\/[a-z0-9_-]{6,60}/gi;
const urls = new Map<string, string>();
const blobs = new Map<string, Blob>();

export const isLocalRef = (s: unknown): boolean => typeof s === "string" && /^\/local\/[a-z0-9_-]{6,60}$/i.test(s);

export function registerBlob(ref: string, blob: Blob): void {
  blobs.set(ref, blob);
  if (!urls.has(ref)) urls.set(ref, URL.createObjectURL(blob));
}
export function forgetBlob(ref: string): void {
  const u = urls.get(ref);
  if (u) URL.revokeObjectURL(u);
  urls.delete(ref); blobs.delete(ref);
}

/** URL mostrable de una referencia (las que no son locales se devuelven tal cual). */
export function assetUrl(src: string): string {
  return isLocalRef(src) ? (urls.get(src) ?? "") : src;
}
/** Sustituye las referencias locales dentro de un texto CSS. */
export function resolveCss(css: string): string {
  return css.includes("/local/") ? css.replace(REF, (m) => urls.get(m) ?? "") : css;
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
/** Para la vista previa (iframe aislado): incrusta los archivos locales como data: URLs. */
export async function inlineLocalRefs(html: string): Promise<string> {
  const found = [...new Set(html.match(REF) ?? [])];
  if (!found.length) return html;
  const map = new Map<string, string>();
  for (const ref of found) { const b = blobs.get(ref); if (b) map.set(ref, await toDataUrl(b)); }
  return html.replace(REF, (m) => map.get(m) ?? "");
}
export function blobOf(ref: string): Blob | undefined { return blobs.get(ref); }
