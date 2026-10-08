import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminLogado, app, clienteLogado, ENDERECO_CAMPO_BOM, novoAgente } from "./auxiliar.js";
import request from "supertest";
import { Produtos } from "../backend/models/produtos.js";

describe("Produtos (público)", () => {
  it("lista produtos vindos do banco", async () => {
    const r = await request(app).get("/api/produtos");
    assert.equal(r.status, 200);
    assert.ok(r.body.produtos.length >= 10);
    const p = r.body.produtos[0];
    assert.ok(p.slug && Number.isInteger(p.preco_final));
    assert.equal(p.senha_hash, undefined);
  });

  it("filtra por categoria e destaque", async () => {
    const kits = await request(app).get("/api/produtos?categoria=kits");
    assert.ok(kits.body.produtos.every((p) => p.categoria.slug === "kits"));
    const destaques = await request(app).get("/api/produtos?destaque=1");
    assert.ok(destaques.body.produtos.every((p) => p.destaque));
  });

  it("busca produto por slug e devolve 404 para inexistente", async () => {
    const r = await request(app).get("/api/produtos/red-velvet");
    assert.equal(r.status, 200);
    assert.equal(r.body.produto.nome, "Red Velvet");
    assert.equal((await request(app).get("/api/produtos/nao-existe")).status, 404);
  });

  it("informa a situação da loja sem dados sensíveis", async () => {
    const r = await request(app).get("/api/loja");
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.loja.aberta, "boolean");
    assert.equal(r.body.loja.nome_loja, "O MELHOR BOLO DE POTE");
  });
});

describe("Segurança", () => {
  it("bloqueia POST sem token CSRF", async () => {
    const r = await request(app).post("/api/auth/login").send({ email: "a@a.com", senha: "x" });
    assert.equal(r.status, 403);
  });

  it("bloqueia token CSRF forjado", async () => {
    const a = await novoAgente();
    const r = await a.agente.post("/api/auth/login").set("X-CSRF-Token", "0".repeat(64)).send({ email: "a@a.com", senha: "x" });
    assert.equal(r.status, 403);
  });

  it("envia cabeçalhos de segurança (CSP, nosniff, frame)", async () => {
    const r = await request(app).get("/");
    assert.match(r.headers["content-security-policy"], /script-src 'self'/);
    assert.equal(r.headers["x-content-type-options"], "nosniff");
    assert.equal(r.headers["x-powered-by"], undefined);
  });

  it("rotas admin exigem login e papel de admin", async () => {
    assert.equal((await request(app).get("/api/admin/dashboard")).status, 401);
    const c = await clienteLogado();
    assert.equal((await c.get("/api/admin/dashboard")).status, 403);
    assert.equal((await c.get("/api/admin/clientes")).status, 403);
  });

  it("página /admin redireciona visitante e cliente comum", async () => {
    const r = await request(app).get("/admin");
    assert.equal(r.status, 302);
    assert.match(r.headers.location, /^\/login/);
    const c = await clienteLogado();
    const r2 = await c.get("/admin/produtos");
    assert.equal(r2.status, 302);
    assert.equal(r2.headers.location, "/conta");
  });

  it("parâmetros com SQL injection não quebram a consulta", async () => {
    const r = await request(app).get("/api/produtos?busca=" + encodeURIComponent("' OR 1=1; DROP TABLE produtos; --"));
    assert.equal(r.status, 200);
    assert.equal(r.body.produtos.length, 0);
    assert.ok((await request(app).get("/api/produtos")).body.produtos.length > 0);
  });
});

