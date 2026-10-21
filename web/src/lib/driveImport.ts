// Traz o Open Finance (endereço do Worker, chave e conexão) do app antigo: ele guardava isso, criptografado com a senha de sincronização,
// na pasta escondida do app no Google Drive (appDataFolder). Só lê esse arquivo; a senha não é guardada e o token vale ~1 h.
import { createStore } from "./createStore";
import { lsGet, lsSet } from "./storage";
import { ofSetCfg, type OfCfg } from "./openfinance";

const CLIENT = "770349175007-u1d2c54ce78ssqf10mqomhmro0saukgg.apps.googleusercontent.com"; // id público do cliente OAuth (o mesmo do app antigo)
const FILE = "despesas-sync.json", KEY_ST = "despesas.zero.gstate", KEY_TOK = "despesas.zero.gtok", PREF = "despesas.of";
export const DRV = "drv."; // prefixo do `state`: separa esta volta do Google da entrada com Google pelo Supabase

const redirect = () => location.origin + location.pathname.replace(/index\.html$/, "");
const readTok = (): string => { try { const o = JSON.parse(sessionStorage.getItem(KEY_TOK) || "null"); return o && Date.now() < o.e ? o.t : ""; } catch { return ""; } };
export const drive = createStore<{ tok: string; back: boolean }>({ tok: readTok(), back: false });

/** a volta do Google trouxe o token do Drive? (o `state` começa com "drv.") */
export const returningFromDrive = () => new URLSearchParams(location.hash.slice(1)).get("state")?.startsWith(DRV) ?? false;
/** guarda o token e limpa o endereço; roda uma vez, antes de tudo */
export function finishDrive(): string {
  const p = new URLSearchParams(location.hash.slice(1)), want = lsGet(KEY_ST); lsSet(KEY_ST, null);
  history.replaceState(null, "", location.pathname);
  const at = p.get("access_token");
  if (!at || !want || p.get("state") !== want) return p.get("error") === "access_denied" ? "Google: acesso negado" : "Não deu para entrar no Google. Tente de novo.";
  try { sessionStorage.setItem(KEY_TOK, JSON.stringify({ t: at, e: Date.now() + ((+(p.get("expires_in") || 3600)) - 120) * 1e3 })); } catch { /* sem armazenamento: o token fica só na memória */ }
  drive.set({ tok: at, back: true }); return "";
}
/** vai para o Google pedir acesso só à pasta escondida do app no Drive */
export function driveGo() {
  const st = DRV + Math.random().toString(36).slice(2) + Date.now().toString(36); lsSet(KEY_ST, st);
  const q = new URLSearchParams({ client_id: CLIENT, redirect_uri: redirect(), response_type: "token", scope: "https://www.googleapis.com/auth/drive.appdata", include_granted_scopes: "true", state: st, prompt: "consent" });
  location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + q;
}

const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function key(pass: string, salt: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}
/** abre o arquivo criptografado (mesmo formato do app antigo) e devolve o JSON de dentro */
export async function decryptSync(text: string, pass: string): Promise<{ prefs?: Record<string, string> }> {
  const j = JSON.parse(text); if (!j || j.app !== "minhas-despesas-sync") throw new Error("formato");
  let pt: ArrayBuffer;
  try { pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(j.iv) }, await key(pass, unb64(j.salt)), unb64(j.ct)); } catch { throw new Error("senha"); }
  return JSON.parse(new TextDecoder().decode(pt));
}
/** pega só o Open Finance das preferências do arquivo */
export function ofFromSync(d: { prefs?: Record<string, string> }): OfCfg | null {
  try { const c = JSON.parse(d.prefs?.[PREF] || "null") as OfCfg | null; return c && c.url && c.key ? { url: c.url, key: c.key, ...(c.items?.length ? { items: c.items } : {}) } : null; } catch { return null; }
}

async function g(url: string, tok: string) {
  const r = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
  if (r.status === 401) { try { sessionStorage.removeItem(KEY_TOK); } catch { /* ok */ } drive.set({ tok: "" }); throw new Error("expirou"); }
  if (!r.ok) throw new Error("http " + r.status);
  return r;
}
/** busca o arquivo no Drive, abre com a senha e grava o Open Finance neste aparelho. Devolve o aviso para mostrar. */
export async function driveImport(pass: string): Promise<string> {
  const tok = drive.get().tok; if (!tok) return "Entre no Google de novo.";
  try {
    const q = encodeURIComponent(`name='${FILE}'`);
    const list = await (await g(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)&orderBy=modifiedTime desc`, tok)).json() as { files?: { id: string }[] };
    const id = list.files?.[0]?.id; if (!id) return "Não achei o arquivo de sincronização do app antigo nesta conta do Google.";
    const cfg = ofFromSync(await decryptSync(await (await g(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, tok)).text(), pass));
    if (!cfg) return "O arquivo abriu, mas não tem Open Finance salvo.";
    ofSetCfg(cfg); drive.set({ tok: "", back: false }); try { sessionStorage.removeItem(KEY_TOK); } catch { /* ok */ }
    return cfg.items?.length ? "Open Finance trazido do app antigo ✓" : "Servidor trazido ✓ (falta conectar o banco)";
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return m === "senha" ? "Senha de sincronização errada." : m === "expirou" ? "O login do Google expirou. Entre de novo." : m === "formato" ? "O arquivo do Drive não é do app antigo." : "Não deu: " + (m || "erro");
  }
}
