import { del, enviarArquivo, get, patch, post, put } from "/js/core/api.js";
import { $, html, icone, renderizar, urlSegura } from "/js/core/dom.js";
import { moeda } from "/js/core/formato.js";
import { carregando, dadosDoForm, limparErros, mostrarErros, toast } from "/js/core/ui.js";
import { ETIQUETAS } from "/js/componentes/produto.js";
import { abrirDialogo, fecharDialogo, iniciarAdmin, lerReais, paraReais } from "./comum.js";

iniciarAdmin();

let produtos = [];
let categorias = [];

const interruptor = (nome, id, marcado, rotulo) =>
  html`<label class="interruptor"><input type="checkbox" data-alternar="${nome}" data-id="${id}" ${marcado ? "checked" : ""} /><span class="trilho"></span><span class="sr-only">${rotulo}</span></label>`;

function desenhar() {
  const termo = $("#busca").value.trim().toLowerCase();
  const lista = produtos.filter((p) => !termo || p.nome.toLowerCase().includes(termo));
  renderizar(
    $("#listaProdutos"),
    lista.length
      ? lista.map(
          (p) => html`<tr>
            <td class="principal" data-rotulo="Produto"><span class="nome-produto">
              <img class="miniatura" src="${urlSegura(p.imagem, "/assets/logo.svg")}" alt="" width="48" height="48" loading="lazy" />
              <span><strong>${p.nome}</strong>${p.etiqueta ? html`<span class="secundario">${ETIQUETAS[p.etiqueta]}</span>` : ""}</span></span></td>
            <td data-rotulo="Categoria">${p.categoria_nome || "—"}</td>
            <td class="num" data-rotulo="Preço">${p.preco_promocional ? html`<strong>${moeda(p.preco_promocional)}</strong><span class="secundario"><del>${moeda(p.preco)}</del></span>` : moeda(p.preco)}</td>
            <td class="num" data-rotulo="Estoque"><label class="sr-only" for="est-${p.id}">Estoque de ${p.nome}</label>
              <input class="entrada entrada-estoque" id="est-${p.id}" type="number" min="0" max="100000" value="${p.estoque}" data-estoque="${p.id}" /></td>
            <td data-rotulo="Na loja">${interruptor("disponivel", p.id, p.disponivel, `${p.nome} visível na loja`)}</td>
            <td data-rotulo="Destaque">${interruptor("destaque", p.id, p.destaque, `${p.nome} em destaque`)}</td>
            <td class="num" data-rotulo="Vendidos">${p.vendidos}</td>
            <td data-rotulo="Ações"><span class="acoes">
              <a class="btn btn-fantasma btn-pequeno" href="/produto/${p.slug}" target="_blank" rel="noopener" aria-label="Ver ${p.nome} na loja">Ver</a>
              <button class="btn btn-claro btn-pequeno" type="button" data-editar="${p.id}">Editar</button>
              <button class="btn btn-perigo btn-pequeno" type="button" data-excluir="${p.id}" aria-label="Excluir ${p.nome}">${icone("lixeira")}</button>
            </span></td>
          </tr>`
        )
      : html`<tr><td colspan="8">Nenhum produto encontrado.</td></tr>`
  );
}

async function carregar() {
  const [rp, rc] = await Promise.all([get("/admin/produtos"), get("/admin/categorias")]);
  produtos = rp.produtos;
  categorias = rc.categorias;
  desenhar();
  desenharCategorias();
}

// ---------- Edição rápida: estoque e interruptores ----------
$("#listaProdutos").addEventListener("change", async (e) => {
  const alvo = e.target;
  const id = Number(alvo.dataset.estoque || alvo.dataset.id);
  if (!id) return;
  const campos = alvo.dataset.estoque ? { estoque: Number(alvo.value) } : { [alvo.dataset.alternar]: alvo.checked };
  if (campos.estoque !== undefined && (!Number.isInteger(campos.estoque) || campos.estoque < 0)) {
    toast("Estoque inválido.", { tipo: "erro" });
    return;
  }
  try {
    const { produto } = await patch(`/admin/produtos/${id}`, campos);
    Object.assign(produtos.find((p) => p.id === id), produto);
    toast(`${produto.nome} atualizado.`);
  } catch (erro) {
    toast(erro.message, { tipo: "erro" });
    carregar();
  }
});

$("#listaProdutos").addEventListener("click", async (e) => {
  const editar = e.target.closest("[data-editar]");
  const excluir = e.target.closest("[data-excluir]");
  if (editar) abrirFormulario(produtos.find((p) => p.id === Number(editar.dataset.editar)));
  if (excluir) {
    const p = produtos.find((x) => x.id === Number(excluir.dataset.excluir));
    const dica = p.vendidos ? "\n\nEle aparece em pedidos antigos; o histórico será mantido. Se quiser só tirar da loja, use o interruptor “Na loja”." : "";
    if (!confirm(`Excluir “${p.nome}” definitivamente?${dica}`)) return;
    try {
      await del(`/admin/produtos/${p.id}`);
      toast("Produto excluído.");
      carregar();
    } catch (erro) {
      toast(erro.message, { tipo: "erro" });
    }
  }
});

