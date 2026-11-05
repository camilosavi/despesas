// DIVISÃO POR PESSOA: vale para qualquer despesa (compra, parcela, assinatura). Uma função por número, como no resto da base.
//
// lancamento.divide = { com: [{ pessoa:"Ana", cents?:2500 }, ...] }
//   · sem cents = parte igual, contando você (3 pessoas na lista = 4 partes)
//   · com cents = valor combinado dela (o que sobra fica com você)
// estado.acertos = [{ id, pessoa, cents, data }]   cents > 0: ela te pagou · cents < 0: você pagou a ela
// Nada aqui é despesa/receita nova: o lançamento continua inteiro; esta camada só diz de quem é cada parte.
import { mesDe } from "./datas.mjs";

const ehDespesa = l => l.tipo !== "rec";

// partes dos outros, em centavos (a soma nunca passa do lançamento; o resto de centavo fica com você)
export function partes(l) {
  const com = (l.divide && l.divide.com) || [];
  if (!ehDespesa(l) || !com.length) return [];
  const n = com.length + 1, igual = Math.floor(l.cents / n);
  let P = com.map(c => ({ pessoa: c.pessoa, cents: c.cents != null ? Math.max(0, Math.round(c.cents)) : igual }));
  let s = P.reduce((a, p) => a + p.cents, 0);
  if (s > l.cents) { // combinado passou do valor: corta do último para nunca dever mais que o lançamento
    let sobra = s - l.cents;
    for (let i = P.length - 1; i >= 0 && sobra > 0; i--) { const t = Math.min(P[i].cents, sobra); P[i].cents -= t; sobra -= t; }
  }
  return P.filter(p => p.cents > 0);
}

export const suaParte = l => l.cents - partes(l).reduce((s, p) => s + p.cents, 0);

// quanto cada pessoa já te deve por lançamentos (todos os meses, ou só `ym`)
const devidoPor = (e, ym) => {
  const m = {};
  for (const l of e.lancamentos) if (!ym || mesDe(l.data) === ym) for (const p of partes(l)) m[p.pessoa] = (m[p.pessoa] || 0) + p.cents;
  return m;
};

// saldo da pessoa: > 0 ela te deve · < 0 você deve a ela
export function saldoDe(e, pessoa) {
  const d = devidoPor(e)[pessoa] || 0;
  return d - (e.acertos || []).filter(a => a.pessoa === pessoa).reduce((s, a) => s + a.cents, 0);
}

export function saldosPorPessoa(e) {
  const nomes = new Set([...Object.keys(devidoPor(e)), ...(e.acertos || []).map(a => a.pessoa)]);
  return [...nomes].map(pessoa => ({ pessoa, cents: saldoDe(e, pessoa) })).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
}

export const aReceber = e => saldosPorPessoa(e).reduce((s, x) => s + Math.max(0, x.cents), 0);
export const aDever = e => saldosPorPessoa(e).reduce((s, x) => s + Math.max(0, -x.cents), 0);

// o que a pessoa ficou devendo só naquele mês (para cobrar assinatura mês a mês)
export const devidoNoMes = (e, pessoa, ym) => devidoPor(e, ym)[pessoa] || 0;

// extrato da pessoa: lançamentos que deram parte a ela + acertos, por data
export function extrato(e, pessoa) {
  const L = [];
  for (const l of e.lancamentos) for (const p of partes(l)) if (p.pessoa === pessoa) L.push({ data: l.data, nome: l.nome, cents: p.cents, de: "lancamento", id: l.id });
  for (const a of e.acertos || []) if (a.pessoa === pessoa) L.push({ data: a.data, nome: a.cents > 0 ? "Pagamento" : "Você pagou", cents: -a.cents, de: "acerto", id: a.id });
  return L.sort((a, b) => a.data.localeCompare(b.data));
}
