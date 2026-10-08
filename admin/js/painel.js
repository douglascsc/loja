import { get } from "/js/core/api.js";
import { STATUS } from "/js/core/constantes.js";
import { $, html, renderizar } from "/js/core/dom.js";
import { dataHora, moeda } from "/js/core/formato.js";
import { atualizarContagens, iniciarAdmin } from "./comum.js";

iniciarAdmin();

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

/** Últimos 14 dias (inclusive hoje, no fuso de Brasília), com zero onde não houve venda. */
function serieDias(vendas) {
  const mapa = new Map(vendas.map((v) => [v.dia, v]));
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dias = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i));
    const chave = d.toISOString().slice(0, 10);
    dias.push({ dia: chave, data: d, total: mapa.get(chave)?.total || 0, pedidos: mapa.get(chave)?.pedidos || 0 });
  }
  return dias;
}

function escalaBonita(maximo) {
  if (maximo <= 0) return 10000;
  const passo = 10 ** Math.floor(Math.log10(maximo));
  return Math.ceil(maximo / passo) * passo;
}

/** Gráfico de colunas (uma série): barras finas, topo arredondado, grade discreta e dica ao passar o mouse. */
function desenharGrafico(container, dias) {
  const L = 640;
  const A = 240;
  const m = { topo: 12, dir: 8, base: 26, esq: 64 };
  const larg = L - m.esq - m.dir;
  const alt = A - m.topo - m.base;
  const teto = escalaBonita(Math.max(...dias.map((d) => d.total)));
  const faixa = larg / dias.length;
  const barra = Math.min(24, faixa * 0.6);
  const y = (v) => m.topo + alt - (v / teto) * alt;
  const linhas = [0, 0.25, 0.5, 0.75, 1].map((f) => teto * f);

  const caminho = (x, topo, largura) => {
    const h = m.topo + alt - topo;
    if (h <= 0) return "";
    const r = Math.min(4, h, largura / 2);
    const base = m.topo + alt;
    return `M${x} ${base}V${topo + r}Q${x} ${topo} ${x + r} ${topo}H${x + largura - r}Q${x + largura} ${topo} ${x + largura} ${topo + r}V${base}Z`;
  };

  renderizar(
    container,
    html`<svg viewBox="0 0 ${L} ${A}" role="img" aria-label="Vendas por dia nos últimos 14 dias. Detalhes na tabela abaixo.">
      ${linhas.map((v) => html`<line class="grade-linha" x1="${m.esq}" x2="${L - m.dir}" y1="${y(v)}" y2="${y(v)}"></line>
        <text class="eixo-texto" x="${m.esq - 8}" y="${y(v) + 4}" text-anchor="end">${moeda(v).replace(",00", "")}</text>`)}
      ${dias.map((d, i) => {
        const x = m.esq + i * faixa + (faixa - barra) / 2;
        return html`<rect class="alvo" x="${m.esq + i * faixa}" y="${m.topo}" width="${faixa}" height="${alt}" tabindex="0" role="img" data-i="${i}"
            aria-label="${DIA_LONGO.format(d.data)}: ${moeda(d.total)} em ${d.pedidos} pedido(s)"></rect>
          <path class="barra" d="${caminho(x, y(d.total), barra)}"></path>
          ${i % 2 === dias.length % 2 || i === dias.length - 1 ? html`<text class="eixo-texto" x="${x + barra / 2}" y="${A - 6}" text-anchor="middle">${i === dias.length - 1 ? "Hoje" : DIA_CURTO.format(d.data)}</text>` : ""}`;
      })}
    </svg>
    <div class="dica-grafico" hidden></div>`
  );

  const dica = container.querySelector(".dica-grafico");
  const svg = container.querySelector("svg");
  const mostrar = (alvo) => {
    const d = dias[Number(alvo.dataset.i)];
    const caixa = svg.getBoundingClientRect();
    const r = alvo.getBoundingClientRect();
    renderizar(dica, html`<strong>${moeda(d.total)}</strong>${DIA_LONGO.format(d.data)} · ${d.pedidos} pedido(s)`);
    dica.style.left = `${r.left - caixa.left + r.width / 2}px`;
    dica.style.top = `${y(d.total) * (caixa.height / A)}px`;
    dica.hidden = false;
  };
  for (const alvo of container.querySelectorAll(".alvo")) {
    alvo.addEventListener("pointerenter", () => mostrar(alvo));
    alvo.addEventListener("focus", () => mostrar(alvo));
    alvo.addEventListener("pointerleave", () => (dica.hidden = true));
    alvo.addEventListener("blur", () => (dica.hidden = true));
  }
}

