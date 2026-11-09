// Avisos: tudo que pede atenção agora, calculado do motor (nada é somado aqui por conta própria).
// Dispensar um aviso grava a chave em cfg.avOff (até 150), então ele não volta enquanto a situação for a mesma.
import * as C from "./engine";
import type { Estado } from "./engine";
import type { Backup } from "./loja";
import { limites } from "./loja";
import { fluxoDoMes } from "./contas";
import { porCategoria } from "./relatorios";
import { limiteComSobra, sobraDesde } from "./orcamento";
import { R, dm } from "./format";

export type Nivel = "alto" | "medio";
export type Destino = "cartoes" | "contas" | "categorias";
export interface Aviso { k: string; nivel: Nivel; titulo: string; detalhe: string; ir: Destino; id?: string; cartao?: string }
type Venc = { tipo: "lancamento" | "fatura"; id?: string; cartao?: string; nome: string; data: string; cents: number };

export const MAX_OFF = 150;
export const dispensados = (b: Backup | null): string[] => (b && Array.isArray(b.cfg.avOff) ? (b.cfg.avOff as string[]) : []);

const quando = (data: string, hoje: string) => {
  const d = Math.round((Date.parse(data + "T12:00:00Z") - Date.parse(hoje + "T12:00:00Z")) / 86400000);
  return d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : `vence em ${d} dias`;
};

export function avisos(e: Estado, b: Backup | null, pers: Record<string, unknown> = {}, todos = false): Aviso[] {
  const L: Aviso[] = [], hoje = e.hoje, ym = C.mesDe(hoje);
  // 1) atrasados e vencimentos de hoje até 3 dias
  for (const d of C.proximosPagamentos(e, 3) as Venc[]) {
    const k = d.tipo === "fatura" ? `venc|fat|${d.cartao}|${d.data}` : `venc|${d.id}`;
    const base = { k, ir: (d.tipo === "fatura" ? "cartoes" : "contas") as Destino, id: d.id, cartao: d.cartao };
    if (d.data < hoje) L.push({ ...base, nivel: "alto", titulo: `${d.nome} atrasado`, detalhe: `${R(d.cents)} · venceu em ${dm(d.data)}` });
    else L.push({ ...base, nivel: d.data === hoje ? "alto" : "medio", titulo: d.nome, detalhe: `${R(d.cents)} · ${quando(d.data, hoje)} (${dm(d.data)})` });
  }
  // 2) limite dos cartões
  for (const c of C.cartoesDeCredito(e) as string[]) {
    const l = C.limite(e, c);
    if (!l) continue;
    if (l.passou > 0) L.push({ k: `lim|${c}|100|${ym}`, nivel: "alto", titulo: `${c} passou do limite`, detalhe: `R$ ${(l.passou / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} acima do limite`, ir: "cartoes", cartao: c });
    else if (l.pct >= 80) L.push({ k: `lim|${c}|80|${ym}`, nivel: "medio", titulo: `${c} em ${Math.round(l.pct)}% do limite`, detalhe: `Livre ${R(l.livre)} de ${R(l.limite)}`, ir: "cartoes", cartao: c });
  }
  // 3) conta no vermelho neste mês
  if (C.temConta(e)) {
    const v = fluxoDoMes(e, ym).vermelho;
    if (v) L.push({ k: `verm|${v.data}`, nivel: "alto", titulo: "A conta fica no vermelho", detalhe: `Depois de ${v.nome} (${dm(v.data)}) o saldo fica negativo`, ir: "contas" });
  }
  // 4) orçamento por categoria a 80% e 100% (com a sobra levada, se ligada)
  if (b) {
    const lim = limites(b), desde = sobraDesde(b), memo: Record<string, Record<string, number>> = {};
    const gastoDe = (m: string, k: string) => (memo[m] ||= Object.fromEntries(porCategoria(e, m).map(x => [x.k, x.cents])))[k] || 0;
    for (const k of Object.keys(lim)) {
      if (!lim[k]) continue;
      const ef = limiteComSobra(lim[k], desde[k], ym, m => gastoDe(m, k)).limite, g = gastoDe(ym, k);
      if (!ef || g < ef * 0.8) continue;
      const nome = (C.categoria("desp", k, pers) as { n: string } | undefined)?.n || k;
      if (g >= ef) L.push({ k: `orc|${k}|${ym}|100`, nivel: "alto", titulo: `${nome}: passou do limite`, detalhe: `${R(g)} de ${R(ef)} em ${ym.slice(5)}/${ym.slice(0, 4)}`, ir: "categorias" });
      else L.push({ k: `orc|${k}|${ym}|80`, nivel: "medio", titulo: `${nome}: ${Math.round((g / ef) * 100)}% do limite`, detalhe: `${R(g)} de ${R(ef)}`, ir: "categorias" });
    }
  }
  const off = new Set(dispensados(b));
  return L.filter(a => todos || !off.has(a.k)).sort((x, y) => Number(y.nivel === "alto") - Number(x.nivel === "alto"));
}

export function avisoDispensar(b: Backup, k: string): Backup {
  const o = dispensados(b);
  return o.includes(k) ? b : { ...b, cfg: { ...b.cfg, avOff: [...o, k].slice(-MAX_OFF) } };
}
export const avisosRestaurar = (b: Backup): Backup => { const { avOff: _x, ...cfg } = b.cfg; return { ...b, cfg }; };
