// Contas e lançamentos: saldo, "entrou no mês" e busca. Funções puras (recebem os dados e a data de hoje).
import { bankOf } from "./banks";
import { brl, fmtD, fold, lastDay, shiftYM, today } from "./format";
import type { Account, Entry } from "./types";

/** valor com sinal: entrada positiva, saída negativa */
export const sg = (e: Entry) => (e.type === "rec" ? e.cents : -e.cents);
/** lançamento com data futura fica "Agendado" e ainda não mexe no saldo */
export const isFut = (e: Entry, t = today()) => e.date > t;
export const isCard = (a: Account) => a.kind === "cartao";
export const bankAccts = (accts: Account[]) => accts.filter(a => !isCard(a));
/** mês (AAAA-MM) a que o lançamento pertence: no cartão com fechamento e vencimento é o mês do VENCIMENTO da fatura em que a compra cai
 *  (fecha dia 25, vence dia 2: compra de 20/09 entra na fatura que vence 02/10 = outubro); sem esses dias, o mês da própria data */
export const entMonth = (a: Account | undefined, date: string) => {
  const ym = date.slice(0, 7);
  if (!a || !isCard(a) || !a.closeDay || !a.dueDay) return ym;
  const closeYM = +date.slice(8, 10) > a.closeDay ? shiftYM(ym, 1) : ym; // depois do fechamento: fatura do mês seguinte
  return a.dueDay > a.closeDay ? closeYM : shiftYM(closeYM, 1);        // vence no mesmo mês do fechamento, ou no seguinte
};
/** gasto da fatura do mês atual no cartão (compras lançadas nele, pelo mês do vencimento) */
export const cardSpent = (a: Account, entries: Entry[], t = today()) =>
  entries.filter(e => e.acct === a.id && e.type === "desp" && entMonth(a, e.date) === t.slice(0, 7)).reduce((s, e) => s + e.cents, 0);
/** faturas do cartão por mês de vencimento: total e compras de cada uma, da mais nova para a mais antiga */
export const faturas = (a: Account, entries: Entry[]) => {
  const m = new Map<string, { ym: string; cents: number; items: { date: string; desc: string; cents: number }[] }>();
  for (const e of entries) {
    if (e.acct !== a.id || e.type !== "desp") continue;
    const ym = entMonth(a, e.date), f = m.get(ym) || { ym, cents: 0, items: [] };
    f.cents += e.cents; f.items.push({ date: e.date, desc: e.desc, cents: e.cents }); m.set(ym, f);
  }
  return [...m.values()].sort((x, y) => y.ym.localeCompare(x.ym));
};
/** quanto do limite está usado: faturas em aberto de todos os meses (compras ainda não pagas) */
export const cardUsed = (a: Account, entries: Entry[]) => faturas(a, entries).filter(f => !faturaPaid(a, f.ym, entries)).reduce((s, f) => s + f.cents, 0);
/** pagamento da fatura do mês: o lançamento "pagfatura" feito aqui, ou a fatura do mesmo banco lida do PDF (vence nesse mês) */
export const faturaPaid = (a: Account, ym: string, entries: Entry[]) => {
  const bk = bankOf(a.name);
  return entries.find(e => e.imp === `pagfatura-${a.id}-${ym}` || (!!bk && !!e.imp && e.imp.startsWith("fatura-") && e.imp.slice(-10, -3) === ym && bankOf(e.imp.slice(7, -11)) === bk));
};
/** data de vencimento da fatura do mês (dia do cartão, ou hoje se ele não tem os dias) */
export const faturaDue = (a: Account, ym: string) => (a.dueDay ? ym + "-" + String(Math.min(a.dueDay, lastDay(ym))).padStart(2, "0") : today());
/** "Fatura de out" quando o cartão tem os dias; senão "Gasto em out" */
export const cardMonthLbl = (a: Account, mon: string) => (a.closeDay && a.dueDay ? "Fatura de " : "Gasto em ") + mon;
export const accBal = (a: Account, entries: Entry[], t = today()) =>
  (a.start || 0) + entries.filter(e => e.acct === a.id && !isFut(e, t) && !e.open).reduce((s, e) => s + sg(e), 0);
