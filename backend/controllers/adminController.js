import { conflito, naoEncontrado, requisicaoInvalida } from "../lib/erros.js";
import { gerarSlug } from "../lib/texto.js";
import { Bairros } from "../models/bairros.js";
import { Categorias } from "../models/categorias.js";
import { Clientes } from "../models/clientes.js";
import { Configuracoes } from "../models/configuracoes.js";
import { Depoimentos } from "../models/depoimentos.js";
import { Enderecos } from "../models/enderecos.js";
import { Mensagens } from "../models/mensagens.js";
import { Pedidos } from "../models/pedidos.js";
import { Produtos } from "../models/produtos.js";
import { situacaoLoja } from "../services/loja.js";
import { alterarStatus, detalharPedido } from "../services/pedidos.js";
import { removerImagem, salvarImagem } from "../services/uploads.js";

const POR_PAGINA = 30;
const idParam = (req) => Number(req.params.id);

// ---------- Dashboard ----------
export function dashboard(_req, res) {
  res.json({
    ok: true,
    vendas: Pedidos.resumoVendas(),
    pedidos_por_status: Object.fromEntries(Pedidos.contarPorStatus().map((l) => [l.status, l.n])),
    vendas_por_dia: Pedidos.vendasPorDia(14),
    mais_vendidos: Pedidos.maisVendidos(5),
    ultimos_pedidos: Pedidos.listarAdmin({ limite: 8 }).itens,
    clientes: Clientes.contar(),
    produtos: Produtos.contar(),
    estoque_baixo: Produtos.estoqueBaixo(5),
    depoimentos_pendentes: Depoimentos.contarPendentes(),
    mensagens_nao_lidas: Mensagens.contarNaoLidas(),
    loja: situacaoLoja(),
  });
}

// ---------- Produtos ----------
function slugUnicoProduto(base, exceto = 0) {
  let slug = gerarSlug(base) || "produto";
  for (let n = 2; Produtos.slugExiste(slug, exceto); n++) slug = `${gerarSlug(base)}-${n}`;
  return slug;
}

function conferirCategoria(categoria_id) {
  if (categoria_id && !Categorias.buscar(categoria_id)) throw requisicaoInvalida("Categoria inexistente.");
}

export function listarProdutos(req, res) {
  res.json({ ok: true, produtos: Produtos.listarAdmin({ busca: req.query.busca?.toString().slice(0, 100) || "" }) });
}

export function buscarProduto(req, res) {
  const p = Produtos.buscar(idParam(req));
  if (!p) throw naoEncontrado("Produto não encontrado.");
  res.json({ ok: true, produto: p });
}

export function criarProduto(req, res) {
  const dados = req.dados;
  conferirCategoria(dados.categoria_id);
  dados.slug = slugUnicoProduto(dados.slug || dados.nome);
  res.status(201).json({ ok: true, produto: Produtos.criar(dados) });
}

export function atualizarProduto(req, res) {
  const id = idParam(req);
  const atual = Produtos.buscar(id);
  if (!atual) throw naoEncontrado("Produto não encontrado.");
  const dados = req.dados;
  conferirCategoria(dados.categoria_id);
  dados.slug = slugUnicoProduto(dados.slug || dados.nome, id);
  dados.imagem ??= atual.imagem;
  const produto = Produtos.atualizar(id, dados);
  if (atual.imagem !== produto.imagem) removerImagem(atual.imagem);
  res.json({ ok: true, produto });
}

export function atualizarProdutoParcial(req, res) {
  const id = idParam(req);
  const atual = Produtos.buscar(id);
  if (!atual) throw naoEncontrado("Produto não encontrado.");
  const preco = req.dados.preco ?? atual.preco;
  const promo = req.dados.preco_promocional === undefined ? atual.preco_promocional : req.dados.preco_promocional;
  if (promo != null && promo >= preco) throw requisicaoInvalida("O preço promocional precisa ser menor que o preço normal.");
  res.json({ ok: true, produto: Produtos.atualizarCampos(id, req.dados) });
}

export async function enviarImagemProduto(req, res) {
  const id = idParam(req);
  const atual = Produtos.buscar(id);
  if (!atual) throw naoEncontrado("Produto não encontrado.");
  const imagem = await salvarImagem(req.file, `produto-${id}`);
  const produto = Produtos.atualizarCampos(id, { imagem });
  await removerImagem(atual.imagem);
  res.json({ ok: true, produto });
}

export async function removerProduto(req, res) {
  const id = idParam(req);
  const atual = Produtos.buscar(id);
  if (!atual) throw naoEncontrado("Produto não encontrado.");
  Produtos.remover(id);
  await removerImagem(atual.imagem);
  res.json({ ok: true });
}

// ---------- Categorias ----------
function slugCategoria(dados, exceto = 0) {
  const slug = gerarSlug(dados.slug || dados.nome);
  if (!slug) throw requisicaoInvalida("Nome de categoria inválido.");
  if (Categorias.slugExiste(slug, exceto)) throw conflito("Já existe uma categoria com esse nome/slug.");
  return slug;
}

export function listarCategorias(_req, res) {
  res.json({ ok: true, categorias: Categorias.listar({ incluirInativas: true }) });
}

export function criarCategoria(req, res) {
  const dados = { ...req.dados, slug: slugCategoria(req.dados) };
  res.status(201).json({ ok: true, categoria: Categorias.criar(dados) });
}

