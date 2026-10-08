import { randomInt } from "node:crypto";
import { transacao } from "../config/database.js";
import { MAX_ITENS_POR_PRODUTO, STATUS_FINAIS } from "../config/constantes.js";
import { ErroHttp, conflito, naoEncontrado, requisicaoInvalida } from "../lib/erros.js";
import { normalizar } from "../lib/texto.js";
import { Bairros } from "../models/bairros.js";
import { Configuracoes } from "../models/configuracoes.js";
import { Enderecos } from "../models/enderecos.js";
import { Pedidos } from "../models/pedidos.js";
import { Produtos } from "../models/produtos.js";
import { aceitandoPedidos } from "./loja.js";

/** Junta itens repetidos e limita quantidades. */
function consolidar(itens) {
  const mapa = new Map();
  for (const { produto_id, quantidade } of itens) {
    mapa.set(produto_id, Math.min((mapa.get(produto_id) || 0) + quantidade, MAX_ITENS_POR_PRODUTO));
  }
  return [...mapa].map(([produto_id, quantidade]) => ({ produto_id, quantidade }));
}

/**
 * Confere o carrinho com o banco. Preço SEMPRE vem do banco, nunca do navegador.
 * Retorna itens válidos, subtotal e a lista de problemas encontrados.
 */
export function calcularCarrinho(itensEntrada) {
  const itens = consolidar(itensEntrada);
  const produtos = new Map(Produtos.buscarVariosPorId(itens.map((i) => i.produto_id)).map((p) => [p.id, p]));
  const resultado = [];
  const problemas = [];

  for (const { produto_id, quantidade } of itens) {
    const p = produtos.get(produto_id);
    if (!p || !p.disponivel) {
      problemas.push({ produto_id, tipo: "indisponivel", mensagem: "Produto indisponível no momento." });
      continue;
    }
    if (p.estoque <= 0) {
      problemas.push({ produto_id, tipo: "esgotado", mensagem: `${p.nome} esgotou.` });
      continue;
    }
    let qtd = quantidade;
    if (qtd > p.estoque) {
      problemas.push({
        produto_id,
        tipo: "estoque",
        mensagem: `Só temos ${p.estoque} unidade(s) de ${p.nome}.`,
        disponivel: p.estoque,
      });
      qtd = p.estoque;
    }
    resultado.push({
      produto_id: p.id,
      nome: p.nome,
      slug: p.slug,
      imagem: p.imagem,
      tamanho: p.tamanho,
      quantidade: qtd,
      estoque: p.estoque,
      preco_unitario: p.preco_final,
      preco_original: p.preco,
      subtotal: p.preco_final * qtd,
    });
  }

  const subtotal = resultado.reduce((s, i) => s + i.subtotal, 0);
  return { itens: resultado, subtotal, problemas };
}

export function calcularFrete({ tipo_entrega, bairro }) {
  if (tipo_entrega === "retirada") return 0;
  const encontrado = Bairros.encontrar(bairro);
  if (!encontrado) {
    throw requisicaoInvalida(`Ainda não entregamos no bairro "${bairro}". Escolha retirada ou fale com a gente.`);
  }
  return encontrado.taxa;
}

function gerarCodigo() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo;
  do {
    codigo = "BP-" + Array.from({ length: 6 }, () => letras[randomInt(letras.length)]).join("");
  } while (Pedidos.codigoExiste(codigo));
  return codigo;
}

