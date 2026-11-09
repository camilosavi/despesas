// Trava local do aparelho: senha de 6 dígitos (PBKDF2 com sal, só neste navegador) e, opcional, biometria (WebAuthn).
// Não é a conta na nuvem; só impede que outra pessoa abra o app neste aparelho. Esquecida = só apagando os dados.
const CH = "despesas.react.auth";
export const TAM = 6, ITER = 150000, ESPERA_MS = 30000, FALHAS = 5, FUNDO_MS = 5 * 60000;
interface Auth { s: string; h: string; it: number; bio?: string; falhas?: number; ate?: number }

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const des = (t: string) => Uint8Array.from(atob(t), c => c.charCodeAt(0));
function ler(): Auth | null { try { const a = JSON.parse(localStorage.getItem(CH) || "null"); return a && a.s && a.h ? a : null; } catch { return null; } }
function gravar(a: Auth | null) { try { if (a) localStorage.setItem(CH, JSON.stringify(a)); else localStorage.removeItem(CH); } catch { /* sem armazenamento */ } }

async function hash(pin: string, sal: Uint8Array, it: number): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: it }, k, 256)));
}
export const pinOk = (p: string) => new RegExp(`^\\d{${TAM}}$`).test(p);
export const temSenha = () => !!ler();
export const temBio = () => !!ler()?.bio;
export async function definirSenha(pin: string): Promise<boolean> {
  if (!pinOk(pin)) return false;
  const sal = crypto.getRandomValues(new Uint8Array(16)), antes = ler();
  gravar({ s: b64(sal), h: await hash(pin, sal, ITER), it: ITER, ...(antes?.bio ? { bio: antes.bio } : {}) });
  return true;
}
export const removerSenha = () => gravar(null);
/** segundos de espera restantes depois de muitas senhas erradas (0 = pode tentar) */
export const espera = (agora = Date.now()) => { const a = ler(); return a?.ate && a.ate > agora ? Math.ceil((a.ate - agora) / 1000) : 0; };
export async function conferirSenha(pin: string, agora = Date.now()): Promise<"ok" | "errada" | "espera"> {
  const a = ler(); if (!a) return "ok";
  if (espera(agora)) return "espera";
  const ok = pinOk(pin) && (await hash(pin, des(a.s), a.it)) === a.h;
  if (ok) { gravar({ ...a, falhas: 0, ate: 0 }); return "ok"; }
  const f = (a.falhas || 0) + 1;
  gravar({ ...a, falhas: f >= FALHAS ? 0 : f, ate: f >= FALHAS ? agora + ESPERA_MS : 0 });
  return f >= FALHAS ? "espera" : "errada";
}

// ---------- biometria (Face ID, Touch ID, digital, Windows Hello): só destrava, não guarda a senha ----------
export const bioNome = (ua = navigator.userAgent) => /iPhone|iPad/.test(ua) ? "Face ID" : /Android/.test(ua) ? "Biometria" : /Mac/.test(ua) ? "Touch ID" : /Windows/.test(ua) ? "Windows Hello" : "Biometria";
export async function bioDisponivel(): Promise<boolean> {
  try { return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}
export async function bioAtivar(nome: string): Promise<boolean> {
  const a = ler(); if (!a) return false;
  try {
    const c = (await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "Um Tostão" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: nome || "usuario", displayName: nome || "Usuário" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" }, timeout: 60000,
    } })) as PublicKeyCredential | null;
    if (!c) return false;
    gravar({ ...a, bio: b64(new Uint8Array(c.rawId)) }); return true;
  } catch { return false; }
}
export const bioDesligar = () => { const a = ler(); if (a) { const { bio: _b, ...r } = a; gravar(r); } };
export async function bioEntrar(): Promise<boolean> {
  const a = ler(); if (!a?.bio) return false;
  try {
    const r = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), userVerification: "required", timeout: 60000, allowCredentials: [{ type: "public-key", id: des(a.bio) as BufferSource }] } });
    return !!r;
  } catch { return false; }
}
