import { describe, expect, it } from "vitest";
import { demo } from "../../novo/visao-geral/demo.mjs";
import * as C from "./engine";
import type { Estado } from "./engine";
import { linhasDoMes, porDia } from "./contas";

const e = demo as unknown as Estado, ym = "2026-11";
describe("linhasDoMes", () => {
  it("cartão vira uma linha Fatura com o valor do motor e sem compras soltas", () => {
    const L = linhasDoMes(e, ym, "todos");
    const f = L.filter(x => x.tipo === "fatura");
    expect(f.length).toBeGreaterThan(0);
    for (const x of f) expect(x.cents).toBe(C.fatura(e, x.cartao, ym).total);
    expect(L.some(x => x.nome === "Tênis")).toBe(false);
  });
  it("filtros separam receitas, a pagar e pagos", () => {
    expect(linhasDoMes(e, ym, "receitas").every(x => x.rec)).toBe(true);
    expect(linhasDoMes(e, ym, "apagar").every(x => !x.rec && !x.pago)).toBe(true);
    expect(linhasDoMes(e, ym, "pagos").every(x => !x.rec && x.pago)).toBe(true);
  });
  it("busca ignora acento e agrupa por dia do mais novo ao mais antigo", () => {
    expect(linhasDoMes(e, ym, "todos", "farmacia").map(x => x.nome)).toEqual(["Farmácia"]);
    const d = porDia(linhasDoMes(e, ym, "todos")).map(x => x.data);
    expect([...d].sort().reverse()).toEqual(d);
  });
});
