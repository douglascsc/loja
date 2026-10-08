import { get, patch } from "/js/core/api.js";
import { PAGAMENTOS, STATUS } from "/js/core/constantes.js";
import { $, html, icone, renderizar } from "/js/core/dom.js";
import { cep, dataHora, moeda, telefone } from "/js/core/formato.js";
import { linkWhatsapp } from "/js/core/loja.js";
import { carregando, toast } from "/js/core/ui.js";
import { abrirDialogo, atualizarContagens, iniciarAdmin, paginacao } from "./comum.js";

iniciarAdmin();

const params = new URLSearchParams(location.search);
const estado = { pagina: 1, status: params.get("status") || "", busca: "" };
let ultimoMaiorId = 0;

const filtro = $("#filtroStatus");
for (const [valor, nome] of Object.entries(STATUS)) {
  const op = document.createElement("option");
  op.value = valor;
  op.textContent = nome;
  filtro.append(op);
}
filtro.value = estado.status;

async function carregar({ silencioso = false } = {}) {
  const q = new URLSearchParams({ pagina: estado.pagina, status: estado.status, busca: estado.busca });
  const r = await get(`/admin/pedidos?${q}`);
  const corpo = $("#listaPedidos");
  renderizar(
    corpo,
    r.pedidos.length
      ? r.pedidos.map(
          (p) => html`<tr>
            <td class="principal" data-rotulo="Pedido"><button class="link-tabela" type="button" data-abrir="${p.id}">${p.codigo}</button><span class="secundario">${dataHora(p.criado_em)}</span></td>
            <td data-rotulo="Cliente">${p.cliente_nome}<span class="secundario">${p.cliente_email}</span></td>
            <td data-rotulo="Entrega">${p.tipo_entrega === "entrega" ? `Entrega · ${p.entrega_bairro || ""}` : "Retirada"}</td>
            <td data-rotulo="Itens">${p.total_itens}</td>
            <td data-rotulo="Status"><span class="status status-${p.status}">${STATUS[p.status]}</span></td>
            <td class="num" data-rotulo="Total">${moeda(p.total)}</td>
          </tr>`
        )
      : html`<tr><td colspan="6">Nenhum pedido encontrado.</td></tr>`
  );
  paginacao($("#paginacao"), { pagina: r.pagina, total: r.total, porPagina: r.por_pagina }, (n) => {
    estado.pagina = n;
    carregar();
  });

  // Aviso de pedido novo enquanto a página está aberta.
  const maior = Math.max(0, ...r.pedidos.map((p) => p.id));
  if (silencioso && ultimoMaiorId && maior > ultimoMaiorId) toast("Chegou um pedido novo!");
  ultimoMaiorId = Math.max(ultimoMaiorId, maior);
  if (silencioso) atualizarContagens();
}

