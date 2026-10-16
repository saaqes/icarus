/** Utilidades para las pruebas de extremo a extremo (Chromium de Playwright + servidor real con SQLite en memoria). */
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { start, type Running } from "../../server/index";

const CANDIDATES = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean) as string[];

export interface Env { srv: Running; base: string; browser: Browser }

export async function setup(): Promise<Env> {
  const dist = path.resolve("dist");
  if (!existsSync(path.join(dist, "forja/studio/assets/js/studio.js"))) throw new Error("Falta dist/: ejecuta `npm run build` antes de las pruebas e2e.");
  const srv = await start({ port: 0, host: "127.0.0.1", sqlitePath: ":memory:", databaseUrl: "", distDir: dist, adminEmails: ["admin@icarus.test"], whatsappNumber: "573001112233", exportTtlDays: 7 }, { quiet: true });
  const a = srv.server.address();
  const base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  return { srv, base, browser };
}

export async function teardown(env: Env): Promise<void> {
  await env.browser.close();
  await env.srv.close();
}

export interface Session { ctx: BrowserContext; page: Page; logs: string[]; id: string }

let counter = 0;
export async function newContext(env: Env, opts: { w?: number; h?: number; touch?: boolean } = {}): Promise<{ ctx: BrowserContext; page: Page; logs: string[]; email: string }> {
  const ctx = await env.browser.newContext({ viewport: { width: opts.w ?? 1440, height: opts.h ?? 900 }, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await ctx.newPage();
  const logs: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const url = m.location().url || "";
    if (url && !url.startsWith(env.base)) return; // recursos externos (Google Fonts) pueden no estar disponibles
    logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`PAGEERROR: ${e.message}`));
  await page.addInitScript(() => { try { localStorage.setItem("icarus.debug", "1"); } catch { /* sin almacenamiento */ } });
  const email = `u${Date.now()}${counter++}@test.co`;
  const r = await ctx.request.post(env.base + "/api/auth/register", { data: { name: "Usuaria de prueba", email, password: "clave-segura-1" } });
  if (r.status() !== 201) throw new Error("registro falló: " + r.status());
  return { ctx, page, logs, email };
}

export async function openProject(env: Env, opts: { tpl?: string; w?: number; h?: number; touch?: boolean } = {}): Promise<Session> {
  const { ctx, page, logs } = await newContext(env, opts);
  const r = await ctx.request.post(env.base + "/api/projects", { data: { name: "Proyecto e2e", siteName: "Sitio e2e", templateId: opts.tpl ?? "creativa" } });
  const id = (await r.json()).project.id as string;
  await page.goto(`${env.base}/forja/studio/#/edit/${id}`);
  await page.waitForSelector(".cv-frame", { timeout: 20000 });
  await page.waitForTimeout(600);
  return { ctx, page, logs, id };
}

/** Evalúa código en la página con acceso al editor: fn(ed, ws, arg). */
export function st<T = any>(page: Page, fn: string, arg?: unknown): Promise<T> {
  return page.evaluate(new Function("a", `const {ed,ws}=window.__studio; return (${fn})(ed,ws,a)`) as any, arg) as Promise<T>;
}

export const idByText = (page: Page, text: string) => st<string | null>(page, "(ed,ws,t)=>Object.values(ed.doc.nodes).find((n)=>n.props.text===t)?.id ?? null", text);
export const idByType = (page: Page, type: string, nth = 0) => st<string | null>(page, "(ed,ws,a)=>Object.values(ed.doc.nodes).filter((n)=>n.type===a.t)[a.n]?.id ?? null", { t: type, n: nth });

export interface Box { x: number; y: number; w: number; h: number; l: number; t: number }
export const centerOf = (page: Page, id: string) => st<Box>(page, `(ed,ws,id)=>{const el=ws.view.el(id);el.scrollIntoView({block:"center",inline:"center"});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,l:r.left,t:r.top}}`, id);

export async function waitSaved(page: Page, timeout = 15000): Promise<void> {
  await page.waitForFunction(() => /guardado/i.test(document.querySelector(".tb-save")?.textContent || "") && !/sin guardar|guardando/i.test(document.querySelector(".tb-save")?.textContent || ""), null, { timeout });
}
