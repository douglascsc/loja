// Inicialização comum a todas as páginas da loja.
import { iniciarGavetaCarrinho, sincronizarCarrinho } from "./componentes/gaveta-carrinho.js";
import { aplicarConfiguracoesNoLayout } from "./core/loja.js";
import { atualizarCabecalhoConta } from "./core/sessao.js";
import { iniciarCabecalho, iniciarMenu } from "./core/ui.js";

export function iniciarApp() {
  iniciarMenu();
  iniciarCabecalho();
  iniciarGavetaCarrinho();
  atualizarCabecalhoConta();
  const loja = aplicarConfiguracoesNoLayout();
  sincronizarCarrinho({ silencioso: true });
  return { loja };
}
