// Dados de exemplo inventados (nada pessoal). Rodar: node --test novo/teste/
import test from "node:test";
import assert from "node:assert/strict";
import {
  fatura, rolaPara, aPagar, aPagarDetalhe, proximosPagamentos, entraAinda, entrou, gastou, pago, sobra,
  naConta, saldoDaConta, fimDoMes, resumoMes, limite, mesFaturaAberta, vencimento,
} from "../base/calculo.mjs";

const T_ANTES = Date.parse("2026-10-20T10:00:00Z");
const T_SALDO = Date.parse("2026-11-01T12:00:00Z");
const T_DEPOIS = Date.parse("2026-11-03T10:00:00Z");

// hoje = 04/11/2026; Inter vence dia 2 (a de novembro já venceu); Renner vence dia 15
const base = (extra = {}) => ({
  hoje: "2026-11-04",
  inicio: "2026-10-01",
  contas: [{ nome: "Inter", cents: 100000, em: T_SALDO }],
  cartoes: { Inter: { venc: 2, limite: 341000 }, Renner: { venc: 15, limite: 150000 }, VR: { tipo: "beneficio" } },
  lancamentos: [], faturas: [], ajustes: [],
  ...extra,
});
const desp = (id, cents, data, o = {}) => ({ id, nome: id, tipo: "desp", cents, data, pago: false, ...o });
const rec = (id, cents, data, o = {}) => ({ id, nome: id, tipo: "rec", cents, data, ...o });

test("vencimento: dia 31 num mês curto vira o último dia; sem dia, último dia do mês", () => {
  const e = base({ cartoes: { A: { venc: 31 }, B: {} } });
  assert.equal(vencimento(e, "A", "2026-11"), "2026-11-30");
  assert.equal(vencimento(e, "B", "2026-02"), "2026-02-28");
});

test("mesFaturaAberta: a de novembro (dia 2) já venceu, vale dezembro; Renner dia 15 ainda é novembro", () => {
  const e = base();
  assert.equal(mesFaturaAberta(e, "Inter"), "2026-12");
  assert.equal(mesFaturaAberta(e, "Renner"), "2026-11");
});

// ---------- A PAGAR ----------
test("a pagar: avulso em aberto entra; pago, benefício e anterior ao início não entram", () => {
  const e = base({ lancamentos: [
    desp("aluguel", 20000, "2026-11-15"),
    desp("pago", 9999, "2026-11-10", { pago: true }),
    desp("mercado-vr", 7777, "2026-11-12", { pagoCom: "VR" }),
    desp("velho", 5555, "2026-09-20"),
  ] });
  assert.equal(aPagar(e, "2026-11"), 20000);
});

test("a pagar: atrasado de mês anterior (depois do início) cai no mês atual, e só nele", () => {
  const e = base({ lancamentos: [desp("luz", 5000, "2026-10-10")] });
  assert.equal(aPagar(e, "2026-11"), 5000);
  assert.equal(aPagar(e, "2026-12"), 0);
  assert.equal(aPagarDetalhe(e, "2026-11")[0].atrasado, true);
});

test("a pagar: lista e total são a mesma conta, e 'próximos pagamentos' usa a mesma lista", () => {
  const e = base({ lancamentos: [
    desp("agua", 8000, "2026-11-10"),
    desp("c1", 10000, "2026-11-15", { cartao: "Renner" }),
    desp("c2", 20000, "2026-11-15", { cartao: "Renner" }),
    desp("luz", 5000, "2026-10-10"),
  ] });
  const L = aPagarDetalhe(e, "2026-11");
  assert.equal(L.reduce((s, x) => s + x.cents, 0), aPagar(e, "2026-11"));
  assert.equal(aPagar(e, "2026-11"), 8000 + 30000 + 5000);
  const prox = proximosPagamentos(e, 10); // até 14/11: a fatura Renner (dia 15) ainda não entra
  assert.deepEqual(prox.map(x => x.nome), ["luz", "agua"]);
  const prox20 = proximosPagamentos(e, 20);
  assert.equal(prox20.find(x => x.tipo === "fatura").cents, fatura(e, "Renner", "2026-11").aberto);
});

