import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { adminLogado, app, clienteLogado } from "./auxiliar.js";

describe("Páginas HTML", () => {
  for (const url of ["/", "/produtos", "/produtos/kits", "/produto/red-velvet", "/login", "/cadastro", "/termos", "/privacidade"]) {
    it(`renderiza ${url} sem marcadores de template pendentes`, async () => {
      const r = await request(app).get(url);
      assert.equal(r.status, 200);
      assert.match(r.headers["content-type"], /html/);
      assert.doesNotMatch(r.text, /\{\{|@include/);
      assert.match(r.text, /<title>[^<]+<\/title>/);
      assert.match(r.text, /<meta name="description" content="[^"]+"/);
      assert.match(r.text, /<main id="conteudo"/);
    });
  }

  it("página de produto traz Open Graph e JSON-LD do produto", async () => {
    const r = await request(app).get("/produto/red-velvet");
    assert.match(r.text, /<title>Red Velvet \|/);
    assert.match(r.text, /property="og:type" content="product"/);
    assert.match(r.text, /"@type":"Product"/);
    assert.match(r.text, /"priceCurrency":"BRL"/);
  });

  it("home traz dados estruturados da confeitaria", async () => {
    const r = await request(app).get("/");
    assert.match(r.text, /"@type":"Bakery"/);
  });

  it("produto ou categoria inexistente devolve 404 em HTML", async () => {
    assert.equal((await request(app).get("/produto/nao-existe")).status, 404);
    assert.equal((await request(app).get("/produtos/nao-existe")).status, 404);
    const r = await request(app).get("/qualquer-coisa");
    assert.equal(r.status, 404);
    assert.match(r.text, /não existe/);
  });

  it("áreas privadas exigem login e não são indexadas", async () => {
    for (const url of ["/conta", "/checkout", "/conta/pedidos/1"]) {
      const r = await request(app).get(url);
      assert.equal(r.status, 302);
      assert.equal(r.headers.location, `/login?voltar=${encodeURIComponent(url)}`);
    }
    const c = await clienteLogado();
    const conta = await c.get("/conta");
    assert.equal(conta.status, 200);
    assert.match(conta.text, /noindex/);
  });

  it("admin acessa todas as páginas do painel", async () => {
    const a = await adminLogado();
    for (const pagina of ["", "/pedidos", "/produtos", "/clientes", "/depoimentos", "/mensagens", "/configuracoes"]) {
      const r = await a.get(`/admin${pagina}`);
      assert.equal(r.status, 200, pagina);
      assert.doesNotMatch(r.text, /\{\{|@include/);
    }
    assert.equal((await a.get("/admin/inexistente")).status, 404);
  });

  it("não expõe arquivos-fonte nem HTML de template diretamente", async () => {
    assert.equal((await request(app).get("/index.html")).status, 404);
    assert.equal((await request(app).get("/partials/head.html")).status, 404);
    assert.equal((await request(app).get("/css/../../.env")).status, 404);
    // visitante é mandado ao login antes de qualquer coisa do painel
    assert.equal((await request(app).get("/admin/index.html")).status, 302);
  });

  it("healthcheck responde", async () => {
    assert.equal((await request(app).get("/api/saude")).body.ok, true);
  });
});