async function abrirPedido(id) {
  const { pedido: p, cliente } = await get(`/admin/pedidos/${id}`);
  const whatsCliente = linkWhatsapp(p.contato_telefone, `Olá, ${p.contato_nome.split(" ")[0]}! Aqui é da loja, sobre o pedido ${p.codigo}.`);
  const opcoes = Object.entries(STATUS).filter(([s]) =>
    p.tipo_entrega === "retirada" ? s !== "saiu_para_entrega" : s !== "pronto_para_retirada"
  );

  const corpo = abrirDialogo(
    `Pedido ${p.codigo}`,
    html`<div class="grade-2">
        <div class="bloco">
          <h3>Cliente</h3>
          <p><a href="/admin/clientes?abrir=${cliente.id}">${p.contato_nome}</a><br />${cliente.email}<br />${telefone(p.contato_telefone) || "Sem telefone"}</p>
          ${whatsCliente ? html`<p><a class="btn btn-whatsapp btn-pequeno" href="${whatsCliente}" target="_blank" rel="noopener">${icone("whatsapp")}WhatsApp</a></p>` : ""}
        </div>
        <div class="bloco">
          <h3>${p.tipo_entrega === "entrega" ? "Entrega" : "Retirada no local"}</h3>
          ${p.tipo_entrega === "entrega"
            ? html`<p>${p.entrega_logradouro}, ${p.entrega_numero}${p.entrega_complemento ? ` — ${p.entrega_complemento}` : ""}<br />${p.entrega_bairro} · ${p.entrega_cidade}/${p.entrega_estado}<br />CEP ${cep(p.entrega_cep)}${p.entrega_referencia ? html`<br />Ref.: ${p.entrega_referencia}` : ""}</p>`
            : html`<p>O cliente vai retirar.</p>`}
          <p><strong>Pagamento:</strong> ${PAGAMENTOS[p.forma_pagamento]}${p.troco_para ? ` · troco para ${moeda(p.troco_para)}` : ""}</p>
        </div>
      </div>
      ${p.observacoes ? html`<div class="bloco"><h3>Observações do cliente</h3><p>${p.observacoes}</p></div>` : ""}
      <div class="bloco">
        <h3>Itens</h3>
        <ul class="lista-simples">${p.itens.map((i) => html`<li><span>${i.quantidade}× ${i.nome_produto} <span class="ajuda">(${moeda(i.preco_unitario)})</span></span><strong>${moeda(i.subtotal)}</strong></li>`)}</ul>
        <div class="totais">
          <div><span>Subtotal</span><span>${moeda(p.subtotal)}</span></div>
          <div><span>Frete</span><span>${moeda(p.frete)}</span></div>
          ${p.desconto ? html`<div><span>Desconto</span><span>-${moeda(p.desconto)}</span></div>` : ""}
          <div class="total"><span>Total</span><span>${moeda(p.total)}</span></div>
        </div>
      </div>
      <form class="bloco form" id="formStatus">
        <h3>Atualizar status</h3>
        <p>Status atual: <span class="status status-${p.status}">${STATUS[p.status]}</span></p>
        ${p.status === "cancelado"
          ? html`<p class="ajuda">Pedidos cancelados não podem ser reabertos. O estoque já foi devolvido.</p>`
          : html`<div class="form-linha">
              <div class="campo"><label for="novoStatus">Novo status</label>
                <select class="entrada" id="novoStatus" name="status">${opcoes.map(([v, n]) => html`<option value="${v}" ${v === p.status ? "selected" : ""}>${n}</option>`)}</select></div>
              <div class="campo"><label for="obsStatus">Observação <span class="opcional">(opcional)</span></label>
                <input class="entrada" id="obsStatus" name="observacao" maxlength="300" /></div>
            </div>
            <p class="ajuda">Cancelar devolve os itens ao estoque.</p>
            <div><button class="btn btn-primario" type="submit">Salvar status</button></div>`}
      </form>
      <div class="bloco">
        <h3>Histórico</h3>
        <ol class="linha-tempo">${p.historico.map((h) => html`<li><strong>${STATUS[h.status_novo]}</strong>${h.alterado_por_nome ? ` · por ${h.alterado_por_nome}` : ""}<time datetime="${h.criado_em}">${dataHora(h.criado_em)}</time>${h.observacao ? html`<span class="ajuda">${h.observacao}</span>` : ""}</li>`)}</ol>
      </div>`
  );

  const form = corpo.querySelector("#formStatus");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const novo = form.elements.status?.value;
    if (!novo || novo === p.status) return toast("Escolha um status diferente do atual.", { tipo: "erro" });
    if (novo === "cancelado" && !confirm("Cancelar este pedido? Os itens voltam ao estoque e não será possível reabrir.")) return;
    const botao = form.querySelector("[type=submit]");
    carregando(botao, true);
    try {
      await patch(`/admin/pedidos/${p.id}/status`, { status: novo, observacao: form.elements.observacao.value });
      toast(`Pedido ${p.codigo}: ${STATUS[novo]}.`);
      await carregar();
      atualizarContagens();
      abrirPedido(p.id);
    } catch (erro) {
      toast(erro.message, { tipo: "erro" });
      carregando(botao, false);
    }
  });
}

$("#listaPedidos").addEventListener("click", (e) => {
  const b = e.target.closest("[data-abrir]");
  if (b) abrirPedido(Number(b.dataset.abrir));
});
filtro.addEventListener("change", () => {
  estado.status = filtro.value;
  estado.pagina = 1;
  carregar();
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
if (params.get("abrir")) abrirPedido(Number(params.get("abrir")));
setInterval(() => !document.hidden && !$("#dialogo").open && carregar({ silencioso: true }), 30_000);
