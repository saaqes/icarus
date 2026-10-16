/**
 * Capa de base de datos mínima con dos adaptadores:
 *   - PostgreSQL (`pg`) cuando existe DATABASE_URL  → producción (Render)
 *   - SQLite (`node:sqlite`) en caso contrario       → desarrollo local y pruebas
 * El SQL es portable: marcadores `?`, JSON como TEXT, fechas ISO como TEXT, booleanos como INTEGER.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Config } from "./config";

export interface Db {
  readonly kind: "sqlite" | "pg";
  all<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = any>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/* ---------- SQLite ---------- */

class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

function norm(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

async function openSqlite(file: string): Promise<Db> {
  const { DatabaseSync } = await import("node:sqlite");
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  const mutex = new Mutex();

  const exec = {
    all: (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...(params.map(norm) as any[])) as any[],
    run: (sql: string, params: unknown[] = []) => {
      const r = raw.prepare(sql).run(...(params.map(norm) as any[]));
      return { changes: Number(r.changes) };
    },
  };
  const fixBlob = (rows: any[]) => rows.map((r) => {
    for (const k of Object.keys(r)) if (r[k] instanceof Uint8Array && !(r[k] instanceof Buffer)) r[k] = Buffer.from(r[k]);
    return { ...r };
  });

  const make = (locked: boolean): Db => {
    const guard = <T>(fn: () => Promise<T>) => (locked ? mutex.run(fn) : fn());
    const self: Db = {
      kind: "sqlite",
      all: (sql, params) => guard(async () => fixBlob(exec.all(sql, params))),
      get: (sql, params) => guard(async () => fixBlob(exec.all(sql, params))[0]),
      run: (sql, params) => guard(async () => exec.run(sql, params)),
      tx: (fn) =>
        locked
          ? mutex.run(async () => {
              raw.exec("BEGIN IMMEDIATE");
              try {
                const out = await fn(make(false));
                raw.exec("COMMIT");
                return out;
              } catch (e) {
                raw.exec("ROLLBACK");
                throw e;
              }
            })
          : fn(self),
      close: async () => { raw.close(); },
    };
    return self;
  };
  return make(true);
}

/* ---------- PostgreSQL ---------- */

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function openPg(url: string, production: boolean): Promise<Db> {
  const pg = (await import("pg")).default;
  const local = /localhost|127\.0\.0\.1|\[::1\]/.test(url);
  const pool = new pg.Pool({
    connectionString: url,
    max: 10,
    ssl: local || /sslmode=disable/.test(url) ? undefined : production ? { rejectUnauthorized: false } : undefined,
  });
  // evita que un error de una conexión inactiva tumbe el proceso
  pool.on("error", (e: Error) => console.error("[pg] error en conexión inactiva:", e.message));
  const wrap = (q: { query: (sql: string, params?: unknown[]) => Promise<any> }, inTx: boolean): Db => ({
    kind: "pg",
    all: async (sql, params = []) => (await q.query(toPg(sql), params.map(norm))).rows,
    get: async (sql, params = []) => (await q.query(toPg(sql), params.map(norm))).rows[0],
    run: async (sql, params = []) => ({ changes: (await q.query(toPg(sql), params.map(norm))).rowCount ?? 0 }),
    tx: async (fn) => {
      if (inTx) return fn(wrap(q, true));
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn(wrap(client, true));
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    close: async () => { await pool.end(); },
  });
  return wrap(pool, false);
}

export async function openDb(cfg: Config): Promise<Db> {
  if (cfg.databaseUrl) return openPg(cfg.databaseUrl, cfg.production);
  return openSqlite(cfg.sqlitePath);
}
