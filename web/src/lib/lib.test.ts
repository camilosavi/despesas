import { describe, it, expect } from "vitest";
import { brl, R, signR, fmtD, digits, moneyMask, fold, textOn, lastDay, shiftYM } from "./format";
import { accBal, totBal, matchEntry, sg, descHints, catForDesc } from "./ledger";
import { ctKey, hlKey, ftKey, ftTotal, faturaRows } from "./imports";
import type { Account, Entry } from "./types";

const acct: Account = { id: "a", name: "Inter", color: "#FF7A00", start: 100000 };
const e = (p: Partial<Entry>): Entry => ({ id: "x", acct: "a", type: "desp", cents: 1000, date: "2026-10-01", desc: "", ...p }) as Entry;

describe("format", () => {
  it("formata reais", () => {
    expect(brl(123456)).toBe("1.234,56");
    expect(R(5)).toBe("R$ 0,05");
    expect(signR(-3000)).toBe("−R$ 30,00");
  });
  it("datas e máscara", () => {
    expect(fmtD("2026-11-10")).toBe("10/11/2026");
    expect(digits("R$ 1.234,56")).toBe(123456);
    expect(moneyMask("3000")).toBe("30,00");
    expect(moneyMask("")).toBe("");
  });
  it("fold, mês e contraste", () => {
    expect(fold("Alimentação")).toBe("alimentacao");
    expect(lastDay("2026-02")).toBe(28);
    expect(shiftYM("2026-01", -1)).toBe("2025-12");
    expect(textOn("#FCDD00")).toBe("#1A1A1A");
    expect(textOn("#14203A")).toBe("#FFFFFF");
  });
});

describe("saldo", () => {
  it("soma entradas e saídas até hoje; agendado não conta", () => {
    const es = [e({ type: "rec", cents: 50000 }), e({ cents: 10000 }), e({ cents: 99999, date: "2026-12-01" }), e({ acct: "b", cents: 777 })];
    expect(accBal(acct, es, "2026-10-21")).toBe(140000);
    expect(accBal(acct, es, "2026-12-01")).toBe(40001);
    expect(sg(es[0])).toBe(50000);
  });
  it("saldo total soma contas", () => {
    const b: Account = { id: "b", name: "Nu", color: "#820AD1", start: 500 };
    expect(totBal([acct, b], [e({ acct: "b", cents: 200 })], "2026-10-21")).toBe(100000 + 300);
  });
  it("transferência é neutra no total", () => {
    const b: Account = { id: "b", name: "Nu", color: "#820AD1", start: 0 };
    const es = [e({ cents: 5000, xfer: 1, tr: "t" }), e({ acct: "b", type: "rec", cents: 5000, xfer: 1, tr: "t" })];
    expect(totBal([acct, b], es, "2026-10-21")).toBe(100000);
  });
});

describe("busca", () => {
  const x = e({ desc: "Mercado Carrefour", cat: "Mercado", cents: 4590, date: "2026-10-20" });
  it("descrição, categoria, valor, data", () => {
    expect(matchEntry(x, "merc", "")).toBe(true);
    expect(matchEntry(x, "45,90", "")).toBe(true);
    expect(matchEntry(x, "20/10", "")).toBe(true);
    expect(matchEntry(x, "uber", "")).toBe(false);
    expect(matchEntry(x, "", "Lazer")).toBe(false);
    expect(matchEntry(x, "", "Mercado")).toBe(true);
  });
});

describe("chaves de importação", () => {
  it("são estáveis (idempotência)", () => {
    expect(ctKey({ name: "Claro", due: "2026-11-10" } as never)).toBe("conta-Claro-2026-11-10");
    expect(hlKey({ ref: "2026-10", kind: "salario" } as never)).toBe("holerite-2026-10-salario");
    expect(ftKey({ bank: "inter" } as never, "2026-11-05")).toBe("fatura-inter-2026-11-05");
    expect(ftKey({} as never, "2026-11-05")).toBe("fatura-cartao-2026-11-05");
  });
  it("total da fatura: declarado ou soma", () => {
    expect(ftTotal({ total: 9000, rows: [] } as never)).toBe(9000);
    expect(ftTotal({ total: null, rows: [{ cents: 100 }, { cents: 250 }] } as never)).toBe(350);
  });
});

import { boxBal, boxProgress, boxTotalsByCur, fmtMoneyCur } from "./boxes";
import type { SaveBox } from "./types";

