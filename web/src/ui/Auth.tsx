import { useState } from "react";
import type { FormEvent } from "react";
import { useStore } from "../lib/createStore";
import { authErr, authNotice, googleStart, signIn, signUp } from "../lib/sync";

export function Auth() {
  const notice = useStore(authNotice, s => s.msg);
  const [email, setEmail] = useState(""), [pass, setPass] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const say = msg || notice;
  async function go(create: boolean) {
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) { setMsg("Digite um e-mail válido."); return; }
    if (pass.length < 6) { setMsg("A senha precisa de 6 ou mais caracteres."); return; }
    setBusy(true); setMsg("");
    try {
      if (create) { if ((await signUp(em, pass)) === "confirmar") setMsg("Conta criada. Confirme pelo e-mail e depois toque em Entrar."); }
      else await signIn(em, pass);
      setPass("");
    } catch (e) { setMsg(authErr(e)); } finally { setBusy(false); }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void go(false); };
  return (
    <div className="auth" id="auth">
      <form className="authbox" noValidate onSubmit={submit}>
        <img className="alogo" src={`${import.meta.env.BASE_URL}tostao-logo.png?v=4`} alt="Um Tostão" width={150} height={150} />
        <div className="field"><label htmlFor="auEmail">E-mail</label><input type="email" id="auEmail" autoComplete="username" inputMode="email" autoCapitalize="off" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="auPass">Senha</label><input type="password" id="auPass" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} /></div>
        <div id="authMsg" role="alert">{say}</div>
        <button type="submit" className="btn primary wide" id="auIn" disabled={busy}>Entrar</button>
        <button type="button" className="btn wide" id="auNew" disabled={busy} onClick={() => void go(true)}>Criar conta</button>
        <div className="or"><span>ou</span></div>
        <button type="button" className="btn wide" id="auGoogle" onClick={googleStart}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.2 1-3.8 1-2.9 0-5.3-2-6.2-4.6H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.2H2.1a11 11 0 0 0 0 9.6z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.2L5.8 10c.9-2.6 3.3-4.6 6.2-4.6z" /></svg>
          Entrar com o Google
        </button>
      </form>
    </div>
  );
}
