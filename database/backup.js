// Cópia de segurança consistente do banco (funciona com o site no ar).
// Uso: npm run backup  → database/backups/loja-AAAA-MM-DD-HHMM.db
import { mkdirSync } from "node:fs";
import path from "node:path";
import { db } from "../backend/config/database.js";
import { env } from "../backend/config/env.js";

const pasta = process.argv[2] || path.join(path.dirname(env.caminhoBanco), "backups");
mkdirSync(pasta, { recursive: true });
const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");
const destino = path.join(pasta, `loja-${carimbo}.db`);
await db().backup(destino);
console.log(`Backup salvo em ${destino}`);
