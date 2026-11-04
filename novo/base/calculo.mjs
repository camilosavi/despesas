// BASE DE CÁLCULO: cada número do app tem UMA função aqui. As telas só chamam; nenhuma tela soma por conta própria.
// Tudo é função pura do "estado" (nada de Date.now, localStorage ou tela), então dá para testar com dados de exemplo.
//
// estado = {
//   hoje:        "AAAA-MM-DD"
//   inicio?:     "AAAA-MM-DD"  — o que vence antes disso não conta como atrasado nem rola para a próxima fatura
//   lancamentos: [{ id, nome, tipo:"desp"|"rec", cat?, cents, data, pago?, pagoEm?, criadoEm?, conta?, cartao?, pagoCom?,
//                   compra?, recorrente?, saldoAnterior?, caiu? }]
//                 · cents sempre em centavos; data = dia em que o dinheiro sai/entra (cartão: vencimento da fatura)
//                 · pago: só vale para despesa; pago !== false conta como pago
//                 · pagoEm / criadoEm = hora (ms); conta = nome da conta; cartao = cartão de crédito (a fatura paga a compra)
//                 · pagoCom = nome de um cartão de benefício (VR/VA): fica fora do saldo, do "a pagar" e do "gastou"
//                 · recorrente = repetição mensal sem parcela (assinatura); saldoAnterior = linha "Saldo da fatura anterior"
//                 · caiu = dia em que a receita realmente caiu (salário do fim do mês: data = dia 1º, caiu = dia 30)
//   contas:      [{ nome, cents, em, moeda? }]   saldo que a pessoa informou e a hora (ms) em que informou
//   cartoes:     { [nome]: { tipo?:"credito"|"beneficio", venc?, limite?, livreBanco?, livreBancoEm?, livreBancoData? } }
//   faturas:     [{ cartao, ym, valorBanco?, importada?, paga?, pagaEm?, conta? }]   ym = mês do vencimento
//   ajustes:     [{ em, conta, cents }]  caixinha / transferência: mexem na conta, não são despesa nem receita
//   previstos?:  ym => [{ data, cents, caiu? }]  receitas previstas (ex.: salário previsto), não são lançamentos
// }

import { mesDe, ultimoDia, somaMeses, dataComDia, somaDias, pad } from "./datas.mjs";

const soma = L => L.reduce((s, x) => s + x.cents, 0);
const mesAtual = e => mesDe(e.hoje);
const inicio = e => e.inicio || "";

// ---------- o que é cada coisa ----------
const ehDesp = l => l.tipo !== "rec";
const emAberto = l => ehDesp(l) && l.pago === false;
const cartaoCfg = (e, c) => (e.cartoes || {})[c] || {};
const ehBeneficio = (e, l) => !!l.pagoCom && cartaoCfg(e, l.pagoCom).tipo === "beneficio";
const mexeNaConta = (e, l) => ehDesp(l) && !ehBeneficio(e, l);
const doCartao = (e, c) => e.lancamentos.filter(l => l.cartao === c && ehDesp(l));
const regDe = (e, c, ym) => (e.faturas || []).find(r => r.cartao === c && r.ym === ym) || null;

export function cartoesDeCredito(e) {
  const nomes = new Set([
    ...Object.keys(e.cartoes || {}).filter(c => cartaoCfg(e, c).tipo !== "beneficio"),
    ...e.lancamentos.filter(l => l.cartao).map(l => l.cartao),
    ...(e.faturas || []).map(r => r.cartao),
  ]);
  return [...nomes];
}

// ---------- cartão: vencimento e rolagem ----------
export function vencimento(e, c, ym) {
  const dia = +cartaoCfg(e, c).venc || 0;
  return dia ? dataComDia(ym, dia) : `${ym}-${pad(ultimoDia(ym))}`;
}

// 1ª fatura (a partir do mês atual) que ainda não venceu
export function mesFaturaAberta(e, c) {
  let m = mesAtual(e);
  for (let i = 0; i < 3; i++, m = somaMeses(m, 1)) if (vencimento(e, c, m) >= e.hoje) return m;
  return m;
}

