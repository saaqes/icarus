import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { start, type Running } from "../server/index";
import { listZip } from "../server/zip";
import { TEMPLATES } from "../shared/templates";

let srv: Running;
let base = "";
const usePg = !!process.env.TEST_DATABASE_URL;

before(async () => {
  srv = await start({
    port: 0, host: "127.0.0.1", sqlitePath: ":memory:", databaseUrl: process.env.TEST_DATABASE_URL || "", distDir: path.resolve("src"),
    adminEmails: ["admin@icarus.test"], whatsappNumber: "573001112233", exportTtlDays: 7,
  }, { quiet: true });
  if (usePg) for (const t of ["request_events", "requests", "exports", "blobs", "assets", "project_versions", "project_pages", "projects", "folders", "sessions", "users"]) await srv.db.run(`DELETE FROM ${t}`);
  const a = srv.server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
after(async () => { await srv.close(); });

class Client {
  cookie = "";
  async call(method: string, url: string, body?: unknown, extra: Record<string, string> = {}, raw?: Buffer) {
    const headers: Record<string, string> = { ...extra };
    if (this.cookie) headers.cookie = this.cookie;
    let payload: any = raw;
    if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: "manual" });
    const sc = res.headers.get("set-cookie");
    if (sc) this.cookie = sc.split(";")[0].startsWith("icarus_sid=") && sc.includes("Max-Age=0") ? "" : sc.split(";")[0];
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data: data as any, headers: res.headers };
  }
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);

test("API: registro, sesión, permisos y aislamiento entre usuarios", async () => {
  const u1 = new Client(), u2 = new Client(), anon = new Client();
  assert.equal((await anon.call("GET", "/api/projects")).status, 401);
  assert.equal((await u1.call("POST", "/api/auth/register", { name: "Ana", email: "ana@x.co", password: "corta" })).status, 400);
  const reg = await u1.call("POST", "/api/auth/register", { name: "Ana", email: "ana@x.co", password: "clave-segura-1" });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.role, "user");
  assert.equal((await u1.call("POST", "/api/auth/register", { name: "Ana", email: "ana@x.co", password: "clave-segura-1" })).status, 409);
  assert.equal((await u1.call("GET", "/api/auth/me")).data.user.email, "ana@x.co");
  assert.equal((await new Client().call("POST", "/api/auth/login", { email: "ana@x.co", password: "mala" })).status, 401);

  const p = await u1.call("POST", "/api/projects", { name: "Mi proyecto", siteName: "Mi sitio", templateId: "minimalista" });
  assert.equal(p.status, 201);
  const id = p.data.project.id;
  assert.equal(p.data.project.pageCount, 2);
  assert.match(p.data.project.thumb, /^<svg/);

  await u2.call("POST", "/api/auth/register", { name: "Beto", email: "beto@x.co", password: "clave-segura-2" });
  assert.equal((await u2.call("GET", `/api/projects/${id}`)).status, 404);
  assert.equal((await u2.call("DELETE", `/api/projects/${id}`)).status, 404);
  assert.equal((await u2.call("PATCH", `/api/projects/${id}`, { name: "robado" })).status, 404);
  assert.equal((await u2.call("GET", "/api/projects")).data.projects.length, 0);
  assert.equal((await u2.call("GET", "/api/admin/requests")).status, 403);
  assert.equal((await u2.call("POST", `/api/projects/${id}/export`)).status, 404);
  // CSRF: origen distinto
  const evil = await u1.call("POST", "/api/folders", { name: "x" }, { origin: "https://evil.example" });
  assert.equal(evil.status, 403);
  await u1.call("POST", "/api/auth/logout", {});
  assert.equal((await u1.call("GET", "/api/projects")).status, 401);
});

