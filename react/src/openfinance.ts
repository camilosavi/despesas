// Open Finance (Meu Pluggy) pelo servidor do próprio usuário. Porta do `ofApi/ofFetch/ofExtrato/ofFatura/ofSync/ofCount` do app atual.
// A Pluggy só entrega os dados; tudo que vira lançamento passa pela mesma conferência do extrato e da fatura em PDF.
import type { Backup } from "./loja";
import type { Extrato, Linha } from "./extrato";
import type { Fatura } from "./leitores/pdf.js";
import { titleCase } from "./leitores/pdf.js";
import { planoExtrato } from "./extrato";
import { cartaoDoBanco, planoFatura } from "./fatura";

export const OF_KEY = "despesas.of", OF_AUTO = "despesas.ofAuto", OF_MEU = 200;
export const OF_SDK = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";

export interface OfItem { id: string; name: string; at: string }
export interface OfCfg { url?: string; key?: string; items?: OfItem[] }
export interface OfTx {
  id?: string; date: string; description?: string; descriptionRaw?: string; amount: number; type?: string; category?: string; status?: string;
  creditCardMetadata?: { installmentNumber?: number; totalInstallments?: number; purchaseDate?: string; billId?: string };
  paymentData?: { paymentMethod?: string; payer?: { name?: string }; receiver?: { name?: string } };
}
export interface OfAcc {
  id: string; type: string; subtype?: string; name?: string; marketingName?: string; balance?: number; currencyCode?: string;
  creditData?: { creditLimit?: number; availableCreditLimit?: number; balanceDueDate?: string; balanceCloseDate?: string; minimumPayment?: number; status?: string };
  _tx?: OfTx[];
}
export interface OfItemInfo { lastUpdatedAt?: string; nextAutoSyncAt?: string; status?: string; pluggyError?: { message?: string }; old?: boolean }
export interface OfVisao { id: string; acc: OfAcc[]; from: string; it?: OfItemInfo; at: string }
export interface OfAutoCfg { chk?: number; seen?: Record<string, string> }

const ler = <T,>(k: string): T => { try { return (JSON.parse(localStorage.getItem(k) || "{}") || {}) as T; } catch { return {} as T; } };
const gravar = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ok */ } };
export const ofCfg = (): OfCfg => ler<OfCfg>(OF_KEY);
export const ofSet = (p: Partial<OfCfg>) => gravar(OF_KEY, { ...ofCfg(), ...p });
export const ofPronto = () => { const c = ofCfg(); return !!(c.url && c.key); };
export const ofAutoCfg = (): OfAutoCfg => ler<OfAutoCfg>(OF_AUTO);

/** endereço e chave do servidor: só https, chave com 8+ letras */
export function ofServidor(url: string, key: string): { ok: true; url: string; key: string } | { ok: false; erro: string } {
  let u = url.trim(); const k = key.trim();
  if (u && !/^https?:\/\//.test(u)) u = "https://" + u;
  if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(u)) return { ok: false, erro: "Endereço do servidor inválido." };
  if (k.length < 8) return { ok: false, erro: "Chave muito curta." };
  return { ok: true, url: u.replace(/\/+$/, ""), key: k };
}

export async function ofApi<T = any>(path: string, cfg: OfCfg = ofCfg(), f: typeof fetch = fetch): Promise<T> {
  let r: Response;
  try { r = await f((cfg.url || "").replace(/\/+$/, "") + path, { headers: { "x-app-key": cfg.key || "" } }); } catch { throw new Error("sem conexão com o servidor"); }
  if (r.status === 401) throw new Error("a chave do servidor não confere");
  if (!r.ok) throw new Error("servidor respondeu " + r.status);
  const d = await r.json().catch(() => null);
  if (!d) throw new Error("resposta estranha do servidor");
  if (d.error) throw new Error(String(d.error));
  if (d.message && !d.results && !d.accessToken) throw new Error("Pluggy: " + d.message);
  return d as T;
}

