/* Conta e sincronização no Supabase (porta do app atual: sbAuth/sbTok/syncNow).
   A nuvem guarda linhas em `sync_rows` (user_id, kind, id, data:{v}); kind i = lançamento, f = compra de moeda,
   c = chave do cfg, d = lápide, m = quem enviou por último. URL e chave publishable são públicas por desenho. */
import type { Backup } from "./loja";

export const SB_URL = "https://ndsiayzschaefigobwag.supabase.co";
export const SB_KEY = "sb_publishable_W_wX4ECguxH-Ay86y1bHfQ_MAKWhTHz";
export const SES_K = "despesas.sb";
export const BASE_K = "despesas.sbBase";
export const DEL_K = "despesas.syncDel";
export const META_K = "despesas.sbMeta";
export const LOCAL_CFG = ["seeded"];
export const TOMBA_DIAS = 180;

export interface Sessao { at: string; rt: string; exp: number; uid: string; email: string }
export class NuvemErro extends Error {
  status?: number; code: string;
  constructor(m: string, status?: number, code = "") { super(m); this.status = status; this.code = code; }
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
const lerJson = <T,>(k: string, pad: T): T => { try { const t = ls.get(k); return t ? (JSON.parse(t) as T) : pad; } catch { return pad; } };

export const sessao = (): Sessao | null => lerJson<Sessao | null>(SES_K, null);
export const sessaoGravar = (s: Sessao | null) => ls.set(SES_K, s ? JSON.stringify(s) : null);
export const meta = (): Record<string, any> => lerJson(META_K, {});
export const metaGravar = (o: Record<string, any>) => ls.set(META_K, JSON.stringify({ ...meta(), ...o }));

/* ---------- autenticação ---------- */
async function auth(path: string, body: unknown) {
  const r = await fetch(`${SB_URL}/auth/v1/${path}`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new NuvemErro(j.msg || j.error_description || j.message || j.error || "http " + r.status, r.status, j.error_code || j.code);
  return j;
}
const paraSessao = (j: any, agora = Date.now()): Sessao => ({
  at: j.access_token, rt: j.refresh_token, exp: agora + ((+j.expires_in || 3600) - 60) * 1000,
  uid: j.user?.id || sessao()?.uid || "", email: j.user?.email || sessao()?.email || "",
});

export function mensagemAuth(e: unknown): string {
  const x = e as NuvemErro, m = String(x?.message || e);
  if (x?.code === "over_email_send_rate_limit" || /rate limit/i.test(m)) return "O Supabase limitou os e-mails por agora. Espere alguns minutos e tente de novo.";
  if (/invalid login|invalid_credentials/i.test(m) || x?.code === "invalid_credentials") return "E-mail ou senha não conferem.";
  if (/email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos e entre de novo.";
  if (/already registered|user_already_exists/i.test(m) || x?.code === "user_already_exists") return "Já existe conta com esse e-mail. Entre com a senha.";
  if (/password/i.test(m) && /(short|weak|least)/i.test(m)) return "A senha precisa de 6 caracteres ou mais.";
  if (x?.status && x.status >= 500) return `O Supabase está fora do ar agora (${m.slice(0, 80)}).`;
  if (x?.status == null || /failed to fetch|load failed|network/i.test(m)) return "Sem conexão agora.";
  return m.slice(0, 120);
}

export async function entrar(email: string, senha: string): Promise<Sessao> {
  const s = paraSessao(await auth("token?grant_type=password", { email, password: senha }));
  sessaoGravar(s); return s;
}
/* devolve "entrou" (sessão aberta), "confirmar" (precisa abrir o link do e-mail) ou lança "já existe" */
export async function criarConta(email: string, senha: string, volta: string): Promise<"entrou" | "confirmar"> {
  const j = await auth(`signup?redirect_to=${encodeURIComponent(volta)}`, { email, password: senha });
  if (j.access_token) { sessaoGravar(paraSessao(j)); return "entrou"; }
  if (j.user && Array.isArray(j.user.identities) && j.user.identities.length === 0) throw new NuvemErro("already registered", 200, "user_already_exists");
  if (Array.isArray(j.identities) && j.identities.length === 0) throw new NuvemErro("already registered", 200, "user_already_exists");
  return "confirmar";
}
export const esqueci = (email: string, volta: string) => auth(`recover?redirect_to=${encodeURIComponent(volta)}`, { email });
export const reenviar = (email: string, volta: string, tipo: "signup" | "recovery" = "signup") =>
  tipo === "recovery" ? esqueci(email, volta) : auth(`resend?redirect_to=${encodeURIComponent(volta)}`, { type: "signup", email });
export const urlGoogle = (volta: string) => `${SB_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(volta)}`;

/* volta do Google / link do e-mail: #access_token=…&refresh_token=…&type=recovery */
export interface Volta { at?: string; rt?: string; exp?: number; rec?: boolean; err?: string }
export function lerVolta(hash: string): Volta | null {
  if (!hash || hash.length < 3) return null;
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (p.get("error") || p.get("error_description")) return { err: p.get("error_description") || p.get("error") || "erro" };
  const at = p.get("access_token"), rt = p.get("refresh_token");
  if (!at || !rt) return null;
  return { at, rt, exp: +(p.get("expires_in") || 3600), rec: p.get("type") === "recovery" };
}
export async function concluirVolta(v: Volta, agora = Date.now()): Promise<Sessao> {
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: "Bearer " + v.at } });
  if (!r.ok) throw new NuvemErro("http " + r.status, r.status);
  const u: any = await r.json();
  const s: Sessao = { at: v.at!, rt: v.rt!, exp: agora + ((v.exp || 3600) - 60) * 1000, uid: u.id || "", email: u.email || "" };
  sessaoGravar(s); return s;
}
export async function trocarSenha(nova: string) {
  const t = await token();
  const r = await fetch(`${SB_URL}/auth/v1/user`, { method: "PUT", headers: { apikey: SB_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ password: nova }) });
  if (!r.ok) { const j: any = await r.json().catch(() => ({})); throw new NuvemErro(j.msg || j.message || "http " + r.status, r.status, j.error_code || j.code); }
}

