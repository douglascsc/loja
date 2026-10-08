import { carrinho } from "../core/carrinho.js";
import { $$, html, icone, urlSegura } from "../core/dom.js";
import { moeda } from "../core/formato.js";
import { confeitos, toast } from "../core/ui.js";

export const ETIQUETAS = {
  mais_vendido: "Mais vendido",
  novo: "Novo",
  promocao: "Promoção",
  edicao_limitada: "Edição limitada",
};

export function estrelas(nota, total, { compacto = false } = {}) {
  if (!total) return "";
  const cheias = Math.round(nota);
  return html`<span class="estrelas">
    <span class="estrelas-icones" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => icone("estrela", n <= cheias ? "cheia" : ""))}</span>
    <span class="sr-only">Nota ${String(nota).replace(".", ",")} de 5,</span>
    <span>${String(nota).replace(".", ",")}${compacto ? "" : html` <span aria-hidden="true">(${total})</span><span class="sr-only">${total} avaliações</span>`}</span>
  </span>`;
}

export function preco(p) {
  if (p.preco_promocional) {
    const desconto = Math.round((1 - p.preco_promocional / p.preco) * 100);
    return html`<div class="preco">
      <span class="preco-atual"><span class="sr-only">Por </span>${moeda(p.preco_final)}</span>
      <del class="preco-antigo"><span class="sr-only">De </span>${moeda(p.preco)}</del>
      <span class="preco-desconto">-${desconto}%</span>
    </div>`;
  }
  return html`<div class="preco"><span class="preco-atual">${moeda(p.preco_final)}</span></div>`;
}

export function disponibilidade(p) {
  if (p.esgotado) return html`<span class="disponibilidade esgotado">Esgotado hoje</span>`;
  if (p.estoque <= 5) return html`<span class="disponibilidade ultimas">Últimas ${p.estoque} unidades</span>`;
  return html`<span class="disponibilidade">Disponível</span>`;
}

export function cardProduto(p, i = 0) {
  const url = `/produto/${encodeURIComponent(p.slug)}`;
  return html`<article class="card-produto revelar${p.esgotado ? " esgotado" : ""}" data-i="${i}">
    ${p.etiqueta ? html`<span class="etiqueta card-etiqueta etiqueta-${p.etiqueta}">${ETIQUETAS[p.etiqueta] || ""}</span>` : ""}
    <div class="card-imagem">
      <img src="${urlSegura(p.imagem, "/assets/logo.svg")}" alt="Pote de ${p.nome}" width="400" height="400" loading="lazy" decoding="async" />
    </div>
    <div class="card-corpo">
      <div class="card-topo">
        <span>${p.tamanho || ""}</span>
        ${estrelas(p.nota_media, p.total_avaliacoes, { compacto: true })}
      </div>
      <h3><a href="${url}">${p.nome}</a></h3>
      <p class="card-descricao">${p.descricao}</p>
      ${disponibilidade(p)}
      <div class="card-rodape">
        ${preco(p)}
        <button class="btn btn-primario btn-adicionar" type="button" data-adicionar="${p.id}" ${p.esgotado ? "disabled" : ""}
          aria-label="${p.esgotado ? `${p.nome} esgotado` : `Adicionar ${p.nome} ao carrinho`}">
          ${icone(p.esgotado ? "relogio" : "sacola")}<span>${p.esgotado ? "Esgotado" : "Adicionar"}</span>
        </button>
      </div>
    </div>
  </article>`;
}

/** Adiciona um produto ao carrinho com feedback visual e sonoro (leitor de tela). */
export function adicionarAoCarrinho(produto, qtd, botao) {
  const adicionados = carrinho.adicionar(produto, qtd);
  if (adicionados <= 0) {
    toast(`Você já tem todas as unidades disponíveis de ${produto.nome} no carrinho.`, { tipo: "erro" });
    return false;
  }
  confeitos(botao);
  if (botao) {
    botao.classList.add("adicionado");
    setTimeout(() => botao.classList.remove("adicionado"), 1200);
  }
  toast(`${produto.nome} adicionado ao carrinho.`, {
    acao: { rotulo: "Ver carrinho", fn: () => document.dispatchEvent(new CustomEvent("carrinho:abrir")) },
  });
  return true;
}

/** Liga os botões "Adicionar" de uma grade (delegação de eventos). */
export function ligarGrade(container, obterProduto) {
  container.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-adicionar]");
    if (!botao || botao.disabled) return;
    const produto = obterProduto(Number(botao.dataset.adicionar));
    if (produto) adicionarAoCarrinho(produto, 1, botao);
  });
}

export const cardsDe = (container) => $$(".card-produto", container);
