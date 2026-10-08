import { naoEncontrado } from "../lib/erros.js";
import { Depoimentos } from "../models/depoimentos.js";
import { Pedidos } from "../models/pedidos.js";
import { cancelarPeloCliente, criarPedido, detalharPedido } from "../services/pedidos.js";

export function listar(req, res) {
  res.json({ ok: true, pedidos: Pedidos.listarDoCliente(req.cliente.id) });
}

export function buscar(req, res) {
  const pedido = Pedidos.buscarDoCliente(Number(req.params.id), req.cliente.id);
  if (!pedido) throw naoEncontrado("Pedido não encontrado.");
  const avaliados = Depoimentos.doCliente(req.cliente.id)
    .filter((d) => d.pedido_id === pedido.id)
    .map((d) => d.produto_id);
  res.json({ ok: true, pedido: { ...detalharPedido(pedido), produtos_avaliados: avaliados } });
}

export function criar(req, res) {
  const pedido = criarPedido(req.cliente, req.dados);
  res.status(201).json({ ok: true, pedido });
}

export function cancelar(req, res) {
  res.json({ ok: true, pedido: cancelarPeloCliente(Number(req.params.id), req.cliente) });
}
