// Ler um PDF no próprio aparelho (pdf.js) e reconhecer: holerite, fatura de cartão ou conta/boleto.
import { parseConta, parseHolerite, parseInvoice, pdfInfo } from "./parsers";
import type { PdfPage } from "./parsers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Fatura = { bank: string; due: string; rows: { date: string; desc: string; shop: string; cents: number }[]; total?: number | null; close?: string | number };
export type ContaPdf = { name: string; due: string; cents: number; auto?: boolean };
export type HoleriteEv = { side: "p" | "d"; desc: string; cents: number };
export type HoleritePdf = {
  kind: string; cents: number; date: string; ref: string; emp?: string; tp?: number | null; td?: number | null; check?: boolean | null;
  conv?: { cents: number; n?: number; by?: { k: string; n: number; cents: number }[] } | null; ev: HoleriteEv[];
};
export type PdfData = { pages: PdfPage[]; info: any; res?: Fatura; err?: string };
export type ReadResult =
  | { kind: "fatura"; name: string; r: Fatura; pdf?: PdfData; acct?: string; date?: string }
  | { kind: "conta"; name: string; c: ContaPdf; pdf?: PdfData; acct?: string; date?: string }
  | { kind: "holerite"; name: string; h: HoleritePdf; pdf?: PdfData; acct?: string; date?: string }
  | { kind: "erro"; name: string; msg: string; pdf?: PdfData; acct?: string; date?: string };

let PDFJS: any = null;
export const pdfjsVersion = () => (PDFJS && PDFJS.version) || "?";
/** pdf.js 3.11.174 (a mesma versão em que os leitores foram calibrados), carregado só quando alguém lê um PDF */
async function loadPdfJs() {
  if (PDFJS) return PDFJS;
  try {
    const [lib, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.js?url")]);
    const L: any = (lib as any).default && (lib as any).default.getDocument ? (lib as any).default : lib;
    L.GlobalWorkerOptions.workerSrc = (worker as any).default;
    PDFJS = L; return L;
  } catch { throw new Error("offline"); }
}

async function openPdf(file: File): Promise<PdfData> {
  let bytes = new Uint8Array(await file.arrayBuffer()); const info: any = pdfInfo(bytes, file);
  if (info.off > 0) bytes = bytes.subarray(info.off); // alguns apps põem lixo antes do %PDF
  const L = await loadPdfJs(), task = L.getDocument({ data: bytes });
  task.onPassword = (cb: (pw: string) => void, reason: number) => {
    info.senha = (info.senha || 0) + 1;
    const pw = prompt(reason === 2 ? "Senha incorreta. Digite a senha do PDF:" : "Este PDF tem senha. Digite a senha (geralmente parte do CPF):");
    if (pw == null) { info.cancelou = 1; task.destroy(); return; }
    cb(pw);
  };
  const doc = await task.promise, pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
    pages.push({ h: vp.height, w: vp.width, items: tc.items.map((i: any) => ({ s: i.str, x: i.transform[4], w: i.width, t: vp.height - i.transform[5] })) });
  }
  return { pages, info };
}

/** um PDF → {kind:"holerite"|"fatura"|"conta"|"erro", ...}; ordem do app anterior: holerite, fatura, conta */
export async function readOne(file: File): Promise<ReadResult> {
  const name = file.name; let pdf: PdfData | null = null;
  try {
    pdf = await openPdf(file);
    if (!pdf.pages.some(pg => pg.items.some(i => i.s.trim())))
      return { kind: "erro", name, pdf, msg: `Esse PDF não tem texto, só imagem${/ilovepdf|scan|camscanner|adobe scan/i.test(pdf.info.producer) ? ` (passou pelo ${pdf.info.producer})` : ""}. Use o PDF original do banco, sem converter, comprimir ou escanear.` };
    const h = parseHolerite(pdf.pages) as unknown as HoleritePdf | null; if (h) return { kind: "holerite", name, h, pdf };
    const r = parseInvoice(pdf.pages) as unknown as Fatura; pdf.res = r;
    if (r.rows.length) return { kind: "fatura", name, r, pdf };
    const c = parseConta(pdf.pages) as unknown as ContaPdf | null; if (c) return { kind: "conta", name, c, pdf };
    return { kind: "erro", name, pdf, msg: "Não reconheci esse PDF como fatura de cartão, conta ou holerite." };
  } catch (e: any) {
    if (e && e.message === "offline") return { kind: "erro", name, msg: "Sem internet para carregar o leitor de PDF." };
    if (pdf && pdf.info && pdf.info.cancelou) return { kind: "erro", name, msg: "Leitura cancelada." };
    const dp: PdfData = { pages: (pdf && pdf.pages) || [], info: pdf && pdf.info, err: `${(e && e.name) || "Erro"}: ${(e && e.message) || e}` };
    return { kind: "erro", name, msg: pdf ? "O leitor travou nesse PDF." : "Não deu para abrir esse PDF.", pdf: dp };
  }
}
