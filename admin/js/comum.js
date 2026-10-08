// Infraestrutura compartilhada do painel administrativo.
import { get } from "/js/core/api.js";
import { $, $$, renderizar } from "/js/core/dom.js";
import { sair } from "/js/core/sessao.js";
import { criarGaveta } from "/js/core/ui.js";

export function iniciarAdmin() {
  const pagina = document.body.dataset.pagina;
  for (const a of $$(".admin-menu ul a")) {
    if (a.dataset.pagina === pagina) a.setAttribute("aria-current", "page");
  }

  // Menu lateral vira gaveta no celular.
  const menu = $("#adminMenu");
  const botao = $("#adminMenuBotao");
  const gaveta = criarGaveta({ painel: menu, fundo: $("#adminSombra"), gatilho: botao });
  menu.tabIndex = -1;
  botao.addEventListener("click", gaveta.abrir);
  window.matchMedia("(min-width: 981px)").addEventListener("change", gaveta.fechar);

  $("#adminSair").addEventListener("click", sair);

  $("#dialogo").addEventListener("click", (e) => {
    if (e.target.closest("[data-fechar-dialogo]") || e.target === e.currentTarget) fecharDialogo();
  });

  atualizarContagens();
}

/** Atualiza os contadores do menu (pedidos aguardando, depoimentos, mensagens). */
export async function atualizarContagens(dados) {
  try {
    const d = dados || (await get("/admin/dashboard"));
    const valores = {
      pedidos: d.pedidos_por_status?.aguardando_confirmacao || 0,
      depoimentos: d.depoimentos_pendentes || 0,
      mensagens: d.mensagens_nao_lidas || 0,
    };
    for (const [chave, n] of Object.entries(valores)) {
      const el = $(`[data-contagem="${chave}"]`);
      el.hidden = !n;
      el.textContent = n;
      el.setAttribute("aria-label", `${n} pendente${n === 1 ? "" : "s"}`);
    }
  } catch {
    /* contagens são opcionais */
  }
}

// ---------- Diálogo modal (elemento <dialog> nativo: foco e Esc tratados pelo navegador) ----------
let aoFecharAtual = null;

export function abrirDialogo(titulo, conteudo, { aoFechar } = {}) {
  const dialogo = $("#dialogo");
  $("#dialogoTitulo").textContent = titulo;
  renderizar($("#dialogoCorpo"), conteudo);
  aoFecharAtual = aoFechar || null;
  if (!dialogo.open) dialogo.showModal();
  dialogo.addEventListener("close", () => aoFecharAtual?.(), { once: true });
  return $("#dialogoCorpo");
}

export function fecharDialogo() {
  const dialogo = $("#dialogo");
  if (dialogo.open) dialogo.close();
}

/** Converte "15,90" em centavos; vazio vira null. */
export function lerReais(valor) {
  const limpo = String(valor ?? "").trim();
  if (!limpo) return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export const paraReais = (centavos) => (centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ","));

export function paginacao(container, { pagina, total, porPagina }, aoMudar) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) {
    renderizar(container, "");
    return;
  }
  container.innerHTML = "";
  const anterior = document.createElement("button");
  anterior.className = "btn btn-claro btn-pequeno";
  anterior.type = "button";
  anterior.textContent = "Anterior";
  anterior.disabled = pagina <= 1;
  anterior.addEventListener("click", () => aoMudar(pagina - 1));
  const info = document.createElement("span");
  info.textContent = `Página ${pagina} de ${paginas} · ${total} registros`;
  const proxima = anterior.cloneNode();
  proxima.textContent = "Próxima";
  proxima.disabled = pagina >= paginas;
  proxima.addEventListener("click", () => aoMudar(pagina + 1));
  container.append(anterior, info, proxima);
}
