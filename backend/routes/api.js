import { Router } from "express";
import { z } from "zod";
import * as auth from "../controllers/authController.js";
import * as cliente from "../controllers/clienteController.js";
import * as loja from "../controllers/lojaController.js";
import * as pedidos from "../controllers/pedidosController.js";
import { naoEncontrado } from "../lib/erros.js";
import {
  cadastroSchema, carrinhoSchema, contatoSchema, dadosClienteSchema, depoimentoClienteSchema,
  enderecoSchema, loginSchema, pedidoSchema, trocarSenhaSchema,
} from "../lib/schemas.js";
import { exigirLogin } from "../middleware/auth.js";
import { emitirTokenCsrf } from "../middleware/csrf.js";
import { limiteCadastro, limiteContato, limiteLogin, limitePedido } from "../middleware/limites.js";
import { validar } from "../middleware/validar.js";
import adminRotas from "./admin.js";

const r = Router();

// Parâmetro :id sempre numérico.
r.param("id", (_req, _res, next, valor) => (/^\d{1,10}$/.test(valor) ? next() : next(naoEncontrado())));

const filtroProdutos = z.object({
  categoria: z.string().trim().max(80).optional(),
  destaque: z.enum(["1", "true"]).optional().transform(Boolean),
  busca: z.string().trim().max(80).optional(),
});

// ---------- Público ----------
r.get("/csrf", emitirTokenCsrf);
r.get("/loja", loja.loja);
r.get("/produtos", validar(filtroProdutos, "query"), loja.listarProdutos);
r.get("/produtos/:chave", loja.buscarProduto);
r.get("/categorias", loja.listarCategorias);
r.get("/entrega/bairros", loja.listarBairros);
r.get("/depoimentos", loja.listarDepoimentos);
r.post("/carrinho/validar", validar(carrinhoSchema), loja.validarCarrinho);
r.post("/contato", limiteContato, validar(contatoSchema), loja.enviarContato);

// ---------- Autenticação ----------
r.post("/auth/cadastro", limiteCadastro, validar(cadastroSchema), auth.cadastrar);
r.post("/auth/login", limiteLogin, validar(loginSchema), auth.login);
r.post("/auth/logout", auth.logout);

// ---------- Área do cliente ----------
r.get("/cliente/me", cliente.me);
r.put("/cliente/me", exigirLogin, validar(dadosClienteSchema), cliente.atualizarDados);
r.put("/cliente/senha", exigirLogin, limiteLogin, validar(trocarSenhaSchema), cliente.trocarSenha);
r.get("/cliente/enderecos", exigirLogin, cliente.listarEnderecos);
r.post("/cliente/enderecos", exigirLogin, validar(enderecoSchema), cliente.criarEndereco);
r.put("/cliente/enderecos/:id", exigirLogin, validar(enderecoSchema), cliente.atualizarEndereco);
r.delete("/cliente/enderecos/:id", exigirLogin, cliente.removerEndereco);
r.post("/cliente/avaliacoes", exigirLogin, validar(depoimentoClienteSchema), loja.avaliarProduto);

r.get("/pedidos", exigirLogin, pedidos.listar);
r.post("/pedidos", exigirLogin, limitePedido, validar(pedidoSchema), pedidos.criar);
r.get("/pedidos/:id", exigirLogin, pedidos.buscar);
r.post("/pedidos/:id/cancelar", exigirLogin, pedidos.cancelar);

// ---------- Administração ----------
r.use("/admin", adminRotas);

export default r;
