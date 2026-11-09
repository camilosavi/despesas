import { useState } from "react";
import { meta } from "./nuvem";
import type { EstadoNuvem } from "./useNuvem";

const quando = (t?: number) => { if (!t) return ""; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : "em " + new Date(t).toLocaleDateString("pt-BR"); };

export function ContaNuvem({ conta, onAviso }: { conta: { email: string; st: EstadoNuvem; onAgora: () => void; onSair: () => Promise<string> }; onAviso: (m: string) => void }) {
  const [armado, setArmado] = useState(false);
  const { st } = conta, mt = meta();
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
      <p className="lnota">Os dados ficam na sua conta e voltam quando você entrar de novo. Quem tem a conta vê os dados em texto: a proteção é o login.</p>
    </section>
  );
}
