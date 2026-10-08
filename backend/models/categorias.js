import { db } from "../config/database.js";

export const Categorias = {
  listar({ incluirInativas = false } = {}) {
    return db()
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id) AS total_produtos
           FROM categorias c ${incluirInativas ? "" : "WHERE c.ativo = 1"}
          ORDER BY c.ordem, c.nome`
      )
      .all();
  },

  buscar(id) {
    return db().prepare("SELECT * FROM categorias WHERE id = ?").get(id);
  },

  buscarPorSlug(slug) {
    return db().prepare("SELECT * FROM categorias WHERE slug = ? AND ativo = 1").get(slug);
  },

  slugExiste(slug, exceto = 0) {
    return !!db().prepare("SELECT 1 FROM categorias WHERE slug = ? AND id <> ?").get(slug, exceto);
  },

  criar({ nome, slug, descricao, ordem = 0, ativo = true }) {
    const r = db()
      .prepare("INSERT INTO categorias (nome, slug, descricao, ordem, ativo) VALUES (?, ?, ?, ?, ?)")
      .run(nome, slug, descricao || null, ordem, ativo ? 1 : 0);
    return this.buscar(r.lastInsertRowid);
  },

  atualizar(id, { nome, slug, descricao, ordem = 0, ativo = true }) {
    db()
      .prepare("UPDATE categorias SET nome = ?, slug = ?, descricao = ?, ordem = ?, ativo = ? WHERE id = ?")
      .run(nome, slug, descricao || null, ordem, ativo ? 1 : 0, id);
    return this.buscar(id);
  },

  remover(id) {
    return db().prepare("DELETE FROM categorias WHERE id = ?").run(id).changes > 0;
  },
};
