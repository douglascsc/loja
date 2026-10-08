import { FUSO } from "../config/constantes.js";
import { Configuracoes } from "../models/configuracoes.js";

const DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function agoraNoFuso(data = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(data)
      .map((p) => [p.type, p.value])
  );
  return { dia: DIAS[partes.weekday], minutos: Number(partes.hour) * 60 + Number(partes.minute) };
}

const paraMinutos = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Calcula se a loja está aberta agora, a partir dos horários configurados. */
export function situacaoLoja(config = Configuracoes.todas(), data = new Date()) {
  if (config.modo_funcionamento === "aberta") return { aberta: true, motivo: "manual" };
  if (config.modo_funcionamento === "fechada") return { aberta: false, motivo: "manual" };

  const { dia, minutos } = agoraNoFuso(data);
  const faixas = config.horarios?.[dia] || [];
  const aberta = faixas.some(([abre, fecha]) => minutos >= paraMinutos(abre) && minutos < paraMinutos(fecha));
  return { aberta, motivo: "horario" };
}

/** Pode receber pedido agora? */
export function aceitandoPedidos(config = Configuracoes.todas()) {
  if (config.modo_funcionamento === "fechada") return false;
  return situacaoLoja(config).aberta || !!config.aceita_pedidos_fora_horario;
}

/** Configuração que pode ser exposta publicamente. */
export function configPublica() {
  const c = Configuracoes.todas();
  const situacao = situacaoLoja(c);
  return {
    nome_loja: c.nome_loja,
    slogan: c.slogan,
    logo: c.logo,
    telefone: c.telefone,
    whatsapp: c.whatsapp,
    email: c.email,
    instagram: c.instagram,
    facebook: c.facebook,
    tiktok: c.tiktok,
    endereco: c.endereco,
    cidade_entrega: c.cidade_entrega,
    horarios: c.horarios,
    pedido_minimo: c.pedido_minimo,
    permite_retirada: c.permite_retirada,
    endereco_retirada: c.endereco_retirada,
    prazo_entrega: c.prazo_entrega,
    mensagem_aviso: c.mensagem_aviso,
    aberta: situacao.aberta,
    aceitando_pedidos: aceitandoPedidos(c),
  };
}
