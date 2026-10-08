import { $, $$, html, icone, prefereMenosMovimento, renderizar } from "./dom.js";

// ---------- Toasts (mensagens rápidas, anunciadas por leitores de tela) ----------
export function toast(mensagem, { tipo = "sucesso", acao, duracao = 3800 } = {}) {
  const area = $("#toasts");
  if (!area) return;
  const el = document.createElement("div");
  el.className = `toast${tipo === "erro" ? " toast-erro" : ""}`;
  renderizar(el, html`${icone(tipo === "erro" ? "fechar" : "check")}<span>${mensagem}</span>${acao ? html`<button type="button">${acao.rotulo}</button>` : ""}`);
  if (acao) el.querySelector("button").addEventListener("click", () => {
    acao.fn();
    remover();
  });
  area.append(el);
  while (area.children.length > 2) area.firstElementChild.remove();
  const timer = setTimeout(remover, duracao);
  function remover() {
    clearTimeout(timer);
    el.classList.add("saindo");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  }
}

// ---------- Foco preso dentro de diálogos ----------
const FOCAVEIS = 'a[href]:not([hidden]), button:not([disabled]):not([hidden]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function prenderFoco(container) {
  function aoTeclar(e) {
    if (e.key !== "Tab") return;
    const focaveis = $$(FOCAVEIS, container).filter((el) => el.offsetParent !== null);
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis.at(-1);
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }
  container.addEventListener("keydown", aoTeclar);
  return () => container.removeEventListener("keydown", aoTeclar);
}

/** Painel deslizante/modal acessível (Esc fecha, foco preso e devolvido). */
export function criarGaveta({ painel, fundo, gatilho, aoAbrir, aoFechar }) {
  let soltarFoco = null;
  let origem = null;
  const aberta = () => painel.classList.contains("aberto");

  function abrir() {
    if (aberta()) return;
    origem = document.activeElement;
    painel.classList.add("aberto");
    fundo?.classList.add("aberto");
    gatilho?.setAttribute("aria-expanded", "true");
    document.body.classList.add("travado");
    soltarFoco = prenderFoco(painel);
    aoAbrir?.();
    requestAnimationFrame(() => painel.focus());
  }

  function fechar() {
    if (!aberta()) return;
    painel.classList.remove("aberto");
    fundo?.classList.remove("aberto");
    gatilho?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("travado");
    soltarFoco?.();
    aoFechar?.();
    origem?.focus?.();
  }

  fundo?.addEventListener("click", fechar);
  painel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fechar();
  });
  return { abrir, fechar, aberta };
}

// ---------- Menu mobile ----------
export function iniciarMenu() {
  const botao = $("#botaoMenu");
  const nav = $("#navPrincipal");
  if (!botao || !nav) return;

  const marcarAtual = () => {
    for (const a of $$("a", nav)) {
      const u = new URL(a.href);
      const atual = u.pathname === location.pathname && (!u.hash || u.hash === location.hash);
      if (atual && !u.hash) a.setAttribute("aria-current", "page");
    }
  };
  marcarAtual();

  function alternar(abrir) {
    nav.classList.toggle("aberto", abrir);
    botao.setAttribute("aria-expanded", String(abrir));
    botao.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
    renderizar(botao, icone(abrir ? "fechar" : "menu"));
  }

  botao.addEventListener("click", () => alternar(!nav.classList.contains("aberto")));
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) alternar(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("aberto")) {
      alternar(false);
      botao.focus();
    }
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", () => alternar(false));
}

export function iniciarCabecalho() {
  const cab = $("#cabecalho");
  if (!cab) return;
  const atualizar = () => cab.classList.toggle("rolado", window.scrollY > 8);
  atualizar();
  window.addEventListener("scroll", atualizar, { passive: true });
}

