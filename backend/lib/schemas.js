import { z } from "zod";
import { ETIQUETAS, FORMAS_PAGAMENTO, MAX_ITENS_POR_PRODUTO, STATUS_PEDIDO, TIPOS_ENTREGA } from "../config/constantes.js";

// ---------- Blocos básicos ----------
const texto = (min, max, nome = "Campo") =>
  z
    .string({ required_error: `${nome} é obrigatório.`, invalid_type_error: `${nome} inválido.` })
    .trim()
    .min(min, min <= 1 ? `${nome} é obrigatório.` : `${nome} precisa ter pelo menos ${min} caracteres.`)
    .max(max, `${nome} pode ter no máximo ${max} caracteres.`);

const opcional = (max, nome) =>
  z
    .string()
    .trim()
    .max(max, `${nome} pode ter no máximo ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const id = z.coerce.number().int().positive();
const centavos = (nome) => z.coerce.number({ invalid_type_error: `${nome} inválido.` }).int(`${nome} inválido.`).min(0).max(100_000_00);
const booleano = z.union([z.boolean(), z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1")]);

export const email = z
  .string({ required_error: "E-mail é obrigatório." })
  .trim()
  .toLowerCase()
  .max(120, "E-mail muito longo.")
  .email("Informe um e-mail válido.");

export const telefone = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D+/g, ""))
  .refine((v) => v === "" || /^\d{10,11}$/.test(v), "Telefone inválido. Use DDD + número.")
  .optional()
  .nullable()
  .transform((v) => v || null);

// bcrypt considera só os primeiros 72 bytes: limitamos para não haver surpresa.
export const senha = z
  .string({ required_error: "Senha é obrigatória." })
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números na senha.");

/** Caminho de imagem aceito: só arquivos locais (evita "javascript:" e hotlink). */
const caminhoImagem = z
  .string()
  .trim()
  .max(255)
  .regex(/^\/(assets|uploads)\/[A-Za-z0-9._\-/]+$/, "Caminho de imagem inválido.")
  .refine((v) => !v.includes(".."), "Caminho de imagem inválido.");

const urlRede = (dominios) =>
  z
    .string()
    .trim()
    .max(200)
    .refine((v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" && dominios.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
      } catch {
        return false;
      }
    }, `Informe um link https:// de ${dominios[0]}.`);

// ---------- Autenticação / cliente ----------
export const cadastroSchema = z.object({
  nome: texto(2, 100, "Nome"),
  email,
  telefone,
  senha,
  aceite_termos: z.literal(true, { errorMap: () => ({ message: "É preciso aceitar os termos e a política de privacidade." }) }),
});

export const loginSchema = z.object({
  email,
  senha: z.string({ required_error: "Senha é obrigatória." }).min(1, "Senha é obrigatória.").max(200),
});

export const dadosClienteSchema = z.object({
  nome: texto(2, 100, "Nome"),
  email,
  telefone,
});

export const trocarSenhaSchema = z.object({
  senha_atual: z.string().min(1, "Informe a senha atual.").max(200),
  nova_senha: senha,
});

export const enderecoSchema = z.object({
  apelido: opcional(40, "Apelido"),
  cep: z
    .string({ required_error: "CEP é obrigatório." })
    .transform((v) => v.replace(/\D+/g, ""))
    .refine((v) => /^\d{8}$/.test(v), "CEP inválido."),
  logradouro: texto(2, 120, "Rua"),
  numero: texto(1, 15, "Número"),
  complemento: opcional(60, "Complemento"),
  bairro: texto(2, 60, "Bairro"),
  cidade: texto(2, 60, "Cidade"),
  estado: z
    .string({ required_error: "Estado é obrigatório." })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a sigla do estado (ex.: RS)."),
  referencia: opcional(120, "Referência"),
  principal: booleano.optional().default(false),
});

// ---------- Carrinho / pedidos ----------
const itensSchema = z
  .array(
    z.object({
      produto_id: id,
      quantidade: z.coerce.number().int().min(1).max(MAX_ITENS_POR_PRODUTO),
    })
  )
  .max(50, "Carrinho com itens demais.");

export const carrinhoSchema = z.object({ itens: itensSchema });

export const pedidoSchema = z
  .object({
    itens: itensSchema.min(1, "Seu carrinho está vazio."),
    tipo_entrega: z.enum(Object.keys(TIPOS_ENTREGA), { errorMap: () => ({ message: "Escolha entrega ou retirada." }) }),
    endereco_id: id.optional().nullable(),
    forma_pagamento: z.enum(Object.keys(FORMAS_PAGAMENTO), { errorMap: () => ({ message: "Escolha a forma de pagamento." }) }),
    troco_para: centavos("Troco").optional().nullable(),
    telefone,
    observacoes: opcional(500, "Observações"),
  })
  .refine((d) => d.tipo_entrega !== "entrega" || d.endereco_id, {
    message: "Selecione o endereço de entrega.",
    path: ["endereco_id"],
  });

export const depoimentoClienteSchema = z.object({
  pedido_id: id,
  produto_id: id,
  nota: z.coerce.number().int().min(1, "Dê uma nota de 1 a 5.").max(5),
  texto: texto(10, 600, "Comentário"),
});

export const contatoSchema = z.object({
  nome: texto(2, 100, "Nome"),
  email,
  telefone,
  mensagem: texto(10, 2000, "Mensagem"),
  // Campo-armadilha para robôs: fica oculto no formulário e deve vir vazio.
  site: z.string().max(0).optional().default(""),
});

// ---------- Admin ----------
export const produtoSchema = z
  .object({
    nome: texto(2, 100, "Nome"),
    slug: z.string().trim().max(80).optional().default(""),
    descricao: z.string().trim().max(2000).default(""),
    ingredientes: opcional(1000, "Ingredientes"),
    tamanho: opcional(40, "Tamanho"),
    preco: centavos("Preço"),
    preco_promocional: centavos("Preço promocional").optional().nullable().transform((v) => (v ? v : null)),
    imagem: caminhoImagem.optional().nullable(),
    categoria_id: id.optional().nullable(),
    estoque: z.coerce.number().int().min(0, "Estoque não pode ser negativo.").max(100000),
    disponivel: booleano.default(true),
    destaque: booleano.default(false),
    etiqueta: z.enum(Object.keys(ETIQUETAS)).optional().nullable(),
    ordem: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .refine((d) => d.preco_promocional == null || d.preco_promocional < d.preco, {
    message: "O preço promocional precisa ser menor que o preço normal.",
    path: ["preco_promocional"],
  });

export const produtoParcialSchema = z
  .object({
    estoque: z.coerce.number().int().min(0).max(100000).optional(),
    preco: centavos("Preço").optional(),
    preco_promocional: centavos("Preço promocional").nullable().optional(),
    disponivel: booleano.optional(),
    destaque: booleano.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "Nada para atualizar.");

export const categoriaSchema = z.object({
  nome: texto(2, 60, "Nome"),
  slug: z.string().trim().max(80).optional().default(""),
  descricao: opcional(300, "Descrição"),
  ordem: z.coerce.number().int().min(0).max(9999).default(0),
  ativo: booleano.default(true),
});

export const bairroSchema = z.object({
  nome: texto(2, 60, "Bairro"),
  taxa: centavos("Taxa"),
  ativo: booleano.default(true),
});

export const statusSchema = z.object({
  status: z.enum(Object.keys(STATUS_PEDIDO), { errorMap: () => ({ message: "Status inválido." }) }),
  observacao: opcional(300, "Observação"),
});

export const depoimentoAdminSchema = z.object({
  nome_exibicao: texto(2, 60, "Nome"),
  cidade: opcional(60, "Cidade"),
  nota: z.coerce.number().int().min(1).max(5),
  texto: texto(5, 600, "Texto"),
  aprovado: booleano.default(true),
  produto_id: id.optional().nullable(),
});

const horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:MM).");
const faixas = z
  .array(z.tuple([horario, horario]).refine(([a, f]) => a < f, "O horário de fechamento deve ser depois da abertura."))
  .max(3);

export const configuracoesSchema = z
  .object({
    nome_loja: texto(2, 80, "Nome da loja"),
    slogan: z.string().trim().max(140),
    descricao_seo: z.string().trim().max(300),
    logo: caminhoImagem,
    telefone,
    whatsapp: telefone,
    email: z.union([email, z.literal("")]),
    instagram: urlRede(["instagram.com"]),
    facebook: urlRede(["facebook.com"]),
    tiktok: urlRede(["tiktok.com"]),
    endereco: z.object({
      logradouro: z.string().trim().max(120),
      numero: z.string().trim().max(15),
      complemento: z.string().trim().max(60),
      bairro: z.string().trim().max(60),
      cidade: z.string().trim().max(60),
      estado: z.string().trim().toUpperCase().max(2),
      cep: z.string().transform((v) => v.replace(/\D+/g, "")).refine((v) => v === "" || v.length === 8, "CEP inválido."),
    }),
    cidade_entrega: z.string().trim().max(60),
    horarios: z.object(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, faixas]))),
    modo_funcionamento: z.enum(["auto", "aberta", "fechada"]),
    aceita_pedidos_fora_horario: booleano,
    pedido_minimo: centavos("Pedido mínimo"),
    permite_retirada: booleano,
    endereco_retirada: z.string().trim().max(200),
    prazo_entrega: z.string().trim().max(200),
    mensagem_aviso: z.string().trim().max(200),
  })
  .partial()
  .strict();

// ---------- Consultas ----------
export const paginacaoSchema = z.object({
  busca: z.string().trim().max(100).optional().default(""),
  pagina: z.coerce.number().int().min(1).max(10000).optional().default(1),
});
