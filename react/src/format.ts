// Formatação só de exibição. Valores sempre em centavos; datas "AAAA-MM-DD".
export const R = (c: number) =>
  (c < 0 ? "−" : "") + "R$ " + (Math.abs(c) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const mLab = (m: string) => MESL[+m.slice(5) - 1] + " de " + m.slice(0, 4);
export const dm = (d: string) => d.slice(8) + "/" + d.slice(5, 7);
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const dataLonga = (d: string) => {
  const x = new Date(d + "T12:00:00Z");
  return DIAS[x.getUTCDay()] + ", " + +d.slice(8) + " de " + MESL[+d.slice(5, 7) - 1];
};
export const pct1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const hojeISO = (d = new Date()) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** valor em centavos na moeda: R$, € ou US$ */
export const RM = (c: number, m: "BRL" | "EUR" | "USD" = "BRL") => (m === "BRL" ? R(c) : (m === "EUR" ? "€ " : "US$ ") + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
