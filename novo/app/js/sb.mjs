// Supabase: login (e-mail/senha e Google) e leitura/gravação de sync_rows.
// A URL e a chave *publishable* são públicas por desenho. Nunca pôr senha do banco nem service_role aqui.
// A sessão do app novo fica em "tostao.sb", separada da do app atual ("despesas.sb"): as duas renovam o token e,
// se dividissem a mesma chave, uma derrubaria o login da outra.
export const SB_URL = "https://ndsiayzschaefigobwag.supabase.co", SB_KEY = "sb_publishable_W_wX4ECguxH-Ay86y1bHfQ_MAKWhTHz";
const K = "tostao.sb";
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
export const sessao = () => { try { return JSON.parse(ls.get(K) || "null"); } catch (e) { return null; } };
const guardar = v => ls.set(K, v ? JSON.stringify(v) : null);
const erro = (m, status, code) => Object.assign(new Error(m), { status, code: code || "" });
let aoPerder = () => {};
export const quandoPerder = f => { aoPerder = f; };

export async function auth(caminho, corpo) {
  const r = await fetch(SB_URL + "/auth/v1/" + caminho, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw erro(j.msg || j.error_description || j.message || j.error || "http " + r.status, r.status, j.error_code || j.code);
  return j;
}
const paraSessao = j => ({ at: j.access_token, rt: j.refresh_token, exp: Date.now() + ((+j.expires_in || 3600) - 60) * 1e3, uid: (j.user && j.user.id) || (sessao() || {}).uid || "", email: (j.user && j.user.email) || (sessao() || {}).email || "" });

export async function entrar(email, senha) { const j = await auth("token?grant_type=password", { email, password: senha }); guardar(paraSessao(j)); return sessao(); }
export async function criarConta(email, senha) {
  const j = await auth("signup?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email, password: senha });
  if (j.access_token) { guardar(paraSessao(j)); return { sessao: sessao() }; }
  if (j.user && Array.isArray(j.user.identities) && !j.user.identities.length) throw erro("Esse e-mail já tem conta. Entre com a senha.", 422, "user_already_exists");
  return { confirmar: true };
}
export const esqueci = email => auth("recover?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email });
export const urlGoogle = () => SB_URL + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(location.origin + location.pathname);
// volta do Google / do link do e-mail: #access_token=...&refresh_token=...
export function lerRetorno() {
  const h = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  if (!h.get("access_token")) return false;
  guardar({ at: h.get("access_token"), rt: h.get("refresh_token"), exp: Date.now() + ((+h.get("expires_in") || 3600) - 60) * 1e3, uid: "", email: "" });
  history.replaceState(null, "", location.pathname + location.search);
  return true;
}
export async function sair() { try { const t = (sessao() || {}).at; if (t) await fetch(SB_URL + "/auth/v1/logout", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + t } }); } catch (e) {} guardar(null); }

let renovando = null;
async function token() {
  const s = sessao(); if (!s) throw erro("sem login", 401);
  if (Date.now() < s.exp) return s.at;
  // uma renovação por vez: duas juntas gastam o mesmo refresh_token
  if (!renovando) renovando = (async () => {
    try { guardar(paraSessao(await auth("token?grant_type=refresh_token", { refresh_token: s.rt }))); return sessao().at; }
    catch (e) { if ([400, 401, 403].includes(e.status)) { guardar(null); aoPerder(); } throw e; }
    finally { renovando = null; }
  })();
  return renovando;
}
// quando veio do Google o uid não vem no retorno: lê do próprio token
export async function completarSessao() {
  const s = sessao(); if (!s || s.uid) return s;
  const t = await token();
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + t } });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw erro("sessão inválida", r.status);
  guardar({ ...sessao(), uid: j.id, email: j.email }); return sessao();
}
async function api(metodo, caminho, corpo, prefer) {
  const t = await token();
  const r = await fetch(SB_URL + "/rest/v1/" + caminho, { method: metodo, headers: { apikey: SB_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  if (r.status === 401) { const s = sessao(); if (s) { s.exp = 0; guardar(s); } throw erro("401", 401); }
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw erro(j.message || j.msg || "http " + r.status, r.status, j.code); }
  return r.status === 204 ? null : await r.json().catch(() => null);
}
// kind i = lançamento · f = compra de moeda · c = chave do cfg · p = foto/tema · d = lápide · m = quem enviou por último; o valor vai em data.v
export async function lerTudo() { const out = []; for (let o = 0; ; o += 1000) { const p = (await api("GET", `sync_rows?select=kind,id,data&order=kind,id&limit=1000&offset=${o}`)) || []; out.push(...p); if (p.length < 1000) return out; } }
export async function gravar(kind, obj) {
  const uid = sessao().uid, linhas = Object.entries(obj).map(([id, v]) => ({ user_id: uid, kind, id, data: { v } }));
  for (let i = 0; i < linhas.length; i += 150) await api("POST", "sync_rows?on_conflict=user_id,kind,id", linhas.slice(i, i + 150), "resolution=merge-duplicates,return=minimal");
}
export async function apagar(kind, ids) {
  for (let i = 0; i < ids.length; i += 60) {
    const l = ids.slice(i, i + 60).map(x => encodeURIComponent('"' + String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"')).join(",");
    await api("DELETE", `sync_rows?kind=eq.${kind}&id=in.(${l})`);
  }
}