async function carregar() {
  const d = await get("/admin/dashboard");
  atualizarContagens(d);
  const aguardando = d.pedidos_por_status.aguardando_confirmacao || 0;
  const ticket = d.vendas.pedidos_mes ? Math.round(d.vendas.mes / d.vendas.pedidos_mes) : 0;

  renderizar(
    $("#indicadores"),
    html`
      <a class="indicador${aguardando ? " alerta-indicador" : ""}" href="/admin/pedidos?status=aguardando_confirmacao">
        <span>Pedidos aguardando</span><strong>${aguardando}</strong><small>${aguardando ? "Confirme o quanto antes" : "Tudo em dia"}</small></a>
      <div class="indicador"><span>Vendas hoje</span><strong>${moeda(d.vendas.hoje)}</strong><small>${d.vendas.pedidos_hoje} pedido(s)</small></div>
      <div class="indicador"><span>Vendas no mês</span><strong>${moeda(d.vendas.mes)}</strong><small>Ticket médio ${moeda(ticket)}</small></div>
      <div class="indicador"><span>Clientes cadastrados</span><strong>${d.clientes}</strong><small>&nbsp;</small></div>
      <div class="indicador"><span>Produtos</span><strong>${d.produtos.disponiveis || 0}/${d.produtos.total}</strong><small>${d.produtos.esgotados || 0} esgotado(s)</small></div>`
  );

  $("#situacaoLoja").textContent = d.loja.aberta ? "Loja aberta agora" : "Loja fechada agora";

  const dias = serieDias(d.vendas_por_dia);
  desenharGrafico($("#grafico"), dias);
  renderizar(
    $("#tabelaGrafico"),
    html`<table class="tabela"><thead><tr><th scope="col">Dia</th><th scope="col" class="num">Pedidos</th><th scope="col" class="num">Vendas</th></tr></thead>
      <tbody>${dias.map((x) => html`<tr><td data-rotulo="Dia">${DIA_LONGO.format(x.data)}</td><td class="num" data-rotulo="Pedidos">${x.pedidos}</td><td class="num" data-rotulo="Vendas">${moeda(x.total)}</td></tr>`)}</tbody></table>`
  );

  renderizar(
    $("#ultimosPedidos"),
    d.ultimos_pedidos.length
      ? d.ultimos_pedidos.map(
          (p) => html`<tr>
            <td class="principal" data-rotulo="Pedido"><a href="/admin/pedidos?abrir=${p.id}">${p.codigo}</a><span class="secundario">${dataHora(p.criado_em)}</span></td>
            <td data-rotulo="Cliente">${p.cliente_nome}</td>
            <td data-rotulo="Status"><span class="status status-${p.status}">${STATUS[p.status]}</span></td>
            <td class="num" data-rotulo="Total">${moeda(p.total)}</td></tr>`
        )
      : html`<tr><td colspan="4">Nenhum pedido ainda.</td></tr>`
  );

  renderizar(
    $("#maisVendidos"),
    d.mais_vendidos.length
      ? d.mais_vendidos.map((p) => html`<li><span>${p.nome}</span><strong>${p.quantidade} un · ${moeda(p.total)}</strong></li>`)
      : html`<li>Sem vendas registradas.</li>`
  );

  renderizar(
    $("#estoqueBaixo"),
    d.estoque_baixo.length
      ? d.estoque_baixo.map(
          (p) => html`<li><a href="/admin/produtos?editar=${p.id}">${p.nome}</a><strong class="${p.estoque === 0 ? "disponibilidade esgotado" : "disponibilidade ultimas"}">${p.estoque === 0 ? "Esgotado" : `${p.estoque} un`}</strong></li>`
        )
      : html`<li>Nenhum produto com estoque baixo.</li>`
  );

  const avisos = [];
  if (d.depoimentos_pendentes) avisos.push(html`<li><a href="/admin/depoimentos">${d.depoimentos_pendentes} depoimento(s) aguardando aprovação</a></li>`);
  if (d.mensagens_nao_lidas) avisos.push(html`<li><a href="/admin/mensagens">${d.mensagens_nao_lidas} mensagem(ns) não lida(s)</a></li>`);
  renderizar($("#avisos"), avisos.length ? avisos : html`<li>Nenhuma pendência.</li>`);
}

carregar();
setInterval(() => !document.hidden && carregar(), 60_000);
