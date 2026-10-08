import multer from "multer";
import { ErroHttp } from "../lib/erros.js";

export function rotaApiInexistente(req, _res, next) {
  next(new ErroHttp(404, "Rota da API não encontrada."));
}

// eslint-disable-next-line no-unused-vars
export function tratarErros(err, req, res, _next) {
  let status = 500;
  let corpo = { ok: false, erro: "Erro interno. Tente novamente em instantes." };

  if (err instanceof ErroHttp) {
    status = err.status;
    corpo = { ok: false, erro: err.message, ...(err.detalhes ? { detalhes: err.detalhes } : {}) };
  } else if (err instanceof multer.MulterError) {
    status = 400;
    corpo = { ok: false, erro: err.code === "LIMIT_FILE_SIZE" ? "Imagem muito grande (máximo 2 MB)." : "Upload inválido." };
  } else if (err?.type === "entity.parse.failed") {
    status = 400;
    corpo = { ok: false, erro: "JSON inválido." };
  } else if (err?.type === "entity.too.large") {
    status = 413;
    corpo = { ok: false, erro: "Requisição muito grande." };
  } else if (err?.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
    status = 409;
    corpo = { ok: false, erro: "Este registro está em uso e não pode ser removido." };
  } else {
    console.error(`[erro] ${req.method} ${req.originalUrl}`, err);
  }

  if (req.originalUrl.startsWith("/api/") || req.accepts(["html", "json"]) === "json") {
    return res.status(status).json(corpo);
  }
  res.status(status).type("text").send(corpo.erro);
}
