// PDF lido → lançamento. As chaves `imp` evitam lançar o mesmo documento duas vezes (o banco também recusa a repetição).
import { uid } from "./format";
import { titleCase } from "./pdf/parsers";
import type { ContaPdf, Fatura, HoleritePdf } from "./pdf/read";
import type { Entry } from "./types";

export const ctKey = (c: ContaPdf) => `conta-${c.name}-${c.due}`;
export const hlKey = (h: HoleritePdf) => `holerite-${h.ref}-${h.kind}`;
export const ftKey = (r: Fatura, d: string) => `fatura-${r.bank || "cartao"}-${d}`;
export const ftTotal = (r: Fatura) => (r.total != null ? r.total : r.rows.reduce((s, y) => s + y.cents, 0));

/** nome do item da fatura: o estabelecimento (ou a descrição), sem GRITAR */
export const itemName = (y: { shop?: string; desc?: string }) => {
  let n = (y.shop || y.desc || "").trim();
  if (n && n === n.toUpperCase() && /[A-Z]{3}/.test(n)) n = titleCase(n);
  return n;
};
/** nome do evento do holerite: siglas (PLR, I.N.S.S.) ficam em maiúsculas */
export const hlName = (d: string) =>
  d.split(/(\s+)/).map(w => (/^(?:\p{L}\.)+\p{L}?\.?$|^\p{Lu}{2,3}$/u.test(w) && !/^(DE|DO|DA|E)$/.test(w) ? w : titleCase(w))).join("");

export const contaEntry = (acct: string, c: ContaPdf): Entry =>
  ({ id: uid(), acct, type: "desp", cents: c.cents, date: c.due, desc: "Conta " + c.name, cat: "Contas", imp: ctKey(c), at: Date.now() });
export const holeriteEntry = (acct: string, h: HoleritePdf): Entry =>
  ({ id: uid(), acct, type: "rec", cents: h.cents, date: h.date, desc: h.kind + (h.emp ? " · " + h.emp : ""), cat: "Salário", imp: hlKey(h), at: Date.now() });
/** uma despesa "Fatura <banco>" no vencimento, com o total do banco e os itens guardados dentro */
export const faturaEntry = (acct: string, r: Fatura, d: string): Entry =>
  ({ id: uid(), acct, type: "desp", cents: ftTotal(r), date: d, desc: "Fatura " + (r.bank || "cartão"), cat: "Cartão", imp: ftKey(r, d), at: Date.now(),
     items: r.rows.map(y => ({ date: y.date, desc: itemName(y), cents: y.cents })) });
