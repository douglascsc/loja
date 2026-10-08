import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { Sessoes } from "../models/sessoes.js";

export const COOKIE_SESSAO = "sid";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const opcoesCookie = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.producao,
  path: "/",
  maxAge: env.diasSessao * 24 * 60 * 60 * 1000,
});

/** Carrega req.cliente a partir do cookie de sessão (se houver). */
export function carregarSessao(req, res, next) {
  const token = req.cookies?.[COOKIE_SESSAO];
  req.cliente = null;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    req.sessaoId = hashToken(token);
    req.cliente = Sessoes.buscarCliente(req.sessaoId) || null;
    if (!req.cliente) res.clearCookie(COOKIE_SESSAO, { path: "/" });
  }
  next();
}

/** Inicia uma sessão nova (sempre gera token novo: evita fixação de sessão). */
export function iniciarSessao(req, res, cliente) {
  if (req.sessaoId) Sessoes.remover(req.sessaoId);
  const token = randomBytes(32).toString("hex");
  const id = hashToken(token);
  Sessoes.criar({ id, cliente_id: cliente.id, dias: env.diasSessao, ip: req.ip, user_agent: req.get("user-agent") });
  res.cookie(COOKIE_SESSAO, token, opcoesCookie());
  req.sessaoId = id;
  req.cliente = cliente;
}

export function encerrarSessao(req, res) {
  if (req.sessaoId) Sessoes.remover(req.sessaoId);
  res.clearCookie(COOKIE_SESSAO, { path: "/" });
  req.cliente = null;
  req.sessaoId = null;
}
