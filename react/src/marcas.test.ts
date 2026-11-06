import { describe, expect, it } from "vitest";
import { marcaDe } from "./marcas";

describe("marcas (copiadas do app atual)", () => {
  it("banco conhecido tem cor e logo; o nome casa como no app", () => {
    const n = marcaDe("Nubank"), i = marcaDe("Banco Inter"), r = marcaDe("Realize");
    expect(n.cor).toBe("#820AD1"); expect(n.logo).toContain("<svg");
    expect(i.cor).toBe("#FF5A00"); expect(i.logo).toContain("<img");
    expect(r.cor).toBe("#E31E24");
  });
  it("sem banco conhecido vira sigla na cor neutra; cor escolhida vence", () => {
    const x = marcaDe("Cofre");
    expect(x.logo).toBeNull(); expect(x.rotulo).toBe("Cofre"); expect(x.cor).toBe("#6B7A75");
    const e = { cartoes: { Cofre: { cor: "#123456" } } } as never;
    expect(marcaDe("Cofre", e).cor).toBe("#123456");
  });
  it("todo banco da lista tem logo ou sigla", () => {
    for (const nome of ["Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Caixa", "Santander", "C6", "Mercado Pago", "PicPay", "BTG", "XP", "Pan", "Revolut", "Wise"]) {
      const m = marcaDe(nome); expect(m.logo || m.rotulo).toBeTruthy();
    }
  });
});