describe("caixinhas e moedas", () => {
  const box1: SaveBox = {
    id: "b1", name: "Viagem Paris", cur: "EUR", goal: 200000,
    moves: [
      { id: "m1", date: "2026-10-01", cents: 50000, cur: "EUR" },
      { id: "m2", date: "2026-10-10", cents: 30000, cur: "EUR" },
      { id: "m3", date: "2026-10-15", cents: -10000, cur: "EUR" },
    ],
  };
  const box2: SaveBox = {
    id: "b2", name: "Reserva", cur: "BRL", goal: 500000,
    moves: [{ id: "m4", date: "2026-10-01", cents: 150000, cur: "BRL" }],
  };

  it("calcula saldo da caixinha somando e subtraindo movimentos", () => {
    expect(boxBal(box1)).toBe(70000);
    expect(boxBal(box2)).toBe(150000);
  });

  it("separa totais por moeda", () => {
    const totals = boxTotalsByCur([box1, box2]);
    expect(totals.EUR).toBe(70000);
    expect(totals.BRL).toBe(150000);
    expect(totals.USD).toBe(0);
  });

  it("calcula progresso e falta da meta", () => {
    const p1 = boxProgress(box1);
    expect(p1?.pct).toBe(35); // 700 / 2000 = 35%
    expect(p1?.left).toBe(130000);
    expect(p1?.done).toBe(false);

    const doneBox: SaveBox = { ...box1, moves: [{ id: "m", date: "2026-10-01", cents: 250000 }] };
    expect(boxProgress(doneBox)?.done).toBe(true);
  });

  it("formata valores respeitando o símbolo da moeda", () => {
    expect(fmtMoneyCur(5000, "BRL")).toBe("R$ 50,00");
    expect(fmtMoneyCur(5000, "EUR")).toBe("€ 50,00");
    expect(fmtMoneyCur(5000, "USD")).toBe("US$ 50,00");
    expect(fmtMoneyCur(-2000, "EUR")).toBe("−€ 20,00");
  });
});


import { bRow, bFrom } from "./sync";
describe("sync das caixinhas", () => {
  it("ida e volta mantém a caixinha (movimentos dentro)", () => {
    const b: SaveBox = { id: "b", name: "Paris", kind: "viagem", icon: "✈️", cur: "EUR", goal: 200000, target: "2027-06", moves: [{ id: "m", date: "2026-10-01", cents: 500, cur: "EUR", rate: 6.2, brl: 3100 }] };
    expect(bFrom(JSON.parse(JSON.stringify(bRow(b))))).toEqual(b);
    expect(bFrom({ id: "x", name: "N", cur: null, moves: null })).toEqual({ id: "x", name: "N", cur: "BRL", moves: [] });
  });
});

import { boxBrl } from "./boxes";
describe("caixinha com dois saldos", () => {
  it("reais guardados direto ficam à parte do euro", () => {
    const b: SaveBox = { id: "b", name: "Dublin", cur: "EUR", goal: 300000, moves: [
      { id: "1", date: "2026-10-01", cents: 50000, cur: "EUR" }, { id: "2", date: "2026-10-02", cents: 20000, cur: "BRL" }, { id: "3", date: "2026-10-03", cents: -5000, cur: "BRL" }] };
    expect(boxBal(b)).toBe(50000);
    expect(boxBrl(b)).toBe(15000);
    expect(boxTotalsByCur([b])).toEqual({ BRL: 15000, EUR: 50000, USD: 0 });
    expect(boxBrl({ ...b, cur: "BRL" })).toBe(0);
  });
});

import { boxByBank } from "./boxes";
describe("onde está o dinheiro da caixinha", () => {
  it("soma por banco e moeda, ignora o que não tem banco", () => {
    const b: SaveBox = { id: "b", name: "Dublin", cur: "EUR", moves: [
      { id: "1", date: "2026-10-01", cents: 30000, cur: "EUR", bank: "Nomad" }, { id: "2", date: "2026-10-02", cents: 20000, cur: "EUR", bank: "Nomad" },
      { id: "3", date: "2026-10-03", cents: 25000, cur: "BRL", bank: "Inter" }, { id: "4", date: "2026-10-04", cents: 9000, cur: "EUR" }, { id: "5", date: "2026-10-05", cents: -25000, cur: "BRL", bank: "Inter" }] };
    expect(boxByBank(b)).toEqual([{ bank: "Nomad", cur: "EUR", cents: 50000 }]);
  });
});

