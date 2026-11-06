// Caixinhas completas: tipo/ícone, banco por movimento, editar movimento e ritmo até o mês-alvo (mesmo formato do app atual).
import { caixas, caixaMoeda, caixaTem } from "./loja";
import type { Backup, Caixinha, CxMov, MoedaCx } from "./loja";

export const CX_TIPOS = [
  { id: "viagem", nome: "Viagem", ico: "✈️" }, { id: "reserva", nome: "Reserva de emergência", ico: "🛟" },
  { id: "casa", nome: "Casa própria", ico: "🏠" }, { id: "carro", nome: "Carro ou moto", ico: "🚗" },
  { id: "casamento", nome: "Casamento", ico: "💍" }, { id: "estudos", nome: "Estudos", ico: "🎓" },
  { id: "eletronicos", nome: "Celular e eletrônicos", ico: "📱" }, { id: "presente", nome: "Presente", ico: "🎁" },
  { id: "saude", nome: "Saúde", ico: "🩺" }, { id: "investir", nome: "Investir", ico: "📈" }, { id: "outro", nome: "Outro", ico: "🐷" },
] as const;
export const cxIcone = (c: Caixinha) => CX_TIPOS.find(t => t.id === c.kind)?.ico || "";

const BANCOS = ["Nubank", "Inter", "Itaú", "Santander", "Bradesco", "Banco do Brasil", "Caixa", "C6", "PicPay", "Wise", "Nomad", "Revolut", "ARQ"];
export const bancosSugeridos = (b: Backup): string[] => {
  const nomes = [...((b.cfg.accts || []) as { name: string }[]).map(a => a.name), ...Object.keys((b.cfg.cards || {}) as Record<string, unknown>), ...BANCOS];
  return [...new Set(nomes.filter(Boolean))];
};

const mexe = (b: Backup, cid: string, f: (c: Caixinha) => Caixinha): Backup => ({ ...b, cfg: { ...b.cfg, save: caixas(b).map(c => (c.id === cid ? f(c) : c)) } });

/** nome, tipo, meta e mês-alvo (vazio apaga; nome em branco não muda) */
export function caixaEditar(b: Backup, cid: string, e: { name?: string; kind?: string; goal?: number; target?: string }): Backup {
  return mexe(b, cid, c => {
    const { kind: _k, goal: _g, target: _t, ...resto } = c; void _k; void _g; void _t;
    const n = e.name?.trim();
    return { ...resto, name: n || c.name, ...(e.kind ? { kind: e.kind } : {}), ...(e.goal && e.goal > 0 ? { goal: e.goal } : {}), ...(e.target && /^\d{4}-\d{2}$/.test(e.target) ? { target: e.target } : {}) };
  });
}

/** edita um movimento: `cents` com sinal (+ guardou, − tirou) na moeda do próprio movimento; com cotação, o R$ acompanha */
export function caixaEditarMov(b: Backup, cid: string, mid: string, e: { date: string; cents: number; bank?: string }): Backup {
  if (!e.cents) return b;
  return mexe(b, cid, c => ({ ...c, moves: c.moves.map((m): CxMov => {
    if (m.id !== mid) return m;
    const { bank: _b, ...resto } = m; void _b;
    const brl = m.rate && m.cur ? { brl: Math.round(Math.abs(e.cents) * m.rate) * (e.cents < 0 ? -1 : 1) } : {};
    return { ...resto, date: e.date || m.date, cents: e.cents, ...brl, ...(e.bank?.trim() ? { bank: e.bank.trim() } : {}) };
  }) }));
}

/** onde está o dinheiro: saldo por banco e moeda ("" = sem banco definido) */
export function caixaBancos(c: Caixinha): { banco: string; saldo: Record<MoedaCx, number> }[] {
  const mapa = new Map<string, Record<MoedaCx, number>>();
  for (const m of c.moves) {
    const k = m.bank?.trim() || "";
    const r = mapa.get(k) || { BRL: 0, EUR: 0, USD: 0 };
    r[m.cur || "BRL"] += m.cents; mapa.set(k, r);
  }
  return [...mapa.entries()].map(([banco, saldo]) => ({ banco, saldo })).filter(x => x.saldo.BRL || x.saldo.EUR || x.saldo.USD).sort((a, z) => (a.banco === "" ? 1 : z.banco === "" ? -1 : a.banco.localeCompare(z.banco)));
}

const dia = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
export interface Ritmo { estado: "batida" | "passou" | "ritmo" | "adiantada" | "atrasada" | "semInicio"; diff: number; falta: number; porMes: number; meses: number }
/** Linha reta do 1º movimento até o fim do mês-alvo; compara com o que já tem na moeda da meta. Sem meta ou mês-alvo: nada. */
export function caixaRitmo(c: Caixinha, hoje: string): Ritmo | null {
  if (!c.goal || !c.target) return null;
  const tem = caixaTem(c), falta = Math.max(0, c.goal - tem);
  const [ty, tm] = c.target.split("-").map(Number);
  const fim = `${c.target}-${String(new Date(Date.UTC(ty, tm, 0)).getUTCDate()).padStart(2, "0")}`;
  const meses = Math.max(1, (ty - +hoje.slice(0, 4)) * 12 + tm - +hoje.slice(5, 7) + 1);
  const base = { falta, meses, porMes: Math.ceil(falta / meses) };
  if (tem >= c.goal) return { ...base, estado: "batida", diff: tem - c.goal };
  if (hoje > fim) return { ...base, estado: "passou", diff: -falta, meses: 1, porMes: falta };
  const datas = c.moves.map(m => m.date).sort();
  if (!datas.length) return { ...base, estado: "semInicio", diff: 0 };
  const ini = dia(datas[0]), esperado = c.goal * Math.min(1, Math.max(0, (dia(hoje) - ini) / Math.max(1, dia(fim) - ini)));
  const diff = Math.round(tem - esperado);
  return { ...base, estado: Math.abs(diff) <= c.goal * 0.01 ? "ritmo" : diff > 0 ? "adiantada" : "atrasada", diff };
}
