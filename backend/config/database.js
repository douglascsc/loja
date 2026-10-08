import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { env, RAIZ } from "./env.js";

let conexao;

export function abrirBanco(caminho = env.caminhoBanco) {
  if (caminho !== ":memory:") mkdirSync(path.dirname(caminho), { recursive: true });
  const db = new Database(caminho);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(readFileSync(path.join(RAIZ, "database", "schema.sql"), "utf8"));
  return db;
}

export function db() {
  if (!conexao) conexao = abrirBanco();
  return conexao;
}

/** Usado pelos testes para trocar o banco por um em memória. */
export function definirBanco(novo) {
  conexao = novo;
}

/** Executa fn dentro de uma transação (rollback automático em erro). */
export function transacao(fn) {
  return db().transaction(fn)();
}
