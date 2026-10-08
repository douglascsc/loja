// Popula o banco com dados iniciais da loja.
//   npm run seed          → categorias, produtos, bairros e (se definido no .env) o admin
//   npm run seed:demo     → também insere depoimentos de EXEMPLO (marcados como exemplo)
// É seguro rodar mais de uma vez: não duplica registros existentes.
import { db } from "../backend/config/database.js";
import { Bairros } from "../backend/models/bairros.js";
import { Categorias } from "../backend/models/categorias.js";
import { Clientes } from "../backend/models/clientes.js";
import { Depoimentos } from "../backend/models/depoimentos.js";
import { Produtos } from "../backend/models/produtos.js";
import { hashSenha } from "../backend/services/senha.js";

export const CATEGORIAS = [
  { nome: "Clássicos", slug: "classicos", descricao: "Os sabores que todo mundo ama.", ordem: 1 },
  { nome: "Especiais", slug: "especiais", descricao: "Receitas da casa e edições de temporada.", ordem: 2 },
  { nome: "Kits", slug: "kits", descricao: "Kits para presentear, dividir ou levar para a festa.", ordem: 3 },
];

const img = (slug) => `/assets/produtos/${slug}.svg`;

export const PRODUTOS = [
  {
    categoria: "classicos", nome: "Ninho com Nutella", slug: "ninho-com-nutella", preco: 1590, estoque: 30,
    destaque: true, etiqueta: "mais_vendido", ordem: 1,
    descricao: "Massa branca fofinha, creme de leite Ninho e camadas generosas de Nutella. O queridinho da casa.",
    ingredientes: "Farinha de trigo, ovos, açúcar, leite em pó, creme de leite, creme de avelã com cacau. Contém glúten, lactose e avelã.",
  },
  {
    categoria: "classicos", nome: "Brigadeiro Tradicional", slug: "brigadeiro-tradicional", preco: 1390, estoque: 30,
    destaque: true, ordem: 2,
    descricao: "Massa de chocolate molhadinha com brigadeiro cremoso de chocolate 50% cacau e granulado belga.",
    ingredientes: "Farinha de trigo, ovos, açúcar, cacau, leite condensado, chocolate meio amargo. Contém glúten e lactose.",
  },
  {
    categoria: "classicos", nome: "Prestígio", slug: "prestigio", preco: 1390, estoque: 25, ordem: 3,
    descricao: "Chocolate e coco na medida certa: massa de cacau, creme de coco fresco e cobertura de ganache.",
    ingredientes: "Farinha de trigo, ovos, açúcar, cacau, coco ralado, leite condensado, creme de leite. Contém glúten e lactose.",
  },
  {
    categoria: "classicos", nome: "Cenoura com Chocolate", slug: "cenoura-com-chocolate", preco: 1290, estoque: 25, ordem: 4,
    descricao: "Bolo de cenoura de vó, com camadas de brigadeiro mole e casquinha de chocolate.",
    ingredientes: "Cenoura, farinha de trigo, ovos, açúcar, óleo, cacau, leite condensado. Contém glúten e lactose.",
  },
  {
    categoria: "especiais", nome: "Red Velvet", slug: "red-velvet", preco: 1690, estoque: 20,
    destaque: true, etiqueta: "novo", ordem: 5,
    descricao: "Massa aveludada levemente achocolatada com creme de cream cheese suave e farofinha red velvet.",
    ingredientes: "Farinha de trigo, ovos, açúcar, cacau, leitelho, cream cheese, creme de leite. Contém glúten e lactose.",
  },
  {
    categoria: "especiais", nome: "Morango com Chantilly", slug: "morango-com-chantilly", preco: 1590, preco_promocional: 1390,
    estoque: 20, destaque: true, etiqueta: "promocao", ordem: 6,
    descricao: "Pão de ló, chantilly fresco, geleia artesanal e morangos selecionados por cima.",
    ingredientes: "Farinha de trigo, ovos, açúcar, morango, creme de leite fresco. Contém glúten e lactose.",
  },
  {
    categoria: "especiais", nome: "Limão Siciliano", slug: "limao-siciliano", preco: 1490, estoque: 15, ordem: 7,
    descricao: "Massa leve de limão, mousse cítrica e merengue maçaricado com raspas de limão siciliano.",
    ingredientes: "Farinha de trigo, ovos, açúcar, limão siciliano, leite condensado, creme de leite. Contém glúten e lactose.",
  },
  {
    categoria: "especiais", nome: "Doce de Leite com Nozes", slug: "doce-de-leite-com-nozes", preco: 1690, estoque: 6,
    etiqueta: "edicao_limitada", ordem: 8,
    descricao: "Massa amanteigada, doce de leite argentino e nozes caramelizadas. Produção limitada por dia.",
    ingredientes: "Farinha de trigo, ovos, açúcar, manteiga, doce de leite, nozes. Contém glúten, lactose e nozes.",
  },
  {
    categoria: "kits", nome: "Kit Degustação (4 potes)", slug: "kit-degustacao-4", preco: 5790, preco_promocional: 5290,
    estoque: 10, destaque: true, etiqueta: "promocao", ordem: 9,
    descricao: "Quatro sabores para provar tudo: Ninho com Nutella, Brigadeiro, Red Velvet e Morango com Chantilly.",
  },
  {
    categoria: "kits", nome: "Kit Festa (6 potes)", slug: "kit-festa-6", preco: 8490, preco_promocional: 7790, estoque: 8, ordem: 10,
    descricao: "Seis potes sortidos em embalagem para presente. Ideal para aniversários, escritório e encontros.",
  },
];

