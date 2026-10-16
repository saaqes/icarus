/** Catálogo de tipografías (Google Fonts, licencia OFL). Solo se cargan las que el diseño usa. */

export type FontCategory = "sans-serif" | "serif" | "display" | "monospace" | "script";

export interface FontInfo {
  family: string;
  cat: FontCategory;
  weights: number[];
}

export const FONTS: FontInfo[] = [
  { family: "Manrope", cat: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { family: "Inter", cat: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { family: "Poppins", cat: "sans-serif", weights: [400, 500, 600, 700] },
  { family: "Montserrat", cat: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { family: "DM Sans", cat: "sans-serif", weights: [400, 500, 600, 700] },
  { family: "Space Grotesk", cat: "sans-serif", weights: [400, 500, 600, 700] },
  { family: "Sora", cat: "sans-serif", weights: [400, 500, 600, 700] },
  { family: "Outfit", cat: "sans-serif", weights: [400, 500, 600, 700] },
  { family: "Raleway", cat: "sans-serif", weights: [400, 500, 600, 700] },
  { family: "Nunito", cat: "sans-serif", weights: [400, 600, 700, 800] },
  { family: "Work Sans", cat: "sans-serif", weights: [400, 500, 600, 700] },
  { family: "Rubik", cat: "sans-serif", weights: [400, 500, 600, 700] },
  { family: "Archivo", cat: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { family: "Plus Jakarta Sans", cat: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { family: "Playfair Display", cat: "serif", weights: [400, 500, 600, 700, 800] },
  { family: "Cormorant Garamond", cat: "serif", weights: [400, 500, 600, 700] },
  { family: "Lora", cat: "serif", weights: [400, 500, 600, 700] },
  { family: "Merriweather", cat: "serif", weights: [400, 700] },
  { family: "Fraunces", cat: "serif", weights: [400, 500, 600, 700] },
  { family: "DM Serif Display", cat: "serif", weights: [400] },
  { family: "Cinzel", cat: "display", weights: [400, 500, 600, 700, 800, 900] },
  { family: "Bebas Neue", cat: "display", weights: [400] },
  { family: "Oswald", cat: "display", weights: [400, 500, 600, 700] },
  { family: "Unbounded", cat: "display", weights: [400, 500, 600, 700] },
  { family: "Syne", cat: "display", weights: [400, 500, 600, 700, 800] },
  { family: "JetBrains Mono", cat: "monospace", weights: [400, 500, 700] },
  { family: "Space Mono", cat: "monospace", weights: [400, 700] },
  { family: "Caveat", cat: "script", weights: [400, 600, 700] },
];

/** Combinaciones recomendadas título + párrafo. */
export const FONT_PAIRS: { heading: string; body: string; label: string }[] = [
  { heading: "Cinzel", body: "Manrope", label: "Mitológica" },
  { heading: "Space Grotesk", body: "Inter", label: "Tecnológica" },
  { heading: "Playfair Display", body: "Inter", label: "Editorial" },
  { heading: "Sora", body: "DM Sans", label: "Moderna" },
  { heading: "Fraunces", body: "Work Sans", label: "Cálida" },
  { heading: "Montserrat", body: "Lora", label: "Corporativa" },
  { heading: "Bebas Neue", body: "Inter", label: "Impacto" },
  { heading: "Unbounded", body: "Manrope", label: "Creativa" },
];

const BY_FAMILY = new Map(FONTS.map((f) => [f.family, f]));

export function fontInfo(family: string): FontInfo | undefined {
  return BY_FAMILY.get(family);
}

export function isKnownFont(family: string): boolean {
  return BY_FAMILY.has(family);
}

/** Pila CSS segura para una familia (siempre con alternativa genérica). */
export function fontStack(family: string): string {
  const info = BY_FAMILY.get(family);
  const safe = family.replace(/[^A-Za-z0-9 \-]/g, "");
  if (!info) return `system-ui, -apple-system, "Segoe UI", sans-serif`;
  const generic = info.cat === "display" ? "sans-serif" : info.cat === "script" ? "cursive" : info.cat;
  return `"${safe}", ${generic}`;
}

/** URL de Google Fonts para las familias y pesos indicados; null si no hay nada que cargar. */
export function googleFontsUrl(used: Map<string, Set<number>>): string | null {
  const parts: string[] = [];
  for (const [family, weights] of used) {
    const info = BY_FAMILY.get(family);
    if (!info) continue;
    const ws = [...new Set([...weights].map((w) => nearestWeight(info.weights, w)))].sort((a, b) => a - b);
    const fam = family.replace(/ /g, "+");
    parts.push(ws.length === 1 && info.weights.length === 1 ? `family=${fam}` : `family=${fam}:wght@${ws.join(";")}`);
  }
  if (!parts.length) return null;
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

function nearestWeight(available: number[], w: number): number {
  return available.reduce((best, cur) => (Math.abs(cur - w) < Math.abs(best - w) ? cur : best), available[0]);
}

/** Vista previa de nombres de fuentes (solo glifos necesarios gracias a `text=`). */
export function googleFontsPreviewUrl(families: string[]): string {
  const parts = families.map((f) => `family=${f.replace(/ /g, "+")}`);
  const text = encodeURIComponent(families.join("") + "AaBbCc 0123");
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&text=${text}&display=swap`;
}
