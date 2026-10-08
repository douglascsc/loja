import { requisicaoInvalida } from "../lib/erros.js";

/**
 * Valida req.body / req.query / req.params com um schema zod.
 * O resultado (já limpo e convertido) substitui o original em req.dados.
 */
export function validar(schema, origem = "body") {
  return (req, _res, next) => {
    const r = schema.safeParse(req[origem] ?? {});
    if (!r.success) {
      const campos = {};
      for (const issue of r.error.issues) {
        const chave = issue.path.join(".") || "_";
        campos[chave] ??= issue.message;
      }
      return next(requisicaoInvalida(Object.values(campos)[0] || "Dados inválidos.", { campos }));
    }
    req.dados = { ...(req.dados || {}), ...r.data };
    next();
  };
}