describe("Autenticação", () => {
  it("cadastra, devolve sessão e nunca expõe o hash", async () => {
    const c = await clienteLogado();
    assert.equal(c.cliente.senha_hash, undefined);
    const me = await c.get("/api/cliente/me");
    assert.equal(me.body.logado, true);
    assert.equal(me.body.cliente.email, c.email);
  });

  it("cookie de sessão é httpOnly e SameSite", async () => {
    const a = await novoAgente();
    const r = await a.post("/api/auth/cadastro").send({
      nome: "Cookie", email: `cookie${Date.now()}@teste.com`, senha: "senha1234", aceite_termos: true,
    });
    const cookie = r.headers["set-cookie"].find((c) => c.startsWith("sid="));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  });

  it("recusa e-mail duplicado e senha fraca", async () => {
    const c = await clienteLogado();
    const a = await novoAgente();
    const dup = await a.post("/api/auth/cadastro").send({ nome: "Xy", email: c.email.toUpperCase(), senha: "senha1234", aceite_termos: true });
    assert.equal(dup.status, 409);
    const fraca = await a.post("/api/auth/cadastro").send({ nome: "Xy", email: "fraca@teste.com", senha: "123", aceite_termos: true });
    assert.equal(fraca.status, 400);
  });

  it("login com senha errada falha com mensagem genérica", async () => {
    const c = await clienteLogado();
    const a = await novoAgente();
    const r = await a.post("/api/auth/login").send({ email: c.email, senha: "errada123" });
    assert.equal(r.status, 401);
    const r2 = await a.post("/api/auth/login").send({ email: "naoexiste@teste.com", senha: "errada123" });
    assert.equal(r2.body.erro, r.body.erro);
  });

  it("logout encerra a sessão", async () => {
    const c = await clienteLogado();
    await c.post("/api/auth/logout");
    assert.equal((await c.get("/api/cliente/me")).body.logado, false);
    assert.equal((await c.get("/api/pedidos")).status, 401);
  });

  it("troca de senha exige a senha atual", async () => {
    const c = await clienteLogado();
    assert.equal((await c.put("/api/cliente/senha").send({ senha_atual: "errada", nova_senha: "nova12345" })).status, 400);
    assert.equal((await c.put("/api/cliente/senha").send({ senha_atual: "senha1234", nova_senha: "nova12345" })).status, 200);
    const a = await novoAgente();
    assert.equal((await a.post("/api/auth/login").send({ email: c.email, senha: "nova12345" })).status, 200);
  });
});

describe("Endereços", () => {
  it("CRUD apenas dos próprios endereços", async () => {
    const c1 = await clienteLogado();
    const c2 = await clienteLogado();
    const criado = await c1.post("/api/cliente/enderecos").send(ENDERECO_CAMPO_BOM);
    assert.equal(criado.status, 201);
    assert.equal(criado.body.endereco.cep, "93700000");
    assert.equal(criado.body.endereco.estado, "RS");
    assert.equal(criado.body.endereco.principal, 1);
    const id = criado.body.endereco.id;
    // Outro cliente não vê nem altera.
    assert.equal((await c2.put(`/api/cliente/enderecos/${id}`).send(ENDERECO_CAMPO_BOM)).status, 404);
    assert.equal((await c2.delete(`/api/cliente/enderecos/${id}`)).status, 404);
    assert.equal((await c1.delete(`/api/cliente/enderecos/${id}`)).status, 200);
  });
});