// ---------- Revelar elementos ao rolar ----------
export function revelar(elementos) {
  if (prefereMenosMovimento() || !("IntersectionObserver" in window)) {
    elementos.forEach((el) => el.classList.add("visivel"));
    return;
  }
  const obs = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("visivel");
        obs.unobserve(e.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  elementos.forEach((el) => obs.observe(el));
}

// ---------- Confeitos ao adicionar ao carrinho ----------
const CORES_CONFEITO = ["#b02e5a", "#e9a23b", "#2f7d4f", "#f4a9bd", "#6b3e2a"];

export function confeitos(origem) {
  if (prefereMenosMovimento() || !origem) return;
  const r = origem.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < 14; i++) {
    const c = document.createElement("span");
    c.className = "confeito";
    const angulo = Math.random() * Math.PI * 2;
    const distancia = 40 + Math.random() * 50;
    c.style.left = `${cx}px`;
    c.style.top = `${cy}px`;
    c.style.background = CORES_CONFEITO[i % CORES_CONFEITO.length];
    c.style.setProperty("--dx", `${Math.cos(angulo) * distancia}px`);
    c.style.setProperty("--dy", `${Math.sin(angulo) * distancia - 20}px`);
    c.style.setProperty("--rot", `${Math.random() * 540 - 270}deg`);
    document.body.append(c);
    c.addEventListener("animationend", () => c.remove());
  }
}

// ---------- Inclinação suave dos cards (apenas mouse) ----------
export function inclinarCards(elementos) {
  if (prefereMenosMovimento() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  for (const card of elementos) {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", `${x * 6}deg`);
      card.style.setProperty("--rx", `${-y * 6}deg`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  }
}

// ---------- Formulários ----------
export function carregando(botao, ativo) {
  if (!botao) return;
  botao.classList.toggle("carregando", ativo);
  botao.disabled = ativo;
  botao.setAttribute("aria-busy", String(ativo));
}

/** Mostra erros vindos da API ao lado de cada campo (e um resumo). */
// Campos associados por form="id" podem ficar fora do <form>: a "raiz" é o contêiner visual.
const raizDo = (form) => (form.id && document.querySelector(`[data-raiz-form="${form.id}"]`)) || form;

export function mostrarErros(form, erro) {
  limparErros(form);
  const campos = erro?.dados?.detalhes?.campos || {};
  let primeiro = null;
  for (const [nome, mensagem] of Object.entries(campos)) {
    const input = form.elements[nome];
    if (!input || !input.id) continue;
    input.setAttribute("aria-invalid", "true");
    const p = document.createElement("p");
    p.className = "erro-campo";
    p.id = `${input.id}-erro`;
    p.textContent = mensagem;
    input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), p.id].filter(Boolean).join(" "));
    (input.closest(".campo") || input.parentElement).append(p);
    primeiro ??= input;
  }
  const resumo = raizDo(form).querySelector("[data-erro-form]");
  if (resumo) {
    resumo.textContent = erro?.message || "Confira os dados e tente novamente.";
    resumo.hidden = false;
    if (!primeiro) resumo.focus?.();
  }
  primeiro?.focus();
}

export function limparErros(form) {
  const raiz = raizDo(form);
  for (const p of $$(".erro-campo", raiz)) {
    const input = raiz.querySelector(`[aria-describedby~="${p.id}"]`);
    if (input) {
      const resto = input.getAttribute("aria-describedby").split(" ").filter((id) => id !== p.id);
      resto.length ? input.setAttribute("aria-describedby", resto.join(" ")) : input.removeAttribute("aria-describedby");
    }
    p.remove();
  }
  for (const el of $$('[aria-invalid="true"]', raiz)) el.removeAttribute("aria-invalid");
  const resumo = raiz.querySelector("[data-erro-form]");
  if (resumo) resumo.hidden = true;
}

export function dadosDoForm(form) {
  return Object.fromEntries(new FormData(form));
}

export function alternarSenha(raiz = document) {
  for (const botao of $$(".mostrar-senha", raiz)) {
    const input = botao.parentElement.querySelector("input");
    botao.addEventListener("click", () => {
      const mostrar = input.type === "password";
      input.type = mostrar ? "text" : "password";
      botao.setAttribute("aria-pressed", String(mostrar));
      botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
      renderizar(botao, icone(mostrar ? "olho-fechado" : "olho"));
    });
  }
}
