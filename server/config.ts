/** Configuración leída de variables de entorno (ver .env.example). Nunca contiene secretos por defecto. */
import path from "node:path";

export interface Config {
  port: number;
  host: string;
  production: boolean;
  databaseUrl: string;
  sqlitePath: string;
  distDir: string;
  sessionTtlDays: number;
  adminEmails: string[];
  whatsappNumber: string;
  publicBaseUrl: string;
  exportTtlDays: number;
  storageDriver: "db" | "fs";
  storageDir: string;
  registrationOpen: boolean;
  maxUploadMb: number;
  userQuotaMb: number;
  cloudApi: { token: string; phoneNumberId: string; notifyTo: string; template: string; lang: string };
}

const int = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: Partial<Config> = {}): Config {
  const cfg: Config = {
    port: int(env.PORT, 8080),
    host: env.HOST || "0.0.0.0",
    production: env.NODE_ENV === "production",
    databaseUrl: env.DATABASE_URL || "",
    sqlitePath: env.SQLITE_PATH || path.resolve(".data/icarus.db"),
    distDir: path.resolve(env.DIST_DIR || "dist"),
    sessionTtlDays: int(env.SESSION_TTL_DAYS, 30),
    adminEmails: (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    whatsappNumber: (env.WHATSAPP_NUMBER || "").replace(/\D/g, ""),
    publicBaseUrl: (env.PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
    exportTtlDays: int(env.EXPORT_TTL_DAYS, 14),
    storageDriver: env.STORAGE_DRIVER === "fs" ? "fs" : "db",
    storageDir: path.resolve(env.STORAGE_DIR || ".data/files"),
    registrationOpen: env.ALLOW_REGISTRATION !== "false",
    maxUploadMb: int(env.MAX_UPLOAD_MB, 8),
    userQuotaMb: int(env.USER_QUOTA_MB, 200),
    cloudApi: {
      token: env.WHATSAPP_CLOUD_TOKEN || "",
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || "",
      notifyTo: (env.WHATSAPP_NOTIFY_TO || "").replace(/\D/g, ""),
      template: env.WHATSAPP_TEMPLATE || "",
      lang: env.WHATSAPP_TEMPLATE_LANG || "es",
    },
  };
  return { ...cfg, ...overrides };
}