export const ofDia = (v: string | number): string => {
  const d = new Date(v); if (isNaN(+d)) return String(v).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const ofCents = (v: unknown) => Math.round((+(v as number) || 0) * 100);
const ofLoja = (s?: string) => { const t = String(s || ""); return (t.length > 30 ? t.slice(0, 22) : t.replace(/\s{2,}.*$/, "")).trim(); };
const fold = (t: string) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** conexão → contas + movimentos dos últimos 45 dias (mais novos primeiro) */
export async function ofBuscar(id: string, cfg: OfCfg = ofCfg(), it?: OfItemInfo, f: typeof fetch = fetch, agora = Date.now()): Promise<OfVisao> {
  const a = await ofApi<{ results?: OfAcc[] }>("/accounts?itemId=" + encodeURIComponent(id), cfg, f), acc = a.results || [];
  if (!it) { try { it = await ofApi<OfItemInfo>("/item?itemId=" + encodeURIComponent(id), cfg, f); } catch (e) { it = { old: /404|not found/i.test((e as Error).message) }; } }
  const from = new Date(agora - 45 * 864e5).toISOString().slice(0, 10);
  for (const x of acc) {
    const t = await ofApi<{ results?: OfTx[] }>("/transactions?accountId=" + encodeURIComponent(x.id) + "&from=" + from, cfg, f);
    x._tx = (t.results || []).sort((p, q) => String(q.date).localeCompare(String(p.date)));
  }
  return { id, acc, from, it, at: new Date(agora).toISOString() };
}

/** hora em que o banco atualizou (é dela que valem saldo e limite); sem /item, a hora da busca */
export const ofUpdTs = (v: OfVisao): number => { const u = v.it?.lastUpdatedAt && Date.parse(v.it.lastUpdatedAt); return u || Date.parse(v.at) || Date.now(); };

export function ofBanco(v: OfVisao, acc: OfAcc): string {
  const b = v.acc.find(x => x.type === "BANK"), n = String((b || acc).name || "").replace(/^Banco\s+/i, "").trim();
  return /inter\b/i.test(n) ? "Inter" : titleCase(n) || "Conta";
}

/** conta corrente → o mesmo objeto do leitor de extrato */
export function ofExtrato(v: OfVisao, acc: OfAcc): Extrato {
  const tx = acc._tx || [], at = new Date(ofUpdTs(v));
  const credLib = tx.filter(t => /^Cr[eé]dito liberado.*Pix no Cr[eé]dito/i.test(t.description || ""));
  const linhas: Linha[] = tx.filter(t => t.status !== "PENDING").map(t => {
    const d = String(t.description || ""), m = /^(.+?)\s+-\s+(.*)$/.exec(d), cents = ofCents(t.amount);
    let kind = (m ? m[1] : d).trim(); const det = (m ? m[2] : "").replace(/^null$/i, "").trim();
    const rcv = t.paymentData?.receiver?.name || "";
    if (/fatura/i.test(d) || /^REALIZE\b/i.test(rcv) || t.category === "Credit card payment") kind = "Pagamento de fatura";
    const deb = /compra no d[eé]bito/i.test(kind);
    const pixCred = /^Cr[eé]dito liberado/i.test(d) || (cents < 0 && /pix/i.test(kind) && credLib.some(c => ofCents(c.amount) === -cents && c.date === t.date));
    return { date: ofDia(t.date), cents, kind, det, who: deb ? "" : det, shop: deb ? ofLoja(det) : "", ...(pixCred ? { pixCred: true } : {}) } as Linha;
  }).filter(r => r.cents);
  return { banco: ofBanco(v, acc), at: ofDia(+at), atTs: +at, saldo: ofCents(acc.balance), de: v.from, ate: ofDia(+at), linhas };
}

/** Pix no crédito: a fatura só diz "PIX CRED PARCELADO"; o Pix que saiu da conta (mesmo dia ±1, 1× a 1,6× o total das parcelas) diz para quem foi */
function pixQuem(v: OfVisao, rows: { desc: string; date: string; cents: number; n: number; who?: string }[]) {
  const px: { day: string; c: number; who: string }[] = [];
  for (const a of v.acc.filter(x => x.type === "BANK")) {
    const cred = (a._tx || []).filter(t => /^Cr[eé]dito liberado.*Pix no Cr[eé]dito/i.test(t.description || ""));
    for (const t of a._tx || []) {
      const c = ofCents(t.amount), d = String(t.description || "");
      const eh = c < 0 && /pix/i.test(d) && cred.some(k => ofCents(k.amount) === -c && k.date === t.date);
      const who = t.paymentData?.receiver?.name || (/^.+?\s+-\s+(.*)$/.exec(d)?.[1] ?? "");
      if (eh && who) px.push({ day: ofDia(t.date), c: -c, who });
    }
  }
  if (!px.length) return;
  const cand: { i: number; j: number; s: number }[] = [];
  rows.forEach((r, i) => {
    if (!/^PIX CRED/i.test(r.desc)) return;
    const tot = r.cents * (r.n || 1);
    px.forEach((p, j) => { const dd = Math.abs((Date.parse(r.date) - Date.parse(p.day)) / 864e5), q = tot / p.c; if (dd <= 1 && q >= 0.99 && q <= 1.6) cand.push({ i, j, s: dd + Math.abs(q - 1.15) }); });
  });
  const ui = new Set<number>(), uj = new Set<number>();
  cand.sort((a, b) => a.s - b.s).forEach(c => { if (ui.has(c.i) || uj.has(c.j)) return; ui.add(c.i); uj.add(c.j); rows[c.i].who = px[c.j].who; });
}

const shiftMes = (ym: string, d: number) => { let [y, m] = ym.split("-").map(Number); m += d; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; };

/** cartão → a fatura em aberto (movimentos sem billId); vencimento = balanceDueDate + 1 mês */
export function ofFatura(v: OfVisao, acc: OfAcc): Fatura {
  const cd = acc.creditData || {}, last = cd.balanceDueDate ? String(cd.balanceDueDate).slice(0, 10) : "";
  const due = last ? shiftMes(last.slice(0, 7), 1) + last.slice(7) : "";
  const rows = (acc._tx || []).filter(t => !t.creditCardMetadata?.billId && !/^(PAGAMENTO|PAGTO|DEB AUT)/i.test(t.description || "")).map(t => {
    const m = t.creditCardMetadata || {}, nome = ofLoja(t.description), n = m.totalInstallments || 1;
    const desc = n > 1 ? `${nome === nome.toUpperCase() ? titleCase(nome) : nome} Parc. ${m.installmentNumber}/${n}` : nome;
    return { date: ofDia(t.date), desc, shop: "", cents: ofCents(t.amount), n, who: undefined as string | undefined };
  });
  pixQuem(v, rows);
  return { bank: ofBanco(v, acc), due, rows: rows.map(({ n: _n, who, ...r }) => (who ? { ...r, who } : r)), total: null, close: cd.balanceCloseDate ? +String(cd.balanceCloseDate).slice(8, 10) : 0 };
}

/** o dia de vencimento do banco troca o digitado à mão; só não troca quando o banco empurrou do fim de semana para segunda */
export function dueFix(cur: number | undefined, iso: string, banco?: boolean): boolean {
  if (!iso) return false; const d = +iso.slice(8); if (!cur) return true; if (+cur === d) return false; if (!banco) return true;
  const [y, m] = iso.slice(0, 7).split("-").map(Number), wd = new Date(y, m - 1, +cur).getDay(), gap = d - cur;
  return !(new Date(y, m - 1, d).getDay() === 1 && (wd === 0 || wd === 6) && gap > 0 && gap <= 2);
}

/** a cada busca: saldo da conta vira o Saldo na conta e o livre do cartão vira o "livre no banco" (só se for mais novo que o do app; cartão só se já existe) */
export function ofSync(b: Backup, v: OfVisao): Backup {
  const ts = ofUpdTs(v), dia = ofDia(ts), cfg = { ...b.cfg };
  const bank = v.acc.find(x => x.type === "BANK");
  if (bank && bank.balance != null) {
    const nome = ofBanco(v, bank), A = ((cfg.accts || []) as any[]).map(a => ({ ...a }));
    let j = A.findIndex(a => fold(a.name) === fold(nome)); if (j < 0) j = A.findIndex(a => fold(a.name).includes(fold(nome)));
    const row = { cents: ofCents(bank.balance), at: dia, atTs: ts };
    if (j < 0) { A.push({ id: "a" + ts, name: nome, ...row }); cfg.accts = A; }
    else if ((A[j].atTs || 0) < ts) { A[j] = { ...A[j], ...row }; cfg.accts = A; }
  }
  const cr = v.acc.find(x => x.type === "CREDIT"), cd = cr?.creditData || {};
  if (cr && cd.availableCreditLimit != null) {
    const c = cartaoDoBanco(b, ofBanco(v, cr));
    const k = c ? { ...((cfg.cards || {})[c] || {}) } : null;
    if (c && k && (k.bankAtTs || 0) < ts) {
      Object.assign(k, { bankFree: ofCents(cd.availableCreditLimit), bankAt: dia, bankAtTs: ts });
      if (!k.limit && cd.creditLimit) k.limit = ofCents(cd.creditLimit);
      if (cd.balanceDueDate) { const dd = ofDia(cd.balanceDueDate); if (dueFix(k.due, dd, k.dueBank)) { k.due = +dd.slice(8); k.dueBank = 1; } }
      if (cd.balanceCloseDate && !k.close) k.close = +ofDia(cd.balanceCloseDate).slice(8);
      cfg.cards = { ...(cfg.cards || {}), [c]: k };
    }
  }
  return cfg.accts === b.cfg.accts && cfg.cards === b.cfg.cards ? b : { ...b, cfg };
}

/** quantos movimentos ainda não estão no app: conta (marcados na conferência) e fatura (sem parecido) */
export function ofContar(b: Backup, v: OfVisao, nomeUsuario = ""): { ext: number; fat: number; banco: string } {
  let ext = 0, fat = 0;
  const bank = v.acc.find(x => x.type === "BANK"), cr = v.acc.find(x => x.type === "CREDIT");
  if (bank) ext = planoExtrato(b, ofExtrato(v, bank), nomeUsuario).filter(p => p.on).length;
  if (cr) {
    const f = ofFatura(v, cr), c = cartaoDoBanco(b, String(f.bank || ""));
    fat = c && f.due ? planoFatura(b, f, c).linhas.filter(l => l.cents > 0 && l.acao === "add").length : f.rows.filter(r => r.cents > 0).length;
  }
  return { ext, fat, banco: ofBanco(v, bank || cr || ({} as OfAcc)) };
}

export interface OfNovidade { id: string; ext: number; fat: number; banco: string; v: OfVisao }
export const ofVisto = (v: OfVisao) => { const a = ofAutoCfg(); a.seen = { ...(a.seen || {}), [v.id]: v.it?.lastUpdatedAt || v.at }; gravar(OF_AUTO, a); };

/** busca sozinha (no máximo a cada 30 min): se o banco atualizou, puxa, acerta saldo/limite e conta o que falta. Devolve o backup novo e a novidade */
export async function ofAuto(b: Backup, nomeUsuario = "", f: typeof fetch = fetch, agora = Date.now()): Promise<{ b: Backup; novo: OfNovidade | null } | null> {
  const cfg = ofCfg(), L = cfg.items || [], a = ofAutoCfg();
  if (!ofPronto() || !L.length || agora - (a.chk || 0) < 30 * 6e4) return null;
  a.chk = agora; gravar(OF_AUTO, a);
  let nb = b, novo: OfNovidade | null = null;
  try {
    for (const i of L) {
      const it = await ofApi<OfItemInfo>("/item?itemId=" + encodeURIComponent(i.id), cfg, f).catch(() => null);
      if (!it || !it.lastUpdatedAt || (a.seen || {})[i.id] === it.lastUpdatedAt) continue;
      const v = await ofBuscar(i.id, cfg, it, f, agora);
      nb = ofSync(nb, v);
      const n = ofContar(nb, v, nomeUsuario);
      if (n.ext || n.fat) novo = { id: i.id, ...n, v }; else ofVisto(v);
    }
  } catch { /* sem rede: tenta na próxima */ }
  return { b: nb, novo };
}

export function ofQuando(v?: string): string {
  if (!v) return ""; const d = new Date(v); if (isNaN(+d)) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}h${p(d.getMinutes())}`;
}