describe("Carrinho e pedidos", () => {
  const produto = () => Produtos.buscarPublicoPorSlug("brigadeiro-tradicional");

  it("valida o carrinho com preço do banco", async () => {
    const a = await novoAgente();
    const p = produto();
    const r = await a.post("/api/carrinho/validar").send({ itens: [{ produto_id: p.id, quantidade: 2 }, { produto_id: 99999, quantidade: 1 }] });
    assert.equal(r.status, 200);
    assert.equal(r.body.subtotal, p.preco_final * 2);
    assert.equal(r.body.problemas[0].tipo, "indisponivel");
  });

  it("pedido exige login", async () => {
    const a = await novoAgente();
    const r = await a.post("/api/pedidos").send({ itens: [{ produto_id: 1, quantidade: 1 }], tipo_entrega: "retirada", forma_pagamento: "pix" });
    assert.equal(r.status, 401);
  });

  it("cria pedido com entrega: recalcula preço, frete e baixa estoque", async () => {
    const c = await clienteLogado();
    const end = (await c.post("/api/cliente/enderecos").send(ENDERECO_CAMPO_BOM)).body.endereco;
    const antes = produto();
    const r = await c.post("/api/pedidos").send({
      // preco enviado pelo navegador é ignorado
      itens: [{ produto_id: antes.id, quantidade: 3, preco: 1 }],
      tipo_entrega: "entrega",
      endereco_id: end.id,
      forma_pagamento: "dinheiro",
      troco_para: 10000,
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const ped = r.body.pedido;
    assert.equal(ped.subtotal, antes.preco_final * 3);
    assert.equal(ped.frete, 500); // Centro
    assert.equal(ped.total, ped.subtotal + ped.frete);
    assert.equal(ped.status, "aguardando_confirmacao");
    assert.match(ped.codigo, /^BP-[A-Z0-9]{6}$/);
    assert.equal(ped.entrega_bairro, "Centro");
    assert.equal(produto().estoque, antes.estoque - 3);

    const lista = await c.get("/api/pedidos");
    assert.equal(lista.body.pedidos.length, 1);
  });

  it("recusa bairro sem entrega e cidade diferente", async () => {
    const c = await clienteLogado();
    const fora = (await c.post("/api/cliente/enderecos").send({ ...ENDERECO_CAMPO_BOM, bairro: "Inexistente" })).body.endereco;
    const r = await c.post("/api/pedidos").send({ itens: [{ produto_id: produto().id, quantidade: 1 }], tipo_entrega: "entrega", endereco_id: fora.id, forma_pagamento: "pix" });
    assert.equal(r.status, 400);
    const outra = (await c.post("/api/cliente/enderecos").send({ ...ENDERECO_CAMPO_BOM, cidade: "Novo Hamburgo" })).body.endereco;
    const r2 = await c.post("/api/pedidos").send({ itens: [{ produto_id: produto().id, quantidade: 1 }], tipo_entrega: "entrega", endereco_id: outra.id, forma_pagamento: "pix" });
    assert.equal(r2.status, 400);
  });

  it("não permite usar endereço de outro cliente", async () => {
    const c1 = await clienteLogado();
    const c2 = await clienteLogado();
    const end = (await c1.post("/api/cliente/enderecos").send(ENDERECO_CAMPO_BOM)).body.endereco;
    const r = await c2.post("/api/pedidos").send({ itens: [{ produto_id: produto().id, quantidade: 1 }], tipo_entrega: "entrega", endereco_id: end.id, forma_pagamento: "pix" });
    assert.equal(r.status, 400);
  });

  it("recusa quantidade acima do estoque", async () => {
    const c = await clienteLogado();
    const p = Produtos.buscarPublicoPorSlug("doce-de-leite-com-nozes");
    const r = await c.post("/api/pedidos").send({ itens: [{ produto_id: p.id, quantidade: p.estoque + 1 }], tipo_entrega: "retirada", forma_pagamento: "pix" });
    assert.equal(r.status, 409);
    assert.equal(r.body.detalhes[0].tipo, "estoque");
    assert.equal(Produtos.buscarPublicoPorSlug("doce-de-leite-com-nozes").estoque, p.estoque);
  });

  it("cliente não vê pedido de outro cliente", async () => {
    const c1 = await clienteLogado();
    const c2 = await clienteLogado();
    const ped = (await c1.post("/api/pedidos").send({ itens: [{ produto_id: produto().id, quantidade: 1 }], tipo_entrega: "retirada", forma_pagamento: "pix" })).body.pedido;
    assert.equal((await c2.get(`/api/pedidos/${ped.id}`)).status, 404);
    assert.equal((await c1.get(`/api/pedidos/${ped.id}`)).status, 200);
  });

  it("cliente cancela pedido aguardando e o estoque volta", async () => {
    const c = await clienteLogado();
    const antes = produto().estoque;
    const ped = (await c.post("/api/pedidos").send({ itens: [{ produto_id: produto().id, quantidade: 2 }], tipo_entrega: "retirada", forma_pagamento: "cartao" })).body.pedido;
    assert.equal(produto().estoque, antes - 2);
    const r = await c.post(`/api/pedidos/${ped.id}/cancelar`);
    assert.equal(r.body.pedido.status, "cancelado");
    assert.equal(produto().estoque, antes);
  });
});

describe("Admin", () => {
  it("dashboard traz métricas", async () => {
    const a = await adminLogado();
    const r = await a.get("/api/admin/dashboard");
    assert.equal(r.status, 200);
    assert.ok("vendas" in r.body && "estoque_baixo" in r.body);
  });

  it("CRUD de produto com slug único e validação de preço", async () => {
    const a = await adminLogado();
    const base = { nome: "Pistache Teste", descricao: "Teste", preco: 1800, estoque: 5, disponivel: true };
    const r = await a.post("/api/admin/produtos").send(base);
    assert.equal(r.status, 201);
    assert.equal(r.body.produto.slug, "pistache-teste");
    const r2 = await a.post("/api/admin/produtos").send(base);
    assert.equal(r2.body.produto.slug, "pistache-teste-2");

    const ruim = await a.post("/api/admin/produtos").send({ ...base, preco_promocional: 2000 });
    assert.equal(ruim.status, 400);
    const imgRuim = await a.post("/api/admin/produtos").send({ ...base, imagem: "javascript:alert(1)" });
    assert.equal(imgRuim.status, 400);

    const id = r.body.produto.id;
    const est = await a.patch(`/api/admin/produtos/${id}`).send({ estoque: 42, disponivel: false });
    assert.equal(est.body.produto.estoque, 42);
    assert.equal(est.body.produto.disponivel, 0);
    // Indisponível some da vitrine.
    assert.equal((await request(app).get("/api/produtos/pistache-teste")).status, 404);
    assert.equal((await a.delete(`/api/admin/produtos/${id}`)).status, 200);
  });

  it("upload aceita só imagens reais", async () => {
    const a = await adminLogado();
    const id = Produtos.buscarPublicoPorSlug("prestigio").id;
    const falsa = await a.post(`/api/admin/produtos/${id}/imagem`).attach("imagem", Buffer.from("<svg onload=alert(1)>"), "x.png");
    assert.equal(falsa.status, 400);
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5c5e1a50000000049454e44ae426082", "hex");
    const ok = await a.post(`/api/admin/produtos/${id}/imagem`).attach("imagem", png, "pote.png");
    assert.equal(ok.status, 200);
    assert.match(ok.body.produto.imagem, /^\/uploads\/produto-\d+-.+\.png$/);
    assert.equal((await request(app).get(ok.body.produto.imagem)).status, 200);
  });

  it("muda status do pedido, registra histórico e devolve estoque ao cancelar", async () => {
    const a = await adminLogado();
    const c = await clienteLogado();
    const p = Produtos.buscarPublicoPorSlug("prestigio");
    const ped = (await c.post("/api/pedidos").send({ itens: [{ produto_id: p.id, quantidade: 1 }], tipo_entrega: "retirada", forma_pagamento: "pix" })).body.pedido;

    const conf = await a.patch(`/api/admin/pedidos/${ped.id}/status`).send({ status: "confirmado" });
    assert.equal(conf.body.pedido.status, "confirmado");
    // Pedido de retirada não pode "sair para entrega".
    assert.equal((await a.patch(`/api/admin/pedidos/${ped.id}/status`).send({ status: "saiu_para_entrega" })).status, 400);
    // Cliente não cancela mais depois de confirmado.
    assert.equal((await c.post(`/api/pedidos/${ped.id}/cancelar`)).status, 409);

    const antes = Produtos.buscarPublicoPorSlug("prestigio").estoque;
    const canc = await a.patch(`/api/admin/pedidos/${ped.id}/status`).send({ status: "cancelado" });
    assert.equal(canc.body.pedido.historico.length, 3);
    assert.equal(Produtos.buscarPublicoPorSlug("prestigio").estoque, antes + 1);
    assert.equal((await a.patch(`/api/admin/pedidos/${ped.id}/status`).send({ status: "confirmado" })).status, 409);
  });

  it("lista clientes e mostra pedidos do cliente", async () => {
    const a = await adminLogado();
    const c = await clienteLogado();
    const lista = await a.get(`/api/admin/clientes?busca=${encodeURIComponent(c.email)}`);
    assert.equal(lista.body.clientes.length, 1);
    const det = await a.get(`/api/admin/clientes/${c.cliente.id}`);
    assert.equal(det.body.cliente.email, c.email);
    assert.equal(det.body.cliente.senha_hash, undefined);
  });

  it("gera senha temporária para cliente e encerra as sessões dele", async () => {
    const a = await adminLogado();
    const c = await clienteLogado();
    const r = await a.post(`/api/admin/clientes/${c.cliente.id}/senha-temporaria`);
    assert.equal(r.status, 200);
    assert.match(r.body.senha_temporaria, /^[a-z]{5}\d{3}[a-z]{2}$/);
    assert.equal((await c.get("/api/cliente/me")).body.logado, false);
    const novo = await novoAgente();
    assert.equal((await novo.post("/api/auth/login").send({ email: c.email, senha: r.body.senha_temporaria })).status, 200);
    // cliente comum não acessa
    assert.equal((await novo.post(`/api/admin/clientes/${c.cliente.id}/senha-temporaria`)).status, 403);
  });

  it("produto de categoria desativada não pode ser comprado pela API", async () => {
    const a = await adminLogado();
    const c = await clienteLogado();
    const cat = (await a.post("/api/admin/categorias").send({ nome: "Sazonal Teste" })).body.categoria;
    const p = (await a.post("/api/admin/produtos").send({ nome: "Pote Sazonal", preco: 1500, estoque: 5, categoria_id: cat.id })).body.produto;
    await a.put(`/api/admin/categorias/${cat.id}`).send({ nome: "Sazonal Teste", ativo: false });
    const r = await c.post("/api/pedidos").send({ itens: [{ produto_id: p.id, quantidade: 1 }], tipo_entrega: "retirada", forma_pagamento: "pix" });
    assert.equal(r.status, 409);
    assert.equal(r.body.detalhes[0].tipo, "indisponivel");
  });

  it("salva configurações válidas e recusa inválidas", async () => {
    const a = await adminLogado();
    const ok = await a.put("/api/admin/configuracoes").send({ whatsapp: "(51) 99999-0000", instagram: "https://instagram.com/obolodepote" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.configuracoes.whatsapp, "51999990000");
    assert.equal((await a.put("/api/admin/configuracoes").send({ instagram: "javascript:alert(1)" })).status, 400);
    assert.equal((await a.put("/api/admin/configuracoes").send({ campo_inexistente: 1 })).status, 400);
    await a.put("/api/admin/configuracoes").send({ whatsapp: "", instagram: "" });
  });
});

describe("Avaliações e contato", () => {
  it("cliente só avalia produto de pedido entregue; aparece após aprovação", async () => {
    const a = await adminLogado();
    const c = await clienteLogado();
    const p = Produtos.buscarPublicoPorSlug("limao-siciliano");
    const ped = (await c.post("/api/pedidos").send({ itens: [{ produto_id: p.id, quantidade: 1 }], tipo_entrega: "retirada", forma_pagamento: "pix" })).body.pedido;
    const aval = { pedido_id: ped.id, produto_id: p.id, nota: 5, texto: "Muito bom, recomendo!" };
    assert.equal((await c.post("/api/cliente/avaliacoes").send(aval)).status, 400);
    await a.patch(`/api/admin/pedidos/${ped.id}/status`).send({ status: "entregue" });
    assert.equal((await c.post("/api/cliente/avaliacoes").send(aval)).status, 201);
    assert.equal((await c.post("/api/cliente/avaliacoes").send(aval)).status, 409);

    assert.equal((await request(app).get("/api/produtos/limao-siciliano")).body.produto.total_avaliacoes, 0);
    const pend = (await a.get("/api/admin/depoimentos")).body.depoimentos.find((d) => d.pedido_id === ped.id);
    await a.put(`/api/admin/depoimentos/${pend.id}`).send({ ...pend, aprovado: true });
    assert.equal((await request(app).get("/api/produtos/limao-siciliano")).body.produto.total_avaliacoes, 1);
  });

  it("formulário de contato grava mensagem e ignora robôs", async () => {
    const adm = await adminLogado();
    const v = await novoAgente();
    const r = await v.post("/api/contato").send({ nome: "Maria", email: "maria@teste.com", mensagem: "Quero encomendar 30 potes." });
    assert.equal(r.status, 201);
    await v.post("/api/contato").send({ nome: "Bot", email: "bot@teste.com", mensagem: "spam spam spam", site: "" });
    const robo = await v.post("/api/contato").send({ nome: "Bot", email: "bot@teste.com", mensagem: "spam spam spam spam", site: "http://x" });
    assert.equal(robo.status, 400);
    const msgs = (await adm.get("/api/admin/mensagens")).body.mensagens;
    assert.ok(msgs.some((m) => m.nome === "Maria"));
  });
});

describe("Páginas e SEO", () => {
  it("sitemap e robots", async () => {
    const s = await request(app).get("/sitemap.xml");
    assert.equal(s.status, 200);
    assert.match(s.text, /\/produto\/red-velvet/);
    const r = await request(app).get("/robots.txt");
    assert.match(r.text, /Disallow: \/admin/);
  });

  it("rota de API inexistente devolve JSON 404", async () => {
    const r = await request(app).get("/api/nada");
    assert.equal(r.status, 404);
    assert.equal(r.body.ok, false);
  });
});
