// Gera as ilustrações SVG dos produtos (placeholders próprios da marca).
// Uso: node scripts/gerar-ilustracoes.js  → frontend/assets/produtos/*.svg
// Substitua por fotos reais pelo painel admin quando tiver.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const destino = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend/assets/produtos");
mkdirSync(destino, { recursive: true });

// Gerador pseudoaleatório determinístico (as imagens não mudam entre execuções).
function aleatorio(semente) {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const onda = (y, amp, x0 = 150, x1 = 450, passos = 6) => {
  const w = (x1 - x0) / passos;
  let d = `M${x0 - 20} ${y}`;
  for (let i = 0; i < passos; i++) {
    d += ` q${w / 2} ${i % 2 ? amp : -amp} ${w} 0`;
  }
  return d;
};

function camada(yTopo, yBase, cor, amp = 8) {
  return `<path d="${onda(yTopo, amp)} L470 ${yBase} L130 ${yBase} Z" fill="${cor}"/>`;
}

function decoracao(tipo, cor, rnd, cx = 300, cy = 182) {
  const itens = [];
  if (tipo === "granulado") {
    for (let i = 0; i < 46; i++) {
      const t = rnd() * 2 - 1, x = cx + t * 105, y = cy + 6 + Math.abs(t) * 26 - rnd() * 22, a = rnd() * 180;
      itens.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="11" height="4" rx="2" fill="${cor}" transform="rotate(${a.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
    }
  } else if (tipo === "flocos") {
    for (let i = 0; i < 40; i++) {
      const t = rnd() * 2 - 1, x = cx + t * 105, y = cy + 6 + Math.abs(t) * 24 - rnd() * 20;
      itens.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(3 + rnd() * 4).toFixed(1)}" ry="2" fill="${cor}" transform="rotate(${(rnd() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
    }
  } else if (tipo === "bolinhas") {
    for (const [dx, dy] of [[-62, 4], [0, -14], [60, 6], [-28, 18], [32, 20]]) {
      itens.push(`<circle cx="${cx + dx}" cy="${cy + dy}" r="15" fill="${cor}"/><circle cx="${cx + dx - 5}" cy="${cy + dy - 5}" r="4" fill="#fff" opacity=".35"/>`);
    }
  } else if (tipo === "morangos") {
    for (const [dx, dy, r] of [[-55, 6, -20], [8, -12, 8], [62, 8, 24]]) {
      itens.push(`<g transform="translate(${cx + dx} ${cy + dy}) rotate(${r})"><path d="M0 -20 C 18 -20 22 0 0 24 C -22 0 -18 -20 0 -20 Z" fill="${cor}"/><path d="M-10 -20 l10 -8 l10 8 l-10 4 z" fill="#3f8a4b"/><circle cx="-5" cy="-4" r="1.6" fill="#ffe9a8"/><circle cx="5" cy="3" r="1.6" fill="#ffe9a8"/><circle cx="-2" cy="10" r="1.6" fill="#ffe9a8"/></g>`);
    }
  } else if (tipo === "raspas") {
    for (let i = 0; i < 30; i++) {
      const t = rnd() * 2 - 1, x = cx + t * 100, y = cy + 6 + Math.abs(t) * 24 - rnd() * 18;
      itens.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="9" height="3" rx="1.5" fill="${cor}" transform="rotate(${(rnd() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
    }
    itens.push(`<g transform="translate(${cx + 40} ${cy - 10}) rotate(-25)"><path d="M-30 0 a30 30 0 0 1 60 0 z" fill="#f4dd5a"/><path d="M-24 0 a24 24 0 0 1 48 0 z" fill="#fbf0a0"/><path d="M0 0 L0 -24 M0 0 L-17 -17 M0 0 L17 -17" stroke="#f4dd5a" stroke-width="2"/></g>`);
  } else if (tipo === "nozes") {
    for (const [dx, dy] of [[-60, 6], [-5, -12], [52, 4], [20, 18]]) {
      itens.push(`<g transform="translate(${cx + dx} ${cy + dy})"><path d="M-16 0 C -16 -14 16 -14 16 0 C 16 14 -16 14 -16 0 Z" fill="${cor}"/><path d="M-10 0 C -6 -6 6 6 10 0 M0 -9 L0 9" stroke="#6b4423" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`);
    }
  } else if (tipo === "migalhas") {
    for (let i = 0; i < 26; i++) {
      const t = rnd() * 2 - 1, x = cx + t * 100, y = cy + 6 + Math.abs(t) * 24 - rnd() * 18;
      itens.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(5 + rnd() * 6).toFixed(1)}" height="${(5 + rnd() * 6).toFixed(1)}" rx="2" fill="${cor}"/>`);
    }
  }
  return itens.join("");
}

/** Desenha um pote completo. Coordenadas no espaço 600x600. */
function pote(s, id, rnd) {
  const [b1, c1, b2, c2] = s.camadas;
  return `
  <g>
    <ellipse cx="300" cy="528" rx="150" ry="16" fill="#3A2118" opacity=".14"/>
    <g clip-path="url(#corpo-${id})">
      <rect x="120" y="190" width="360" height="350" fill="${b1}"/>
      ${camada(445, 540, b1, 6)}
      ${camada(400, 448, c1, 9)}
      ${camada(325, 404, b2, 6)}
      ${camada(276, 330, c2, 10)}
      ${camada(212, 280, s.topo, 7)}
      <rect x="150" y="190" width="300" height="340" fill="url(#vidro-${id})"/>
    </g>
    <path d="M178 205 L196 498 Q198 522 224 522 L376 522 Q402 522 404 498 L422 205" fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="5" stroke-linejoin="round"/>
    <path d="M206 232 L218 480" stroke="#fff" stroke-opacity=".55" stroke-width="10" stroke-linecap="round"/>
    <rect x="160" y="196" width="280" height="16" rx="8" fill="#ffffff" opacity=".9"/>
    <path d="M166 204 Q300 112 434 204 Q300 222 166 204 Z" fill="${s.topo}"/>
    <path d="M194 196 Q300 128 406 196" fill="none" stroke="${s.calda || s.topo}" stroke-width="12" stroke-linecap="round" opacity=".9"/>
    <path d="M226 168 Q300 140 360 160" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="7" stroke-linecap="round"/>
    ${decoracao(s.decoracao, s.corDecoracao, rnd, 300, 168)}
  </g>`;
}

function defs(id) {
  return `
    <clipPath id="corpo-${id}"><path d="M178 205 L196 498 Q198 522 224 522 L376 522 Q402 522 404 498 L422 205 Z"/></clipPath>
    <linearGradient id="vidro-${id}" x1="0" x2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".28"/>
      <stop offset=".35" stop-color="#fff" stop-opacity=".04"/>
      <stop offset=".8" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".22"/>
    </linearGradient>`;
}

function fundo(cor1, cor2) {
  return `<rect width="600" height="600" fill="${cor1}"/><circle cx="300" cy="330" r="235" fill="${cor2}"/>
  <g fill="#fff" opacity=".5"><circle cx="92" cy="110" r="6"/><circle cx="520" cy="96" r="4"/><circle cx="540" cy="470" r="7"/><circle cx="70" cy="455" r="4"/></g>`;
}

const sabores = {
  "ninho-com-nutella":       { camadas: ["#f1dfbd", "#fbf6ea", "#f1dfbd", "#5a3424"], topo: "#fbf6ea", calda: "#5a3424", decoracao: "bolinhas", corDecoracao: "#6b3e26", fundo: ["#FCE6EC", "#F8D3DE"] },
  "brigadeiro-tradicional":  { camadas: ["#6b3e2a", "#4a2a1d", "#6b3e2a", "#4a2a1d"], topo: "#3f2318", decoracao: "granulado", corDecoracao: "#25130c", fundo: ["#F6E7D6", "#EFD5BC"] },
  "prestigio":               { camadas: ["#6b3e2a", "#fbf7ef", "#6b3e2a", "#fbf7ef"], topo: "#4a2a1d", decoracao: "flocos", corDecoracao: "#fffaf0", fundo: ["#EAF3EC", "#D5E8DA"] },
  "cenoura-com-chocolate":   { camadas: ["#f0a443", "#4a2a1d", "#f0a443", "#4a2a1d"], topo: "#3f2318", decoracao: "granulado", corDecoracao: "#f7c46c", fundo: ["#FFF0DD", "#FBDDB5"] },
  "red-velvet":              { camadas: ["#a3202f", "#fbf3ec", "#a3202f", "#fbf3ec"], topo: "#fffaf5", calda: "#fbf3ec", decoracao: "migalhas", corDecoracao: "#a3202f", fundo: ["#FBE4E4", "#F5C9CB"] },
  "morango-com-chantilly":   { camadas: ["#f6e7cf", "#f3a0b4", "#f6e7cf", "#fff6f2"], topo: "#fffaf8", calda: "#f3a0b4", decoracao: "morangos", corDecoracao: "#d93a4a", fundo: ["#FCE6EC", "#F8CFDA"] },
  "limao-siciliano":         { camadas: ["#f6ebc4", "#fbf3b8", "#f6ebc4", "#fffbe8"], topo: "#fffdf4", calda: "#f4e27a", decoracao: "raspas", corDecoracao: "#8fbf4a", fundo: ["#F7F6DA", "#EEECB8"] },
  "doce-de-leite-com-nozes": { camadas: ["#e8c38c", "#c98b45", "#e8c38c", "#c98b45"], topo: "#d79a54", calda: "#b8742f", decoracao: "nozes", corDecoracao: "#9a6334", fundo: ["#FBEBD8", "#F3D4AE"] },
};

for (const [nome, s] of Object.entries(sabores)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img">
  <defs>${defs("a")}</defs>
  ${fundo(...s.fundo)}
  ${pote(s, "a", aleatorio(nome.length * 7919))}
</svg>
`;
  writeFileSync(path.join(destino, `${nome}.svg`), svg);
}

// Kits: vários potes menores lado a lado.
function kit(nome, lista, fundoCores) {
  const n = lista.length;
  const colunas = n <= 4 ? 2 : 3;
  const linhas = Math.ceil(n / colunas);
  const escala = colunas === 2 ? 0.5 : 0.38;
  const largura = 600 * escala;
  const altura = 600 * escala;
  const x0 = (600 - colunas * largura * 0.86) / 2 - largura * 0.07;
  const y0 = (600 - linhas * altura * 0.78) / 2 - altura * 0.12;
  let corpo = "";
  let defsTodas = "";
  lista.forEach((sabor, i) => {
    const c = i % colunas, l = Math.floor(i / colunas);
    const id = `k${i}`;
    defsTodas += defs(id);
    corpo += `<g transform="translate(${(x0 + c * largura * 0.86).toFixed(1)} ${(y0 + l * altura * 0.78).toFixed(1)}) scale(${escala})">${pote(sabores[sabor], id, aleatorio(i * 31 + 7))}</g>`;
  });
  writeFileSync(
    path.join(destino, `${nome}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img">\n  <defs>${defsTodas}</defs>\n  ${fundo(...fundoCores)}\n  <rect x="70" y="470" width="460" height="70" rx="20" fill="#3A2118" opacity=".08"/>\n  ${corpo}\n</svg>\n`
  );
}

kit("kit-degustacao-4", ["ninho-com-nutella", "brigadeiro-tradicional", "red-velvet", "morango-com-chantilly"], ["#F6E7D6", "#EFD5BC"]);
kit("kit-festa-6", ["ninho-com-nutella", "brigadeiro-tradicional", "prestigio", "red-velvet", "morango-com-chantilly", "limao-siciliano"], ["#FCE6EC", "#F8D3DE"]);

console.log("Ilustrações geradas em", destino);
