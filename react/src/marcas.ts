// Logos, cores e siglas dos bancos: lidos de novo/marcas/marcas.js, que é cópia SEM mudança do app atual.
// Não redesenhar nem trocar. O arquivo é lido como texto e avaliado uma vez (as imagens estão embutidas nele).
import raw from "../../novo/marcas/marcas.js?raw";
import type { Estado } from "./engine";

interface Banco { id?: string; m: RegExp; c: string; l: string }
interface Marcas {
  BANKS: Banco[]; BANK_LOGOS: Record<string, string>; CARD_COLOR: Record<string, string>;
  bankOf: (n: string) => Banco | null; cardLabel: (n: string) => string; lumHex: (h: string) => number;
}
const M = new Function("esc", "cfg", "document", raw + "\n;return {BANKS,BANK_LOGOS,CARD_COLOR,bankOf,cardLabel,lumHex};")(
  (s: string) => s, { cards: {} }, undefined) as Marcas;

export interface MarcaInfo { cor: string; escuro: boolean; k: number; rotulo: string; logo: string | null }

// mesma regra do cardBadge do app: cor escolhida > cor fixa > cor do banco > cinza; logo se houver, senão a sigla
export function marcaDe(nome: string, e?: Estado): MarcaInfo {
  const b = M.bankOf(nome), rotulo = M.cardLabel(nome);
  const cor = (e?.cartoes?.[nome] as { cor?: string } | undefined)?.cor || M.CARD_COLOR[nome] || b?.c || "#6B7A75";
  const n = rotulo.length;
  return { cor, escuro: M.lumHex(cor) > 0.5, k: n <= 2 ? 1 : n === 3 ? 0.88 : n === 4 ? 0.76 : 0.66, rotulo, logo: (b && b.id && M.BANK_LOGOS[b.id]) || null };
}
