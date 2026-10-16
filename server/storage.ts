/** Almacenamiento de archivos (imágenes subidas, paquetes ZIP). La BD guarda solo la referencia. */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "./config";
import type { Db } from "./db";
import { nowIso } from "./util";

export interface BlobStore {
  readonly driver: "db" | "fs";
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

/** Tabla `blobs` dedicada (no mezcla binarios con los JSON de proyectos). Funciona sin disco persistente. */
export class DbBlobStore implements BlobStore {
  readonly driver = "db" as const;
  constructor(private db: Db) {}
  async put(key: string, data: Buffer) {
    await this.db.run(`INSERT INTO blobs (key, data, created_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET data = excluded.data`, [key, data, nowIso()]);
  }
  async get(key: string) {
    const r = await this.db.get<{ data: Buffer }>(`SELECT data FROM blobs WHERE key = ?`, [key]);
    return r ? Buffer.from(r.data) : null;
  }
  async delete(key: string) { await this.db.run(`DELETE FROM blobs WHERE key = ?`, [key]); }
}

/** Disco local (útil con un disco persistente montado, p. ej. Render Disk en STORAGE_DIR). */
export class FsBlobStore implements BlobStore {
  readonly driver = "fs" as const;
  constructor(private dir: string) {}
  private file(key: string) {
    if (!/^[\w.-]+$/.test(key)) throw new Error("clave inválida");
    return path.join(this.dir, key);
  }
  async put(key: string, data: Buffer) { await mkdir(this.dir, { recursive: true }); await writeFile(this.file(key), data); }
  async get(key: string) { try { return await readFile(this.file(key)); } catch { return null; } }
  async delete(key: string) { await rm(this.file(key), { force: true }); }
}

export function createStore(cfg: Config, db: Db): BlobStore {
  return cfg.storageDriver === "fs" ? new FsBlobStore(cfg.storageDir) : new DbBlobStore(db);
}

/** Tipo real por firma de bytes (no se confía en el Content-Type del cliente). SVG no se admite. */
export function sniff(buf: Buffer): { mime: string; ext: string; kind: "image" | "video" } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === "PNG") return { mime: "image/png", ext: "png", kind: "image" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (buf.subarray(0, 4).toString() === "GIF8") return { mime: "image/gif", ext: "gif", kind: "image" };
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (buf.subarray(4, 8).toString() === "ftyp") {
    const brand = buf.subarray(8, 12).toString();
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", ext: "avif", kind: "image" };
    return { mime: "video/mp4", ext: "mp4", kind: "video" };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: "video/webm", ext: "webm", kind: "video" };
  return null;
}
