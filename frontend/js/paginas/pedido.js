import { iniciarApp } from "../app.js";
import { get, post } from "../core/api.js";
import { PAGAMENTOS, STATUS } from "../core/constantes.js";
import { $, html, icone, renderizar, urlSegura } from "../core/dom.js";
import { cep, dataHora, moeda, telefone } from "../core/formato.js";
import { linkWhatsapp } from "../core/loja.js";
import { carregando, dadosDoForm, mostrarErros, toast } from "../core/ui.js";

const { loja: promessaLoja } = iniciarApp();
const id = Number(location.pathname.split("/").pop());
const novo = new URLSearchParams(location.search).has("novo");

/** Mensagem pronta para o cliente enviar à loja pelo WhatsApp. */
function mensagemWhatsapp(p) {
  const linhas = [
    `Olá! Acabei de fazer o pedido *${p.codigo}* pelo site.`,
    "",
    ...p.itens.map((i) => `• ${i.quantidade}x ${i.nome_produto} — ${moeda(i.subtotal)}`),
    "",
    `Subtotal: ${moeda(p.subtotal)}`,
    p.frete ? `Entrega: ${moeda(p.frete)}` : null,
    `*Total: ${moeda(p.total)}*`,
    `Pagamento: ${PAGAMENTOS[p.forma_pagamento]}${p.troco_para ? ` (troco para ${moeda(p.troco_para)})` : ""}`,
    p.tipo_entrega === "entrega"
      ? `Entregar em: ${p.entrega_logradouro}, ${p.entrega_numero}${p.entrega_complemento ? ` - ${p.entrega_complemento}` : ""} — ${p.entrega_bairro}`
      : "Vou retirar no local.",
    p.observacoes ? `Obs.: ${p.observacoes}` : null,
    "",
    `Nome: ${p.contato_nome}`,
  ];
  return linhas.filter((l) => l !== null).join("\n");
}

