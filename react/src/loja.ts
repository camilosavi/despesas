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

// ===== Pessoas: conta corrente por pessoa (cfg.pp, mesmo modelo do app atual) =====
// c > 0 = ela te deve · c < 0 = você deve a ela · k "d" = cobrança/dívida, "p" = pagamento
export interface PPEntrada { id: string; d: string; c: number; k: "d" | "p"; t?: string }
export interface PP { id: string; name: string; e: PPEntrada[] }
export type PPTipo = "elaDeve" | "euDevo" | "elaPagou" | "euPaguei";
export const ppSinal = (t: PPTipo, cents: number): Pick<PPEntrada, "c" | "k"> => {
  const v = Math.abs(Math.round(cents));
  return t === "elaDeve" ? { c: v, k: "d" } : t === "euDevo" ? { c: -v, k: "d" } : t === "elaPagou" ? { c: -v, k: "p" } : { c: v, k: "p" };
};
export const ppDe = (b: Backup): PP[] => (Array.isArray(b.cfg.pp) ? (b.cfg.pp as PP[]) : []);
const comPP = (b: Backup, pp: PP[]): Backup => ({ ...b, cfg: { ...b.cfg, pp } });
export const ppSaldo = (p: PP) => p.e.reduce((s, x) => s + x.c, 0);

export function ppCriar(b: Backup, nome: string, id: string): Backup {
  const n = nome.trim();
  if (!n || ppDe(b).some(p => p.name.toLowerCase() === n.toLowerCase())) return b;
  return comPP(b, [...ppDe(b), { id, name: n, e: [] }]);
}
export const ppRenomear = (b: Backup, pid: string, nome: string): Backup =>
  nome.trim() ? comPP(b, ppDe(b).map(p => (p.id === pid ? { ...p, name: nome.trim() } : p))) : b;
export const ppExcluir = (b: Backup, pid: string): Backup => comPP(b, ppDe(b).filter(p => p.id !== pid));
export function ppLancar(b: Backup, pid: string, e: PPEntrada): Backup {
  if (!e.c) return b;
  return comPP(b, ppDe(b).map(p => (p.id !== pid ? p : { ...p, e: p.e.some(x => x.id === e.id) ? p.e.map(x => (x.id === e.id ? e : x)) : [...p.e, e] })));
}
export const ppApagarEntrada = (b: Backup, pid: string, eid: string): Backup =>
  comPP(b, ppDe(b).map(p => (p.id === pid ? { ...p, e: p.e.filter(x => x.id !== eid) } : p)));
// "pagou tudo": lança um pagamento que zera o saldo
export function ppQuitar(b: Backup, pid: string, data: string, id: string): Backup {
  const p = ppDe(b).find(x => x.id === pid), s = p ? ppSaldo(p) : 0;
  return s ? ppLancar(b, pid, { id, d: data, c: -s, k: "p", t: s > 0 ? "Pagou tudo" : "Paguei tudo" }) : b;
}

// ===== Caixinhas (cfg.save) e Dívidas (cfg.debts): mesmo modelo do app atual, só R$ =====
// caixinha: {id,name,goal?,target?,moves:[{id,date,cents (+guardou, − tirou),acct?,ts?}]}
// dívida:   {id,name,total,per?,day?,moves:[{id,date,cents (+ pagou, − acrescentou)}]}
export interface CxMov { id: string; date: string; cents: number; acct?: string; ts?: number }
export interface Caixinha { id: string; name: string; goal?: number; target?: string; moves: CxMov[] }
export interface DvMov { id: string; date: string; cents: number }
export interface Divida { id: string; name: string; total: number; per?: number; day?: number; moves: DvMov[] }
export const caixas = (b: Backup): Caixinha[] => (Array.isArray(b.cfg.save) ? (b.cfg.save as Caixinha[]) : []);
export const dividas = (b: Backup): Divida[] => (Array.isArray(b.cfg.debts) ? (b.cfg.debts as Divida[]) : []);
// só movimentos em R$ (os em €/US$ seguem no app atual)
export const caixaSaldo = (c: Caixinha) => c.moves.filter(m => !(m as any).cur || (m as any).cur === "BRL").reduce((s, m) => s + m.cents, 0);
export const dividaFalta = (d: Divida) => d.total - d.moves.reduce((s, m) => s + m.cents, 0);
const setCfg = (b: Backup, k: "save" | "debts", v: unknown[]): Backup => ({ ...b, cfg: { ...b.cfg, [k]: v } });

