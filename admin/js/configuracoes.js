import { del, enviarArquivo, get, post, put } from "/js/core/api.js";
import { $, $$, html, icone, renderizar, urlSegura } from "/js/core/dom.js";
import { aplicarMascara, cep, moeda, telefone } from "/js/core/formato.js";
import { DIAS } from "/js/core/loja.js";
import { carregando, limparErros, mostrarErros, toast } from "/js/core/ui.js";
import { iniciarAdmin, lerReais, paraReais } from "./comum.js";

iniciarAdmin();
const form = $("#formConfig");
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
let bairros = [];

aplicarMascara($("#whatsapp"), "telefone");
aplicarMascara($("#telefone"), "telefone");
aplicarMascara($("#end_cep"), "cep");

function desenharHorarios(horarios) {
  renderizar(
    $("#horarios"),
    ORDEM_DIAS.map((d) => {
      const faixas = horarios[d] || [];
      const [a1, f1] = faixas[0] || ["", ""];
      const [a2, f2] = faixas[1] || ["", ""];
      return html`<div class="horario-dia" data-dia="${d}">
        <label class="interruptor"><input type="checkbox" data-aberto ${faixas.length ? "checked" : ""} /><span class="trilho"></span>${DIAS[d]}</label>
        <div class="faixas">
          <label class="sr-only" for="h${d}a1">${DIAS[d]}: abre</label><input class="entrada" type="time" id="h${d}a1" value="${a1}" />
          <span>às</span>
          <label class="sr-only" for="h${d}f1">${DIAS[d]}: fecha</label><input class="entrada" type="time" id="h${d}f1" value="${f1}" />
          <span class="ajuda">e</span>
          <label class="sr-only" for="h${d}a2">${DIAS[d]}: reabre (opcional)</label><input class="entrada" type="time" id="h${d}a2" value="${a2}" />
          <span>às</span>
          <label class="sr-only" for="h${d}f2">${DIAS[d]}: fecha de novo (opcional)</label><input class="entrada" type="time" id="h${d}f2" value="${f2}" />
        </div>
      </div>`;
    })
  );
}

function lerHorarios() {
  const horarios = {};
  for (const linha of $$(".horario-dia")) {
    const d = linha.dataset.dia;
    const v = (s) => $(`#h${d}${s}`).value;
    const faixas = [];
    if (linha.querySelector("[data-aberto]").checked) {
      if (v("a1") && v("f1")) faixas.push([v("a1"), v("f1")]);
      if (v("a2") && v("f2")) faixas.push([v("a2"), v("f2")]);
    }
    horarios[d] = faixas;
  }
  return horarios;
}

async function carregar() {
  const { configuracoes: c, bairros: b } = await get("/admin/configuracoes");
  for (const campo of ["nome_loja", "slogan", "descricao_seo", "email", "instagram", "facebook", "tiktok", "razao_social", "modo_funcionamento", "cidade_entrega", "endereco_retirada", "prazo_entrega", "mensagem_aviso"]) {
    form.elements[campo].value = c[campo] ?? "";
  }
  form.elements.whatsapp.value = telefone(c.whatsapp);
  form.elements.telefone.value = telefone(c.telefone);
  form.elements.cnpj.value = c.cnpj;
  for (const el of $$("[data-endereco]")) el.value = el.dataset.endereco === "cep" ? cep(c.endereco?.cep) : c.endereco?.[el.dataset.endereco] ?? "";
  $("#aceita_pedidos_fora_horario").checked = !!c.aceita_pedidos_fora_horario;
  $("#permite_retirada").checked = !!c.permite_retirada;
  $("#pedido_minimo").value = paraReais(c.pedido_minimo);
  $("#previaLogo").src = urlSegura(c.logo, "/assets/logo.svg");
  desenharHorarios(c.horarios);
  bairros = b;
  desenharBairros();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErros(form);
  const minimo = lerReais($("#pedido_minimo").value) ?? 0;
  if (Number.isNaN(minimo)) return toast("Pedido mínimo inválido.", { tipo: "erro" });
  const dados = {};
  for (const el of form.elements) if (el.name && el.type !== "file") dados[el.name] = el.value;
  Object.assign(dados, {
    endereco: Object.fromEntries($$("[data-endereco]").map((el) => [el.dataset.endereco, el.value])),
    horarios: lerHorarios(),
    aceita_pedidos_fora_horario: $("#aceita_pedidos_fora_horario").checked,
    permite_retirada: $("#permite_retirada").checked,
    pedido_minimo: minimo,
  });
  const botao = form.querySelector("[type=submit]");
  carregando(botao, true);
  try {
    await put("/admin/configuracoes", dados);
    const arquivo = $("#arquivoLogo").files[0];
    if (arquivo) {
      const fd = new FormData();
      fd.append("imagem", arquivo);
      await enviarArquivo("/admin/configuracoes/logo", fd);
      $("#arquivoLogo").value = "";
    }
    toast("Configurações salvas.");
    carregar();
  } catch (erro) {
    mostrarErros(form, erro);
  } finally {
    carregando(botao, false);
  }
});