// 1ª fatura que ainda não venceu depois do mês `depoisDe`
function proximaAberta(e, c, depoisDe) {
  let m = somaMeses(depoisDe, 1);
  for (let i = 0; i < 24; i++, m = somaMeses(m, 1)) if (vencimento(e, c, m) >= e.hoje) return m;
  return m;
}

// Fatura vencida e não paga vai para a próxima do mesmo cartão, como o banco faz. null = não rolou.
export function rolaPara(e, l) {
  if (!l.cartao || !emAberto(l) || ehBeneficio(e, l) || !l.data || l.data >= e.hoje || l.data < inicio(e)) return null;
  return proximaAberta(e, l.cartao, mesDe(l.data));
}

// Se a fatura de destino já veio do banco (com "Saldo da fatura anterior" ou só importada), o banco já cobrou
// o que ficou para trás: o que rolou não conta de novo.
function anulada(e, c, m) {
  if (e.lancamentos.some(y => y.cartao === c && y.saldoAnterior && mesDe(y.data) === m)) return true;
  const r = regDe(e, c, m);
  return !!(r && r.importada);
}

const roladosItens = (e, c, ym) =>
  anulada(e, c, ym) ? [] : doCartao(e, c).filter(l => rolaPara(e, l) === ym);

// O valor do banco informado de uma fatura vencida e não paga que ainda não está itemizado também rola.
function faltasRoladas(e, c, ym) {
  if (anulada(e, c, ym)) return 0;
  let s = 0;
  for (const r of e.faturas || []) {
    if (r.cartao !== c || r.ym >= ym || r.paga) continue;
    const v = vencimento(e, c, r.ym);
    if (v >= e.hoje || v < inicio(e) || proximaAberta(e, c, r.ym) !== ym) continue;
    s += faltaBruta(e, c, r.ym);
  }
  return s;
}

// valor do banco − o que já está lançado naquela fatura (nunca negativo)
function faltaBruta(e, c, ym) {
  const r = regDe(e, c, ym);
  if (!r || r.valorBanco == null) return 0;
  const lancado = soma(doCartao(e, c).filter(l => mesDe(l.data) === ym)) + soma(roladosItens(e, c, ym)) + faltasRoladas(e, c, ym);
  return Math.max(0, r.valorBanco - lancado);
}

// ---------- FATURA (cartão × mês do vencimento) ----------
// total  = valor da fatura: itens que ficam nela + o que rolou da anterior + o que falta lançar (valor do banco)
// aberto = a parte do total que ainda não foi paga
export function fatura(e, c, ym) {
  const reg = regDe(e, c, ym), v = vencimento(e, c, ym), vencida = v < e.hoje;
  const ficam = doCartao(e, c).filter(l => mesDe(l.data) === ym && !rolaPara(e, l));
  const rolados = roladosItens(e, c, ym);
  const faltaRol = faltasRoladas(e, c, ym);
  const paga = !!(reg && reg.paga);
  const falta = faltaBruta(e, c, ym);
  // fatura vencida e não paga: o que faltava lançar rolou para a próxima, não fica aqui
  const faltaAqui = vencida && !paga ? 0 : falta;
  const lancado = soma(ficam) + soma(rolados) + faltaRol;
  return {
    cartao: c, ym, vence: v, vencida,
    itens: ficam, rolados, doAnterior: soma(rolados) + faltaRol,
    banco: reg && reg.valorBanco != null ? reg.valorBanco : null,
    lancado, falta: faltaAqui, total: lancado + faltaAqui,
    aberto: soma(ficam.filter(emAberto)) + soma(rolados) + faltaRol + (paga ? 0 : faltaAqui),
  };
}

// ---------- RECEITAS ----------
const caiuEm = l => l.caiu || l.data;
// no mês atual, o que ficou para trás (a partir de `inicio`) também conta; nos outros, só o próprio mês
const noFluxo = (e, ym, data) => {
  const cur = mesAtual(e), m = mesDe(data);
  return ym === cur ? m === cur || (m < cur && data >= inicio(e)) : m === ym;
};
const previstosDe = (e, ym) => (e.previstos ? e.previstos(ym) : []);

// receitas que ainda vão cair neste mês (as que já caíram estão no saldo da conta)
export function entraAinda(e, ym) {
  let s = 0;
  for (const l of e.lancamentos) if (l.tipo === "rec" && noFluxo(e, ym, l.data) && caiuEm(l) > e.hoje) s += l.cents;
  for (const p of previstosDe(e, ym)) if ((p.caiu || p.data) > e.hoje) s += p.cents;
  return s;
}