import { cardSpent, isCard, bankAccts } from "./ledger";
import { aRow, aFrom } from "./sync";
describe("cartão puro", () => {
  const card: Account = { id: "c", name: "Renner", color: "#E4002B", start: 0, kind: "cartao" };
  it("fica fora do saldo total e soma o gasto do mês", () => {
    const es = [e({ acct: "c", cents: 8000, date: "2026-10-05" }), e({ acct: "c", cents: 2000, date: "2026-09-30" }), e({ acct: "c", type: "rec", cents: 999 })];
    expect(isCard(card)).toBe(true);
    expect(cardSpent(card, es, "2026-10-21")).toBe(8000);
    expect(totBal([acct, card], es, "2026-10-21")).toBe(100000);
    expect(bankAccts([acct, card])).toEqual([acct]);
  });
  it("kind só vai ao banco quando é cartão", () => {
    expect("kind" in aRow(acct)).toBe(false);
    expect(aFrom(JSON.parse(JSON.stringify(aRow(card)))).kind).toBe("cartao");
    expect(aFrom({ id: "x", name: "N", start_cents: 5, kind: null }).kind).toBeUndefined();
  });
});

import { entMonth, cardMonthLbl } from "./ledger";
import { faturaDays } from "./imports";
describe("mês pela fatura (vencimento)", () => {
  const c = (closeDay?: number, dueDay?: number): Account => ({ id: "c", name: "Inter", color: "#f70", start: 0, kind: "cartao", closeDay, dueDay });
  it("fecha 25, vence 2: compra de setembro cai em outubro", () => {
    expect(entMonth(c(25, 2), "2026-09-20")).toBe("2026-10"); // antes do fechamento: vence 02/10
    expect(entMonth(c(25, 2), "2026-09-26")).toBe("2026-11"); // depois do fechamento: próxima fatura, vence 02/11
    expect(entMonth(c(25, 2), "2026-12-30")).toBe("2027-02");
  });
  it("vence no mesmo mês do fechamento", () => {
    expect(entMonth(c(5, 15), "2026-10-03")).toBe("2026-10");
    expect(entMonth(c(5, 15), "2026-10-06")).toBe("2026-11");
  });
  it("sem os dias, ou conta comum: mês da data", () => {
    expect(entMonth(c(), "2026-09-20")).toBe("2026-09");
    expect(entMonth(acct, "2026-09-20")).toBe("2026-09");
    expect(cardMonthLbl(c(25, 2), "out")).toBe("Fatura de out");
    expect(cardMonthLbl(c(), "out")).toBe("Gasto em out");
  });
  it("dias vindos da fatura lida", () => {
    expect(faturaDays({ close: "2026-09-25" } as never, "2026-10-02")).toEqual({ closeDay: 25, dueDay: 2 });
    expect(faturaDays({ close: 25 } as never, "2026-10-02")).toEqual({ closeDay: 25, dueDay: 2 });
    expect(faturaDays({} as never, "2026-10-02")).toEqual({ closeDay: undefined, dueDay: 2 });
  });
});

import { faturas, faturaPaid, faturaDue } from "./ledger";
describe("pagar fatura do cartão", () => {
  const card: Account = { id: "c", name: "Inter", color: "#f70", start: 0, kind: "cartao", closeDay: 25, dueDay: 2 };
  const es = [e({ acct: "c", cents: 10000, date: "2026-09-20", desc: "A" }), e({ acct: "c", cents: 5000, date: "2026-09-10", desc: "B" }), e({ acct: "c", cents: 3000, date: "2026-09-26", desc: "C" })];
  it("agrupa por mês de vencimento", () => {
    expect(faturas(card, es).map(f => [f.ym, f.cents, f.items.length])).toEqual([["2026-11", 3000, 1], ["2026-10", 15000, 2]]);
    expect(faturaDue(card, "2026-10")).toBe("2026-10-02");
  });
  it("paga: pelo lançamento do cartão ou pela fatura do mesmo banco lida do PDF", () => {
    expect(faturaPaid(card, "2026-10", es)).toBeUndefined();
    const pay = e({ id: "p", imp: "pagfatura-c-2026-10" });
    expect(faturaPaid(card, "2026-10", [...es, pay])).toBe(pay);
    expect(faturaPaid(card, "2026-11", [...es, pay])).toBeUndefined();
    const pdf = e({ id: "q", imp: "fatura-Inter-2026-10-02" });
    expect(faturaPaid(card, "2026-10", [...es, pdf])).toBe(pdf);
    expect(faturaPaid(card, "2026-11", [...es, pdf])).toBeUndefined();
    expect(faturaPaid(card, "2026-10", [...es, e({ imp: "fatura-Pan-2026-10-02" })])).toBeUndefined();
  });
});

import { cardUsed } from "./ledger";
describe("limite do cartão", () => {
  const card: Account = { id: "c", name: "Inter", color: "#f70", start: 0, kind: "cartao", closeDay: 25, dueDay: 2, limit: 100000 };
  const es = [e({ acct: "c", cents: 10000, date: "2026-09-20" }), e({ acct: "c", cents: 3000, date: "2026-09-26" })];
  it("usado = faturas em aberto; pagar libera o limite", () => {
    expect(cardUsed(card, es)).toBe(13000);
    expect(cardUsed(card, [...es, e({ imp: "pagfatura-c-2026-10" })])).toBe(3000);
  });
  it("limit só vai ao banco quando existe", () => {
    expect(aRow(card).limit_cents).toBe(100000);
    expect("limit_cents" in aRow({ ...card, limit: undefined })).toBe(false);
    expect(aFrom(JSON.parse(JSON.stringify(aRow(card)))).limit).toBe(100000);
  });
});