export function caixaCriar(b: Backup, id: string, name: string, goal?: number, target?: string): Backup {
  const n = name.trim();
  return n ? setCfg(b, "save", [...caixas(b), { id, name: n, ...(goal ? { goal } : {}), ...(target ? { target } : {}), moves: [] }]) : b;
}
export const caixaExcluir = (b: Backup, id: string) => setCfg(b, "save", caixas(b).filter(c => c.id !== id));
// guardar/tirar; com `acct`, desconta/devolve na conta (o motor lê acct+ts)
export function caixaMover(b: Backup, cid: string, m: CxMov): Backup {
  if (!m.cents) return b;
  return setCfg(b, "save", caixas(b).map(c => (c.id === cid ? { ...c, moves: [...c.moves, m] } : c)));
}
export const caixaApagarMov = (b: Backup, cid: string, mid: string) =>
  setCfg(b, "save", caixas(b).map(c => (c.id === cid ? { ...c, moves: c.moves.filter(m => m.id !== mid) } : c)));

export function dividaCriar(b: Backup, id: string, name: string, total: number, per?: number): Backup {
  const n = name.trim();
  return n && total > 0 ? setCfg(b, "debts", [...dividas(b), { id, name: n, total, ...(per ? { per } : {}), moves: [] }]) : b;
}
export const dividaExcluir = (b: Backup, id: string) => setCfg(b, "debts", dividas(b).filter(d => d.id !== id));
export const dividaMover = (b: Backup, did: string, m: DvMov): Backup =>
  m.cents ? setCfg(b, "debts", dividas(b).map(d => (d.id === did ? { ...d, moves: [...d.moves, m] } : d))) : b;
export const dividaApagarMov = (b: Backup, did: string, mid: string) =>
  setCfg(b, "debts", dividas(b).map(d => (d.id === did ? { ...d, moves: d.moves.filter(m => m.id !== mid) } : d)));

// ---- Moedas (compras de euro e dólar, mesmo formato do app atual) ----
export type Moeda = "EUR" | "USD";
export interface FxCompra { id?: string; cur?: "USD"; eur?: number; usd?: number; brl: number; date: string; where?: string; obs?: string }
export const fxDe = (b: Backup): FxCompra[] => (Array.isArray(b.fx) ? (b.fx as FxCompra[]) : []);
export const fxMoeda = (x: FxCompra): Moeda => (x.cur === "USD" ? "USD" : "EUR");
// valor comprado na moeda (centavos de € ou US$)
export const fxValor = (x: FxCompra) => (fxMoeda(x) === "USD" ? x.usd ?? 0 : x.eur ?? 0);
export const fxCompras = (b: Backup, m: Moeda) => fxDe(b).filter(x => fxMoeda(x) === m).sort((a, c) => (a.date < c.date ? 1 : a.date > c.date ? -1 : 0));
export function fxTotais(b: Backup, m: Moeda) {
  const ls = fxCompras(b, m), valor = ls.reduce((s, x) => s + fxValor(x), 0), brl = ls.reduce((s, x) => s + x.brl, 0);
  return { valor, brl, medio: valor > 0 ? brl / valor : 0, n: ls.length };
}
// cotação = R$ pago ÷ valor recebido (ambos em centavos)
export const fxCotacao = (brl: number, valor: number) => (valor > 0 ? brl / valor : 0);
// avisa cotação fora de 0,6×–1,6× a de hoje; "inversa" quando € e R$ parecem trocados
export function fxAviso(cot: number, hoje: number): "ok" | "fora" | "inversa" {
  if (!(cot > 0) || !(hoje > 0)) return "ok";
  if (cot >= hoje * 0.6 && cot <= hoje * 1.6) return "ok";
  const inv = 1 / cot;
  return inv >= hoje * 0.6 && inv <= hoje * 1.6 ? "inversa" : "fora";
}
export function fxCriar(b: Backup, id: string, m: Moeda, valor: number, brl: number, date: string, where?: string): Backup {
  if (!(valor > 0) || !(brl > 0) || !date) return b;
  const w = where?.trim();
  const x: FxCompra = m === "USD" ? { id, cur: "USD", usd: valor, brl, date } : { id, eur: valor, brl, date };
  if (w) x.where = w;
  return { ...b, fx: [...fxDe(b), x] };
}
export const fxApagar = (b: Backup, id: string): Backup => ({ ...b, fx: fxDe(b).filter(x => x.id !== id) });

