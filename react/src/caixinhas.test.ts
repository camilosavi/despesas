import { describe, expect, it } from "vitest";
import { bancosSugeridos, caixaBancos, caixaEditar, caixaEditarMov, caixaRitmo } from "./caixinhas";
import { caixaMover, caixas, cxMovDe, vazio } from "./loja";
import type { Caixinha } from "./loja";

const cx = (o: Partial<Caixinha> = {}): Caixinha => ({ id: "c", name: "Viagem", goal: 100000, target: "2027-03", moves: [], ...o });

describe("caixinhas completas", () => {
  it("banco por movimento e onde está o dinheiro (R$ e € separados, sem banco no fim)", () => {
    const c = cx({ goalCur: "EUR", moves: [
      { id: "1", date: "2026-10-01", cents: 30000, bank: "Nubank" }, { id: "2", date: "2026-10-05", cents: -5000, bank: "Nubank" },
      { id: "3", date: "2026-10-06", cents: 10000, cur: "EUR", brl: 60000, rate: 6, bank: "Wise" }, { id: "4", date: "2026-10-07", cents: 700 },
    ] });
    const r = caixaBancos(c);
    expect(r.map(x => x.banco)).toEqual(["Nubank", "Wise", ""]);
    expect(r[0].saldo.BRL).toBe(25000); expect(r[1].saldo.EUR).toBe(10000); expect(r[2].saldo.BRL).toBe(700);
  });
  it("cxMovDe leva o banco; vazio não grava", () => {
    const c = cx();
    expect(cxMovDe(c, { id: "a", date: "2026-11-01", valor: 100, entrada: "BRL", bank: " Inter " }).bank).toBe("Inter");
    expect("bank" in cxMovDe(c, { id: "a", date: "2026-11-01", valor: 100, entrada: "BRL", bank: " " })).toBe(false);
  });
  it("editar caixinha: nome, tipo, meta e mês-alvo; vazio apaga", () => {
    let b = vazio(); b = { ...b, cfg: { ...b.cfg, save: [cx()] } };
    b = caixaEditar(b, "c", { name: "Europa", kind: "viagem", goal: 500000, target: "2027-06" });
    expect(caixas(b)[0]).toMatchObject({ name: "Europa", kind: "viagem", goal: 500000, target: "2027-06" });
    b = caixaEditar(b, "c", { name: "  ", kind: "", goal: 0, target: "" });
    const c = caixas(b)[0]; expect(c.name).toBe("Europa"); expect("goal" in c || "target" in c || "kind" in c).toBe(false);
  });
  it("editar movimento: valor, data, tipo e banco; com cotação o R$ acompanha", () => {
    let b = vazio(); b = { ...b, cfg: { ...b.cfg, save: [cx({ goalCur: "EUR" })] } };
    b = caixaMover(b, "c", { id: "m", date: "2026-10-01", cents: 10000, cur: "EUR", brl: 60000, rate: 6, bank: "Wise" });
    b = caixaEditarMov(b, "c", "m", { date: "2026-10-02", cents: -20000, bank: "" });
    expect(caixas(b)[0].moves[0]).toEqual({ id: "m", date: "2026-10-02", cents: -20000, cur: "EUR", brl: -120000, rate: 6 });
    expect(caixaEditarMov(b, "c", "m", { date: "2026-10-02", cents: 0 })).toBe(b);
  });
  it("ritmo: sem meta/mês-alvo = nada; adiantada, atrasada, no ritmo, batida, prazo passou, por mês", () => {
    expect(caixaRitmo(cx({ target: undefined }), "2026-11-06")).toBeNull();
    // 1ª entrada em 2026-10-01, fim 2027-03-31: 181 dias; em 2026-12-31 (91 dias) esperado ≈ 50,3%
    const m = (v: number) => [{ id: "1", date: "2026-10-01", cents: v }];
    expect(caixaRitmo(cx({ moves: m(70000) }), "2026-12-31")?.estado).toBe("adiantada");
    expect(caixaRitmo(cx({ moves: m(20000) }), "2026-12-31")?.estado).toBe("atrasada");
    expect(caixaRitmo(cx({ moves: m(50300) }), "2026-12-31")?.estado).toBe("ritmo");
    expect(caixaRitmo(cx({ moves: m(100000) }), "2026-12-31")?.estado).toBe("batida");
    const p = caixaRitmo(cx({ moves: m(20000) }), "2027-04-02"); expect(p?.estado).toBe("passou"); expect(p?.porMes).toBe(80000);
    const r = caixaRitmo(cx({ moves: m(40000) }), "2026-11-06")!; expect(r.meses).toBe(5); expect(r.porMes).toBe(12000);
    expect(caixaRitmo(cx(), "2026-11-06")?.estado).toBe("semInicio");
  });
  it("sugestões de banco juntam contas, cartões e a lista fixa sem repetir", () => {
    const b = { ...vazio(), cfg: { accts: [{ name: "Nubank" }], cards: { Inter: {} } } };
    const l = bancosSugeridos(b); expect(l.filter(x => x === "Nubank")).toHaveLength(1); expect(l).toContain("Inter"); expect(l).toContain("Wise");
  });
});
