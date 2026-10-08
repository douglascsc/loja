import { db } from "../config/database.js";

/** Valores padrão: usados quando a chave ainda não foi salva no banco. */
export const PADROES = Object.freeze({
  nome_loja: "O MELHOR BOLO DE POTE",
  slogan: "Bolo de pote artesanal, feito no dia, em Campo Bom",
  descricao_seo:
    "Bolos de pote artesanais feitos todos os dias em Campo Bom/RS. Ninho com Nutella, brigadeiro, red velvet e muito mais. Peça online e receba em casa.",
  logo: "/assets/logo.svg",
  telefone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  endereco: {
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "Campo Bom",
    estado: "RS",
    cep: "",
  },
  cidade_entrega: "Campo Bom",
  // 0 = domingo ... 6 = sábado. Cada dia: lista de faixas [abre, fecha] ou [] (fechado).
  horarios: {
    0: [],
    1: [],
    2: [["10:00", "19:00"]],
    3: [["10:00", "19:00"]],
    4: [["10:00", "19:00"]],
    5: [["10:00", "20:00"]],
    6: [["09:00", "18:00"]],
  },
  // "auto" segue os horários; "aberta"/"fechada" força o estado (ex.: feriado).
  modo_funcionamento: "auto",
  aceita_pedidos_fora_horario: true,
  pedido_minimo: 0,
  permite_retirada: true,
  endereco_retirada: "",
  prazo_entrega: "Entregamos no mesmo dia para pedidos confirmados até as 16h.",
  mensagem_aviso: "",
});

export const Configuracoes = {
  todas() {
    const linhas = db().prepare("SELECT chave, valor FROM configuracoes").all();
    const salvas = Object.fromEntries(
      linhas.filter((l) => l.chave in PADROES).map((l) => [l.chave, JSON.parse(l.valor)])
    );
    return { ...structuredClone(PADROES), ...salvas };
  },

  salvar(valores) {
    const stmt = db().prepare(
      `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, datetime('now'))
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`
    );
    db().transaction(() => {
      for (const [chave, valor] of Object.entries(valores)) {
        if (chave in PADROES && valor !== undefined) stmt.run(chave, JSON.stringify(valor));
      }
    })();
    return this.todas();
  },
};
