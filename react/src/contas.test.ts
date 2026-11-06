import { describe, expect, it } from "vitest";
import { demo } from "../../novo/visao-geral/demo.mjs";
import * as C from "./engine";
import type { Estado } from "./engine";
import { FILTRO0, fluxoDoMes } from "./contas";

const e = demo as unknown as Estado, cur = "2026-11";
describe("fluxoDoMes", () => {
  it("o saldo depois do último item futuro é o Fim do mês do motor", () => {
    const f = fluxoDoMes(e, cur);
    expect(f.futuro.length).toBeGreaterThan(0);
    expect(f.futuro.at(-1)!.saldoApos).toBe(C.fimDoMes(e, cur));
    expect(f.inicio).toBe(C.naConta(e));
  });
  it("mês seguinte parte do fim do mês atual", () => {
    const f = fluxoDoMes(e, "2026-12");
    expect(f.inicio).toBe(C.fimDoMes(e, cur));
    expect(f.passado).toEqual([]);
  });
  it("cartão é uma linha só (valor em aberto) e compra solta não aparece", () => {
    const f = fluxoDoMes(e, cur), fat = f.futuro.filter(x => x.tipo === "fatura");
    for (const x of fat) expect(x.cents).toBe(C.fatura(e, x.cartao!, cur).aberto);
    expect(f.futuro.concat(f.passado.flatMap(d => d.linhas)).some(x => x.nome === "Tênis")).toBe(false);
  });
  it("futuro e passado não repetem item", () => {
    const f = fluxoDoMes(e, cur), ids = [...f.futuro, ...f.passado.flatMap(d => d.linhas)].map(x => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("filtros: entradas, saídas, busca sem acento, categoria", () => {
    const todos = (f: ReturnType<typeof fluxoDoMes>) => [...f.futuro, ...f.passado.flatMap(d => d.linhas)];
    expect(todos(fluxoDoMes(e, cur, { ...FILTRO0, tipo: "entradas" })).every(x => x.rec)).toBe(true);
    expect(todos(fluxoDoMes(e, cur, { ...FILTRO0, tipo: "saidas" })).every(x => !x.rec)).toBe(true);
    expect(todos(fluxoDoMes(e, cur, { ...FILTRO0, q: "farmacia" })).map(x => x.nome)).toEqual(["Farmácia"]);
    expect(todos(fluxoDoMes(e, cur, { ...FILTRO0, cat: "alim" })).every(x => x.cat === "alim")).toBe(true);
  });
  it("filtrar não muda o saldo calculado", () => {
    const a = fluxoDoMes(e, cur), b = fluxoDoMes(e, cur, { ...FILTRO0, tipo: "saidas" });
    for (const x of b.futuro) expect(x.saldoApos).toBe(a.futuro.find(y => y.id === x.id)!.saldoApos);
  });
});
