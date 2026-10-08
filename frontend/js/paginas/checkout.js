import { iniciarApp } from "../app.js";
import { formEndereco, ligarFormEndereco } from "../componentes/endereco.js";
import { sincronizarCarrinho } from "../componentes/gaveta-carrinho.js";
import { get, post } from "../core/api.js";
import { carrinho } from "../core/carrinho.js";
import { $, html, icone, renderizar, urlSegura } from "../core/dom.js";
import { aplicarMascara, cep, moeda, paraCentavos, telefone } from "../core/formato.js";
import { obterSessao } from "../core/sessao.js";
import { carregando, limparErros, mostrarErros, toast } from "../core/ui.js";

const { loja: promessaLoja } = iniciarApp();
const form = $("#formCheckout");
const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

let loja = null;
let bairros = [];
let enderecos = [];
let resumo = { itens: [], subtotal: 0 };

const tipo = () => form.elements.tipo_entrega.value;
// querySelector em vez de form.elements: com um único rádio, .value ignora se está marcado.
const enderecoSelecionado = () => enderecos.find((e) => e.id === Number(document.querySelector('input[name="endereco_id"]:checked')?.value));

function taxaDo(endereco) {
  if (!endereco) return null;
  if (loja?.cidade_entrega && normalizar(endereco.cidade) !== normalizar(loja.cidade_entrega)) return null;
  const b = bairros.find((x) => normalizar(x.nome) === normalizar(endereco.bairro));
  return b ? b.taxa : null;
}

function desenharResumo() {
  renderizar(
    $("#resumoItens"),
    resumo.itens.map(
      (i) => html`<li class="item-pedido">
        <img src="${urlSegura(i.imagem, "/assets/logo.svg")}" alt="" width="56" height="56" />
        <span>${i.quantidade}× ${i.nome}</span><strong>${moeda(i.subtotal)}</strong></li>`
    )
  );
  const frete = tipo() === "retirada" ? 0 : taxaDo(enderecoSelecionado());
  $("#resumoSubtotal").textContent = moeda(resumo.subtotal);
  $("#resumoFrete").textContent = tipo() === "retirada" ? "Grátis" : frete == null ? "Selecione o endereço" : frete === 0 ? "Grátis" : moeda(frete);
  $("#resumoTotal").textContent = moeda(resumo.subtotal + (frete || 0));

  const minimo = loja?.pedido_minimo || 0;
  const abaixo = resumo.subtotal < minimo;
  $("#avisoMinimo").hidden = !abaixo;
  if (abaixo) $("#avisoMinimo").textContent = `Pedido mínimo: ${moeda(minimo)}. Faltam ${moeda(minimo - resumo.subtotal)}.`;
  $("#confirmarPedido").disabled = !resumo.itens.length || abaixo || (loja && !loja.aceitando_pedidos);
}

function desenharEnderecos(selecionarId) {
  const area = $("#opcoesEndereco");
  if (!enderecos.length) {
    renderizar(area, html`<p class="ajuda">Cadastre um endereço para entrega.</p>`);
    abrirNovoEndereco();
    return;
  }
  const escolhido = selecionarId || enderecoSelecionado()?.id || (enderecos.find((e) => e.principal) || enderecos[0]).id;
  renderizar(
    area,
    enderecos.map((e) => {
      const taxa = taxaDo(e);
      return html`<div class="opcao">
        <input form="formCheckout" type="radio" name="endereco_id" id="end-${e.id}" value="${e.id}" ${e.id === escolhido ? "checked" : ""} ${taxa == null ? "disabled" : ""} />
        <label for="end-${e.id}">${icone("pin", "")}<strong>${e.apelido || `${e.logradouro}, ${e.numero}`}</strong>
          <small>${e.logradouro}, ${e.numero} · ${e.bairro} · ${cep(e.cep)}<br />${taxa == null ? "Fora da área de entrega" : taxa === 0 ? "Entrega grátis" : `Entrega: ${moeda(taxa)}`}</small></label>
      </div>`;
    })
  );
  // Se o escolhido está fora da área, seleciona o primeiro válido.
  if (!enderecoSelecionado() || taxaDo(enderecoSelecionado()) == null) {
    const valido = enderecos.find((e) => taxaDo(e) != null);
    if (valido) $(`#end-${valido.id}`).checked = true;
  }
  desenharResumo();
}

