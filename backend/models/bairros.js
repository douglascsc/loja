import { db } from "../config/database.js";
import { normalizar } from "../lib/texto.js";

export const Bairros = {
  listar({ incluirInativos = false } = {}) {
    return db()
      .prepare(`SELECT * FROM bairros_entrega ${incluirInativos ? "" : "WHERE ativo = 1"} ORDER BY nome`)
      .all();
  },

  /** Encontra o bairro ignorando acentos e caixa. */
  encontrar(nome, { incluirInativos = false } = {}) {
    const alvo = normalizar(nome);
    return this.listar({ incluirInativos }).find((b) => normalizar(b.nome) === alvo);
  },

  buscar(id) {
    return db().prepare("SELECT * FROM bairros_entrega WHERE id = ?").get(id);
  },

  criar({ nome, taxa, ativo = true }) {
    const r = db().prepare("INSERT INTO bairros_entrega (nome, taxa, ativo) VALUES (?, ?, ?)").run(nome, taxa, ativo ? 1 : 0);
    return this.buscar(r.lastInsertRowid);
  },

  atualizar(id, { nome, taxa, ativo = true }) {
    db().prepare("UPDATE bairros_entrega SET nome = ?, taxa = ?, ativo = ? WHERE id = ?").run(nome, taxa, ativo ? 1 : 0, id);
    return this.buscar(id);
  },

  remover(id) {
    return db().prepare("DELETE FROM bairros_entrega WHERE id = ?").run(id).changes > 0;
  },
};
