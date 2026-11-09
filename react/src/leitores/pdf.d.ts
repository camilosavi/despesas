// Tipos dos leitores portados do app atual (pdf.js é JavaScript puro, calibrado com PDFs reais).
export interface Pagina { h: number; w: number; items: { s: string; x: number; w: number; t: number }[] }
export interface LinhaFatura { date: string; desc: string; shop: string; cents: number; prev?: boolean; who?: string; parc?: string; [k: string]: unknown }
export interface Fatura { bank?: string; due?: string; rows: LinhaFatura[]; total?: number | null; close?: number; [k: string]: unknown }
export interface EvHolerite { desc: string; cents: number; side: "p" | "d" }
export interface Holerite {
  kind: string; cents: number; date: string; ref: string; emp: string; tp: number | null; td: number | null; ev: EvHolerite[];
  conv?: { cents: number; n?: number; from?: string; to?: string; by?: { k: string; cents: number; n: number }[] } | null; check: boolean | null;
}
export interface LinhaExtratoPdf { date: string; cents: number; kind: string; det: string; who: string; shop: string; pixCred?: boolean }
export interface ExtratoPdf { bank: string; at: string; atTs: number; bal: number | null; holder: string; rows: LinhaExtratoPdf[]; from: string; to: string }
export interface ContaPdf { name: string; due: string; cents: number; auto: boolean }
export interface PassagemPdf { cents: number; go: string; from: string; to: string; sumOk: boolean; reserva: boolean; until: string; untilHm: string; maxP: number }
export function setCatLearn(fn: ((tipo: string, nome: string) => string | null | undefined) | null): void;
export function parseInvoice(pages: Pagina[]): Fatura | null;
export function parseExtrato(pages: Pagina[]): ExtratoPdf | null;
export function parseConta(pages: Pagina[]): ContaPdf | null;
export function parsePassagem(pages: Pagina[]): PassagemPdf | null;
export function parseHolerite(pages: Pagina[]): Holerite | null;
export function pdfPagesOf(file: File): Promise<Pagina[]>;
export function invoiceEntry(r: LinhaFatura): { name: string; cat: string; parc: string; fee: boolean };
export function isPayCredit(...a: unknown[]): boolean;
export function titleCase(s: string): string;
export function nameSim(a: string, b: string): number;
export function closeC(a: number, b: number): boolean;
