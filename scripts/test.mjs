// Compila los tests (esbuild, con alias a shared/server) y los ejecuta con el runner de Node.
//   npm test            → pruebas unitarias y de API (SQLite en memoria; PostgreSQL si hay TEST_DATABASE_URL)
//   npm run test:e2e    → además, pruebas de extremo a extremo con Chromium (requiere `npm run build`)
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { readdir, rm, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, ".test-build");
const e2e = process.argv.includes("--e2e");

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

async function list(dir) {
  const out = [];
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) { if (name.name !== "e2e" || e2e) out.push(...(await list(full))); }
    else if (name.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const entries = await list(path.join(ROOT, "tests"));
if (!entries.length) { console.log("Sin tests."); process.exit(0); }
await build({
  entryPoints: entries,
  outdir: OUT,
  outbase: path.join(ROOT, "tests"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  logLevel: "warning",
  sourcemap: "inline",
  outExtension: { ".js": ".mjs" },
});
const files = entries.map((f) => path.join(OUT, path.relative(path.join(ROOT, "tests"), f).replace(/\.ts$/, ".mjs")));
const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", "--test-force-exit", ...files], { stdio: "inherit", cwd: ROOT });
process.exit(r.status ?? 1);
