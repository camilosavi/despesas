// Assinaturas = despesas de repetição mensal (recorrente) ou da categoria "assin", sem parcela; só leitura.
import type { Lancamento as Lanc } from "./engine";
export interface Assin { nome: string; cents: number; ultima: string; n: number; cartao?: string }
export function assinaturas(ls: Lanc[]): Assin[] {
  const m = new Map<string, Lanc[]>();
  for (const l of ls) {
    if (l.tipo !== "desp" || l.parcela || !(l.recorrente || l.cat === "assin")) continue;
    const k = l.nome.trim().toLowerCase();
    m.set(k, [...(m.get(k) || []), l]);
  }
  return [...m.values()].map(g => {
    const u = g.reduce((a, x) => (x.data > a.data ? x : a));
    const mes = u.data.slice(0, 7), doMes = g.filter(x => x.data.slice(0, 7) === mes);
    return { nome: u.nome, cents: doMes.reduce((s, x) => s + x.cents, 0), ultima: u.data, n: g.length, ...(u.cartao ? { cartao: u.cartao } : {}) };
  }).sort((a, b) => b.cents - a.cents);
}
