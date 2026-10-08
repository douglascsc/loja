import { iniciarApp } from "../app.js";
import { cardProduto, cardsDe, estrelas, ligarGrade } from "../componentes/produto.js";
import { get, post } from "../core/api.js";
import { $, $$, html, icone, prefereMenosMovimento, renderizar, urlSegura } from "../core/dom.js";
import { aplicarMascara, moeda, telefone } from "../core/formato.js";
import { enderecoTexto, horariosAgrupados, linkWhatsapp, redesSociais } from "../core/loja.js";
import { carregando, dadosDoForm, inclinarCards, limparErros, mostrarErros, revelar, toast } from "../core/ui.js";

const { loja: promessaLoja } = iniciarApp();
revelar($$(".revelar"));

// ---------------- Cardápio com abas ----------------
let produtos = [];
const grade = $("#gradeProdutos");
const abas = $("#abasCategorias");

function desenharProdutos(categoria) {
  const lista = (categoria ? produtos.filter((p) => p.categoria?.slug === categoria) : produtos).slice(0, 8);
  grade.setAttribute("aria-busy", "false");
  if (!lista.length) {
    renderizar(grade, html`<p class="vazio">Nenhum produto disponível nesta categoria hoje.</p>`);
    return;
  }
  renderizar(grade, lista.map((p, i) => cardProduto(p, i)));
  const cards = cardsDe(grade);
  cards.forEach((c, i) => c.style.setProperty("--i", i % 4));
  revelar(cards);
  inclinarCards(cards);
}

async function carregarCardapio() {
  try {
    const [rp, rc] = await Promise.all([get("/produtos"), get("/categorias")]);
    produtos = rp.produtos;
    const categorias = rc.categorias.filter((c) => produtos.some((p) => p.categoria?.slug === c.slug));
    renderizar(
      abas,
      [{ slug: "", nome: "Todos" }, ...categorias].map(
        (c, i) => html`<button class="aba" type="button" role="tab" data-categoria="${c.slug}" aria-selected="${i === 0}" aria-controls="gradeProdutos" tabindex="${i === 0 ? 0 : -1}">${c.nome}</button>`
      )
    );
    desenharProdutos("");
    iniciarSaborRotativo(produtos.filter((p) => !p.categoria || p.categoria.slug !== "kits").map((p) => p.nome));
  } catch {
    grade.setAttribute("aria-busy", "false");
    renderizar(grade, html`<div class="vazio">${icone("relogio")}<p>Não foi possível carregar o cardápio agora.</p><p><button class="btn btn-claro btn-pequeno" type="button" id="tentarDeNovo">Tentar de novo</button></p></div>`);
    $("#tentarDeNovo").addEventListener("click", carregarCardapio);
  }
}

// Abas acessíveis: setas do teclado movem entre categorias.
abas.addEventListener("click", (e) => {
  const aba = e.target.closest("[role=tab]");
  if (aba) selecionarAba(aba);
});
abas.addEventListener("keydown", (e) => {
  const lista = $$("[role=tab]", abas);
  const atual = lista.indexOf(document.activeElement);
  if (atual < 0) return;
  const destino = { ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: lista.length - 1 }[e.key];
  if (destino === undefined) return;
  e.preventDefault();
  const aba = lista[(destino + lista.length) % lista.length];
  aba.focus();
  selecionarAba(aba);
});

function selecionarAba(aba) {
  for (const a of $$("[role=tab]", abas)) {
    a.setAttribute("aria-selected", String(a === aba));
    a.tabIndex = a === aba ? 0 : -1;
  }
  desenharProdutos(aba.dataset.categoria);
}

ligarGrade(grade, (id) => produtos.find((p) => p.id === id));
carregarCardapio();

// ---------------- Sabor rotativo do hero ----------------
function iniciarSaborRotativo(nomes) {
  const el = $("#saborRotativo");
  if (!el || nomes.length < 2 || prefereMenosMovimento()) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    el.classList.add("trocando");
    setTimeout(() => {
      i = (i + 1) % nomes.length;
      el.textContent = nomes[i];
      el.classList.remove("trocando");
    }, 350);
  }, 2800);
}

