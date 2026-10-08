import { post, put } from "../core/api.js";
import { $, html } from "../core/dom.js";
import { aplicarMascara, cep as fmtCep } from "../core/formato.js";
import { carregando, dadosDoForm, limparErros, mostrarErros } from "../core/ui.js";

/** HTML do formulário de endereço (prefixo evita ids repetidos na página). */
export function formEndereco(prefixo, e = {}) {
  const id = (c) => `${prefixo}-${c}`;
  return html`<form class="form form-endereco" novalidate data-id="${e.id || ""}">
    <p class="alerta alerta-erro" data-erro-form hidden tabindex="-1" role="alert"></p>
    <div class="form-linha">
      <div class="campo">
        <label for="${id("cep")}">CEP</label>
        <input class="entrada" id="${id("cep")}" name="cep" inputmode="numeric" autocomplete="postal-code" required value="${fmtCep(e.cep)}" aria-describedby="${id("cep-ajuda")}" />
        <p class="ajuda" id="${id("cep-ajuda")}">Preenchemos a rua automaticamente.</p>
      </div>
      <div class="campo">
        <label for="${id("apelido")}">Apelido <span class="opcional">(opcional)</span></label>
        <input class="entrada" id="${id("apelido")}" name="apelido" placeholder="Casa, trabalho…" maxlength="40" value="${e.apelido || ""}" />
      </div>
    </div>
    <div class="campo">
      <label for="${id("logradouro")}">Rua</label>
      <input class="entrada" id="${id("logradouro")}" name="logradouro" autocomplete="address-line1" required value="${e.logradouro || ""}" />
    </div>
    <div class="form-linha">
      <div class="campo">
        <label for="${id("numero")}">Número</label>
        <input class="entrada" id="${id("numero")}" name="numero" required maxlength="15" value="${e.numero || ""}" />
      </div>
      <div class="campo">
        <label for="${id("complemento")}">Complemento <span class="opcional">(opcional)</span></label>
        <input class="entrada" id="${id("complemento")}" name="complemento" autocomplete="address-line2" maxlength="60" value="${e.complemento || ""}" />
      </div>
    </div>
    <div class="form-linha">
      <div class="campo">
        <label for="${id("bairro")}">Bairro</label>
        <input class="entrada" id="${id("bairro")}" name="bairro" required list="${id("bairros")}" value="${e.bairro || ""}" />
        <datalist id="${id("bairros")}"></datalist>
      </div>
      <div class="campo">
        <label for="${id("cidade")}">Cidade</label>
        <input class="entrada" id="${id("cidade")}" name="cidade" autocomplete="address-level2" required value="${e.cidade || "Campo Bom"}" />
      </div>
      <div class="campo">
        <label for="${id("estado")}">UF</label>
        <input class="entrada" id="${id("estado")}" name="estado" autocomplete="address-level1" required maxlength="2" value="${e.estado || "RS"}" />
      </div>
    </div>
    <div class="campo">
      <label for="${id("referencia")}">Ponto de referência <span class="opcional">(opcional)</span></label>
      <input class="entrada" id="${id("referencia")}" name="referencia" maxlength="120" value="${e.referencia || ""}" />
    </div>
    <label class="caixa-selecao"><input type="checkbox" name="principal" ${e.principal ? "checked" : ""} /> <span>Usar como endereço principal</span></label>
    <div class="form-linha">
      <button class="btn btn-primario" type="submit">Salvar endereço</button>
      <button class="btn btn-claro" type="button" data-cancelar>Cancelar</button>
    </div>
  </form>`;
}

/** Liga máscara, busca de CEP (ViaCEP) e envio. Chama aoSalvar(endereco). */
export function ligarFormEndereco(form, { aoSalvar, aoCancelar, bairros = [] }) {
  const campo = (n) => form.elements[n];
  aplicarMascara(campo("cep"), "cep");
  const lista = form.querySelector("datalist");
  for (const b of bairros) {
    const op = document.createElement("option");
    op.value = b.nome;
    lista.append(op);
  }

  campo("cep").addEventListener("input", async () => {
    const digitos = campo("cep").value.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const d = await r.json();
      if (d.erro) return;
      if (d.logradouro && !campo("logradouro").value) campo("logradouro").value = d.logradouro;
      if (d.bairro) campo("bairro").value = d.bairro;
      if (d.localidade) campo("cidade").value = d.localidade;
      if (d.uf) campo("estado").value = d.uf;
      (campo("logradouro").value ? campo("numero") : campo("logradouro")).focus();
    } catch {
      /* ViaCEP indisponível: o cliente preenche manualmente */
    }
  });

  form.querySelector("[data-cancelar]").addEventListener("click", () => aoCancelar?.());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limparErros(form);
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const dados = { ...dadosDoForm(form), principal: campo("principal").checked };
    const botao = form.querySelector("[type=submit]");
    carregando(botao, true);
    try {
      const id = form.dataset.id;
      const r = id ? await put(`/cliente/enderecos/${id}`, dados) : await post("/cliente/enderecos", dados);
      aoSalvar?.(r.endereco);
    } catch (erro) {
      mostrarErros(form, erro);
    } finally {
      carregando(botao, false);
    }
  });
  $("input", form)?.focus();
}
