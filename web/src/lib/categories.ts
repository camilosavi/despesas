import { fold } from "./format";
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

/** palpite pela marca/palavra (regras do app antigo); só nomes de categorias fixas. Vazio = não sei */
const OUT_RULES: [RegExp, string][] = [
  [/supermerc|(?<!mercado\*)mercado(?!\*| ?livre)|atacad|hortifr|feira|acougue|assai|carrefour|pao de acucar/, "Mercado"],
  [/restaur|burg|\bbar\b|pub\b|sorvet|lanch|pizza|cafe|padaria|ifood|food|steak|outback|almoco|jantar|comida|alimenta|mcdonald|starbucks|subway|rappi|nutri/, "Alimentação"],
  [/wellhub|gympass|academ|smart ?fit|decathlon|centauro|netshoes|nike|adidas|under armour|track ?& ?field|esporte|sport|futebol/, "Esporte"],
  [/farm|drog|clinic|saude|otica|medic|consulta|dentist|exame|raia|pacheco/, "Saúde"],
  [/cine|parque|\bshow\b|ingresso|teatro|steam|playstation|\bpsn\b|xbox|nintendo|epic ?games|riot|blizzard|roblox|garena|viage|passeio|lazer|sympla|airbnb|booking|hotel|hospedag|decolar|latam|gol linhas|azul linhas/, "Lazer"],
  [/xsolla|ubisoft|game ?pass|ps ?plus|anthropic|claude|chatgpt|openai|netflix|spotify|youtube|apple\.? ?com|icloud|google|amazon ?prime|prime video|disney|hbo|\bmax\b|globoplay|deezer|crunchyroll|assinat|patreon|udemy|subscription/, "Assinaturas"],
  [/\bclaro\b|\bvivo\b|\btim\b|\boi\b|energia|enel|cpfl|sabesp|internet|telefon|aluguel|condomin|\bluz\b|\bagua\b|\bgas\b|iptu|conta de/, "Casa e contas"],
  [/uber|\b99\b|99 ?pop|posto|combust|gasolin|estacion|onibus|metro|transporte|pedagio|sem parar|carro|moto|bike|shell|ipiranga/, "Transporte"],
  [/escola|faculdade|curso|livro|mensalidade|educa|alura|coursera/, "Educação"],
  [/\biof\b|juros|tarifa|multa|anuidade|encargo|parcelamento de fatura/, "Outros"],
  [/magazine|hobby|caedu|renner|riachuelo|americanas|magalu|amazon|shein|gradi|shopping|presente|mercado ?livre|aliexpress|shopee|loja|shop|roupa|outlet|aramis|jim\.? ?com|shopee|aliexpress/, "Compras"],
];
const IN_RULES: [RegExp, string][] = [
  [/salari|adiant|ferias|\b13|decimo|holerite|folha|plr/, "Salário"],
  [/rend|juros|dividend|cdb|poupanc|tesouro/, "Rendimentos"],
  [/saldo|sobrou|anterior/, "Saldo anterior"],
];
export function guessCat(type: EntryType, desc: string): string {
  const t = fold(desc);
  const hit = (type === "rec" ? IN_RULES : OUT_RULES).find(([re]) => re.test(t));
  return hit ? hit[1] : "";
}
