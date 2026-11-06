// Lógica pura da tela Contas: monta as linhas do mês a partir do motor. Nada é somado aqui por conta própria:
// valores de fatura vêm de `fatura()`, totais de `pago`/`aPagar`/`entrou`.
import * as C from "./engine";
import type { Estado, Lancamento } from "./engine";

export type Filtro = "todos" | "apagar" | "pagos" | "receitas";
export interface Linha {
  id: string; tipo: "lanc" | "fatura"; nome: string; data: string; cents: number; rec: boolean;
  pago: boolean; atrasada: boolean; cat?: string; cartao?: string; ym?: string; parc?: string;
}
export interface Dia { data: string; linhas: Linha[]; total: number }

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Compra no cartão NÃO entra na lista: o cartão aparece como UMA linha "Fatura X" no dia do vencimento.
// (Os totais e as categorias do mês continuam contando as compras: isso é do motor.)
export function linhasDoMes(e: Estado, ym: string, filtro: Filtro, busca = ""): Linha[] {
  const L: Linha[] = [];
  for (const l of e.lancamentos as Lancamento[]) {
    if (l.cartao || l.pagoCom || C.mesDe(l.data) !== ym) continue;
    const rec = l.tipo === "rec";
    L.push({ id: l.id, tipo: "lanc", nome: l.nome, data: rec ? l.caiu || l.data : l.data, cents: l.cents, rec,
      pago: rec ? true : l.pago !== false, atrasada: !rec && l.pago === false && l.data < e.hoje, cat: l.cat });
  }
  for (const c of C.cartoesDeCredito(e) as string[]) {
    const f = C.fatura(e, c, ym);
    if (f.total <= 0) continue;
    L.push({ id: `fat|${c}|${ym}`, tipo: "fatura", nome: `Fatura ${c}`, data: f.vence, cents: f.total, rec: false,
      pago: f.aberto === 0, atrasada: f.vencida && f.aberto > 0, cartao: c, ym });
  }
  const q = fold(busca.trim());
  return L.filter(x => {
    if (filtro === "apagar" && (x.rec || x.pago)) return false;
    if (filtro === "pagos" && (x.rec || !x.pago)) return false;
    if (filtro === "receitas" && !x.rec) return false;
    return !q || fold(x.nome).includes(q) || fold((x.cents / 100).toFixed(2).replace(".", ",")).includes(q);
  });
}

// Por dia, do mais novo ao mais antigo; total do dia = entradas − saídas.
export function porDia(L: Linha[]): Dia[] {
  const m = new Map<string, Linha[]>();
  for (const x of L) m.set(x.data, [...(m.get(x.data) || []), x]);
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    .map(([data, linhas]) => ({ data, linhas, total: linhas.reduce((s, x) => s + (x.rec ? x.cents : -x.cents), 0) }));
}

export const contasEmReal = (e: Estado) => e.contas.filter(a => (a.moeda || "BRL") === "BRL");
