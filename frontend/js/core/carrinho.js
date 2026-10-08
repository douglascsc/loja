// Carrinho persistido no navegador (localStorage).
// Guardamos apenas id + quantidade + um "retrato" para exibição; preços e
// estoque são sempre reconferidos no servidor (POST /api/carrinho/validar)
// e o pedido final é calculado só no backend.
import { post } from "./api.js";

const CHAVE = "bolodepote:carrinho:v1";
const MAXIMO = 50;
const ouvintes = new Set();

function ler() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE) || "{}");
    return Array.isArray(dados.itens) ? dados.itens.filter((i) => Number.isInteger(i.id) && i.qtd > 0) : [];
  } catch {
    return [];
  }
}

let itens = ler();

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ itens, atualizado: Date.now() }));
  } catch {
    /* modo privado / armazenamento cheio: carrinho fica só na memória */
  }
  ouvintes.forEach((fn) => fn(itens));
}

// Mantém abas diferentes sincronizadas.
window.addEventListener("storage", (e) => {
  if (e.key === CHAVE) {
    itens = ler();
    ouvintes.forEach((fn) => fn(itens));
  }
});

const limite = (item) => Math.min(MAXIMO, item.estoque ?? MAXIMO);

export const carrinho = {
  itens: () => itens.map((i) => ({ ...i })),
  quantidadeTotal: () => itens.reduce((s, i) => s + i.qtd, 0),
  subtotal: () => itens.reduce((s, i) => s + i.qtd * i.preco, 0),
  quantidadeDe: (id) => itens.find((i) => i.id === id)?.qtd || 0,
  vazio: () => itens.length === 0,

  /** Retorna a quantidade efetivamente adicionada (pode ser menor por estoque). */
  adicionar(produto, qtd = 1) {
    let item = itens.find((i) => i.id === produto.id);
    if (!item) {
      item = { id: produto.id, qtd: 0 };
      itens.push(item);
    }
    Object.assign(item, {
      nome: produto.nome,
      slug: produto.slug,
      imagem: produto.imagem,
      preco: produto.preco_final,
      estoque: produto.estoque,
    });
    const antes = item.qtd;
    item.qtd = Math.min(item.qtd + qtd, limite(item));
    if (item.qtd <= 0) itens = itens.filter((i) => i !== item);
    salvar();
    return item.qtd - antes;
  },

  definir(id, qtd) {
    const item = itens.find((i) => i.id === id);
    if (!item) return;
    if (qtd <= 0) itens = itens.filter((i) => i.id !== id);
    else item.qtd = Math.min(qtd, limite(item));
    salvar();
  },

  remover(id) {
    itens = itens.filter((i) => i.id !== id);
    salvar();
  },

  limpar() {
    itens = [];
    salvar();
  },

  ouvir(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
  },

  paraApi: () => itens.map((i) => ({ produto_id: i.id, quantidade: i.qtd })),

  /** Reconfere preços/estoque com o servidor e corrige o carrinho local. */
  async sincronizar() {
    if (!itens.length) return { itens: [], subtotal: 0, problemas: [] };
    const r = await post("/carrinho/validar", { itens: this.paraApi() });
    const validos = new Map(r.itens.map((i) => [i.produto_id, i]));
    itens = itens
      .filter((i) => validos.has(i.id))
      .map((i) => {
        const v = validos.get(i.id);
        return { id: i.id, qtd: v.quantidade, nome: v.nome, slug: v.slug, imagem: v.imagem, preco: v.preco_unitario, estoque: v.estoque };
      });
    salvar();
    return r;
  },
};
