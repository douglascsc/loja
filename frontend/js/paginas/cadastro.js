import { iniciarApp } from "../app.js";
import { post } from "../core/api.js";
import { $, destinoSeguro } from "../core/dom.js";
import { aplicarMascara } from "../core/formato.js";
import { alternarSenha, carregando, dadosDoForm, limparErros, mostrarErros } from "../core/ui.js";

iniciarApp();
alternarSenha();
aplicarMascara($("#cadTelefone"), "telefone");

const form = $("#formCadastro");
if (new URLSearchParams(location.search).get("voltar")) {
  $("#linkLogin").href = `/login?voltar=${encodeURIComponent(destinoSeguro("/conta"))}`;
}

// Indicador visual de força da senha
const barra = $("#barraForca");
$("#cadSenha").addEventListener("input", (e) => {
  const s = e.target.value;
  const pontos = [s.length >= 8, /[a-z]/i.test(s) && /\d/.test(s), s.length >= 12, /[^a-z0-9]/i.test(s)].filter(Boolean).length;
  barra.style.width = `${pontos * 25}%`;
  barra.style.background = ["#b42318", "#b42318", "#d98a1f", "#2f7d4f", "#23603c"][pontos];
});

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
    const dados = dadosDoForm(form);
    await post("/auth/cadastro", { ...dados, aceite_termos: form.elements.aceite_termos.checked });
    location.href = destinoSeguro("/conta");
  } catch (erro) {
    mostrarErros(form, erro);
    carregando(botao, false);
  }
});