// ---------- A PAGAR ----------
// Lista e total saem da mesma função: o que aparece na lista é exatamente o que soma no total.
export function aPagarDetalhe(e, ym) {
  const cur = mesAtual(e), L = [];
  for (const l of e.lancamentos) {
    if (l.cartao || !mexeNaConta(e, l) || !emAberto(l) || !noFluxo(e, ym, l.data)) continue;
    L.push({ tipo: "lancamento", id: l.id, nome: l.nome || "", data: l.data, cents: l.cents, atrasado: mesDe(l.data) < cur });
  }
  for (const c of cartoesDeCredito(e)) {
    const f = fatura(e, c, ym);
    if (f.aberto > 0) L.push({ tipo: "fatura", cartao: c, nome: `Fatura ${c}`, data: f.vence, cents: f.aberto, ym });
  }
  return L.sort((a, b) => a.data.localeCompare(b.data));
}
export const aPagar = (e, ym) => soma(aPagarDetalhe(e, ym));

// "Vence nos próximos N dias" (inclui atrasados): mesma lista do A pagar, só cortada por data
export function proximosPagamentos(e, dias) {
  const lim = somaDias(e.hoje, dias), cur = mesAtual(e), L = [];
  const ultimo = mesDe(lim) > cur ? mesDe(lim) : cur;
  for (let m = cur; m <= ultimo; m = somaMeses(m, 1)) {
    for (const d of aPagarDetalhe(e, m)) if (d.data <= lim) L.push(d);
  }
  return L.sort((a, b) => a.data.localeCompare(b.data));
}

// ---------- NO MÊS: ENTROU / GASTOU / SOBRA ----------
// competência do mês do vencimento (fatura conta no mês em que se paga); fora benefício
export const entrou = (e, ym) => soma(e.lancamentos.filter(l => l.tipo === "rec" && mesDe(l.data) === ym));

const faltasDoMes = (e, ym) => cartoesDeCredito(e).reduce((s, c) => s + faltaBruta(e, c, ym), 0);

export function gastou(e, ym) {
  return soma(e.lancamentos.filter(l => mexeNaConta(e, l) && mesDe(l.data) === ym)) + faltasDoMes(e, ym);
}

// Gastou do mês repartido por categoria (soma = gastou). O que a fatura tem a mais que os itens lançados vem à parte, com k "_falta".
export function gastosPorCategoria(e, ym) {
  const m = {};
  for (const l of e.lancamentos) if (mexeNaConta(e, l) && mesDe(l.data) === ym) m[l.cat || "outros"] = (m[l.cat || "outros"] || 0) + l.cents;
  const f = faltasDoMes(e, ym);
  if (f) m._falta = f;
  return Object.entries(m).map(([k, cents]) => ({ k, cents })).filter(x => x.cents > 0).sort((a, b) => b.cents - a.cents);
}

export function pago(e, ym) {
  const itens = soma(e.lancamentos.filter(l => mexeNaConta(e, l) && l.pago !== false && mesDe(l.data) === ym));
  const faltas = (e.faturas || []).filter(r => r.ym === ym && r.paga).reduce((s, r) => s + faltaBruta(e, r.cartao, ym), 0);
  return itens + faltas;
}

export const sobra = (e, ym) => entrou(e, ym) - gastou(e, ym);

// ---------- NA CONTA HOJE ----------
const contasReais = e => (e.contas || []).filter(a => (a.moeda || "BRL") === "BRL");
export const temConta = e => contasReais(e).length > 0;

// em que conta o lançamento entra/sai: a que ele diz; sem conta (ou conta que não existe mais) = a 1ª
export function contaDe(e, l) {
  const A = contasReais(e);
  if (!A.length) return "";
  return A.some(a => a.nome === l.conta) ? l.conta : A[0].nome;
}

