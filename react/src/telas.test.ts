import { describe, expect, it } from "vitest";
import type { Estado } from "./engine";
import { avisoDispensar, avisos, avisosRestaurar } from "./avisos";
import { buscar, valorDe } from "./busca";
import { nwSnap, patrimonio, ultimos } from "./patrimonio";
import { estatisticas } from "./voce";
import { vazio } from "./loja";

const L = (o: object) => ({ id: "x", nome: "Item", tipo: "desp", cents: 1000, data: "2026-11-10", ...o });
const est = (lancamentos: object[], extra: object = {}): Estado => ({ hoje: "2026-11-09", lancamentos: lancamentos as Estado["lancamentos"], contas: [], cartoes: {}, ...extra });

describe("valorDe", () => {
  it("lê valores", () => { expect(valorDe("150")).toBe(15000); expect(valorDe("89,90")).toBe(8990); expect(valorDe("1.250,00")).toBe(125000); expect(valorDe("luz")).toBeNull(); });
});
describe("buscar", () => {
  const e = est([L({ id: "a", nome: "Mercado Bom", cents: 15000, data: "2026-10-03", cat: "mercado" }), L({ id: "b", nome: "Salário", tipo: "rec", cents: 500000, data: "2026-11-01" }), L({ id: "c", nome: "Uber", cents: 3290, data: "2026-11-05", tags: ["viagem"] })]);
  it("acha por nome sem acento, valor e tag", () => {
    expect(buscar(e, "salario").total).toBe(1);
    expect(buscar(e, "150").meses[0].itens[0].l.id).toBe("a");
    expect(buscar(e, "32,90").total).toBe(1);
    expect(buscar(e, "#viagem").total).toBe(1);
  });
  it("junta palavras, ordena do mais novo e soma por tipo", () => {
    const r = buscar(e, "");
    expect(r.total).toBe(0);
    const t = buscar(e, "o"); // Mercado, Salário, Uber? "o" em Mercado e Salário
    expect(t.meses.map(m => m.ym)).toEqual(["2026-11", "2026-10"]);
    expect(buscar(e, "mercado bom").desp).toBe(15000);
    expect(buscar(e, "mercado uber").total).toBe(0);
  });
});
describe("avisos", () => {
  const e = est([L({ id: "p1", nome: "Luz", cents: 8000, data: "2026-11-07", pago: false }), L({ id: "p2", nome: "Internet", cents: 9000, data: "2026-11-10", pago: false }), L({ id: "p3", nome: "Longe", cents: 1000, data: "2026-11-30", pago: false })]);
  it("atrasado vira alto, próximo vira médio e longe não aparece", () => {
    const a = avisos(e, null);
    expect(a.map(x => x.titulo)).toEqual(["Luz atrasado", "Internet"]);
    expect(a[0].nivel).toBe("alto"); expect(a[1].nivel).toBe("medio");
  });
  it("dispensar e restaurar", () => {
    const b = vazio(), b2 = avisoDispensar(b, "venc|p1");
    expect(avisos(e, b2).map(x => x.id)).toEqual(["p2"]);
    expect(avisos(e, b2, {}, true)).toHaveLength(2);
    expect(avisoDispensar(b2, "venc|p1")).toBe(b2);
    expect(avisos(e, avisosRestaurar(b2))).toHaveLength(2);
  });
  it("limite do cartão a 80% e acima", () => {
    const cartoes = { Roxo: { tipo: "credito", venc: 20, limite: 100000 } };
    const alto = est([L({ id: "c1", nome: "TV", cartao: "Roxo", cents: 90000, data: "2026-11-20", pago: false })], { cartoes });
    expect(avisos(alto, null).some(x => /80|%/.test(x.titulo) || /limite/.test(x.titulo))).toBe(true);
    const acima = est([L({ id: "c1", nome: "TV", cartao: "Roxo", cents: 130000, data: "2026-11-20", pago: false })], { cartoes });
    expect(avisos(acima, null).some(x => x.titulo === "Roxo passou do limite")).toBe(true);
  });
  it("orçamento a 80% e 100%", () => {
    const b = { ...vazio(), cfg: { budgets: { mercado: 100000 } } };
    const e80 = est([L({ id: "m", nome: "Super", cents: 85000, data: "2026-11-02", cat: "mercado", pago: true })]);
    expect(avisos(e80, b).some(x => x.k === "orc|mercado|2026-11|80")).toBe(true);
    const e100 = est([L({ id: "m", nome: "Super", cents: 105000, data: "2026-11-02", cat: "mercado", pago: true })]);
    expect(avisos(e100, b).some(x => x.k === "orc|mercado|2026-11|100")).toBe(true);
  });
});
describe("patrimônio", () => {
  it("soma contas e caixinhas, tira dívidas e guarda o mês", () => {
    const b = { ...vazio(), cfg: { save: [{ id: "s", name: "R", moves: [{ id: "m", date: "2026-11-01", cents: 20000 }, { id: "n", date: "2026-11-01", cents: 5000, cur: "EUR" }] }], debts: [{ id: "d", name: "D", total: 10000, moves: [{ id: "q", date: "2026-11-01", cents: 4000 }] }] } };
    const e = est([], { contas: [{ nome: "Banco", cents: 100000, em: 1 }] });
    const p = patrimonio(e, b);
    expect(p.contas).toBe(100000); expect(p.guardado).toBe(20000); expect(p.dividas).toBe(6000); expect(p.total).toBe(114000); expect(p.moedas.EUR).toBe(5000);
    const b2 = nwSnap(b, "2026-11", p.total);
    expect(nwSnap(b2, "2026-11", p.total)).toBe(b2);
    expect(ultimos(b2, "2026-11").at(-1)).toEqual({ ym: "2026-11", cents: 114000 });
    expect(ultimos(b2, "2026-11")[0].cents).toBeNull();
  });
});
describe("estatísticas", () => {
  it("conta o que há", () => {
    const b = { ...vazio(), items: [{ type: "desp", desc: "Tênis", cents: 30000, date: "2026-10-04", cat: "outros" }, { type: "rec", desc: "Sal", cents: 1, date: "2026-11-01" }, { type: "desp", desc: "Fatura X", cents: 999999, date: "2026-11-02", cat: "cartao" }] };
    const s = estatisticas(b as never);
    expect(s.lancamentos).toBe(3); expect(s.receitas).toBe(1); expect(s.meses).toBe(2); expect(s.desde).toBe("2026-10-04");
    expect(s.maior?.desc).toBe("Tênis");
  });
});
