// Gravação: o "dono" dos dados é o backup no formato do app atual ({items, fx, cfg}). Cada ação devolve um backup NOVO (nada muda no lugar),
// o React relê o estado a partir dele pelo mesmo `deAppAtual`, então o motor continua sendo o único que calcula.
import { dataComDia, mesDe, somaDias, somaMeses } from "./engine";

export interface ItemBackup {
  id: string; type: "desp" | "rec"; desc: string; cat: string; cents: number; date: string; pay: string; paid: boolean;
  paidAt?: number; createdAt: number; acct?: string; card?: string; buy?: string; fell?: string; parc?: string; group?: string;
  [k: string]: unknown;
}
export interface Backup { app: string; v: number; items: ItemBackup[]; fx: unknown[]; cfg: Record<string, any> }
export type Repete = { modo: "uma" } | { modo: "parcelas"; n: number } | { modo: "mensal"; n: number };
export interface Form {
  tipo: "desp" | "rec"; desc: string; cents: number; cat: string; date: string; pay: string; paid: boolean;
  card?: string; acct?: string; repete: Repete;
}

export const vazio = (): Backup => ({ app: "minhas-despesas", v: 1, items: [], fx: [], cfg: { accts: [], cards: {} } });
export const PAGAMENTOS = { desp: ["Pix", "Débito", "Crédito", "Boleto", "Dinheiro"], rec: ["Pix", "Transferência", "Dinheiro"] } as const;

// ---- fatura em que a compra no crédito cai ----
const ehCredito = (pay: string) => pay === "Crédito";
const vencDe = (b: Backup, card: string): number => Number(b.cfg.cards?.[card]?.due) || 0;
function fechaEm(b: Backup, card: string, ym: string): string {
  const due = vencDe(b, card), d = dataComDia(ym, due), close = Number(b.cfg.cards?.[card]?.close) || 0;
  if (close) return close < due ? dataComDia(ym, close) : dataComDia(somaMeses(ym, -1), close);
  return somaDias(d, due < 10 ? -8 : -16);
}
/** data de vencimento da fatura em que uma compra feita em `compra` entra (sem vencimento no cartão: a própria data) */
export function dataNaFatura(b: Backup, card: string, compra: string): string {
  if (!vencDe(b, card)) return compra;
  for (let m = somaMeses(mesDe(compra), -1), i = 0; i < 5; i++, m = somaMeses(m, 1)) if (fechaEm(b, card, m) >= compra) return dataComDia(m, vencDe(b, card));
  return dataComDia(mesDe(compra), vencDe(b, card));
}

// salário que cai do dia 25 em diante conta no mês seguinte (regra do app atual)
function datasDoSalario(cat: string, date: string): { date: string; fell?: string } {
  if ((cat === "sal" || cat === "d13") && +date.slice(8) >= 25) return { date: dataComDia(somaMeses(mesDe(date), 1), 1), fell: date };
  return { date };
}

const emMes = (date: string, i: number) => dataComDia(somaMeses(mesDe(date), i), +date.slice(8));

export function criar(b: Backup, f: Form, hoje: string, agora: number, novoId: () => string): Backup {
  const n = f.repete.modo === "uma" ? 1 : Math.max(1, Math.min(120, Math.floor(f.repete.n)));
  const grupo = n > 1 ? `${f.repete.modo === "parcelas" ? "p" : "m"}${novoId()}` : undefined;
  const cartao = f.tipo === "desp" && ehCredito(f.pay) ? f.card || "" : "";
  const novos: ItemBackup[] = [];
  // parcelado: o valor digitado é o TOTAL; a 1ª parcela leva os centavos que sobram da divisão
  const parcela = f.repete.modo === "parcelas" ? Math.floor(f.cents / n) : f.cents, resto = f.repete.modo === "parcelas" ? f.cents - parcela * n : 0;
  for (let i = 0; i < n; i++) {
    const compra = emMes(f.date, i);
    const data = cartao ? dataNaFatura(b, cartao, compra) : compra;
    const sal = f.tipo === "rec" ? datasDoSalario(f.cat, data) : { date: data };
    const pago = f.tipo === "rec" ? true : cartao ? false : i === 0 ? f.paid : false;
    novos.push({
      id: novoId(), type: f.tipo, desc: f.desc.trim(), cat: f.cat, cents: parcela + (i === 0 ? resto : 0), date: sal.date, pay: f.pay, paid: pago, createdAt: agora,
      ...(pago && f.tipo === "desp" ? { paidAt: agora } : {}), ...(f.acct ? { acct: f.acct } : {}), ...(cartao ? { card: cartao, buy: compra } : {}),
      ...(sal.fell ? { fell: sal.fell } : {}), ...(grupo ? { group: grupo } : {}), ...(grupo && f.repete.modo === "parcelas" ? { parc: `${i + 1}/${n}` } : {}),
    });
  }
  return { ...b, items: [...b.items, ...novos] };
}

