// Busca em todos os meses: nome, categoria, cartão, conta, tag, parcela ou valor. Só lê o estado.
import * as C from "./engine";
import type { Estado, Lancamento, Pers } from "./engine";
import { fold } from "./contas";

export interface Achado { l: Lancamento; cat: string; data: string }
export interface MesAchado { ym: string; itens: Achado[]; desp: number; rec: number }
export interface Busca { meses: MesAchado[]; total: number; desp: number; rec: number; cortou: boolean }
export const MAX_ACHADOS = 300;

/** "150", "150,5", "1.250,00" → centavos; senão null */
export function valorDe(t: string): number | null {
  if (!/^[\d.,]+$/.test(t)) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function buscar(e: Estado, q: string, pers: Pers = {}): Busca {
  const toks = fold(q).split(/\s+/).filter(Boolean);
  const vazio: Busca = { meses: [], total: 0, desp: 0, rec: 0, cortou: false };
  if (!toks.length) return vazio;
  const A: Achado[] = [];
  for (const l of e.lancamentos) {
    const cat = (C.categoria(l.tipo, l.cat || "", pers) as { n: string } | undefined)?.n || "";
    const txt = fold([l.nome, cat, l.cartao, l.conta, l.pagoCom, l.parcela, ...(l.tags || []).map(t => "#" + t)].filter(Boolean).join(" "));
    const v = Math.abs(l.cents);
    if (toks.every(t => txt.includes(t) || valorDe(t) === v)) A.push({ l, cat, data: l.tipo === "rec" ? l.caiu || l.data : l.data });
  }
  A.sort((a, b) => b.data.localeCompare(a.data) || a.l.nome.localeCompare(b.l.nome));
  const cortou = A.length > MAX_ACHADOS, M = new Map<string, MesAchado>();
  let desp = 0, rec = 0;
  for (const a of A) {
    if (a.l.tipo === "rec") rec += a.l.cents; else desp += a.l.cents;
  }
  for (const a of A.slice(0, MAX_ACHADOS)) {
    const ym = C.mesDe(a.data), m: MesAchado = M.get(ym) || { ym, itens: [], desp: 0, rec: 0 };
    m.itens.push(a); if (a.l.tipo === "rec") m.rec += a.l.cents; else m.desp += a.l.cents; M.set(ym, m);
  }
  return { meses: [...M.values()], total: A.length, desp, rec, cortou };
}
