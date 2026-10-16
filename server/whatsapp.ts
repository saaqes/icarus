/**
 * WhatsApp. Abrir un enlace wa.me NO adjunta archivos: solo prepara el mensaje (con el enlace seguro de descarga).
 * Si hay credenciales de la WhatsApp Business Platform (Cloud API), además se notifica al administrador con una
 * plantilla aprobada. Sin esas credenciales esa parte simplemente no se ejecuta.
 */
import type { Config } from "./config";

export interface RequestSummary {
  requestId: string;
  projectName: string;
  siteName: string;
  pageType: string;
  pageCount: number;
  features: string[];
  downloadUrl: string;
  expiresAt: string;
}

export function buildMessage(s: RequestSummary): string {
  const exp = new Date(s.expiresAt).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  return [
    "Hola, quiero solicitar la página web que diseñé con ICARUS Marketing.",
    "",
    `Proyecto: ${s.projectName}`,
    `Nombre del sitio: ${s.siteName}`,
    `Tipo de página: ${s.pageType || "—"}`,
    `Número de páginas: ${s.pageCount}`,
    `Características: ${s.features.join("; ")}`,
    `Identificador de solicitud: ${s.requestId}`,
    `Enlace de descarga (válido hasta el ${exp}): ${s.downloadUrl}`,
    "",
    "Quiero continuar con el proceso para recibir mi página web.",
  ].join("\n");
}

export function waUrl(number: string, message: string): string | null {
  if (!/^\d{8,15}$/.test(number)) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export interface NotifyResult { attempted: boolean; ok: boolean; detail: string }

/** Notificación opcional vía Cloud API (plantilla con 3 variables: id, proyecto, enlace). */
export async function notifyAdmin(cfg: Config, s: RequestSummary, fetchImpl: typeof fetch = fetch): Promise<NotifyResult> {
  const c = cfg.cloudApi;
  if (!c.token || !c.phoneNumberId || !c.notifyTo || !c.template) {
    return { attempted: false, ok: false, detail: "Cloud API de WhatsApp no configurada." };
  }
  try {
    const res = await fetchImpl(`https://graph.facebook.com/v20.0/${encodeURIComponent(c.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: c.notifyTo,
        type: "template",
        template: {
          name: c.template,
          language: { code: c.lang },
          components: [{ type: "body", parameters: [s.requestId, s.projectName, s.downloadUrl].map((text) => ({ type: "text", text })) }],
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { attempted: true, ok: false, detail: `La API respondió ${res.status}.` };
    return { attempted: true, ok: true, detail: "Notificación enviada al administrador." };
  } catch (e) {
    return { attempted: true, ok: false, detail: `No se pudo contactar la API: ${(e as Error).message}` };
  }
}
