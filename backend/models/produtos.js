import { db } from "../config/database.js";

const SELECT_BASE = `
  SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug, c.ativo AS categoria_ativa,
         COALESCE(p.preco_promocional, p.preco) AS preco_final,
         (SELECT ROUND(AVG(d.nota), 1) FROM depoimentos d WHERE d.produto_id = p.id AND d.aprovado = 1) AS nota_media,
         (SELECT COUNT(*) FROM depoimentos d WHERE d.produto_id = p.id AND d.aprovado = 1) AS total_avaliacoes
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id`;

const CAMPOS = [
  "nome", "slug", "descricao", "ingredientes", "tamanho", "preco", "preco_promocional",
  "imagem", "categoria_id", "estoque", "disponivel", "destaque", "etiqueta", "ordem",
];

function paraBanco(dados) {
  return CAMPOS.map((c) => {
    const v = dados[c];
    if (typeof v === "boolean") return v ? 1 : 0;
    return v === undefined ? null : v;
  });
}

/** Formato público (vitrine): sem campos internos. */
export function produtoPublico(p) {
  if (!p) return p;
  return {
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    descricao: p.descricao,
    ingredientes: p.ingredientes,
    tamanho: p.tamanho,
    preco: p.preco,
    preco_promocional: p.preco_promocional,
    preco_final: p.preco_final,
    imagem: p.imagem,
    categoria: p.categoria_slug ? { nome: p.categoria_nome, slug: p.categoria_slug } : null,
    estoque: p.estoque,
    esgotado: p.estoque <= 0,
    destaque: !!p.destaque,
    etiqueta: p.etiqueta,
    nota_media: p.nota_media,
    total_avaliacoes: p.total_avaliacoes,
  };
}

export const Produtos = {
  /** Vitrine: só produtos disponíveis e de categorias ativas (ou sem categoria). */
  listarPublicos({ categoria, destaque, busca } = {}) {
    const where = ["p.disponivel = 1", "(c.id IS NULL OR c.ativo = 1)"];
    const params = [];
    if (categoria) {
      where.push("c.slug = ?");
      params.push(categoria);
    }
    if (destaque) where.push("p.destaque = 1");
    if (busca) {
      where.push("(p.nome LIKE ? OR p.descricao LIKE ?)");
      params.push(`%${busca}%`, `%${busca}%`);
    }
    return db()
      .prepare(`${SELECT_BASE} WHERE ${where.join(" AND ")} ORDER BY (p.estoque <= 0), p.ordem, p.nome`)
      .all(...params);
  },

  buscarPublicoPorSlug(slug) {
    return db()
      .prepare(`${SELECT_BASE} WHERE p.slug = ? AND p.disponivel = 1 AND (c.id IS NULL OR c.ativo = 1)`)
      .get(slug);
  },

  buscarPublicoPorId(id) {
    return db()
      .prepare(`${SELECT_BASE} WHERE p.id = ? AND p.disponivel = 1 AND (c.id IS NULL OR c.ativo = 1)`)
      .get(id);
  },

  buscarVariosPorId(ids) {
    if (!ids.length) return [];
    return db()
      .prepare(`${SELECT_BASE} WHERE p.id IN (${ids.map(() => "?").join(",")})`)
      .all(...ids);
  },

  // ---------- Admin ----------
  listarAdmin({ busca = "", categoria_id } = {}) {
    const where = ["(p.nome LIKE ? OR p.slug LIKE ?)"];
    const params = [`%${busca}%`, `%${busca}%`];
    if (categoria_id) {
      where.push("p.categoria_id = ?");
      params.push(categoria_id);
    }
    return db()
      .prepare(
        `${SELECT_BASE.replace(
          "FROM produtos p",
          ", (SELECT IFNULL(SUM(i.quantidade), 0) FROM itens_pedido i JOIN pedidos pe ON pe.id = i.pedido_id WHERE i.produto_id = p.id AND pe.status <> 'cancelado') AS vendidos FROM produtos p"
        )} WHERE ${where.join(" AND ")} ORDER BY p.ordem, p.nome`
      )
      .all(...params);
  },

  buscar(id) {
    return db().prepare(`${SELECT_BASE} WHERE p.id = ?`).get(id);
  },

  slugExiste(slug, exceto = 0) {
    return !!db().prepare("SELECT 1 FROM produtos WHERE slug = ? AND id <> ?").get(slug, exceto);
  },

  criar(dados) {
    const r = db()
      .prepare(`INSERT INTO produtos (${CAMPOS.join(", ")}) VALUES (${CAMPOS.map(() => "?").join(", ")})`)
      .run(...paraBanco(dados));
    return this.buscar(r.lastInsertRowid);
  },

  atualizar(id, dados) {
    db()
      .prepare(`UPDATE produtos SET ${CAMPOS.map((c) => `${c} = ?`).join(", ")}, atualizado_em = datetime('now') WHERE id = ?`)
      .run(...paraBanco(dados), id);
    return this.buscar(id);
  },

  /** Atualização parcial de campos simples (estoque, preço, ativo...). */
  atualizarCampos(id, campos) {
    const chaves = Object.keys(campos).filter((c) => CAMPOS.includes(c));
    if (!chaves.length) return this.buscar(id);
    db()
      .prepare(`UPDATE produtos SET ${chaves.map((c) => `${c} = ?`).join(", ")}, atualizado_em = datetime('now') WHERE id = ?`)
      .run(...chaves.map((c) => (typeof campos[c] === "boolean" ? (campos[c] ? 1 : 0) : campos[c])), id);
    return this.buscar(id);
  },

  /** Baixa de estoque atômica: falha se não houver quantidade suficiente. */
  baixarEstoque(id, quantidade) {
    return db()
      .prepare("UPDATE produtos SET estoque = estoque - ?, atualizado_em = datetime('now') WHERE id = ? AND estoque >= ?")
      .run(quantidade, id, quantidade).changes === 1;
  },

  devolverEstoque(id, quantidade) {
    db().prepare("UPDATE produtos SET estoque = estoque + ?, atualizado_em = datetime('now') WHERE id = ?").run(quantidade, id);
  },

  remover(id) {
    return db().prepare("DELETE FROM produtos WHERE id = ?").run(id).changes > 0;
  },

  estoqueBaixo(limite = 5) {
    return db()
      .prepare("SELECT id, nome, estoque, disponivel FROM produtos WHERE estoque <= ? ORDER BY estoque, nome")
      .all(limite);
  },

  contar() {
    return db()
      .prepare("SELECT COUNT(*) total, SUM(disponivel) disponiveis, SUM(CASE WHEN estoque <= 0 THEN 1 ELSE 0 END) esgotados FROM produtos")
      .get();
  },
};