// ---------- FATURA ----------
test("fatura: valor do banco maior que o lançado vira o total, e a diferença é o que falta lançar", () => {
  const e = base({
    lancamentos: [desp("a", 10000, "2026-12-02", { cartao: "Inter" }), desp("b", 20000, "2026-12-02", { cartao: "Inter" }), desp("c", 5000, "2026-12-02", { cartao: "Inter" })],
    faturas: [{ cartao: "Inter", ym: "2026-12", valorBanco: 40000 }],
  });
  const f = fatura(e, "Inter", "2026-12");
  assert.equal(f.lancado, 35000);
  assert.equal(f.falta, 5000);
  assert.equal(f.total, 40000);
  assert.equal(f.aberto, 40000);
});

test("fatura: sem valor do banco ou com o banco menor que o lançado, vale o lançado", () => {
  const itens = [desp("a", 10000, "2026-12-02", { cartao: "Inter" }), desp("b", 25000, "2026-12-02", { cartao: "Inter" })];
  assert.equal(fatura(base({ lancamentos: itens }), "Inter", "2026-12").total, 35000);
  const e = base({ lancamentos: itens, faturas: [{ cartao: "Inter", ym: "2026-12", valorBanco: 30000 }] });
  assert.equal(fatura(e, "Inter", "2026-12").total, 35000);
  assert.equal(fatura(e, "Inter", "2026-12").falta, 0);
});

test("fatura paga: itens pagos e a diferença marcada como paga → aberto zero", () => {
  const e = base({
    lancamentos: [desp("a", 10000, "2026-12-02", { cartao: "Inter", pago: true })],
    faturas: [{ cartao: "Inter", ym: "2026-12", valorBanco: 15000, paga: true }],
  });
  const f = fatura(e, "Inter", "2026-12");
  assert.equal(f.total, 15000);
  assert.equal(f.aberto, 0);
});

test("rolagem: fatura vencida e não paga vai inteira para a próxima; a antiga fica zerada", () => {
  const e = base({ lancamentos: [desp("compra", 10000, "2026-11-02", { cartao: "Inter" })] });
  assert.equal(rolaPara(e, e.lancamentos[0]), "2026-12");
  assert.equal(fatura(e, "Inter", "2026-11").total, 0);
  assert.equal(fatura(e, "Inter", "2026-11").aberto, 0);
  const dez = fatura(e, "Inter", "2026-12");
  assert.equal(dez.total, 10000);
  assert.equal(dez.doAnterior, 10000);
  assert.equal(aPagar(e, "2026-11"), 0);
  assert.equal(aPagar(e, "2026-12"), 10000);
  // na competência (gastou) a compra continua no mês dela
  assert.equal(gastou(e, "2026-11"), 10000);
});

test("rolagem: se a fatura nova já veio do banco com 'Saldo da fatura anterior', o que rolou não conta de novo", () => {
  const e = base({ lancamentos: [
    desp("compra", 10000, "2026-11-02", { cartao: "Inter" }),
    desp("Saldo da fatura anterior", 10000, "2026-12-02", { cartao: "Inter", saldoAnterior: true }),
  ] });
  assert.equal(fatura(e, "Inter", "2026-12").total, 10000);
  assert.equal(aPagar(e, "2026-12"), 10000);
});

test("rolagem: fatura nova importada do banco também anula (o banco já somou o que ficou para trás)", () => {
  const e = base({
    lancamentos: [desp("compra", 10000, "2026-11-02", { cartao: "Inter" }), desp("outra", 3000, "2026-12-02", { cartao: "Inter" })],
    faturas: [{ cartao: "Inter", ym: "2026-12", importada: true }],
  });
  assert.equal(fatura(e, "Inter", "2026-12").total, 3000);
});

test("rolagem: valor do banco ainda não lançado em item também rola, sem contar duas vezes", () => {
  const e = base({
    lancamentos: [desp("compra", 10000, "2026-11-02", { cartao: "Inter" })],
    faturas: [{ cartao: "Inter", ym: "2026-11", valorBanco: 30000 }],
  });
  const dez = fatura(e, "Inter", "2026-12");
  assert.equal(dez.doAnterior, 30000); // 10.000 do item + 20.000 que faltava lançar
  assert.equal(dez.total, 30000);
  assert.equal(fatura(e, "Inter", "2026-11").total, 0);
  assert.equal(aPagar(e, "2026-12"), 30000);
});

