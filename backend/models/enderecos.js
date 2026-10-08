import { db, transacao } from "../config/database.js";

const CAMPOS = ["apelido", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "estado", "referencia"];

export const Enderecos = {
  listar(cliente_id) {
    return db()
      .prepare("SELECT * FROM enderecos WHERE cliente_id = ? ORDER BY principal DESC, id DESC")
      .all(cliente_id);
  },

  buscar(id, cliente_id) {
    return db().prepare("SELECT * FROM enderecos WHERE id = ? AND cliente_id = ?").get(id, cliente_id);
  },

  contar(cliente_id) {
    return db().prepare("SELECT COUNT(*) n FROM enderecos WHERE cliente_id = ?").get(cliente_id).n;
  },

  criar(cliente_id, dados) {
    return transacao(() => {
      const principal = dados.principal || this.contar(cliente_id) === 0;
      if (principal) this.limparPrincipal(cliente_id);
      const r = db()
        .prepare(
          `INSERT INTO enderecos (cliente_id, ${CAMPOS.join(", ")}, principal)
           VALUES (?, ${CAMPOS.map(() => "?").join(", ")}, ?)`
        )
        .run(cliente_id, ...CAMPOS.map((c) => dados[c] ?? null), principal ? 1 : 0);
      return this.buscar(r.lastInsertRowid, cliente_id);
    });
  },

  atualizar(id, cliente_id, dados) {
    return transacao(() => {
      if (dados.principal) this.limparPrincipal(cliente_id);
      db()
        .prepare(
          `UPDATE enderecos SET ${CAMPOS.map((c) => `${c} = ?`).join(", ")},
                  principal = CASE WHEN ? THEN 1 ELSE principal END
            WHERE id = ? AND cliente_id = ?`
        )
        .run(...CAMPOS.map((c) => dados[c] ?? null), dados.principal ? 1 : 0, id, cliente_id);
      return this.buscar(id, cliente_id);
    });
  },

  remover(id, cliente_id) {
    return transacao(() => {
      const atual = this.buscar(id, cliente_id);
      if (!atual) return false;
      db().prepare("DELETE FROM enderecos WHERE id = ? AND cliente_id = ?").run(id, cliente_id);
      if (atual.principal) {
        db()
          .prepare(
            `UPDATE enderecos SET principal = 1
              WHERE id = (SELECT id FROM enderecos WHERE cliente_id = ? ORDER BY id DESC LIMIT 1)`
          )
          .run(cliente_id);
      }
      return true;
    });
  },

  limparPrincipal(cliente_id) {
    db().prepare("UPDATE enderecos SET principal = 0 WHERE cliente_id = ?").run(cliente_id);
  },
};
