// Lançar: uma entrada vira vários lançamentos (parcelas, todo mês, dividir com pessoas ou pagar com duas formas).
import { CAT_DIV } from "./categories";
import { lastDay, pad, uid } from "./format";
import type { Entry, EntryType } from "./types";

export type Rep = { k: "1" } | { k: "p"; n: number } | { k: "m"; n: number } | { k: "u"; until: string };
export const MAX_REP = 60;

/** data + k meses; dia 31 num mês de 30 dias vira 30 (e 28/29 em fevereiro) */
export const addMonths = (date: string, k: number) => {
  let y = +date.slice(0, 4), m = +date.slice(5, 7) + k; const d = +date.slice(8, 10);
  while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; }
  const ym = y + "-" + pad(m); return ym + "-" + pad(Math.min(d, lastDay(ym)));
};
/** quantos lançamentos o "repetir" gera (0 = escolha inválida) */
export const repCount = (r: Rep, date: string) => {
  if (r.k === "1") return 1;
  if (r.k === "u") { const n = (+r.until.slice(0, 4) - +date.slice(0, 4)) * 12 + (+r.until.slice(5, 7) - +date.slice(5, 7)) + 1; return n >= 1 && n <= MAX_REP ? n : 0; }
  return r.n >= 2 && r.n <= MAX_REP ? Math.floor(r.n) : 0;
};

export interface LaunchIn {
  acct: string; type: EntryType; cents: number; date: string; desc: string; cat?: string;
  /** a pagar / a receber: não mexe no saldo até ser marcado como pago */
  open?: boolean; rep?: Rep;
  /** dividir com N pessoas: sai tudo da conta e as outras partes ficam "a receber" */
  people?: number;
  /** pagar com duas formas: parte `cents2` sai da conta `acct2` */
  acct2?: string; cents2?: number;
}

export function launchEntries(i: LaunchIn, now = Date.now()): Entry[] {
  const rep = i.rep || { k: "1" as const }, n = repCount(rep, i.date), out: Entry[] = [];
  const mk = (acct: string, type: EntryType, cents: number, date: string, desc: string, cat: string | undefined, open: boolean | undefined): Entry =>
    ({ id: uid(), acct, type, cents, date, desc, ...(cat ? { cat } : {}), ...(open ? { open: 1 as const } : {}), at: now + out.length });
  if (!n || i.cents <= 0) return out;
  if (rep.k !== "1") { // parcelado: o valor é o total (sobra de centavos vai na 1ª); todo mês: o valor se repete
    const base = rep.k === "p" ? Math.floor(i.cents / n) : i.cents, first = rep.k === "p" ? i.cents - base * n + base : base;
    for (let k = 0; k < n; k++) out.push(mk(i.acct, i.type, k ? base : first, addMonths(i.date, k), rep.k === "p" ? `${i.desc} ${k + 1}/${n}` : i.desc, i.cat, i.open));
    return out;
  }
  const two = i.acct2 && i.cents2 && i.cents2 > 0 && i.cents2 < i.cents && i.type === "desp";
  out.push(mk(i.acct, i.type, two ? i.cents - i.cents2! : i.cents, i.date, i.desc, i.cat, i.open));
  if (two) out.push(mk(i.acct2!, i.type, i.cents2!, i.date, i.desc, i.cat, i.open));
  const p = i.type === "desp" && !two ? Math.floor(i.people || 1) : 1, share = p > 1 ? Math.floor(i.cents / p) : 0;
  if (share > 0) for (let k = 1; k < p; k++) out.push(mk(i.acct, "rec", share, i.date, "A receber: " + i.desc, CAT_DIV, true));
  return out;
}
