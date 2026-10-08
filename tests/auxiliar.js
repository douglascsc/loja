// Configura um ambiente isolado para os testes: banco em memória e pasta de uploads temporária.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.BCRYPT_COST = "4";
process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), "bolo-uploads-"));

const { default: request } = await import("supertest");
const { criarApp } = await import("../backend/app.js");
const { semear } = await import("../database/seed.js");
const { Clientes } = await import("../backend/models/clientes.js");
const { hashSenha } = await import("../backend/services/senha.js");
const { Configuracoes } = await import("../backend/models/configuracoes.js");

await semear({ demo: false, log: () => {} });
// Testes não dependem do relógio: a loja aceita pedidos sempre.
Configuracoes.salvar({ modo_funcionamento: "aberta" });

export const app = criarApp();

/** Agente com cookies + token CSRF já configurado. */
export async function novoAgente() {
  const agente = request.agent(app);
  const r = await agente.get("/api/csrf");
  const token = r.body.token;
  const comToken = (metodo) => (url) => agente[metodo](url).set("X-CSRF-Token", token);
  return {
    agente,
    token,
    get: (url) => agente.get(url),
    post: comToken("post"),
    put: comToken("put"),
    patch: comToken("patch"),
    delete: comToken("delete"),
  };
}

let contador = 0;
export async function clienteLogado(extra = {}) {
  const a = await novoAgente();
  const email = `cliente${++contador}-${Date.now()}@teste.com`;
  const r = await a.post("/api/auth/cadastro").send({
    nome: "Cliente Teste",
    email,
    telefone: "51999998888",
    senha: "senha1234",
    aceite_termos: true,
    ...extra,
  });
  if (r.status !== 201) throw new Error("cadastro falhou: " + JSON.stringify(r.body));
  return { ...a, email, cliente: r.body.cliente };
}

export async function adminLogado() {
  const email = `admin${++contador}@teste.com`;
  Clientes.criar({ nome: "Admin", email, senha_hash: await hashSenha("admin12345"), papel: "admin" });
  const a = await novoAgente();
  const r = await a.post("/api/auth/login").send({ email, senha: "admin12345" });
  if (r.status !== 200) throw new Error("login admin falhou");
  return a;
}

export const ENDERECO_CAMPO_BOM = {
  cep: "93700-000",
  logradouro: "Rua Teste",
  numero: "123",
  bairro: "Centro",
  cidade: "Campo Bom",
  estado: "rs",
};