// ---------------- Informações da loja ----------------
promessaLoja.then(async (loja) => {
  if (!loja) return;

  const selo = $("#seloStatus");
  selo.classList.toggle("aberta", loja.aberta);
  $("#textoStatus").textContent = loja.aberta
    ? "Aberto agora · pedidos saindo hoje"
    : loja.aceitando_pedidos
      ? "Fechado agora · agende seu pedido"
      : "Fechado no momento";

  try {
    const { bairros } = await get("/entrega/bairros");
    if (bairros.length) {
      const menor = Math.min(...bairros.map((b) => b.taxa));
      $("#chipEntrega").lastChild.textContent = menor === 0 ? "Entrega grátis" : `Entrega a partir de ${moeda(menor)}`;
    }
  } catch {
    /* mantém texto padrão */
  }

  // Redes sociais (a seção só aparece se houver alguma configurada)
  const redes = redesSociais(loja);
  if (redes.length) {
    renderizar(
      $("#botoesRedes"),
      redes.map((r) => html`<a class="btn btn-claro" href="${urlSegura(r.url)}" target="_blank" rel="noopener">${icone(r.icone)}${r.nome}</a>`)
    );
    $("#redes").hidden = false;
  }

  // Contato
  const whats = linkWhatsapp(loja.whatsapp, `Olá! Vim pelo site da ${loja.nome_loja}.`);
  const itens = [];
  if (whats) {
    itens.push(html`<li><a class="info-item whats" href="${whats}" target="_blank" rel="noopener">
      <span class="info-icone">${icone("whatsapp", "")}</span><span><strong>WhatsApp</strong><span>${telefone(loja.whatsapp)}</span></span></a></li>`);
  }
  if (loja.telefone) {
    itens.push(html`<li><a class="info-item" href="tel:+55${loja.telefone}">
      <span class="info-icone">${icone("telefone", "")}</span><span><strong>Telefone</strong><span>${telefone(loja.telefone)}</span></span></a></li>`);
  }
  if (loja.email) {
    itens.push(html`<li><a class="info-item" href="mailto:${loja.email}">
      <span class="info-icone">${icone("email", "")}</span><span><strong>E-mail</strong><span>${loja.email}</span></span></a></li>`);
  }
  const endereco = loja.endereco?.logradouro ? enderecoTexto(loja.endereco) : `${loja.cidade_entrega}/RS — entregas em toda a cidade`;
  itens.push(html`<li><div class="info-item">
    <span class="info-icone">${icone("pin", "")}</span><span><strong>Onde estamos</strong><span>${endereco}</span></span></div></li>`);
  itens.push(html`<li><div class="info-item">
    <span class="info-icone">${icone("relogio", "")}</span><span><strong>Horário de atendimento</strong>
    <span class="horarios">${horariosAgrupados(loja.horarios).map((h) => html`<span>${h.dias}</span><span>${h.texto}</span>`)}</span></span></div></li>`);
  renderizar($("#listaInfo"), itens);

  const consultaMapa = loja.endereco?.logradouro ? enderecoTexto(loja.endereco) : `${loja.cidade_entrega}, RS`;
  $("#mapa").src = `https://www.google.com/maps?q=${encodeURIComponent(consultaMapa)}&output=embed`;
});

