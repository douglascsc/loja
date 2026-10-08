import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

const criar = (janelaMin, max, mensagem, extra = {}) =>
  rateLimit({
    windowMs: janelaMin * 60 * 1000,
    limit: env.teste ? 10_000 : max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { ok: false, erro: mensagem },
    ...extra,
  });

export const limiteLogin = criar(15, 10, "Muitas tentativas de login. Aguarde alguns minutos.", {
  skipSuccessfulRequests: true,
});
export const limiteCadastro = criar(60, 10, "Muitos cadastros a partir deste endereço. Tente mais tarde.");
export const limiteContato = criar(60, 5, "Você enviou muitas mensagens. Tente novamente mais tarde.");
export const limitePedido = criar(10, 15, "Muitos pedidos em sequência. Aguarde um pouco.");
export const limiteGeral = criar(1, 300, "Muitas requisições. Aguarde um instante.");
