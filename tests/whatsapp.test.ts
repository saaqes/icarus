import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../server/config";
import { buildMessage, notifyAdmin, waUrl } from "../server/whatsapp";

const summary = {
  requestId: "ICR-ABC123", projectName: "Café Brasa", siteName: "Café Brasa", pageType: "Negocio o empresa", pageCount: 2,
  features: ["2 páginas", "animaciones"], downloadUrl: "https://icarus.example/api/downloads/tok", expiresAt: "2030-01-31T00:00:00.000Z",
};

test("WhatsApp: el mensaje contiene los datos reales de la solicitud", () => {
  const m = buildMessage(summary);
  for (const part of ["Hola, quiero solicitar la página web que diseñé con ICARUS Marketing.", "Proyecto: Café Brasa", "Nombre del sitio: Café Brasa", "Tipo de página: Negocio o empresa", "Número de páginas: 2", "Características: 2 páginas; animaciones", "Identificador de solicitud: ICR-ABC123", "https://icarus.example/api/downloads/tok", "Quiero continuar con el proceso"]) assert.ok(m.includes(part), part);
});

test("WhatsApp: el enlace wa.me solo se genera con un número válido (nunca incrustado)", () => {
  assert.equal(waUrl("", "hola"), null);
  assert.equal(waUrl("12", "hola"), null);
  const u = new URL(waUrl("573001112233", "Hola ñ\nlínea")!);
  assert.equal(u.host, "wa.me");
  assert.equal(u.searchParams.get("text"), "Hola ñ\nlínea");
  assert.equal(loadConfig({}, {}).whatsappNumber, "", "sin variable de entorno no hay número");
  assert.equal(loadConfig({ WHATSAPP_NUMBER: "+57 (300) 111-2233" }).whatsappNumber, "573001112233");
});

test("WhatsApp Business: sin credenciales no se intenta; con ellas se llama a la API oficial con la plantilla", async () => {
  const none = await notifyAdmin(loadConfig({}), summary);
  assert.equal(none.attempted, false);

  const cfg = loadConfig({ WHATSAPP_CLOUD_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_NOTIFY_TO: "573001112233", WHATSAPP_TEMPLATE: "nueva_solicitud" });
  let seen: any = null;
  const ok = await notifyAdmin(cfg, summary, (async (url: string, init: any) => { seen = { url, init }; return new Response("{}", { status: 200 }); }) as any);
  assert.equal(ok.ok, true);
  assert.match(seen.url, /graph\.facebook\.com\/v\d+\.\d+\/123\/messages$/);
  assert.equal(seen.init.headers.Authorization, "Bearer tok");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.template.name, "nueva_solicitud");
  assert.deepEqual(body.template.components[0].parameters.map((p: any) => p.text), ["ICR-ABC123", "Café Brasa", "https://icarus.example/api/downloads/tok"]);

  const bad = await notifyAdmin(cfg, summary, (async () => new Response("{}", { status: 401 })) as any);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /401/);
  const down = await notifyAdmin(cfg, summary, (async () => { throw new Error("sin red"); }) as any);
  assert.equal(down.ok, false);
});
