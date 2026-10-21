import { isHidden } from "./catcolor";
import type { Entry, EntryType } from "./types";
export const CAT_OUT = ["Mercado", "Alimentação", "Transporte", "Moradia", "Contas", "Cartão", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"];
export const CAT_IN = ["Salário", "Rendimento", "Reembolso", "Outros"];
const fixed = (t: EntryType) => (t === "rec" ? CAT_IN : CAT_OUT);
export const isFixedCat = (c: string) => CAT_OUT.includes(c) || CAT_IN.includes(c);
/** categorias do tipo: as fixas + as que ele criou (qualquer nome usado em lançamentos; não há lista a sincronizar), "Outros" por último */
export const catsOf = (t: EntryType, entries: (Pick<Entry, "type" | "cat"> & { items?: { cat?: string }[] })[] = [], extra = "") => {
  const base = fixed(t), mine = [...new Set([...entries.filter(e => e.type === t && e.cat && !base.includes(e.cat)).map(e => e.cat as string), ...entries.filter(e => e.type === t).flatMap(e => (e.items || []).map(i => i.cat || "")).filter(c => c && !base.includes(c)), ...(extra && !base.includes(extra) ? [extra] : [])])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...base.filter(c => c !== "Outros" && (!isHidden(c) || c === extra)), ...mine, "Outros"];
};
