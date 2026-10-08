import multer from "multer";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { requisicaoInvalida } from "../lib/erros.js";

const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2 MB

// Identifica o tipo real pelo conteúdo (assinatura), não pelo nome ou pelo
// Content-Type enviado pelo navegador, que podem ser falsificados.
function detectarTipo(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Middleware multer: um arquivo no campo "imagem", em memória. */
export const receberImagem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
}).single("imagem");

/** Valida e grava a imagem. Retorna o caminho público (/uploads/...). */
export async function salvarImagem(arquivo, prefixo = "img") {
  if (!arquivo) throw requisicaoInvalida("Envie uma imagem.");
  const tipo = detectarTipo(arquivo.buffer);
  if (!tipo) throw requisicaoInvalida("Formato inválido. Use JPG, PNG ou WebP.");
  mkdirSync(env.pastaUploads, { recursive: true });
  const nome = `${prefixo}-${Date.now()}-${randomBytes(6).toString("hex")}.${tipo}`;
  await writeFile(path.join(env.pastaUploads, nome), arquivo.buffer);
  return `/uploads/${nome}`;
}

/** Apaga um arquivo enviado anteriormente (ignora imagens que não são uploads). */
export async function removerImagem(caminhoPublico) {
  if (!caminhoPublico?.startsWith("/uploads/")) return;
  const nome = path.basename(caminhoPublico);
  await unlink(path.join(env.pastaUploads, nome)).catch(() => {});
}