export const totBal = (accts: Account[], entries: Entry[], t = today()) => accts.reduce((s, a) => s + (isCard(a) ? 0 : accBal(a, entries, t)), 0);
/** lançamentos que não são receita nem gasto de verdade: ajuste de saldo e o pagamento da fatura (as compras do cartão já são os gastos) */
export const isAdj = (e: Entry) => !!e.imp && e.imp.startsWith("ajuste-");
export const countsInSummary = (e: Entry) => !e.xfer && !isAdj(e) && !(e.imp && e.imp.startsWith("pagfatura-"));
/** fatura lida com categoria nos itens: no resumo cada item conta na sua categoria (sem categoria = a da fatura, "Cartão"); a diferença para o total do banco fica na categoria da fatura */
export const expandItems = (e: Entry): Entry[] => {
  if (!e.items || !e.items.some(i => i.cat)) return [e];
  const parts = e.items.map((i, k): Entry => ({ ...e, id: e.id + "#" + k, cents: i.cents, date: i.date || e.date, desc: i.desc, cat: i.cat || e.cat, items: undefined }));
  const rest = e.cents - e.items.reduce((s, i) => s + i.cents, 0);
  return rest ? [...parts, { ...e, id: e.id + "#r", cents: rest, items: undefined }] : parts;
};
/** resumo por categoria de um mês (todas as contas; cartão pelo mês do vencimento da fatura) */
export const summary = (accts: Account[], entries: Entry[], ym: string, type: Entry["type"]) => {
  const by = new Map<string, { cat: string; cents: number; list: Entry[] }>();
  for (const e0 of entries) {
    if (e0.type !== type || !countsInSummary(e0) || entMonth(accts.find(a => a.id === e0.acct), e0.date) !== ym) continue;
    for (const e of expandItems(e0)) {
      const k = e.cat || "", g = by.get(k) || { cat: k, cents: 0, list: [] };
      g.cents += e.cents; g.list.push(e); by.set(k, g);
    }
  }
  const rows = [...by.values()].sort((x, y) => y.cents - x.cents);
  return { rows, total: rows.reduce((s, r) => s + r.cents, 0) };
};
export const summaryMonths = (accts: Account[], entries: Entry[], t = today()) =>
  [...new Set([t.slice(0, 7), ...entries.filter(countsInSummary).map(e => entMonth(accts.find(a => a.id === e.acct), e.date))])].sort().reverse();
/** entradas do mês atual (sem transferências); acctId null = todas as contas */
export const monIn = (entries: Entry[], acctId: string | null, t = today()) =>
  entries.filter(e => (!acctId || e.acct === acctId) && e.type === "rec" && !e.xfer && !e.open && !isAdj(e) && !isFut(e, t) && e.date.slice(0, 7) === t.slice(0, 7))
    .reduce((s, e) => s + e.cents, 0);

/** descrições já usadas (mais recentes primeiro) para sugerir ao digitar; ignora transferências, importações e os nomes padrão */
export const descHints = (entries: Entry[], type: Entry["type"], limit = 40) => {
  const seen = new Set(["entrada", "saida", "compra"]), out: string[] = [];
  for (const e of [...entries].sort((x, y) => (y.at || 0) - (x.at || 0))) {
    if (e.type !== type || e.xfer || e.imp) continue;
    const k = fold(e.desc.trim()); if (!k || seen.has(k)) continue;
    seen.add(k); out.push(e.desc.trim()); if (out.length >= limit) break;
  }
  return out;
};
/** categoria do último lançamento com essa mesma descrição ("" se não houver) */
export const catForDesc = (entries: Entry[], type: Entry["type"], desc: string) => {
  const k = fold(desc.trim()); if (!k) return "";
  let best: Entry | undefined;
  for (const e of entries) if (e.type === type && !e.xfer && e.cat && fold(e.desc.trim()) === k && (!best || (e.at || 0) > (best.at || 0))) best = e;
  if (best && best.cat !== "Cartão") return best.cat!;
  if (type === "desp") for (const e of entries) for (const i of e.items || []) if (i.cat && fold(i.desc.trim()) === k) return i.cat; // compra igual numa fatura já categorizada
  return best?.cat ?? "";
};
/** extrato agrupado por categoria, da maior para a menor (total com sinal: entrada +, saída −) */
export const groupByCat = (L: Entry[]) => {
  const m = new Map<string, { cat: string; cents: number; list: Entry[] }>();
  for (const e of L) { const k = e.xfer ? "Transferências" : e.cat || "Sem categoria", g = m.get(k) || { cat: k, cents: 0, list: [] }; g.cents += sg(e); g.list.push(e); m.set(k, g); }
  return [...m.values()].sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
};

/** extrato de uma conta, do mais novo para o mais antigo */
export const acctEntries = (entries: Entry[], acctId: string) =>
  entries.filter(e => e.acct === acctId).sort((x, y) => y.date.localeCompare(x.date) || (y.at || 0) - (x.at || 0));

/** busca no extrato: todas as palavras precisam aparecer em descrição, categoria, valor ou data; `cat` filtra por categoria */
export const matchEntry = (e: Entry, q: string, cat: string) => {
  if (cat && e.cat !== cat) return false;
  if (!q) return true;
  const words = fold(q).trim().split(/\s+/);
  const hay = fold(e.desc + " " + (e.cat || "") + " " + brl(e.cents) + " " + fmtD(e.date));
  return words.every(w => hay.includes(w));
};