async function carregar() {
  const area = $("#pedidoConteudo");
  let p;
  try {
    p = (await get(`/pedidos/${id}`)).pedido;
  } catch (erro) {
    area.setAttribute("aria-busy", "false");
    renderizar(area, html`<div class="painel vazio"><p>${erro.status === 404 ? "Pedido não encontrado." : erro.message}</p><p><a href="/conta#pedidos">Voltar aos pedidos</a></p></div>`);
    return;
  }
  const loja = await promessaLoja;
  document.title = `Pedido ${p.codigo} | ${loja?.nome_loja || ""}`;
  $("#tituloPedido").textContent = `Pedido ${p.codigo}`;
  renderizar($("#subtituloPedido"), html`Feito em ${dataHora(p.criado_em)} · <span class="status status-${p.status}">${STATUS[p.status]}</span>`);

  const whats = loja && linkWhatsapp(loja.whatsapp, mensagemWhatsapp(p));
  if (novo) {
    renderizar(
      $("#avisoNovo"),
      html`<div class="alerta alerta-sucesso" role="status">${icone("check")}<div>
        <strong>Pedido recebido!</strong> Já está no nosso painel e vamos confirmar em breve.
        ${whats ? html`<p>Para agilizar, envie também pelo WhatsApp:</p><p><a class="btn btn-whatsapp" href="${whats}" target="_blank" rel="noopener">${icone("whatsapp")}Enviar pedido pelo WhatsApp</a></p>` : ""}
      </div></div><br />`
    );
  }

  const avaliados = new Set(p.produtos_avaliados || []);
  const podeAvaliar = p.status === "entregue";

  area.setAttribute("aria-busy", "false");
  renderizar(
    area,
    html`<div class="painel">
        <h2>Itens</h2>
        <ul class="itens-pedido">
          ${p.itens.map(
            (i) => html`<li>
              <div class="item-pedido">
                <img src="${urlSegura(i.produto_imagem, "/assets/logo.svg")}" alt="" width="56" height="56" />
                <span>${i.quantidade}× ${i.produto_slug ? html`<a href="/produto/${i.produto_slug}">${i.nome_produto}</a>` : i.nome_produto}<br /><span class="ajuda">${moeda(i.preco_unitario)} cada</span></span>
                <strong>${moeda(i.subtotal)}</strong>
              </div>
              ${podeAvaliar && i.produto_id && !avaliados.has(i.produto_id) ? formAvaliacao(i) : ""}
              ${avaliados.has(i.produto_id) ? html`<p class="ajuda">✓ Você avaliou este produto. Obrigado!</p>` : ""}
            </li>`
          )}
        </ul>
        <div class="totais">
          <div><span>Subtotal</span><span>${moeda(p.subtotal)}</span></div>
          <div><span>${p.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}</span><span>${p.frete ? moeda(p.frete) : "Grátis"}</span></div>
          ${p.desconto ? html`<div><span>Desconto</span><span>-${moeda(p.desconto)}</span></div>` : ""}
          <div class="total"><span>Total</span><span>${moeda(p.total)}</span></div>
        </div>
      </div>
      <div class="painel">
        <h2>Entrega e pagamento</h2>
        <p><strong>${p.tipo_entrega === "entrega" ? "Entrega em:" : "Retirada no local"}</strong></p>
        ${p.tipo_entrega === "entrega"
          ? html`<p>${p.entrega_logradouro}, ${p.entrega_numero}${p.entrega_complemento ? ` — ${p.entrega_complemento}` : ""}<br />${p.entrega_bairro} · ${p.entrega_cidade}/${p.entrega_estado} · ${cep(p.entrega_cep)}${p.entrega_referencia ? html`<br />Ref.: ${p.entrega_referencia}` : ""}</p>`
          : html`<p>${loja?.endereco_retirada || "Combine o horário de retirada com a loja."}</p>`}
        <p><strong>Pagamento:</strong> ${PAGAMENTOS[p.forma_pagamento]}${p.troco_para ? ` · troco para ${moeda(p.troco_para)}` : ""}</p>
        ${p.contato_telefone ? html`<p><strong>Contato:</strong> ${telefone(p.contato_telefone)}</p>` : ""}
        ${p.observacoes ? html`<p><strong>Observações:</strong> ${p.observacoes}</p>` : ""}
        <h3>Acompanhamento</h3>
        <ol class="linha-tempo">
          ${p.historico.map((h) => html`<li><strong>${STATUS[h.status_novo]}</strong><time datetime="${h.criado_em}">${dataHora(h.criado_em)}</time>${h.observacao ? html`<span class="ajuda">${h.observacao}</span>` : ""}</li>`)}
        </ol>
        ${whats && !novo ? html`<p><a class="btn btn-whatsapp btn-bloco" href="${linkWhatsapp(loja.whatsapp, `Olá! Tenho uma dúvida sobre o pedido ${p.codigo}.`)}" target="_blank" rel="noopener">${icone("whatsapp")}Falar sobre este pedido</a></p>` : ""}
        ${p.status === "aguardando_confirmacao" ? html`<p><button class="btn btn-perigo btn-bloco" type="button" id="cancelarPedido">Cancelar pedido</button></p>` : ""}
      </div>`
  );

  $("#cancelarPedido")?.addEventListener("click", async (e) => {
    if (!confirm("Deseja mesmo cancelar este pedido?")) return;
    carregando(e.currentTarget, true);
    try {
      await post(`/pedidos/${p.id}/cancelar`);
      toast("Pedido cancelado.");
      carregar();
    } catch (erro) {
      toast(erro.message, { tipo: "erro" });
      carregando(e.currentTarget, false);
    }
  });

  for (const form of area.querySelectorAll(".form-avaliacao")) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = dadosDoForm(form);
      if (!dados.nota) {
        toast("Escolha de 1 a 5 estrelas.", { tipo: "erro" });
        return;
      }
      const botao = form.querySelector("[type=submit]");
      carregando(botao, true);
      try {
        const r = await post("/cliente/avaliacoes", { ...dados, pedido_id: p.id, produto_id: Number(form.dataset.produto) });
        toast(r.mensagem);
        carregar();
      } catch (erro) {
        mostrarErros(form, erro);
        carregando(botao, false);
      }
    });
  }
}

function formAvaliacao(item) {
  const pre = `av${item.produto_id}`;
  return html`<form class="form-avaliacao" data-produto="${item.produto_id}" novalidate>
    <p class="alerta alerta-erro" data-erro-form hidden tabindex="-1"></p>
    <fieldset class="escolha-estrelas">
      <legend class="rotulo">Como estava o ${item.nome_produto}?</legend>
      ${[5, 4, 3, 2, 1].map(
        (n) => html`<input type="radio" id="${pre}-${n}" name="nota" value="${n}" /><label for="${pre}-${n}" title="${n} estrela${n > 1 ? "s" : ""}">${icone("estrela", "")}<span class="sr-only">${n} estrela${n > 1 ? "s" : ""}</span></label>`
      )}
    </fieldset>
    <div class="campo">
      <label for="${pre}-texto">Comentário</label>
      <textarea class="entrada" id="${pre}-texto" name="texto" rows="3" minlength="10" maxlength="600" required></textarea>
    </div>
    <div><button class="btn btn-primario btn-pequeno" type="submit">Enviar avaliação</button></div>
  </form>`;
}

carregar();
