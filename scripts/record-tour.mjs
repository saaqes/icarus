// Graba el vídeo de presentación de /forja/: una sesión REAL del editor (ICARUS Studio) manejada con Playwright.
// Genera src/forja/studio/assets/media/{tour.webm,tour.mp4,tour-poster.jpg,tour.vtt}
//
// Requisitos: `npm run build` previo, Chromium de Playwright y ffmpeg (para comprimir).
// Uso:  node scripts/record-tour.mjs
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src/forja/studio/assets/media");
const TMP = path.join(os.tmpdir(), `icarus-tour-${Date.now()}`);
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const chromePath = process.env.CHROMIUM_PATH || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const { startStatic } = await import(pathToFileURL(path.join(ROOT, "scripts/static-server.mjs")).href);
const running = await startStatic({ dist: path.join(ROOT, "dist"), port: 0, quiet: true, config: { whatsappNumber: "" } });
const base = running.base;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: chromePath, args: ["--no-sandbox", "--hide-scrollbars"] });
const ctx = await browser.newContext({
  viewport: { width: 1180, height: 664 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
// el proyecto se crea en el almacenamiento local del navegador (misma sesión que se graba) desde una pestaña auxiliar
const helper = await ctx.newPage();
await helper.addInitScript(() => { try { localStorage.setItem("icarus.debug", "1"); } catch { /* sin almacenamiento */ } });
await helper.goto(`${base}/forja/studio/#/projects`);
await helper.waitForFunction(() => !!window.__icarus);
const projectId = await helper.evaluate(async () => (await window.__icarus.Api.createProject({
  name: "Café Brasa", siteName: "Café Brasa", pageType: "Negocio o empresa", category: "Cafetería", description: "Café de especialidad en Medellín",
  contact: { language: "es" }, brand: { colors: ["#b3261e", "#d9472b"], style: "Tecnológico" },
})).project.id);
await helper.close();

const page = await ctx.newPage();
await page.addInitScript(() => {
  try { localStorage.setItem("icarus.debug", "1"); } catch { /* sin almacenamiento */ }
  const css = `
  #__cover{position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse at 50% 30%,#2a0b0b,#060607 70%);display:grid;place-content:center;justify-items:center;gap:26px;text-align:center;padding:40px;opacity:1;transition:opacity .9s ease}
  #__cover.off{opacity:0;pointer-events:none}
  #__cover h1{margin:0;color:#f3f1ec;font:800 46px/1.15 Cinzel,Georgia,serif;letter-spacing:.03em;max-width:900px;animation:__in 1s ease both}
  #__cover p{margin:0;color:#c8cad1;font:500 24px Manrope,system-ui,sans-serif;animation:__in 1s .3s ease both}
  #__cover .btn{display:inline-block;padding:18px 34px;border-radius:6px;border:1px solid #c2332a;background:linear-gradient(180deg,#b5281f,#7a1414);color:#fff;font:700 16px Cinzel,Georgia,serif;letter-spacing:.2em;box-shadow:0 14px 50px -8px rgba(217,71,43,.8);animation:__in 1s .7s ease both}
  #__cover img{height:120px;animation:__in 1s ease both}
  @keyframes __in{from{opacity:0;transform:translateY(14px)}}
  #__cap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:99998;padding:12px 24px;border-radius:999px;background:rgba(6,6,7,.86);border:1px solid rgba(200,202,209,.28);color:#fff;font:700 20px Manrope,system-ui,sans-serif;letter-spacing:.01em;opacity:0;transition:opacity .35s;pointer-events:none;box-shadow:0 14px 40px -10px #000;white-space:nowrap}
  #__cap.on{opacity:1}
  #__cur{position:fixed;z-index:100000;left:0;top:0;width:26px;height:26px;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))}
  .__rip{position:fixed;z-index:99999;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #ff6a5a;pointer-events:none;animation:__rip .55s ease-out forwards}
  @keyframes __rip{to{transform:scale(4.2);opacity:0}}`;
  const boot = () => {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const cover = document.createElement("div"); cover.id = "__cover"; document.body.appendChild(cover);
    const cap = document.createElement("div"); cap.id = "__cap"; document.body.appendChild(cap);
    const cur = document.createElement("div"); cur.id = "__cur";
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 9-6.5 1.6L9 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    document.addEventListener("mousemove", (e) => { cur.style.left = e.clientX + "px"; cur.style.top = e.clientY + "px"; }, true);
    document.addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.className = "__rip"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
    window.__cover = (html) => { cover.innerHTML = html; cover.classList.remove("off"); };
    window.__uncover = () => cover.classList.add("off");
    window.__cap = (t) => { cap.textContent = t || ""; cap.classList.toggle("on", !!t); };
    window.__cover('<h1>¿Y si pudieras crear tu propia página web?</h1>');
  };
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
});

const cues = [];
let t0 = 0;
const now = () => (Date.now() - t0) / 1000;
let cur = { x: 600, y: 330 };
// movimiento del cursor por tiempo real (no por pasos): la duración es la indicada aunque Playwright tarde en cada evento
const glide = async (x, y, ms = 450) => {
  const sx = cur.x, sy = cur.y, t = Date.now();
  for (;;) {
    const k = Math.min(1, (Date.now() - t) / ms);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
    if (k >= 1) break;
  }
  cur = { x, y };
};
const click = async () => { await page.mouse.down(); await sleep(60); await page.mouse.up(); };
let capStart = null;
const caption = async (text) => {
  if (capStart) cues.push({ ...capStart, end: now() });
  capStart = text ? { start: now(), text } : null;
  await page.evaluate((t) => window.__cap(t), text || "");
};
const st = (fn, arg) => page.evaluate(new Function("a", "const {ed,ws}=window.__studio; return (" + fn + ")(ed,ws,a)"), arg);
const nodeBy = (cond, arg) => st(`(ed,ws,a)=>{const n=Object.values(ed.doc.nodes).find(${cond});return n?n.id:null}`, arg);
const center = (id) => st(`(ed,ws,id)=>{const el=ws.view.el(id);el.scrollIntoView({block:"center",inline:"center"});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,l:r.left,t:r.top,w:r.width,h:r.height}}`, id);
const clickEl = async (loc, ms = 420) => { await loc.evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "nearest" })); const b = await loc.boundingBox(); await glide(b.x + b.width / 2, b.y + b.height / 2, ms); await click(); };

