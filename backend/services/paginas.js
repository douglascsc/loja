import { readFileSync } from "node:fs";
import path from "node:path";
import { env, RAIZ } from "../config/env.js";
import { escaparHtml, jsonParaScript } from "../lib/texto.js";
import { configPublica } from "./loja.js";

const PASTAS = { site: path.join(RAIZ, "frontend"), admin: path.join(RAIZ, "admin") };
const cache = new Map();

function lerArquivo(caminho) {
  if (env.producao && cache.has(caminho)) return cache.get(caminho);
  const conteudo = readFileSync(caminho, "utf8");
  if (env.producao) cache.set(caminho, conteudo);
  return conteudo;
}

/**
 * Monta uma página HTML:
 *  <!-- @include nome -->  insere frontend/partials/nome.html
 *  {{chave}}               valor escapado
 *  {{{chave}}}             valor bruto (somente valores gerados pelo servidor)
 */
export function renderizar(area, pagina, vars = {}) {
  let html = lerArquivo(path.join(PASTAS[area], `${pagina}.html`));
  for (let i = 0; i < 3 && html.includes("<!-- @include"); i++) {
    html = html.replace(/<!-- @include ([a-z0-9-]+) -->/g, (_, nome) =>
      lerArquivo(path.join(PASTAS.site, "partials", `${nome}.html`))
    );
  }

  const loja = configPublica();
  const todas = {
    loja_nome: loja.nome_loja,
    loja_slogan: loja.slogan,
    loja_logo: loja.logo,
    titulo: loja.nome_loja,
    descricao: loja.descricao_seo || loja.slogan,
    url: env.urlPublica,
    canonical: env.urlPublica + "/",
    og_imagem: env.urlPublica + "/assets/og-imagem.png",
    og_tipo: "website",
    robots: "index, follow",
    ano: new Date().getFullYear(),
    jsonld: "",
    ...vars,
  };
  if (todas.jsonld && typeof todas.jsonld === "object") {
    todas.jsonld = `<script type="application/ld+json">${jsonParaScript(todas.jsonld)}</script>`;
  }

  return html
    .replace(/\{\{\{\s*([a-z0-9_]+)\s*\}\}\}/g, (_, k) => String(todas[k] ?? ""))
    .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_, k) => escaparHtml(todas[k] ?? ""));
}

/** Dados estruturados da loja (schema.org/Bakery). */
export function jsonldLoja() {
  const loja = configPublica();
  const e = loja.endereco || {};
  const sameAs = [loja.instagram, loja.facebook, loja.tiktok].filter(Boolean);
  const dias = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const horarios = Object.entries(loja.horarios || {}).flatMap(([d, faixas]) =>
    faixas.map(([abre, fecha]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: dias[d], opens: abre, closes: fecha }))
  );
  return {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: loja.nome_loja,
    description: loja.slogan,
    url: env.urlPublica + "/",
    image: env.urlPublica + "/assets/og-imagem.png",
    logo: env.urlPublica + loja.logo,
    ...(loja.telefone || loja.whatsapp ? { telephone: "+55" + (loja.telefone || loja.whatsapp) } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: [e.logradouro, e.numero].filter(Boolean).join(", ") || undefined,
      addressLocality: e.cidade || loja.cidade_entrega,
      addressRegion: e.estado || "RS",
      postalCode: e.cep || undefined,
      addressCountry: "BR",
    },
    areaServed: loja.cidade_entrega,
    servesCuisine: "Confeitaria",
    priceRange: "R$",
    ...(horarios.length ? { openingHoursSpecification: horarios } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}
