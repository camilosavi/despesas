import { assinaturas } from "./assinaturas";
import { caixaCriar, caixaMover, caixaSaldo, caixas, dividaCriar, dividaMover, dividaFalta, dividas, ppCriar, ppLancar, ppSaldo, ppSinal, ppQuitar, ppDe, ppExcluir, marcarVarios, apagar, criar, dataNaFatura, editar, marcarPago, salvarCartao, salvarConta, vazio } from "./loja";
import type { Form } from "./loja";
import { cargaDe } from "./dados";
import * as C from "./engine";

let n = 0; const id = () => "i" + ++n;
const HOJE = "2026-11-06", AGORA = Date.parse("2026-11-06T12:00:00");
const base = () => salvarCartao(salvarConta(vazio(), "Nubank", 100000, AGORA, HOJE), "Inter", { due: 10, limit: 300000 });
const f = (o: Partial<Form> = {}): Form => ({ tipo: "desp", desc: "Mercado", cents: 5000, cat: "merc", date: "2026-11-06", pay: "Pix", paid: true, repete: { modo: "uma" }, ...o });

describe("loja (gravação)", () => {
  it("despesa paga mexe no saldo e na lista; não altera o backup antigo", () => {
    const b0 = base(), b1 = criar(b0, f(), HOJE, AGORA + 1, id);
    expect(b0.items).toHaveLength(0); expect(b1.items).toHaveLength(1);
    const e = cargaDe(b1, HOJE).estado;
    expect(C.naConta(e)).toBe(95000);
  });
  it("crédito cai na fatura do vencimento certo e nasce a pagar", () => {
    const b = base();
    expect(dataNaFatura(b, "Inter", "2026-10-20")).toBe("2026-11-10");   // vence dia 10 → fecha ~16 dias antes (25/10)
    expect(dataNaFatura(b, "Inter", "2026-11-20")).toBe("2026-12-10");
    expect(dataNaFatura(b, "Inter", "2026-11-26")).toBe("2027-01-10");
    const b1 = criar(b, f({ pay: "Crédito", card: "Inter", date: "2026-11-20", paid: true }), HOJE, AGORA, id);
    expect(b1.items[0]).toMatchObject({ date: "2026-12-10", buy: "2026-11-20", card: "Inter", paid: false });
  });
  it("parcelas e repetição criam um item por mês, no mesmo grupo", () => {
    const p = criar(base(), f({ pay: "Crédito", card: "Inter", date: "2026-11-20", repete: { modo: "parcelas", n: 3 } }), HOJE, AGORA, id);
    expect(p.items.map(x => x.parc)).toEqual(["1/3", "2/3", "3/3"]);
    expect(p.items.map(x => x.date)).toEqual(["2026-12-10", "2027-01-10", "2027-02-10"]);
    expect(new Set(p.items.map(x => x.group)).size).toBe(1);
    expect(p.items.map(x => x.cents)).toEqual([1668, 1666, 1666].map(v => v)); // 5000 ÷ 3: sobra na 1ª
    expect(p.items.reduce((s, x) => s + x.cents, 0)).toBe(5000);
    const m = criar(base(), f({ cat: "assin", repete: { modo: "mensal", n: 2 }, date: "2026-12-31" }), HOJE, AGORA, id);
    expect(m.items.map(x => x.date)).toEqual(["2026-12-31", "2027-01-31"]); expect(m.items[0].parc).toBeUndefined();
  });
  it("salário depois do dia 25 conta no mês seguinte", () => {
    const b = criar(base(), f({ tipo: "rec", cat: "sal", pay: "Pix", date: "2026-10-30", desc: "Salário" }), HOJE, AGORA, id);
    expect(b.items[0]).toMatchObject({ date: "2026-11-01", fell: "2026-10-30" });
  });
  it("editar, pagar, apagar (com e sem as seguintes)", () => {
    const b = criar(base(), f({ repete: { modo: "mensal", n: 3 }, paid: false }), HOJE, AGORA, id);
    const [a, , c] = b.items;
    expect(editar(b, a.id, { desc: "Feira", cents: 7000, cat: "merc", date: a.date, pay: "Pix", paid: false }, AGORA).items[0]).toMatchObject({ desc: "Feira", cents: 7000 });
    expect(marcarPago(b, a.id, true, AGORA + 5).items[0]).toMatchObject({ paid: true, paidAt: AGORA + 5 });
    expect(marcarPago(marcarPago(b, a.id, true, AGORA), a.id, false, AGORA).items[0].paidAt).toBeUndefined();
    expect(apagar(b, a.id).items).toHaveLength(2);
    expect(apagar(b, a.id, true).items).toHaveLength(0);
    expect(apagar(b, c.id, true).items).toHaveLength(2);
  });
  it("fatura paga: marca todos os itens e o saldo da conta não muda (crédito não mexia nele)", () => {
    const b = criar(base(), f({ pay: "Crédito", card: "Inter", date: "2026-10-20", repete: { modo: "mensal", n: 2 } }), HOJE, AGORA, id);
    const ids = b.items.slice(0, 1).map(x => x.id), pago = marcarVarios(b, ids, true, AGORA + 9);
    expect(pago.items[0]).toMatchObject({ paid: true, paidAt: AGORA + 9 }); expect(pago.items[1].paid).toBe(false);
    expect(C.naConta(cargaDe(b, HOJE).estado) - C.naConta(cargaDe(pago, HOJE).estado)).toBe(5000);  // pagar a fatura tira da conta
  });
  it("conta e cartão: salvar de novo atualiza em vez de duplicar", () => {
    const b = salvarConta(base(), "Nubank", 5, AGORA + 9, HOJE);
    expect(b.cfg.accts).toHaveLength(1); expect(b.cfg.accts[0].cents).toBe(5);
    expect(salvarCartao(b, "Inter", { limit: 1 }).cfg.cards.Inter).toMatchObject({ due: 10, limit: 1 });
  });
  it("pessoas: saldo por pessoa, quitar e aparecer no motor", () => {
    let b = ppCriar(base(), "Ana", "a1");
    expect(ppCriar(b, "ana", "x")).toBe(b);
    b = ppLancar(b, "a1", { id: "e1", d: "2026-10-01", ...ppSinal("elaDeve", 10000), t: "Airbnb" });
    b = ppLancar(b, "a1", { id: "e2", d: "2026-10-05", ...ppSinal("elaPagou", 2500) });
    expect(ppSaldo(ppDe(b)[0])).toBe(7500);
    expect(C.saldosPorPessoa(cargaDe(b, HOJE).estado)).toEqual([{ pessoa: "Ana", cents: 7500 }]);
    expect(ppSaldo(ppDe(ppQuitar(b, "a1", HOJE, "e3"))[0])).toBe(0);
    expect(ppDe(ppExcluir(b, "a1"))).toHaveLength(0);
  });
  it("caixinha desconta da conta; dívida acompanha o que falta", () => {
    let b = caixaCriar(base(), "c1", "Viagem", 100000);
    const antes = C.naConta(cargaDe(b, HOJE).estado);
    b = caixaMover(b, "c1", { id: "m1", date: HOJE, cents: 30000, acct: "Nubank", ts: AGORA + 10 });
    b = caixaMover(b, "c1", { id: "m2", date: HOJE, cents: -5000 });
    expect(caixaSaldo(caixas(b)[0])).toBe(25000);
    expect(antes - C.naConta(cargaDe(b, HOJE).estado)).toBe(30000);
    let d = dividaCriar(b, "d1", "Empréstimo", 90000);
    d = dividaMover(d, "d1", { id: "p1", date: HOJE, cents: 20000 });
    d = dividaMover(d, "d1", { id: "p2", date: HOJE, cents: -1000 });
    expect(dividaFalta(dividas(d)[0])).toBe(71000);
    expect(dividaCriar(d, "x", "", 5)).toBe(d);
  });
  it("assinaturas: recorrente sem parcela, soma do mês mais recente", () => {
    const b = base();
    const r = assinaturas([
      { id: "1", nome: "Netflix", tipo: "desp", cat: "assin", cents: 4000, data: "2026-10-05" },
      { id: "2", nome: "Netflix", tipo: "desp", cat: "assin", cents: 4500, data: "2026-11-05" },
      { id: "3", nome: "Tênis", tipo: "desp", cat: "compras", cents: 9000, data: "2026-11-05", parcela: "1/3" },
    ] as any);
    expect(r).toHaveLength(1); expect(r[0].cents).toBe(4500); expect(b).toBeTruthy();
  });
});

