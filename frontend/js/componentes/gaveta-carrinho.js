import { carrinho } from "../core/carrinho.js";
import { $, html, icone, renderizar, urlSegura } from "../core/dom.js";
import { moeda, plural } from "../core/formato.js";
import { criarGaveta, toast } from "../core/ui.js";

const avisos = new Map();

function desenhar() {
  const lista = $("#itensCarrinho");
  const rodape = $("#rodapeCarrinho");
  const itens = carrinho.itens();
  const total = carrinho.quantidadeTotal();

  const contador = $("#contadorCarrinho");
  if (contador) {
    if (contador.textContent !== String(total)) {
      contador.textContent = total;
      contador.classList.remove("pulo");
      void contador.offsetWidth;
      contador.classList.add("pulo");
    }
    contador.hidden = total === 0;
  }
  const descricao = $("#descricaoCarrinho");
  if (descricao) descricao.textContent = total ? `, ${plural(total, "item", "itens")}` : ", vazio";

  if (!lista) return;
  if (!itens.length) {
    renderizar(
      lista,
      html`<div class="vazio">${icone("sacola")}<p><strong>Seu carrinho está vazio.</strong></p><p>Que tal começar pelo nosso mais vendido?</p>
        <p><a class="btn btn-claro btn-pequeno" href="/produtos">Ver cardápio</a></p></div>`
    );
    rodape.hidden = true;
    return;
  }
  rodape.hidden = false;
  renderizar(
    lista,
    itens.map(
      (i) => html`<div class="item-carrinho">
        <img src="${urlSegura(i.imagem, "/assets/logo.svg")}" alt="" width="72" height="72" loading="lazy" />
        <div class="item-carrinho-info">
          <div class="item-carrinho-nome">
            <a href="/produto/${encodeURIComponent(i.slug || "")}">${i.nome}</a>
            <span>${moeda(i.preco * i.qtd)}</span>
          </div>
          <span class="ajuda">${moeda(i.preco)} cada</span>
          ${avisos.get(i.id) ? html`<span class="aviso-item">${avisos.get(i.id)}</span>` : ""}
          <div class="item-carrinho-acoes">
            <div class="quantidade" role="group" aria-label="Quantidade de ${i.nome}">
              <button type="button" data-menos="${i.id}" aria-label="Diminuir quantidade de ${i.nome}">${icone("menos", "")}</button>
              <output aria-live="polite">${i.qtd}</output>
              <button type="button" data-mais="${i.id}" aria-label="Aumentar quantidade de ${i.nome}" ${i.qtd >= Math.min(50, i.estoque ?? 50) ? "disabled" : ""}>${icone("mais", "")}</button>
            </div>
            <button class="btn-remover" type="button" data-remover="${i.id}" aria-label="Remover ${i.nome} do carrinho">${icone("lixeira", "")}</button>
          </div>
        </div>
      </div>`
    )
  );
  $("#subtotalCarrinho").textContent = moeda(carrinho.subtotal());
}

/** Reconfere o carrinho com o servidor e avisa o que mudou. */
export async function sincronizarCarrinho({ silencioso = false } = {}) {
  try {
    const r = await carrinho.sincronizar();
    avisos.clear();
    for (const p of r.problemas || []) {
      if (p.tipo === "estoque") avisos.set(p.produto_id, `Ajustamos para ${p.disponivel} (estoque disponível).`);
    }
    const removidos = (r.problemas || []).filter((p) => p.tipo !== "estoque");
    if (removidos.length && !silencioso) {
      toast(`${plural(removidos.length, "item saiu", "itens saíram")} do carrinho por falta de estoque.`, { tipo: "erro" });
    }
    desenhar();
    return r;
  } catch {
    return null; // sem conexão: mantém o carrinho local
  }
}

export function iniciarGavetaCarrinho() {
  const painel = $("#gavetaCarrinho");
  if (!painel) return;
  const gaveta = criarGaveta({
    painel,
    fundo: $("#sombraCarrinho"),
    gatilho: $("#abrirCarrinho"),
    aoAbrir: () => sincronizarCarrinho(),
  });

  $("#abrirCarrinho")?.addEventListener("click", gaveta.abrir);
  $("#fecharCarrinho").addEventListener("click", gaveta.fechar);
  $("#continuarComprando").addEventListener("click", () => {
    gaveta.fechar();
    if (!location.pathname.startsWith("/produto")) location.href = "/produtos";
  });
  document.addEventListener("carrinho:abrir", gaveta.abrir);

  $("#itensCarrinho").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mais) carrinho.definir(Number(b.dataset.mais), carrinho.quantidadeDe(Number(b.dataset.mais)) + 1);
    if (b.dataset.menos) carrinho.definir(Number(b.dataset.menos), carrinho.quantidadeDe(Number(b.dataset.menos)) - 1);
    if (b.dataset.remover) {
      carrinho.remover(Number(b.dataset.remover));
      painel.focus();
    }
    // Mantém o foco no mesmo botão após redesenhar.
    const seletor = b.dataset.mais ? `[data-mais="${b.dataset.mais}"]` : b.dataset.menos ? `[data-menos="${b.dataset.menos}"]` : null;
    if (seletor) requestAnimationFrame(() => ($(seletor) || painel).focus());
  });

  carrinho.ouvir(desenhar);
  desenhar();
  return gaveta;
}
