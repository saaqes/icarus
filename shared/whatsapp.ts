/**
 * WhatsApp. Abrir un enlace wa.me NO adjunta archivos: solo abre el chat con el mensaje preparado.
 * El archivo ZIP se adjunta con «Compartir archivo» (Web Share) o a mano desde las descargas del dispositivo.
 */
export interface RequestSummary {
  requestId: string;
  customerName: string;
  customerPhone: string;
  projectName: string;
  siteName: string;
  pageType: string;
  pageCount: number;
  features: string[];
  filename: string;
  note?: string;
}

export function buildMessage(s: RequestSummary): string {
  return [
    "Hola, quiero solicitar la página web que diseñé con ICARUS Website Builder.",
    "",
    `Nombre: ${s.customerName}`,
    `WhatsApp: ${s.customerPhone}`,
    `Proyecto: ${s.projectName}`,
    `Nombre del sitio: ${s.siteName || "—"}`,
    `Tipo de página: ${s.pageType || "—"}`,
    `Número de páginas: ${s.pageCount}`,
    `Características: ${s.features.join("; ") || "—"}`,
    `Código de solicitud: ${s.requestId}`,
    s.note ? `Nota: ${s.note}` : "",
    "",
    `Te envío el archivo ${s.filename} con mi diseño (lo adjunto en este chat).`,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

export function waUrl(number: string, message: string): string | null {
  if (!/^\d{8,15}$/.test(number)) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Normaliza un teléfono escrito por una persona (acepta +, espacios y guiones). */
export function cleanPhone(raw: string): string { return raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, ""); }
export function isValidPhone(raw: string): boolean { return /^\+?\d{8,15}$/.test(cleanPhone(raw)); }
