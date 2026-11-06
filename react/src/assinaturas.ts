// Assinaturas = despesas de repetição mensal (recorrente) ou da categoria "assin", sem parcela; só leitura.
import type { Lancamento as Lanc } from "./engine";
import type { Backup } from "./loja";
export interface Assin { nome: string; cents: number; ultima: string; n: number; cartao?: string; off?: string; dia?: number; pessoas?: number }
export function assinaturas(ls: Lanc[], b?: Backup | null): Assin[] {
  const off = (b?.cfg.subOff || {}) as Record<string, string>, dias = (b?.cfg.subDay || {}) as Record<string, number>, div = (b?.cfg.subShare || {}) as Record<string, { n: number; c: number }>;
  const m = new Map<string, Lanc[]>();
  for (const l of ls) {
    if (l.tipo !== "desp" || l.parcela || !(l.recorrente || l.cat === "assin")) continue;
    const k = l.nome.trim().toLowerCase();
    m.set(k, [...(m.get(k) || []), l]);
  }
  return [...m.values()].map(g => {
    const u = g.reduce((a, x) => (x.data > a.data ? x : a));
    const mes = u.data.slice(0, 7), doMes = g.filter(x => x.data.slice(0, 7) === mes);
    const o = off[u.nome], sh = div[u.nome];
    return { nome: u.nome, cents: doMes.reduce((s, x) => s + x.cents, 0), ultima: u.data, n: g.length, ...(u.cartao ? { cartao: u.cartao } : {}),
      ...(o && mes < o ? { off: o } : {}), ...(dias[u.nome] ? { dia: dias[u.nome] } : {}), ...(sh && sh.n > 0 ? { pessoas: sh.n + 1 } : {}) };
  }).sort((a, c) => +!!a.off - +!!c.off || c.cents - a.cents);
}

// ---------- edição (mesmos campos do app atual: cfg.subOff, cfg.subDay, cfg.subShare) ----------
const fold = (t: string) => t.trim().toLowerCase();
const ehDela = (i: Backup["items"][number], nome: string) => i.type === "desp" && !i.parc && (!!i.group || i.cat === "assin") && fold(i.desc) === fold(nome);
const mapa = (b: Backup, k: string) => ({ ...((b.cfg[k] || {}) as Record<string, unknown>) });
const com = (b: Backup, k: string, v: Record<string, unknown>): Backup => ({ ...b, cfg: { ...b.cfg, [k]: v } });
/** quantas cobranças não pagas, do mês de `hoje` em diante, seriam apagadas ao cancelar */
export const cobrancasFuturas = (b: Backup, nome: string, hoje: string) => b.items.filter(i => ehDela(i, nome) && !i.paid && i.date.slice(0, 7) > hoje.slice(0, 7)).length;
/** cancelar: marca o 1º mês sem cobrança (o mês seguinte) e apaga as cobranças não pagas dali em diante */
export function subCancelar(b: Backup, nome: string, hoje: string): Backup {
  const ym = hoje.slice(0, 7), y = +ym.slice(0, 4), m = +ym.slice(5), prox = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const off = mapa(b, "subOff"); off[nome] = prox;
  return { ...com(b, "subOff", off), items: b.items.filter(i => !(ehDela(i, nome) && !i.paid && i.date.slice(0, 7) >= prox)) };
}
export function subReativar(b: Backup, nome: string): Backup { const off = mapa(b, "subOff"); delete off[nome]; return com(b, "subOff", off); }
export function subDia(b: Backup, nome: string, dia: number): Backup {
  const d = mapa(b, "subDay"); if (dia >= 1 && dia <= 31) d[nome] = Math.round(dia); else delete d[nome];
  return com(b, "subDay", d);
}
/** dividir entre `pessoas` (contando você): cfg.subShare[nome] = { n: pessoas − 1, c: valor ÷ pessoas } ; 1 pessoa = sem divisão */
export function subDividir(b: Backup, nome: string, pessoas: number, total: number): Backup {
  const d = mapa(b, "subShare"), n = Math.round(pessoas) - 1;
  if (n >= 1 && total > 0) d[nome] = { n, c: Math.round(total / (n + 1)) }; else delete d[nome];
  return com(b, "subShare", d);
}
export const subSuaParte = (total: number, pessoas?: number) => (pessoas && pessoas > 1 ? Math.round(total / pessoas) : total);
