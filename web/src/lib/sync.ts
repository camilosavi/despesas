// Login (Supabase Auth) e sincronização das contas e lançamentos com o banco (PostgREST). Tudo por fetch, sem biblioteca.
// O aparelho guarda a cópia local; BASE_K = o que já subiu. A cada mudança envia o diff (apagados, novos, alterados) e baixa tudo
// (o banco é a verdade; se mexeram durante o envio, não sobrescreve).
import { createStore } from "./createStore";
import { CARD_PALETTE } from "./banks";
import { actions, ledger, onLedgerChange } from "./store";
import { lsGet, lsSet } from "./storage";
import type { Account, Entry, Session } from "./types";

export const SB_URL = "https://ndsiayzschaefigobwag.supabase.co";
export const SB_KEY = "sb_publishable_W_wX4ECguxH-Ay86y1bHfQ_MAKWhTHz"; // publishable: pública por desenho (a service_role NUNCA vem para cá)
const SES_K = "despesas.zero.ses", BASE_K = "despesas.zero.base";
const MERGE = "resolution=merge-duplicates,return=minimal";

export class ApiError extends Error { status?: number; code?: string }
interface Json { [k: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
const sbErr = (r: Response, j: Json | null) =>
  Object.assign(new ApiError((j && (j.msg || j.error_description || j.message || j.error)) || ("http " + r.status)), { status: r.status, code: (j && (j.error_code || j.code)) || "" });

/* ---------- sessão ---------- */
const readSes = (): Session | null => { try { return JSON.parse(lsGet(SES_K) || "null"); } catch { return null; } };
export const session = createStore<{ ses: Session | null }>({ ses: readSes() });
export const authNotice = createStore<{ msg: string }>({ msg: "" });
const sesSave = (v: Session | null) => { session.set({ ses: v }); lsSet(SES_K, v ? JSON.stringify(v) : null); };
const ses = () => session.get().ses;

/* ---------- estado mostrado no botão "☁" ---------- */
export const syncState = createStore({ busy: false, off: false, err: "", pending: 0 });
const SY = { p: null as Promise<void> | null, again: false, t: 0 as ReturnType<typeof setTimeout> | 0 };

async function gt(path: string, body: Json) {
  const r = await fetch(SB_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw sbErr(r, j); return j as Json;
}
const toSes = (j: Json): Session => ({
  at: j.access_token, rt: j.refresh_token, exp: Date.now() + ((+j.expires_in || 3600) - 60) * 1e3,
  uid: (j.user && j.user.id) || ses()?.uid || "", email: (j.user && j.user.email) || ses()?.email || "",
});
async function tok() {
  const s = ses(); if (!s) throw Object.assign(new ApiError("sem login"), { status: 401 });
  if (Date.now() < s.exp) return s.at;
  try { const j = await gt("token?grant_type=refresh_token", { refresh_token: s.rt }); sesSave(toSes(j)); return ses()!.at; }
  catch (e) {
    const er = e as ApiError;
    if (er.status && er.status >= 400 && er.status < 500) { sesSave(null); authNotice.set({ msg: "A sessão acabou. Entre de novo." }); }
    throw e;
  }
}
async function api(method: string, path: string, body?: unknown, prefer?: string) {
  const t = await tok();
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    method, headers: { apikey: SB_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { const s = ses(); if (s) s.exp = 0; throw Object.assign(new ApiError("401"), { status: 401 }); }
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw sbErr(r, j); }
  return r.status === 204 ? null : await r.json().catch(() => null);
}
async function getAll(tbl: string): Promise<Json[]> {
  const out: Json[] = [];
  for (let o = 0; ; o += 1000) {
    const p = (await api("GET", `${tbl}?select=*&order=id&limit=1000&offset=${o}`)) as Json[] || [];
    out.push(...p); if (p.length < 1000) return out;
  }
}
async function upsert(tbl: string, rows: Json[]) {
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    try { await api("POST", tbl + "?on_conflict=id", part, MERGE); }
    catch (e) {
      if ((e as ApiError).code !== "23505") throw e; // mesmo holerite/fatura/conta já lançado em outro aparelho: o banco recusa a repetição e fica o que já estava lá
      for (const r of part) { try { await api("POST", tbl + "?on_conflict=id", [r], MERGE); } catch (x) { if ((x as ApiError).code !== "23505") throw x; } }
    }
  }
}
const idList = (a: string[]) => "in.(" + a.map(i => '"' + encodeURIComponent(i) + '"').join(",") + ")";
async function delIds(tbl: string, ids: string[]) { for (let i = 0; i < ids.length; i += 100) await api("DELETE", tbl + "?id=" + idList(ids.slice(i, i + 100))); }

/* ---------- mapeamento app ↔ banco ---------- */
export const aRow = (a: Account) => ({ id: a.id, name: a.name, color: a.color || null, label: a.label || null, start_cents: a.start || 0 });
export const aFrom = (r: Json): Account => ({ id: r.id, name: r.name, color: r.color || CARD_PALETTE[0], ...(r.label ? { label: r.label } : {}), start: +r.start_cents || 0 });
// `cat` só vai quando existe: sem a coluna no banco, quem não usa categoria continua sincronizando
export const eRow = (e: Entry) => ({
  id: e.id, acct: e.acct, type: e.type, cents: e.cents, date: e.date, descr: e.desc || "", imp: e.imp || null,
  xfer: !!e.xfer, tr: e.tr || null, items: e.items || null, at: e.at || null, ...(e.cat ? { cat: e.cat } : {}),
});
export const eFrom = (r: Json): Entry => {
  const e: Entry = { id: r.id, acct: r.acct, type: r.type, cents: +r.cents, date: r.date, desc: r.descr || "" };
  if (r.imp) e.imp = r.imp; if (r.xfer) e.xfer = 1; if (r.tr) e.tr = r.tr; if (r.cat) e.cat = r.cat; if (r.items) e.items = r.items; if (r.at != null) e.at = +r.at;
  return e;
};
type RowMap = { a: Record<string, string>; e: Record<string, string> };
export const rowsMap = (): RowMap => {
  const m: RowMap = { a: {}, e: {} }, { accts, entries } = ledger.get();
  accts.forEach(a => { m.a[a.id] = JSON.stringify(aRow(a)); });
  entries.forEach(e => { m.e[e.id] = JSON.stringify(eRow(e)); });
  return m;
};
const baseGet = (): RowMap => { try { const b = JSON.parse(lsGet(BASE_K) || "null"); return b && b.a && b.e ? b : { a: {}, e: {} }; } catch { return { a: {}, e: {} }; } };
/** quantas mudanças ainda não subiram */
export function pending() {
  const b = baseGet(), m = rowsMap(); let n = 0;
  for (const k of ["a", "e"] as const) {
    for (const id in m[k]) if (b[k][id] !== m[k][id]) n++;
    for (const id in b[k]) if (!(id in m[k])) n++;
  }
  return n;
}
const refresh = (p: Partial<ReturnType<typeof syncState.get>> = {}) => syncState.set({ pending: pending(), busy: !!SY.p, ...p });

export function syncSoon() { if (!ses()) return; if (SY.t) clearTimeout(SY.t); SY.t = setTimeout(syncNow, 1200); refresh(); }
export function syncNow(): Promise<void> {
  if (!ses()) return Promise.resolve();
  if (SY.p) { SY.again = true; return SY.p; }
  SY.p = (async () => {
    let off = false, err = "";
    try {
      const b = baseGet(), m = rowsMap(), { accts, entries } = ledger.get();
      const upA = accts.filter(a => b.a[a.id] !== m.a[a.id]).map(aRow), upE = entries.filter(e => b.e[e.id] !== m.e[e.id]).map(eRow);
      const delA = Object.keys(b.a).filter(id => !(id in m.a)), delE = Object.keys(b.e).filter(id => !(id in m.e));
      if (delE.length) await delIds("entries", delE);
      if (delA.length) await delIds("accts", delA);
      if (upA.length) await upsert("accts", upA);
      if (upE.length) await upsert("entries", upE);
      const ra = await getAll("accts"), re = await getAll("entries");
      if (!ses()) return;
      if (JSON.stringify(rowsMap()) !== JSON.stringify(m)) { SY.again = true; } // mexeram enquanto o banco respondia: não sobrescreve, tenta de novo
      else {
        actions.replaceFromServer(ra.map(aFrom), re.map(eFrom));
        lsSet(BASE_K, JSON.stringify(rowsMap()));
      }
    } catch (e) {
      const er = e as ApiError;
      if (er && er.status === 401 && !ses()) { /* sessão acabou: a tela de login já foi avisada */ }
      else if (!er || er.status == null) off = true; // fetch sem resposta = sem internet
      else err = (er.message || "erro").slice(0, 80);
    }
    SY.p = null;
    refresh({ off, err });
    if (SY.again) { SY.again = false; syncSoon(); }
  })();
  refresh();
  return SY.p;
}
export function syncText() {
  const { busy, err, off, pending: n } = syncState.get();
  if (!ses()) return "";
  return busy ? "Sincronizando…" : err ? "Erro ao sincronizar" : off ? (n ? n + " para enviar · sem internet" : "Sem conexão") : n ? n + " para enviar" : "Em dia";
}

/** liga os gatilhos de sincronização: mudança local, a cada 60 s, ao voltar ao app e ao voltar a internet */
export function startSync() {
  onLedgerChange(syncSoon);
  setInterval(() => { if (ses() && !document.hidden) void syncNow(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && ses()) void syncNow(); });
  addEventListener("online", () => { if (ses()) void syncNow(); });
  refresh();
  if (ses()) void syncNow();
}

/* ---------- entrar, criar conta, Google, sair ---------- */
export function authErr(e: unknown) {
  const er = e as ApiError, m = String(er?.message || ""), c = er?.code || "";
  return /invalid_credentials/.test(c) || /invalid login/i.test(m) ? "E-mail ou senha incorretos." :
    /user_already_exists/.test(c) || /already registered/i.test(m) ? "Esse e-mail já tem conta. Toque em Entrar." :
    /email_not_confirmed/.test(c) ? "Confirme o e-mail primeiro (veja a caixa de entrada)." :
    /weak_password/.test(c) ? "Senha fraca. Use pelo menos 8 caracteres, com letras e números." :
    /rate_limit/.test(c) || er?.status === 429 ? "Muitas tentativas. Espere alguns minutos." :
    /signup_disabled/.test(c) ? "O cadastro está desativado no Supabase." :
    !er || er.status == null ? "Sem conexão. Tente de novo." : m || "Não deu para entrar.";
}
export async function signIn(email: string, password: string) {
  sesSave(toSes(await gt("token?grant_type=password", { email, password }))); authNotice.set({ msg: "" }); void syncNow();
}
/** devolve "confirmar" quando o Supabase pede para confirmar o e-mail antes de entrar */
export async function signUp(email: string, password: string): Promise<"entrou" | "confirmar"> {
  const j = await gt("signup", { email, password });
  if (!j.access_token) return "confirmar";
  sesSave(toSes(j)); authNotice.set({ msg: "" }); void syncNow(); return "entrou";
}
const G_REDIR = () => location.origin + location.pathname.replace(/index\.html$/, "");
/** vai para o Google (pelo Supabase) e volta com o token no endereço (#access_token=…) */
export function googleStart() { location.href = SB_URL + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(G_REDIR()); }
export const returningFromGoogle = () => /access_token=|error_description=/.test(location.hash + location.search);
export async function finishGoogle() {
  const p = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
  history.replaceState(null, "", location.pathname);
  const er = p.get("error_description") || q.get("error_description");
  if (er) { authNotice.set({ msg: "Google: " + er.replace(/\+/g, " ") }); return; }
  try {
    const at = p.get("access_token"); if (!at) throw 0;
    const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + at } }); if (!r.ok) throw 0;
    const u = await r.json();
    sesSave({ at, rt: p.get("refresh_token") || "", exp: Date.now() + ((+(p.get("expires_in") || 0) || 3600) - 60) * 1e3, uid: u.id || "", email: u.email || "" });
    authNotice.set({ msg: "" }); void syncNow();
  } catch { authNotice.set({ msg: "Não deu para entrar com o Google. Tente de novo." }); }
}
/** sai só com tudo enviado; limpa o aparelho. Devolve o motivo quando não pôde sair. */
export async function signOut(): Promise<string | null> {
  await syncNow();
  const { off, err } = syncState.get();
  if (pending() || off || err) return "Há mudanças que ainda não subiram. Conecte e tente de novo.";
  try { await fetch(SB_URL + "/auth/v1/logout", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + ses()!.at } }); } catch { /* invalida a sessão no Supabase também; se falhar, sai assim mesmo */ }
  actions.clear(); lsSet(BASE_K, null); sesSave(null); refresh({ off: false, err: "" });
  return null;
}