// ---------- Formulário de produto ----------
function abrirFormulario(p = null) {
  const corpo = abrirDialogo(
    p ? `Editar ${p.nome}` : "Novo produto",
    html`<form class="form" id="formProduto" novalidate>
      <p class="alerta alerta-erro" data-erro-form hidden tabindex="-1" role="alert"></p>
      <div class="previa-imagem">
        <img id="previa" src="${urlSegura(p?.imagem, "/assets/logo.svg")}" alt="" width="96" height="96" />
        <div class="campo">
          <label for="pImagem">Foto do produto</label>
          <input id="pImagem" type="file" accept="image/jpeg,image/png,image/webp" />
          <p class="ajuda">JPG, PNG ou WebP até 2 MB. Ideal: quadrada, 800×800 px.</p>
        </div>
      </div>
      <div class="campo"><label for="pNome">Nome</label><input class="entrada" id="pNome" name="nome" required maxlength="100" value="${p?.nome || ""}" /></div>
      <div class="form-linha">
        <div class="campo"><label for="pCategoria">Categoria</label>
          <select class="entrada" id="pCategoria" name="categoria_id"><option value="">Sem categoria</option>
            ${categorias.map((c) => html`<option value="${c.id}" ${p?.categoria_id === c.id ? "selected" : ""}>${c.nome}</option>`)}</select></div>
        <div class="campo"><label for="pEtiqueta">Etiqueta</label>
          <select class="entrada" id="pEtiqueta" name="etiqueta"><option value="">Nenhuma</option>
            ${Object.entries(ETIQUETAS).map(([v, n]) => html`<option value="${v}" ${p?.etiqueta === v ? "selected" : ""}>${n}</option>`)}</select></div>
      </div>
      <div class="campo"><label for="pDescricao">Descrição</label><textarea class="entrada" id="pDescricao" name="descricao" rows="3" maxlength="2000">${p?.descricao || ""}</textarea></div>
      <div class="campo"><label for="pIngredientes">Ingredientes e alérgenos <span class="opcional">(opcional)</span></label><textarea class="entrada" id="pIngredientes" name="ingredientes" rows="2" maxlength="1000">${p?.ingredientes || ""}</textarea></div>
      <div class="form-linha">
        <div class="campo"><label for="pPreco">Preço (R$)</label><input class="entrada" id="pPreco" name="preco" inputmode="decimal" required value="${paraReais(p?.preco)}" placeholder="15,90" /></div>
        <div class="campo"><label for="pPromo">Preço promocional <span class="opcional">(opcional)</span></label><input class="entrada" id="pPromo" name="preco_promocional" inputmode="decimal" value="${paraReais(p?.preco_promocional)}" /></div>
        <div class="campo"><label for="pEstoque">Estoque</label><input class="entrada" id="pEstoque" name="estoque" type="number" min="0" required value="${p?.estoque ?? 0}" /></div>
      </div>
      <div class="form-linha">
        <div class="campo"><label for="pTamanho">Tamanho <span class="opcional">(opcional)</span></label><input class="entrada" id="pTamanho" name="tamanho" maxlength="40" value="${p?.tamanho || "250 ml"}" /></div>
        <div class="campo"><label for="pOrdem">Ordem no cardápio</label><input class="entrada" id="pOrdem" name="ordem" type="number" min="0" value="${p?.ordem ?? 0}" /></div>
        <div class="campo"><label for="pSlug">Endereço (slug) <span class="opcional">(automático)</span></label><input class="entrada" id="pSlug" name="slug" maxlength="80" value="${p?.slug || ""}" /></div>
      </div>
      <label class="interruptor"><input type="checkbox" name="disponivel" ${!p || p.disponivel ? "checked" : ""} /><span class="trilho"></span>Visível na loja</label>
      <label class="interruptor"><input type="checkbox" name="destaque" ${p?.destaque ? "checked" : ""} /><span class="trilho"></span>Destaque na página inicial</label>
      <div class="form-linha"><button class="btn btn-primario" type="submit">Salvar produto</button><button class="btn btn-claro" type="button" data-fechar-dialogo>Cancelar</button></div>
    </form>`
  );

  const form = corpo.querySelector("#formProduto");
  const arquivo = corpo.querySelector("#pImagem");
  arquivo.addEventListener("change", () => {
    const f = arquivo.files[0];
    if (f && f.size > 2 * 1024 * 1024) {
      toast("Imagem maior que 2 MB.", { tipo: "erro" });
      arquivo.value = "";
      return;
    }
    if (f) corpo.querySelector("#previa").src = URL.createObjectURL(f);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limparErros(form);
    const d = dadosDoForm(form);
    const preco = lerReais(d.preco);
    const promo = lerReais(d.preco_promocional);
    if (preco == null || Number.isNaN(preco)) return mostrarErros(form, { message: "Informe um preço válido.", dados: { detalhes: { campos: { preco: "Preço inválido." } } } });
    if (Number.isNaN(promo)) return mostrarErros(form, { message: "Preço promocional inválido.", dados: { detalhes: { campos: { preco_promocional: "Valor inválido." } } } });
    const corpoReq = {
      ...d,
      preco,
      preco_promocional: promo,
      categoria_id: d.categoria_id ? Number(d.categoria_id) : null,
      etiqueta: d.etiqueta || null,
      estoque: Number(d.estoque),
      ordem: Number(d.ordem || 0),
      disponivel: form.elements.disponivel.checked,
      destaque: form.elements.destaque.checked,
    };
    delete corpoReq.imagem;
    const botao = form.querySelector("[type=submit]");
    carregando(botao, true);
    try {
      const { produto } = p ? await put(`/admin/produtos/${p.id}`, corpoReq) : await post("/admin/produtos", corpoReq);
      if (arquivo.files[0]) {
        const fd = new FormData();
        fd.append("imagem", arquivo.files[0]);
        await enviarArquivo(`/admin/produtos/${produto.id}/imagem`, fd);
      }
      toast(p ? "Produto atualizado." : "Produto criado.");
      fecharDialogo();
      carregar();
    } catch (erro) {
      mostrarErros(form, erro);
      carregando(botao, false);
    }
  });
}

