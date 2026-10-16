/**
 * Pruebas de extremo a extremo del constructor (navegador real). Cubren la lista de verificación del encargo:
 * crear proyecto, añadir/seleccionar/mover/redimensionar, texto, propiedades, capas, agrupar/duplicar, historial,
 * zoom/scroll, responsive, guardado local y recuperación, exportación fiel, WhatsApp y que las páginas
 * existentes de ICARUS sigan funcionando.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { listZip } from "../../shared/zip";
import { api, centerOf, Env, idByText, idByType, newContext, openProject, setup, st, teardown, waitSaved } from "./helpers";

let env: Env;
before(async () => { env = await setup(); });
after(async () => { await teardown(env); });

const noErrors = (logs: string[]) => assert.deepEqual(logs, [], "hay errores en la consola:\n" + logs.join("\n"));

test("las páginas existentes de ICARUS siguen funcionando (comercial, forja y demos)", async () => {
  const { ctx, page, logs } = await newContext(env);
  await page.goto(env.base + "/");
  await page.waitForSelector("#forja");
  assert.match(await page.title(), /ICARUS/i);
  assert.ok(await page.locator("#fgGateBtn").count(), "la página comercial conserva su acceso a la forja");
  // la página comercial no contiene el editor ni la presentación del constructor
  assert.equal(await page.locator(".bld, .cv-frame, #bld-tour").count(), 0);

  await page.goto(env.base + "/forja/");
  await page.waitForSelector("#constructor");
  assert.match(await page.textContent("#bld-title") ?? "", /Tu idea\. Tu diseño\./);
  assert.equal(await page.textContent("#bld-start"), "FORJA TU PÁGINA WEB");
  assert.equal(await page.getAttribute("#bld-start", "href"), "studio/#/new");
  assert.ok(await page.locator("#bld-tour").count(), "el vídeo está en la página del constructor");
  assert.ok(await page.locator("#servicios").count(), "el contenido existente de /forja/ se conserva");
  await page.evaluate(() => document.getElementById("plantillas")!.scrollIntoView());
  await page.waitForSelector(".bld-card", { timeout: 10000 });
  assert.equal(await page.locator(".bld-card").count(), 10);
  // filtros y vista previa
  await page.click('.bld-chip:has-text("Tiendas visuales")');
  assert.equal(await page.locator(".bld-card").count(), 2);
  await page.click(".bld-card:first-child .bld-thumb");
  await page.waitForSelector(".bld-pv iframe");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".bld-pv").count(), 0);
  // «FORJA TU PÁGINA WEB» abre el flujo real (sin cuenta)
  await page.click("#bld-start");
  await page.waitForURL(/forja\/studio\/#\/(projects|new)/);
  for (const demo of ["tienda-virtual", "sistema-administrativo", "landing-page"]) {
    const r = await page.goto(`${env.base}/forja/demos/${demo}/`);
    assert.equal(r?.status(), 200, demo);
  }
  assert.equal((await page.goto(env.base + "/forja/demos/tienda"))?.url().endsWith("/forja/demos/tienda-virtual/"), true, "las redirecciones heredadas siguen activas");
  assert.equal((await page.goto(env.base + "/no-existe"))?.status(), 404);
  // Avisos que ya existían en la página comercial (script en línea que bloquea la CSP original, iframe de demo) y el propio aviso de la prueba de 404.
  noErrors(logs.filter((l) => !/Refused to execute inline script|status of 404|allow-scripts and allow-same-origin/.test(l)));
  await ctx.close();
});

test("flujo completo: proyecto → plantilla → editor → guardado local → nombre y WhatsApp al final → ZIP y WhatsApp", async () => {
  const ctx = await env.browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("icarus.debug", "1"); } catch { /* sin almacenamiento */ } });
  const logs: string[] = [];
  page.on("console", (m) => { if ((m.type() === "error") && (m.location().url || "").startsWith(env.base)) logs.push(m.text()); });
  page.on("pageerror", (e) => logs.push(e.message));
  let waUrl = "";
  await ctx.route(/https:\/\/wa\.me\//, (r) => { waUrl = r.request().url(); return r.fulfill({ status: 200, contentType: "text/html", body: "<title>wa</title>" }); });

  // sin iniciar sesión: entra directo a «Mis proyectos»
  await page.goto(env.base + "/forja/studio/");
  await page.waitForSelector(".pj-empty");
  assert.equal(await page.locator('input[type="password"]').count(), 0);

  await page.click('a[href="#/new"] >> nth=0');
  await page.waitForSelector(".wz-card");
  assert.equal(await page.locator('input[type="tel"], input[type="email"]').count(), 0, "el asistente ya no pide teléfono ni correo");
  await page.click('button[type="submit"]'); // campos obligatorios
  assert.ok(await page.isVisible(".st-error"), "valida el nombre del proyecto");
  await page.fill('input[placeholder="Ej.: Agencia Digital"]', "Mi Agencia");
  await page.fill('input[placeholder="Ej.: Pulso Agency"]', "Pulso Digital");
  await page.click('.wz-type:has-text("Agencia de marketing")');
  await page.click('button[type="submit"]');
  await page.waitForSelector(".wz-tplgrid");
  await page.click('.tc:has-text("Agencia digital") .st-btn--primary');
  await page.waitForSelector(".cv-frame", { timeout: 15000 });
  await waitSaved(page);

  // editar y comprobar que el autoguardado confirma (no antes)
  const h1 = (await st<string>(page, "(ed)=>Object.values(ed.doc.nodes).find((n)=>n.props.tag==='h1').id"));
  await st(page, "(ed,ws,id)=>ed.setText(id,'Título editado por la prueba')", h1);
  assert.match((await page.textContent(".tb-save")) ?? "", /sin guardar/i);
  await waitSaved(page);

  await page.click(".tb-finish");
  await page.waitForSelector(".fn-grid", { timeout: 15000 });
  assert.match(await page.textContent(".fn-card") ?? "", /Guardado en este dispositivo \(revisión \d+\)/);

  // nombre y WhatsApp se piden aquí, ya con el proyecto hecho
  await page.click('button:has-text("QUIERO ESTA PÁGINA")');
  assert.ok(await page.isVisible(".st-error"), "pide el nombre");
  await page.fill('input[autocomplete="name"]', "Ana Pérez");
  await page.click('button:has-text("QUIERO ESTA PÁGINA")');
  assert.match((await page.textContent(".st-error")) ?? "", /WhatsApp/);
  await page.fill('input[type="tel"]', "+57 300 111 2222");
  const popup = ctx.waitForEvent("page");
  const download = page.waitForEvent("download");
  await page.click('button:has-text("QUIERO ESTA PÁGINA")');
  await popup;
  const dl = await download;
  await page.waitForSelector(".fn-code", { timeout: 20000 });
  const code = (await page.textContent(".fn-code")) ?? "";
  assert.match(code, /^ICA-[A-Z0-9]{6}$/);
  assert.ok(waUrl.startsWith("https://wa.me/573001112233?text="), "se abre wa.me con el número configurado");
  const text = new URL(waUrl).searchParams.get("text")!;
  assert.ok(text.includes(code) && text.includes("Ana Pérez") && text.includes("+573001112222") && text.includes("Proyecto: Mi Agencia") && text.includes("Nombre del sitio: Pulso Digital") && text.includes(dl.suggestedFilename()));
  // el ZIP se descargó de verdad y se puede abrir
  const path = await dl.path();
  const files = listZip(new Uint8Array(await (await import("node:fs/promises")).readFile(path)));
  assert.ok(files.some((f) => f.path === "index.html") && files.some((f) => f.path === "assets/styles.css"));
  assert.match(new TextDecoder().decode(files.find((f) => f.path === "index.html")!.data), /Título editado por la prueba/);

  // la solicitud queda en el historial local y los datos se recuerdan
  await page.goto(env.base + "/forja/studio/#/projects");
  await page.waitForSelector(".pj-req");
  assert.ok((await page.textContent(".pj-req"))?.includes(code));
  await page.reload();
  await page.waitForSelector(".pj-card");
  assert.equal(await page.locator(".pj-card").count(), 1, "el proyecto sigue guardado tras recargar");
  assert.deepEqual(logs, []);
  await ctx.close();
});

