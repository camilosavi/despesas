import * as C from "./engine";
import type { Estado, Lancamento } from "./engine";

export interface Item { id: string; nome: string; data: string; compra?: string; cents: number; pago: boolean; parcela?: string; falta?: number; taxa: boolean }
export interface Prox { ym: string; total: number; paga: boolean }
export interface Detalhe {
  cartao: string; ym: string; vence: string; vencida: boolean; paga: boolean;
  total: number; banco: number | null; lancado: number; faltaLancar: number; doAnterior: number;
  itens: Item[]; prox: Prox[]; parcelas: Item[];
  lim: ReturnType<typeof C.limite>;
  taxas: number;
}

const TAXA = /\b(iof|juros|encargos?|multa|tarifa|anuidade|rotativo|mora)\b/i;
export const ehTaxa = (nome: string) => TAXA.test(nome.normalize("NFD").replace(/[̀-ͯ]/g, ""));

const item = (l: Lancamento): Item => ({
  id: l.id, nome: l.nome || "", data: l.data, compra: l.compra, cents: l.cents, pago: !!l.pago, parcela: l.parcela, taxa: ehTaxa(l.nome || ""),
});

/** parcelas que ainda faltam depois da atual ("3/10" → 7) */
export const restam = (p?: string) => { const m = p && /^(\d+)\/(\d+)$/.exec(p); return m ? Math.max(0, +m[2] - +m[1]) : 0; };

export function cartoes(e: Estado) {
  return C.cartoesDeCredito(e).map((c: string) => {
    const ym = C.mesFaturaAberta(e, c);
    const f = C.fatura(e, c, ym);
    return { cartao: c, ym, vence: f.vence, total: f.total, paga: f.total > 0 && f.aberto === 0, lim: C.limite(e, c) };
  });
}

export function resumoCartoes(e: Estado) {
  const L = cartoes(e);
  const aberto = L.reduce((s, x) => s + (x.paga ? 0 : x.total), 0);
  const prox = L.filter(x => !x.paga && x.total > 0).map(x => x.vence).sort()[0] || null;
  return { n: L.length, aberto, prox };
}

export function detalhe(e: Estado, cartao: string, ym: string): Detalhe {
  const f = C.fatura(e, cartao, ym);
  const itens = (f.itens as Lancamento[]).map(item).sort((a, b) => (b.compra || b.data).localeCompare(a.compra || a.data) || a.nome.localeCompare(b.nome));
  const prox: Prox[] = [];
  for (let i = 1; i <= 5; i++) {
    const m = C.somaMeses(ym, i), g = C.fatura(e, cartao, m);
    prox.push({ ym: m, total: g.total, paga: g.total > 0 && g.aberto === 0 });
  }
  const parcelas = itens.filter(x => x.parcela);
  const faltaLancar = f.banco != null ? Math.max(0, f.banco - f.lancado) : 0;
  return {
    cartao, ym, vence: f.vence, vencida: f.vencida, paga: f.total > 0 && f.aberto === 0, total: f.total, banco: f.banco,
    lancado: f.lancado, faltaLancar, doAnterior: f.doAnterior, itens, prox, parcelas,
    lim: C.limite(e, cartao), taxas: itens.filter(x => x.taxa).reduce((s, x) => s + x.cents, 0),
  };
}

/** Posso comprar? só simula: limite livre e fatura de cada mês, sem gravar nada */
export function posso(e: Estado, cartao: string, valor: number, parcelas: number) {
  const k = C.limite(e, cartao), ym0 = C.mesFaturaAberta(e, cartao);
  const n = Math.max(1, parcelas), cada = Math.floor(valor / n), resto = valor - cada * n;
  const meses = Array.from({ length: Math.min(n, 6) }, (_, i) => {
    const ym = C.somaMeses(ym0, i), antes = C.fatura(e, cartao, ym).total, parte = cada + (i === 0 ? resto : 0);
    return { ym, antes, depois: antes + parte };
  });
  return { livreAntes: k ? k.livre : null, livreDepois: k ? k.livre - valor : null, passa: !!k && k.livre - valor < 0, meses };
}
