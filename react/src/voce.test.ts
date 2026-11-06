import { beforeEach, describe, expect, it } from "vitest";
import { aplicarVisual, csvLancamentos, guardarVisual, lerVisual, nomeDe, salvarNome, zerarLancamentos } from "./voce";
import { vazio } from "./loja";
import type { Backup } from "./loja";

const com = (): Backup => ({ ...vazio(), items: [
  { id: "a", type: "desp", desc: "Mercado; \"da esquina\"", cat: "mercado", cents: 12345, date: "2026-11-02", pay: "Pix", paid: true, createdAt: 1 },
  { id: "b", type: "rec", desc: "=SOMA(A1)", cat: "sal", cents: 500000, date: "2026-10-30", pay: "Pix", paid: true, createdAt: 2 },
], cfg: { accts: [{ name: "Nu", cents: 100 }], cards: { Inter: { due: 10 } }, transf: [{ id: "t" }], save: [{ id: "c", name: "x", moves: [] }], name: "Ana" } });

describe("Você", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("data-accent"); });
  it("visual: padrão, guarda e aplica; valor inválido volta ao padrão", () => {
    expect(lerVisual()).toEqual({ modo: "auto", cor: "tostao" });
    guardarVisual({ modo: "dark", cor: "verde" });
    expect(lerVisual()).toEqual({ modo: "dark", cor: "verde" });
    aplicarVisual(lerVisual());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.accent).toBe("verde");
    aplicarVisual({ modo: "auto", cor: "tostao" });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
    localStorage.setItem("despesas.react.visual", JSON.stringify({ modo: "x", cor: "y" }));
    expect(lerVisual()).toEqual({ modo: "auto", cor: "tostao" });
  });
  it("nome: salva sem espaços nas pontas e limita o tamanho", () => {
    expect(nomeDe(com())).toBe("Ana");
    expect(nomeDe(salvarNome(com(), "  Bia  "))).toBe("Bia");
    expect(nomeDe(salvarNome(com(), "x".repeat(60))).length).toBe(40);
  });
  it("zerar: tira lançamentos, contas e transferências; mantém cartões, caixinhas e nome", () => {
    const z = zerarLancamentos(com());
    expect(z.items).toEqual([]); expect(z.cfg.accts).toEqual([]); expect(z.cfg.transf).toEqual([]);
    expect(z.cfg.cards.Inter.due).toBe(10); expect(z.cfg.save).toHaveLength(1); expect(z.cfg.name).toBe("Ana");
  });
  it("CSV: BOM, ; , vírgula decimal, aspas duplicadas e proteção contra fórmula", () => {
    const t = csvLancamentos(com());
    expect(t.startsWith("﻿Data;Tipo")).toBe(true);
    const l = t.split("\r\n");
    expect(l[1]).toContain("2026-10-30;Receita;'=SOMA(A1);sal;5000,00");
    expect(l[2]).toContain('"Mercado; ""da esquina"""');
    expect(l[2]).toContain(";123,45;");
  });
});
