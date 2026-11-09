import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inicio } from "./Inicio";
import { exemplo } from "./dados";
import * as C from "./engine";
import { R } from "./format";

const { estado } = exemplo();
const montar = (onIr = vi.fn()) => { render(<Inicio e={estado} pers={{}} nome="Camilo" onIr={onIr} />); return onIr; };

describe("Início", () => {
  it("mostra os blocos principais com títulos em frase normal", () => {
    montar();
    for (const t of ["Saldo total", "Resumo do mês", "Fluxo de caixa", "Gastos", "Cartões", "Últimas transações"])
      expect(screen.getByRole("region", { name: new RegExp(t) })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Olá, Camilo/ })).toBeInTheDocument();
  });
  it("os números vêm da base, não de soma na tela", () => {
    montar();
    const ym = C.mesDe(estado.hoje);
    const resumo = screen.getByRole("region", { name: /Resumo do mês/ });
    // novembro do exemplo: Salário 5.600,00 + Freela 450,00 = 6.050,00 (conta feita à mão)
    expect(within(resumo).getByText("R$ 6.050,00")).toBeInTheDocument();
    expect(C.entrou(estado, ym)).toBe(605000);
    expect(within(screen.getByRole("region", { name: /Saldo total/ })).getByText(R(C.naConta(estado)))).toBeInTheDocument();
  });
  it("a legenda dos gastos traz valor (cor nunca é a única informação) e a rosca tem texto", () => {
    montar();
    const g = screen.getByRole("region", { name: /Gastos/ });
    expect(within(g).getByRole("img", { name: /Gastos por categoria/ })).toBeInTheDocument();
    expect(g.querySelectorAll(".dleg li").length).toBeGreaterThan(1);
    expect(within(g).getAllByText(/R\$ /).length).toBeGreaterThan(1);
  });
  it("o fluxo de caixa tem tabela equivalente para leitor de tela", () => {
    montar();
    const t = screen.getByRole("table", { name: /Entrou e gastou por mês/ });
    expect(within(t).getAllByRole("row")).toHaveLength(7); // cabeçalho + 6 meses
  });
  it("todo botão tem nome e chama o destino certo", async () => {
    const onIr = montar();
    for (const b of screen.getAllByRole("button")) expect(b).toHaveAccessibleName();
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver cartões" }));
    expect(onIr).toHaveBeenNthCalledWith(1, "lancar-desp");
    expect(onIr).toHaveBeenNthCalledWith(2, "cartoes");
  });
  it("Nota de saúde só aparece quando há o que dizer", () => {
    const limpo = { ...estado, lancamentos: estado.lancamentos.filter(l => l.tipo === "rec"), faturas: [], cartoes: {} };
    render(<Inicio e={limpo} pers={{}} nome="" onIr={() => {}} />);
    expect(screen.queryByRole("region", { name: /Nota de saúde/ })).not.toBeInTheDocument();
  });
});
