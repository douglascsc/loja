export const STATUS_PEDIDO = Object.freeze({
  aguardando_confirmacao: "Aguardando confirmação",
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  pronto_para_retirada: "Pronto para retirada",
  entregue: "Entregue",
  cancelado: "Cancelado",
});

export const FORMAS_PAGAMENTO = Object.freeze({
  pix: "Pix na entrega/retirada",
  dinheiro: "Dinheiro",
  cartao: "Cartão (maquininha na entrega/retirada)",
});

export const ETIQUETAS = Object.freeze({
  mais_vendido: "Mais vendido",
  novo: "Novo",
  promocao: "Promoção",
  edicao_limitada: "Edição limitada",
});

export const TIPOS_ENTREGA = Object.freeze({
  entrega: "Entrega",
  retirada: "Retirada no local",
});

// Pedidos nesses status já não ocupam mais estoque / não podem ser alterados.
export const STATUS_FINAIS = Object.freeze(["entregue", "cancelado"]);

// Brasil não tem horário de verão desde 2019.
export const FUSO = "America/Sao_Paulo";
export const OFFSET_SQL = "-3 hours";

export const MAX_ITENS_POR_PRODUTO = 50;
