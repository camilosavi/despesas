import { beforeEach, describe, expect, it } from "vitest";
import { ofApi, ofAuto, ofBuscar, ofContar, ofExtrato, ofFatura, ofServidor, ofSet, ofSync, dueFix } from "./openfinance";
import { planoExtrato } from "./extrato";
import { vazio } from "./loja";

const CFG = { url: "https://srv.exemplo.workers.dev", key: "chave-de-teste" };
const ITEM = { lastUpdatedAt: "2026-11-09T12:00:00Z", status: "UPDATED" };
const CONTA = { id: "c1", type: "BANK", name: "BANCO INTER", balance: 1234.56 };
const CARTAO = { id: "k1", type: "CREDIT", name: "Cartão Inter", balance: 300, creditData: { creditLimit: 5000, availableCreditLimit: 4000, balanceDueDate: "2026-11-02T12:00:00Z", balanceCloseDate: "2026-10-25T12:00:00Z" } };
const TX_C = [
  { date: "2026-11-05T12:00:00Z", description: "Compra no débito - MERCADO BOM PRECO CIDADE  Bra", amount: -45.9, status: "POSTED" },
  { date: "2026-11-04T12:00:00Z", description: "Pix recebido - Fulano de Tal", amount: 100, status: "POSTED" },
];
const TX_K = [
  { date: "2026-11-03T12:00:00Z", description: "LOJA EXEMPLO", amount: 80, creditCardMetadata: { installmentNumber: 2, totalInstallments: 3 } },
  { date: "2026-11-01T12:00:00Z", description: "ANTIGA", amount: 50, creditCardMetadata: { billId: "b1" } },
  { date: "2026-11-01T12:00:00Z", description: "PAGAMENTO FATURA", amount: -50 },
];
const falso = ((u: string) => {
  const ok = (o: unknown) => Promise.resolve(new Response(JSON.stringify(o)));
  if (u.includes("/item")) return ok(ITEM);
  if (u.includes("/accounts")) return ok({ results: [{ ...CONTA }, { ...CARTAO }] });
  if (u.includes("accountId=c1")) return ok({ results: TX_C });
  if (u.includes("accountId=k1")) return ok({ results: TX_K });
  return Promise.resolve(new Response("{}", { status: 404 }));
}) as unknown as typeof fetch;

const base = () => { const b = vazio(); b.cfg.accts = []; b.cfg.cards = { Inter: { due: 10 } }; return b; };
beforeEach(() => localStorage.clear());

describe("Open Finance", () => {
  it("servidor: só https e chave de 8+", () => {
    expect(ofServidor("srv.exemplo.workers.dev/", "12345678")).toEqual({ ok: true, url: "https://srv.exemplo.workers.dev", key: "12345678" });
    expect(ofServidor("x", "12345678").ok).toBe(false);
    expect(ofServidor("srv.exemplo.dev", "123").ok).toBe(false);
  });
  it("erros do servidor ficam claros", async () => {
    const f = ((() => Promise.resolve(new Response("{}", { status: 401 }))) as unknown) as typeof fetch;
    await expect(ofApi("/x", CFG, f)).rejects.toThrow("chave");
    const g = ((() => Promise.reject(new Error("x"))) as unknown) as typeof fetch;
    await expect(ofApi("/x", CFG, g)).rejects.toThrow("sem conexão");
    const h = ((() => Promise.resolve(new Response(JSON.stringify({ error: "falhou" })))) as unknown) as typeof fetch;
    await expect(ofApi("/x", CFG, h)).rejects.toThrow("falhou");
  });
  it("busca, monta o extrato e a fatura", async () => {
    const v = await ofBuscar("i1", CFG, undefined, falso, Date.parse("2026-11-09T15:00:00Z"));
    expect(v.acc).toHaveLength(2);
    const e = ofExtrato(v, v.acc[0]);
    expect(e.banco).toBe("Inter"); expect(e.saldo).toBe(123456);
    expect(e.linhas.find(l => l.shop)?.shop).toBe("MERCADO BOM PRECO CIDADE");
    expect(e.linhas.find(l => l.cents === 10000)?.who).toBe("Fulano de Tal");
    const f = ofFatura(v, v.acc[1]);
    expect(f.due).toBe("2026-12-02"); expect(f.close).toBe(25);
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]).toMatchObject({ desc: "Loja Exemplo Parc. 2/3", cents: 8000 });
  });
  it("sync: saldo vira a conta, limite livre vira o do cartão, vencimento do banco troca o digitado", async () => {
    const v = await ofBuscar("i1", CFG, undefined, falso, Date.parse("2026-11-09T15:00:00Z"));
    const b = ofSync(base(), v);
    expect(b.cfg.accts[0]).toMatchObject({ name: "Inter", cents: 123456 });
    expect(b.cfg.cards.Inter).toMatchObject({ bankFree: 400000, limit: 500000, due: 2, dueBank: 1, close: 25 });
    expect(ofSync(b, v)).toBe(b); // nada mais novo: não mexe
  });
  it("saldo mais novo no app não é trocado", async () => {
    const v = await ofBuscar("i1", CFG, undefined, falso);
    const b0 = base(); b0.cfg.accts = [{ id: "a1", name: "Inter", cents: 999, at: "2026-11-09", atTs: Date.now() + 1e9 }];
    expect(ofSync(b0, v).cfg.accts[0].cents).toBe(999);
  });
  it("conta o que falta importar", async () => {
    const v = await ofBuscar("i1", CFG, undefined, falso);
    const n = ofContar(ofSync(base(), v), v);
    expect(n.banco).toBe("Inter"); expect(n.ext).toBe(2); expect(n.fat).toBe(1);
    expect(planoExtrato(base(), ofExtrato(v, v.acc[0])).length).toBe(2);
  });
  it("busca sozinha: só a cada 30 min e só se o banco atualizou", async () => {
    ofSet({ ...CFG, items: [{ id: "i1", name: "Meu Pluggy", at: "2026-11-01" }] });
    const t = Date.parse("2026-11-09T15:00:00Z");
    const r = await ofAuto(base(), "", falso, t);
    expect(r?.novo).toMatchObject({ id: "i1", ext: 2, fat: 1 });
    expect(await ofAuto(base(), "", falso, t + 60_000)).toBeNull(); // dentro de 30 min
    localStorage.setItem("despesas.ofAuto", JSON.stringify({ chk: 0, seen: { i1: ITEM.lastUpdatedAt } }));
    expect((await ofAuto(base(), "", falso, t + 9e6))?.novo).toBeNull(); // já visto
  });
  it("dueFix: fim de semana empurrado para segunda não troca", () => {
    expect(dueFix(undefined, "2026-11-10")).toBe(true);
    expect(dueFix(10, "2026-11-10")).toBe(false);
    expect(dueFix(8, "2026-11-10", false)).toBe(true);
    expect(dueFix(7, "2026-11-09", true)).toBe(false); // 7/11/2026 é sábado, 9 é segunda
    expect(dueFix(7, "2026-11-12", true)).toBe(true);
  });
});