await page.goto(`${base}/forja/studio/#/new/${projectId}`);
t0 = Date.now();
await page.waitForSelector(".wz-tplgrid");
await page.evaluate(() => window.scrollTo(0, 250));          // las tarjetas quedan completas dentro de la ventana
await sleep(2300);                                  // 1. «¿Y si pudieras crear tu propia página web?»
await page.evaluate(() => window.__uncover());
await page.evaluate(() => { document.body.style.transition = "transform 6s ease-out"; document.body.style.transformOrigin = "50% 40%"; document.body.style.transform = "scale(1.04)"; });
await sleep(600);

/* 2. plantillas */
await caption("Elige una plantilla");
await glide(430, 330, 350);
const mini = await page.locator('.tc:has-text("Minimalista")').boundingBox();
await glide(mini.x + mini.width / 2, mini.y + 90, 300); await sleep(200);
const tech = await page.locator('.tc:has-text("Tecnológica")').boundingBox();
await glide(tech.x + tech.width / 2, tech.y + 90, 450); await sleep(300);
await clickEl(page.locator('.tc:has-text("Tecnológica") .st-btn--primary'), 400);
await page.waitForSelector(".cv-frame", { timeout: 20000 });
await page.evaluate(() => { document.body.style.transition = "none"; document.body.style.transform = "none"; });
await sleep(700);

