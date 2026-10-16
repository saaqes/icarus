// Servidor estático para probar dist/ en local:  npm start   (o npm run preview)
import path from "node:path";
import { startStatic } from "./static-server.mjs";

await startStatic({ dist: path.resolve(import.meta.dirname, "..", "dist"), port: Number(process.env.PORT) || 8080, host: "0.0.0.0" });