export interface Edicao { desc: string; cents: number; cat: string; date: string; pay: string; paid: boolean; card?: string; acct?: string }
export function editar(b: Backup, id: string, e: Edicao, agora: number): Backup {
  return { ...b, items: b.items.map(x => {
    if (x.id !== id) return x;
    const cartao = x.type === "desp" && ehCredito(e.pay) ? e.card || x.card || "" : "";
    const mudouData = e.date !== (x.buy || x.date) || cartao !== (x.card || "");
    const compra = x.buy && !mudouData ? x.buy : e.date;
    const data = cartao ? (mudouData ? dataNaFatura(b, cartao, e.date) : x.date) : e.date;
    const pago = x.type === "rec" ? true : cartao ? x.paid : e.paid;
    const { buy: _b, card: _c, acct: _a, paidAt: _p, ...resto } = x;
    return { ...resto, desc: e.desc.trim(), cents: e.cents, cat: e.cat, date: data, pay: e.pay, paid: pago,
      ...(pago && x.type === "desp" ? { paidAt: x.paidAt || agora } : {}), ...(cartao ? { card: cartao, buy: compra } : {}), ...(e.acct ? { acct: e.acct } : {}) };
  }) };
}

/** `seguintes`: apaga também as parcelas/repetições do mesmo grupo que vêm depois desta */
export function apagar(b: Backup, id: string, seguintes = false): Backup {
  const x = b.items.find(i => i.id === id);
  if (!x) return b;
  return { ...b, items: b.items.filter(i => i.id !== id && !(seguintes && x.group && i.group === x.group && i.date > x.date)) };
}

export function marcarPago(b: Backup, id: string, pago: boolean, agora: number): Backup {
  return { ...b, items: b.items.map(x => {
    if (x.id !== id || x.type !== "desp") return x;
    const { paidAt: _p, ...r } = x;
    return { ...r, paid: pago, ...(pago ? { paidAt: agora } : {}) };
  }) };
}

// ---- contas e cartões ----
export function salvarConta(b: Backup, nome: string, cents: number, agora: number, hoje: string): Backup {
  const accts = (b.cfg.accts || []) as { id: string; name: string; cents: number; at: string; atTs?: number }[];
  const i = accts.findIndex(a => a.name === nome), nova = { id: i >= 0 ? accts[i].id : `a${agora}`, name: nome, cents, at: hoje, atTs: agora };
  return { ...b, cfg: { ...b.cfg, accts: i >= 0 ? accts.map((a, k) => (k === i ? nova : a)) : [...accts, nova] } };
}
export function salvarCartao(b: Backup, nome: string, dados: { due?: number; limit?: number; close?: number; color?: string }): Backup {
  const cards = { ...(b.cfg.cards || {}) }, atual = cards[nome] || {};
  cards[nome] = { ...atual, ...Object.fromEntries(Object.entries(dados).filter(([, v]) => v)) };
  return { ...b, cfg: { ...b.cfg, cards } };
}

/** marca (ou desmarca) vários lançamentos de uma vez: usado para "fatura paga" */
export function marcarVarios(b: Backup, ids: string[], pago: boolean, agora: number): Backup {
  return ids.reduce((acc, id) => marcarPago(acc, id, pago, agora), b);
}