/* 3. editar el título */
await caption("Haz clic y escribe directamente sobre la página");
const title = await nodeBy("(n)=>n.type==='text'&&String(n.props.text).startsWith('Automatiza lo repetitivo')");
let c = await center(title);
await glide(c.x, c.y, 550);
await page.mouse.dblclick(c.x, c.y);
await sleep(350);
await page.keyboard.press("Control+A");
await page.keyboard.type("Tu marca, en línea desde hoy.", { delay: 38 });
await sleep(250);
await page.keyboard.press("Control+Enter");
await sleep(450);

/* 4. mover / reorganizar */
await caption("Arrastra para reorganizar");
const demo = await nodeBy("(n)=>n.type==='button'&&n.props.text==='Ver demo'");
const prueba = await nodeBy("(n)=>n.type==='button'&&n.props.text==='Probar gratis'");
let a = await center(demo), b = await center(prueba);
await glide(a.x, a.y, 450); await page.mouse.down(); await sleep(80);
await glide(a.x - 20, a.y, 180);
await glide(b.l + 8, b.y, 380); await sleep(120);
await page.mouse.up(); await sleep(550);

/* 5. tipografías y colores */
await caption("Cambia tipografías y colores");
await clickEl(page.locator('.ed-tab[data-tab="assets"]'), 380); await sleep(250);
await clickEl(page.locator('.rs .st-tab[data-k="fonts"]'), 300); await sleep(250);
await clickEl(page.locator('.rs-pair:has-text("Playfair")'), 380);
await sleep(900);
await clickEl(page.locator('.rs .st-tab[data-k="colors"]'), 300); await sleep(250);
await clickEl(page.locator('.rs-palette:has-text("Océano")'), 420);
await sleep(900);

/* 6. imagen */
await caption("Sustituye imágenes");
const img = await nodeBy("(n)=>n.type==='image'");
c = await center(img);
await glide(c.x, c.y, 450); await click(); await sleep(300);
await clickEl(page.locator('.ed-tab[data-tab="assets"]'), 380); await sleep(200);
await clickEl(page.locator('.rs .st-tab[data-k="images"]'), 280); await sleep(250);
await clickEl(page.locator('.rs-img[title*="Amanecer"]'), 450);
await sleep(800);

/* 7. añadir un botón y animar */
await caption("Añade elementos y dales vida con animaciones");
await clickEl(page.locator('.ed-tab[data-tab="insert"]'), 380); await sleep(220);
await clickEl(page.locator('.in-tile:has-text("Botón contorno")'), 420);
await sleep(650);
const heading = await nodeBy("(n)=>n.type==='text'&&n.props.tag==='h1'");
c = await center(heading);
await glide(c.x, c.y, 450); await click(); await sleep(300);
await st("(ed)=>ed.setAnim(ed.s.selection,{type:'slide-up',trigger:'scroll',duration:900,intensity:60})");
await page.evaluate(() => { const s = document.querySelector('.pf-sec[data-sec="anim"]'); if (s?.classList.contains("is-closed")) s.querySelector(".pf-sechead").click(); const pb = document.querySelector(".ed-right .ed-panelbody"); if (s && pb) pb.scrollTop = s.offsetTop - 60; });
await sleep(500);
const play = page.locator('.pf-sec[data-sec="anim"] button:has-text("Probar animación")');
if (await play.count()) await clickEl(play, 450);
await sleep(1000);

/* 8. capas */
await caption("Organiza secciones y capas");
await clickEl(page.locator('.ed-tab[data-tab="layers"]'), 380); await sleep(300);
const rows = await page.$$eval(".ly-row", (els) => els.map((e) => ({ id: e.dataset.id, name: e.querySelector(".ly-name")?.textContent, depth: Number(e.getAttribute("aria-level")) })));
const sec2 = rows.filter((r) => r.depth === 2);
const from = sec2.find((r) => r.name === "Cifras") || sec2[2];
const to = sec2.find((r) => r.name === "Producto") || sec2[1];
const fb = await page.locator(`.ly-row[data-id="${from.id}"]`).boundingBox();
const tb = await page.locator(`.ly-row[data-id="${to.id}"]`).boundingBox();
await glide(fb.x + 70, fb.y + fb.height / 2, 450); await page.mouse.down(); await sleep(120);
await glide(fb.x + 70, fb.y - 12, 200); await glide(tb.x + 70, tb.y + 3, 420); await sleep(160);
await page.mouse.up(); await sleep(700);

