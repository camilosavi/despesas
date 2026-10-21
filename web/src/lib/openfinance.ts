// Open Finance (Meu Pluggy) do Inter: conta e cartão viram lançamentos sozinhos. As chaves da Pluggy ficam num Worker do Cloudflare dele
// (tools/pluggy-worker.js); aqui ficam só no aparelho o endereço do Worker, a chave (APP_KEY) e os ids das conexões.
import { bankOf, cardColor, cardLabel } from "./banks";
import { CAT_CARD } from "./categories";
import { createStore } from "./createStore";
import { fold, pad, uid, ymd } from "./format";
import { catForDesc, isCard, sg } from "./ledger";
import { titleCase } from "./pdf/parsers";
import { lsJson, lsSet } from "./storage";
import { actions, ledger } from "./store";
import type { Account, Entry } from "./types";

export const KEY_CFG = "despesas.zero.of", KEY_OLD = "despesas.of", KEY_ST = "despesas.zero.ofAuto";
const SDK = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js", MEU_PLUGGY = 200;

export interface OfCfg { url?: string; key?: string; items?: { id: string; name: string; at: string }[] }
/** a chave do app antigo (`despesas.of`, mesma origem) vale até ele salvar uma nova */
export const ofCfg = (): OfCfg => { const n = lsJson<OfCfg | null>(KEY_CFG, null); return n && (n.url || n.items) ? n : lsJson<OfCfg>(KEY_OLD, {}); };
export const ofSetCfg = (p: Partial<OfCfg>) => { lsSet(KEY_CFG, JSON.stringify({ ...ofCfg(), ...p })); ofState.set({ n: ofState.get().n + 1 }); };
export const ofReady = () => { const c = ofCfg(); return !!(c.url && c.key && c.items?.length); };

interface St { chk?: number; since?: string; seen?: Record<string, string>; done?: Record<string, 1>; cal?: Record<string, 1>; banks?: string[]; bal?: Record<string, { cents: number; ts: number }>; upd?: Record<string, string> }
const st = (): St => lsJson<St>(KEY_ST, {});
const stSave = (s: St) => lsSet(KEY_ST, JSON.stringify(s));
export const ofState = createStore<{ busy: boolean; err: string; n: number }>({ busy: false, err: "", n: 0 });

export type OfTx = {
  id: string; date: string; amount: number; description?: string; status?: string; category?: string;
  paymentData?: { receiver?: { name?: string } };
  creditCardMetadata?: { billId?: string; installmentNumber?: number; totalInstallments?: number };
};
type Guess = (type: Entry["type"], desc: string) => string;

