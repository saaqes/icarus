import { resolveFontFamily } from "../model/style";
import type { Doc } from "../model/types";

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

