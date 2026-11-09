import { useEffect, useState } from "react";
import { mensagemAuth, mensagemVincular, meta, perfil, trocarSenha, urlVincular } from "./nuvem";
import type { Perfil } from "./nuvem";
import type { EstadoNuvem } from "./useNuvem";

const quando = (t?: number) => { if (!t) return ""; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : "em " + new Date(t).toLocaleDateString("pt-BR"); };

export function ContaNuvem({ conta, onAviso, onPerfil }: { conta: { email: string; st: EstadoNuvem; onAgora: () => void; onSair: () => Promise<string>; onSync: () => Promise<void> }; onAviso: (m: string) => void; onPerfil?: (p: Perfil) => void }) {
  const [armado, setArmado] = useState(false);
  const { st } = conta, mt = meta();
  const [pf, setPf] = useState<Perfil | null>(null), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [pw, setPw] = useState<string | null>(null);
  const carregar = () => perfil().then(p => { setPf(p); onPerfil?.(p); }).catch(() => setMsg("Não deu para ler as formas de entrar agora."));
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const volta = location.origin + location.pathname;
  async function vincular() {
    setBusy(true); setMsg("Abrindo o Google…");
    try { const u = await urlVincular("google", volta); await conta.onSync(); location.href = u; }
    catch (e) { setBusy(false); setMsg(mensagemVincular(e)); }
  }
  async function salvarSenha() {
    if ((pw || "").length < 6) { setMsg("A senha precisa de 6 ou mais caracteres."); return; }
    setBusy(true);
    try { await trocarSenha(pw!); setPw(null); setMsg("Senha salva. Agora dá para entrar com e-mail e senha."); onAviso("Senha salva."); await carregar(); }
    catch (e) { setMsg(mensagemAuth(e)); }
    setBusy(false);
  }
  const tem = (k: string) => !!pf?.prov.includes(k);
  const cab = st.busy ? "Sincronizando…" : st.err ? st.err : st.pend ? `${st.pend} ${st.pend > 1 ? "mudanças" : "mudança"} daqui esperando envio` : mt.at ? "Em dia com a nuvem ✓" : "Ainda não sincronizou";
  return (
    <section aria-labelledby="v-cn">
      <h2 id="v-cn">Conta e sincronização</h2>
      <p className={st.err ? "neg" : "lnota"} role="status"><b>{cab}</b></p>
      <p className="lnota">{conta.email}{mt.at ? ` · conferido ${quando(mt.at)}` : ""}{mt.upAt ? ` · ↑ enviado ${quando(mt.upAt)}` : ""}{mt.downAt ? ` · ↓ recebido ${quando(mt.downAt)}` : ""}</p>
      <div className="vacoes">
        <button type="button" className="btn ghost" disabled={st.busy} onClick={conta.onAgora}>Sincronizar agora</button>
        <button type="button" className="perigo" onClick={async () => {
          if (!armado) { setArmado(true); setTimeout(() => setArmado(false), 5000); return; }
          const m = await conta.onSair(); setArmado(false); if (m) onAviso(m);
        }}>{armado ? "Toque de novo: sai e apaga os dados daqui" : "Sair da conta"}</button>
      </div>
      <h3 className="vsub" id="v-fe">Formas de entrar</h3>
      {!pf ? <p className="lnota">{msg || "Carregando as formas de entrar…"}</p> : (
        <ul className="vfe" aria-labelledby="v-fe">
          <li><span><b>E-mail e senha</b>{tem("email") && <em className="vok"> vinculado ✓</em>}</span>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setPw(pw === null ? "" : null)}>{tem("email") ? "Trocar senha" : "Criar senha"}</button></li>
          <li><span><b>Google</b>{tem("google") && <em className="vok"> vinculado ✓</em>}</span>
            {!tem("google") && <button type="button" className="btn ghost" disabled={busy} onClick={vincular}>Vincular</button>}</li>
        </ul>
      )}
      {pw !== null && (
        <div className="vsenhanova">
          <label className="sr" htmlFor="v-pwn">Senha nova</label>
          <input id="v-pwn" type="password" autoComplete="new-password" placeholder="Senha nova (6 ou mais)" value={pw} onChange={e => setPw(e.target.value)} />
          <button type="button" className="btn" disabled={busy} onClick={salvarSenha}>Salvar senha</button>
        </div>
      )}
      {pf && msg && <p className="lnota" role="alert">{msg}</p>}
      <p className="lnota">Os dados ficam na sua conta e voltam quando você entrar de novo. Quem tem a conta vê os dados em texto: a proteção é o login.</p>
    </section>
  );
}