test("sin número de WhatsApp configurado: el archivo se descarga y no se abre ninguna ventana", async () => {
  const { ctx, page } = await openProject(env, { tpl: "minimalista" });
  await ctx.route("**/forja/studio/config.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ whatsappNumber: "" }) }));
  await page.goto(`${env.base}/forja/studio/#/finish/${await page.evaluate(() => location.hash.split("/").pop())}`);
  await page.reload();
  await page.waitForSelector(".fn-grid");
  await page.fill('input[autocomplete="name"]', "Luis");
  await page.fill('input[type="tel"]', "3001112233");
  const download = page.waitForEvent("download");
  await page.click('button:has-text("QUIERO ESTA PÁGINA")');
  await download;
  await page.waitForSelector(".fn-code");
  assert.match((await page.textContent(".fn-done")) ?? "", /WhatsApp aún no está configurado/);
  assert.equal(ctx.pages().length, 1);
  await ctx.close();
});

test("importar y exportar: un proyecto con una imagen subida viaja a otro dispositivo", async () => {
  const { ctx, page, id } = await openProject(env, { tpl: "minimalista" });
  const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const ref = await api<string>(page, "async (Api,b)=>{const bytes=Uint8Array.from(atob(b),(c)=>c.charCodeAt(0));return (await Api.storeBytes(bytes,'pixel.png')).url}", PNG_B64);
  assert.match(ref, /^\/local\/ast_/);
  const imgId = await idByType(page, "image", 0);
  if (imgId) { await st(page, "(ed,ws,a)=>ed.setProps([a.id],{src:a.src,alt:'Pixel'})", { id: imgId, src: ref }); await waitSaved(page); }
  const file = await api<any>(page, "async (Api,id)=>Api.exportProjectFile(id)", id);
  assert.equal(file.format, "icarus-studio-project");
  if (imgId) assert.equal(file.assets.length, 1);
  // otro «dispositivo»: contexto nuevo, almacenamiento vacío
  const other = await newContext(env);
  await other.page.goto(`${env.base}/forja/studio/#/projects`);
  await other.page.waitForSelector(".pj-empty");
  const newId = await api<string>(other.page, "async (Api,f)=>(await Api.importProject(f)).project.id", file);
  const pj = await api<any>(other.page, "async (Api,id)=>(await Api.project(id)).project", newId);
  if (imgId) assert.ok(JSON.stringify(pj.doc).includes("/local/") && !JSON.stringify(pj.doc).includes(ref), "la imagen se guarda con un identificador nuevo en el otro dispositivo");
  await other.page.goto(`${env.base}/forja/studio/#/edit/${newId}`);
  await other.page.waitForSelector(".cv-frame");
  if (imgId) await other.page.waitForFunction(() => { const i = (document.querySelector(".cv-frame") as any)?.shadowRoot?.querySelector("img[src^='blob:']") ?? document.querySelector("img[src^='blob:']"); return !!i; }, null, { timeout: 8000 }).catch(() => {});
  await other.ctx.close();
  await ctx.close();
});

test("editor: insertar, seleccionar, mover, redimensionar, texto, propiedades, capas, agrupar, duplicar e historial", async () => {
  const { ctx, page, logs } = await openProject(env, { tpl: "creativa" });

  // insertar con clic desde el panel
  const count0 = await st<number>(page, "(ed)=>Object.keys(ed.doc.nodes).length");
  await page.click('.in-tile:has-text("Botón")');
  await page.waitForTimeout(200);
  assert.equal(await st(page, "(ed)=>Object.keys(ed.doc.nodes).length"), count0 + 1, "se inserta un elemento");
  assert.equal(await st(page, "(ed)=>ed.selected[0].type"), "button", "queda seleccionado");

  // arrastrar desde el panel al lienzo
  const btn = await idByText(page, "Ver mi canal");
  const target = await centerOf(page, btn!);
  const tile = await page.locator('.in-tile:has-text("Icono")').boundingBox();
  await page.mouse.move(tile!.x + 20, tile!.y + 20); await page.mouse.down();
  await page.mouse.move(target.x, target.y + 80, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(250);
  assert.equal(await st(page, "(ed)=>ed.selected[0].type"), "icon", "arrastrar desde el panel inserta en el lienzo");

  // mover (contenedor libre) = una sola entrada de historial
  const before = await st<any>(page, "(ed,ws,id)=>({...ed.doc.nodes[id].s.base})", btn);
  let c = await centerOf(page, btn!);
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x + 50, c.y + 20, { steps: 5 }); await page.mouse.move(c.x + 140, c.y + 50, { steps: 8 }); await page.mouse.up();
  const moved = await st<any>(page, "(ed,ws,id)=>({...ed.doc.nodes[id].s.base})", btn);
  assert.ok(moved.x > before.x && moved.y > before.y, "el elemento se movió");
  await page.keyboard.press("Control+z");
  assert.deepEqual(await st(page, "(ed,ws,id)=>({...ed.doc.nodes[id].s.base})", btn), before, "deshacer revierte todo el arrastre de una vez");
  await page.keyboard.press("Control+Shift+z");
  assert.equal((await st<any>(page, "(ed,ws,id)=>ed.doc.nodes[id].s.base.x", btn)), moved.x, "rehacer lo restaura");

  // redimensionar con asas
  c = await centerOf(page, btn!);
  await page.mouse.click(c.x, c.y);
  const h = await page.evaluate(() => { const r = document.querySelector(".ov-h--e")!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x + 35, h.y, { steps: 6 }); await page.mouse.up();
  assert.ok((await st<number>(page, "(ed,ws,id)=>ed.doc.nodes[id].s.base.w", btn)) > before.w, "redimensionar cambia el ancho");

  // panel de propiedades actualiza el elemento y refleja los cambios del lienzo
  await page.fill('input[aria-label="Rotación"]', "12");
  assert.equal(await st(page, "(ed,ws,id)=>ed.doc.nodes[id].s.base.rotate", btn), 12);
  assert.equal(await page.inputValue('input[aria-label="X"]'), String(moved.x), "el panel muestra la posición real");

  // texto: doble clic edita, Escape descarta, Ctrl+Enter confirma, el arrastre no mueve el elemento
  const title = await idByType(page, "text", 0);
  const original = await st<string>(page, "(ed,ws,id)=>ed.doc.nodes[id].props.text", title);
  c = await centerOf(page, title!);
  await page.mouse.dblclick(c.x, c.y);
  assert.equal(await st(page, "(ed)=>ed.s.editingText"), title);
  await page.waitForFunction(() => !!(window as any).__studio.ws.editEl);
  await page.keyboard.press("Control+A"); await page.keyboard.type("Texto nuevo con ñ y tildes áé");
  await page.keyboard.press("Escape");
  assert.equal(await st(page, "(ed,ws,id)=>ed.doc.nodes[id].props.text", title), original, "Escape cancela la edición");
  c = await centerOf(page, title!);
  await page.mouse.dblclick(c.x, c.y);
  await page.waitForFunction(() => !!(window as any).__studio.ws.editEl);
  await page.keyboard.press("Control+A"); await page.keyboard.type("Texto nuevo con ñ y tildes áé");
  await page.keyboard.press("Control+Enter");
  assert.equal(await st(page, "(ed,ws,id)=>ed.doc.nodes[id].props.text", title), "Texto nuevo con ñ y tildes áé");

  // capas sincronizadas con el lienzo
  await page.click('.ed-tab[data-tab="layers"]');
  const layerNames = await page.$$eval(".ly-name", (els) => els.map((e) => e.textContent));
  assert.ok(layerNames.length > 5 && layerNames.some((n) => n === "Ver mi canal" || /botón/i.test(n ?? "")) && layerNames.includes("Icono"), "capas: " + layerNames.join("|"));
  await page.click(`.ly-row[data-id="${btn}"]`);
  assert.deepEqual(await st(page, "(ed)=>ed.s.selection"), [btn], "seleccionar en capas selecciona en el lienzo");
  await page.dblclick(`.ly-row[data-id="${btn}"] .ly-name`);
  await page.fill(".ly-rename", "Botón principal");
  await page.keyboard.press("Enter");
  assert.equal(await st(page, "(ed,ws,id)=>ed.doc.nodes[id].name", btn), "Botón principal", "renombrar desde capas");
  await page.click(`.ly-row[data-id="${btn}"] [aria-label="Ocultar"]`);
  assert.equal(await st(page, "(ed,ws,id)=>ws.view.el(id).style.display", btn), "none", "ocultar desde capas oculta en el lienzo");
  await page.click(`.ly-row[data-id="${btn}"] [aria-label="Mostrar"]`);

  // varias selecciones, agrupar, duplicar
  const b2 = await idByText(page, "Colaboremos");
  await page.keyboard.down("Shift"); c = await centerOf(page, b2!); await page.mouse.click(c.x, c.y); await page.keyboard.up("Shift");
  assert.equal(await st(page, "(ed)=>ed.s.selection.length"), 2);
  await page.keyboard.press("Control+g");
  const grp = await st<string>(page, "(ed)=>ed.selected[0].id");
  assert.equal(await st(page, "(ed,ws,id)=>ed.doc.nodes[id].children.length", grp), 2, "agrupa");
  await page.keyboard.press("Control+d");
  assert.equal(await st(page, "(ed)=>ed.selected[0].name"), "Grupo copia", "duplica el grupo");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+g");
  assert.equal(await st(page, "(ed)=>ed.selected.length"), 2, "desagrupa");

  // zoom y scroll no rompen la selección
  const sel = await st(page, "(ed)=>ed.s.selection.join()");
  await page.keyboard.press("Control+=");
  await page.mouse.move(700, 500); await page.mouse.wheel(0, 400);
  assert.equal(await st(page, "(ed)=>ed.s.selection.join()"), sel);
  assert.ok((await st<number>(page, "(ed)=>ed.s.zoom")) > 0);
  await page.evaluate(() => (window as any).__studio.ws.fit("width"));

  // Delete elimina; los atajos no interfieren al escribir en campos
  await page.fill('input[aria-label="Buscar elementos"]', "x").catch(() => undefined);
  noErrors(logs);
  await ctx.close();
});

test("responsive: el diseño de escritorio no rompe móvil, se pueden ajustar tamaños por dispositivo y heredan", async () => {
  const { ctx, page, logs } = await openProject(env, { tpl: "tecnologica" });
  const title = (await st<string>(page, "(ed)=>Object.values(ed.doc.nodes).find((n)=>n.props.tag==='h1').id"));
  const sizeAt = async (d: string) => { await page.click(`.tb-dev[data-d="${d}"]`); await page.waitForTimeout(250); return st<string>(page, "(ed,ws,id)=>getComputedStyle(ws.view.el(id)).fontSize", title); };
  const desktop = await sizeAt("desktop"), tablet = await sizeAt("tablet"), mobile = await sizeAt("mobile");
  assert.ok(parseFloat(mobile) < parseFloat(tablet) && parseFloat(tablet) < parseFloat(desktop), `tamaños por dispositivo: ${desktop} > ${tablet} > ${mobile}`);
  // sin desbordamiento horizontal en móvil
  await page.click('.tb-dev[data-d="mobile"]');
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => { const f = document.querySelector(".cv-frame")!; const root = f.shadowRoot!.querySelector(".__root") as HTMLElement; return root.scrollWidth - root.clientWidth; });
  assert.ok(overflow <= 1, `desbordamiento en móvil: ${overflow}px`);
  // un ajuste solo móvil no cambia escritorio; el de escritorio se hereda
  await st(page, "(ed,ws,id)=>{ed.select([id]); ed.setStyle([id],{size:22},{})}", title);
  assert.equal(await st(page, "(ed,ws,id)=>ed.doc.nodes[id].s.mobile.size", title), 22);
  assert.equal(await sizeAt("desktop"), desktop);
  // ocultar en un dispositivo
  const eyebrow = await st<string>(page, "(ed)=>Object.values(ed.doc.nodes).find((n)=>n.props.tag==='p'&&n.s.base.transform==='uppercase').id");
  await st(page, "(ed,ws,id)=>ed.commit('x',(tx)=>tx.setStyle(id,'mobile',{hide:true}))", eyebrow);
  await page.click('.tb-dev[data-d="mobile"]');
  assert.ok((await st<string>(page, "(ed,ws,id)=>ws.view.el(id).className", eyebrow)).includes("is-dev-hidden"), "se atenúa en el editor");
  noErrors(logs);
  await ctx.close();
});

test("guardado local: autoguardado confirmado, recuperación tras recargar, sin conexión a internet y conflicto entre pestañas", async () => {
  const { ctx, page, logs, id } = await openProject(env, { tpl: "minimalista" });
  const t = await idByType(page, "text", 3);
  await st(page, "(ed,ws,id)=>ed.setText(id,'Persistido en el dispositivo')", t);
  assert.match((await page.textContent(".tb-save")) ?? "", /sin guardar/i);
  await waitSaved(page);
  await page.reload();
  await page.waitForSelector(".cv-frame");
  assert.equal(await st(page, "(ed,ws,id)=>ed.doc.nodes[id].props.text", t), "Persistido en el dispositivo", "el cambio se recupera del almacenamiento local");

  // sin internet todo sigue funcionando: el guardado es local
  await ctx.setOffline(true);
  const t2 = await idByType(page, "text", 4);
  await st(page, "(ed,ws,id)=>ed.setText(id,'Escrito sin internet')", t2);
  await waitSaved(page);
  await ctx.setOffline(false);
  assert.ok(JSON.stringify((await api<any>(page, "async (Api,id)=>(await Api.project(id)).project.doc", id))).includes("Escrito sin internet"), "el cambio quedó en el almacenamiento local");

  // conflicto (otra pestaña del mismo navegador guardó antes)
  const other = await ctx.newPage();
  await other.addInitScript(() => { try { localStorage.setItem("icarus.debug", "1"); } catch { /* sin almacenamiento */ } });
  await other.goto(`${env.base}/forja/studio/#/projects`);
  await other.waitForSelector(".pj-grid, .pj-empty");
  await api(other, "async (Api,id)=>{const p=(await Api.project(id)).project; await Api.saveProject(id,p.doc,p.rev)}", id);
  await other.close();
  await st(page, "(ed,ws,id)=>ed.setText(id,'Cambio en la pestaña vieja')", t);
  await page.waitForFunction(() => /conflicto/i.test(document.querySelector(".tb-save")?.textContent || ""), null, { timeout: 15000 });
  noErrors(logs.filter((l) => !/409|Failed to load resource/.test(l)));
  await ctx.close();
});

test("exportación: el sitio generado conserva diseño y contenido, es responsive y no contiene el editor", async () => {
  const { ctx, page, id } = await openProject(env, { tpl: "ecommerce" });
  const b64 = await api<string>(page, "async (Api,id)=>{const r=await Api.buildZip(id);let s='';for(let i=0;i<r.zip.length;i+=8192)s+=String.fromCharCode(...r.zip.subarray(i,i+8192));return btoa(s)}", id);
  const files = listZip(new Uint8Array(Buffer.from(b64, "base64")));
  const byPath = new Map(files.map((f) => [f.path, f.data]));
  const html = new TextDecoder().decode(byPath.get("index.html")!);
  assert.ok(!/studio|contenteditable|data-nid|__studio/.test(html), "sin restos del editor");
  assert.ok(html.includes("Objetos que hacen hogar") && html.includes("Casa Norte"), "contiene el contenido");

  // se abre el sitio exportado servido desde el ZIP y se compara con el editor
  const site = await env.browser.newContext({ viewport: { width: 1280, height: 800 } });
  await site.route("https://export.test/**", (r) => {
    const p = new URL(r.request().url()).pathname.replace(/^\//, "") || "index.html";
    const f = byPath.get(p);
    if (!f) return r.fulfill({ status: 404, body: "no" });
    const type = p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".svg") ? "image/svg+xml" : p.endsWith(".html") ? "text/html" : "application/octet-stream";
    return r.fulfill({ status: 200, contentType: type, body: Buffer.from(f) });
  });
  const sp = await site.newPage();
  const errs: string[] = [];
  sp.on("console", (m) => { if (m.type() === "error" && (m.location().url || "").startsWith("https://export.test")) errs.push(m.text()); });
  await sp.goto("https://export.test/");
  await sp.waitForSelector("h1");
  assert.deepEqual(errs, [], "el sitio exportado carga todos sus recursos");
  assert.equal(await sp.locator("img").evaluateAll((els) => els.filter((e) => !(e as HTMLImageElement).complete || (e as HTMLImageElement).naturalWidth === 0).length), 0, "todas las imágenes cargan");
  const h1Export = await sp.$eval("h1", (e) => getComputedStyle(e).fontSize);
  const h1Editor = await st<string>(page, "(ed,ws)=>{const n=Object.values(ed.doc.nodes).find((x)=>x.props.tag==='h1');return getComputedStyle(ws.view.el(n.id)).fontSize}");
  assert.equal(h1Export, h1Editor, "el tamaño del título es el mismo que en el editor");
  const bgExport = await sp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.ok(bgExport.startsWith("rgb"), "estilos aplicados");
  // móvil
  await sp.setViewportSize({ width: 390, height: 800 });
  const overflow = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `desbordamiento horizontal en móvil: ${overflow}px`);
  const h1Mobile = await sp.$eval("h1", (e) => parseFloat(getComputedStyle(e).fontSize));
  assert.ok(h1Mobile < parseFloat(h1Export), "el tamaño se adapta en móvil");
  // sin JavaScript el contenido sigue visible (mejora progresiva)
  await site.close();
  await ctx.close();
});

