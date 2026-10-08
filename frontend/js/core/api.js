// Cliente HTTP da API: envia cookies de sessão e o token CSRF automaticamente.

export class ErroApi extends Error {
  constructor(mensagem, status, dados = {}) {
    super(mensagem);
    this.status = status;
    this.dados = dados;
  }
}

let promessaToken = null;

function obterToken() {
  promessaToken ??= fetch("/api/csrf", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((j) => j.token)
    .catch((e) => {
      promessaToken = null;
      throw e;
    });
  return promessaToken;
}

export async function api(caminho, { metodo = "GET", corpo, formulario } = {}, tentativa = 0) {
  const headers = { Accept: "application/json" };
  if (metodo !== "GET") headers["X-CSRF-Token"] = await obterToken();

  let body;
  if (formulario) body = formulario;
  else if (corpo !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(`/api${caminho}`, { method: metodo, headers, body, credentials: "same-origin" });
  } catch {
    throw new ErroApi("Sem conexão com o servidor. Verifique sua internet e tente novamente.", 0);
  }

  let dados = {};
  try {
    dados = await resposta.json();
  } catch {
    /* resposta sem JSON */
  }

  // Token CSRF expirado (ex.: cookies limpos): renova e tenta uma vez.
  if (resposta.status === 403 && metodo !== "GET" && tentativa === 0 && /segurança/i.test(dados.erro || "")) {
    promessaToken = null;
    return api(caminho, { metodo, corpo, formulario }, 1);
  }

  if (!resposta.ok) {
    throw new ErroApi(dados.erro || "Algo deu errado. Tente novamente.", resposta.status, dados);
  }
  return dados;
}

export const get = (c) => api(c);
export const post = (c, corpo) => api(c, { metodo: "POST", corpo });
export const put = (c, corpo) => api(c, { metodo: "PUT", corpo });
export const patch = (c, corpo) => api(c, { metodo: "PATCH", corpo });
export const del = (c) => api(c, { metodo: "DELETE" });
export const enviarArquivo = (c, formulario) => api(c, { metodo: "POST", formulario });