$("#arquivoLogo").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) $("#previaLogo").src = URL.createObjectURL(f);
});

// ---------- Bairros ----------
function desenharBairros() {
  renderizar(
    $("#listaBairros"),
    bairros.map(
      (b) => html`<tr>
        <td class="principal" data-rotulo="Bairro">${b.nome}</td>
        <td class="num" data-rotulo="Taxa"><label class="sr-only" for="taxa-${b.id}">Taxa de ${b.nome}</label>
          <input class="entrada entrada-estoque" id="taxa-${b.id}" inputmode="decimal" value="${paraReais(b.taxa)}" data-taxa="${b.id}" /></td>
        <td data-rotulo="Ativo"><label class="interruptor"><input type="checkbox" data-ativo="${b.id}" ${b.ativo ? "checked" : ""} /><span class="trilho"></span><span class="sr-only">Entregar em ${b.nome}</span></label></td>
        <td data-rotulo="Ações"><span class="acoes"><button class="btn btn-perigo btn-pequeno" type="button" data-excluir="${b.id}" aria-label="Remover ${b.nome}">${icone("lixeira")}</button></span></td>
      </tr>`
    )
  );
}

$("#listaBairros").addEventListener("change", async (e) => {
  const id = Number(e.target.dataset.taxa || e.target.dataset.ativo);
  if (!id) return;
  const b = bairros.find((x) => x.id === id);
  const taxa = e.target.dataset.taxa ? lerReais(e.target.value) : b.taxa;
  if (taxa == null || Number.isNaN(taxa)) return toast("Taxa inválida.", { tipo: "erro" });
  try {
    const r = await put(`/admin/bairros/${id}`, { nome: b.nome, taxa, ativo: e.target.dataset.ativo ? e.target.checked : !!b.ativo });
    Object.assign(b, r.bairro);
    toast(`${b.nome}: ${b.ativo ? moeda(b.taxa) : "sem entrega"}.`);
  } catch (erro) {
    toast(erro.message, { tipo: "erro" });
  }
});

$("#listaBairros").addEventListener("click", async (e) => {
  const ex = e.target.closest("[data-excluir]");
  if (!ex || !confirm("Remover este bairro da área de entrega?")) return;
  await del(`/admin/bairros/${ex.dataset.excluir}`);
  bairros = bairros.filter((b) => b.id !== Number(ex.dataset.excluir));
  desenharBairros();
});

$("#formBairro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = $("#novoBairro").value.trim();
  const taxa = lerReais($("#novaTaxa").value);
  if (!nome || taxa == null || Number.isNaN(taxa)) return toast("Informe o bairro e a taxa.", { tipo: "erro" });
  try {
    const { bairro } = await post("/admin/bairros", { nome, taxa });
    bairros = [...bairros, bairro].sort((a, b) => a.nome.localeCompare(b.nome));
    desenharBairros();
    e.target.reset();
    toast("Bairro adicionado.");
  } catch (erro) {
    toast(erro.message, { tipo: "erro" });
  }
});

carregar();