// saldo que a pessoa informou, mais o que entrou depois, menos o que foi pago depois (cada conta com a sua hora)
export function saldoDaConta(e, nome) {
  const a = contasReais(e).find(x => x.nome === nome);
  if (!a) return 0;
  const t0 = a.em || 0;
  let s = a.cents;
  for (const l of e.lancamentos) {
    if (contaDe(e, l) !== nome) continue;
    if (mexeNaConta(e, l) && l.pago !== false && (l.pagoEm || 0) > t0) s -= l.cents;
    else if (l.tipo === "rec" && (l.criadoEm || 0) > t0 && caiuEm(l) <= e.hoje) s += l.cents;
  }
  for (const r of e.faturas || []) {
    if (!r.paga || (r.pagaEm || 0) <= t0) continue;
    const conta = contasReais(e).some(x => x.nome === r.conta) ? r.conta : contasReais(e)[0].nome;
    if (conta === nome) s -= faltaBruta(e, r.cartao, r.ym);
  }
  for (const j of e.ajustes || []) {
    const conta = contasReais(e).some(x => x.nome === j.conta) ? j.conta : contasReais(e)[0].nome;
    if (conta === nome && j.em > t0) s += j.cents;
  }
  return s;
}

export const naConta = e => contasReais(e).reduce((s, a) => s + saldoDaConta(e, a.nome), 0);

// ---------- FIM DO MÊS ----------
// Com conta: saldo de hoje + o que ainda entra − o que ainda sai, mês a mês até `ym`. Sem conta: receitas − despesas.
export function fimDoMes(e, ym) {
  const cur = mesAtual(e);
  if (ym < cur) return null;
  if (!temConta(e)) {
    let s = 0;
    for (let m = cur; m <= ym; m = somaMeses(m, 1)) s += entrou(e, m) - gastou(e, m) + soma(previstosDe(e, m));
    return s;
  }
  let s = naConta(e);
  for (let m = cur; m <= ym; m = somaMeses(m, 1)) s += entraAinda(e, m) - aPagar(e, m);
  return s;
}

// ---------- RESUMO DO MÊS (o que a Visão geral mostra) ----------
export function resumoMes(e, ym) {
  const en = entrou(e, ym), ga = gastou(e, ym);
  return {
    ym, entrou: en, entraAinda: entraAinda(e, ym), gastou: ga, pago: pago(e, ym), aPagar: aPagar(e, ym),
    sobra: en - ga, fimDoMes: fimDoMes(e, ym),
  };
}

// ---------- LIMITE DO CARTÃO ----------
// usado = o que ainda está em aberto no cartão; livre = limite − usado, ou parte do "livre" que o banco informou.
export function limite(e, c) {
  const k = cartaoCfg(e, c);
  if (!k.limite) return null;
  const ob = mesFaturaAberta(e, c);
  const usados = doCartao(e, c).filter(l => {
    if (!emAberto(l) || l.data < inicio(e)) return false;
    const rm = rolaPara(e, l);
    if (rm && anulada(e, c, rm)) return false;
    return !(l.recorrente && mesDe(l.data) > ob); // assinatura só pega o limite no mês da fatura aberta
  });
  let usado = soma(usados);
  for (const r of e.faturas || []) {
    if (r.cartao !== c || r.paga || vencimento(e, c, r.ym) < inicio(e)) continue;
    if (vencimento(e, c, r.ym) < e.hoje && anulada(e, c, proximaAberta(e, c, r.ym))) continue;
    usado += faltaBruta(e, c, r.ym);
  }
  const calculado = k.limite - usado;
  let livre = calculado, doBanco = false;
  if (k.livreBanco != null) {
    doBanco = true;
    const d0 = k.livreBancoData || e.hoje, t0 = k.livreBancoEm || Date.parse(d0 + "T23:59:59Z");
    const U = new Set(usados.map(l => l.id));
    livre = k.livreBanco;
    for (const l of doCartao(e, c)) {
      const nova = l.compra ? l.compra > d0 : (l.criadoEm || 0) > t0;
      if (nova && U.has(l.id)) { if (!(l.compra && l.compra > e.hoje)) livre -= l.cents; } // compra de data futura o banco ainda não cobrou
      else if (!nova && l.pago !== false && (l.pagoEm || 0) > t0) livre += l.cents; // pagou depois: libera
    }
  }
  return {
    limite: k.limite, usado, calculado, livre, doBanco,
    pct: ((k.limite - livre) / k.limite) * 100,
    passou: Math.max(0, -livre), // "passou R$ X" em vez de livre negativo
  };
}
