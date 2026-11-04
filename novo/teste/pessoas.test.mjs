import test from "node:test";
import assert from "node:assert/strict";
import { partes, suaParte, saldoDe, saldosPorPessoa, aReceber, aDever, devidoNoMes, extrato } from "../base/pessoas.mjs";

const desp = (id, cents, data, divide, o = {}) => ({ id, nome: id, tipo: "desp", cents, data, divide, ...o });

test("partes iguais contam você: 2 pessoas = 3 partes; centavo que sobra fica com você", () => {
  const l = desp("a", 10000, "2026-11-10", { com: [{ pessoa: "Ana" }, { pessoa: "Bia" }] });
  assert.deepEqual(partes(l), [{ pessoa: "Ana", cents: 3333 }, { pessoa: "Bia", cents: 3333 }]);
  assert.equal(suaParte(l), 3334);
});

test("valor combinado por pessoa; passar do total corta do último", () => {
  const l = desp("a", 5000, "2026-11-10", { com: [{ pessoa: "Ana", cents: 2000 }, { pessoa: "Bia", cents: 4000 }] });
  assert.deepEqual(partes(l), [{ pessoa: "Ana", cents: 2000 }, { pessoa: "Bia", cents: 3000 }]);
  assert.equal(suaParte(l), 0);
});

test("sem divisão, receita ou lista vazia: sem partes e a parte é tudo sua", () => {
  assert.deepEqual(partes(desp("a", 1000, "2026-11-01")), []);
  assert.deepEqual(partes({ tipo: "rec", cents: 1000, divide: { com: [{ pessoa: "Ana" }] } }), []);
  assert.equal(suaParte(desp("a", 1000, "2026-11-01")), 1000);
});

test("saldo: lançamentos menos o que a pessoa já pagou; pagar a mais vira dívida sua", () => {
  const e = { lancamentos: [
    desp("stream", 4000, "2026-10-12", { com: [{ pessoa: "Ana" }, { pessoa: "Bia" }] }, { recorrente: true }),
    desp("stream2", 4000, "2026-11-12", { com: [{ pessoa: "Ana" }, { pessoa: "Bia" }] }, { recorrente: true }),
    desp("jantar", 9000, "2026-11-03", { com: [{ pessoa: "Ana" }] }),
  ], acertos: [{ id: "x", pessoa: "Ana", cents: 1333, data: "2026-11-02" }, { id: "y", pessoa: "Bia", cents: 3000, data: "2026-11-02" }] };
  assert.equal(saldoDe(e, "Ana"), 1333 + 1333 + 4500 - 1333);
  assert.equal(saldoDe(e, "Bia"), 2666 - 3000);
  assert.equal(aReceber(e), 5833 + 0);
  assert.equal(aDever(e), 334);
  assert.equal(devidoNoMes(e, "Ana", "2026-11"), 1333 + 4500);
  assert.equal(saldosPorPessoa(e)[0].pessoa, "Ana");
});

test("extrato: lançamentos e acertos por data, saldo bate com a soma", () => {
  const e = { lancamentos: [desp("a", 6000, "2026-11-03", { com: [{ pessoa: "Ana" }] })], acertos: [{ id: "x", pessoa: "Ana", cents: 1000, data: "2026-11-05" }] };
  const ex = extrato(e, "Ana");
  assert.equal(ex.length, 2);
  assert.equal(ex.reduce((s, x) => s + x.cents, 0), saldoDe(e, "Ana"));
});