test("rolagem não acontece antes do início nem em item pago", () => {
  const e = base({ lancamentos: [desp("velha", 1000, "2026-09-02", { cartao: "Inter" }), desp("paga", 2000, "2026-11-02", { cartao: "Inter", pago: true })] });
  assert.equal(rolaPara(e, e.lancamentos[0]), null);
  assert.equal(rolaPara(e, e.lancamentos[1]), null);
});

// ---------- NO MÊS ----------
test("entrou / gastou / sobra: benefício fica de fora; fatura conta no mês do vencimento", () => {
  const e = base({ lancamentos: [
    rec("salario", 300000, "2026-11-01"),
    desp("aluguel", 100000, "2026-11-15", { pago: true }),
    desp("vr", 50000, "2026-11-10", { pagoCom: "VR", pago: true }),
    desp("c", 40000, "2026-11-15", { cartao: "Renner" }),
  ] });
  assert.equal(entrou(e, "2026-11"), 300000);
  assert.equal(gastou(e, "2026-11"), 140000);
  assert.equal(sobra(e, "2026-11"), 160000);
  assert.equal(pago(e, "2026-11"), 100000);
});

// ---------- NA CONTA ----------
test("na conta: saldo informado + entrou depois − pago depois ± caixinha/transferência", () => {
  const e = base({
    lancamentos: [
      rec("freela", 50000, "2026-11-03", { criadoEm: T_DEPOIS }),
      rec("antes", 11111, "2026-10-30", { criadoEm: T_ANTES }), // já estava no saldo informado
      rec("futura", 99999, "2026-11-30", { criadoEm: T_DEPOIS }), // ainda não caiu
      desp("luz", 20000, "2026-11-03", { pago: true, pagoEm: T_DEPOIS }),
      desp("antiga", 7777, "2026-10-30", { pago: true, pagoEm: T_ANTES }),
    ],
    ajustes: [{ em: T_DEPOIS, conta: "Inter", cents: -30000 }],
  });
  assert.equal(naConta(e), 100000 + 50000 - 20000 - 30000);
});

test("na conta: salário que 'caiu' no fim do mês anterior (data dia 1º) já está no saldo", () => {
  const e = base({ lancamentos: [rec("sal", 200000, "2026-11-01", { criadoEm: T_DEPOIS, caiu: "2026-10-30" })] });
  assert.equal(naConta(e), 300000);
  assert.equal(entraAinda(e, "2026-11"), 0);
});

test("na conta: duas contas, cada uma com o seu saldo; conta que não existe cai na primeira", () => {
  const e = base({
    contas: [{ nome: "Inter", cents: 100000, em: T_SALDO }, { nome: "Nubank", cents: 50000, em: T_SALDO }],
    lancamentos: [
      desp("a", 1000, "2026-11-03", { pago: true, pagoEm: T_DEPOIS, conta: "Nubank" }),
      desp("b", 2000, "2026-11-03", { pago: true, pagoEm: T_DEPOIS, conta: "Sumiu" }),
    ],
  });
  assert.equal(saldoDaConta(e, "Nubank"), 49000);
  assert.equal(saldoDaConta(e, "Inter"), 98000);
  assert.equal(naConta(e), 147000);
});

test("na conta: marcar a diferença da fatura como paga depois do saldo também desconta", () => {
  const e = base({ faturas: [{ cartao: "Renner", ym: "2026-11", valorBanco: 8000, paga: true, pagaEm: T_DEPOIS }] });
  assert.equal(naConta(e), 92000);
});

// ---------- FIM DO MÊS ----------
test("fim do mês: conta hoje + o que ainda entra − o que ainda sai, mês a mês", () => {
  const e = base({
    lancamentos: [
      rec("salario", 300000, "2026-11-30"),
      desp("aluguel", 20000, "2026-11-15"),
      desp("fatura", 40000, "2026-12-02", { cartao: "Inter" }),
    ],
  });
  assert.equal(fimDoMes(e, "2026-11"), 100000 + 300000 - 20000);
  assert.equal(fimDoMes(e, "2026-12"), 100000 + 300000 - 20000 - 40000);
  assert.equal(fimDoMes(e, "2026-10"), null);
});

test("fim do mês: receita prevista (salário previsto) entra, mas só a que ainda vai cair", () => {
  const e = base({ previstos: ym => (ym === "2026-12" ? [{ data: "2026-12-05", cents: 500000 }] : []) });
  assert.equal(fimDoMes(e, "2026-12"), 100000 + 500000);
});

