import { Router } from "express";
import { env } from "../config/env.js";
import { exigirAdminPagina, exigirLoginPagina } from "../middleware/auth.js";
import { Categorias } from "../models/categorias.js";
import { Produtos } from "../models/produtos.js";
import { configPublica } from "../services/loja.js";
import { jsonldLoja, renderizar } from "../services/paginas.js";

const r = Router();
const PRIVADA = "noindex, nofollow";

function enviar(res, area, pagina, vars, status = 200) {
  res.status(status).type("html").send(renderizar(area, pagina, vars));
}

const titulo = (t) => `${t} | ${configPublica().nome_loja}`;

r.get("/", (_req, res) => {
  const loja = configPublica();
  enviar(res, "site", "index", {
    titulo: `${loja.nome_loja} — Bolo de pote artesanal em ${loja.cidade_entrega}`,
    jsonld: jsonldLoja(),
  });
});

r.get("/produtos", (_req, res) => {
  enviar(res, "site", "produtos", {
    titulo: titulo("Cardápio de bolos de pote"),
    descricao: "Veja todos os sabores de bolo de pote e kits disponíveis hoje. Peça online com entrega em Campo Bom.",
    canonical: `${env.urlPublica}/produtos`,
    categoria_atual: "",
  });
});

r.get("/produtos/:categoria", (req, res, next) => {
  const categoria = Categorias.buscarPorSlug(req.params.categoria);
  if (!categoria) return next();
  enviar(res, "site", "produtos", {
    titulo: titulo(categoria.nome),
    descricao: categoria.descricao || `Bolos de pote da categoria ${categoria.nome}.`,
    canonical: `${env.urlPublica}/produtos/${categoria.slug}`,
    categoria_atual: categoria.slug,
  });
});

r.get("/produto/:slug", (req, res, next) => {
  const p = Produtos.buscarPublicoPorSlug(req.params.slug);
  if (!p) return next();
  const url = `${env.urlPublica}/produto/${p.slug}`;
  const imagem = p.imagem ? env.urlPublica + p.imagem : `${env.urlPublica}/assets/og-imagem.png`;
  enviar(res, "site", "produto", {
    titulo: titulo(p.nome),
    descricao: (p.descricao || p.nome).slice(0, 160),
    canonical: url,
    og_tipo: "product",
    og_imagem: imagem,
    produto_slug: p.slug,
    produto_nome: p.nome,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.nome,
      description: p.descricao,
      image: imagem,
      sku: String(p.id),
      brand: { "@type": "Brand", name: configPublica().nome_loja },
      ...(p.total_avaliacoes > 0
        ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.nota_media, reviewCount: p.total_avaliacoes } }
        : {}),
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "BRL",
        price: (p.preco_final / 100).toFixed(2),
        availability: p.estoque > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    },
  });
});

r.get("/checkout", exigirLoginPagina, (_req, res) =>
  enviar(res, "site", "checkout", { titulo: titulo("Finalizar pedido"), robots: PRIVADA })
);

r.get("/login", (req, res) => {
  if (req.cliente) return res.redirect(302, req.cliente.papel === "admin" ? "/admin" : "/conta");
  enviar(res, "site", "login", { titulo: titulo("Entrar"), robots: PRIVADA, canonical: `${env.urlPublica}/login` });
});

r.get("/cadastro", (req, res) => {
  if (req.cliente) return res.redirect(302, "/conta");
  enviar(res, "site", "cadastro", { titulo: titulo("Criar conta"), robots: PRIVADA, canonical: `${env.urlPublica}/cadastro` });
});

r.get("/conta", exigirLoginPagina, (_req, res) =>
  enviar(res, "site", "conta", { titulo: titulo("Minha conta"), robots: PRIVADA })
);

r.get("/conta/pedidos/:id", exigirLoginPagina, (_req, res) =>
  enviar(res, "site", "pedido", { titulo: titulo("Detalhes do pedido"), robots: PRIVADA })
);

r.get("/privacidade", (_req, res) =>
  enviar(res, "site", "privacidade", { titulo: titulo("Política de privacidade"), canonical: `${env.urlPublica}/privacidade` })
);

r.get("/termos", (_req, res) =>
  enviar(res, "site", "termos", { titulo: titulo("Termos de uso"), canonical: `${env.urlPublica}/termos` })
);

// ---------- Painel administrativo (protegido no servidor) ----------
const PAGINAS_ADMIN = {
  "": ["index", "Painel"],
  produtos: ["produtos", "Produtos"],
  pedidos: ["pedidos", "Pedidos"],
  clientes: ["clientes", "Clientes"],
  depoimentos: ["depoimentos", "Depoimentos"],
  mensagens: ["mensagens", "Mensagens"],
  configuracoes: ["configuracoes", "Configurações"],
};

r.get(["/admin", "/admin/:pagina"], exigirAdminPagina, (req, res, next) => {
  const item = PAGINAS_ADMIN[req.params.pagina || ""];
  if (!item) return next();
  res.set("Cache-Control", "no-store");
  enviar(res, "admin", item[0], { titulo: `${item[1]} | Admin`, robots: PRIVADA });
});

// ---------- SEO ----------
r.get("/robots.txt", (_req, res) => {
  res.type("text").send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /conta\nDisallow: /checkout\n\nSitemap: ${env.urlPublica}/sitemap.xml\n`
  );
});

r.get("/sitemap.xml", (_req, res) => {
  const urls = [
    ["/", "1.0"],
    ["/produtos", "0.9"],
    ...Categorias.listar().map((c) => [`/produtos/${c.slug}`, "0.7"]),
    ...Produtos.listarPublicos().map((p) => [`/produto/${p.slug}`, "0.8"]),
    ["/privacidade", "0.2"],
    ["/termos", "0.2"],
  ];
  const corpo = urls
    .map(([u, prioridade]) => `  <url><loc>${env.urlPublica}${u}</loc><priority>${prioridade}</priority></url>`)
    .join("\n");
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${corpo}\n</urlset>\n`
  );
});

// ---------- 404 ----------
r.use((req, res) => {
  enviar(res, "site", "404", { titulo: titulo("Página não encontrada"), robots: PRIVADA }, 404);
});

export default r;
