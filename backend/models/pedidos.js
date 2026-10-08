import { db } from "../config/database.js";
import { OFFSET_SQL } from "../config/constantes.js";

const CAMPOS_PEDIDO = [
  "codigo", "cliente_id", "status", "tipo_entrega", "subtotal", "frete", "desconto", "total",
  "forma_pagamento", "troco_para", "observacoes", "contato_nome", "contato_telefone",
  "entrega_cep", "entrega_logradouro", "entrega_numero", "entrega_complemento",
  "entrega_bairro", "entrega_cidade", "entrega_estado", "entrega_referencia",
];

export const Pedidos = {
  inserir(dados) {
    const r = db()
      .prepare(`INSERT INTO pedidos (${CAMPOS_PEDIDO.join(", ")}) VALUES (${CAMPOS_PEDIDO.map(() => "?").join(", ")})`)
      .run(...CAMPOS_PEDIDO.map((c) => dados[c] ?? null));
    return r.lastInsertRowid;
  },

  inserirItem(pedido_id, { produto_id, nome_produto, quantidade, preco_unitario, subtotal }) {
    db()
      .prepare(
        `INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(pedido_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal);
  },

  registrarStatus(pedido_id, status_anterior, status_novo, alterado_por, observacao) {
    db()
      .prepare(
        `INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, alterado_por, observacao)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(pedido_id, status_anterior, status_novo, alterado_por ?? null, observacao || null);
  },

  atualizarStatus(id, status) {
    db().prepare("UPDATE pedidos SET status = ?, atualizado_em = datetime('now') WHERE id = ?").run(status, id);
  },

  codigoExiste(codigo) {
    return !!db().prepare("SELECT 1 FROM pedidos WHERE codigo = ?").get(codigo);
  },

  buscar(id) {
    return db().prepare("SELECT * FROM pedidos WHERE id = ?").get(id);
  },

  buscarDoCliente(id, cliente_id) {
    return db().prepare("SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?").get(id, cliente_id);
  },

  itens(pedido_id) {
    return db()
      .prepare(
        `SELECT i.*, p.slug AS produto_slug, p.imagem AS produto_imagem
           FROM itens_pedido i LEFT JOIN produtos p ON p.id = i.produto_id
          WHERE i.pedido_id = ? ORDER BY i.id`
      )
      .all(pedido_id);
  },

  historico(pedido_id) {
    return db()
      .prepare(
        `SELECT h.status_anterior, h.status_novo, h.observacao, h.criado_em, c.nome AS alterado_por_nome
           FROM pedido_status_historico h LEFT JOIN clientes c ON c.id = h.alterado_por
          WHERE h.pedido_id = ? ORDER BY h.id`
      )
      .all(pedido_id);
  },

  listarDoCliente(cliente_id) {
    return db()
      .prepare(
        `SELECT p.id, p.codigo, p.status, p.tipo_entrega, p.total, p.forma_pagamento, p.criado_em,
                (SELECT SUM(quantidade) FROM itens_pedido i WHERE i.pedido_id = p.id) AS total_itens
           FROM pedidos p WHERE p.cliente_id = ? ORDER BY p.id DESC`
      )
      .all(cliente_id);
  },

  listarAdmin({ status, busca = "", limite = 50, deslocamento = 0 } = {}) {
    const where = ["(p.codigo LIKE ? OR c.nome LIKE ? OR c.email LIKE ?)"];
    const termo = `%${busca}%`;
    const params = [termo, termo, termo];
    if (status) {
      where.push("p.status = ?");
      params.push(status);
    }
    const sqlWhere = `WHERE ${where.join(" AND ")}`;
    const itens = db()
      .prepare(
        `SELECT p.id, p.codigo, p.status, p.tipo_entrega, p.total, p.forma_pagamento, p.criado_em,
                p.entrega_bairro, c.id AS cliente_id, c.nome AS cliente_nome, c.email AS cliente_email,
                (SELECT SUM(quantidade) FROM itens_pedido i WHERE i.pedido_id = p.id) AS total_itens
           FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
           ${sqlWhere} ORDER BY p.id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limite, deslocamento);
    const total = db()
      .prepare(`SELECT COUNT(*) n FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ${sqlWhere}`)
      .get(...params).n;
    return { itens, total };
  },

  // ---------- Métricas do dashboard (datas no fuso de Brasília) ----------
  resumoVendas() {
    return db()
      .prepare(
        `SELECT
           IFNULL(SUM(CASE WHEN date(criado_em, '${OFFSET_SQL}') = date('now', '${OFFSET_SQL}') THEN total END), 0) AS hoje,
           COUNT(CASE WHEN date(criado_em, '${OFFSET_SQL}') = date('now', '${OFFSET_SQL}') THEN 1 END) AS pedidos_hoje,
           IFNULL(SUM(CASE WHEN strftime('%Y-%m', criado_em, '${OFFSET_SQL}') = strftime('%Y-%m', 'now', '${OFFSET_SQL}') THEN total END), 0) AS mes,
           COUNT(CASE WHEN strftime('%Y-%m', criado_em, '${OFFSET_SQL}') = strftime('%Y-%m', 'now', '${OFFSET_SQL}') THEN 1 END) AS pedidos_mes,
           IFNULL(SUM(total), 0) AS geral,
           COUNT(*) AS pedidos_geral
         FROM pedidos WHERE status <> 'cancelado'`
      )
      .get();
  },

  contarPorStatus() {
    return db().prepare("SELECT status, COUNT(*) n FROM pedidos GROUP BY status").all();
  },

  vendasPorDia(dias = 14) {
    return db()
      .prepare(
        `SELECT date(criado_em, '${OFFSET_SQL}') AS dia, SUM(total) AS total, COUNT(*) AS pedidos
           FROM pedidos
          WHERE status <> 'cancelado'
            AND date(criado_em, '${OFFSET_SQL}') > date('now', '${OFFSET_SQL}', ?)
          GROUP BY dia ORDER BY dia`
      )
      .all(`-${dias} days`);
  },

  maisVendidos(limite = 5) {
    return db()
      .prepare(
        `SELECT i.nome_produto AS nome, SUM(i.quantidade) AS quantidade, SUM(i.subtotal) AS total
           FROM itens_pedido i JOIN pedidos p ON p.id = i.pedido_id
          WHERE p.status <> 'cancelado'
          GROUP BY COALESCE(i.produto_id, i.nome_produto) ORDER BY quantidade DESC LIMIT ?`
      )
      .all(limite);
  },
};