/** Cria o pedido numa única transação: valida, grava itens e baixa o estoque. */
export function criarPedido(cliente, dados) {
  const config = Configuracoes.todas();
  if (!aceitandoPedidos(config)) {
    throw conflito("A loja não está recebendo pedidos agora. Confira nosso horário de funcionamento.");
  }
  if (dados.tipo_entrega === "retirada" && !config.permite_retirada) {
    throw requisicaoInvalida("A retirada no local não está disponível no momento.");
  }

  return transacao(() => {
    const carrinho = calcularCarrinho(dados.itens);
    if (carrinho.problemas.length) {
      throw new ErroHttp(409, "Alguns itens do carrinho mudaram. Revise antes de finalizar.", carrinho.problemas);
    }
    if (!carrinho.itens.length) throw requisicaoInvalida("Seu carrinho está vazio.");
    if (carrinho.subtotal < (config.pedido_minimo || 0)) {
      throw requisicaoInvalida("O pedido não atingiu o valor mínimo.", { pedido_minimo: config.pedido_minimo });
    }

    let endereco = null;
    if (dados.tipo_entrega === "entrega") {
      endereco = Enderecos.buscar(dados.endereco_id, cliente.id);
      if (!endereco) throw requisicaoInvalida("Selecione um endereço de entrega válido.");
      if (config.cidade_entrega && normalizar(endereco.cidade) !== normalizar(config.cidade_entrega)) {
        throw requisicaoInvalida(`No momento entregamos apenas em ${config.cidade_entrega}.`);
      }
    }

    const frete = calcularFrete({ tipo_entrega: dados.tipo_entrega, bairro: endereco?.bairro });
    const desconto = 0;
    const total = carrinho.subtotal + frete - desconto;

    if (dados.forma_pagamento === "dinheiro" && dados.troco_para != null && dados.troco_para < total) {
      throw requisicaoInvalida("O valor para troco precisa ser maior que o total do pedido.");
    }

    const pedidoId = Pedidos.inserir({
      codigo: gerarCodigo(),
      cliente_id: cliente.id,
      status: "aguardando_confirmacao",
      tipo_entrega: dados.tipo_entrega,
      subtotal: carrinho.subtotal,
      frete,
      desconto,
      total,
      forma_pagamento: dados.forma_pagamento,
      troco_para: dados.forma_pagamento === "dinheiro" ? dados.troco_para ?? null : null,
      observacoes: dados.observacoes || null,
      contato_nome: cliente.nome,
      contato_telefone: dados.telefone || cliente.telefone,
      entrega_cep: endereco?.cep,
      entrega_logradouro: endereco?.logradouro,
      entrega_numero: endereco?.numero,
      entrega_complemento: endereco?.complemento,
      entrega_bairro: endereco?.bairro,
      entrega_cidade: endereco?.cidade,
      entrega_estado: endereco?.estado,
      entrega_referencia: endereco?.referencia,
    });

    for (const item of carrinho.itens) {
      if (!Produtos.baixarEstoque(item.produto_id, item.quantidade)) {
        throw conflito(`O estoque de ${item.nome} acabou de mudar. Tente novamente.`);
      }
      Pedidos.inserirItem(pedidoId, {
        produto_id: item.produto_id,
        nome_produto: item.nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.subtotal,
      });
    }
    Pedidos.registrarStatus(pedidoId, null, "aguardando_confirmacao", cliente.id, "Pedido realizado pelo site");
    return detalharPedido(Pedidos.buscar(pedidoId));
  });
}

export function detalharPedido(pedido) {
  if (!pedido) return pedido;
  return { ...pedido, itens: Pedidos.itens(pedido.id), historico: Pedidos.historico(pedido.id) };
}

const SO_ENTREGA = ["saiu_para_entrega"];
const SO_RETIRADA = ["pronto_para_retirada"];

/** Muda o status, devolvendo estoque em caso de cancelamento. */
export function alterarStatus(pedidoId, novoStatus, { usuarioId, observacao } = {}) {
  return transacao(() => {
    const pedido = Pedidos.buscar(pedidoId);
    if (!pedido) throw naoEncontrado("Pedido não encontrado.");
    if (pedido.status === novoStatus) return detalharPedido(pedido);
    if (pedido.status === "cancelado") throw conflito("Pedidos cancelados não podem ser reabertos.");
    if (pedido.tipo_entrega === "retirada" && SO_ENTREGA.includes(novoStatus)) {
      throw requisicaoInvalida("Este pedido é para retirada.");
    }
    if (pedido.tipo_entrega === "entrega" && SO_RETIRADA.includes(novoStatus)) {
      throw requisicaoInvalida("Este pedido é para entrega.");
    }

    if (novoStatus === "cancelado") {
      for (const item of Pedidos.itens(pedido.id)) {
        if (item.produto_id) Produtos.devolverEstoque(item.produto_id, item.quantidade);
      }
    }
    Pedidos.atualizarStatus(pedido.id, novoStatus);
    Pedidos.registrarStatus(pedido.id, pedido.status, novoStatus, usuarioId, observacao);
    return detalharPedido(Pedidos.buscar(pedido.id));
  });
}

/** O cliente só pode cancelar enquanto a loja não confirmou. */
export function cancelarPeloCliente(pedidoId, cliente) {
  const pedido = Pedidos.buscarDoCliente(pedidoId, cliente.id);
  if (!pedido) throw naoEncontrado("Pedido não encontrado.");
  if (pedido.status !== "aguardando_confirmacao") {
    throw conflito("Este pedido já foi confirmado. Fale com a loja para cancelar.");
  }
  return alterarStatus(pedido.id, "cancelado", { usuarioId: cliente.id, observacao: "Cancelado pelo cliente" });
}

export const pedidoEstaAberto = (pedido) => !STATUS_FINAIS.includes(pedido.status);
