import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { ErroHttp } from "../lib/erros.js";

// Proteção CSRF por "double submit" assinado:
// - o servidor grava uma semente aleatória num cookie httpOnly;
// - GET /api/csrf devolve HMAC(segredo, semente);
// - toda requisição que altera dados precisa enviar esse valor no
//   cabeçalho X-CSRF-Token. Um site de terceiros não consegue ler o
//   token nem enviar cabeçalhos customizados sem passar pelo CORS.
const COOKIE = "csrf_seed";
const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

const assinar = (semente) => createHmac("sha256", env.segredoSessao).update(semente).digest("hex");

export function emitirTokenCsrf(req, res) {
  let semente = req.cookies?.[COOKIE];
  if (!semente || !/^[a-f0-9]{48}$/.test(semente)) {
    semente = randomBytes(24).toString("hex");
    res.cookie(COOKIE, semente, { httpOnly: true, sameSite: "lax", secure: env.producao, path: "/" });
  }
  res.set("Cache-Control", "no-store");
  res.json({ token: assinar(semente) });
}

export function verificarCsrf(req, _res, next) {
  if (METODOS_SEGUROS.has(req.method)) return next();
  const semente = req.cookies?.[COOKIE];
  const enviado = req.get("x-csrf-token") || "";
  if (!semente || !/^[a-f0-9]{64}$/.test(enviado)) {
    return next(new ErroHttp(403, "Sessão de segurança expirada. Recarregue a página e tente novamente."));
  }
  const esperado = Buffer.from(assinar(semente), "hex");
  if (!timingSafeEqual(esperado, Buffer.from(enviado, "hex"))) {
    return next(new ErroHttp(403, "Sessão de segurança expirada. Recarregue a página e tente novamente."));
  }
  next();
}