// ---- Categorias suas e limites por categoria ----
import { criarCategoria, SEM_CATEGORIA } from "./engine";
export type TipoCat = "desp" | "rec";
export interface CatSua { k: string; n: string; c: string }
const catChave = (t: TipoCat) => (t === "desp" ? "cats" : "catsRec");
export const catsSuas = (b: Backup, t: TipoCat): CatSua[] => (Array.isArray(b.cfg[catChave(t)]) ? (b.cfg[catChave(t)] as CatSua[]) : []);
export function catCriar(b: Backup, t: TipoCat, nome: string, cor?: string): { backup: Backup; erro?: string } {
  const pers = { desp: catsSuas(b, "desp"), rec: catsSuas(b, "rec") };
  const r = criarCategoria(pers, t, nome, cor) as { ok: boolean; erro?: string; pers?: typeof pers };
  if (!r.ok || !r.pers) return { backup: b, erro: r.erro };
  return { backup: { ...b, cfg: { ...b.cfg, [catChave(t)]: r.pers[t] } } };
}
// apaga uma categoria sua; os lançamentos dela passam para Outros / Outras
export function catApagar(b: Backup, t: TipoCat, k: string): Backup {
  if (!catsSuas(b, t).some(c => c.k === k)) return b;
  const para = (SEM_CATEGORIA as Record<string, string>)[t] === "rout" ? "rout" : "outros";
  const orc = { ...((b.cfg.budgets || {}) as Record<string, number>) }; delete orc[k];
  return { ...b, items: b.items.map(x => (x.cat === k ? { ...x, cat: para } : x)),
    cfg: { ...b.cfg, [catChave(t)]: catsSuas(b, t).filter(c => c.k !== k), budgets: orc } };
}
export const limites = (b: Backup): Record<string, number> => (b.cfg.budgets || {}) as Record<string, number>;
export function limiteSalvar(b: Backup, k: string, cents: number): Backup {
  const o = { ...limites(b) }; if (cents > 0) o[k] = cents; else delete o[k];
  return { ...b, cfg: { ...b.cfg, budgets: o } };
}

// ---------- Transferências entre contas (cfg.transf) ----------
// Não é lançamento: não entra em despesa, receita, categoria nem orçamento. Só move saldo entre duas contas em R$.
export interface Transf { id: string; ts: number; date: string; from: string; to: string; cents: number; desc?: string; imp?: string }
export const transfs = (b: Backup): Transf[] => ((b.cfg.transf || []) as Transf[]).slice();
export function transfErro(b: Backup, t: { from: string; to: string; cents: number; date: string }): string {
  const nomes = ((b.cfg.accts || []) as { name: string; cur?: string }[]).filter(a => !a.cur || a.cur === "BRL").map(a => a.name);
  if (!nomes.includes(t.from) || !nomes.includes(t.to)) return "Escolha duas contas.";
  if (t.from === t.to) return "Escolha contas diferentes.";
  if (!(t.cents > 0)) return "Informe o valor.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return "Informe a data.";
  return "";
}
export function transfSalvar(b: Backup, t: { id?: string; from: string; to: string; cents: number; date: string; desc?: string }, agora: number): { backup: Backup; erro?: string } {
  const erro = transfErro(b, t); if (erro) return { backup: b, erro };
  const lista = transfs(b), i = t.id ? lista.findIndex(x => x.id === t.id) : -1;
  const desc = (t.desc || "").trim();
  if (i < 0 && lista.length >= 500) return { backup: b, erro: "Limite de 500 transferências." };
  const velha = i >= 0 ? lista[i] : null;
  // transferência já contada no saldo informado: mudar só o histórico (o ts antigo fica)
  const nova: Transf = { ...(velha || {}), id: velha?.id || `t${agora}`, ts: velha?.ts ?? agora, date: t.date, from: t.from, to: t.to, cents: Math.round(t.cents), ...(desc ? { desc } : {}) };
  if (!desc) delete nova.desc;
  const out = i >= 0 ? lista.map((x, k) => (k === i ? nova : x)) : [...lista, nova];
  return { backup: { ...b, cfg: { ...b.cfg, transf: out } } };
}
export function transfExcluir(b: Backup, id: string): Backup {
  return { ...b, cfg: { ...b.cfg, transf: transfs(b).filter(x => x.id !== id) } };
}
