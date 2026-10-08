const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const moeda = (centavos) => moedaFmt.format((Number(centavos) || 0) / 100);

/** Converte "R$ 12,50" / "12,5" / "12.50" para centavos. */
export function paraCentavos(texto) {
  const limpo = String(texto ?? "").replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Datas do banco vêm em UTC ("2026-10-08 14:00:00"). */
export const paraData = (s) => new Date(String(s).replace(" ", "T") + (String(s).includes("Z") ? "" : "Z"));

const fuso = { timeZone: "America/Sao_Paulo" };
export const data = (s) => paraData(s).toLocaleDateString("pt-BR", { ...fuso, day: "2-digit", month: "2-digit", year: "numeric" });
export const dataHora = (s) =>
  paraData(s).toLocaleString("pt-BR", { ...fuso, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function telefone(digitos) {
  const d = String(digitos || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export const cep = (d) => String(d || "").replace(/\D/g, "").replace(/^(\d{5})(\d{1,3})$/, "$1-$2");

/** Máscara de digitação para telefone e CEP. */
export function aplicarMascara(input, tipo) {
  input.addEventListener("input", () => {
    const d = input.value.replace(/\D/g, "");
    if (tipo === "telefone") {
      const t = d.slice(0, 11);
      input.value =
        t.length > 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`
        : t.length > 6 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`
        : t.length > 2 ? `(${t.slice(0, 2)}) ${t.slice(2)}`
        : t;
    } else if (tipo === "cep") {
      const c = d.slice(0, 8);
      input.value = c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
    }
  });
}

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
