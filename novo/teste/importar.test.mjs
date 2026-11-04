import test from "node:test";
import assert from "node:assert/strict";
import { deAppAtual } from "../base/importar.mjs";
import { fatura, gastou, aPagar, naConta } from "../base/calculo.mjs";

// backup INVENTADO no formato do app atual
const backup = {
  app: "minhas-despesas", v: 1, fx: [],
  cfg: { accts: [{ id: "a", name: "Conta", cents: 100000, at: "2026-11-01", atTs: Date.parse("2026-11-01T12:00:00Z") }],
    cards: { Inter: { due: 2, limit: 300000 }, VR: { kind: "ben" } }, cats: [{ k: "u_pets", n: "Pets", c: "#112233" }] },
  items: [
    { id: "1", type: "rec", desc: "Salário", cat: "sal", cents: 500000, date: "2026-11-01", fell: "2026-10-30", paid: true },
    { id: "2", type: "desp", desc: "Inter · Fatura Inter", cat: "cartao", cents: 90000, date: "2026-11-02", card: "Inter", paid: false, imp: "fatura-2026-11-02" },
    { id: "3", type: "desp", desc: "Inter · Tênis", cat: "compras", cents: 20000, date: "2026-11-02", card: "Inter", paid: false, parc: "1/3", group: "g1" },
    { id: "4", type: "desp", desc: "Ração", cat: "u_pets", cents: 5000, date: "2026-11-03", paid: true, paidAt: Date.parse("2026-11-03T10:00:00Z"), createdAt: Date.parse("2026-11-03T10:00:00Z") },
    { id: "5", type: "desp", desc: "Almoço", cat: "alim", cents: 3000, date: "2026-11-03", pay: "VR", paid: true },
    { id: "6", type: "desp", desc: "Natação", cat: "esporte", cents: 9000, date: "2026-11-05", paid: false, group: "g2" },
    { id: "7", type: "desp", desc: "sem valor", cat: "outros", date: "2026-11-05" },
  ],
};

test("backup do app atual vira estado: fatura gerada vira valor do banco, categorias migram, benefício sai da conta", () => {
  const { estado: e, resumo: r } = deAppAtual(backup, "2026-11-04");
  assert.equal(r.faturas, 1); assert.equal(r.beneficio, 1); assert.equal(r.semData, 1);
  assert.equal(e.lancamentos.length, 5);
  assert.ok(!e.lancamentos.some(l => /Fatura/.test(l.nome)));
  assert.equal(e.lancamentos.find(l => l.id === "3").nome, "Tênis");
  assert.equal(e.lancamentos.find(l => l.id === "3").cartao, "Inter");
  assert.equal(e.lancamentos.find(l => l.id === "6").cat, "lazer");
  assert.equal(e.lancamentos.find(l => l.id === "6").recorrente, true);
  assert.equal(e.lancamentos.find(l => l.id === "4").cat, "u_pets");
  assert.equal(e.lancamentos.find(l => l.id === "5").pagoCom, "VR");
  assert.equal(e.lancamentos.find(l => l.id === "1").caiu, "2026-10-30");
  assert.equal(e.faturas[0].valorBanco, 90000);
  assert.equal(e.cartoes.VR.tipo, "beneficio");
});

test("números do estado importado (fatura ainda não venceu): fatura = valor do banco, Gastou soma tudo", () => {
  const { estado: e } = deAppAtual(backup, "2026-11-01");
  assert.equal(fatura(e, "Inter", "2026-11").total, 90000);
  assert.equal(fatura(e, "Inter", "2026-11").falta, 70000); // banco 900 − itens lançados 200
  assert.equal(gastou(e, "2026-11"), 90000 + 5000 + 9000);
  assert.equal(naConta(e), 95000); // saldo 1.000 menos a Ração paga depois do saldo
});

test("fatura vencida e não paga rola para a próxima (como o banco)", () => {
  const { estado: e } = deAppAtual(backup, "2026-11-04");
  assert.equal(fatura(e, "Inter", "2026-11").total, 0);
  assert.equal(aPagar(e, "2026-11") >= 0, true);
});
