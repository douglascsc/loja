import { conflito, ErroHttp } from "../lib/erros.js";
import { encerrarSessao, iniciarSessao } from "../middleware/sessao.js";
import { Clientes } from "../models/clientes.js";
import { conferirSenha, conferirSenhaFalsa, hashSenha } from "../services/senha.js";

const semHash = ({ senha_hash, ...resto }) => resto; // eslint-disable-line no-unused-vars

export async function cadastrar(req, res) {
  const { nome, email, telefone, senha } = req.dados;
  if (Clientes.emailExiste(email)) throw conflito("Este e-mail já está cadastrado. Faça login.");
  const cliente = Clientes.criar({ nome, email, telefone, senha_hash: await hashSenha(senha) });
  iniciarSessao(req, res, cliente);
  res.status(201).json({ ok: true, cliente });
}

export async function login(req, res) {
  const { email, senha } = req.dados;
  const registro = Clientes.buscarParaLogin(email);
  const valida = registro ? await conferirSenha(senha, registro.senha_hash) : await conferirSenhaFalsa(senha);
  // Mensagem genérica: não revela se o e-mail existe.
  if (!valida) throw new ErroHttp(401, "E-mail ou senha incorretos.");
  if (!registro.ativo) throw new ErroHttp(403, "Esta conta está desativada. Fale com a loja.");
  const cliente = semHash(registro);
  iniciarSessao(req, res, cliente);
  res.json({ ok: true, cliente });
}

export function logout(req, res) {
  encerrarSessao(req, res);
  res.json({ ok: true });
}
