import { beforeEach, describe, expect, it } from "vitest";
import { conferirSenha, definirSenha, espera, pinOk, removerSenha, temBio, temSenha } from "./senha";

describe("senha local", () => {
  beforeEach(() => { localStorage.clear(); });
  it("só aceita 6 dígitos", () => { expect(pinOk("123456")).toBe(true); expect(pinOk("12345")).toBe(false); expect(pinOk("12345a")).toBe(false); });
  it("cria, confere e remove; não guarda a senha em texto", async () => {
    expect(temSenha()).toBe(false);
    expect(await definirSenha("12345")).toBe(false);
    expect(await definirSenha("246810")).toBe(true);
    expect(temSenha()).toBe(true);
    expect(localStorage.getItem("despesas.react.auth")).not.toContain("246810");
    expect(await conferirSenha("246810")).toBe("ok");
    expect(await conferirSenha("111111")).toBe("errada");
    removerSenha(); expect(temSenha()).toBe(false); expect(temBio()).toBe(false);
  });
  it("5 erros seguidos travam por 30 s e depois liberam", async () => {
    await definirSenha("246810"); const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) expect(await conferirSenha("000000", t0)).toBe("errada");
    expect(await conferirSenha("000000", t0)).toBe("espera");
    expect(espera(t0 + 1000)).toBe(29);
    expect(await conferirSenha("246810", t0 + 1000)).toBe("espera");
    expect(await conferirSenha("246810", t0 + 31000)).toBe("ok");
  });
});