import { summary, summaryMonths, isAdj } from "./ledger";
import { catsOf, isFixedCat } from "./categories";
describe("resumo por categoria", () => {
  const es = [
    e({ cents: 4000, cat: "Mercado", date: "2026-10-03" }), e({ cents: 6000, cat: "Mercado", date: "2026-10-09" }), e({ cents: 2500, cat: "Pets", date: "2026-10-11" }), e({ cents: 700, date: "2026-10-12" }),
    e({ cents: 9999, cat: "Cartão", date: "2026-10-12", imp: "pagfatura-c-2026-10" }), e({ cents: 5000, cat: "Mercado", xfer: 1, tr: "t" }),
    e({ type: "rec", cents: 300000, cat: "Salário", date: "2026-10-05" }), e({ type: "rec", cents: 1234, date: "2026-10-06", imp: "ajuste-1" }), e({ cents: 888, cat: "Mercado", date: "2026-09-30" }),
  ];
  it("soma por categoria, ordena e ignora transferência, ajuste e pagamento de fatura", () => {
    const s = summary([acct], es, "2026-10", "desp");
    expect(s.rows.map(r => [r.cat, r.cents])).toEqual([["Mercado", 10000], ["Pets", 2500], ["", 700]]);
    expect(s.total).toBe(13200);
    expect(summary([acct], es, "2026-10", "rec").total).toBe(300000);
    expect(isAdj(es[7])).toBe(true);
  });
  it("meses disponíveis, do mais novo", () => {
    expect(summaryMonths([acct], es, "2026-10-21")).toEqual(["2026-10", "2026-09"]);
  });
  it("categorias criadas aparecem a partir dos lançamentos, 'Outros' por último", () => {
    expect(catsOf("desp", es).slice(-3)).toEqual(["Assinaturas", "Pets", "Outros"]);
    expect(catsOf("rec", es)).toEqual(["Salário", "Rendimento", "Reembolso", "Outros"]);
    expect(catsOf("rec", [], "Freela")).toContain("Freela");
    expect(isFixedCat("Mercado")).toBe(true); expect(isFixedCat("Pets")).toBe(false);
  });
});

describe("sugestões de descrição", () => {
  const es = [
    e({ id: "1", desc: "Mercado Dia", cat: "Mercado", at: 1 }), e({ id: "2", desc: "mercado dia", cat: "Lazer", at: 3 }),
    e({ id: "3", desc: "Saída", at: 4 }), e({ id: "4", desc: "Padaria", at: 2 }), e({ id: "5", desc: "Fatura Inter", imp: "fatura-x", at: 5 }),
    e({ id: "6", desc: "Transferência para X", xfer: 1, at: 6 }), e({ id: "7", type: "rec", desc: "Pix amigo", at: 7 }),
  ];
  it("lista únicas, recentes primeiro, sem padrão/importação/transferência", () => {
    expect(descHints(es, "desp")).toEqual(["mercado dia", "Padaria"]);
    expect(descHints(es, "rec")).toEqual(["Pix amigo"]);
  });
  it("categoria vem do último lançamento com a mesma descrição (sem acento e caixa)", () => {
    expect(catForDesc(es, "desp", " MERCADO dia ")).toBe("Lazer");
    expect(catForDesc(es, "desp", "Padaria")).toBe("");
    expect(catForDesc(es, "desp", "")).toBe("");
  });
});

describe("fatura: pagamento fora da soma e ordem por data", () => {
  const r = { bank: "Renner", due: "2026-10-15", rows: [
    { date: "2026-09-16", desc: "Pagamento Fatura Pix", shop: "", cents: -115086 },
    { date: "2026-09-12", desc: "Anthropic", shop: "", cents: 11564 }, { date: "2026-08-15", desc: "Caedu", shop: "", cents: 1666 },
  ] };
  it("separa o pagamento e ordena as compras", () => {
    const { buys, pays } = faturaRows(r as never);
    expect(buys.map(y => y.desc)).toEqual(["Caedu", "Anthropic"]); expect(pays).toHaveLength(1);
  });
  it("total sem o pagamento (com total do banco, vale o do banco)", () => {
    expect(ftTotal(r as never)).toBe(13230);
    expect(ftTotal({ ...r, total: 99 } as never)).toBe(99);
  });
});