/* 9. responsive */
await caption("Adáptala a computador, tableta y móvil");
for (const d of ["tablet", "mobile"]) { await clickEl(page.locator(`.tb-dev[data-d="${d}"]`), 450); await sleep(1100); }
await clickEl(page.locator('.tb-dev[data-d="desktop"]'), 380); await sleep(450);

/* 10. vista previa */
await caption("Prueba el resultado antes de terminar");
await clickEl(page.locator(".tb-preview"), 450);
await page.waitForSelector(".pv-frame");
await sleep(1100);
await glide(640, 420, 250);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 190); await sleep(200); }
await sleep(350);
await caption("");
await page.click(".pv .st-btn"); await sleep(250);

/* 11. cierre */
await page.evaluate(() => window.__cover('<img src="/forja/assets/img/icarus-logo-sm.webp" alt=""><h1>ICARUS Website Builder</h1><p>Tu creatividad tiene un lugar. Empieza a construir.</p><span class="btn">FORJA TU PÁGINA WEB</span>'));
await sleep(3000);
if (capStart) cues.push({ ...capStart, end: now() });
const total = now();

await page.screenshot({ path: path.join(TMP, "last.png") });
const vpath = await page.video().path();
await ctx.close();
await browser.close();
await running.close();

/* ---------- Postproceso: webm (VP9), mp4 (H.264), póster y subtítulos ---------- */
const ff = (args) => { const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" }); if (r.status !== 0) throw new Error("ffmpeg falló"); };
const lead = 0.25; // la grabación empieza un poco antes de la primera marca de tiempo
const SPEED = 1.3; // el vídeo se acelera ligeramente para quedar en ~30 s
ff(["-i", vpath, "-an", "-vf", `setpts=PTS/${SPEED},scale=1280:720:flags=lanczos,fps=30`, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "good", "-cpu-used", "3", path.join(OUT, "tour.webm")]);
ff(["-i", vpath, "-an", "-vf", `setpts=PTS/${SPEED},scale=1280:720:flags=lanczos,fps=30`, "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, "tour.mp4")]);
const posterAt = (((cues.find((c) => c.text.startsWith("Sustituye")) ?? { end: 20 }).end - 0.4) + lead) / SPEED;
ff(["-ss", String(posterAt.toFixed(2)), "-i", path.join(OUT, "tour.mp4"), "-frames:v", "1", "-q:v", "3", path.join(OUT, "tour-poster.jpg")]);

const stamp = (s) => { const t = Math.max(0, s / SPEED); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = (t % 60).toFixed(3).padStart(6, "0"); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${x}`; };
const vtt = ["WEBVTT", "", `NOTE Subtítulos generados por scripts/record-tour.mjs`, "",
  `1\n${stamp(0)} --> ${stamp(2.6 + lead)}\n¿Y si pudieras crear tu propia página web?\n`,
  ...cues.map((c, i) => `${i + 2}\n${stamp(c.start + lead)} --> ${stamp(c.end + lead - 0.1)}\n${c.text}\n`),
  `${cues.length + 2}\n${stamp(total - 3.4 + lead)} --> ${stamp(total + lead)}\nICARUS Website Builder: tu creatividad tiene un lugar. Empieza a construir.\n`].join("\n");
writeFileSync(path.join(OUT, "tour.vtt"), vtt);
rmSync(TMP, { recursive: true, force: true });
const kb = (f) => Math.round(statSync(path.join(OUT, f)).size / 1024);
console.log(`Vídeo grabado: ${total.toFixed(1)} s · tour.webm ${kb("tour.webm")} KB · tour.mp4 ${kb("tour.mp4")} KB · póster ${kb("tour-poster.jpg")} KB`);
console.log(vtt);