// Bairros de Campo Bom e taxas INICIAIS: confira e ajuste no painel admin.
export const BAIRROS = [
  ["Centro", 500], ["Operária", 600], ["Rio Branco", 600], ["25 de Julho", 700], ["Quatro Colônias", 700],
  ["Imigrante Norte", 700], ["Imigrante Sul", 700], ["Santa Lúcia", 700], ["Vila Nova", 700],
  ["Celeste", 800], ["Genuíno Sampaio", 800], ["Metzler", 800], ["Firenze", 800], ["Mônaco", 800],
  ["Paulista", 800], ["Bela Vista", 900], ["Porto Blos", 900],
];

const DEPOIMENTOS_EXEMPLO = [
  { nome_exibicao: "Exemplo — Juliana", produto: "ninho-com-nutella", nota: 5, texto: "Texto de exemplo: chegou geladinho e o pote vem bem lacrado. Remova este depoimento no painel antes de publicar a loja." },
  { nome_exibicao: "Exemplo — Rafael", produto: "brigadeiro-tradicional", nota: 5, texto: "Texto de exemplo para visualizar o carrossel de depoimentos. Substitua por avaliações reais dos seus clientes." },
  { nome_exibicao: "Exemplo — Camila", produto: "red-velvet", nota: 4, texto: "Texto de exemplo. As avaliações reais chegam pela área do cliente após a entrega e passam pela sua aprovação." },
];

export async function semear({ demo = false, log = console.log } = {}) {
  const banco = db();

  banco.transaction(() => {
    for (const c of CATEGORIAS) if (!Categorias.slugExiste(c.slug)) Categorias.criar(c);

    const categorias = Object.fromEntries(Categorias.listar({ incluirInativas: true }).map((c) => [c.slug, c.id]));
    for (const { categoria, ...p } of PRODUTOS) {
      if (Produtos.slugExiste(p.slug)) continue;
      Produtos.criar({
        preco_promocional: null, destaque: false, etiqueta: null, ingredientes: null, tamanho: "250 ml",
        disponivel: true, ...p, categoria_id: categorias[categoria], imagem: img(p.slug),
      });
    }
    if (PRODUTOS.some((p) => p.categoria === "kits")) {
      banco.prepare("UPDATE produtos SET tamanho = ? WHERE slug LIKE 'kit-%' AND tamanho = '250 ml'").run("Potes de 250 ml");
    }

    for (const [nome, taxa] of BAIRROS) if (!Bairros.encontrar(nome, { incluirInativos: true })) Bairros.criar({ nome, taxa });

    if (demo) {
      for (const d of DEPOIMENTOS_EXEMPLO) {
        const existe = banco.prepare("SELECT 1 FROM depoimentos WHERE nome_exibicao = ?").get(d.nome_exibicao);
        if (existe) continue;
        const produto = banco.prepare("SELECT id FROM produtos WHERE slug = ?").get(d.produto);
        Depoimentos.criar({ ...d, produto_id: produto?.id, cidade: "Campo Bom", aprovado: true, exemplo: true });
      }
    }
  })();

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA;
  if (email && senha) {
    if (Clientes.emailExiste(email)) {
      log(`Admin: ${email} já existe (senha não alterada).`);
    } else {
      if (senha.length < 10) throw new Error("ADMIN_SENHA precisa ter pelo menos 10 caracteres.");
      Clientes.criar({ nome: "Administrador", email, senha_hash: await hashSenha(senha), papel: "admin" });
      log(`Admin criado: ${email}`);
    }
  } else {
    log("Admin não criado (defina ADMIN_EMAIL e ADMIN_SENHA no .env ou use: npm run admin:criar).");
  }

  log("Seed concluído.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await semear({ demo: process.argv.includes("--demo") });
}
