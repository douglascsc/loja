import { iniciarApp } from "../app.js";
import { adicionarAoCarrinho, cardProduto, cardsDe, disponibilidade, estrelas, ETIQUETAS, ligarGrade, preco } from "../componentes/produto.js";
import { get } from "../core/api.js";
import { carrinho } from "../core/carrinho.js";
import { $, html, icone, renderizar, urlSegura } from "../core/dom.js";
import { data, moeda } from "../core/formato.js";
import { revelar } from "../core/ui.js";

const { loja } = iniciarApp();
const slug = document.body.dataset.slug;
const detalhe = $("#produtoDetalhe");

async function carregar() {
  let r;
  try {
    r = await get(`/produtos/${encodeURIComponent(slug)}`);
  } catch {
    renderizar(detalhe, html`<p class="vazio">Não foi possível carregar este produto. <a href="/produtos">Voltar ao cardápio</a>.</p>`);
    return;
  }
  const p = r.produto;
  const maximo = Math.max(0, Math.min(50, p.estoque) - carrinho.quantidadeDe(p.id));

  detalhe.setAttribute("aria-busy", "false");
  renderizar(
    detalhe,
    html`<div class="produto-galeria">
        ${p.etiqueta ? html`<span class="etiqueta etiqueta-${p.etiqueta}">${ETIQUETAS[p.etiqueta]}</span>` : ""}
        <img src="${urlSegura(p.imagem, "/assets/logo.svg")}" alt="Pote de ${p.nome}" width="600" height="600" />
      </div>
      <div class="produto-info">
        ${p.categoria ? html`<a class="categoria" href="/produtos/${p.categoria.slug}">${p.categoria.nome}</a>` : ""}
        <h1>${p.nome}</h1>
        ${estrelas(p.nota_media, p.total_avaliacoes)}
        ${preco(p)}
        <p class="descricao">${p.descricao}</p>
        ${disponibilidade(p)}
        <form class="produto-compra" id="formCompra">
          <div class="quantidade" role="group" aria-label="Quantidade">
            <button type="button" id="qtdMenos" aria-label="Diminuir quantidade">${icone("menos", "")}</button>
            <input id="qtd" name="qtd" type="number" inputmode="numeric" min="1" max="${Math.max(1, maximo)}" value="1" aria-label="Quantidade" />
            <button type="button" id="qtdMais" aria-label="Aumentar quantidade">${icone("mais", "")}</button>
          </div>
          <button class="btn btn-primario btn-grande" type="submit" ${p.esgotado || maximo === 0 ? "disabled" : ""}>
            ${icone("sacola")} ${p.esgotado ? "Esgotado hoje" : maximo === 0 ? "Limite no carrinho" : "Adicionar ao carrinho"}
          </button>
        </form>
        <ul class="produto-extras">
          ${p.tamanho ? html`<li>${icone("pacote")}${p.tamanho}</li>` : ""}
          <li>${icone("caminhao")}<span id="infoEntrega">Entrega em Campo Bom ou retirada no local</span></li>
          <li>${icone("escudo")}Pote lacrado, conserve refrigerado e consuma em até 3 dias</li>
        </ul>
        ${p.ingredientes ? html`<details class="sanfona"><summary>Ingredientes e alérgenos</summary><p>${p.ingredientes}</p></details>` : ""}
      </div>`
  );

  const input = $("#qtd");
  const ajustar = (n) => {
    input.value = String(Math.min(Math.max(1, n || 1), Math.max(1, maximo)));
  };
  $("#qtdMenos").addEventListener("click", () => ajustar(Number(input.value) - 1));
  $("#qtdMais").addEventListener("click", () => ajustar(Number(input.value) + 1));
  input.addEventListener("change", () => ajustar(Number(input.value)));
  $("#formCompra").addEventListener("submit", (e) => {
    e.preventDefault();
    const botao = e.submitter || $("#formCompra [type=submit]");
    if (adicionarAoCarrinho(p, Number(input.value), botao)) ajustar(1);
  });

  // Avaliações
  if (r.avaliacoes.length) {
    $("#secaoAvaliacoes").hidden = false;
    renderizar(
      $("#listaAvaliacoes"),
      r.avaliacoes.map(
        (a) => html`<li>${estrelas(a.nota, 1, { compacto: true })}<p>${a.texto}</p>
          <span class="autor">${a.nome_exibicao}${a.cidade ? `, ${a.cidade}` : ""} · ${data(a.criado_em)}${a.exemplo ? " · exemplo" : ""}</span></li>`
      )
    );
  }

  // Relacionados
  try {
    const { produtos } = await get(`/produtos${p.categoria ? `?categoria=${p.categoria.slug}` : ""}`);
    const outros = produtos.filter((x) => x.id !== p.id).slice(0, 4);
    if (outros.length) {
      $("#secaoRelacionados").hidden = false;
      const grade = $("#gradeRelacionados");
      renderizar(grade, outros.map((x, i) => cardProduto(x, i)));
      revelar(cardsDe(grade));
      ligarGrade(grade, (id) => outros.find((x) => x.id === id));
    }
  } catch {
    /* opcional */
  }

  // Taxa mínima de entrega
  try {
    const { bairros } = await get("/entrega/bairros");
    const l = await loja;
    if (bairros.length && l) {
      const menor = Math.min(...bairros.map((b) => b.taxa));
      $("#infoEntrega").textContent = `Entrega em ${l.cidade_entrega} a partir de ${moeda(menor)}${l.permite_retirada ? " ou retirada grátis" : ""}`;
    }
  } catch {
    /* opcional */
  }
}

carregar();
