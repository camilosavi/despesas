import { describe, expect, it } from "vitest";
import { aplicarExtrato, chutarCategoria, contaDoExtrato, extRow, lerCsvInter, lerOfx, planoExtrato } from "./extrato";
import { vazio } from "./loja";
import type { Backup } from "./loja";

const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>077<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261105
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261102<TRNAMT>-45,90<MEMO>Compra no debito: "No estabelecimento SUPERMERCADO BOM PRECO"<NAME>X</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261103<TRNAMT>120,00<MEMO>Pix recebido: "Cp :12345678-MARIA SOUZA"<NAME>MARIA SOUZA DA SILVA</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261104<TRNAMT>-80,00<MEMO>Pix enviado: "Cp :99999999-CAMILO TESTE"<NAME>CAMILO TESTE</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261104<TRNAMT>5000,00<MEMO>Credito liberado: "Pix no Credito"<NAME></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261104<TRNAMT>-5000,00<MEMO>Pix enviado: "Cp :11111111-LOJA XYZ"<NAME>LOJA XYZ</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>1234,56<DTASOF>20261105120000</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("extrato OFX/CSV", () => {
  it("OFX do Inter: banco, saldo, período, loja, quem, Pix no crédito dos dois lados", () => {
    const r = lerOfx(OFX, "2026-11-06"); expect(r.ok).toBe(true); if (!r.ok) return;
    const e = r.extrato;
    expect(e).toMatchObject({ banco: "Inter", saldo: 123456, de: "2026-10-01", ate: "2026-11-05", at: "2026-11-05" });
    expect(e.atTs).toBe(new Date(2026, 10, 5, 12, 0).getTime());
    expect(e.linhas[0]).toMatchObject({ cents: -4590, shop: "SUPERMERCADO BOM PRECO", who: "" });
    expect(e.linhas[1]).toMatchObject({ cents: 12000, who: "MARIA SOUZA DA SILVA" });
    expect(e.linhas[3].pixCred && e.linhas[4].pixCred).toBe(true);
  });
  it("OFX de cartão e sem movimentos são recusados com aviso", () => {
    expect(lerOfx("<OFX><CCSTMTRS></OFX>", "2026-11-06")).toMatchObject({ ok: false });
    expect(lerOfx("OFXHEADER:100 <OFX><BANKID>077</OFX>", "2026-11-06")).toMatchObject({ ok: false });
  });
  it("CSV do Inter: cabeçalho, vírgula decimal, loja cortada em 22 letras, período e saldo", () => {
    const csv = `Extrato Conta Corrente\nConta;123\nPeríodo;01/10/2026 a 05/11/2026\nSaldo;1.234,56\n\nData Lançamento;Histórico;Descrição;Valor;Saldo\n02/11/2026;Compra no débito;SUPERMERCADO BOM PRECO SAO PAULO;-45,90;100,00\n03/11/2026;Pix recebido;MARIA SOUZA;120,00;220,00\n`;
    const r = lerCsvInter(csv); expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.extrato).toMatchObject({ banco: "Inter", saldo: 123456, de: "2026-10-01", ate: "2026-11-05" });
    expect(r.extrato.linhas[0]).toMatchObject({ cents: -4590, shop: "SUPERMERCADO BOM PRECO" });
    expect(r.extrato.linhas[1]).toMatchObject({ cents: 12000, who: "MARIA SOUZA" });
    expect(lerCsvInter("a;b;c")).toMatchObject({ ok: false });
  });
  it("plano: lança compra e Pix, ignora Pix no crédito e o próprio titular, marca como pago e reconhece o já lançado", () => {
    const e = (lerOfx(OFX, "2026-11-06") as { ok: true; extrato: import("./extrato").Extrato }).extrato;
    const b: Backup = { ...vazio(), items: [
      { id: "p", type: "desp", desc: "Mercado", cat: "merc", cents: 4590, date: "2026-11-02", pay: "Pix", paid: false, createdAt: 1 },
      { id: "q", type: "rec", desc: "Maria", cat: "rout", cents: 12000, date: "2026-11-03", pay: "Pix", paid: true, createdAt: 1 }] };
    const p = planoExtrato(b, e, "Camilo Teste");
    expect(p[0]).toMatchObject({ acao: "pay", on: true, match: "p" });
    expect(p[1]).toMatchObject({ acao: "done", match: "q" });
    expect(p[2]).toMatchObject({ acao: "skip", nota: "transferência para outra conta sua" });
    expect(p[3].acao).toBe("skip"); expect(p[4].acao).toBe("skip");
    const b2 = vazio(); const p2 = planoExtrato(b2, e, "Camilo Teste");
    expect(p2[0]).toMatchObject({ acao: "add", on: true, desc: "Supermercado Bom Preco", cat: "merc", pay: "Débito" });
    expect(p2[1]).toMatchObject({ acao: "add", desc: "Pix de Maria Souza Da Silva", cat: "rout", pay: "Pix" });
  });
  it("aplicar: lança, marca pago, atualiza o saldo, não repete (imp) e não mexe no saldo se o do app é mais novo", () => {
    const e = (lerOfx(OFX, "2026-11-06") as { ok: true; extrato: import("./extrato").Extrato }).extrato;
    let b: Backup = { ...vazio(), cfg: { accts: [{ id: "a", name: "Inter", cents: 1, at: "2026-10-01", atTs: 5 }, { id: "b", name: "Nubank", cents: 1, at: "2026-10-01", atTs: 5 }], cards: {}, name: "Camilo Teste" } };
    const r = aplicarExtrato(b, e, planoExtrato(b, e, "Camilo Teste"), true, 1000);
    expect(r.n).toBe(3); expect(r.backup.items).toHaveLength(2); expect(r.backup.cfg.transf).toHaveLength(1);
    expect(r.backup.items[0]).toMatchObject({ desc: "Supermercado Bom Preco", paid: true, acct: "Inter", imp: expect.stringContaining("extrato-Inter-2026-11-02") });
    expect(r.backup.items[0].paidAt).toBe(new Date("2026-11-02T00:00:00").getTime());
    expect((r.backup.cfg.accts as { name: string; cents: number; atTs: number }[]).find(a => a.name === "Inter")).toMatchObject({ cents: 123456, atTs: e.atTs });
    expect(planoExtrato(r.backup, e, "Camilo Teste").filter(x => x.acao === "add")).toHaveLength(0);
    b = { ...r.backup, cfg: { ...r.backup.cfg, accts: [{ id: "a", name: "Inter", cents: 9, at: "2026-11-06", atTs: e.atTs + 1000 }] } };
    expect((aplicarExtrato(b, e, [], true, 2).backup.cfg.accts as { cents: number }[])[0].cents).toBe(9);
  });
  it("transferência entre contas suas vira cfg.transf (sem lançamento) quando há outra conta", () => {
    const e = (lerOfx(OFX, "2026-11-06") as { ok: true; extrato: import("./extrato").Extrato }).extrato;
    const b: Backup = { ...vazio(), cfg: { accts: [{ id: "a", name: "Inter", cents: 1 }, { id: "b", name: "Nubank", cents: 1 }], cards: {} } };
    const p = planoExtrato(b, e, "Camilo Teste"); expect(p[2]).toMatchObject({ acao: "transf", on: true, outra: "Nubank", de: "Inter" });
    const r = aplicarExtrato(b, e, p, false, 7);
    expect(r.backup.cfg.transf).toEqual([expect.objectContaining({ from: "Inter", to: "Nubank", cents: 8000, imp: expect.stringContaining("extrato-Inter-2026-11-04--8000") })]);
  });
  it("helpers: extRow, conta do extrato e chute de categoria", () => {
    expect(extRow("2026-11-01", -100, "Pix enviado", "Cp :12345678-FULANO").who).toBe("FULANO");
    expect(contaDoExtrato(vazio(), "Inter")).toEqual({ nome: "Inter", existe: false });
    expect(chutarCategoria("Posto Shell Centro")).toBe("transp"); expect(chutarCategoria("Loja X")).toBe("");
  });
});
