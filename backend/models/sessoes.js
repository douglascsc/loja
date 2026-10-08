import { db } from "../config/database.js";

export const Sessoes = {
  criar({ id, cliente_id, dias, ip, user_agent }) {
    db()
      .prepare(
        `INSERT INTO sessoes (id, cliente_id, expira_em, ip, user_agent)
         VALUES (?, ?, datetime('now', ?), ?, ?)`
      )
      .run(id, cliente_id, `+${dias} days`, ip || null, (user_agent || "").slice(0, 255));
  },

  /** Retorna o cliente da sessão, se válida, ativa e não expirada. */
  buscarCliente(id) {
    return db()
      .prepare(
        `SELECT c.id, c.nome, c.email, c.telefone, c.papel, c.ativo, c.criado_em
           FROM sessoes s JOIN clientes c ON c.id = s.cliente_id
          WHERE s.id = ? AND s.expira_em > datetime('now') AND c.ativo = 1`
      )
      .get(id);
  },

  remover(id) {
    db().prepare("DELETE FROM sessoes WHERE id = ?").run(id);
  },

  removerDoCliente(cliente_id, excetoId = "") {
    db().prepare("DELETE FROM sessoes WHERE cliente_id = ? AND id <> ?").run(cliente_id, excetoId);
  },

  limparExpiradas() {
    return db().prepare("DELETE FROM sessoes WHERE expira_em <= datetime('now')").run().changes;
  },
};
