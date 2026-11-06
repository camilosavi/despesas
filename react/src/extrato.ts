// Extrato da conta (OFX e CSV do Inter) → conferência → lançamentos. Porta do `readOfx`/`readExtratoCsv`/`extPlan` do app atual.
import type { Backup, ItemBackup } from "./loja";
import { regraDe } from "./orcamento";

export interface Linha { date: string; cents: number; kind: string; det: string; who: string; shop: string; pixCred?: boolean }
export interface Extrato { banco: string; at: string; atTs: number; saldo: number | null; de: string; ate: string; linhas: Linha[] }
export type Lido = { ok: true; extrato: Extrato } | { ok: false; erro: string };

export const fold = (t: string) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const titulo = (s: string) => s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_m, a: string, c: string) => a + c.toUpperCase());
const loja = (s: string) => { s = String(s || ""); return (s.length > 30 ? s.slice(0, 22) : s.replace(/\s{2,}.*$/, "")).trim(); };

/** linha no formato do Inter: tipo + "detalhe" (igual no PDF, OFX e CSV). Pix "Cp :99999999-NOME" → quem; "No estabelecimento LOJA" → loja */
export function extRow(date: string, cents: number, kind: string, det: string): Linha {
  const who = /^(?:Cp\s*:\s*)?[\d ]+-?\s*(.+)$/.exec(det), shop = /^No estabelecimento\s+(.+)$/i.exec(det);
  return { date, cents, kind, det, who: shop ? "" : who ? who[1].trim() : det, shop: shop ? shop[1].trim() : "" };
}
/** "Crédito liberado · Pix no Crédito" e o Pix enviado de mesmo valor e dia: o valor vai na fatura, não na conta */
export function marcarPixCred(rows: Linha[]) {
  for (const r of rows) {
    if (/cr[eé]dito liberado/i.test(fold(r.kind)) && /pix no cr[eé]dito/i.test(fold(r.det) || fold(r.who))) {
      r.pixCred = true;
      const o = rows.find(q => !q.pixCred && q.cents < 0 && q.cents === -r.cents && q.date === r.date && /pix/i.test(fold(q.kind)));
      if (o) o.pixCred = true;
    }
  }
}

export async function lerTexto(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("windows-1252").decode(buf); }
}

const OFX_BANCOS: Record<string, string> = { "260": "Nubank", "341": "Itaú", "237": "Bradesco", "104": "Caixa", "1": "Banco do Brasil", "33": "Santander", "77": "Inter", "336": "C6", "290": "PagBank", "380": "PicPay", "323": "Mercado Pago", "623": "Pan", "212": "Original", "756": "Sicoob", "748": "Sicredi", "655": "Neon", "208": "BTG" };
const ORGS: [RegExp, string][] = [[/nu ?pagamentos|nubank/i, "Nubank"], [/ita[uú]/i, "Itaú"], [/bradesco/i, "Bradesco"], [/caixa/i, "Caixa"], [/banco do brasil|\bbb\b/i, "Banco do Brasil"], [/santander/i, "Santander"], [/inter\b/i, "Inter"], [/c6/i, "C6"], [/pagseguro|pagbank/i, "PagBank"], [/picpay/i, "PicPay"], [/mercado ?pago/i, "Mercado Pago"], [/\bpan\b/i, "Pan"]];
const tv = (b: string, t: string) => { const m = new RegExp("<" + t + ">\\s*([^<\\r\\n]*)", "i").exec(b); return m ? m[1].trim() : ""; };
const dt = (v: string) => (v && v.length >= 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : "");
const cen = (v: string) => Math.round(parseFloat(String(v).replace(",", ".")) * 100) || 0;
const fimDoDia = (d: string) => new Date(d + "T23:59:00").getTime();

