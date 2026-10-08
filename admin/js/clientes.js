import { get, patch } from "/js/core/api.js";
import { STATUS } from "/js/core/constantes.js";
import { $, html, icone, renderizar } from "/js/core/dom.js";
import { cep, data, dataHora, moeda, telefone } from "/js/core/formato.js";
import { linkWhatsapp } from "/js/core/loja.js";
import { toast } from "/js/core/ui.js";
import { abrirDialogo, iniciarAdmin, paginacao } from "./comum.js";

iniciarAdmin();
const estado = { pagina: 1, busca: "" };

async function carregar() {
  const r = await get(`/admin/clientes?${new URLSearchParams(estado)}`);
  renderizar(
    $("#listaClientes"),
    r.clientes.length
      ? r.clientes.map(
          (c) => html`<tr>
            <td class="principal" data-rotulo="Cliente"><span><button class="link-tabela" type="button" data-abrir="${c.id}">${c.nome}</button>
              ${c.papel === "admin" ? html` <span class="etiqueta etiqueta-edicao_limitada">Admin</span>` : ""}${c.ativo ? "" : html` <span class="status status-cancelado">Desativado</span>`}
              <span class="secundario">${c.email}</span></span></td>
            <td data-rotulo="Telefone">${telefone(c.telefone) || "—"}</td>
            <td class="num" data-rotulo="Pedidos">${c.total_pedidos}</td>
            <td class="num" data-rotulo="Total gasto">${moeda(c.total_gasto)}</td>
            <td data-rotulo="Último pedido">${c.ultimo_pedido ? data(c.ultimo_pedido) : "—"}</td>
            <td data-rotulo="Cadastro">${data(c.criado_em)}</td>
          </tr>`
        )
      : html`<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>`
  );
  paginacao($("#paginacao"), { pagina: r.pagina, total: r.total, porPagina: r.por_pagina }, (n) => {
    estado.pagina = n;
    carregar();
  });
}

async function abrirCliente(id) {
  const { cliente: c, enderecos, pedidos } = await get(`/admin/clientes/${id}`);
  const whats = linkWhatsapp(c.telefone, `Olá, ${c.nome.split(" ")[0]}!`);
  const corpo = abrirDialogo(
    c.nome,
    html`<div class="grade-2">
        <div class="bloco">
          <h3>Cadastro</h3>
          <p>${c.email}<br />${telefone(c.telefone) || "Sem telefone"}<br />Cliente desde ${data(c.criado_em)}</p>
          ${whats ? html`<p><a class="btn btn-whatsapp btn-pequeno" href="${whats}" target="_blank" rel="noopener">${icone("whatsapp")}WhatsApp</a></p>` : ""}
          ${c.papel !== "admin"
            ? html`<label class="interruptor"><input type="checkbox" id="clienteAtivo" ${c.ativo ? "checked" : ""} /><span class="trilho"></span>Conta ativa</label>
              <p class="ajuda">Contas desativadas não conseguem entrar nem fazer pedidos.</p>`
            : ""}
        </div>
        <div class="bloco">
          <h3>Endereços</h3>
          ${enderecos.length
            ? html`<ul class="lista-simples">${enderecos.map((e) => html`<li><span>${e.apelido ? html`<strong>${e.apelido}</strong><br />` : ""}${e.logradouro}, ${e.numero}${e.complemento ? ` — ${e.complemento}` : ""}<br />${e.bairro} · ${e.cidade}/${e.estado} · ${cep(e.cep)}</span></li>`)}</ul>`
            : html`<p class="ajuda">Nenhum endereço cadastrado.</p>`}
        </div>
      </div>
      <div class="bloco">
        <h3>Pedidos (${pedidos.length})</h3>
        ${pedidos.length
          ? html`<ul class="lista-simples">${pedidos.map((p) => html`<li><span><a href="/admin/pedidos?abrir=${p.id}">${p.codigo}</a> · ${dataHora(p.criado_em)}<br /><span class="status status-${p.status}">${STATUS[p.status]}</span></span><strong>${moeda(p.total)}</strong></li>`)}</ul>`
          : html`<p class="ajuda">Ainda não fez pedidos.</p>`}
      </div>`
  );
  corpo.querySelector("#clienteAtivo")?.addEventListener("change", async (e) => {
    try {
      await patch(`/admin/clientes/${c.id}/ativo`, { ativo: e.target.checked });
      toast(e.target.checked ? "Conta reativada." : "Conta desativada.");
      carregar();
    } catch (erro) {
      e.target.checked = !e.target.checked;
      toast(erro.message, { tipo: "erro" });
    }
  });
}

$("#listaClientes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-abrir]");
  if (b) abrirCliente(Number(b.dataset.abrir));
});
let espera;
$("#busca").addEventListener("input", (e) => {
  clearTimeout(espera);
  espera = setTimeout(() => {
    estado.busca = e.target.value.trim();
    estado.pagina = 1;
    carregar();
  }, 300);
});
$("#formBusca").addEventListener("submit", (e) => e.preventDefault());

await carregar();
const abrir = new URLSearchParams(location.search).get("abrir");
if (abrir) abrirCliente(Number(abrir));