// ---------------- Depoimentos (carrossel) ----------------
async function carregarDepoimentos() {
  const trilho = $("#carrosselTrilho");
  let depoimentos = [];
  try {
    depoimentos = (await get("/depoimentos")).depoimentos;
  } catch {
    /* segue com lista vazia */
  }
  if (!depoimentos.length) {
    renderizar(
      trilho,
      html`<figure class="depoimento ativo"><span class="aspas" aria-hidden="true">“</span>
        <blockquote>Seu depoimento pode aparecer aqui.</blockquote>
        <figcaption>Comprou com a gente? Avalie seu pedido em <a href="/conta#pedidos">Minha conta</a> depois da entrega.</figcaption></figure>`
    );
    return;
  }

  renderizar(
    trilho,
    depoimentos.map(
      (d, i) => html`<figure class="depoimento${i === 0 ? " ativo" : ""}" role="group" aria-roledescription="slide" aria-label="${i + 1} de ${depoimentos.length}" ${i === 0 ? "" : 'aria-hidden="true"'}>
        <span class="aspas" aria-hidden="true">“</span>
        ${d.exemplo ? html`<span class="selo-exemplo">Depoimento de exemplo</span>` : ""}
        <blockquote>${d.texto}</blockquote>
        ${estrelas(d.nota, 1, { compacto: true })}
        <figcaption><strong>${d.nome_exibicao}</strong>${d.cidade ? `, ${d.cidade}` : ""}${d.produto_nome ? html` · provou <a href="/produto/${encodeURIComponent(d.produto_slug)}">${d.produto_nome}</a>` : ""}</figcaption>
      </figure>`
    )
  );
  if (depoimentos.length < 2) return;

  const slides = $$(".depoimento", trilho);
  const pontos = $("#carrosselPontos");
  renderizar(pontos, slides.map((_, i) => html`<button type="button" data-ir="${i}" aria-label="Ir para o depoimento ${i + 1}" aria-current="${i === 0}"></button>`));
  $("#carrosselControles").hidden = false;

  let atual = 0;
  let timer = null;
  const tempo = 6500;

  function ir(n) {
    const anterior = slides[atual];
    atual = (n + slides.length) % slides.length;
    for (const [i, s] of slides.entries()) {
      s.classList.toggle("ativo", i === atual);
      s.classList.toggle("saindo", s === anterior && i !== atual);
      s.toggleAttribute("aria-hidden", i !== atual);
      for (const link of $$("a", s)) link.tabIndex = i === atual ? 0 : -1;
    }
    for (const [i, p] of $$("button", pontos).entries()) p.setAttribute("aria-current", String(i === atual));
  }
  ir(0);

  const iniciar = () => {
    if (prefereMenosMovimento()) return;
    clearInterval(timer);
    timer = setInterval(() => !document.hidden && ir(atual + 1), tempo);
  };
  const pausar = () => clearInterval(timer);

  $("#depAnterior").addEventListener("click", () => { ir(atual - 1); iniciar(); });
  $("#depProximo").addEventListener("click", () => { ir(atual + 1); iniciar(); });
  pontos.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ir]");
    if (b) { ir(Number(b.dataset.ir)); iniciar(); }
  });

  // Pausa ao passar o mouse ou focar (WCAG 2.2.2)
  const carrossel = $("#carrossel");
  carrossel.addEventListener("mouseenter", pausar);
  carrossel.addEventListener("mouseleave", iniciar);
  carrossel.addEventListener("focusin", pausar);
  carrossel.addEventListener("focusout", iniciar);

  // Gestos de arrastar no celular
  let x0 = null;
  trilho.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  trilho.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 45) { ir(atual + (dx < 0 ? 1 : -1)); iniciar(); }
  });
  iniciar();
}
carregarDepoimentos();

// ---------------- Formulário de contato ----------------
const formContato = $("#formContato");
aplicarMascara($("#contatoTelefone"), "telefone");
formContato.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErros(formContato);
  if (!formContato.checkValidity()) {
    formContato.reportValidity();
    return;
  }
  const botao = formContato.querySelector("[type=submit]");
  carregando(botao, true);
  try {
    await post("/contato", dadosDoForm(formContato));
    formContato.reset();
    toast("Mensagem enviada! Responderemos em breve.");
  } catch (erro) {
    mostrarErros(formContato, erro);
  } finally {
    carregando(botao, false);
  }
});
