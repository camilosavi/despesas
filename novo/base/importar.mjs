// DO BACKUP DO APP ATUAL PARA O `estado` DA BASE NOVA. Só leitura: nada é gravado nem enviado em lugar nenhum.
// Backup = o JSON da tela Você: { app:"minhas-despesas", v:1, items, fx, cfg }.
// Devolve { estado, resumo } (resumo = o que foi lido e o que ficou de fora, para a pessoa conferir).
import { mesDe } from "./datas.mjs";
import { migrar } from "./categorias.mjs";

const semPrefixo = (d, c) => (c ? String(d || "").replace(new RegExp("^" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " · "), "") : String(d || ""));

export function deAppAtual(b, hoje) {
  const cfg = b.cfg || {}, itens = b.items || [], cards = cfg.cards || {};
  const pers = { desp: (cfg.cats || []).map(c => ({ k: c.k, n: c.n, c: c.c })), rec: (cfg.catsRec || []).map(c => ({ k: c.k, n: c.n, c: c.c })) };
  const cartaoDe = x => {
    if (x.card) return x.card;
    const m = /^([^·]+) · /.exec(x.desc || "");
    return m && (cards[m[1].trim()] || /^Fatura /i.test((x.desc || "").slice(m[0].length))) ? m[1].trim() : "";
  };
  const ehBeneficio = n => !!n && (cards[n] || {}).kind === "ben";
  const lancamentos = [], faturas = [], r = { lancamentos: 0, faturas: 0, contas: 0, cartoes: 0, beneficio: 0, ajustes: 0, semData: 0 };

  for (const x of itens) {
    const tipo = x.type === "rec" ? "rec" : "desp", c = cartaoDe(x);
    if (!x.date || !Number.isFinite(x.cents)) { r.semData++; continue; }
    // "Fatura X" gerada = o valor que o banco cobra: vira atributo da fatura, não lançamento
    if (tipo === "desp" && x.cat === "cartao" && c && /^Fatura /i.test(semPrefixo(x.desc, c))) {
      const ym = mesDe(x.date), ja = faturas.find(f => f.cartao === c && f.ym === ym);
      const reg = { cartao: c, ym, valorBanco: x.cents, importada: !!x.imp, paga: x.paid !== false, pagaEm: x.paidAt };
      if (ja) { if (x.cents > (ja.valorBanco || 0)) Object.assign(ja, reg); } else faturas.push(reg);
      r.faturas++; continue;
    }
    const k = migrar(tipo, x.cat, pers);
    const pagoCom = tipo === "desp" && ehBeneficio(x.pay) ? x.pay : undefined;
    const l = {
      id: x.id, nome: semPrefixo(x.desc, c) || (x.cat || ""), tipo, cat: k.k, cents: x.cents, data: x.date,
      ...(tipo === "desp" ? { pago: x.paid !== false } : {}),
      ...(x.paidAt ? { pagoEm: x.paidAt } : {}), ...(x.createdAt ? { criadoEm: x.createdAt } : {}),
      ...(x.acct ? { conta: x.acct } : {}), ...(c && tipo === "desp" && !pagoCom ? { cartao: c } : {}), ...(pagoCom ? { pagoCom } : {}),
      ...(x.buy ? { compra: x.buy } : {}), ...(x.fell ? { caiu: x.fell } : {}),
      ...(x.group && !x.parc && tipo === "desp" ? { recorrente: true } : {}),
      ...(/^Saldo da fatura anterior/i.test(semPrefixo(x.desc, c)) ? { saldoAnterior: true } : {}),
    };
    if (x.imp && /^fatura-/.test(x.imp) && c) { const ym = mesDe(x.date); if (!faturas.some(f => f.cartao === c && f.ym === ym)) faturas.push({ cartao: c, ym, importada: true }); else faturas.find(f => f.cartao === c && f.ym === ym).importada = true; }
    if (pagoCom) r.beneficio++;
    lancamentos.push(l); r.lancamentos++;
  }

  const contas = (cfg.accts || []).filter(a => !a.cur || a.cur === "BRL").map(a => ({ nome: a.name, cents: a.cents || 0, em: a.atTs || Date.parse((a.at || hoje) + "T12:00:00Z") }));
  r.contas = contas.length;

  const cartoes = {};
  for (const [n, k] of Object.entries(cards)) {
    cartoes[n] = {
      ...(k.kind === "ben" ? { tipo: "beneficio" } : {}), ...(k.due ? { venc: k.due } : {}), ...(k.limit ? { limite: k.limit } : {}),
      ...(k.bankFree != null ? { livreBanco: k.bankFree, livreBancoEm: k.bankAtTs, livreBancoData: k.bankAt } : {}), ...(k.color ? { cor: k.color } : {}),
    };
    r.cartoes++;
  }

  // caixinha e transferência mexem na conta (não são despesa nem receita)
  const ajustes = [];
  for (const cx of cfg.save || []) for (const m of cx.moves || []) {
    if (!m.acct || !m.ts) continue;
    const v = m.brl != null ? m.brl : (m.cur || "BRL") === "BRL" ? m.cents : null;
    if (v == null) continue;
    ajustes.push({ em: m.ts, conta: m.acct, cents: -v });
  }
  for (const t of cfg.transf || []) { ajustes.push({ em: t.ts, conta: t.from, cents: -t.cents }); ajustes.push({ em: t.ts, conta: t.to, cents: t.cents }); }
  r.ajustes = ajustes.length;

  const cartoesNomes = Object.fromEntries(Object.entries(cartoes).map(([n, k]) => [n, k]));
  return { estado: { hoje, inicio: "2026-10-01", contas, cartoes: cartoesNomes, lancamentos, faturas, ajustes, pers }, resumo: r };
}
