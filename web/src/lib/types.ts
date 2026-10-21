export type EntryType = "rec" | "desp";

/** kind "cartao" = só cartão (Renner…): sem saldo, compras ficam no cartão e não entram no saldo total */
export interface Account { id: string; name: string; color: string; label?: string; start: number; kind?: "cartao"; closeDay?: number; dueDay?: number; limit?: number }
export interface EntryItem { date: string; desc: string; cents: number; cat?: string }
export interface Entry {
  id: string; acct: string; type: EntryType; cents: number; date: string; desc: string;
  cat?: string;
  /** chave de importação (holerite-…, fatura-…, conta-…): o banco recusa repetir a mesma */
  imp?: string;
  /** transferência: duas entradas ligadas por `tr` */
  xfer?: 1; tr?: string;
  /** itens da fatura lida */
  items?: EntryItem[];
  at?: number;
}
export interface Session { at: string; rt: string; exp: number; uid: string; email: string }

export type Currency = "BRL" | "EUR" | "USD";
export interface SaveMove {
  id: string; date: string; cents: number; cur?: Currency; rate?: number; brl?: number; note?: string; bank?: string;
}
export interface SaveBox {
  id: string; name: string; kind?: string; icon?: string; cur: Currency;
  goal?: number; target?: string; moves: SaveMove[];
}