test("fim do mês sem conta informada: receitas − despesas acumuladas", () => {
  const e = base({
    contas: [],
    lancamentos: [rec("sal", 300000, "2026-11-01"), desp("x", 120000, "2026-11-20")],
  });
  assert.equal(fimDoMes(e, "2026-11"), 180000);
});

test("resumo do mês: tudo vem das mesmas funções", () => {
  const e = base({ lancamentos: [rec("sal", 300000, "2026-11-30"), desp("aluguel", 20000, "2026-11-15"), desp("pago", 10000, "2026-11-05", { pago: true })] });
  const r = resumoMes(e, "2026-11");
  assert.deepEqual(
    { entrou: r.entrou, entraAinda: r.entraAinda, gastou: r.gastou, pago: r.pago, aPagar: r.aPagar, sobra: r.sobra, fimDoMes: r.fimDoMes },
    { entrou: 300000, entraAinda: 300000, gastou: 30000, pago: 10000, aPagar: 20000, sobra: 270000, fimDoMes: 380000 },
  );
});

// ---------- LIMITE ----------
test("limite: usado = o que está em aberto; assinatura de meses futuros não pega o limite ainda", () => {
  const e = base({ lancamentos: [
    desp("dez", 35000, "2026-12-02", { cartao: "Inter" }),
    desp("netflix-jan", 5000, "2026-01-02".replace("2026", "2027"), { cartao: "Inter", recorrente: true }),
    desp("parcela-jan", 9000, "2027-01-02", { cartao: "Inter" }),
    desp("paga", 7000, "2026-12-02", { cartao: "Inter", pago: true }),
  ] });
  const l = limite(e, "Inter");
  assert.equal(l.usado, 35000 + 9000);
  assert.equal(l.livre, 341000 - 44000);
  assert.equal(l.doBanco, false);
});

test("limite: com o 'livre' do banco, só mexe no que aconteceu depois", () => {
  const e = base({
    cartoes: { Inter: { venc: 2, limite: 341000, livreBanco: 300000, livreBancoEm: T_SALDO } },
    lancamentos: [
      desp("antiga", 20000, "2026-12-02", { cartao: "Inter", criadoEm: T_ANTES }), // já estava no livre do banco
      desp("nova", 15000, "2026-12-02", { cartao: "Inter", criadoEm: T_DEPOIS }), // tira
      desp("paga-depois", 4000, "2026-11-20", { cartao: "Inter", pago: true, pagoEm: T_DEPOIS, criadoEm: T_ANTES }), // devolve
    ],
  });
  const l = limite(e, "Inter");
  assert.equal(l.livre, 300000 - 15000 + 4000);
  assert.equal(l.doBanco, true);
});

test("limite: acima do limite mostra 'passou', não livre negativo", () => {
  const e = base({ lancamentos: [desp("tudo", 400000, "2026-12-02", { cartao: "Inter" })] });
  const l = limite(e, "Inter");
  assert.equal(l.passou, 400000 - 341000);
  assert.ok(l.pct > 100);
});

test("limite: sem limite informado devolve null", () => {
  const e = base({ cartoes: { Inter: { venc: 2 } } });
  assert.equal(limite(e, "Inter"), null);
});

// ---------- CONSISTÊNCIA ENTRE TELAS ----------
test("o mesmo número em qualquer lugar: a fatura em aberto é igual no A pagar, nos próximos pagamentos e na fatura", () => {
  const e = base({
    lancamentos: [
      desp("c1", 10000, "2026-11-02", { cartao: "Inter" }), // vencida: rola
      desp("c2", 22000, "2026-12-02", { cartao: "Inter" }),
      desp("agua", 8000, "2026-11-10"),
    ],
    faturas: [{ cartao: "Inter", ym: "2026-12", valorBanco: 40000 }],
  });
  const f = fatura(e, "Inter", "2026-12");
  assert.equal(f.total, 40000);
  assert.equal(f.aberto, 40000);
  assert.equal(aPagarDetalhe(e, "2026-12").find(x => x.cartao === "Inter").cents, f.aberto);
  assert.equal(proximosPagamentos(e, 40).find(x => x.cartao === "Inter").cents, f.aberto);
  assert.equal(fimDoMes(e, "2026-12"), naConta(e) + entraAinda(e, "2026-11") + entraAinda(e, "2026-12") - aPagar(e, "2026-11") - aPagar(e, "2026-12"));
});
