// Dinheiro (sempre em centavos), datas ISO (AAAA-MM-DD), cores e textos.
export const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const R = (c: number) => "R$ " + brl(c);
export const signR = (c: number) => (c < 0 ? "−" : "") + R(Math.abs(c));
export const pad = (n: number) => String(n).padStart(2, "0");
export const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
/** data de hoje deslocada em `d` dias */
export const ymd = (d: number) => { const t = new Date(); t.setDate(t.getDate() + d); return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()); };
export const shiftYM = (ym: string, d: number) => {
  let [y, m] = ym.split("-").map(Number);
  m += d; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
  return y + "-" + pad(m);
};
export const lastDay = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
export const fmtD = (s: string) => (s ? s.slice(8) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : "");
export const fmtDM = (d: string) => (d ? d.slice(8) + "/" + d.slice(5, 7) : "");
export const MESN = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const dayLbl = (d: string) =>
  d === today() ? "Hoje" : d === ymd(-1) ? "Ontem"
    : `${+d.slice(8)} de ${MESN[+d.slice(5, 7) - 1]}` + (d.slice(0, 4) !== today().slice(0, 4) ? " " + d.slice(0, 4) : "");

/** minúsculas e sem acento (busca e comparações) */
export const fold = (t: string | null | undefined) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** só os dígitos de um campo de valor, em centavos (até 10 dígitos) */
export const digits = (v: string | null | undefined) => Number(String(v || "").replace(/\D/g, "").slice(0, 10) || 0);
/** texto digitado → valor formatado enquanto se digita */
export const moneyMask = (v: string) => { const c = digits(v); return c ? brl(c) : ""; };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const hexRgb = (h: string): [number, number, number] => {
  h = (h || "").replace("#", "");
  if (h.length === 3) h = h.replace(/./g, "$&$&");
  const n = parseInt(h, 16);
  return isNaN(n) ? [107, 122, 117] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** luminância relativa (0 escuro … 1 claro): decide se o texto sobre a cor é claro ou escuro */
export const lumHex = (h: string) => {
  const [r, g, b] = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const textOn = (color: string, limit = 0.45) => (lumHex(color) > limit ? "#1A1A1A" : "#FFFFFF");
