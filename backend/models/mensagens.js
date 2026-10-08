import { db } from "../config/database.js";

export const Mensagens = {
  criar({ nome, email, telefone, mensagem, ip }) {
    const r = db()
      .prepare("INSERT INTO mensagens_contato (nome, email, telefone, mensagem, ip) VALUES (?, ?, ?, ?, ?)")
      .run(nome, email, telefone || null, mensagem, ip || null);
    return r.lastInsertRowid;
  },

  listar({ apenasNaoLidas = false } = {}) {
    return db()
      .prepare(
        `SELECT id, nome, email, telefone, mensagem, lida, criado_em FROM mensagens_contato
          ${apenasNaoLidas ? "WHERE lida = 0" : ""} ORDER BY id DESC LIMIT 200`
      )
      .all();
  },

  definirLida(id, lida) {
    return db().prepare("UPDATE mensagens_contato SET lida = ? WHERE id = ?").run(lida ? 1 : 0, id).changes > 0;
  },

  remover(id) {
    return db().prepare("DELETE FROM mensagens_contato WHERE id = ?").run(id).changes > 0;
  },

  contarNaoLidas() {
    return db().prepare("SELECT COUNT(*) n FROM mensagens_contato WHERE lida = 0").get().n;
  },
};
