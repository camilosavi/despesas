import { holNaoUsar, plano, previstos, salAumento, salModo } from "./salario";
import { vazio } from "./loja";
import type { Backup } from "./loja";

const folha = (ref: string, extra = 0) => ({ ref, k: "sal", date: ref + "-30", liq: 300000, tp: 500000,
  ev: [{ d: "HORAS NORMAIS", c: 400000, s: "p" }, { d: "HORA EXTRA", c: extra, s: "p" }, { d: "I.N.S.S.", c: 50000, s: "d" }, { d: "ADIANTAMENTO", c: 100000, s: "d" }, { d: "COPARTICIPACAO", c: 0, s: "d" }].filter(e => e.c) });
const base = (): Backup => ({ ...vazio(), cfg: { accts: [], cards: {}, hol: { "2026-08|sal": folha("2026-08", 10000), "2026-09|sal": folha("2026-09"), "2026-10|sal": folha("2026-10", 30000) } } });

describe("salário previsto", () => {
  it("separa fixo e variável e calcula base e média", () => {
    const P = plano(base())!;
    expect(P.n).toBe(3);
    expect(P.fp).toBe(400000);
    expect(P.adv).toBe(100000);
    expect(P.rate).toBeCloseTo(0.1, 5);
    expect(P.base).toBe(400000 - 100000 - Math.round(400000 * P.rate));
    expect(P.avg).toBeGreaterThan(P.base - 1);
  });
  it("precisa de 2 holerites", () => { expect(plano(vazio())).toBeNull(); });
  it("cria adiantamento dia 15 e salário no dia 1º do mês seguinte", () => {
    const b = base(), p = previstos(b, "2026-11", "2026-11-06");
    expect(p.find(x => x.id === "_sp_adv_2026-11")?.data).toBe("2026-11-15");
    const s = previstos(b, "2026-12", "2026-11-06").find(x => x.id === "_sp_sal_2026-12");
    expect(s?.data).toBe("2026-12-01"); expect(s?.caiu).toBe("2026-11-30");
    expect(previstos(b, "2026-10", "2026-11-06")).toEqual([]);
  });
  it("some quando há lançamento real, desliga e respeita aumento e 'não usar'", () => {
    let b = base();
    b = { ...b, items: [{ type: "rec", cat: "sal", desc: "Salário", cents: 1, date: "2026-12-01" } as any] };
    expect(previstos(b, "2026-12", "2026-11-06").find(x => x.id.startsWith("_sp_sal"))).toBeUndefined();
    expect(previstos(salModo(base(), "off"), "2026-11", "2026-11-06")).toEqual([]);
    const a = previstos(salAumento(base(), { from: "2026-10", net: 800000 }), "2026-12", "2026-11-06").find(x => x.id === "_sp_sal_2026-12");
    const P0 = plano(base())!, adv = Math.round((100000 * 800000) / (100000 + P0.base));
    expect(a?.cents).toBe(800000 - adv + (P0.avg - P0.base));
    expect(plano(holNaoUsar(holNaoUsar(base(), "2026-08|sal", true), "2026-09|sal", true))).toBeNull();
  });
});