export function atualizarCategoria(req, res) {
  const id = idParam(req);
  if (!Categorias.buscar(id)) throw naoEncontrado("Categoria não encontrada.");
  const dados = { ...req.dados, slug: slugCategoria(req.dados, id) };
  res.json({ ok: true, categoria: Categorias.atualizar(id, dados) });
}

export function removerCategoria(req, res) {
  if (!Categorias.remover(idParam(req))) throw naoEncontrado("Categoria não encontrada.");
  res.json({ ok: true });
}

// ---------- Pedidos ----------
export function listarPedidos(req, res) {
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const busca = req.query.busca?.toString().slice(0, 100) || "";
  const r = Pedidos.listarAdmin({ status, busca, limite: POR_PAGINA, deslocamento: (pagina - 1) * POR_PAGINA });
  res.json({ ok: true, pedidos: r.itens, total: r.total, pagina, por_pagina: POR_PAGINA });
}

export function buscarPedido(req, res) {
  const pedido = Pedidos.buscar(idParam(req));
  if (!pedido) throw naoEncontrado("Pedido não encontrado.");
  const cliente = Clientes.buscarPorId(pedido.cliente_id);
  res.json({ ok: true, pedido: detalharPedido(pedido), cliente });
}

export function mudarStatusPedido(req, res) {
  const pedido = alterarStatus(idParam(req), req.dados.status, {
    usuarioId: req.cliente.id,
    observacao: req.dados.observacao,
  });
  res.json({ ok: true, pedido });
}

// ---------- Clientes ----------
export function listarClientes(req, res) {
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const busca = req.query.busca?.toString().slice(0, 100) || "";
  const r = Clientes.listar({ busca, limite: POR_PAGINA, deslocamento: (pagina - 1) * POR_PAGINA });
  res.json({ ok: true, clientes: r.itens, total: r.total, pagina, por_pagina: POR_PAGINA });
}

export function buscarCliente(req, res) {
  const cliente = Clientes.buscarPorId(idParam(req));
  if (!cliente) throw naoEncontrado("Cliente não encontrado.");
  res.json({
    ok: true,
    cliente,
    enderecos: Enderecos.listar(cliente.id),
    pedidos: Pedidos.listarDoCliente(cliente.id),
  });
}

export function alterarAtivoCliente(req, res) {
  const id = idParam(req);
  if (id === req.cliente.id) throw requisicaoInvalida("Você não pode desativar a própria conta.");
  if (!Clientes.buscarPorId(id)) throw naoEncontrado("Cliente não encontrado.");
  Clientes.definirAtivo(id, req.body?.ativo === true);
  res.json({ ok: true, cliente: Clientes.buscarPorId(id) });
}

// ---------- Depoimentos ----------
export function listarDepoimentos(_req, res) {
  res.json({ ok: true, depoimentos: Depoimentos.listarAdmin() });
}

export function criarDepoimento(req, res) {
  res.status(201).json({ ok: true, depoimento: Depoimentos.criar(req.dados) });
}

export function atualizarDepoimento(req, res) {
  const id = idParam(req);
  if (!Depoimentos.buscar(id)) throw naoEncontrado("Depoimento não encontrado.");
  res.json({ ok: true, depoimento: Depoimentos.atualizar(id, req.dados) });
}

export function removerDepoimento(req, res) {
  if (!Depoimentos.remover(idParam(req))) throw naoEncontrado("Depoimento não encontrado.");
  res.json({ ok: true });
}

// ---------- Mensagens de contato ----------
export function listarMensagens(_req, res) {
  res.json({ ok: true, mensagens: Mensagens.listar() });
}

export function marcarMensagem(req, res) {
  if (!Mensagens.definirLida(idParam(req), req.body?.lida !== false)) throw naoEncontrado("Mensagem não encontrada.");
  res.json({ ok: true });
}

export function removerMensagem(req, res) {
  if (!Mensagens.remover(idParam(req))) throw naoEncontrado("Mensagem não encontrada.");
  res.json({ ok: true });
}

// ---------- Configurações ----------
export function lerConfiguracoes(_req, res) {
  res.json({ ok: true, configuracoes: Configuracoes.todas(), bairros: Bairros.listar({ incluirInativos: true }) });
}

export function salvarConfiguracoes(req, res) {
  res.json({ ok: true, configuracoes: Configuracoes.salvar(req.dados) });
}

export async function enviarLogo(req, res) {
  const anterior = Configuracoes.todas().logo;
  const logo = await salvarImagem(req.file, "logo");
  const configuracoes = Configuracoes.salvar({ logo });
  await removerImagem(anterior);
  res.json({ ok: true, configuracoes });
}

export function criarBairro(req, res) {
  if (Bairros.encontrar(req.dados.nome, { incluirInativos: true })) throw conflito("Este bairro já está cadastrado.");
  res.status(201).json({ ok: true, bairro: Bairros.criar(req.dados) });
}

export function atualizarBairro(req, res) {
  const id = idParam(req);
  if (!Bairros.buscar(id)) throw naoEncontrado("Bairro não encontrado.");
  const outro = Bairros.encontrar(req.dados.nome, { incluirInativos: true });
  if (outro && outro.id !== id) throw conflito("Este bairro já está cadastrado.");
  res.json({ ok: true, bairro: Bairros.atualizar(id, req.dados) });
}

export function removerBairro(req, res) {
  if (!Bairros.remover(idParam(req))) throw naoEncontrado("Bairro não encontrado.");
  res.json({ ok: true });
}
