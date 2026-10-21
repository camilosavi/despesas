import { describe, expect, it } from "vitest";
import { findDupes, matchForImport, sameTx } from "./dedupe";
import type { Entry } from "./types";
const E = (o: Partial<Entry>): Entry => ({ id: Math.random().toString(), acct: "a", type: "desp", cents: 1000, date: "2026-09-10", desc: "x", at: 1, ...o });
describe("dedupe", () => {
  it("manual e banco: mesmo valor, dias próximos, descrição parecida", () => {
    const m = E({ desc: "Mercado Extra", date: "2026-09-10" }), b = E({ desc: "EXTRA SUPERMERCADOS", imp: "of-1", date: "2026-09-11" });
    expect(sameTx(m, b)).toBe(true); // "extra" em comum
    const b2 = E({ desc: "Mercado Extra Ltda", imp: "of-1", date: "2026-09-11" });
    expect(sameTx(m, b2)).toBe(true);
    expect(matchForImport([m], b2)?.id).toBe(m.id);
  });
  it("parcelas diferentes não juntam", () => {
    expect(sameTx(E({ desc: "Tênis 4/10" }), E({ desc: "Tênis 5/10", date: "2026-09-11" }))).toBe(false);
    expect(sameTx(E({ desc: "Tênis 5/10" }), E({ desc: "Tênis 5/10", date: "2026-09-11", imp: "of-2" }))).toBe(true);
  });
  it("fatura do PDF e pagamento do banco", () => {
    const pdf = E({ desc: "Fatura Inter", imp: "fatura-inter-2026-10-02", date: "2026-10-02", cents: 50000 });
    const of = E({ desc: "Pagamento de fatura", imp: "pagfatura-of-9", date: "2026-10-02", cents: 50000 });
    expect(matchForImport([pdf], of)?.id).toBe(pdf.id);
  });
  it("dois do banco não juntam; ignorados somem", () => {
    const a = E({ desc: "Padaria", imp: "of-1" }), b = E({ desc: "Padaria", imp: "of-2" });
    expect(findDupes([a, b])).toEqual([]);
    const c = E({ desc: "Padaria" }), d = E({ desc: "Padaria" });
    expect(findDupes([c, d]).length).toBe(1);
    expect(findDupes([c, d], new Set([[c.id, d.id].sort().join("|")])).length).toBe(0);
  });
});
import { guessCat } from "./categories";
describe("guessCat", () => {
  it("marcas", () => {
    expect(guessCat("desp", "NETFLIX.COM")).toBe("Assinaturas");
    expect(guessCat("desp", "Uber *Trip")).toBe("Transporte");
    expect(guessCat("desp", "IFOOD *Restaurante")).toBe("Alimentação");
    expect(guessCat("desp", "Carrefour Hiper")).toBe("Mercado");
    expect(guessCat("rec", "Holerite")).toBe("Salário");
    for (const [d, c] of [["IOF INTERNACIONAL", "Outros"], ["UDEMY SUBSCRIPTION", "Assinaturas"], ["SUPERMERCADOS PAGUE M", "Mercado"], ["POSTO ITUANO", "Transporte"], ["APPLE COM BILL", "Assinaturas"], ["GOOGLE G1AI101M", "Assinaturas"], ["AIRBNB", "Lazer"], ["OTICAS CAROL", "Saúde"], ["AMAZON BR", "Compras"], ["SHOPEE TNTINFOL", "Compras"], ["JIM COM", "Compras"]]) expect(guessCat("desp", d)).toBe(c);
    expect(guessCat("desp", "Xyz")).toBe("");
  });
});
import { notCardBuy } from "./dedupe";
describe("notCardBuy", () => {
  it("separa Pix de compra", () => {
    expect(notCardBuy(E({ desc: "Pix enviado · Fulano", imp: "of-1" }))).toBe(true);
    expect(notCardBuy(E({ desc: "Pagamento de fatura", imp: "pagfatura-of-1" }))).toBe(true);
    expect(notCardBuy(E({ type: "rec", desc: "Salário" }))).toBe(true);
    expect(notCardBuy(E({ desc: "Posto Ituano", imp: "of-2" }))).toBe(false);
    expect(notCardBuy(E({ desc: "Airbnb 2/6", imp: "of-3" }))).toBe(false);
  });
});
