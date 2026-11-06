// Movimentos de uma conta: o que mexeu no saldo depois do saldo informado, com o saldo depois de cada linha.
// O saldo final é sempre `saldoDaConta` do motor: o que o motor soma e esta lista não mostra vira a linha "Outros ajustes".
import * as C from "./engine";
import type { Estado, Lancamento } from "./engine";
import type { Transf } from "./loja";

export interface Mov { id: string; data: string; ts: number; nome: string; cents: number; saldoApos: number; extra?: string; lanc?: string }
export interface Movs { conta: string; informado: number; informadoEm: number; atual: number; linhas: Mov[] }

const dia = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function movimentos(e: Estado, nome: string, transf: Transf[] = []): Movs {
  const a = e.contas.find(x => x.nome === nome && (x.moeda || "BRL") === "BRL");
  if (!a) return { conta: nome, informado: 0, informadoEm: 0, atual: 0, linhas: [] };
  const t0 = a.em || 0, atual = C.saldoDaConta(e, nome);
  const L: Omit<Mov, "saldoApos">[] = [];
  const cartao = new Map<string, Omit<Mov, "saldoApos"> & { n: number }>();
  for (const l of e.lancamentos as Lancamento[]) {
    if (C.contaDe(e, l) !== nome) continue;
    if (l.tipo === "rec") {
      if ((l.criadoEm || 0) > t0 && (l.caiu || l.data) <= e.hoje) L.push({ id: l.id, data: l.caiu || l.data, ts: l.criadoEm || 0, nome: l.nome, cents: l.cents, lanc: l.id });
    } else if (l.pago !== false && (l.pagoEm || 0) > t0 && !l.pagoCom) {
      if (l.cartao) {
        const k = `${l.cartao}|${dia(l.pagoEm!)}`, g = cartao.get(k);
        if (g) { g.cents -= l.cents; g.n++; } else cartao.set(k, { id: "fat|" + k, data: dia(l.pagoEm!), ts: l.pagoEm!, nome: `Fatura ${l.cartao}`, cents: -l.cents, n: 1 });
      } else L.push({ id: l.id, data: dia(l.pagoEm!), ts: l.pagoEm!, nome: l.nome, cents: -l.cents, lanc: l.id });
    }
  }
  for (const t of transf) {
    if (t.ts <= t0 || t.date > e.hoje || (t.from !== nome && t.to !== nome)) continue;
    const sai = t.from === nome;
    L.push({ id: "tr|" + t.id, data: t.date, ts: t.ts, nome: sai ? `Transferência para ${t.to}` : `Transferência de ${t.from}`, cents: sai ? -t.cents : t.cents, extra: t.desc || "entre contas" });
  }
  cartao.forEach(g => L.push({ ...g, extra: `${g.n} ${g.n === 1 ? "item" : "itens"}` }));
  L.sort((x, y) => x.ts - y.ts || x.id.localeCompare(y.id));
  const soma = L.reduce((s, x) => s + x.cents, 0), resto = atual - (a.cents + soma);
  if (resto !== 0) L.push({ id: "ajuste", data: e.hoje, ts: Number.MAX_SAFE_INTEGER, nome: "Outros ajustes", cents: resto, extra: "faturas pagas e acertos de saldo" });
  let s = a.cents;
  const linhas = L.map(x => ({ ...x, saldoApos: (s += x.cents) }));
  return { conta: nome, informado: a.cents, informadoEm: t0, atual, linhas: linhas.reverse() };
}
