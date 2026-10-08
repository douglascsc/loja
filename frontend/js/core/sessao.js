import { get, post } from "./api.js";

let promessa = null;

/** Retorna { logado, cliente } (com cache por página). */
export function obterSessao(forcar = false) {
  if (forcar) promessa = null;
  promessa ??= get("/cliente/me").catch(() => ({ logado: false, cliente: null }));
  return promessa;
}

export async function sair() {
  await post("/auth/logout");
  promessa = null;
  location.href = "/";
}

export async function atualizarCabecalhoConta() {
  const link = document.getElementById("linkConta");
  const rotulo = document.getElementById("rotuloConta");
  if (!link) return;
  const { logado, cliente } = await obterSessao();
  if (!logado) return;
  const admin = cliente.papel === "admin";
  rotulo.textContent = admin ? "Painel" : "Minha conta";
  link.href = admin ? "/admin" : "/conta";
  link.setAttribute("aria-label", admin ? "Painel administrativo" : `Minha conta (${cliente.nome})`);
}
