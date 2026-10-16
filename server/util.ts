import { createHash, randomBytes, timingSafeEqual, scrypt as scryptCb } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "error", public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const nowIso = () => new Date().toISOString();
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export function newId(prefix: string, len = 16): string {
  const b = randomBytes(len);
  let out = "";
  for (const x of b) out += ID_ALPHABET[x % ID_ALPHABET.length];
  return `${prefix}_${out}`;
}
export function requestCode(): string {
  const b = randomBytes(6);
  let out = "";
  for (const x of b) out += "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32];
  return `ICR-${out}`;
}

/* ---------- Contraseñas (scrypt) ---------- */
const scrypt = (pw: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, len, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const expected = Buffer.from(k, "base64");
  const got = await scrypt(pw, Buffer.from(s, "base64"), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/* ---------- Lectura/escritura HTTP ---------- */
export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > limit) throw new HttpError(413, "El contenido es demasiado grande.", "too_large");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new HttpError(413, "El contenido es demasiado grande.", "too_large");
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson<T = any>(req: IncomingMessage, limit = 6 * 1024 * 1024): Promise<T> {
  const type = String(req.headers["content-type"] || "");
  if (!type.includes("application/json")) throw new HttpError(415, "Se esperaba JSON.", "bad_type");
  const buf = await readBody(req, limit);
  try { return JSON.parse(buf.toString("utf8")); } catch { throw new HttpError(400, "JSON inválido.", "bad_json"); }
}

export function sendJson(res: ServerResponse, status: number, data: unknown, headers: Record<string, string | string[]> = {}): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(body), ...headers });
  res.end(body);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function clientIp(req: IncomingMessage): string {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.socket.remoteAddress || "unknown";
}

/* ---------- Límite de peticiones (ventana fija en memoria) ---------- */
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  check(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const cur = this.hits.get(key);
    if (!cur || cur.reset < now) { this.hits.set(key, { n: 1, reset: now + windowMs }); this.gc(now); return true; }
    cur.n++;
    return cur.n <= max;
  }
  private gc(now: number) {
    if (this.hits.size < 5000) return;
    for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
  }
}
