import { db } from "../config/database.js";

export const Depoimentos = {
  listarAprovados({ produto_id, limite = 12 } = {}) {
    const where = ["d.aprovado = 1"];
    const params = [];
    if (produto_id) {
      where.push("d.produto_id = ?");
      params.push(produto_id);
    }
    return db()
      .prepare(
        `SELECT d.id, d.nome_exibicao, d.cidade, d.nota, d.texto, d.criado_em, d.exemplo,
                p.nome AS produto_nome, p.slug AS produto_slug
           FROM depoimentos d LEFT JOIN produtos p ON p.id = d.produto_id
          WHERE ${where.join(" AND ")} ORDER BY d.id DESC LIMIT ?`
      )
      .all(...params, limite);
  },

  listarAdmin({ aprovado } = {}) {
    const filtro = aprovado === undefined ? "" : "WHERE d.aprovado = ?";
    const params = aprovado === undefined ? [] : [aprovado ? 1 : 0];
    return db()
      .prepare(
        `SELECT d.*, p.nome AS produto_nome, c.email AS cliente_email, pe.codigo AS pedido_codigo
           FROM depoimentos d
           LEFT JOIN produtos p ON p.id = d.produto_id
           LEFT JOIN clientes c ON c.id = d.cliente_id
           LEFT JOIN pedidos pe ON pe.id = d.pedido_id
           ${filtro} ORDER BY d.aprovado, d.id DESC`
      )
      .all(...params);
  },

  buscar(id) {
    return db().prepare("SELECT * FROM depoimentos WHERE id = ?").get(id);
  },

  jaAvaliou(pedido_id, produto_id) {
    return !!db().prepare("SELECT 1 FROM depoimentos WHERE pedido_id = ? AND produto_id IS ?").get(pedido_id, produto_id ?? null);
  },

  criar({ cliente_id = null, produto_id = null, pedido_id = null, nome_exibicao, cidade, nota, texto, aprovado = false, exemplo = false }) {
    const r = db()
      .prepare(
        `INSERT INTO depoimentos (cliente_id, produto_id, pedido_id, nome_exibicao, cidade, nota, texto, aprovado, exemplo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(cliente_id, produto_id, pedido_id, nome_exibicao, cidade || null, nota, texto, aprovado ? 1 : 0, exemplo ? 1 : 0);
    return this.buscar(r.lastInsertRowid);
  },

  atualizar(id, { nome_exibicao, cidade, nota, texto, aprovado, produto_id }) {
    db()
      .prepare(
        `UPDATE depoimentos SET nome_exibicao = ?, cidade = ?, nota = ?, texto = ?, aprovado = ?, produto_id = ? WHERE id = ?`
      )
      .run(nome_exibicao, cidade || null, nota, texto, aprovado ? 1 : 0, produto_id ?? null, id);
    return this.buscar(id);
  },

  definirAprovado(id, aprovado) {
    db().prepare("UPDATE depoimentos SET aprovado = ? WHERE id = ?").run(aprovado ? 1 : 0, id);
    return this.buscar(id);
  },

  remover(id) {
    return db().prepare("DELETE FROM depoimentos WHERE id = ?").run(id).changes > 0;
  },

  contarPendentes() {
    return db().prepare("SELECT COUNT(*) n FROM depoimentos WHERE aprovado = 0").get().n;
  },

  doCliente(cliente_id) {
    return db()
      .prepare("SELECT pedido_id, produto_id, aprovado FROM depoimentos WHERE cliente_id = ?")
      .all(cliente_id);
  },
};