import { fxApagar, fxAviso, fxCompras, fxCotacao, fxCriar, fxTotais } from "./loja";
describe("moedas", () => {
  it("cria, soma e tira o preço médio", () => {
    let b = vazio();
    b = fxCriar(b, "a", "EUR", 100000, 600000, "2026-10-01", " Wise ");
    b = fxCriar(b, "b", "EUR", 50000, 330000, "2026-11-01");
    b = fxCriar(b, "c", "USD", 10000, 55000, "2026-11-02");
    expect(fxTotais(b, "EUR")).toMatchObject({ valor: 150000, brl: 930000, n: 2 });
    expect(fxTotais(b, "EUR").medio).toBeCloseTo(6.2);
    expect(fxCompras(b, "USD")).toHaveLength(1);
    expect(fxCompras(b, "EUR")[0].id).toBe("b");
    expect((b.fx[0] as any).where).toBe("Wise");
    expect(fxApagar(b, "a").fx).toHaveLength(2);
  });
  it("ignora valor inválido e avisa cotação estranha", () => {
    const b = vazio();
    expect(fxCriar(b, "x", "EUR", 0, 100, "2026-10-01")).toBe(b);
    expect(fxCotacao(600, 100)).toBe(6);
    expect(fxAviso(6, 6)).toBe("ok");
    expect(fxAviso(0.17, 6)).toBe("inversa");
    expect(fxAviso(60, 6)).toBe("fora");
  });
});

import { catApagar, catCriar, catsSuas, limiteSalvar, limites } from "./loja";
describe("categorias e limites", () => {
  it("cria, recusa repetida, apaga movendo lançamentos e limpa o limite", () => {
    let b = vazio();
    const r = catCriar(b, "desp", "Pets", "#112233"); b = r.backup;
    expect(catsSuas(b, "desp")).toEqual([{ k: "u_pets", n: "Pets", c: "#112233" }]);
    expect(catCriar(b, "desp", "pets").erro).toMatch(/Já existe/);
    expect(catCriar(b, "desp", "Mercado").erro).toMatch(/Já existe/);
    b = { ...b, items: [{ type: "desp", cat: "u_pets", desc: "x", cents: 100, date: "2026-11-01" } as any] };
    b = limiteSalvar(b, "u_pets", 5000); expect(limites(b)).toEqual({ u_pets: 5000 });
    b = catApagar(b, "desp", "u_pets");
    expect(b.items[0].cat).toBe("outros"); expect(catsSuas(b, "desp")).toEqual([]); expect(limites(b)).toEqual({});
    expect(catApagar(b, "desp", "alim")).toBe(b);
    expect(limiteSalvar(limiteSalvar(b, "alim", 100), "alim", 0).cfg.budgets).toEqual({});
  });
});