/* renovação: uma por vez (duas juntas gastam o mesmo refresh_token); só desloga em 400/401/403 */
let renovando: Promise<string> | null = null;
export const aoExpirar: { fn: () => void } = { fn: () => {} };
export async function token(): Promise<string> {
  const s = sessao();
  if (!s) throw new NuvemErro("sem login", 401);
  if (Date.now() < s.exp) return s.at;
  if (!renovando) renovando = (async () => {
    try { const n = paraSessao(await auth("token?grant_type=refresh_token", { refresh_token: s.rt })); sessaoGravar(n); return n.at; }
    catch (e) { if ([400, 401, 403].includes((e as NuvemErro).status || 0)) { sessaoGravar(null); aoExpirar.fn(); } throw e; }
    finally { renovando = null; }
  })();
  return renovando;
}

/* ---------- tabela ---------- */
async function api(method: string, path: string, body?: unknown, prefer?: string) {
  const t = await token();
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers: { apikey: SB_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { const s = sessao(); if (s) sessaoGravar({ ...s, exp: 0 }); throw new NuvemErro("401", 401); }
  if (!r.ok) { const j: any = await r.json().catch(() => ({})); throw new NuvemErro(j.message || j.msg || "http " + r.status, r.status, j.code); }
  return r.status === 204 ? null : await r.json().catch(() => null);
}
export interface Linha { kind: string; id: string; data?: { v?: any } }
export async function lerTudo(): Promise<Linha[]> {
  const out: Linha[] = [];
  for (let o = 0; ; o += 1000) {
    const p = ((await api("GET", `sync_rows?select=kind,id,data&order=kind,id&limit=1000&offset=${o}`)) as Linha[]) || [];
    out.push(...p); if (p.length < 1000) return out;
  }
}
async function subir(kind: string, obj: Record<string, unknown>) {
  const uid = sessao()!.uid, rows = Object.entries(obj).map(([id, v]) => ({ user_id: uid, kind, id, data: { v } }));
  let parte: typeof rows = [], tam = 0;
  const lote = async () => { if (parte.length) await api("POST", "sync_rows?on_conflict=user_id,kind,id", parte, "resolution=merge-duplicates,return=minimal"); parte = []; tam = 0; };
  for (const r of rows) { const n = JSON.stringify(r).length; if (parte.length && (parte.length >= 150 || tam + n > 1.5e6)) await lote(); parte.push(r); tam += n; }
  await lote();
}
async function apagarLinhas(kind: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 60) {
    const l = ids.slice(i, i + 60).map(x => encodeURIComponent('"' + String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"')).join(",");
    await api("DELETE", `sync_rows?kind=eq.${kind}&id=in.(${l})`);
  }
}

/* ---------- junção em 3 vias ---------- */
export const stab = (v: unknown): string => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o: any, kk) => (o[kk] = x[kk], o), {}) : x);
export function merge3(base: Record<string, string>, loc: Record<string, any>, rem: Record<string, any>, primeira: boolean): Record<string, any> {
  const out: Record<string, any> = {}, keys = new Set([...Object.keys(base), ...Object.keys(loc), ...Object.keys(rem)]);
  keys.forEach(k => {
    const B = base[k], L = k in loc ? stab(loc[k]) : undefined, R = k in rem ? stab(rem[k]) : undefined;
    let pick: "l" | "r";
    if (L === B) pick = "r"; else if (R === B) pick = "l"; else pick = primeira ? "r" : "l";
    const v = pick === "l" ? loc[k] : rem[k];
    if (v !== undefined && (pick === "l" ? L : R) !== undefined) out[k] = v;
  });
  return out;
}
export interface Estado { items: Record<string, any>; fx: Record<string, any>; cfg: Record<string, any> }
const porId = (a: any[]) => Object.fromEntries((a || []).filter(x => x && x.id).map(x => [x.id, x]));
export function foto(b: Backup): Estado {
  const cfg = { ...b.cfg }; LOCAL_CFG.forEach(k => delete cfg[k]);
  return { items: porId(b.items), fx: porId(b.fx as any[]), cfg };
}
export function linhasParaEstado(rows: Linha[]) {
  const s: Estado & { del: Record<string, number>; dev: string } = { items: {}, fx: {}, cfg: {}, del: {}, dev: "" };
  rows.forEach(r => {
    const v = r.data?.v;
    if (r.kind === "i") s.items[r.id] = v; else if (r.kind === "f") s.fx[r.id] = v; else if (r.kind === "c") s.cfg[r.id] = v;
    else if (r.kind === "d") s.del[r.id] = +v || 0; else if (r.kind === "m" && r.id === "dev" && v) s.dev = v.dev || "";
  });
  return s;
}
export const hashes = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, stab(v)]));
const hashEstado = (e: Estado) => ({ items: hashes(e.items), fx: hashes(e.fx), cfg: hashes(e.cfg) });
const dif = (a: Record<string, Record<string, string>>, b: Record<string, Record<string, string>>) => {
  let n = 0; (["items", "fx", "cfg"] as const).forEach(s => { const A = a[s] || {}, B = b[s] || {}; new Set([...Object.keys(A), ...Object.keys(B)]).forEach(k => { if (A[k] !== B[k]) n++; }); });
  return n;
};

