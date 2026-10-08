import { iniciarApp } from "../app.js";
import { post } from "../core/api.js";
import { $, destinoSeguro } from "../core/dom.js";
import { alternarSenha, carregando, dadosDoForm, limparErros, mostrarErros } from "../core/ui.js";

iniciarApp();
alternarSenha();

const form = $("#formLogin");
const voltar = new URLSearchParams(location.search).get("voltar");
if (voltar) $("#linkCadastro").href = `/cadastro?voltar=${encodeURIComponent(destinoSeguro("/conta"))}`;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErros(form);
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const botao = form.querySelector("[type=submit]");
  carregando(botao, true);
  try {
    const { cliente } = await post("/auth/login", dadosDoForm(form));
    location.href = destinoSeguro(cliente.papel === "admin" ? "/admin" : "/conta");
  } catch (erro) {
    mostrarErros(form, erro);
    carregando(botao, false);
  }
});
