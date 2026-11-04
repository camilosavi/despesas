// Dados INVENTADOS só para ver a tela. Nada pessoal.
const T = s => Date.parse(s);
export const demo = {
  hoje: "2026-11-04", inicio: "2026-09-01",
  contas: [{ nome: "Conta principal", cents: 700050, em: T("2026-11-02T12:00:00Z") }],
  cartoes: { Roxinho: { venc: 8, limite: 400000 }, Lojinha: { venc: 15, limite: 150000 }, VR: { tipo: "beneficio" } },
  faturas: [
    { cartao: "Roxinho", ym: "2026-10", valorBanco: 182000, importada: true, paga: true, pagaEm: T("2026-10-08T12:00:00Z") },
    { cartao: "Roxinho", ym: "2026-11", valorBanco: 214500, importada: true },
    { cartao: "Lojinha", ym: "2026-11", valorBanco: 38000, importada: true },
  ],
  ajustes: [],
  lancamentos: [],
};
let n = 0;
const add = (tipo, nome, cents, data, cat, o = {}) => demo.lancamentos.push({ id: "d" + ++n, nome, tipo, cents, data, cat, ...(tipo === "desp" ? { pago: true } : {}), ...o });
// meses anteriores (fluxo)
const meses = [["2026-09", 520000, 410000], ["2026-10", 548000, 463000]];
for (const [m, r, d] of meses) { add("rec", "Salário", r, m + "-30", "sal"); add("desp", "Aluguel", Math.round(d * .4), m + "-05", "casa"); add("desp", "Mercado do mês", Math.round(d * .25), m + "-12", "merc"); add("desp", "Fatura Roxinho", Math.round(d * .35), m + "-08", "compras", { cartao: "Roxinho" }); }
// novembro
add("rec", "Salário", 560000, "2026-11-01", "sal", { caiu: "2026-10-30" });
add("rec", "Freela", 45000, "2026-11-03", "extra");
add("desp", "Aluguel", 180000, "2026-11-05", "casa", { pago: false });
add("desp", "Internet", 9990, "2026-11-10", "casa", { pago: false });
add("desp", "Supermercado", 32450, "2026-11-02", "merc");
add("desp", "Farmácia", 8790, "2026-11-03", "saude");
add("desp", "Almoço", 4200, "2026-11-04", "alim");
add("desp", "Streaming", 3990, "2026-11-12", "assin", { pago: false, cartao: "Roxinho", recorrente: true, divide: { com: [{ pessoa: "Ana" }, { pessoa: "Bia" }] } });
add("desp", "Jantar", 9000, "2026-11-03", "alim", { divide: { com: [{ pessoa: "Ana" }] } });
demo.acertos = [{ id: "a1", pessoa: "Ana", cents: 1330, data: "2026-11-02" }];
add("desp", "Tênis", 29900, "2026-11-08", "compras", { pago: false, cartao: "Roxinho", compra: "2026-10-20" });
add("desp", "Combustível", 15000, "2026-11-08", "transp", { pago: false, cartao: "Roxinho" });
add("desp", "Camiseta", 12000, "2026-11-15", "compras", { pago: false, cartao: "Lojinha" });
add("desp", "Vale-refeição", 18000, "2026-11-03", "alim", { pagoCom: "VR" });
