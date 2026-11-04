import test from "node:test";
import assert from "node:assert/strict";
import { BASICAS, lista, categoria, criar, remover, migrar, MAX_PERSONALIZADAS } from "../base/categorias.mjs";

test("básicas: 10 de despesa e 5 de receita, chaves únicas", () => {
  assert.equal(BASICAS.desp.length, 10);
  assert.equal(BASICAS.rec.length, 5);
  for (const t of ["desp", "rec"]) assert.equal(new Set(BASICAS[t].map(c => c.k)).size, BASICAS[t].length);
});

test("criar: entra na mesma lista, com cor, e é marcada como personalizada", () => {
  const r = criar({}, "desp", "  Pets ", "#112233");
  assert.ok(r.ok);
  assert.equal(r.cat.k, "u_pets");
  const L = lista("desp", r.pers);
  assert.equal(L.length, 11);
  assert.equal(L.at(-1).personalizada, true);
  assert.equal(categoria("desp", "u_pets", r.pers).n, "Pets");
  assert.equal(lista("rec", r.pers).length, 5); // despesa não vaza para receita
});

test("criar: não aceita nome repetido (com ou sem acento/maiúscula), vazio, grande demais nem cor inválida", () => {
  assert.equal(criar({}, "desp", "alimentacao").ok, false);
  assert.equal(criar({}, "desp", "MERCADO").ok, false);
  assert.equal(criar({}, "desp", "   ").ok, false);
  assert.equal(criar({}, "desp", "x".repeat(25)).ok, false);
  assert.equal(criar({}, "desp", "Pets", "azul").ok, false);
  const a = criar({}, "desp", "Pets");
  assert.equal(criar(a.pers, "desp", "pets").ok, false);
});

test("criar: limite de personalizadas por pessoa e chave única mesmo com nomes parecidos", () => {
  let p = {};
  for (let i = 0; i < MAX_PERSONALIZADAS; i++) p = criar(p, "desp", `Cat ${i}`).pers;
  assert.equal(criar(p, "desp", "Mais uma").ok, false);
  const a = criar({}, "desp", "Pet-shop"), b = criar(a.pers, "desp", "Pet shop!");
  assert.ok(b.ok);
  assert.notEqual(a.cat.k, b.cat.k);
});

test("cada pessoa tem as suas: uma lista não enxerga a da outra", () => {
  const ana = criar({}, "desp", "Pets").pers, bia = {};
  assert.equal(lista("desp", ana).length, 11);
  assert.equal(lista("desp", bia).length, 10);
});

test("remover: só personalizada; o lançamento vai para Outros; chave perdida cai em Outros", () => {
  const p = criar({}, "desp", "Pets").pers;
  assert.equal(remover(p, "desp", "alim").ok, false);
  const r = remover(p, "desp", "u_pets");
  assert.ok(r.ok);
  assert.equal(r.moverPara, "outros");
  assert.equal(lista("desp", r.pers).length, 10);
  assert.equal(categoria("desp", "u_pets", r.pers).k, "outros");
  assert.equal(categoria("rec", "sumiu").k, "rout");
});

test("migrar: categorias do app atual passam para a lista nova; cartão e câmbio viram tipo de movimento", () => {
  assert.deepEqual(migrar("desp", "esporte"), { k: "lazer" });
  assert.deepEqual(migrar("desp", "interc"), { k: "outros" });
  assert.deepEqual(migrar("desp", "cartao"), { k: "outros", movimento: "fatura" });
  assert.deepEqual(migrar("desp", "euro"), { k: "outros", movimento: "cambio" });
  assert.deepEqual(migrar("rec", "divid"), { k: "rout" });
  assert.deepEqual(migrar("rec", "d13"), { k: "d13" });
  const p = criar({}, "desp", "Pets").pers;
  assert.deepEqual(migrar("desp", "u_pets", p), { k: "u_pets" });
  assert.deepEqual(migrar("desp", "u_desconhecida", p), { k: "outros" });
});