/** dia local de uma data da Pluggy (vem em UTC) */
export const ofDay = (v: string) => { const d = new Date(v); return isNaN(+d) ? String(v).slice(0, 10) : d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const cents = (v: number) => Math.round((+v || 0) * 100);
const nice = (s: string) => { s = s.trim(); return s && s === s.toUpperCase() && /[A-Z]{3}/.test(s) ? titleCase(s) : s; };
/** estabelecimento da compra: "LOJA (22 letras) CIDADE  BRA" → LOJA */
const shop = (s: string) => (s.length > 30 ? s.slice(0, 22) : s.replace(/\s{2,}.*$/, "")).trim();
/** nome do banco da conta da Pluggy ("Banco Inter S.A." → Inter) */
export const ofBankName = (n: string) => { const t = String(n || "").replace(/^Banco\s+/i, "").trim(); return /inter\b/i.test(t) ? "Inter" : titleCase(t) || "Conta"; };

const mk = (acct: string, type: Entry["type"], c: number, date: string, desc: string, imp: string, cat: string, xfer = false): Entry =>
  ({ id: uid(), acct, type, cents: c, date, desc, ...(cat ? { cat } : {}), imp, ...(xfer ? { xfer: 1 as const } : {}), at: Date.now() });

/** movimentos da conta corrente → lançamentos (pendentes ficam de fora). Pix para si mesmo e "Crédito liberado" não são receita nem gasto (`xfer`); pagamento de fatura vira `pagfatura-` (as compras já estão no cartão) */
export function bankEntries(tx: OfTx[], acct: string, guess: Guess): Entry[] {
  const out: Entry[] = [];
  for (const t of tx) {
    const c = cents(t.amount); if (!c || t.status === "PENDING") continue;
    const d = String(t.description || ""), m = /^(.+?)\s+-\s+(.*)$/.exec(d), kind = (m ? m[1] : d).trim(), det = (m ? m[2] : "").replace(/^null$/i, "").trim();
    const type: Entry["type"] = c > 0 ? "rec" : "desp", abs = Math.abs(c), date = ofDay(t.date), rcv = t.paymentData?.receiver?.name || "";
    if (/fatura/i.test(d) || /^REALIZE\b/i.test(rcv) || t.category === "Credit card payment") { out.push(mk(acct, type, abs, date, "Pagamento de fatura", "pagfatura-of-" + t.id, CAT_CARD)); continue; }
    if (t.category === "Same person transfer") { out.push(mk(acct, type, abs, date, type === "rec" ? "Transferência recebida de mim" : "Transferência enviada para mim", "of-" + t.id, "", true)); continue; }
    if (/^Cr[eé]dito liberado/i.test(d)) { out.push(mk(acct, type, abs, date, "Crédito liberado (Pix no crédito)", "of-" + t.id, "", true)); continue; }
    const desc = /compra no d[eé]bito/i.test(kind) ? nice(shop(det)) : det ? kind + " · " + nice(det) : kind;
    out.push(mk(acct, type, abs, date, desc, "of-" + t.id, guess(type, desc)));
  }
  return out;
}
/** compras da fatura em aberto do cartão (sem `billId`) → lançamentos no cartão; pagamentos e créditos ficam de fora */
export function cardEntries(tx: OfTx[], acct: string, guess: Guess): Entry[] {
  const out: Entry[] = [];
  for (const t of tx) {
    const c = cents(t.amount), md = t.creditCardMetadata || {};
    if (c <= 0 || md.billId || /^(PAGAMENTO|PAGTO|DEB AUT)/i.test(t.description || "")) continue;
    const desc = nice(shop(String(t.description || ""))) + ((md.totalInstallments || 0) > 1 ? ` ${md.installmentNumber}/${md.totalInstallments}` : "");
    out.push(mk(acct, "desp", c, ofDay(t.date), desc, "of-" + t.id, guess("desp", desc)));
  }
  return out;
}

async function api(path: string) {
  const c = ofCfg(); let r: Response;
  try { r = await fetch((c.url || "").replace(/\/+$/, "") + path, { headers: { "x-app-key": c.key || "" } }); } catch { throw new Error("sem conexão com o servidor"); }
  if (r.status === 401) throw new Error("a chave do servidor não confere");
  if (!r.ok) throw new Error("servidor respondeu " + r.status);
  const d = await r.json().catch(() => null);
  if (!d) throw new Error("resposta estranha do servidor");
  if (d.error) throw new Error(d.error);
  if (d.message && !d.results && !d.accessToken) throw new Error("Pluggy: " + d.message);
  return d;
}

/** conta do app para o banco: a que já existe (mesmo banco) ou uma nova */
function acctFor(name: string, card: boolean): Account {
  const bk = bankOf(name), nm = card ? "Cartão " + name : name;
  const f = ledger.get().accts.find(a => isCard(a) === card && (bk ? bankOf(a.name) === bk : fold(a.name) === fold(nm)));
  if (f) return f;
  const a: Account = { id: uid(), name: nm, color: cardColor(name), label: cardLabel(name), start: 0, ...(card ? { kind: "cartao" as const } : {}) };
  actions.addAccount(a); return a;
}

let running = false;
/** busca no banco e lança o que ainda não está no app. `manual`: sempre busca e avisa o resultado; automático: só se o banco atualizou */
export async function ofRun(manual = false): Promise<string> {
  const c = ofCfg(); if (running || !c.url || !c.key || !c.items?.length) return "";
  running = true; ofState.set({ busy: true, err: "" });
  const s = st(); s.chk = Date.now(); s.since ||= ymd(-30); s.seen ||= {}; s.done ||= {}; s.cal ||= {}; s.bal ||= {}; s.upd ||= {}; const banks = new Set(s.banks || []);
  let novos = 0, nomes = "";
  try {
    for (const it of c.items) {
      const info = await api("/item?itemId=" + encodeURIComponent(it.id)).catch(() => null), up = info?.lastUpdatedAt as string | undefined;
      if (!manual && up && s.seen[it.id] === up) continue;
      const accs = ((await api("/accounts?itemId=" + encodeURIComponent(it.id))).results || []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
      const bank = accs.find(x => x.type === "BANK" && x.subtype !== "SAVINGS_ACCOUNT") || accs.find(x => x.type === "BANK"), cred = accs.find(x => x.type === "CREDIT");
      const guess: Guess = (t, d) => catForDesc(ledger.get().entries, t, d);
      const take = (list: Entry[]) => { const have = new Set(ledger.get().entries.map(e => e.imp)); const nw = list.filter(e => { const id = String(e.imp).replace(/^(pagfatura-)?of-/, ""); return !have.has(e.imp) && !s.done![id]; }); list.forEach(e => { s.done![String(e.imp).replace(/^(pagfatura-)?of-/, "")] = 1; }); if (nw.length) actions.addEntries(...nw); return nw.length; };
      const txs = async (id: string, from: string) => (((await api("/transactions?accountId=" + encodeURIComponent(id) + "&from=" + from)).results || []) as OfTx[]);
      if (bank) {
        const nm = ofBankName(bank.name || bank.marketingName), a = acctFor(nm, false); banks.add(cardLabel(nm)); nomes ||= nm;
        novos += take(bankEntries(await txs(bank.id, s.since), a.id, guess));
        if (bank.balance != null) {
          s.bal[cardLabel(nm).toLowerCase()] = { cents: cents(bank.balance), ts: up ? Date.parse(up) : Date.now() };
          if (!s.cal[a.id]) { // 1ª vez: o saldo inicial da conta passa a ser o que faz o saldo do app bater com o do banco
            const now = ledger.get(), hoje = ymd(0);
            actions.updateAccount(a.id, { start: cents(bank.balance) - now.entries.filter(e => e.acct === a.id && e.date <= hoje).reduce((t, e) => t + sg(e), 0) });
            s.cal[a.id] = 1;
          }
        }
      }
      if (cred) {
        const nm = ofBankName(cred.name || cred.marketingName || bank?.name), a = acctFor(nm, true), cd = cred.creditData || {}; banks.add(cardLabel(nm)); nomes ||= nm;
        novos += take(cardEntries(await txs(cred.id, ymd(-45)), a.id, guess));
        const patch: Partial<Account> = {}, day = (v?: string) => (v ? +ofDay(v).slice(8) : 0);
        if (!a.limit && cd.creditLimit) patch.limit = cents(cd.creditLimit);
        if (!a.closeDay && day(cd.balanceCloseDate)) patch.closeDay = day(cd.balanceCloseDate);
        if (!a.dueDay && day(cd.balanceDueDate)) patch.dueDay = day(cd.balanceDueDate);
        if (Object.keys(patch).length) actions.updateAccount(a.id, patch);
      }
      if (up) { s.seen[it.id] = up; s.upd[it.id] = up; }
    }
    const ids = Object.keys(s.done!); if (ids.length > 800) for (const k of ids.slice(0, ids.length - 800)) delete s.done![k];
    s.banks = [...banks]; stSave(s); ofState.set({ busy: false, err: "" });
    return novos ? `${nomes || "Banco"}: ${novos} lançamento${novos > 1 ? "s" : ""} novo${novos > 1 ? "s" : ""} ✓` : manual ? "Nada novo no banco" : "";
  } catch (e) {
    stSave(s); const msg = e instanceof Error ? e.message : String(e); ofState.set({ busy: false, err: msg });
    return manual ? "Não deu: " + msg : "";
  } finally { running = false; }
}
/** ao abrir ou voltar ao app: no máximo a cada 30 min */
export const ofAuto = async () => { if (!ofReady() || Date.now() - (st().chk || 0) < 30 * 6e4) return ""; return ofRun(false); };

/** este banco veio do Open Finance (mostra o botão "Atualizar do banco") */
export const ofHasBank = (a: Account) => { const b = bankOf(a.name); return !!b && (st().banks || []).includes(b.l); };
/** saldo que o banco informou na última atualização */
export const ofBalance = (a: Account) => { const b = bankOf(a.name); return b ? st().bal?.[b.l.toLowerCase()] : undefined; };
/** "Atualizado pelo banco em 21/10 12h54" */
export const ofWhenText = () => {
  const ups = Object.values(st().upd || {}).sort(); const v = ups[ups.length - 1]; if (!v) return "";
  const d = new Date(v); return isNaN(+d) ? "" : `Atualizado pelo banco em ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}h${pad(d.getMinutes())}`;
};

/** widget da Pluggy para conectar o banco (escolhe Meu Pluggy) */
export async function ofConnect(dark: boolean): Promise<string> {
  const d = await api("/token"); if (!d.accessToken) throw new Error("o servidor não conseguiu falar com a Pluggy (confira CLIENT_ID e CLIENT_SECRET)");
  const w = window as unknown as { PluggyConnect?: unknown };
  const get = () => { const P = w.PluggyConnect as { PluggyConnect?: unknown } | (new (o: unknown) => { init(): Promise<void> }) | undefined; return typeof P === "function" ? P : P && (P.PluggyConnect as new (o: unknown) => { init(): Promise<void> }); };
  if (!get()) await new Promise<void>((ok, no) => { const sc = document.createElement("script"); sc.src = SDK; sc.onload = () => (get() ? ok() : no(new Error("widget da Pluggy não carregou"))); sc.onerror = () => no(new Error("widget da Pluggy não carregou")); document.head.appendChild(sc); });
  const PC = get()!;
  return new Promise<string>((ok, no) => {
    const widget = new PC({
      connectToken: d.accessToken, theme: dark ? "dark" : "light", connectorIds: [MEU_PLUGGY], selectedConnectorId: MEU_PLUGGY,
      onSuccess: ({ item }: { item?: { id?: string; connector?: { name?: string } } }) => {
        if (!item?.id) return;
        const L = (ofCfg().items || []).filter(x => x.id !== item.id); L.push({ id: item.id, name: item.connector?.name || "Meu Pluggy", at: new Date().toISOString() });
        ofSetCfg({ items: L }); ok("Banco conectado");
      },
      onError: (e: { message?: string }) => no(new Error("Pluggy: " + (e?.message || "erro na conexão"))),
    });
    void widget.init();
  });
}
