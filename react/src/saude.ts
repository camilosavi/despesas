import * as C from "./engine";
import type { Estado } from "./engine";

export type Tom = "pos" | "accent" | "warn" | "neg";
export interface Saude { score: number; motivos: string[]; rotulo: string; tom: Tom }
type Lim = { pct?: number } | null | undefined;

// Nota de saúde do mês: sobra, limite alto, atrasados e conta no vermelho. Função pura do estado.
export function notaDeSaude(e: Estado): Saude {
  const ym = C.mesDe(e.hoje), r = C.resumoMes(e, ym);
  let score = 100;
  const motivos: string[] = [];
  if (r.entrou > 0) {
    const p = r.sobra / r.entrou;
    if (r.sobra < 0) { score -= 35; motivos.push("gastou mais do que entrou no mês"); }
    else if (p < 0.1) { score -= 15; motivos.push("sobra pequena"); }
  }
  const altos = C.cartoesDeCredito(e).filter((c: string) => ((C.limite(e, c) as Lim)?.pct ?? 0) >= 80);
  if (altos.length) { score -= 15; motivos.push("limite alto em " + altos.length + (altos.length > 1 ? " cartões" : " cartão")); }
  const atras = C.proximosPagamentos(e, 0).filter((d: { data: string }) => d.data < e.hoje);
  if (atras.length) { score -= 20; motivos.push(atras.length + (atras.length > 1 ? " atrasados" : " atrasado")); }
  if (C.temConta(e) && C.naConta(e) < 0) { score -= 20; motivos.push("conta no vermelho"); }
  const rotulo = score >= 80 ? "Muito boa" : score >= 60 ? "Boa" : score >= 40 ? "Atenção" : "Crítica";
  const tom: Tom = score >= 80 ? "pos" : score >= 60 ? "accent" : score >= 40 ? "warn" : "neg";
  return { score, motivos, rotulo, tom };
}

// Só mostra o bloco quando há o que dizer (regra de 06/11/2026).
export const saudeVisivel = (s: Saude) => !(s.score >= 100 && s.motivos.length === 0);
