import { describe, expect, it } from "vitest";
import { aplicarFatura, aplicarHolerite, classificar, extratoDoPdf, planoFatura, planoHolerite, rascunhoDaConta } from "./fatura";
import type { Backup } from "./loja";
import type { Fatura, Holerite, Pagina } from "./leitores/pdf.js";

let n = 0; const id = () => "t" + ++n;
const base = (): Backup => ({ app: "minhas-despesas", v: 1, items: [], fx: [], cfg: { accts: [], cards: { Inter: { due: 10, color: "#f60" } } } });
const fat = (over: Partial<Fatura> = {}): Fatura => ({
  bank: "Inter", due: "2026-12-10", total: 30000, close: 3,
  rows: [
    { date: "2026-11-02", desc: "MERCADO BOM PRECO", shop: "", cents: 12000 },
    { date: "2026-11-05", desc: "LOJA X Parc 1/3", shop: "", cents: 15000, parc: "1/3" } as never,
    { date: "2026-11-09", desc: "Saldo da fatura anterior", shop: "", cents: 3000, prev: true },
  ], ...over,
});

describe("fatura em PDF", () => {
  it("planeja: compras novas, parcelas seguintes e total do banco", () => {
    const p = planoFatura(base(), fat(), "Inter");
    expect(p.bill).toBe("2026-12");
    expect(p.linhas.map(l => l.acao)).toEqual(["add", "add", "add"]);
    expect(p.linhas[1].depois.map(d => d.ym)).toEqual(["2027-01", "2027-02"]);
    expect(p.soma).toBe(30000);
    expect(p.linhas[2].name).toBe("Saldo da fatura anterior");
  });
  it("aplica: itens no vencimento, Fatura X com o total, parcelas futuras no mesmo grupo", () => {
    const b = base(), p = planoFatura(b, fat(), "Inter");
    const r = aplicarFatura(b, p, 1, id, "2026-11-09");
    const it = r.backup.items;
    expect(r.nAdd).toBe(5);
    expect(it.filter(x => x.imp === "fatura-2026-12-10").length).toBe(3);
    const g = it.find(x => x.cat === "cartao" && /^Fatura /.test(x.desc))!;
    expect(g.cents).toBe(30000); expect(g.date).toBe("2026-12-10");
    const parcs = it.filter(x => x.parc);
    expect(parcs.map(x => x.parc).sort()).toEqual(["1/3", "2/3", "3/3"]);
    expect(new Set(parcs.map(x => x.group)).size).toBe(1);
    expect(parcs.every(x => x.paid === false && x.card === "Inter" && x.pay === "Crédito")).toBe(true);
  });
  it("importar de novo não duplica: tudo vira 'já lançado'", () => {
    const b = base(), p = planoFatura(b, fat(), "Inter");
    const b2 = aplicarFatura(b, p, 1, id, "2026-11-09").backup, p2 = planoFatura(b2, fat(), "Inter");
    expect(p2.jaImportada).toBe(true);
    expect(p2.linhas.filter(l => l.acao === "add").length).toBe(0);
    expect(p2.linhas.filter(l => l.acao === "done").length).toBe(3);
  });
  it("junta com o que foi lançado à mão (fica o valor e o nome do banco)", () => {
    const b = base();
    b.items.push({ id: "m1", type: "desp", desc: "mercado", cat: "merc", cents: 12000, date: "2026-12-10", pay: "Crédito", paid: false, createdAt: 1, card: "Inter", buy: "2026-11-02" });
    const p = planoFatura(b, fat(), "Inter");
    expect(p.linhas[0].acao).toBe("merge");
    const r = aplicarFatura(b, p, 1, id, "2026-11-09");
    expect(r.nMerge).toBe(1);
    const m = r.backup.items.find(x => x.id === "m1")!;
    expect(m.desc).toBe(p.linhas[0].name); expect(m.imp).toBe("fatura-2026-12-10");
  });
  it("fatura antiga (antes de out/2026) só lança as parcelas que vêm depois, a menos que peça a inteira", () => {
    const f = fat({ due: "2026-09-10" });
    const p = planoFatura(base(), f, "Inter");
    expect(p.velha).toBe(true);
    expect(p.linhas.filter(l => l.on).length).toBe(1);
    const r = aplicarFatura(base(), p, 1, id, "2026-11-09");
    expect(r.backup.items.every(x => x.parc && x.parc !== "1/3")).toBe(true);
    const c = planoFatura(base(), f, "Inter", true);
    expect(c.velha).toBe(false); expect(c.linhas.every(l => l.on)).toBe(true);
  });
  it("sem vencimento no PDF: estima pelo dia do cartão e avisa", () => {
    const p = planoFatura(base(), fat({ due: undefined }), "Inter");
    expect(p.estimado).toBe(true); expect(p.due).toBe("2026-11-10");
  });
  it("vencimento do banco troca o dia do cartão", () => {
    const b = base(), p = planoFatura(b, fat({ due: "2026-12-14" }), "Inter");
    expect(aplicarFatura(b, p, 1, id, "2026-11-09").backup.cfg.cards.Inter.due).toBe(14);
  });
});

