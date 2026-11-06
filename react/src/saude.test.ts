import { notaDeSaude, saudeVisivel } from "./saude";
import type { Estado } from "./engine";

const base = (lancamentos: Estado["lancamentos"]): Estado => ({ hoje: "2026-11-10", lancamentos, contas: [], cartoes: {}, faturas: [], ajustes: [] });
const rec = (cents: number): Estado["lancamentos"][number] => ({ id: "r", nome: "Salário", tipo: "rec", cents, data: "2026-11-01" });
const desp = (cents: number): Estado["lancamentos"][number] => ({ id: "d", nome: "Aluguel", tipo: "desp", cents, data: "2026-11-02", pago: true });

describe("nota de saúde", () => {
  it("sem nada a dizer = 100 e o bloco some", () => {
    const s = notaDeSaude(base([rec(500000), desp(100000)]));
    expect(s.score).toBe(100);
    expect(s.motivos).toEqual([]);
    expect(saudeVisivel(s)).toBe(false);
  });
  it("gastar mais do que entrou tira 35 e explica", () => {
    const s = notaDeSaude(base([rec(100000), desp(150000)]));
    expect(s.score).toBe(65);
    expect(s.motivos).toContain("gastou mais do que entrou no mês");
    expect(s.rotulo).toBe("Boa");
    expect(saudeVisivel(s)).toBe(true);
  });
  it("sobra abaixo de 10% tira 15", () => {
    const s = notaDeSaude(base([rec(100000), desp(95000)]));
    expect(s.score).toBe(85);
    expect(s.motivos).toEqual(["sobra pequena"]);
  });
});
