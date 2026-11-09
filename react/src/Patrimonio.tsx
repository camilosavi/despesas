import { useEffect } from "react";
import type { Estado } from "./engine";
import * as C from "./engine";
import type { Backup } from "./loja";
import { nwSnap, patrimonio, ultimos } from "./patrimonio";
import { R, RM, mLab, MES } from "./format";
import "./telas.css";

export function Patrimonio({ e, b, onSalvar, onVoltar }: { e: Estado; b: Backup | null; onSalvar: (b: Backup) => void; onVoltar: () => void }) {
  const p = b ? patrimonio(e, b) : null, ym = C.mesDe(e.hoje);
  useEffect(() => { if (b && p) { const nb = nwSnap(b, ym, p.total); if (nb !== b) onSalvar(nb); } }, [b, p, ym, onSalvar]);
  if (!b || !p) return (
    <main className="pg tela"><button type="button" className="btn ghost" onClick={onVoltar}>‹ Contas</button><h1>Patrimônio</h1>
      <p className="vazio">Escolha “Começar do zero” ou “Usar meus dados” para ver o patrimônio.</p></main>
  );
  const H = ultimos(b, ym), max = Math.max(1, ...H.map(x => Math.abs(x.cents ?? 0)));
  const L: [string, number, boolean][] = [["Nas contas", p.contas, false], ["Guardado nas caixinhas", p.guardado, false], ["Dívidas em aberto", -p.dividas, true], ["Limite usado dos cartões", -p.cartoes, true]];
  return (
    <main className="pg tela patri">
      <button type="button" className="btn ghost" onClick={onVoltar}>‹ Contas</button>
      <h1>Patrimônio</h1>
      <section className="tcard" aria-label="Patrimônio hoje">
        <small>Hoje, em reais</small>
        <b className={p.total < 0 ? "neg" : ""}>{R(p.total)}</b>
        <ul>{L.map(([n, v]) => <li key={n}><span>{n}</span><b className={v < 0 ? "neg" : ""}>{R(v)}</b></li>)}</ul>
        {(p.moedas.EUR !== 0 || p.moedas.USD !== 0) && (
          <p className="vazio">Fora do total (sem converter): {[p.moedas.EUR && RM(p.moedas.EUR, "EUR"), p.moedas.USD && RM(p.moedas.USD, "USD")].filter(Boolean).join(" · ")}</p>
        )}
      </section>
      <section aria-label="Últimos 12 meses">
        <h2>Últimos 12 meses</h2>
        <ul className="thist">
          {H.map(x => (
            <li key={x.ym} aria-label={`${mLab(x.ym)}: ${x.cents == null ? "sem registro" : R(x.cents)}`}>
              <span>{MES[+x.ym.slice(5) - 1]}/{x.ym.slice(2, 4)}</span>
              <span className="tbar" aria-hidden="true">{x.cents != null && <i className={x.cents < 0 ? "neg" : ""} style={{ width: Math.max(2, (Math.abs(x.cents) / max) * 100) + "%" }} />}</span>
              <b className={x.cents != null && x.cents < 0 ? "neg" : ""}>{x.cents == null ? "—" : R(x.cents)}</b>
            </li>
          ))}
        </ul>
        <p className="vazio">O app guarda o valor do mês toda vez que você abre esta tela; o último do mês fica como fechamento. Meses sem registro aparecem com “—”.</p>
      </section>
    </main>
  );
}
