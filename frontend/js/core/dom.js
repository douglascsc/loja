// Utilitários de DOM com renderização segura contra XSS.
// Todo valor interpolado em html`...` é escapado automaticamente;
// só o que vier embrulhado em bruto() entra como HTML.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

class HtmlSeguro {
  constructor(texto) {
    this.texto = texto;
  }
  toString() {
    return this.texto;
  }
}

export const bruto = (texto) => new HtmlSeguro(String(texto));

function paraHtml(valor) {
  if (valor instanceof HtmlSeguro) return valor.texto;
  if (Array.isArray(valor)) return valor.map(paraHtml).join("");
  if (valor === false || valor === null || valor === undefined) return "";
  return esc(valor);
}

export function html(partes, ...valores) {
  let saida = partes[0];
  valores.forEach((v, i) => {
    saida += paraHtml(v) + partes[i + 1];
  });
  return new HtmlSeguro(saida);
}

export function renderizar(elemento, conteudo) {
  elemento.innerHTML = paraHtml(conteudo);
}

/** Aceita só caminhos locais ("/...") ou https — bloqueia "javascript:" etc. */
export function urlSegura(url, padrao = "#") {
  const u = String(url || "");
  if (/^\/(?!\/)/.test(u)) return u;
  try {
    return new URL(u).protocol === "https:" ? u : padrao;
  } catch {
    return padrao;
  }
}

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

export const icone = (nome, classe = "icone") =>
  bruto(`<svg class="${esc(classe)}" aria-hidden="true" focusable="false"><use href="/assets/icones.svg#${esc(nome)}"></use></svg>`);

export const prefereMenosMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lê parâmetro "voltar" e só aceita caminhos internos (evita redirecionamento aberto). */
export function destinoSeguro(padrao = "/conta") {
  const voltar = new URLSearchParams(location.search).get("voltar") || "";
  return /^\/(?![/\\])/.test(voltar) ? voltar : padrao;
}
