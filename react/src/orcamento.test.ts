import { describe, expect, it } from "vitest";
import { limiteComSobra, regraApagar, regraCriar, regraDe, regras, sobraDesde, sobraLigar } from "./orcamento";
import { limiteSalvar, vazio } from "./loja";

describe("sobra do orçamento", () => {
  const gasto = (m: Record<string, number>) => (ym: string) => m[ym] || 0;
  it("sem ligar, ou no mês em que liga, vale o limite base", () => {
    expect(limiteComSobra(50000, undefined, "2026-12", gasto({}))).toEqual({ limite: 50000, sobra: 0 });
    expect(limiteComSobra(50000, "2026-11", "2026-11", gasto({}))).toEqual({ limite: 50000, sobra: 0 });
  });
  it("sobra de cada mês soma ao seguinte; estourar gasta a sobra e nunca fica negativa", () => {
    const g = gasto({ "2026-11": 30000, "2026-12": 60000, "2027-01": 90000 });
    expect(limiteComSobra(50000, "2026-11", "2026-12", g)).toEqual({ limite: 70000, sobra: 20000 });
    expect(limiteComSobra(50000, "2026-11", "2027-01", g)).toEqual({ limite: 60000, sobra: 10000 });
    expect(limiteComSobra(50000, "2026-11", "2027-02", g)).toEqual({ limite: 50000, sobra: 0 });
  });
  it("virar o ano e ligar/desligar; sem limite não liga; tirar o limite desliga", () => {
    expect(limiteComSobra(1000, "2026-12", "2027-01", gasto({}))).toEqual({ limite: 2000, sobra: 1000 });
    let b = vazio();
    expect(sobraDesde(sobraLigar(b, "alim", "2026-11", true))).toEqual({});
    b = limiteSalvar(b, "alim", 1000); b = sobraLigar(b, "alim", "2026-11", true);
    expect(sobraDesde(b)).toEqual({ alim: "2026-11" });
    expect(sobraDesde(limiteSalvar(b, "alim", 0))).toEqual({});
    expect(sobraDesde(sobraLigar(b, "alim", "2026-11", false))).toEqual({});
  });
});

describe("regras de categoria", () => {
  const b0 = () => ({ ...vazio(), items: [
    { id: "1", type: "desp", desc: "IFOOD *Pizzaria", cat: "outros", cents: 100, date: "2026-11-01", pay: "Pix", paid: true, createdAt: 1 },
    { id: "2", type: "desp", desc: "iFood Mercado", cat: "mercado", cents: 100, date: "2026-11-01", pay: "Pix", paid: true, createdAt: 1 },
    { id: "3", type: "rec", desc: "ifood repasse", cat: "rout", cents: 100, date: "2026-11-01", pay: "Pix", paid: true, createdAt: 1 },
  ] as any });
  it("cria, troca só o que está em Outros do mesmo tipo e substitui regra repetida", () => {
    const r = regraCriar(b0(), " iFood ", "alim", "desp");
    expect(r.mudou).toBe(1); expect(r.backup.items.map(x => x.cat)).toEqual(["alim", "mercado", "rout"]);
    expect(regras(r.backup)).toEqual([{ t: "iFood", m: "c", cat: "alim" }]);
    const r2 = regraCriar(r.backup, "IFOOD", "lazer", "desp"); expect(regras(r2.backup)).toEqual([{ t: "IFOOD", m: "c", cat: "lazer" }]);
  });
  it("valida texto e categoria; casa sem acento e maiúscula; ignora categoria que não existe mais; apaga", () => {
    expect(regraCriar(b0(), "a", "alim", "desp").erro).toBeTruthy(); expect(regraCriar(b0(), "uber", "", "desp").erro).toBeTruthy();
    const b = regraCriar(b0(), "Padaria Pão", "alim", "desp").backup;
    expect(regraDe(b, "PADARIA PAO DOURADO", ["alim"])).toBe("alim");
    expect(regraDe(b, "padaria pao", ["lazer"])).toBe("");
    expect(regraDe(b, "", ["alim"])).toBe("");
    expect(regras(regraApagar(b, "Padaria Pão"))).toEqual([]);
  });
});