$("#novoProduto").addEventListener("click", () => abrirFormulario());
$("#busca").addEventListener("input", desenhar);
$("#formBusca").addEventListener("submit", (e) => e.preventDefault());

// ---------- Categorias ----------
function desenharCategorias() {
  renderizar(
    $("#listaCategorias"),
    categorias.map(
      (c) => html`<tr>
        <td class="principal" data-rotulo="Nome"><strong>${c.nome}</strong></td>
        <td data-rotulo="Endereço"><a href="/produtos/${c.slug}" target="_blank" rel="noopener">/produtos/${c.slug}</a></td>
        <td class="num" data-rotulo="Produtos">${c.total_produtos}</td>
        <td data-rotulo="Ativa">${c.ativo ? "Sim" : "Não"}</td>
        <td data-rotulo="Ações"><span class="acoes">
          <button class="btn btn-claro btn-pequeno" type="button" data-editar-cat="${c.id}">Editar</button>
          <button class="btn btn-perigo btn-pequeno" type="button" data-excluir-cat="${c.id}" aria-label="Excluir categoria ${c.nome}">${icone("lixeira")}</button>
        </span></td></tr>`
    )
  );
}

function formCategoria(c = null) {
  const corpo = abrirDialogo(
    c ? `Editar categoria` : "Nova categoria",
    html`<form class="form" id="formCategoria" novalidate>
      <p class="alerta alerta-erro" data-erro-form hidden tabindex="-1" role="alert"></p>
      <div class="campo"><label for="cNome">Nome</label><input class="entrada" id="cNome" name="nome" required maxlength="60" value="${c?.nome || ""}" /></div>
      <div class="campo"><label for="cDescricao">Descrição <span class="opcional">(opcional)</span></label><input class="entrada" id="cDescricao" name="descricao" maxlength="300" value="${c?.descricao || ""}" /></div>
      <div class="form-linha">
        <div class="campo"><label for="cSlug">Endereço (slug) <span class="opcional">(automático)</span></label><input class="entrada" id="cSlug" name="slug" maxlength="80" value="${c?.slug || ""}" /></div>
        <div class="campo"><label for="cOrdem">Ordem</label><input class="entrada" id="cOrdem" name="ordem" type="number" min="0" value="${c?.ordem ?? 0}" /></div>
      </div>
      <label class="interruptor"><input type="checkbox" name="ativo" ${!c || c.ativo ? "checked" : ""} /><span class="trilho"></span>Categoria ativa</label>
      <div class="form-linha"><button class="btn btn-primario" type="submit">Salvar</button><button class="btn btn-claro" type="button" data-fechar-dialogo>Cancelar</button></div>
    </form>`
  );
  const form = corpo.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limparErros(form);
    const dados = { ...dadosDoForm(form), ordem: Number(form.elements.ordem.value || 0), ativo: form.elements.ativo.checked };
    try {
      c ? await put(`/admin/categorias/${c.id}`, dados) : await post("/admin/categorias", dados);
      toast("Categoria salva.");
      fecharDialogo();
      carregar();
    } catch (erro) {
      mostrarErros(form, erro);
    }
  });
}

$("#novaCategoria").addEventListener("click", () => formCategoria());
$("#listaCategorias").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-editar-cat]");
  const ex = e.target.closest("[data-excluir-cat]");
  if (ed) formCategoria(categorias.find((c) => c.id === Number(ed.dataset.editarCat)));
  if (ex) {
    const c = categorias.find((x) => x.id === Number(ex.dataset.excluirCat));
    if (!confirm(`Excluir a categoria “${c.nome}”? Os produtos dela ficarão sem categoria.`)) return;
    try {
      await del(`/admin/categorias/${c.id}`);
      toast("Categoria excluída.");
      carregar();
    } catch (erro) {
      toast(erro.message, { tipo: "erro" });
    }
  }
});

await carregar();
const editar = new URLSearchParams(location.search).get("editar");
if (editar) abrirFormulario(produtos.find((p) => p.id === Number(editar)));
