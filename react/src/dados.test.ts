import { exemplo, lerBackup } from "./dados";
import * as C from "./engine";

const item = (o: Record<string, unknown>) => ({ pay: "Pix", paid: true, createdAt: 1, ...o });

describe("ler backup do app atual", () => {
  it("lê lançamentos e calcula pela base", () => {
    const b = { app: "minhas-despesas", v: 1, items: [
      item({ type: "rec", desc: "Salário", cat: "sal", cents: 300000, date: "2026-11-05" }),
      item({ type: "desp", desc: "Mercado", cat: "merc", cents: 45000, date: "2026-11-06" }),
    ], fx: [], cfg: { name: "Teste" } };
    const c = lerBackup(JSON.stringify(b), "2026-11-10");
    expect(c.erro).toBeUndefined();
    expect(c.real).toBe(true);
    expect(c.nome).toBe("Teste");
    expect(C.entrou(c.estado, "2026-11")).toBe(300000);
    expect(C.gastou(c.estado, "2026-11")).toBe(45000);
    expect(C.sobra(c.estado, "2026-11")).toBe(255000);
  });
  it("arquivo errado volta ao exemplo com o motivo", () => {
    const c = lerBackup("{\"foo\":1}", "2026-11-10");
    expect(c.real).toBe(false);
    expect(c.erro).toMatch(/lista de lançamentos/);
  });
  it("texto que não é JSON também não quebra", () => {
    expect(lerBackup("isto não é json", "2026-11-10").erro).toBeTruthy();
  });
  it("o exemplo é só dados inventados", () => {
    expect(exemplo().estado.contas[0].nome).toBe("Conta principal");
  });
});

describe("parcela vinda do backup", () => {
  it("guarda 'i/n' no lançamento do cartão e ignora texto estranho", () => {
    const b = { app: "minhas-despesas", v: 1, fx: [], cfg: { cards: { Inter: { due: 10 } } }, items: [
      { id: "a", type: "desp", desc: "Inter · Tênis", cat: "compras", cents: 1000, date: "2026-11-10", pay: "Crédito", card: "Inter", paid: false, parc: "3/10" },
      { id: "b", type: "desp", desc: "Inter · Livro", cat: "compras", cents: 500, date: "2026-11-10", pay: "Crédito", card: "Inter", paid: false, parc: "x" },
    ] };
    const c = lerBackup(JSON.stringify(b), "2026-11-06");
    const l = c.estado.lancamentos;
    expect(l.find(x => x.id === "a")?.parcela).toBe("3/10");
    expect(l.find(x => x.id === "b")?.parcela).toBeUndefined();
  });
});
