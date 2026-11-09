// PDF → lançamentos. Os leitores (leitores/pdf.js) são os do app atual; aqui só se decide o que vira lançamento:
// fatura de cartão (conferência, "já lançado", mesclar, próximas parcelas, total do banco), holerite, extrato e conta.
import { dataComDia, mesDe, somaMeses } from "./engine";
import type { Backup, ItemBackup } from "./loja";
import { regraDe } from "./orcamento";
import { closeC, invoiceEntry, nameSim, parseConta, parseExtrato, parseHolerite, parseInvoice, parsePassagem, pdfPagesOf, setCatLearn } from "./leitores/pdf.js";
import type { ContaPdf, ExtratoPdf, Fatura, Holerite, Pagina, PassagemPdf } from "./leitores/pdf.js";
import type { Extrato, Linha } from "./extrato";

export const MIN_YM = "2026-09";
export const MIN_DUE = "2026-10-01";

export type Lido =
  | { tipo: "fatura"; r: Fatura } | { tipo: "holerite"; h: Holerite } | { tipo: "extrato"; e: ExtratoPdf }
  | { tipo: "conta"; c: ContaPdf } | { tipo: "passagem"; p: PassagemPdf } | { tipo: "erro"; erro: string };

/** mesma ordem do app atual: holerite → extrato → fatura → passagem (sem banco nem lançamentos) → conta */
export function classificar(pages: Pagina[]): Lido {
  const h = parseHolerite(pages); if (h) return { tipo: "holerite", h };
  const e = parseExtrato(pages); if (e) return { tipo: "extrato", e };
  const f = parseInvoice(pages);
  if (f && (f.bank || f.rows.length)) {
    if (!f.rows.length) return { tipo: "erro", erro: "Achei a fatura, mas nenhuma compra nela. Se for de um banco novo, use “Enviar o formato” no app atual." };
    return { tipo: "fatura", r: f };
  }
  const p = parsePassagem(pages); if (p) return { tipo: "passagem", p };
  const c = parseConta(pages); if (c) return { tipo: "conta", c };
  return { tipo: "erro", erro: "Não reconheci este PDF (fatura, holerite, extrato ou conta). Outros bancos precisam de um PDF de exemplo." };
}

export async function lerPdf(f: File): Promise<Lido> {
  try { return classificar(await pdfPagesOf(f)); } catch (x) {
    const m = String((x as Error)?.message || x);
    if (/password/i.test(m)) return { tipo: "erro", erro: "Este PDF tem senha. Abra e salve sem senha, ou use o app atual (ele pergunta a senha)." };
    if (/offline|pdfjs/i.test(m)) return { tipo: "erro", erro: "Preciso de internet na primeira vez para carregar o leitor de PDF." };
    return { tipo: "erro", erro: "Não consegui ler este PDF." };
  }
}

/** a categoria que ele ensinou (regras) vale antes do chute do leitor */
export function ligarRegras(b: Backup) {
  const validas = new Set(["alim", "merc", "transp", "casa", "saude", "educ", "lazer", "compras", "assin", "outros", ...((b.cfg.cats || []) as { k: string }[]).map(c => c.k)]);
  setCatLearn((tipo, nome) => { if (tipo !== "desp") return null; const k = regraDe(b, nome, [...validas]); return k || null; });
}

const fold = (t: string) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const normParc = (p?: string) => { const m = /^(\d+)\s*\/\s*(\d+)$/.exec(p || ""); return m ? `${+m[1]}/${+m[2]}` : ""; };
const cartoes = (b: Backup) => (b.cfg.cards || {}) as Record<string, { due?: number; close?: number; kind?: string }>;
export const cartaoDoBanco = (b: Backup, banco: string): string => {
  const n = Object.keys(cartoes(b)).filter(k => cartoes(b)[k].kind !== "ben");
  return n.find(k => fold(k) === fold(banco)) || n.find(k => fold(k).includes(fold(banco)) || fold(banco).includes(fold(k))) || "";
};
const dayGap = (a: string, c: string) => Math.abs((Date.parse(a + "T12:00:00Z") - Date.parse(c + "T12:00:00Z")) / 864e5);
const generica = (x: ItemBackup, card: string) => x.card === card && x.cat === "cartao" && /^Fatura /i.test(x.desc || "") && !x.imp;

