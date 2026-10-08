import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Carrega o .env (se existir) sem dependências externas.
const arquivoEnv = path.join(RAIZ, ".env");
if (existsSync(arquivoEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(arquivoEnv);
}

const producao = process.env.NODE_ENV === "production";

let segredo = process.env.SESSION_SECRET;
if (!segredo || segredo.length < 32) {
  if (producao) {
    throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres). Configure no ambiente de produção.");
  }
  segredo = randomBytes(32).toString("hex");
  if (process.env.NODE_ENV !== "test") {
    console.warn("[aviso] SESSION_SECRET não definido: usando um segredo temporário (sessões caem ao reiniciar).");
  }
}

export const env = Object.freeze({
  producao,
  teste: process.env.NODE_ENV === "test",
  porta: Number(process.env.PORT) || 3000,
  urlPublica: (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/+$/, ""),
  segredoSessao: segredo,
  caminhoBanco: process.env.DB_PATH
    ? process.env.DB_PATH === ":memory:"
      ? ":memory:"
      : path.resolve(RAIZ, process.env.DB_PATH)
    : path.join(RAIZ, "database", "loja.db"),
  pastaUploads: process.env.UPLOADS_DIR
    ? path.resolve(RAIZ, process.env.UPLOADS_DIR)
    : path.join(RAIZ, "uploads"),
  diasSessao: Number(process.env.SESSION_DAYS) || 30,
  custoBcrypt: Number(process.env.BCRYPT_COST) || 12,
  // Número de proxies reversos à frente do app (Railway/Render/Nginx = 1).
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0,
});
