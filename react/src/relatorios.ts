// Relatórios: 12 meses a partir do mês escolhido, tudo pelo motor (entrou/gastou/sobra/fimDoMes).
import * as C from "./engine";
import type { Estado } from "./engine";
export interface LinhaAno { ym: string; entrou: number; gastou: number; sobra: number; fim: number | null; atual: boolean }
export function ano(e: Estado, de: string, n = 12): LinhaAno[] {
  const cur = C.mesDe(e.hoje);
  return Array.from({ length: n }, (_, i) => {
    const ym = C.somaMeses(de, i), en = C.entrou(e, ym), ga = C.gastou(e, ym);
    return { ym, entrou: en, gastou: ga, sobra: en - ga, fim: C.fimDoMes(e, ym), atual: ym === cur };
  });
}
export const porCategoria = (e: Estado, ym: string) => C.gastosPorCategoria(e, ym);
