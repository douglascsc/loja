import { ErroHttp } from "../lib/erros.js";

export function exigirLogin(req, _res, next) {
  if (!req.cliente) return next(new ErroHttp(401, "Faça login para continuar."));
  next();
}

export function exigirAdmin(req, _res, next) {
  if (!req.cliente) return next(new ErroHttp(401, "Faça login para continuar."));
  if (req.cliente.papel !== "admin") return next(new ErroHttp(403, "Acesso restrito."));
  next();
}

/** Para páginas HTML: redireciona ao login em vez de responder JSON. */
export function exigirLoginPagina(req, res, next) {
  if (!req.cliente) return res.redirect(302, `/login?voltar=${encodeURIComponent(req.originalUrl)}`);
  next();
}

export function exigirAdminPagina(req, res, next) {
  if (!req.cliente) return res.redirect(302, `/login?voltar=${encodeURIComponent(req.originalUrl)}`);
  if (req.cliente.papel !== "admin") return res.redirect(302, "/conta");
  next();
}
