/** Migraciones versionadas. Cada una se aplica una sola vez y dentro de una transacción. */
import type { Db } from "./db";

interface Migration { version: number; name: string; up: string[] }

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "esquema inicial del constructor",
    up: [
      `CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        user_agent TEXT
      )`,
      `CREATE INDEX idx_sessions_user ON sessions(user_id)`,
      `CREATE TABLE folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_folders_user ON folders(user_id)`,
      `CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        site_name TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        page_type TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        contact TEXT NOT NULL DEFAULT '{}',
        brand TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        archived INTEGER NOT NULL DEFAULT 0,
        doc_meta TEXT NOT NULL DEFAULT '{}',
        responsive TEXT NOT NULL DEFAULT '{}',
        seo TEXT NOT NULL DEFAULT '{}',
        thumb TEXT NOT NULL DEFAULT '',
        template_id TEXT,
        page_count INTEGER NOT NULL DEFAULT 1,
        rev INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_projects_user ON projects(user_id, updated_at)`,
      `CREATE INDEX idx_projects_folder ON projects(folder_id)`,
      `CREATE TABLE project_pages (
        pk TEXT PRIMARY KEY,
        id TEXT NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        position INTEGER NOT NULL,
        root_id TEXT NOT NULL,
        content TEXT NOT NULL,
        settings TEXT NOT NULL DEFAULT '{}'
      )`,
      `CREATE UNIQUE INDEX idx_pages_slug ON project_pages(project_id, slug)`,
      `CREATE TABLE project_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        doc TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX idx_versions ON project_versions(project_id, version)`,
      `CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        storage TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        meta TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_assets_user ON assets(user_id, created_at)`,
      `CREATE TABLE blobs (
        key TEXT PRIMARY KEY,
        data {{BLOB}} NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE exports (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rev INTEGER NOT NULL,
        filename TEXT NOT NULL,
        size INTEGER NOT NULL,
        storage TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,
        downloads INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE requests (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        contact TEXT NOT NULL DEFAULT '{}',
        summary TEXT NOT NULL DEFAULT '{}',
        note TEXT NOT NULL DEFAULT '',
        export_id TEXT REFERENCES exports(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_requests_status ON requests(status, created_at)`,
      `CREATE INDEX idx_requests_user ON requests(user_id)`,
      `CREATE TABLE request_events (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        actor_id TEXT,
        type TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_events_request ON request_events(request_id, created_at)`,
    ],
  },
];

export async function migrate(db: Db): Promise<number> {
  await db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);
  const done = new Set((await db.all<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => Number(r.version)));
  let applied = 0;
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    await db.tx(async (t) => {
      for (const stmt of m.up) await t.run(stmt.replace("{{BLOB}}", db.kind === "pg" ? "BYTEA" : "BLOB"));
      await t.run(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`, [m.version, m.name, new Date().toISOString()]);
    });
    applied++;
  }
  return applied;
}
