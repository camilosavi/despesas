// Regras do app atual que a base ainda não cobre (copiadas, não reescritas): em que fatura cai uma compra no crédito.
import { pad, ultimoDia, somaMeses, mesDe } from "../../base/datas.mjs";
const cfgCartao = (cfg, c) => ((cfg.cards || {})[c]) || {};
export function fechamentoDe(cfg, c, vencDia, D) {
  const cl = +cfgCartao(cfg, c).close || 0, dd = +D.slice(8);
  if (cl) { const m = cl < dd ? D.slice(0, 7) : somaMeses(D.slice(0, 7), -1); return `${m}-${pad(Math.min(cl, ultimoDia(m)))}`; }
  const d = new Date(Date.UTC(+D.slice(0, 4), +D.slice(5, 7) - 1, dd - (dd >= 10 ? 16 : 8)));
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}
// compra no crédito → vencimento da fatura em que ela cai (cartão sem vencimento: fica na data da compra)
export function dataDaFatura(cfg, c, compra) {
  const dd = +cfgCartao(cfg, c).due || 0; if (!c || !dd || !compra) return compra;
  for (let j = 0; j < 4; j++) { const ym = somaMeses(mesDe(compra), j), D = `${ym}-${pad(Math.min(dd, ultimoDia(ym)))}`; if (compra <= fechamentoDe(cfg, c, dd, D)) return D; }
  return compra;
}
// salário que cai do dia 25 em diante é dinheiro do mês seguinte: data = dia 1º, guarda o dia em que caiu
export function salShift(cat, date) { return (cat === "sal" || cat === "d13") && +date.slice(8) >= 25 ? { date: somaMeses(mesDe(date), 1) + "-01", fell: date } : null; }
export const FORMAS = ["Pix", "Débito", "Crédito", "Dinheiro", "Boleto", "Transferência"];