export type Acao = "add" | "merge" | "done" | "skip";
export interface LinhaPlano {
  i: number; date: string; cents: number; name: string; cat: string; parc: string; fee: boolean; prev: boolean;
  on: boolean; acao: Acao; match?: string; nota: string; depois: { ym: string; parc: string }[];
}
export interface PlanoFatura {
  card: string; banco: string; due: string; bill: string; diaVenc: number; total: number | null; soma: number; velha: boolean; completa: boolean;
  estimado: boolean; jaImportada: boolean; linhas: LinhaPlano[];
}

/** vencimento que o PDF não trouxe: estima pela compra mais recente e pelo dia de vencimento do cartão (e avisa) */
function estimarVenc(b: Backup, card: string, r: Fatura): string {
  const ult = r.rows.map(x => x.date).sort().pop() || "";
  const dia = cartoes(b)[card]?.due || 10;
  if (!ult) return "";
  let d = dataComDia(mesDe(ult), dia); if (d <= ult) d = dataComDia(somaMeses(mesDe(ult), 1), dia);
  return d;
}

export function planoFatura(b: Backup, r: Fatura, card: string, completa = false): PlanoFatura {
  const estimado = !r.due, due = r.due || estimarVenc(b, card, r), bill = mesDe(due), dia = +due.slice(8);
  const velha = due < MIN_DUE && !completa;
  const existentes = b.items.filter(x => x.card === card && mesDe(x.date) === bill && !generica(x, card));
  const usados = new Set<string>();
  const linhas: LinhaPlano[] = r.rows.map((row, i) => {
    const e = invoiceEntry(row), parc = normParc(e.parc), prev = !!row.prev;
    const rule = !e.fee && !prev ? regraDe(b, e.name, ["alim", "merc", "transp", "casa", "saude", "educ", "lazer", "compras", "assin", "outros", ...((b.cfg.cats || []) as { k: string }[]).map(c => c.k)]) : "";
    const cat = rule || e.cat;
    // parcelas seguintes (só as que vencem de out/2026 em diante e ainda não existem)
    const depois: { ym: string; parc: string }[] = [];
    const m = /^(\d+)\/(\d+)$/.exec(parc);
    if (m) for (let k = +m[1] + 1, j = 1; k <= +m[2]; k++, j++) {
      const ym = somaMeses(bill, j), p = `${k}/${+m[2]}`;
      if (dataComDia(ym, dia) < MIN_DUE) continue;
      if (b.items.some(x => x.card === card && mesDe(x.date) === ym && normParc(x.parc) === p && nameSim(x.desc, e.name) >= 0.5)) continue;
      depois.push({ ym, parc: p });
    }
    const base = { i, date: row.date, cents: row.cents, name: e.name, cat, parc, fee: e.fee, prev, depois };
    if (velha) return { ...base, on: depois.length > 0, acao: depois.length ? "add" : "skip", nota: depois.length ? `só as ${depois.length} parcelas que vêm depois` : "fatura antiga: só informativa" } as LinhaPlano;
    const hit = existentes.find(x => !usados.has(x.id) && closeC(x.cents, row.cents) && normParc(x.parc) === parc
      && (nameSim(x.desc, e.name) >= 0.5 || (x.buy && dayGap(x.buy, row.date) <= 2 && (nameSim(x.desc, e.name) >= 0.35 || x.cents === row.cents))));
    if (hit) {
      usados.add(hit.id);
      return hit.imp ? { ...base, on: false, acao: "done", match: hit.id, nota: "já lançado" } : { ...base, on: true, acao: "merge", match: hit.id, nota: `junta com “${hit.desc}” (fica o valor do banco)` };
    }
    return { ...base, on: true, acao: "add", nota: "" };
  });
  const soma = r.rows.reduce((s, x) => s + x.cents, 0);
  const jaImportada = b.items.some(x => x.card === card && x.imp === `fatura-${due}`);
  return { card, banco: String(r.bank || card), due, bill, diaVenc: dia, total: typeof r.total === "number" ? r.total : null, soma, velha, completa, estimado, jaImportada, linhas };
}

