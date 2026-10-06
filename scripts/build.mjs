// Compila TypeScript (esbuild) y copia los archivos estáticos a dist/.
// src/site  -> dist/        (ICARUS: inicio + herramientas)
// src/forja -> dist/forja/  (icarus-web: forjar tu página web)
import { build } from "esbuild";
import { cp, mkdir, rm, readdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    (await stat(full)).isDirectory() ? out.push(...(await walk(full))) : out.push(full);
  }
  return out;
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const targets = [
  ["src/site", ""],
  ["src/forja", "forja"],
];
let compiled = 0, copied = 0;
for (const [srcDir, outDir] of targets) {
  const base = path.join(ROOT, srcDir);
  for (const file of await walk(base)) {
    const rel = path.relative(base, file);
    if (rel.endsWith(".d.ts")) continue;
    if (rel.endsWith(".ts")) {
      // assets/ts/main.ts -> assets/js/main.js ; el resto: misma carpeta, extensión .js
      const jsRel = rel.replace(/(^|\/)assets\/ts\//, "$1assets/js/").replace(/\.ts$/, ".js");
      await build({
        entryPoints: [file],
        outfile: path.join(DIST, outDir, jsRel),
        bundle: false,
        format: "iife",
        target: "es2020",
        minify: true,
        legalComments: "none",
        logLevel: "warning",
      });
      compiled++;
    } else {
      await mkdir(path.dirname(path.join(DIST, outDir, rel)), { recursive: true });
      await cp(file, path.join(DIST, outDir, rel));
      copied++;
    }
  }
}
console.log(`Build OK — ${compiled} archivos TypeScript compilados, ${copied} archivos estáticos copiados → dist/`);
