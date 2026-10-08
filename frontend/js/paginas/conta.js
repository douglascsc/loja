import { iniciarApp } from "../app.js";
import { formEndereco, ligarFormEndereco } from "../componentes/endereco.js";
import { del, get, put } from "../core/api.js";
import { STATUS } from "../core/constantes.js";
import { $, $$, html, renderizar } from "../core/dom.js";
import { aplicarMascara, cep, dataHora, moeda, plural, telefone } from "../core/formato.js";
import { obterSessao, sair } from "../core/sessao.js";
import { carregando, dadosDoForm, limparErros, mostrarErros, toast } from "../core/ui.js";

iniciarApp();


// ---------- Abas (com suporte a #hash e setas do teclado) ----------
const abas = $$("[role=tab]");
function abrirAba(nome, focar = false) {
  const alvo = abas.find((a) => a.dataset.aba === nome) || abas[0];
  for (const a of abas) {
    const ativa = a === alvo;
    a.setAttribute("aria-selected", String(ativa));
    a.tabIndex = ativa ? 0 : -1;
    $(`#${a.getAttribute("aria-controls")}`).hidden = !ativa;
  }
  if (focar) alvo.focus();
  history.replaceState(null, "", `#${alvo.dataset.aba}`);
}
for (const a of abas) a.addEventListener("click", () => abrirAba(a.dataset.aba));
$(".conta-menu").addEventListener("keydown", (e) => {
  const i = abas.indexOf(document.activeElement);
  if (i < 0) return;
  const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (!d) return;
  e.preventDefault();
  abrirAba(abas[(i + d + abas.length) % abas.length].dataset.aba, true);
});
abrirAba(location.hash.slice(1) || "pedidos");
window.addEventListener("hashchange", () => abrirAba(location.hash.slice(1)));
$("#botaoSair").addEventListener("click", sair);

// ---------- Dados ----------
const formDados = $("#formDados");
aplicarMascara($("#dadosTelefone"), "telefone");

obterSessao().then(({ cliente }) => {
  if (!cliente) return;
  $("#nomeCliente").textContent = cliente.nome.split(" ")[0];
  formDados.elements.nome.value = cliente.nome;
  formDados.elements.email.value = cliente.email;
  formDados.elements.telefone.value = telefone(cliente.telefone);
});

formDados.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErros(formDados);
  const botao = formDados.querySelector("[type=submit]");
  carregando(botao, true);
  try {
    const { cliente } = await put("/cliente/me", dadosDoForm(formDados));
    $("#nomeCliente").textContent = cliente.nome.split(" ")[0];
    toast("Dados atualizados.");
  } catch (erro) {
    mostrarErros(formDados, erro);
  } finally {
    carregando(botao, false);
  }
});

// ---------- Senha ----------
const formSenha = $("#formSenha");
formSenha.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErros(formSenha);
  const botao = formSenha.querySelector("[type=submit]");
  carregando(botao, true);
  try {
    await put("/cliente/senha", dadosDoForm(formSenha));
    formSenha.reset();
    toast("Senha alterada com sucesso.");
  } catch (erro) {
    mostrarErros(formSenha, erro);
  } finally {
    carregando(botao, false);
  }
});

// ---------- Pedidos ----------
async function carregarPedidos() {
  const lista = $("#listaPedidos");
  try {
    const { pedidos } = await get("/pedidos");
    if (!pedidos.length) {
      renderizar(lista, html`<li class="vazio"><p>Você ainda não fez nenhum pedido.</p><p><a class="btn btn-primario" href="/produtos">Ver cardápio</a></p></li>`);
      return;
    }
    renderizar(
      lista,
      pedidos.map(
        (p) => html`<li><a class="pedido-resumo" href="/conta/pedidos/${p.id}">
          <span><span class="codigo">Pedido ${p.codigo}</span><br /><span class="meta">${dataHora(p.criado_em)} · ${plural(p.total_itens, "item", "itens")} · ${p.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}</span></span>
          <span class="valor">${moeda(p.total)}</span>
          <span class="status status-${p.status}">${STATUS[p.status]}</span>
        </a></li>`
      )
    );
  } catch {
    renderizar(lista, html`<li class="vazio">Não foi possível carregar seus pedidos.</li>`);
  }
}
carregarPedidos();

// ---------- Endereços ----------
let bairros = [];
get("/entrega/bairros").then((r) => (bairros = r.bairros)).catch(() => {});

async function carregarEnderecos() {
  const { enderecos } = await get("/cliente/enderecos");
  const lista = $("#listaEnderecos");
  if (!enderecos.length) {
    renderizar(lista, html`<li class="ajuda">Nenhum endereço cadastrado ainda.</li>`);
    return enderecos;
  }
  renderizar(
    lista,
    enderecos.map(
      (e) => html`<li class="cartao-endereco${e.principal ? " principal" : ""}">
        <strong>${e.apelido || "Endereço"}${e.principal ? " · principal" : ""}</strong>
        <span>${e.logradouro}, ${e.numero}${e.complemento ? ` — ${e.complemento}` : ""}</span>
        <span>${e.bairro} · ${e.cidade}/${e.estado} · ${cep(e.cep)}</span>
        <div class="acoes">
          <button class="btn btn-claro btn-pequeno" type="button" data-editar="${e.id}">Editar</button>
          <button class="btn btn-perigo btn-pequeno" type="button" data-excluir="${e.id}" aria-label="Excluir endereço ${e.apelido || e.logradouro}">Excluir</button>
        </div>
      </li>`
    )
  );
  return enderecos;
}

let enderecosAtuais = [];
async function atualizarEnderecos() {
  enderecosAtuais = await carregarEnderecos();
}
atualizarEnderecos();

function abrirForm(endereco) {
  const area = $("#areaFormEndereco");
  renderizar(area, html`<div class="painel">${formEndereco("end", endereco)}</div>`);
  $("#novoEndereco").hidden = true;
  const fechar = () => {
    renderizar(area, "");
    $("#novoEndereco").hidden = false;
    $("#novoEndereco").focus();
  };
  ligarFormEndereco($("form", area), {
    bairros,
    aoCancelar: fechar,
    aoSalvar: async () => {
      toast("Endereço salvo.");
      fechar();
      await atualizarEnderecos();
    },
  });
}

$("#novoEndereco").addEventListener("click", () => abrirForm());
$("#listaEnderecos").addEventListener("click", async (e) => {
  const editar = e.target.closest("[data-editar]");
  const excluir = e.target.closest("[data-excluir]");
  if (editar) abrirForm(enderecosAtuais.find((x) => x.id === Number(editar.dataset.editar)));
  if (excluir && confirm("Excluir este endereço?")) {
    try {
      await del(`/cliente/enderecos/${excluir.dataset.excluir}`);
      toast("Endereço excluído.");
      await atualizarEnderecos();
    } catch (erro) {
      toast(erro.message, { tipo: "erro" });
    }
  }
});
