import { iniciarApp } from "../app.js";
import { cardProduto, cardsDe, ligarGrade } from "../componentes/produto.js";
import { get } from "../core/api.js";
import { $, html, icone, renderizar } from "../core/dom.js";
import { plural } from "../core/formato.js";
import { inclinarCards, revelar } from "../core/ui.js";

iniciarApp();

const categoriaAtual = document.body.dataset.categoria || "";
const grade = $("#gradeCatalogo");
const campo = $("#campoBusca");
let produtos = [];

function desenhar() {
  const termo = campo.value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const semAcento = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lista = termo ? produtos.filter((p) => semAcento(`${p.nome} ${p.descricao}`).includes(termo)) : produtos;
  grade.setAttribute("aria-busy", "false");
  $("#contagem").textContent = plural(lista.length, "produto encontrado", "produtos encontrados");
  if (!lista.length) {
    renderizar(grade, html`<div class="vazio">${icone("busca")}<p>Nenhum sabor encontrado${termo ? html` para “${campo.value}”` : ""}.</p></div>`);
    return;
  }
  renderizar(grade, lista.map((p, i) => cardProduto(p, i)));
  const cards = cardsDe(grade);
  cards.forEach((c, i) => c.style.setProperty("--i", i % 4));
  revelar(cards);
  inclinarCards(cards);
}

async function carregar() {
  try {
    const [rp, rc] = await Promise.all([
      get(`/produtos${categoriaAtual ? `?categoria=${encodeURIComponent(categoriaAtual)}` : ""}`),
      get("/categorias"),
    ]);
    produtos = rp.produtos;
    const abas = $("#abasCatalogo");
    renderizar(
      abas,
      [{ slug: "", nome: "Todos" }, ...rc.categorias].map((c) => {
        const atual = c.slug === categoriaAtual;
        return html`<a class="aba" href="${c.slug ? `/produtos/${c.slug}` : "/produtos"}" ${atual ? 'aria-current="true"' : ""}>${c.nome}</a>`;
      })
    );
    const cat = rc.categorias.find((c) => c.slug === categoriaAtual);
    if (cat) {
      $("#tituloCatalogo").textContent = cat.nome;
      if (cat.descricao) $("#descricaoCatalogo").textContent = cat.descricao;
      const trilha = $(".trilha ol");
      renderizar(trilha, html`<li><a href="/">Início</a></li><li><a href="/produtos">Cardápio</a></li><li aria-current="page">${cat.nome}</li>`);
    }
    desenhar();
  } catch {
    grade.setAttribute("aria-busy", "false");
    renderizar(grade, html`<p class="vazio">Não foi possível carregar o cardápio. Recarregue a página.</p>`);
  }
}

$("#formBusca").addEventListener("submit", (e) => e.preventDefault());
let espera;
campo.addEventListener("input", () => {
  clearTimeout(espera);
  espera = setTimeout(desenhar, 150);
});

ligarGrade(grade, (id) => produtos.find((p) => p.id === id));
carregar();
