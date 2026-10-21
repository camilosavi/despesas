import { describe, it, expect } from "vitest";
import { brl, R, signR, fmtD, digits, moneyMask, fold, textOn, lastDay, shiftYM } from "./format";
import { accBal, totBal, matchEntry, sg } from "./ledger";
import { ctKey, hlKey, ftKey, ftTotal } from "./imports";
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

