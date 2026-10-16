import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES } from "../shared/templates";
import { buildPackage } from "../shared/export/package";
import { createZip, listZip } from "../shared/zip";
import { sniff } from "../shared/sniff";
import { buildMessage, cleanPhone, isValidPhone, waUrl } from "../shared/whatsapp";
import { isSafeAssetSrc } from "../shared/model/validate";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);

test("ZIP: se escribe y se lee igual (incluye nombres con tildes y binarios)", () => {
  const entries = [{ path: "index.html", data: new TextEncoder().encode("<h1>Año ñandú</h1>") }, { path: "assets/img/a.png", data: PNG }];
  const back = listZip(createZip(entries));
  assert.deepEqual(back.map((e) => e.path), ["index.html", "assets/img/a.png"]);
  assert.deepEqual([...back[1].data], [...PNG]);
  assert.equal(new TextDecoder().decode(back[0].data), "<h1>Año ñandú</h1>");
});

test("ZIP: detecta archivos corruptos", () => {
  const zip = createZip([{ path: "a.txt", data: new TextEncoder().encode("hola mundo") }]);
  zip[40] ^= 0xff;
  assert.throws(() => listZip(zip));
});

test("firma de archivos: acepta imágenes reales y rechaza SVG, scripts y ejecutables", () => {
  assert.equal(sniff(PNG)?.mime, "image/png");
  assert.equal(sniff(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), null);
  assert.equal(sniff(new TextEncoder().encode("MZ" + "x".repeat(100))), null);
});

test("rutas de recursos: solo archivos locales del dispositivo, biblioteca incluida o https", () => {
  assert.ok(isSafeAssetSrc("/local/ast_abcdefghij"));
  assert.ok(isSafeAssetSrc("https://ejemplo.com/a.png"));
  assert.ok(!isSafeAssetSrc("javascript:alert(1)"));
  assert.ok(!isSafeAssetSrc("/api/assets/ast_abcdefghij"));
  assert.ok(!isSafeAssetSrc("/local/../../etc/passwd"));
});

for (const t of TEMPLATES) {
  test(`paquete ZIP de «${t.name}»: completo, sin editor y con las páginas del proyecto`, async () => {
    const doc = t.build();
    const res = await buildPackage(doc, t.name, async (src) => (src.startsWith("/forja/") ? PNG : null));
    assert.ok(res.files.includes("index.html") && res.files.includes("assets/styles.css") && res.files.includes("assets/site.js"));
    assert.equal(res.files.filter((f) => f.endsWith(".html")).length, doc.pages.length);
    const html = new TextDecoder().decode(listZip(res.zip).find((e) => e.path === "index.html")!.data);
    assert.ok(!/contenteditable|data-nid|__studio/.test(html));
    assert.match(res.filename, /\.zip$/);
  });
}

test("WhatsApp: el mensaje lleva nombre, teléfono y datos del proyecto; el enlace solo existe con un número válido", () => {
  const msg = buildMessage({ requestId: "ICA-ABC123", customerName: "Ana Pérez", customerPhone: "+573001112233", projectName: "Mi Agencia", siteName: "Pulso", pageType: "Agencia", pageCount: 2, features: ["Formulario", "Galería"], filename: "pulso.zip", note: "Llámame por la tarde" });
  for (const part of ["Ana Pérez", "+573001112233", "Mi Agencia", "Pulso", "ICA-ABC123", "pulso.zip", "Formulario; Galería", "Llámame por la tarde"]) assert.ok(msg.includes(part), part);
  const url = waUrl("573001112233", msg)!;
  assert.ok(url.startsWith("https://wa.me/573001112233?text="));
  assert.equal(decodeURIComponent(url.split("text=")[1]), msg);
  assert.equal(waUrl("", msg), null);
  assert.equal(waUrl("12ab", msg), null);
});

test("teléfono: acepta +, espacios y guiones; rechaza textos o números cortos", () => {
  assert.equal(cleanPhone("+57 300-111 2233"), "+573001112233");
  assert.ok(isValidPhone("+57 300 111 2233"));
  assert.ok(!isValidPhone("123"));
  assert.ok(!isValidPhone("hola"));
});