describe("holerite em PDF", () => {
  const h: Holerite = { kind: "Salário", cents: 500000, date: "2026-11-30", ref: "2026-11", emp: "Empresa", tp: 600000, td: 100000, ev: [{ desc: "HORAS NORMAIS", cents: 600000, side: "p" }, { desc: "INSS", cents: 100000, side: "d" }], conv: null, check: true };
  it("lança a receita (salário do fim do mês conta no dia 1º) e guarda em cfg.hol", () => {
    const b = base(), p = planoHolerite(b, h);
    const r = aplicarHolerite(b, p, "Salário", h.date, null, 1, id);
    const x = r.items[0];
    expect(x.date).toBe("2026-12-01"); expect(x.fell).toBe("2026-11-30"); expect(x.cat).toBe("sal"); expect(x.imp).toBe("holerite-2026-11-Salário");
    expect((r.cfg.hol as Record<string, { liq: number }>)["2026-11|sal"].liq).toBe(500000);
  });
  it("avisa quando já foi importado e troca em vez de duplicar", () => {
    const b = aplicarHolerite(base(), planoHolerite(base(), h), "Salário", h.date, null, 1, id);
    const p = planoHolerite(b, h);
    expect(p.mesmo).toBe(true);
    const r = aplicarHolerite(b, p, "Salário", h.date, p.igual!.id, 2, id);
    expect(r.items.length).toBe(1);
  });
  it("13º vai para a categoria própria", () => {
    const h13 = { ...h, kind: "13º salário (1ª parcela)", date: "2026-11-20" };
    expect(aplicarHolerite(base(), planoHolerite(base(), h13), h13.kind, h13.date, null, 1, id).items[0].cat).toBe("d13");
  });
});

describe("outros PDFs", () => {
  const pag = (linhas: string[]): Pagina => ({ h: 800, w: 600, items: linhas.map((s, i) => ({ s, x: 40, w: 200, t: 40 + i * 14 })) });
  it("PDF desconhecido dá aviso claro", () => {
    const r = classificar([pag(["nada a ver"])]);
    expect(r.tipo).toBe("erro");
  });
  it("conta de consumo: vencimento e valor, débito automático vira débito", () => {
    const r = classificar([pag(["Claro S/A", "Vencimento 10/12/2026", "Total a pagar R$ 123,45", "Débito Automático"])]);
    if (r.tipo === "conta") { const d = rascunhoDaConta(r.c); expect(d.cents).toBe(12345); expect(d.pay).toBe("Débito"); } else expect(["conta", "erro"]).toContain(r.tipo);
  });
  it("extrato em PDF vira o mesmo objeto do OFX", () => {
    const e = extratoDoPdf({ bank: "Inter", at: "2026-11-09", atTs: 1, bal: 1000, holder: "", rows: [{ date: "2026-11-08", cents: -500, kind: "Pix enviado", det: "x", who: "Fulano", shop: "" }], from: "2026-10-01", to: "2026-11-09" });
    expect(e.banco).toBe("Inter"); expect(e.saldo).toBe(1000); expect(e.linhas[0].cents).toBe(-500);
  });
});