export function aplicarFatura(b: Backup, p: PlanoFatura, agora: number, novoId: () => string, hoje: string): { backup: Backup; nAdd: number; nMerge: number } {
  let items = [...b.items], nAdd = 0, nMerge = 0;
  const tag = `fatura-${p.due}`, paga = (ym: string) => dataComDia(ym, p.diaVenc) < hoje && p.completa;
  for (const l of p.linhas) {
    if (!l.on) continue;
    if (l.acao === "merge" && l.match) {
      items = items.map(x => (x.id === l.match ? { ...x, desc: l.name, cat: l.cat, cents: l.cents, buy: l.date, imp: tag } : x)); nMerge++; continue;
    }
    if (l.acao !== "add") continue;
    const grupo = l.parc ? `p${novoId()}` : undefined;
    const mk = (ym: string, parc: string, mesmo: boolean): ItemBackup => ({
      id: novoId(), type: "desp", desc: l.name, cat: l.cat, cents: l.cents, date: dataComDia(ym, p.diaVenc), pay: "Crédito", paid: paga(ym), createdAt: agora,
      ...(paga(ym) ? { paidAt: agora } : {}), card: p.card, buy: l.date, ...(parc ? { parc } : {}), ...(grupo ? { group: grupo } : {}), ...(mesmo ? { imp: tag } : {}),
    });
    if (!p.velha) { items.push(mk(p.bill, l.parc, true)); nAdd++; }
    for (const d of l.depois) { items.push(mk(d.ym, d.parc, false)); nAdd++; }
  }
  // total do banco: o item "Fatura X" é só o valor para conferir (o motor compara com a soma lançada)
  if (!p.velha && p.total != null) {
    const g = items.find(x => generica(x, p.card) && mesDe(x.date) === p.bill);
    if (g) items = items.map(x => (x.id === g.id ? { ...x, cents: p.total as number } : x));
    else items.push({ id: novoId(), type: "desp", desc: `Fatura ${p.card}`, cat: "cartao", cents: p.total, date: dataComDia(p.bill, p.diaVenc), pay: "Crédito", paid: paga(p.bill), createdAt: agora, ...(paga(p.bill) ? { paidAt: agora } : {}), card: p.card });
  }
  const cards = { ...cartoes(b) }; const c0 = cards[p.card] || {};
  cards[p.card] = { ...c0, due: p.estimado ? c0.due : p.diaVenc };
  return { backup: { ...b, items, cfg: { ...b.cfg, cards } }, nAdd, nMerge };
}

// ---------- holerite ----------
export interface PlanoHolerite { h: Holerite; velho: boolean; igual?: ItemBackup; mesmo: boolean; desc: string; date: string }
export function planoHolerite(b: Backup, h: Holerite): PlanoHolerite {
  const key = `holerite-${h.ref}-${h.kind}`, same = b.items.find(x => x.imp === key);
  if (same) return { h, velho: h.date < MIN_YM + "-01", igual: same, mesmo: true, desc: h.kind, date: h.date };
  const ym = mesDe(dataSalario(h.date, /^13/.test(h.kind) ? "d13" : "sal").date), n = fold(h.kind);
  const par = b.items.find(x => x.type === "rec" && mesDe(x.date) === ym && (fold(x.desc) === n || (closeC(x.cents, h.cents) && (x.cat === "sal" || x.cat === "d13" || nameSim(x.desc, h.kind) >= 0.5))));
  return { h, velho: h.date < MIN_YM + "-01", igual: par, mesmo: false, desc: h.kind, date: h.date };
}
const dataSalario = (date: string, cat: string): { date: string; fell?: string } =>
  +date.slice(8) >= 25 ? { date: dataComDia(somaMeses(mesDe(date), 1), 1), fell: date } : { date };