test("API: guardado con control de revisiones, versiones, duplicado y carpetas", async () => {
  const c = new Client();
  await c.call("POST", "/api/auth/register", { name: "Carla", email: "carla@x.co", password: "clave-segura-3" });
  const created = await c.call("POST", "/api/projects", { name: "P1", templateId: "tecnologica" });
  const id = created.data.project.id;
  const full = (await c.call("GET", `/api/projects/${id}`)).data.project;
  assert.equal(full.rev, 1);
  const doc = full.doc;
  // el documento recuperado es idéntico al creado (ida y vuelta por las tablas de páginas)
  assert.equal(Object.keys(doc.nodes).length, Object.keys(TEMPLATES.find((t) => t.id === "tecnologica")!.build().nodes).length);

  const rootId = doc.pages[0].rootId;
  const firstChild = doc.nodes[rootId].children[0];
  doc.nodes[firstChild].name = "Renombrado";
  const s1 = await c.call("PUT", `/api/projects/${id}`, { doc, baseRev: 1, snapshot: true });
  assert.equal(s1.status, 200);
  assert.equal(s1.data.project.rev, 2);
  assert.equal(s1.data.project.status, "editing");
  // guardar con una revisión vieja → conflicto, sin sobrescribir
  const stale = await c.call("PUT", `/api/projects/${id}`, { doc, baseRev: 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.rev, 2);
  const again = (await c.call("GET", `/api/projects/${id}`)).data.project;
  assert.equal(again.doc.nodes[firstChild].name, "Renombrado");
  // documento inválido
  assert.equal((await c.call("PUT", `/api/projects/${id}`, { doc: { v: 1, pages: [], nodes: {} }, baseRev: 2 })).status, 422);
  const versions = (await c.call("GET", `/api/projects/${id}/versions`)).data.versions;
  assert.ok(versions.length >= 2);
  const old = await c.call("GET", `/api/projects/${id}/versions/1`);
  assert.notEqual(old.data.doc.nodes[firstChild].name, "Renombrado");

  // carpetas y organización
  const f1 = (await c.call("POST", "/api/folders", { name: "Clientes" })).data.folder;
  const f2 = (await c.call("POST", "/api/folders", { name: "Cliente 01", parentId: f1.id })).data.folder;
  assert.equal((await c.call("PATCH", `/api/folders/${f1.id}`, { parentId: f2.id })).status, 400); // ciclo
  assert.equal((await c.call("PATCH", `/api/projects/${id}`, { folderId: f2.id })).data.project.folderId, f2.id);
  const dup = (await c.call("POST", `/api/projects/${id}/duplicate`, {})).data.project;
  assert.equal(dup.name, "P1 copia");
  assert.equal(dup.folderId, f2.id);
  assert.equal((await c.call("GET", `/api/projects?folder=${f2.id}`)).data.projects.length, 2);
  assert.equal((await c.call("GET", "/api/projects?q=copia")).data.projects.length, 1);
  await c.call("PATCH", `/api/projects/${dup.id}`, { archived: true });
  assert.equal((await c.call("GET", "/api/projects")).data.projects.length, 1);
  assert.equal((await c.call("GET", "/api/projects?archived=1")).data.projects.length, 1);
  // borrar carpeta: los proyectos suben, no se pierden
  assert.equal((await c.call("DELETE", `/api/folders/${f2.id}`)).status, 200);
  assert.equal((await c.call("GET", `/api/projects/${id}`)).data.project.folderId, f1.id);
  assert.equal((await c.call("DELETE", `/api/projects/${dup.id}`)).status, 200);
});

test("API: recursos subidos validan firma real, tamaño y se sirven con cabeceras seguras", async () => {
  const c = new Client();
  await c.call("POST", "/api/auth/register", { name: "Dani", email: "dani@x.co", password: "clave-segura-4" });
  const hdr = { "x-requested-with": "icarus", "x-filename": encodeURIComponent("foto.png"), "content-type": "application/octet-stream" };
  const svg = await c.call("POST", "/api/assets", undefined, hdr, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"));
  assert.equal(svg.status, 415);
  const exe = await c.call("POST", "/api/assets", undefined, hdr, Buffer.from("MZ" + "x".repeat(100)));
  assert.equal(exe.status, 415);
  assert.equal((await c.call("POST", "/api/assets", undefined, { "content-type": "application/octet-stream" }, PNG)).status, 400);
  const up = await c.call("POST", "/api/assets", undefined, hdr, PNG);
  assert.equal(up.status, 201);
  assert.equal(up.data.asset.mime, "image/png");
  const got = await new Client().call("GET", up.data.asset.url);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get("x-content-type-options"), "nosniff");
  assert.match(got.headers.get("content-security-policy") || "", /sandbox/);
  assert.equal(got.data.length, PNG.length);
  assert.equal((await c.call("GET", "/api/assets")).data.assets.length, 1);
  assert.equal((await new Client().call("DELETE", up.data.asset.url)).status, 401);
});

test("API: exportar → ZIP real descargable, caducidad y revocación", async () => {
  const c = new Client();
  await c.call("POST", "/api/auth/register", { name: "Eli", email: "eli@x.co", password: "clave-segura-5" });
  const hdr = { "x-requested-with": "icarus", "x-filename": "logo.png", "content-type": "application/octet-stream" };
  const asset = (await c.call("POST", "/api/assets", undefined, hdr, PNG)).data.asset;
  const id = (await c.call("POST", "/api/projects", { name: "Ex", templateId: "corporativa" })).data.project.id;
  const proj = (await c.call("GET", `/api/projects/${id}`)).data.project;
  // añade una imagen subida a la primera sección
  const rootId = proj.doc.pages[0].rootId;
  const secId = proj.doc.nodes[rootId].children[1];
  const imgId = "n_subida01";
  proj.doc.nodes[imgId] = { id: imgId, type: "image", name: "Subida", parent: secId, children: [], props: { src: asset.url, alt: "Logo" }, s: { base: { w: 100, h: 100 } } };
  proj.doc.nodes[secId].children.push(imgId);
  assert.equal((await c.call("PUT", `/api/projects/${id}`, { doc: proj.doc, baseRev: 1 })).status, 200);

  const ex = await c.call("POST", `/api/projects/${id}/export`);
  assert.equal(ex.status, 200);
  const url = new URL(ex.data.export.downloadUrl);
  const dl = await new Client().call("GET", url.pathname);
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get("content-type") || "", /zip/);
  const files = listZip(dl.data);
  const names = files.map((f) => f.path);
  for (const n of ["index.html", "servicios.html", "contacto.html", "assets/styles.css", "assets/site.js", "README.md", "robots.txt"]) assert.ok(names.includes(n), `falta ${n}`);
  assert.ok(names.some((n) => n.startsWith("assets/img/") && n.endsWith(".png")), "incluye la imagen subida");
  assert.ok(names.some((n) => n.endsWith(".svg")), "incluye ilustraciones de la biblioteca");
  const html = files.find((f) => f.path === "index.html")!.data.toString();
  assert.ok(!/api\/assets/.test(html), "sin rutas del servidor");
  assert.ok(!/forja\/studio|contenteditable|data-nid/.test(html), "sin restos del editor");
  assert.match(html, /<title>.*Andina/);
  assert.ok(files.find((f) => f.path === "assets/styles.css")!.data.toString().includes("@media"));

  // la solicitud: registra, devuelve WhatsApp real y bloquea revisiones obsoletas
  const cur = (await c.call("GET", `/api/projects/${id}`)).data.project;
  assert.equal((await c.call("POST", `/api/projects/${id}/request`, { rev: cur.rev - 1 })).status, 409);
  const rq = await c.call("POST", `/api/projects/${id}/request`, { rev: cur.rev, note: "Para el lunes" });
  assert.equal(rq.status, 201);
  assert.match(rq.data.request.id, /^ICR-[A-Z0-9]{6}$/);
  assert.equal(rq.data.whatsapp.configured, true);
  const wa = new URL(rq.data.whatsapp.url);
  assert.equal(wa.hostname, "wa.me");
  assert.equal(wa.pathname, "/573001112233");
  const text = wa.searchParams.get("text")!;
  assert.ok(text.includes(rq.data.request.id) && text.includes("Ex") && text.includes("/api/downloads/"));
  assert.equal(rq.data.notify.attempted, false);
  assert.equal((await new Client().call("GET", new URL(rq.data.export.downloadUrl).pathname)).status, 200);

  // administración
  const admin = new Client();
  await admin.call("POST", "/api/auth/register", { name: "Admin", email: "admin@icarus.test", password: "clave-segura-6" });
  assert.equal((await admin.call("GET", "/api/auth/me")).data.user.role, "admin");
  const list = await admin.call("GET", "/api/admin/requests");
  assert.equal(list.data.requests.length, 1);
  assert.equal(list.data.counts.pending, 1);
  const detail = await admin.call("GET", `/api/admin/requests/${rq.data.request.id}`);
  assert.equal(detail.data.events.length, 1);
  assert.ok(detail.data.doc && detail.data.export.filename.endsWith(".zip"));
  assert.equal((await c.call("GET", `/api/admin/requests/${rq.data.request.id}`)).status, 403);
  const upd = await admin.call("PATCH", `/api/admin/requests/${rq.data.request.id}`, { status: "review", note: "Revisando" });
  assert.equal(upd.data.request.status, "review");
  assert.equal((await admin.call("PATCH", `/api/admin/requests/${rq.data.request.id}`, { status: "hack" })).status, 400);
  assert.equal((await admin.call("GET", `/api/admin/requests/${rq.data.request.id}`)).data.events.length, 2);
  assert.equal((await c.call("GET", "/api/requests")).data.requests[0].status, "review");

  // revocación y caducidad
  const link = (await admin.call("POST", `/api/admin/requests/${rq.data.request.id}/link`)).data;
  assert.equal((await new Client().call("GET", new URL(link.downloadUrl).pathname)).status, 200);
  await admin.call("POST", `/api/admin/requests/${rq.data.request.id}/revoke`);
  assert.equal((await new Client().call("GET", new URL(link.downloadUrl).pathname)).status, 404);
  const link2 = (await admin.call("POST", `/api/admin/requests/${rq.data.request.id}/link`)).data;
  await srv.db.run(`UPDATE exports SET expires_at = ?`, [new Date(Date.now() - 1000).toISOString()]);
  assert.equal((await new Client().call("GET", new URL(link2.downloadUrl).pathname)).status, 410);
  assert.equal((await new Client().call("GET", "/api/downloads/inventado")).status, 404);
  // al entregar, el proyecto pasa a «publicado»/entregado
  await admin.call("PATCH", `/api/admin/requests/${rq.data.request.id}`, { status: "delivered" });
  assert.equal((await c.call("GET", `/api/projects/${id}`)).data.project.status, "published");
});

test("servidor: sirve el sitio estático con cabeceras de seguridad y mantiene las redirecciones", async () => {
  const r = await fetch(base + "/forja/", { redirect: "manual" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-security-policy") || "", /script-src 'self'/);
  assert.equal(r.headers.get("x-frame-options"), "SAMEORIGIN");
  const red = await fetch(base + "/forja/demos/tienda", { redirect: "manual" });
  assert.equal(red.status, 301);
  assert.equal((await fetch(base + "/no-existe-123")).status, 404);
  assert.equal((await fetch(base + "/..%2f..%2fpackage.json")).status, 404);
  assert.equal((await fetch(base + "/healthz")).status, 200);
});
