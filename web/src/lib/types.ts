export type EntryType = "rec" | "desp";

export interface Account { id: string; name: string; color: string; label?: string; start: number }
export interface EntryItem { date: string; desc: string; cents: number }
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
