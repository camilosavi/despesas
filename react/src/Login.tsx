import { useEffect, useRef, useState } from "react";
import { concluirVolta, criarConta, entrar, esqueci, lerVolta, mensagemAuth, reenviar, trocarSenha, urlGoogle } from "./nuvem";
import "./login.css";

type Modo = "in" | "new" | "forgot" | "sent" | "newpw";
export const forcaSenha = (s: string): 0 | 1 | 2 | 3 | 4 => {
  if (!s) return 0;
  let n = 0;
  if (s.length >= 6) n++;
  if (s.length >= 8) n++;
  if (/[a-z]/i.test(s) && /\d/.test(s)) n++;
  if (/[^a-z0-9]/i.test(s) || s.length >= 12) n++;
  return Math.min(4, n) as 1 | 2 | 3 | 4;
};
const FORCA = ["", "Fraca", "Razoável", "Boa", "Forte"];
const volta = () => location.origin + location.pathname;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function Login({ aviso, onEntrou }: { aviso?: string; onEntrou: () => void }) {
  const [modo, setModo] = useState<Modo>("in");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [rep, setRep] = useState("");
  const [olho, setOlho] = useState(false);
  const [msg, setMsg] = useState(aviso || "");
  const [ruim, setRuim] = useState("");
  const [busy, setBusy] = useState(false);
  const [espera, setEspera] = useState(0);
  const tipo = useRef<"signup" | "recovery">("signup");

  useEffect(() => { // volta do Google ou do link do e-mail
    const v = lerVolta(location.hash); if (!v) return;
    history.replaceState(null, "", location.pathname + location.search);
    if (v.err) { setMsg(/expired|invalid/i.test(v.err) ? "O link venceu ou já foi usado. Peça outro." : "Não deu para entrar: " + v.err); return; }
    setBusy(true); setMsg("Entrando…");
    concluirVolta(v).then(() => { if (v.rec) { setBusy(false); setMsg(""); setModo("newpw"); } else onEntrou(); })
      .catch(() => { setBusy(false); setMsg("Não deu para entrar. Tente de novo."); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (espera <= 0) return; const t = setTimeout(() => setEspera(espera - 1), 1000); return () => clearTimeout(t); }, [espera]);

  const erro = (campo: string, m: string) => { setRuim(campo); setMsg(m); return false; };
  const troca = (m: Modo) => { setModo(m); setMsg(""); setRuim(""); setSenha(""); setRep(""); };

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault(); if (busy) return;
    const em = email.trim();
    if (modo === "newpw") {
      if (senha.length < 6) return void erro("senha", "A senha precisa de 6 caracteres ou mais.");
      if (senha !== rep) return void erro("rep", "As senhas não são iguais.");
      setBusy(true); try { await trocarSenha(senha); onEntrou(); } catch (e) { setMsg(mensagemAuth(e)); } setBusy(false); return;
    }
    if (!EMAIL.test(em)) return void erro("email", "Confira o e-mail.");
    if (modo === "forgot") {
      setBusy(true);
      try { await esqueci(em, volta()); tipo.current = "recovery"; setEspera(45); setModo("sent"); setMsg(""); } catch (e) { setMsg(mensagemAuth(e)); }
      setBusy(false); return;
    }
    if (senha.length < 6) return void erro("senha", "A senha precisa de 6 caracteres ou mais.");
    if (modo === "new" && senha !== rep) return void erro("rep", "As senhas não são iguais.");
    setBusy(true); setMsg(""); setRuim("");
    try {
      if (modo === "in") { await entrar(em, senha); onEntrou(); }
      else {
        const r = await criarConta(em, senha, volta());
        if (r === "entrou") onEntrou(); else { tipo.current = "signup"; setEspera(45); setModo("sent"); }
      }
    } catch (e) {
      const m = mensagemAuth(e);
      if (modo === "new" && /Já existe/.test(m)) { setModo("in"); setSenha(""); setRep(""); setMsg(m); } else setMsg(m);
    }
    setBusy(false);
  }
  async function outro() {
    if (espera > 0 || busy) return;
    setBusy(true);
    try { await reenviar(email.trim(), volta(), tipo.current); setEspera(45); setMsg("Enviamos de novo."); } catch (e) { setMsg(mensagemAuth(e)); }
    setBusy(false);
  }

  const Campo = ({ id, rot, children }: { id: string; rot: string; children: React.ReactNode }) => <label className={"lg-c" + (ruim === id ? " bad" : "")}><span>{rot}</span>{children}</label>;
  const f = forcaSenha(senha);
  return (
    <div className="login" role="dialog" aria-modal="true" aria-labelledby="lg-t">
      <div className="lg-marca">Um Tostão</div>
      {modo === "sent" ? (
        <div className="lg-form">
          <div className="lg-h" id="lg-t">Confira seu e-mail</div>
          <p className="lg-p">Enviamos um link para <b>{email.trim()}</b>. Abra-o neste aparelho para continuar.</p>
          <button type="button" className="lg-btn" onClick={() => troca("in")}>Já confirmei, entrar</button>
          <button type="button" className="lg-link" disabled={espera > 0 || busy} onClick={outro}>{espera > 0 ? `Reenviar em ${espera} s` : "Reenviar o e-mail"}</button>
          <button type="button" className="lg-link" onClick={() => troca(tipo.current === "recovery" ? "forgot" : "new")}>Usar outro e-mail</button>
        </div>
      ) : (
        <form className="lg-form" onSubmit={enviar} noValidate>
          {(modo === "in" || modo === "new") && (
            <div className="lg-abas" role="tablist">
              <button type="button" role="tab" aria-selected={modo === "in"} onClick={() => troca("in")}>Entrar</button>
              <button type="button" role="tab" aria-selected={modo === "new"} onClick={() => troca("new")}>Criar conta</button>
            </div>
          )}
          {modo === "forgot" && <><div className="lg-h" id="lg-t">Esqueci a senha</div><p className="lg-p">Enviamos um link para criar uma senha nova.</p></>}
          {modo === "newpw" && <><div className="lg-h" id="lg-t">Senha nova</div><p className="lg-p">Escolha a senha da sua conta.</p></>}
          {(modo === "in" || modo === "new") && <span id="lg-t" hidden>{modo === "in" ? "Entrar" : "Criar conta"}</span>}
          {(modo === "in" || modo === "new") && <>
            <a className="lg-google" href={urlGoogle(volta())}>Continuar com o Google</a>
            <div className="lg-ou"><i />ou com e-mail<i /></div>
          </>}
          {modo !== "newpw" && <Campo id="email" rot="E-mail"><input type="email" autoComplete="email" inputMode="email" value={email} onChange={e => { setEmail(e.target.value); setRuim(""); setMsg(""); }} aria-invalid={ruim === "email"} /></Campo>}
          {modo !== "forgot" && (
            <Campo id="senha" rot={modo === "newpw" ? "Senha nova" : "Senha"}>
              <span className="lg-pw">
                <input type={olho ? "text" : "password"} autoComplete={modo === "in" ? "current-password" : "new-password"} value={senha} onChange={e => { setSenha(e.target.value); setRuim(""); setMsg(""); }} aria-invalid={ruim === "senha"} />
                <button type="button" aria-label={olho ? "Esconder senha" : "Mostrar senha"} aria-pressed={olho} onClick={() => setOlho(!olho)}>{olho ? "Esconder" : "Mostrar"}</button>
              </span>
            </Campo>
          )}
          {(modo === "new" || modo === "newpw") && <>
            <div className="lg-forca" data-l={f} aria-hidden="true"><i /><i /><i /><i /></div>
            <p className="lg-p sm">{senha ? FORCA[f] : "Mínimo de 6 caracteres. Melhor: 8 ou mais, com letras e números."}</p>
            <Campo id="rep" rot="Repita a senha"><input type={olho ? "text" : "password"} autoComplete="new-password" value={rep} onChange={e => { setRep(e.target.value); setRuim(""); setMsg(""); }} aria-invalid={ruim === "rep"} /></Campo>
          </>}
          <p className={"lg-msg" + (ruim || /não|erro|venceu|confira|precisa|limit|Sem conex/i.test(msg) ? " err" : "")} role="alert">{msg}</p>
          <button type="submit" className="lg-btn" disabled={busy}>{busy ? <span className="lg-spin" aria-hidden="true" /> : null}{modo === "in" ? "Entrar" : modo === "new" ? "Criar conta" : modo === "forgot" ? "Enviar o link" : "Salvar senha"}</button>
          {modo === "in" && <button type="button" className="lg-link" onClick={() => troca("forgot")}>Esqueci a senha</button>}
          {modo === "forgot" && <button type="button" className="lg-link" onClick={() => troca("in")}>Voltar</button>}
        </form>
      )}
    </div>
  );
}
