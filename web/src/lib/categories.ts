import { isHidden } from "./catcolor";
import type { Entry, EntryType } from "./types";
// Categorias do app antigo (as pessoais dele ficam de fora: o repositório é público; "+ Nova" cria).
export const CAT_CARD = "Faturas de cartão", CAT_DIV = "Divisões";
export const CAT_OUT = ["Alimentação", "Mercado", "Transporte", "Casa e contas", "Lazer", "Esporte", "Saúde", "Compras", "Educação", "Assinaturas", CAT_CARD, "Outros"];
export const CAT_IN = ["Salário", "Rendimentos", CAT_DIV, "Saldo anterior", "Outras receitas"];
/** a última de cada lista: sempre existe, nunca se esconde */
export const lastCat = (t: EntryType) => (t === "rec" ? "Outras receitas" : "Outros");
export const isLastCat = (c: string) => c === "Outros" || c === "Outras receitas";
/** nomes da versão de 21/10 (manhã) → nomes do app antigo */
export const CAT_RENAME: Record<EntryType, Record<string, string>> = {
  desp: { Moradia: "Casa e contas", Contas: "Casa e contas", Cartão: CAT_CARD },
  rec: { Rendimento: "Rendimentos", Reembolso: CAT_DIV, Outros: "Outras receitas" },
};
const fixed = (t: EntryType) => (t === "rec" ? CAT_IN : CAT_OUT);
export const isFixedCat = (c: string) => CAT_OUT.includes(c) || CAT_IN.includes(c);
/** categorias do tipo: as fixas + as que ele criou (qualquer nome usado em lançamentos; não há lista a sincronizar), a última (Outros / Outras receitas) por último */
export const catsOf = (t: EntryType, entries: (Pick<Entry, "type" | "cat"> & { items?: { cat?: string }[] })[] = [], extra = "") => {
  const base = fixed(t), mine = [...new Set([...entries.filter(e => e.type === t && e.cat && !base.includes(e.cat)).map(e => e.cat as string), ...entries.filter(e => e.type === t).flatMap(e => (e.items || []).map(i => i.cat || "")).filter(c => c && !base.includes(c)), ...(extra && !base.includes(extra) ? [extra] : [])])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const last = lastCat(t);
  return [...base.filter(c => c !== last && (!isHidden(c) || c === extra)), ...mine, last];
};
