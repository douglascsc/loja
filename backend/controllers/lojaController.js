import { conflito, naoEncontrado, requisicaoInvalida } from "../lib/erros.js";
import { Bairros } from "../models/bairros.js";
import { Categorias } from "../models/categorias.js";
import { Depoimentos } from "../models/depoimentos.js";
import { Mensagens } from "../models/mensagens.js";
import { Pedidos } from "../models/pedidos.js";
import { Produtos, produtoPublico } from "../models/produtos.js";
import { configPublica } from "../services/loja.js";
import { calcularCarrinho } from "../services/pedidos.js";

export function loja(_req, res) {
  res.set("Cache-Control", "no-cache");
  res.json({ ok: true, loja: configPublica() });
}

export function listarProdutos(req, res) {
  const { categoria, destaque, busca } = req.dados;
  const produtos = Produtos.listarPublicos({ categoria, destaque, busca }).map(produtoPublico);
  res.json({ ok: true, produtos });
}

export function buscarProduto(req, res) {
  const chave = req.params.chave;
  const p = /^\d+$/.test(chave) ? Produtos.buscarPublicoPorId(Number(chave)) : Produtos.buscarPublicoPorSlug(chave);
  if (!p) throw naoEncontrado("Produto não encontrado.");
  res.json({ ok: true, produto: produtoPublico(p), avaliacoes: Depoimentos.listarAprovados({ produto_id: p.id, limite: 20 }) });
}

export function listarCategorias(_req, res) {
  res.json({
    ok: true,
    categorias: Categorias.listar().map(({ id, nome, slug, descricao }) => ({ id, nome, slug, descricao })),
  });
}

export function listarBairros(_req, res) {
  res.json({ ok: true, bairros: Bairros.listar().map(({ nome, taxa }) => ({ nome, taxa })) });
}

export function listarDepoimentos(_req, res) {
  res.json({ ok: true, depoimentos: Depoimentos.listarAprovados({ limite: 12 }) });
}

export function validarCarrinho(req, res) {
  res.json({ ok: true, ...calcularCarrinho(req.dados.itens) });
}

export function enviarContato(req, res) {
  const { site, ...dados } = req.dados;
  // Robô preencheu o campo oculto: responde "ok" sem gravar.
  if (!site) Mensagens.criar({ ...dados, ip: req.ip });
  res.status(201).json({ ok: true });
}

/** Cliente avalia um produto de um pedido entregue (vai para moderação). */
export function avaliarProduto(req, res) {
  const { pedido_id, produto_id, nota, texto } = req.dados;
  const pedido = Pedidos.buscarDoCliente(pedido_id, req.cliente.id);
  if (!pedido) throw naoEncontrado("Pedido não encontrado.");
  if (pedido.status !== "entregue") throw requisicaoInvalida("Você poderá avaliar assim que o pedido for entregue.");
  if (!Pedidos.itens(pedido.id).some((i) => i.produto_id === produto_id)) {
    throw requisicaoInvalida("Este produto não faz parte do pedido.");
  }
  if (Depoimentos.jaAvaliou(pedido.id, produto_id)) throw conflito("Você já avaliou este produto neste pedido.");
  const primeiroNome = req.cliente.nome.split(/\s+/)[0];
  Depoimentos.criar({
    cliente_id: req.cliente.id,
    produto_id,
    pedido_id: pedido.id,
    nome_exibicao: primeiroNome,
    cidade: pedido.entrega_cidade,
    nota,
    texto,
  });
  res.status(201).json({ ok: true, mensagem: "Obrigado! Sua avaliação aparecerá no site após a moderação." });
}
