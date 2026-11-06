import { exemplo, lerBackup } from "./dados";
import * as C from "./engine";
import { cartoes, detalhe, ehTaxa, posso, resumoCartoes, restam } from "./cartoes";

const b = { app: "minhas-despesas", v: 1, fx: [], cfg: { cards: { Inter: { due: 10, limit: 500000 } } }, items: [
  { id: "a", type: "desp", desc: "Inter · Tênis", cat: "compras", cents: 10000, date: "2026-11-10", pay: "Crédito", card: "Inter", paid: false, parc: "3/10" },
  { id: "b", type: "desp", desc: "Inter · IOF", cat: "cartao", cents: 500, date: "2026-11-10", pay: "Crédito", card: "Inter", paid: false },
  { id: "c", type: "desp", desc: "Inter · Livro", cat: "compras", cents: 2000, date: "2026-12-10", pay: "Crédito", card: "Inter", paid: false },
] };
const e = () => lerBackup(JSON.stringify(b), "2026-11-06").estado;

describe("cartões", () => {
  it("total do detalhe = fatura do motor, itens somam o lançado", () => {
    const est = e(), d = detalhe(est, "Inter", "2026-11");
    expect(d.total).toBe(C.fatura(est, "Inter", "2026-11").total);
    expect(d.itens.reduce((s, x) => s + x.cents, 0)).toBe(10500);
    expect(d.parcelas.map(x => x.parcela)).toEqual(["3/10"]);
    expect(d.taxas).toBe(500);
  });
  it("resumo soma só faturas em aberto e próximas faturas seguem o motor", () => {
    const est = e(), r = resumoCartoes(est), L = cartoes(est);
    expect(r.aberto).toBe(L.reduce((s, x) => s + (x.paga ? 0 : x.total), 0));
    expect(detalhe(est, "Inter", "2026-11").prox[0]).toMatchObject({ ym: "2026-12", total: 2000 });
  });
  it("auxiliares", () => {
    expect(restam("3/10")).toBe(7); expect(restam(undefined)).toBe(0);
    expect(ehTaxa("IOF do Pix no crédito")).toBe(true); expect(ehTaxa("Anuidade")).toBe(true); expect(ehTaxa("Mercado")).toBe(false);
  });
  it("posso comprar não muda nada e avisa quando passa do limite", () => {
    const est = e(), antes = JSON.stringify(est);
    const p = posso(est, "Inter", 100000, 2);
    expect(p.meses).toHaveLength(2); expect(p.passa).toBe(false);
    expect(posso(est, "Inter", 99999999, 1).passa).toBe(true);
    expect(JSON.stringify(est)).toBe(antes);
  });
  it("exemplo carrega sem erro", () => { expect(() => cartoes(exemplo().estado)).not.toThrow(); });
});
