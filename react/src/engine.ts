// Ponte para o motor de cálculo. Nada é calculado aqui: cada número vem de UMA função em novo/base.
// As telas só importam deste arquivo, então trocar a origem (ou o formato do estado) fica num lugar só.
export * from "../../novo/base/calculo.mjs";
export * from "../../novo/base/datas.mjs";
export * from "../../novo/base/pessoas.mjs";
export { categoria, SEM_CATEGORIA } from "../../novo/base/categorias.mjs";
export { deAppAtual, normalizarBackup } from "../../novo/base/importar.mjs";

export interface Lancamento {
  id: string; nome: string; tipo: "desp" | "rec"; cat?: string; cents: number; data: string;
  pago?: boolean; cartao?: string; conta?: string; compra?: string; caiu?: string; pagoCom?: string;
  recorrente?: boolean; saldoAnterior?: boolean; parcela?: string; criadoEm?: number; pagoEm?: number;
}
export interface Estado {
  hoje: string; inicio?: string;
  lancamentos: Lancamento[];
  contas: { nome: string; cents: number; em: number; moeda?: string }[];
  cartoes: Record<string, { tipo?: "credito" | "beneficio"; venc?: number; limite?: number; cor?: string }>;
  faturas?: { cartao: string; ym: string; valorBanco?: number; importada?: boolean; paga?: boolean; pagaEm?: number }[];
  ajustes?: { em: number; conta: string; cents: number }[];
  pers?: unknown;
  [k: string]: unknown;
}
export type Pers = Record<string, unknown>;
