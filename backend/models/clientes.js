import { db } from "../config/database.js";

// Colunas seguras para expor (nunca inclui senha_hash).
const PUBLICAS = "id, nome, email, telefone, papel, ativo, criado_em";

export const Clientes = {
  buscarPorId(id) {
    return db().prepare(`SELECT ${PUBLICAS} FROM clientes WHERE id = ?`).get(id);
  },

  /** Inclui senha_hash: uso exclusivo do login. */
  buscarParaLogin(email) {
    return db().prepare(`SELECT ${PUBLICAS}, senha_hash FROM clientes WHERE email = ?`).get(email);
  },

  buscarHash(id) {
    return db().prepare("SELECT senha_hash FROM clientes WHERE id = ?").get(id)?.senha_hash;
  },

  emailExiste(email, exceto = 0) {
    return !!db().prepare("SELECT 1 FROM clientes WHERE email = ? AND id <> ?").get(email, exceto);
  },

  criar({ nome, email, telefone, senha_hash, papel = "cliente" }) {
    const r = db()
      .prepare("INSERT INTO clientes (nome, email, telefone, senha_hash, papel) VALUES (?, ?, ?, ?, ?)")
      .run(nome, email, telefone || null, senha_hash, papel);
    return this.buscarPorId(r.lastInsertRowid);
  },

  atualizarDados(id, { nome, email, telefone }) {
    db()
      .prepare("UPDATE clientes SET nome = ?, email = ?, telefone = ?, atualizado_em = datetime('now') WHERE id = ?")
      .run(nome, email, telefone || null, id);
    return this.buscarPorId(id);
  },

  atualizarSenha(id, senha_hash) {
    db().prepare("UPDATE clientes SET senha_hash = ?, atualizado_em = datetime('now') WHERE id = ?").run(senha_hash, id);
  },

  definirPapel(id, papel) {
    db().prepare("UPDATE clientes SET papel = ?, atualizado_em = datetime('now') WHERE id = ?").run(papel, id);
  },

  definirAtivo(id, ativo) {
    db().prepare("UPDATE clientes SET ativo = ?, atualizado_em = datetime('now') WHERE id = ?").run(ativo ? 1 : 0, id);
  },

  /** Listagem do admin com totais de pedidos. */
  listar({ busca = "", limite = 50, deslocamento = 0 } = {}) {
    const termo = `%${busca}%`;
    const filtro = "WHERE (c.nome LIKE ? OR c.email LIKE ? OR IFNULL(c.telefone, '') LIKE ?)";
    const itens = db()
      .prepare(
        `SELECT c.id, c.nome, c.email, c.telefone, c.papel, c.ativo, c.criado_em,
                COUNT(p.id) AS total_pedidos,
                IFNULL(SUM(CASE WHEN p.status <> 'cancelado' THEN p.total END), 0) AS total_gasto,
                MAX(p.criado_em) AS ultimo_pedido
           FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id
           ${filtro}
          GROUP BY c.id ORDER BY c.criado_em DESC LIMIT ? OFFSET ?`
      )
      .all(termo, termo, termo, limite, deslocamento);
    const total = db().prepare(`SELECT COUNT(*) n FROM clientes c ${filtro}`).get(termo, termo, termo).n;
    return { itens, total };
  },

  contar() {
    return db().prepare("SELECT COUNT(*) n FROM clientes WHERE papel = 'cliente'").get().n;
  },
};