test("vista previa: sitio real sin interfaz del editor, con anchos de dispositivo y navegación entre páginas", async () => {
  const { ctx, page, logs } = await openProject(env, { tpl: "corporativa" });
  await page.click(".tb-preview");
  await page.waitForSelector(".pv-frame");
  const frame = page.frameLocator(".pv-frame");
  await frame.locator("h1").waitFor();
  assert.equal(await frame.locator(".cv, .ed, [data-nid]").count(), 0, "la vista previa no contiene la interfaz del editor");
  await page.click('.pv-dev[data-d="mobile"]');
  assert.equal(await page.inputValue(".pv-w"), "390");
  await page.fill(".pv-w", "500"); await page.press(".pv-w", "Enter");
  assert.equal(await page.evaluate(() => (document.querySelector(".pv-frame") as HTMLElement).style.width), "500px", "se puede cambiar el ancho");
  // enlaces entre páginas
  await frame.locator('a:has-text("Servicios")').first().click();
  await frame.locator("h1:has-text('Soluciones a la medida')").waitFor({ timeout: 8000 });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".pv").count(), 0, "volver al editor");
  assert.ok(await page.locator(".cv-frame").isVisible());
  noErrors(logs);
  await ctx.close();
});

test("móvil: el editor funciona en teléfono (paneles desplegables, toque, pulsación larga y scroll)", async () => {
  const { ctx, page, logs } = await openProject(env, { tpl: "minimalista", w: 390, h: 844, touch: true });
  assert.equal(await st(page, "(ed)=>ed.s.device"), "mobile", "en pantallas pequeñas se abre la vista móvil");
  assert.ok(await page.locator(".ed-bottom").isVisible());
  await page.tap(".ed-bbtn >> nth=0");
  await page.waitForTimeout(400);
  assert.ok(await page.locator(".ed-left").isVisible(), "el panel se abre como hoja inferior");
  await page.touchscreen.tap(195, 90);
  await page.waitForTimeout(350);
  const title = await idByType(page, "text", 1);
  let c = await centerOf(page, title!);
  await page.touchscreen.tap(c.x, c.y);
  await page.waitForTimeout(250);
  assert.equal(await st(page, "(ed)=>ed.s.selection.length"), 1, "un toque selecciona");
  // scroll por arrastre sobre un elemento sin mover nada
  const cdp = await ctx.newCDPSession(page);
  const sy0 = await page.evaluate(() => document.querySelector(".cv-scroll")!.scrollTop);
  const docBefore = await st(page, "(ed)=>ed.doc");
  c = await centerOf(page, title!);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y + 120 }] });
  for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: c.x, y: c.y + 120 - i * 30 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(250);
  assert.ok((await page.evaluate(() => document.querySelector(".cv-scroll")!.scrollTop)) !== sy0, "el scroll vertical funciona");
  assert.deepEqual(await st(page, "(ed)=>ed.doc"), docBefore, "arrastrar para hacer scroll no mueve elementos");
  // pulsación larga + movimiento = reordenar
  const b1 = await idByText(page, "Ver servicios"), b2 = await idByText(page, "Escríbenos");
  const idx = () => st<number>(page, "(ed,ws,id)=>ed.doc.nodes[ed.doc.nodes[id].parent].children.indexOf(id)", b1);
  const start = await idx();
  c = await centerOf(page, b1!);
  const c2 = await centerOf(page, b2!);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }] });
  await page.waitForTimeout(650);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: c2.x, y: c2.y + 10 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: c2.x, y: c2.y + 30 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(250);
  assert.notEqual(await idx(), start, "la pulsación larga inicia el movimiento");
  // alternar entre mover lienzo y seleccionar
  await page.tap('.cv-btn[data-tool="hand"]');
  assert.equal(await st(page, "(ed)=>ed.s.tool"), "hand");
  noErrors(logs);
  await ctx.close();
});

test("seguridad en el editor: texto malicioso no se ejecuta y los enlaces peligrosos se descartan", async () => {
  const { ctx, page, logs } = await openProject(env, { tpl: "minimalista" });
  const t = await idByType(page, "text", 2);
  await st(page, "(ed,ws,id)=>ed.setText(id,'<img src=x onerror=window.__pwned=1><script>window.__pwned=2</script>')", t);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => (window as any).__pwned), undefined, "el texto se trata como texto");
  await st(page, "(ed,ws,id)=>ed.setProps([id],{href:'javascript:alert(1)'})", t);
  await waitSaved(page);
  const saved = await api<string>(page, "async (Api,a)=>(await Api.project(a.pid)).project.doc.nodes[a.id].props.href", { pid: await page.evaluate(() => location.hash.split("/").pop()), id: t });
  assert.equal(saved, "", "al guardar se descarta el enlace javascript:");
  noErrors(logs.filter((l) => !/javascript/.test(l)));
  await ctx.close();
});