export const lapides = (): Record<string, number> => lerJson(DEL_K, {});
export function lapideAdd(ids: string[], agora = Date.now()) { if (!ids.length) return; const d = lapides(); ids.forEach(i => { if (i) d[i] = agora; }); ls.set(DEL_K, JSON.stringify(d)); }
const baseSalva = (): any => lerJson(BASE_K, null);
/* quantas mudanças daqui ainda não foram para a nuvem */
export function pendentes(b: Backup): number {
  const base = baseSalva(); if (!base) return 0;
  return dif(hashEstado(foto(b)), base);
}
/* ids que sumiram entre dois backups (para a lápide): chamar no salvar */
export function sumiram(antes: Backup | null, depois: Backup | null): string[] {
  if (!antes || !depois) return [];
  const ids = (x: Backup) => new Set([...(x.items || []).map((i: any) => i.id), ...((x.fx as any[]) || []).map(i => i?.id)].filter(Boolean));
  const d = ids(depois); return [...ids(antes)].filter(i => !d.has(i));
}
const nomeAparelho = () => { const u = typeof navigator !== "undefined" ? navigator.userAgent || "" : ""; return /iPhone|iPod/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "celular" : "computador"; };

export interface Resultado { backup: Backup; mudou: boolean; subiu: number; desceu: number; de: string }
/* sincroniza `b`. `atual()` devolve o backup do momento (se mudou enquanto a nuvem respondia, desiste e devolve null). */
export async function sincronizar(b: Backup, atual: () => Backup | null = () => b): Promise<Resultado | null> {
  const loc = foto(b), linhas = await lerTudo();
  /* nuvem sem nenhuma linha com base antiga: vira 1ª vez e reenvia tudo; nunca apaga o aparelho */
  const base = linhas.length ? baseSalva() : null, primeira = !base;
  const R = linhasParaEstado(linhas), rem: Estado = { items: R.items, fx: R.fx, cfg: R.cfg };
  const cur = atual(); if (!cur || stab(foto(cur)) !== stab(loc)) return null;
  const velho = Date.now() - TOMBA_DIAS * 864e5, dl: Record<string, number> = {};
  [R.del, lapides()].forEach(o => Object.entries(o || {}).forEach(([k, t]) => { if (t > velho && !(dl[k] >= t)) dl[k] = t; }));
  const bs = { items: {}, fx: {}, cfg: {}, ...(base || {}) };
  const m: Estado = { items: merge3(bs.items, loc.items, rem.items, primeira), fx: merge3(bs.fx, loc.fx, rem.fx, primeira), cfg: merge3(bs.cfg, loc.cfg, rem.cfg, primeira) };
  Object.keys(dl).forEach(k => { delete m.items[k]; delete m.fx[k]; });
  const mudouLocal = stab(m) !== stab(loc), mudouRemoto = stab(m) !== stab(rem) || stab(dl) !== stab(R.del);
  const hm = hashEstado(m);
  const subiu = mudouRemoto ? dif(hm, hashEstado(rem)) : 0, desceu = mudouLocal ? dif(hm, hashEstado(loc)) : 0, agora = Date.now();
  if (mudouRemoto) {
    for (const [s, kd] of [["items", "i"], ["fx", "f"], ["cfg", "c"]] as const) {
      const u: Record<string, unknown> = {}, d: string[] = [];
      Object.keys(m[s]).forEach(k => { if (stab(m[s][k]) !== stab(rem[s][k])) u[k] = m[s][k]; });
      Object.keys(rem[s]).forEach(k => { if (!(k in m[s])) d.push(k); });
      if (Object.keys(u).length) await subir(kd, u);
      if (d.length) await apagarLinhas(kd, d);
    }
    const du: Record<string, number> = {}, dd: string[] = [];
    Object.keys(dl).forEach(k => { if (dl[k] !== R.del[k]) du[k] = dl[k]; });
    Object.keys(R.del).forEach(k => { if (!(k in dl)) dd.push(k); });
    if (Object.keys(du).length) await subir("d", du);
    if (dd.length) await apagarLinhas("d", dd);
    await subir("m", { dev: { dev: nomeAparelho(), at: agora } });
  }
  ls.set(DEL_K, JSON.stringify(dl));
  ls.set(BASE_K, JSON.stringify(hm));
  metaGravar({ errAt: 0, errMsg: "", at: agora, ...(subiu ? { upAt: agora, upN: subiu } : {}), ...(desceu ? { downAt: agora, downN: desceu, downFrom: R.dev } : {}) });
  let backup = b;
  if (mudouLocal) {
    const cfg: Record<string, any> = { ...m.cfg }; LOCAL_CFG.forEach(k => { if (b.cfg[k] !== undefined) cfg[k] = b.cfg[k]; });
    backup = { ...b, items: Object.values(m.items) as any, fx: Object.values(m.fx), cfg };
  }
  return { backup, mudou: mudouLocal, subiu, desceu, de: R.dev };
}

export function textoErro(e: unknown): string {
  const x = e as NuvemErro, m = String((x && x.message) || e);
  if (x?.status === 401) return "A sessão acabou. Entre de novo.";
  if (x?.code === "PGRST205" || x?.code === "42P01" || /sync_rows/.test(m)) return "Falta criar a tabela no Supabase (rodar supabase/sync.sql no SQL Editor).";
  if (x?.status == null || /failed to fetch|load failed|network/i.test(m)) return "Sem conexão agora. Tenta de novo sozinho em 2 min.";
  if (x.status >= 500) return "O Supabase está fora do ar agora. Tenta de novo sozinho em 2 min.";
  if (x.status === 429) return "Muitas tentativas seguidas. Tenta de novo sozinho em 2 min.";
  return `Não deu para sincronizar (${m.slice(0, 90)}).`;
}

/* sair: apaga os dados deste aparelho (continuam na conta). Quem chama já conferiu que tudo subiu. */
export async function sair() {
  const s = sessao();
  try { await fetch(`${SB_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + (s?.at || "") } }); } catch { /* sem rede: sai assim mesmo */ }
  try { const ks: string[] = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("despesas.")) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); sessionStorage.clear(); } catch { /* ok */ }
}