/** guarda o holerite lido em cfg.hol (salário previsto) — mesmo formato do app atual */
export function guardarHolerite(b: Backup, h: Holerite): Backup {
  const k = /adiant/i.test(h.kind) ? "adv" : /^sal/i.test(fold(h.kind)) ? "sal" : /13/.test(h.kind) ? "d13" + (/2\s*[ªa]/i.test(h.kind) ? "2" : "1") : /ferias/.test(fold(h.kind)) ? "fer" : "";
  if (!k || !h.ref) return b;
  const H = { ...((b.cfg.hol || {}) as Record<string, unknown>) }, id = `${h.ref}|${k}`;
  const old = H[id] as { x?: number } | undefined;
  const rec = {
    ref: h.ref, k, date: h.date, liq: h.cents, tp: h.tp || 0, ev: h.ev.map(e => ({ d: e.desc, c: e.cents, s: e.side })), kind: h.kind,
    ...(h.td != null ? { td: h.td } : {}), ...(h.emp ? { emp: h.emp } : {}),
    ...(h.conv ? { conv: { c: h.conv.cents, n: h.conv.n || 0, by: (h.conv.by || []).map(x => ({ k: x.k, c: x.cents, n: x.n })) } } : {}),
    ...(old && old.x ? { x: 1 } : {}),
  };
  H[id] = rec;
  const keep = Object.keys(H).sort().slice(-60);
  return { ...b, cfg: { ...b.cfg, hol: Object.fromEntries(keep.map(x => [x, H[x]])) } };
}

export function aplicarHolerite(b: Backup, p: PlanoHolerite, desc: string, date: string, trocar: string | null, agora: number, novoId: () => string): Backup {
  const h = p.h, sh = dataSalario(date, "sal"), cat = /^13/.test(h.kind) ? "d13" : "sal";
  const dados = {
    type: "rec" as const, desc: desc.trim() || h.kind, cat, cents: h.cents, date: sh.date, pay: "", paid: true, imp: `holerite-${h.ref}-${h.kind}`,
    ...(sh.fell ? { fell: sh.fell } : {}), ...(h.conv ? { conv: h.conv.cents } : {}),
  };
  const nb = guardarHolerite(b, h);
  if (trocar) return { ...nb, items: nb.items.map(x => (x.id === trocar ? { ...x, ...dados } : x)) };
  return { ...nb, items: [...nb.items, { id: novoId(), createdAt: agora, ...dados }] };
}

// ---------- extrato em PDF: vira o mesmo objeto do OFX/CSV e passa pela mesma conferência ----------
export function extratoDoPdf(e: ExtratoPdf): Extrato {
  const linhas: Linha[] = e.rows.map(r => ({ date: r.date, cents: r.cents, kind: r.kind, det: r.det, who: r.who, shop: r.shop, ...(r.pixCred ? { pixCred: true } : {}) }));
  return { banco: e.bank, at: e.at, atTs: e.atTs, saldo: e.bal, de: e.from || e.at, ate: e.to || e.at, linhas };
}

// ---------- conta (luz, internet…) e passagem: abrem o lançamento já preenchido ----------
export interface Rascunho { tipo: "desp"; desc: string; cents: number; cat: string; date: string; pay: string; paid: boolean; nota: string }
export function rascunhoDaConta(c: ContaPdf): Rascunho {
  return { tipo: "desp", desc: c.name, cents: c.cents, cat: "casa", date: c.due, pay: c.auto ? "Débito" : "Boleto", paid: false, nota: c.due < MIN_DUE ? "Vencimento antes de out/2026: só informativo." : "" };
}
export function rascunhoDaPassagem(p: PassagemPdf): Rascunho {
  return { tipo: "desp", desc: `Passagem aérea ${p.from}${p.to ? "–" + p.to : ""}`.trim(), cents: p.cents, cat: "transp", date: p.go, pay: "Crédito", paid: false, nota: p.reserva ? "Reserva ainda não emitida." : "" };
}
