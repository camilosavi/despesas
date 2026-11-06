import { lerBackup } from "./dados";
import { movimentos } from "./movimentos";
import * as C from "./engine";

const b = { app: "minhas-despesas", v: 1, fx: [], cfg: { accts: [{ id: "a", name: "Nubank", cents: 100000, at: "2026-11-01" }, { id: "b", name: "Cofre", cents: 5000, at: "2026-11-01" }] }, items: [
  { id: "1", type: "rec", desc: "Freela", cat: "outros", cents: 30000, date: "2026-11-04", pay: "Pix", paid: true, createdAt: Date.parse("2026-11-04T12:00:00") },
  { id: "2", type: "desp", desc: "Mercado", cat: "mercado", cents: 12000, date: "2026-11-05", pay: "Pix", paid: true, paidAt: Date.parse("2026-11-05T12:00:00"), createdAt: 1 },
  { id: "3", type: "desp", desc: "Luz", cat: "casa", cents: 9000, date: "2026-11-20", pay: "Boleto", paid: false, createdAt: 1 },
] };
describe("movimentos da conta", () => {
  it("último saldo = saldo da conta no motor, linhas do mais novo ao mais antigo", () => {
    const e = lerBackup(JSON.stringify(b), "2026-11-06").estado;
    for (const c of ["Nubank", "Cofre"]) { const m = movimentos(e, c); expect(m.atual).toBe(C.saldoDaConta(e, c)); expect((m.linhas[0]?.saldoApos ?? m.informado)).toBe(m.atual); }
    const m = movimentos(e, "Nubank");
    expect(m.linhas.map(x => x.nome)).toEqual(expect.arrayContaining(["Freela", "Mercado"]));
    expect(m.linhas.some(x => x.nome === "Luz")).toBe(false);
  });
});
