// Lógica pura da tela Contas. Nada é somado aqui por conta própria:
// saídas futuras = `aPagarDetalhe` (a mesma lista do "A pagar"), saldo de partida = `naConta` / `fimDoMes`.
import * as C from "./engine";
import type { Estado, Lancamento } from "./engine";

export type Tipo = "tudo" | "entradas" | "saidas";
export interface Filtro { tipo: Tipo; cat: string; q: string }
export interface Linha {
  id: string; tipo: "lanc" | "fatura" | "previsto"; nome: string; data: string; cents: number; rec: boolean;
  pago: boolean; atrasada: boolean; cat?: string; cartao?: string; ym?: string; saldoApos?: number;
  tags?: string[]; parte?: { i: number; n: number; tot: number };
}
export interface Dia { data: string; linhas: Linha[]; total: number }
export interface Fluxo {
  futuro: Linha[]; passado: Dia[]; inicio: number | null;
  vermelho: Linha | null;   // 1º item depois do qual a conta fica negativa
  cats: string[];           // categorias que aparecem no mês (para o filtro)
}

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const FILTRO0: Filtro = { tipo: "tudo", cat: "", q: "" };

type Detalhe = { tipo: "lancamento" | "fatura"; id?: string; cartao?: string; nome: string; data: string; cents: number; atrasado?: boolean };

export function fluxoDoMes(e: Estado, ym: string, f: Filtro = FILTRO0): Fluxo {
  const cur = C.mesDe(e.hoje), porId = new Map((e.lancamentos as Lancamento[]).map(l => [l.id, l]));
  // ---- ainda vai acontecer ----
  const F: Linha[] = [];
  for (const d of C.aPagarDetalhe(e, ym) as Detalhe[]) {
    if (d.tipo === "fatura") F.push({ id: `fat|${d.cartao}|${ym}`, tipo: "fatura", nome: d.nome, data: d.data, cents: d.cents, rec: false, pago: false, atrasada: d.data < e.hoje, cartao: d.cartao, ym });
    else { const l = porId.get(d.id!); F.push({ id: d.id!, tipo: "lanc", nome: d.nome, data: d.data, cents: d.cents, rec: false, pago: false, atrasada: !!d.atrasado, cat: l?.cat, tags: l?.tags, parte: l?.parte }); }
  }
  for (const l of e.lancamentos as Lancamento[]) {
    if (l.tipo !== "rec" || C.mesDe(l.data) !== ym || (l.caiu || l.data) <= e.hoje) continue;
    F.push({ id: l.id, tipo: "lanc", nome: l.nome, data: l.caiu || l.data, cents: l.cents, rec: true, pago: false, atrasada: false, cat: l.cat, tags: l.tags, parte: l.parte });
  }
  const prev = (e.previstos as ((m: string) => { data: string; cents: number; caiu?: string }[]) | undefined)?.(ym) || [];
  prev.forEach((p, i) => { if ((p.caiu || p.data) > e.hoje) F.push({ id: `prev|${ym}|${i}`, tipo: "previsto", nome: "Receita prevista", data: p.caiu || p.data, cents: p.cents, rec: true, pago: false, atrasada: false }); });
  F.sort((a, b) => a.data.localeCompare(b.data) || Number(b.rec) - Number(a.rec) || a.id.localeCompare(b.id));

  // saldo depois de cada item (só do mês atual em diante)
  let inicio: number | null = null;
  if (ym === cur) inicio = C.temConta(e) ? C.naConta(e) : 0;
  else if (ym > cur) inicio = C.fimDoMes(e, C.somaMeses(ym, -1));
  let vermelho: Linha | null = null;
  if (inicio != null) {
    let s = inicio;
    for (const x of F) { s += x.rec ? x.cents : -x.cents; x.saldoApos = s; if (s < 0 && !vermelho) vermelho = x; }
  }

  // ---- já aconteceu ----
  const P: Linha[] = [];
  for (const l of e.lancamentos as Lancamento[]) {
    if (l.cartao || l.pagoCom || C.mesDe(l.data) !== ym) continue;
    const rec = l.tipo === "rec";
    if (rec ? (l.caiu || l.data) > e.hoje : l.pago === false) continue;
    P.push({ id: l.id, tipo: "lanc", nome: l.nome, data: rec ? l.caiu || l.data : l.data, cents: l.cents, rec, pago: true, atrasada: false, cat: l.cat, tags: l.tags, parte: l.parte });
  }
  for (const c of C.cartoesDeCredito(e) as string[]) {
    const fa = C.fatura(e, c, ym);
    if (fa.total > 0 && fa.aberto === 0) P.push({ id: `fat|${c}|${ym}`, tipo: "fatura", nome: `Fatura ${c}`, data: fa.vence, cents: fa.total, rec: false, pago: true, atrasada: false, cartao: c, ym });
  }

  const cats = [...new Set([...F, ...P].map(x => x.cat).filter((c): c is string => !!c))];
  const q = fold(f.q.trim());
  const ok = (x: Linha) => (f.tipo === "tudo" || (f.tipo === "entradas") === x.rec)
    && (!f.cat || x.cat === f.cat)
    && (!q || fold(x.nome).includes(q) || (x.tags || []).some(t => fold(t).includes(q.replace(/^#/, ""))) || fold((x.cents / 100).toFixed(2).replace(".", ",")).includes(q));
  const m = new Map<string, Linha[]>();
  for (const x of P.filter(ok)) m.set(x.data, [...(m.get(x.data) || []), x]);
  const passado = [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    .map(([data, linhas]) => ({ data, linhas, total: linhas.reduce((s, x) => s + (x.rec ? x.cents : -x.cents), 0) }));
  return { futuro: F.filter(ok), passado, inicio, vermelho, cats };
}

export const contasEmReal = (e: Estado) => e.contas.filter(a => (a.moeda || "BRL") === "BRL");