function abrirNovoEndereco() {
  const area = $("#areaNovoEndereco");
  if (area.children.length) return;
  renderizar(area, formEndereco("novo", {}));
  $("#btnNovoEndereco").hidden = true;
  const fechar = () => {
    renderizar(area, "");
    $("#btnNovoEndereco").hidden = false;
  };
  // O formulário de endereço é um <form> próprio; os campos do checkout usam o atributo form="formCheckout".
  ligarFormEndereco($("form", area), {
    bairros,
    aoCancelar: enderecos.length ? fechar : null,
    aoSalvar: async (novo) => {
      enderecos = (await get("/cliente/enderecos")).enderecos;
      fechar();
      desenharEnderecos(novo.id);
      if (taxaDo(novo) == null) toast(`Ainda não entregamos no bairro ${novo.bairro}. Escolha retirada ou outro endereço.`, { tipo: "erro" });
      else toast("Endereço salvo.");
    },
  });
}

function atualizarTipo() {
  const entrega = tipo() === "entrega";
  $("#etapaEndereco").hidden = !entrega;
  $("#numPagamento").textContent = entrega ? "3" : "2";
  $("#numObs").textContent = entrega ? "4" : "3";
  $("#infoRetirada").hidden = entrega;
  desenharResumo();
}

async function iniciar() {
  const [l, sessao] = await Promise.all([promessaLoja, obterSessao()]);
  loja = l;
  if (sessao.cliente?.telefone) form.elements.telefone.value = telefone(sessao.cliente.telefone);
  aplicarMascara($("#telefoneContato"), "telefone");

  if (carrinho.vazio()) {
    renderizar(
      $(".container", document.querySelector("main")),
      html`<div class="vazio pagina-erro">${icone("sacola")}<h1>Seu carrinho está vazio</h1><p>Escolha seus sabores antes de finalizar.</p><a class="btn btn-primario" href="/produtos">Ver cardápio</a></div>`
    );
    return;
  }

  if (loja && !loja.aceitando_pedidos) {
    renderizar($("#avisoCheckout"), html`<p class="alerta alerta-erro">${icone("relogio")}A loja não está recebendo pedidos agora. Confira nosso horário de funcionamento.</p><br />`);
  } else if (loja?.mensagem_aviso) {
    renderizar($("#avisoCheckout"), html`<p class="alerta">${loja.mensagem_aviso}</p><br />`);
  }

  if (loja && !loja.permite_retirada) {
    $("#tipoRetirada").disabled = true;
  }
  $("#infoRetirada").textContent = loja?.endereco_retirada ? `Retirada em: ${loja.endereco_retirada}` : "Combinamos o horário de retirada após a confirmação.";
  if (loja?.prazo_entrega) $("#resumoEntrega").textContent = loja.prazo_entrega;

  const [rb, re, rc] = await Promise.all([get("/entrega/bairros"), get("/cliente/enderecos"), sincronizarCarrinho()]);
  bairros = rb.bairros;
  enderecos = re.enderecos;
  resumo = rc || { itens: [], subtotal: 0 };
  if (!resumo.itens.length) {
    location.reload();
    return;
  }
  desenharEnderecos();
  atualizarTipo();
}

document.querySelector("[data-raiz-form]").addEventListener("change", (e) => {
  if (!e.target.form || e.target.form !== form) return;
  if (e.target.name === "tipo_entrega") atualizarTipo();
  if (e.target.name === "endereco_id") desenharResumo();
  if (e.target.name === "forma_pagamento") $("#campoTroco").hidden = e.target.value !== "dinheiro";
});
$("#btnNovoEndereco").addEventListener("click", abrirNovoEndereco);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErros(form);
  const entrega = tipo() === "entrega";
  if (entrega && !enderecoSelecionado()) {
    toast("Selecione ou cadastre um endereço de entrega.", { tipo: "erro" });
    return;
  }
  if (!form.elements.telefone.value.trim()) {
    form.elements.telefone.focus();
    toast("Informe um celular para contato.", { tipo: "erro" });
    return;
  }
  const botao = $("#confirmarPedido");
  carregando(botao, true);
  try {
    const { pedido } = await post("/pedidos", {
      itens: carrinho.paraApi(),
      tipo_entrega: tipo(),
      endereco_id: entrega ? enderecoSelecionado().id : null,
      forma_pagamento: form.elements.forma_pagamento.value,
      troco_para: form.elements.forma_pagamento.value === "dinheiro" ? paraCentavos(form.elements.troco.value) : null,
      telefone: form.elements.telefone.value,
      observacoes: form.elements.observacoes.value,
    });
    carrinho.limpar();
    location.href = `/conta/pedidos/${pedido.id}?novo=1`;
  } catch (erro) {
    carregando(botao, false);
    if (erro.status === 409 && Array.isArray(erro.dados?.detalhes)) {
      toast(erro.message, { tipo: "erro" });
      resumo = (await sincronizarCarrinho()) || resumo;
      desenharResumo();
      return;
    }
    mostrarErros(form, erro);
  }
});

iniciar();
