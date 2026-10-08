import { get } from "./api.js";
import { $, $$, html, icone, renderizar, urlSegura } from "./dom.js";
import { cep as fmtCep, moeda, telefone } from "./formato.js";

let promessa = null;

export function obterLoja() {
  promessa ??= get("/loja")
    .then((r) => r.loja)
    .catch(() => null);
  return promessa;
}

export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function linkWhatsapp(numero, mensagem = "") {
  const d = String(numero || "").replace(/\D/g, "");
  if (!d) return null;
  const completo = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${completo}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}

export function enderecoTexto(e) {
  if (!e) return "";
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const partes = [rua, e.complemento, e.bairro, [e.cidade, e.estado].filter(Boolean).join("/"), e.cep ? fmtCep(e.cep) : ""];
  return partes.filter(Boolean).join(" — ");
}

/** Agrupa dias com o mesmo horário: "Terça a Quinta: 10:00–19:00". */
export function horariosAgrupados(horarios = {}) {
  const linhas = [];
  for (let d = 1; d <= 7; d++) {
    const dia = d % 7;
    const faixas = horarios[dia] || [];
    const texto = faixas.length ? faixas.map(([a, f]) => `${a}–${f}`).join(" e ") : "Fechado";
    const ultima = linhas.at(-1);
    if (ultima && ultima.texto === texto) ultima.fim = dia;
    else linhas.push({ inicio: dia, fim: dia, texto });
  }
  return linhas.map((l) => ({
    dias: l.inicio === l.fim ? DIAS[l.inicio] : `${DIAS[l.inicio]} a ${DIAS[l.fim]}`,
    texto: l.texto,
  }));
}

export function redesSociais(loja) {
  return [
    loja.instagram && { nome: "Instagram", url: loja.instagram, icone: "instagram" },
    loja.facebook && { nome: "Facebook", url: loja.facebook, icone: "facebook" },
    loja.tiktok && { nome: "TikTok", url: loja.tiktok, icone: "tiktok" },
  ].filter(Boolean);
}

/** Preenche partes do layout que dependem das configurações da loja. */
export async function aplicarConfiguracoesNoLayout() {
  const loja = await obterLoja();
  if (!loja) return null;

  const faixa = $("#faixaAviso");
  if (faixa && loja.mensagem_aviso) {
    faixa.textContent = loja.mensagem_aviso;
    faixa.hidden = false;
  }

  const whats = linkWhatsapp(loja.whatsapp, `Olá! Vim pelo site da ${loja.nome_loja}.`);
  const flutuante = $("#whatsFlutuante");
  if (flutuante && whats) {
    flutuante.href = whats;
    flutuante.hidden = false;
  }

  for (const caixa of $$("[data-redes]")) {
    const redes = redesSociais(loja);
    renderizar(
      caixa,
      redes.map(
        (r) => html`<a href="${urlSegura(r.url)}" target="_blank" rel="noopener" aria-label="${r.nome} (abre em nova aba)">${icone(r.icone)}</a>`
      )
    );
  }

  const contatos = $("[data-contatos-rodape]");
  if (contatos) {
    const itens = [];
    if (loja.whatsapp) itens.push(html`<li><a href="${whats}" target="_blank" rel="noopener">WhatsApp ${telefone(loja.whatsapp)}</a></li>`);
    if (loja.telefone) itens.push(html`<li><a href="tel:+55${loja.telefone}">${telefone(loja.telefone)}</a></li>`);
    if (loja.email) itens.push(html`<li><a href="mailto:${loja.email}">${loja.email}</a></li>`);
    const end = enderecoTexto(loja.endereco);
    if (end && loja.endereco?.logradouro) itens.push(html`<li>${end}</li>`);
    for (const h of horariosAgrupados(loja.horarios)) itens.push(html`<li>${h.dias}: ${h.texto}</li>`);
    renderizar(contatos, itens);
  }

  const legais = $("[data-dados-legais]");
  if (legais) {
    const partes = [loja.razao_social, loja.cnpj && `CNPJ ${loja.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}`, `${loja.endereco?.cidade || loja.cidade_entrega}/${loja.endereco?.estado || "RS"}`];
    legais.textContent = partes.filter(Boolean).join(" · ");
  }

  if (loja.pedido_minimo > 0) {
    const nota = $("#notaCarrinho");
    if (nota) nota.textContent = `Pedido mínimo de ${moeda(loja.pedido_minimo)}. Taxa de entrega calculada no fechamento, conforme o bairro.`;
  }
  return loja;
}
