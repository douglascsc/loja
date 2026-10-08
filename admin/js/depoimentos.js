import { del, get, post, put } from "/js/core/api.js";
import { $, html, icone, renderizar } from "/js/core/dom.js";
import { data } from "/js/core/formato.js";
import { dadosDoForm, limparErros, mostrarErros, toast } from "/js/core/ui.js";
import { abrirDialogo, atualizarContagens, fecharDialogo, iniciarAdmin } from "./comum.js";

iniciarAdmin();
let depoimentos = [];
let produtos = [];

async function carregar() {
  [{ depoimentos }, { produtos }] = await Promise.all([get("/admin/depoimentos"), get("/admin/produtos")]);
  $("#avisoExemplos").hidden = !depoimentos.some((d) => d.exemplo);
  renderizar(
    $("#listaDepoimentos"),
    depoimentos.length
      ? depoimentos.map(
          (d) => html`<tr>
            <td class="principal" data-rotulo="Depoimento"><span><strong>${d.nome_exibicao}</strong>${d.cidade ? `, ${d.cidade}` : ""}${d.exemplo ? html` <span class="selo-exemplo">exemplo</span>` : ""}
              <span class="secundario">“${d.texto}”</span>${d.pedido_codigo ? html`<span class="secundario">Pedido ${d.pedido_codigo} · ${d.cliente_email || ""}</span>` : ""}</span></td>
            <td data-rotulo="Produto">${d.produto_nome || "—"}</td>
            <td data-rotulo="Nota">${"★".repeat(d.nota)}<span class="sr-only">${d.nota} de 5</span></td>
            <td data-rotulo="Data">${data(d.criado_em)}</td>
            <td data-rotulo="Publicado"><label class="interruptor"><input type="checkbox" data-aprovar="${d.id}" ${d.aprovado ? "checked" : ""} /><span class="trilho"></span><span class="sr-only">Publicar depoimento de ${d.nome_exibicao}</span></label></td>
            <td data-rotulo="Ações"><span class="acoes">
              <button class="btn btn-claro btn-pequeno" type="button" data-editar="${d.id}">Editar</button>
              <button class="btn btn-perigo btn-pequeno" type="button" data-excluir="${d.id}" aria-label="Excluir depoimento de ${d.nome_exibicao}">${icone("lixeira")}</button>
            </span></td></tr>`
        )
      : html`<tr><td colspan="6">Nenhum depoimento ainda. Eles chegam pela área do cliente após a entrega.</td></tr>`
  );
}

const corpoDe = (d, aprovado = d.aprovado) => ({
  nome_exibicao: d.nome_exibicao,
  cidade: d.cidade,
  nota: d.nota,
  texto: d.texto,
  aprovado: !!aprovado,
  produto_id: d.produto_id,
});

function formulario(d = null) {
  const corpo = abrirDialogo(
    d ? "Editar depoimento" : "Novo depoimento",
    html`<form class="form" novalidate>
      <p class="alerta alerta-erro" data-erro-form hidden tabindex="-1" role="alert"></p>
      <p class="ajuda">Publique apenas depoimentos reais, com autorização do cliente.</p>
      <div class="form-linha">
        <div class="campo"><label for="dNome">Nome exibido</label><input class="entrada" id="dNome" name="nome_exibicao" required maxlength="60" value="${d?.nome_exibicao || ""}" /></div>
        <div class="campo"><label for="dCidade">Cidade <span class="opcional">(opcional)</span></label><input class="entrada" id="dCidade" name="cidade" maxlength="60" value="${d?.cidade || ""}" /></div>
      </div>
      <div class="form-linha">
        <div class="campo"><label for="dProduto">Produto <span class="opcional">(opcional)</span></label>
          <select class="entrada" id="dProduto" name="produto_id"><option value="">Geral</option>${produtos.map((p) => html`<option value="${p.id}" ${d?.produto_id === p.id ? "selected" : ""}>${p.nome}</option>`)}</select></div>
        <div class="campo"><label for="dNota">Nota</label>
          <select class="entrada" id="dNota" name="nota">${[5, 4, 3, 2, 1].map((n) => html`<option value="${n}" ${(d?.nota ?? 5) === n ? "selected" : ""}>${n} estrela${n > 1 ? "s" : ""}</option>`)}</select></div>
      </div>
      <div class="campo"><label for="dTexto">Texto</label><textarea class="entrada" id="dTexto" name="texto" rows="4" required maxlength="600">${d?.texto || ""}</textarea></div>
      <label class="interruptor"><input type="checkbox" name="aprovado" ${!d || d.aprovado ? "checked" : ""} /><span class="trilho"></span>Publicado no site</label>
      <div class="form-linha"><button class="btn btn-primario" type="submit">Salvar</button><button class="btn btn-claro" type="button" data-fechar-dialogo>Cancelar</button></div>
    </form>`
  );
  const form = corpo.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limparErros(form);
    const v = dadosDoForm(form);
    const dados = { ...v, nota: Number(v.nota), produto_id: v.produto_id ? Number(v.produto_id) : null, aprovado: form.elements.aprovado.checked };
    try {
      d ? await put(`/admin/depoimentos/${d.id}`, dados) : await post("/admin/depoimentos", dados);
      toast("Depoimento salvo.");
      fecharDialogo();
      carregar();
      atualizarContagens();
    } catch (erro) {
      mostrarErros(form, erro);
    }
  });
}

$("#listaDepoimentos").addEventListener("change", async (e) => {
  const id = Number(e.target.dataset.aprovar);
  if (!id) return;
  const d = depoimentos.find((x) => x.id === id);
  try {
    await put(`/admin/depoimentos/${id}`, corpoDe(d, e.target.checked));
    d.aprovado = e.target.checked ? 1 : 0;
    toast(e.target.checked ? "Depoimento publicado." : "Depoimento ocultado.");
    atualizarContagens();
  } catch (erro) {
    e.target.checked = !e.target.checked;
    toast(erro.message, { tipo: "erro" });
  }
});

$("#listaDepoimentos").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-editar]");
  const ex = e.target.closest("[data-excluir]");
  if (ed) formulario(depoimentos.find((d) => d.id === Number(ed.dataset.editar)));
  if (ex && confirm("Excluir este depoimento?")) {
    await del(`/admin/depoimentos/${ex.dataset.excluir}`);
    toast("Depoimento excluído.");
    carregar();
    atualizarContagens();
  }
});
$("#novoDepoimento").addEventListener("click", () => formulario());

carregar();
