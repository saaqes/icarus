// Compila TypeScript (esbuild) y copia los archivos estáticos a dist/.
// src/site  -> dist/        (ICARUS: inicio + herramientas)
// src/forja -> dist/forja/  (icarus-web: forjar tu página web)
import { build } from "esbuild";
import { cp, mkdir, rm, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

// ICARUS Studio (editor + bienvenida): módulos ES empaquetados con división de código.
const studioOut = path.join(DIST, "forja/studio/assets/js");
const studioEntries = (await readdir(path.join(ROOT, "studio/entries")).catch(() => [])).filter((f) => f.endsWith(".ts")).map((f) => path.join(ROOT, "studio/entries", f));
if (studioEntries.length) {
  await build({
    entryPoints: studioEntries, outdir: studioOut, bundle: true, splitting: true, format: "esm",
    target: "es2022", minify: true, legalComments: "none", logLevel: "warning", chunkNames: "chunks/[name]-[hash]",
  });
  console.log(`Studio OK — ${studioEntries.length} entradas empaquetadas → dist/forja/studio/assets/js/`);
}

// site.js: comportamiento del sitio generado (se usa en la vista previa; el ZIP lleva su propia copia)
const tmp = path.join(ROOT, ".build-tmp");
await build({ entryPoints: [path.join(ROOT, "shared/export/runtime.ts")], outfile: path.join(tmp, "runtime.mjs"), bundle: true, format: "esm", platform: "node", logLevel: "warning" });
const { SITE_JS } = await import(pathToFileURL(path.join(tmp, "runtime.mjs")).href);
await mkdir(studioOut, { recursive: true });
await writeFile(path.join(studioOut, "site.js"), SITE_JS);
await rm(tmp, { recursive: true, force: true });

// Configuración pública del Studio. El número de WhatsApp sale de la variable de entorno WHATSAPP_NUMBER (no está en el código).
const wa = String(process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
await writeFile(path.join(DIST, "forja/studio/config.json"), JSON.stringify({ whatsappNumber: /^\d{8,15}$/.test(wa) ? wa : "" }) + "\n");
console.log(wa ? "WhatsApp: número configurado desde WHATSAPP_NUMBER." : "WhatsApp: WHATSAPP_NUMBER no está definida (el botón no abrirá WhatsApp).");
