import { useEffect, useRef, useState } from "react";
import { TAM, bioEntrar, bioNome, conferirSenha, definirSenha, espera, temBio } from "./senha";
import "./trava.css";

/** modo "entrar": destrava o app · "criar": nova senha (digita duas vezes) · "conferir": pede a senha atual para uma ação */
export function Trava({ modo, onOk, onCancelar }: { modo: "entrar" | "criar" | "conferir"; onOk: () => void; onCancelar?: () => void }) {
  const [pin, setPin] = useState(""), [primeiro, setPrimeiro] = useState(""), [msg, setMsg] = useState(""), [ocupado, setOcupado] = useState(false), [seg, setSeg] = useState(espera());
  const bio = modo === "entrar" && temBio(), bioTentou = useRef(false);
  const titulo = modo === "criar" ? (primeiro ? "Repita a senha" : "Crie uma senha de 6 dígitos") : modo === "conferir" ? "Digite a senha atual" : "Digite a senha";
  useEffect(() => { if (!seg) return; const t = setInterval(() => setSeg(espera()), 500); return () => clearInterval(t); }, [seg]);
  const digitar = (d: string) => { if (ocupado || seg || pin.length >= TAM) return; setMsg(""); setPin(pin + d); };
  const apagar = () => { setPin(pin.slice(0, -1)); setMsg(""); };
  useEffect(() => {
    if (pin.length !== TAM) return;
    (async () => {
      setOcupado(true);
      if (modo === "criar") {
        if (!primeiro) { setPrimeiro(pin); setPin(""); }
        else if (primeiro === pin) { await definirSenha(pin); onOk(); }
        else { setMsg("As senhas não são iguais. Comece de novo."); setPrimeiro(""); setPin(""); }
      } else {
        const r = await conferirSenha(pin);
        if (r === "ok") onOk(); else { setMsg(r === "espera" ? "Muitas tentativas. Espere um pouco." : "Senha errada."); setSeg(espera()); setPin(""); }
      }
      setOcupado(false);
    })();
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps
  const usarBio = async () => { if (await bioEntrar()) onOk(); else setMsg(`${bioNome()} não funcionou. Use a senha.`); };
  useEffect(() => { if (bio && !bioTentou.current) { bioTentou.current = true; void usarBio(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) digitar(e.key); else if (e.key === "Backspace") apagar(); else if (e.key === "Escape" && onCancelar) onCancelar(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  return (
    <div className="trava" role="dialog" aria-modal="true" aria-labelledby="tv-t">
      <b className="tvmarca">Um Tostão</b>
      <h1 id="tv-t">{titulo}</h1>
      <div className="tvpontos" aria-hidden="true">{Array.from({ length: TAM }, (_, i) => <i key={i} className={i < pin.length ? "on" : ""} />)}</div>
      <p className="tvmsg" role="status">{seg ? `Tente de novo em ${seg} s.` : msg}</p>
      <div className="tvteclado" role="group" aria-label="Teclado numérico">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => <button key={d} type="button" onClick={() => digitar(d)}>{d}</button>)}
        {bio ? <button type="button" className="tvaux" onClick={usarBio} aria-label={`Entrar com ${bioNome()}`}>{bioNome() === "Face ID" ? "Face ID" : "Bio"}</button> : onCancelar ? <button type="button" className="tvaux" onClick={onCancelar}>Cancelar</button> : <span />}
        <button type="button" onClick={() => digitar("0")}>0</button>
        <button type="button" className="tvaux" onClick={apagar} aria-label="Apagar">⌫</button>
      </div>
    </div>
  );
}
