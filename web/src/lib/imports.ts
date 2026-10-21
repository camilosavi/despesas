// PDF lido → lançamento. As chaves `imp` evitam lançar o mesmo documento duas vezes (o banco também recusa a repetição).
import { uid } from "./format";
import { titleCase } from "./pdf/parsers";
import type { ContaPdf, Fatura, HoleritePdf } from "./pdf/read";
import type { Entry } from "./types";

export const ctKey = (c: ContaPdf) => `conta-${c.name}-${c.due}`;
export const hlKey = (h: HoleritePdf) => `holerite-${h.ref}-${h.kind}`;
export const ftKey = (r: Fatura, d: string) => `fatura-${r.bank || "cartao"}-${d}`;
/** nome do item da fatura: o estabelecimento (ou a descrição), sem GRITAR */
export const itemName = (y: { shop?: string; desc?: string }) => {
  let n = (y.shop || y.desc || "").trim();
  if (n && n === n.toUpperCase() && /[A-Z]{3}/.test(n)) n = titleCase(n);
  return n;
};
/** crédito de pagamento da fatura anterior ("Pagamento Fatura Pix"…): não é compra, então fica fora da soma e do total lançado */
export const isPay = (y: { shop?: string; desc?: string; cents: number }) => y.cents < 0 && /^(pagamento|pagto|pgto)\b/i.test(itemName(y));
/** compras da fatura em ordem de data e, à parte, os pagamentos */
export const faturaRows = (r: Fatura) => {
  const by = (a: { date: string }, b: { date: string }) => (a.date || "").localeCompare(b.date || "");
  return { buys: r.rows.filter(y => !isPay(y)).sort(by), pays: r.rows.filter(isPay).sort(by) };
};
export const ftTotal = (r: Fatura) => (r.total != null ? r.total : r.rows.filter(y => !isPay(y)).reduce((s, y) => s + y.cents, 0));
/** nome do evento do holerite: siglas (PLR, I.N.S.S.) ficam em maiúsculas */
export const hlName = (d: string) =>
  d.split(/(\s+)/).map(w => (/^(?:\p{L}\.)+\p{L}?\.?$|^\p{Lu}{2,3}$/u.test(w) && !/^(DE|DO|DA|E)$/.test(w) ? w : titleCase(w))).join("");

/** dias de fechamento e vencimento lidos da fatura (para o cartão do mesmo banco) */
export const faturaDays = (r: Fatura, due: string) => {
  const c = String(r.close ?? ""), m = c.match(/^\d{4}-\d\d-(\d\d)$/) || c.match(/^(\d{1,2})(?:\/\d{1,2})?(?:\/\d{2,4})?$/);
  const day = (v: string | undefined) => (v && +v >= 1 && +v <= 31 ? +v : undefined);
  return { closeDay: day(m?.[1]), dueDay: day(due.slice(8, 10)) };
};

export const contaEntry = (acct: string, c: ContaPdf): Entry =>
  ({ id: uid(), acct, type: "desp", cents: c.cents, date: c.due, desc: "Conta " + c.name, cat: "Contas", imp: ctKey(c), at: Date.now() });
export const holeriteEntry = (acct: string, h: HoleritePdf): Entry =>
  ({ id: uid(), acct, type: "rec", cents: h.cents, date: h.date, desc: h.kind + (h.emp ? " · " + h.emp : ""), cat: "Salário", imp: hlKey(h), at: Date.now() });
/** uma despesa "Fatura <banco>" no vencimento, com o total do banco e os itens guardados dentro */
export const faturaEntry = (acct: string, r: Fatura, d: string, cats: string[] = []): Entry =>
  ({ id: uid(), acct, type: "desp", cents: ftTotal(r), date: d, desc: "Fatura " + (r.bank || "cartão"), cat: "Cartão", imp: ftKey(r, d), at: Date.now(),
     items: faturaRows(r).buys.map((y, k) => ({ date: y.date, desc: itemName(y), cents: y.cents, ...(cats[k] ? { cat: cats[k] } : {}) })) });
