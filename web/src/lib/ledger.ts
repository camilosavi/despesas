// Contas e lançamentos: saldo, "entrou no mês" e busca. Funções puras (recebem os dados e a data de hoje).
import { brl, fmtD, fold, shiftYM, today } from "./format";
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
/** "Fatura de out" quando o cartão tem os dias; senão "Gasto em out" */
export const cardMonthLbl = (a: Account, mon: string) => (a.closeDay && a.dueDay ? "Fatura de " : "Gasto em ") + mon;
export const accBal = (a: Account, entries: Entry[], t = today()) =>
  (a.start || 0) + entries.filter(e => e.acct === a.id && !isFut(e, t)).reduce((s, e) => s + sg(e), 0);
export const totBal = (accts: Account[], entries: Entry[], t = today()) => accts.reduce((s, a) => s + (isCard(a) ? 0 : accBal(a, entries, t)), 0);
/** entradas do mês atual (sem transferências); acctId null = todas as contas */
export const monIn = (entries: Entry[], acctId: string | null, t = today()) =>
  entries.filter(e => (!acctId || e.acct === acctId) && e.type === "rec" && !e.xfer && !isFut(e, t) && e.date.slice(0, 7) === t.slice(0, 7))
    .reduce((s, e) => s + e.cents, 0);

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