export function lerOfx(txt: string, hoje: string): Lido {
  if (/<CCSTMTRS>/i.test(txt)) return { ok: false, erro: "Esse OFX é de cartão de crédito. Por enquanto a fatura só entra pelo app atual." };
  const bid = tv(txt, "BANKID") || tv(txt, "FID"), org = tv(txt, "ORG");
  const banco = OFX_BANCOS[bid.replace(/^0+/, "")] || ORGS.find(([re]) => re.test(org))?.[1] || (org ? titulo(org.replace(/^banco\s+/i, "")) : "") || "Conta";
  const T = txt.split(/<STMTTRN>/i).slice(1).map(b => {
    b = b.split(/<\/STMTTRN>/i)[0];
    return { type: tv(b, "TRNTYPE"), date: dt(tv(b, "DTPOSTED")), cents: cen(tv(b, "TRNAMT")), memo: (tv(b, "MEMO") || tv(b, "NAME")).replace(/\s+/g, " ").trim(), name: tv(b, "NAME") };
  }).filter(t => t.date && t.cents);
  if (!T.length) return { ok: false, erro: "Esse OFX não tem movimentos." };
  const inter = T.length >= 3 && T.filter(t => /^[^:"]+:\s*".*"$/.test(t.memo)).length >= T.length * 0.7;
  const linhas: Linha[] = inter ? T.map(t => {
    const m = /^([^:"]+):\s*"(.*)"$/.exec(t.memo);
    if (!m) return extRow(t.date, t.cents, t.memo, t.name);
    const r = extRow(t.date, t.cents, m[1].trim(), m[2].trim());
    if (!r.shop && /^Cp\s*:/i.test(m[2]) && t.name) r.who = t.name; // o NAME traz o nome completo
    return r;
  }) : T.map(t => {
    const parts = t.memo.split(/\s+-\s+/);
    let kind = parts.length > 1 ? parts[0] : t.memo, det = parts.length > 1 ? parts[1] : "";
    if (parts.length < 2 && /^(pix|ted|doc|transf)/i.test(t.memo)) {
      kind = t.memo.split(" ").slice(0, 2).join(" ");
      det = t.memo.replace(/^(pix|ted|doc|transf\w*)\s*(transf\w*|enviad\w*|recebid\w*|qrs?|qr code|env|rec)?\s*/i, "").replace(/\s\d{2}\/\d{2}$/, "").trim();
    }
    const deb = /compra|d[eé]bito|cart[aã]o|^pos$/i.test(kind) || t.type === "POS";
    return { date: t.date, cents: t.cents, kind, det, who: deb ? "" : det, shop: deb ? (det || t.memo).replace(/\s{2,}.*$/, "") : "" };
  });
  marcarPixCred(linhas);
  const bal = tv(txt, "BALAMT"), asof = tv(txt, "DTASOF"), at = dt(asof) || hoje;
  const atTs = asof.length >= 12 ? new Date(+asof.slice(0, 4), +asof.slice(4, 6) - 1, +asof.slice(6, 8), +asof.slice(8, 10), +asof.slice(10, 12)).getTime() : fimDoDia(at);
  const ds = T.map(t => t.date).sort();
  return { ok: true, extrato: { banco, at, atTs, saldo: bal ? cen(bal) : null, de: dt(tv(txt, "DTSTART")) || ds[0], ate: dt(tv(txt, "DTEND")) || ds[ds.length - 1], linhas } };
}

/** CSV "Extrato Conta Corrente" do Inter: `Data Lançamento;Histórico;Descrição;Valor;Saldo`, vírgula decimal */
export function lerCsvInter(txt: string): Lido {
  const L = txt.replace(/^﻿/, "").split(/\r?\n/);
  const hi = L.findIndex(l => /^Data Lan[çc]amento;Hist[óo]rico;Descri[çc][ãa]o;Valor;Saldo/i.test(l.trim()));
  if (hi < 0) return { ok: false, erro: "Esse CSV não é o extrato do Inter. Outras planilhas entram pelo app atual (Importar planilha)." };
  const num = (s: string) => { s = String(s || "").trim(); if (!s) return null; const n = Math.round(parseFloat(s.replace(/\./g, "").replace(",", ".")) * 100); return isNaN(n) ? null : n; };
  const dd = (s: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
  const linhas: Linha[] = [];
  for (const l of L.slice(hi + 1)) {
    const c = l.split(";"); if (c.length < 4) continue;
    const date = dd(c[0]), v = num(c[3]); if (!date || !v) continue;
    const kind = c[1].trim(), det = (c[2] || "").trim(), deb = /compra no d[eé]bito/i.test(kind);
    const r = extRow(date, v, kind, deb ? "No estabelecimento " + loja(det) : det.replace(/\s{2,}.*$/, ""));
    if (!deb && /pix|transfer/i.test(fold(kind))) r.who = det;
    linhas.push(r);
  }
  if (!linhas.length) return { ok: false, erro: "Esse CSV não tem movimentos." };
  const head = L.slice(0, hi).join("\n"), per = /Per[íi]odo\s*;\s*(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(head), sb = /^Saldo\s*;\s*([-\d.,]+)/im.exec(head);
  const ds = linhas.map(r => r.date).sort(), ate = per ? `${per[6]}-${per[5]}-${per[4]}` : ds[ds.length - 1], de = per ? `${per[3]}-${per[2]}-${per[1]}` : ds[0];
  marcarPixCred(linhas);
  return { ok: true, extrato: { banco: "Inter", at: ate, atTs: fimDoDia(ate), saldo: sb ? num(sb[1]) : null, de, ate, linhas } };
}

export async function lerExtrato(f: File, hoje: string): Promise<Lido> {
  try {
    const t = await lerTexto(f);
    if (/\.csv$/i.test(f.name)) return lerCsvInter(t);
    if (/OFXHEADER|<OFX>/i.test(t.slice(0, 2000)) || /\.(ofx|qfx)$/i.test(f.name)) return lerOfx(t, hoje);
    return { ok: false, erro: "Use um arquivo OFX/QFX ou o CSV do extrato do Inter." };
  } catch { return { ok: false, erro: "Não consegui ler esse arquivo." }; }
}

// ---------- conferência ----------
export type Acao = "add" | "pay" | "done" | "skip" | "transf";
export interface Item { i: number; date: string; cents: number; type: "desp" | "rec"; tag: string; on: boolean; acao: Acao; nota: string; rot: string; desc?: string; cat?: string; pay?: string; match?: string; outra?: string; outras?: string[]; de?: string }

const CHUTES: [RegExp, string][] = [
  [/mercado|supermerc|atacad|hortifruti|sacolao|assai|carrefour|extra\b|dia\b/, "merc"], [/posto|combust|shell|ipiranga|uber|99 ?pop|99app|estaciona|pedagio|sem parar/, "transp"],
  [/farmac|drogar|droga ?raia|pacheco|hospital|clinica|laborat|dentist/, "saude"], [/ifood|restaur|padaria|lanchon|pizz|burger|cafe|sorvet|bar\b|rappi/, "alim"],
  [/netflix|spotify|youtube|prime|disney|hbo|icloud|google one|apple/, "assin"], [/cinema|ingresso|steam|playstation|xbox/, "lazer"],
];
export const chutarCategoria = (nome: string): string => CHUTES.find(([re]) => re.test(fold(nome)))?.[1] || "";

/** 3 dias de diferença (ou menos) entre duas datas ISO */
const perto = (a?: string, b?: string) => !!a && !!b && Math.abs((Date.parse(a) - Date.parse(b)) / 864e5) <= 3;
const proximo = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.round(Math.max(a, b) * 0.005));

export function planoExtrato(b: Backup, e: Extrato, nomeUsuario = ""): Item[] {
  const usados = new Set<string>(), itens = b.items;
  const contas = ((b.cfg.accts || []) as { name: string; cur?: string }[]).filter(a => !a.cur || a.cur === "BRL").map(a => a.name);
  const minha = contas.find(n => fold(n) === fold(e.banco)) || contas.find(n => fold(n).includes(fold(e.banco))), outras = contas.filter(n => n !== minha);
  const eu = fold(nomeUsuario);
  const validas = { desp: ["alim", "merc", "transp", "casa", "saude", "educ", "lazer", "compras", "assin", "outros", ...(((b.cfg.cats || []) as { k: string }[]).map(c => c.k))], rec: ["sal", "d13", "extra", "rend", "rout", ...(((b.cfg.catsRec || []) as { k: string }[]).map(c => c.k))] };
  return e.linhas.map((r, i): Item => {
    const saida = r.cents < 0, cents = Math.abs(r.cents), k = fold(r.kind), type: "desp" | "rec" = saida ? "desp" : "rec";
    const tag = `extrato-${e.banco}-${r.date}-${r.cents}-${fold(r.shop || r.who || r.det).split(" ")[0].slice(0, 8)}`;
    const rot = `${/pix/.test(k) ? (saida ? "Pix para " : "Pix de ") : ""}${titulo(r.shop || r.who || r.det || r.kind) || r.kind}`;
    const base = { i, date: r.date, cents, type, tag, on: false, acao: "skip" as Acao, nota: "", rot };
    if (itens.some(x => x.imp === tag)) return { ...base, acao: "done", nota: "já importado" };
    if (r.pixCred) return { ...base, nota: saida ? "Pix no crédito: entra na fatura do cartão" : "crédito do Pix no crédito" };
    if (/sal[aá]rio/.test(k)) {
      const sh = itens.find(x => x.type === "rec" && x.cat === "sal" && proximo(x.cents, cents) && perto(x.fell || x.date, r.date));
      return { ...base, acao: sh ? "done" : "skip", nota: sh ? `já lançado como “${sh.desc}”` : "salário: lance pelo holerite (o líquido é o do holerite)" };
    }
    const proprio = !!r.who && !!eu && (fold(r.who) === eu || fold(r.who).startsWith(eu.split(" ").slice(0, 2).join(" ")));
    if (proprio) {
      if (minha && outras.length) {
        const ja = ((b.cfg.transf || []) as { imp?: string; cents: number; date: string; from: string; to: string }[]).some(t => t.imp === tag || (t.cents === cents && perto(t.date, r.date) && Math.abs(Date.parse(t.date) - Date.parse(r.date)) <= 864e5 && (saida ? t.from === minha : t.to === minha)));
        if (ja) return { ...base, acao: "done", nota: "transferência já registrada" };
        const outra = outras.length === 1 ? outras[0] : "";
        return { ...base, acao: "transf", on: !!outra, outra, outras, de: minha, nota: saida ? "transferência para outra conta sua" : "transferência de outra conta sua" };
      }
      return { ...base, nota: saida ? "transferência para outra conta sua" : "transferência de outra conta sua" };
    }
    if (/resgate|aplica|cdb|poupan|invest/.test(k + " " + fold(r.det))) return { ...base, nota: "investimento" };
    if (/fatura|parcelamento/.test(k + " " + fold(r.det))) return { ...base, nota: "pagamento de cartão: marque a fatura como paga na tela do cartão" };
    const hit = itens.find(x => !usados.has(x.id) && x.type === type && !x.card && proximo(x.cents, cents) && (perto(x.date, r.date) || perto(x.buy, r.date) || perto(x.fell, r.date)));
    if (hit) {
      usados.add(hit.id);
      if (type === "desp" && !hit.paid) return { ...base, acao: "pay", on: true, match: hit.id, nota: `marca como pago “${hit.desc}”` };
      return { ...base, acao: "done", match: hit.id, nota: `já lançado como “${hit.desc}”` };
    }
    let desc: string, pay: string, cat: string;
    if (r.shop) { desc = titulo(r.shop); pay = "Débito"; cat = chutarCategoria(desc) || "outros"; }
    else if (/pix/.test(k)) { desc = saida ? `Pix para ${titulo(r.who || "")}` : `Pix de ${titulo(r.who || "")}`; pay = "Pix"; cat = saida ? "outros" : "rout"; }
    else { desc = titulo(r.det || r.kind); pay = /debito|d[eé]bito/.test(k) ? "Débito" : "Pix"; cat = saida ? "outros" : "rout"; }
    cat = regraDe(b, desc, validas[type]) || cat;
    return { ...base, acao: "add", on: true, desc: desc.trim(), cat, pay };
  });
}

/** contas (R$) para onde vai o saldo do extrato: a que tem o nome do banco, senão uma nova com o nome dele */
export const contaDoExtrato = (b: Backup, banco: string): { nome: string; existe: boolean; cents?: number; atTs?: number } => {
  const a = ((b.cfg.accts || []) as { name: string; cents: number; atTs?: number; cur?: string }[]).filter(x => !x.cur || x.cur === "BRL");
  const f = a.find(x => fold(x.name) === fold(banco)) || a.find(x => fold(x.name).includes(fold(banco)));
  return f ? { nome: f.name, existe: true, cents: f.cents, atTs: f.atTs } : { nome: banco, existe: false };
};

/** grava o que está marcado. Cada lançamento leva `imp` (não entra duas vezes) e `paidAt`/`createdAt` = meia-noite do dia do movimento,
 *  então não mexe de novo no saldo informado (que vale a partir do fim do extrato). */
export function aplicarExtrato(b: Backup, e: Extrato, plano: Item[], atualizarSaldo: boolean, agora: number): { backup: Backup; n: number } {
  const meia = (d: string) => new Date(d + "T00:00:00").getTime();
  const conta = contaDoExtrato(b, e.banco), muitas = ((b.cfg.accts || []) as unknown[]).length >= 2 || (!conta.existe && ((b.cfg.accts || []) as unknown[]).length >= 1);
  let items = b.items, transf = ((b.cfg.transf || []) as unknown[]).slice(), n = 0;
  const novos: ItemBackup[] = [];
  for (const p of plano) {
    if (!p.on) continue;
    if (p.acao === "transf") {
      if (!p.outra || !p.de) continue;
      transf.push({ id: `t${agora}${n}`, ts: meia(p.date), date: p.date, from: p.type === "desp" ? p.de : p.outra, to: p.type === "desp" ? p.outra : p.de, cents: p.cents, imp: p.tag }); n++;
    } else if (p.acao === "pay") {
      items = items.map(x => (x.id === p.match ? { ...x, paid: true, paidAt: meia(p.date) } : x)); n++;
    } else if (p.acao === "add") {
      const ts = meia(p.date);
      novos.push({ id: `x${agora.toString(36)}${novos.length.toString(36)}${Math.random().toString(36).slice(2, 5)}`, type: p.type, desc: p.desc || p.rot, cat: p.cat || (p.type === "desp" ? "outros" : "rout"), cents: p.cents, date: p.date,
        pay: p.pay || "Pix", paid: true, ...(p.type === "desp" ? { paidAt: ts } : {}), imp: p.tag, createdAt: ts, ...(muitas ? { acct: conta.nome } : {}) }); n++;
    }
  }
  transf = transf.slice(-500);
  let accts = ((b.cfg.accts || []) as { id: string; name: string; cents: number; at: string; atTs?: number }[]).slice();
  if (atualizarSaldo && e.saldo != null && !(conta.existe && (conta.atTs || 0) > e.atTs)) {
    const i = accts.findIndex(a => a.name === conta.nome), nova = { id: i >= 0 ? accts[i].id : `a${agora}`, name: conta.nome, cents: e.saldo, at: e.at, atTs: e.atTs };
    accts = i >= 0 ? accts.map((a, k) => (k === i ? { ...a, ...nova } : a)) : [...accts, nova];
  }
  return { backup: { ...b, items: [...items, ...novos], cfg: { ...b.cfg, accts, ...(transf.length ? { transf } : {}) } }, n };
}
