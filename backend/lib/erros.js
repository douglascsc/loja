/** Erro de negócio com status HTTP e mensagem segura para o cliente. */
export class ErroHttp extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

export const naoEncontrado = (msg = "Não encontrado.") => new ErroHttp(404, msg);
export const requisicaoInvalida = (msg, detalhes) => new ErroHttp(400, msg, detalhes);
export const conflito = (msg) => new ErroHttp(409, msg);
