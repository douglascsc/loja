import { Router } from "express";
import * as admin from "../controllers/adminController.js";
import { naoEncontrado } from "../lib/erros.js";
import {
  bairroSchema, categoriaSchema, configuracoesSchema, depoimentoAdminSchema,
  produtoParcialSchema, produtoSchema, statusSchema,
} from "../lib/schemas.js";
import { exigirAdmin } from "../middleware/auth.js";
import { validar } from "../middleware/validar.js";
import { receberImagem } from "../services/uploads.js";

const r = Router();

// TODAS as rotas daqui exigem um administrador logado.
r.use(exigirAdmin);
r.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
r.param("id", (_req, _res, next, valor) => (/^\d{1,10}$/.test(valor) ? next() : next(naoEncontrado())));

r.get("/dashboard", admin.dashboard);

r.get("/produtos", admin.listarProdutos);
r.post("/produtos", validar(produtoSchema), admin.criarProduto);
r.get("/produtos/:id", admin.buscarProduto);
r.put("/produtos/:id", validar(produtoSchema), admin.atualizarProduto);
r.patch("/produtos/:id", validar(produtoParcialSchema), admin.atualizarProdutoParcial);
r.post("/produtos/:id/imagem", receberImagem, admin.enviarImagemProduto);
r.delete("/produtos/:id", admin.removerProduto);

r.get("/categorias", admin.listarCategorias);
r.post("/categorias", validar(categoriaSchema), admin.criarCategoria);
r.put("/categorias/:id", validar(categoriaSchema), admin.atualizarCategoria);
r.delete("/categorias/:id", admin.removerCategoria);

r.get("/pedidos", admin.listarPedidos);
r.get("/pedidos/:id", admin.buscarPedido);
r.patch("/pedidos/:id/status", validar(statusSchema), admin.mudarStatusPedido);

r.get("/clientes", admin.listarClientes);
r.get("/clientes/:id", admin.buscarCliente);
r.patch("/clientes/:id/ativo", admin.alterarAtivoCliente);
r.post("/clientes/:id/senha-temporaria", admin.gerarSenhaTemporaria);

r.get("/depoimentos", admin.listarDepoimentos);
r.post("/depoimentos", validar(depoimentoAdminSchema), admin.criarDepoimento);
r.put("/depoimentos/:id", validar(depoimentoAdminSchema), admin.atualizarDepoimento);
r.delete("/depoimentos/:id", admin.removerDepoimento);

r.get("/mensagens", admin.listarMensagens);
r.patch("/mensagens/:id", admin.marcarMensagem);
r.delete("/mensagens/:id", admin.removerMensagem);

r.get("/configuracoes", admin.lerConfiguracoes);
r.put("/configuracoes", validar(configuracoesSchema), admin.salvarConfiguracoes);
r.post("/configuracoes/logo", receberImagem, admin.enviarLogo);
r.post("/bairros", validar(bairroSchema), admin.criarBairro);
r.put("/bairros/:id", validar(bairroSchema), admin.atualizarBairro);
r.delete("/bairros/:id", admin.removerBairro);

export default r;
