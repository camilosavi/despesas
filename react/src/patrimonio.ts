// Patrimônio = contas em R$ + caixinhas em R$ − dívidas em aberto − limite usado dos cartões.
// € e US$ ficam à parte, sem converter. cfg.nw = {"AAAA-MM": centavos} guarda o fechamento de cada mês (o último valor do mês vale).
import * as C from "./engine";
import type { Estado } from "./engine";
import type { Backup } from "./loja";
import { caixaSaldos, caixas, dividaFalta, dividas } from "./loja";

export interface Patrimonio { contas: number; guardado: number; dividas: number; cartoes: number; total: number; moedas: { EUR: number; USD: number } }

export function patrimonio(e: Estado, b: Backup): Patrimonio {
  const contas = C.temConta(e) ? C.naConta(e) : 0;
  const guardado = caixas(b).reduce((s, c) => s + Math.max(0, caixaSaldos(c).BRL), 0);
  const dv = dividas(b).reduce((s, d) => s + Math.max(0, dividaFalta(d)), 0);
  let cart = 0;
  for (const c of C.cartoesDeCredito(e) as string[]) { const l = C.limite(e, c); if (l) cart += Math.max(0, l.usado); }
  const moedas = { EUR: 0, USD: 0 };
  for (const c of caixas(b)) { const s = caixaSaldos(c); moedas.EUR += s.EUR; moedas.USD += s.USD; }
  return { contas, guardado, dividas: dv, cartoes: cart, total: contas + guardado - dv - cart, moedas };
}

export const historico = (b: Backup): Record<string, number> => (b.cfg.nw || {}) as Record<string, number>;
/** grava o fechamento do mês; devolve o mesmo backup se nada mudou */
export function nwSnap(b: Backup, ym: string, cents: number): Backup {
  const h = historico(b);
  return h[ym] === cents ? b : { ...b, cfg: { ...b.cfg, nw: { ...h, [ym]: cents } } };
}
export function ultimos(b: Backup, ate: string, n = 12): { ym: string; cents: number | null }[] {
  const h = historico(b);
  return Array.from({ length: n }, (_, i) => { const ym = C.somaMeses(ate, i - (n - 1)); return { ym, cents: ym in h ? h[ym] : null }; });
}
