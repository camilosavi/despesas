import type { EntryType } from "./types";
export const CAT_OUT = ["Mercado", "Alimentação", "Transporte", "Moradia", "Contas", "Cartão", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"];
export const CAT_IN = ["Salário", "Rendimento", "Reembolso", "Outros"];
export const catsOf = (t: EntryType) => (t === "rec" ? CAT_IN : CAT_OUT);
