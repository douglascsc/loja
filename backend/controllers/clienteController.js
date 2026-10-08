import { conflito, ErroHttp, naoEncontrado } from "../lib/erros.js";
import { Clientes } from "../models/clientes.js";
import { Enderecos } from "../models/enderecos.js";
import { Sessoes } from "../models/sessoes.js";
import { conferirSenha, hashSenha } from "../services/senha.js";

/** Nunca falha: informa se há alguém logado (usado no cabeçalho do site). */
export function me(req, res) {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, logado: !!req.cliente, cliente: req.cliente || null });
}

export function atualizarDados(req, res) {
  const { nome, email, telefone } = req.dados;
  if (Clientes.emailExiste(email, req.cliente.id)) throw conflito("Este e-mail já está em uso por outra conta.");
  res.json({ ok: true, cliente: Clientes.atualizarDados(req.cliente.id, { nome, email, telefone }) });
}

export async function trocarSenha(req, res) {
  const { senha_atual, nova_senha } = req.dados;
  const hash = Clientes.buscarHash(req.cliente.id);
  if (!(await conferirSenha(senha_atual, hash))) throw new ErroHttp(400, "A senha atual está incorreta.");
  Clientes.atualizarSenha(req.cliente.id, await hashSenha(nova_senha));
  // Encerra as outras sessões abertas (outros aparelhos).
  Sessoes.removerDoCliente(req.cliente.id, req.sessaoId);
  res.json({ ok: true });
}

export function listarEnderecos(req, res) {
  res.json({ ok: true, enderecos: Enderecos.listar(req.cliente.id) });
}

export function criarEndereco(req, res) {
  if (Enderecos.contar(req.cliente.id) >= 10) throw conflito("Limite de 10 endereços atingido.");
  res.status(201).json({ ok: true, endereco: Enderecos.criar(req.cliente.id, req.dados) });
}

export function atualizarEndereco(req, res) {
  const id = Number(req.params.id);
  if (!Enderecos.buscar(id, req.cliente.id)) throw naoEncontrado("Endereço não encontrado.");
  res.json({ ok: true, endereco: Enderecos.atualizar(id, req.cliente.id, req.dados) });
}

export function removerEndereco(req, res) {
  if (!Enderecos.remover(Number(req.params.id), req.cliente.id)) throw naoEncontrado("Endereço não encontrado.");
  res.json({ ok: true });
}
