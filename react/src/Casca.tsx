import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export type TelaId = string;
const SV = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const IC = {
  inicio: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  contas: "M5 7V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1M3 7h18v13H3zM16 13.5h2.5",
  cartoes: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18",
  plan: "M12 3v18M12 3l6 3-6 3",
  rel: "M5 20V10M12 20V4M19 20v-7",
};
// qual aba da barra acende em cada tela (igual ao app antigo: Compromissos e Relatórios acendem Contas)
export const abaDe = (t: TelaId): "inicio" | "contas" | "cartoes" | "voce" =>
  t === "inicio" || t === "busca" || t === "avisos" ? "inicio" : t === "cartoes" ? "cartoes" : t === "voce" || t === "of" ? "voce"
    : "contas";

export function Barra({ tela, onIr, foto, nome }: { tela: TelaId; onIr: (t: TelaId) => void; foto: string; nome: string }) {
  const ab = abaDe(tela), ordem = ["inicio", "contas", "cartoes"], i = ordem.indexOf(ab);
  const tab = (k: string, n: string, d: string) => (
    <button key={k} className="tab" aria-current={ab === k ? "page" : undefined} onClick={() => onIr(k)}><SV d={d} /><span>{n}</span></button>
  );
  return (
    <nav className={"tabs" + (ab === "voce" ? " onme" : "")} aria-label="Seções" style={{ "--ti": Math.max(0, i) } as CSSProperties}>
      <span className="tabbrand" aria-hidden="true">Um Tostão</span>
      {tab("inicio", "Início", IC.inicio)}{tab("contas", "Contas", IC.contas)}{tab("cartoes", "Cartões", IC.cartoes)}
      <button className="tabav" id="tabAv" aria-label="Você: perfil e ajustes" onClick={() => onIr("voce")}
        style={foto ? { backgroundImage: `url(${foto})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" } : undefined}>{nome ? nome[0].toUpperCase() : "U"}</button>
    </nav>
  );
}

export function Gaveta({ aberta, tela, onFechar, onIr }: { aberta: boolean; tela: TelaId; onFechar: () => void; onIr: (t: TelaId) => void }) {
  const [visivel, setVisivel] = useState(false), [on, setOn] = useState(false);
  useEffect(() => {
    if (aberta) { setVisivel(true); const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }
    setOn(false); const t = setTimeout(() => setVisivel(false), 220); return () => clearTimeout(t);
  }, [aberta]);
  useEffect(() => { if (!aberta) return; const f = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [aberta, onFechar]);
  if (!visivel) return null;
  const cur = abaDe(tela) === "voce" ? "voce" : tela === "metas" || tela === "pessoas" || tela === "moedas" || tela === "fixos" || tela === "categorias" ? "plan" : tela === "relatorios" ? "rel" : abaDe(tela);
  const b = (k: string, n: string, d: string, alvo = k) => (
    <button key={k} className={"sb" + (cur === k ? " on" : "")} title={n} onClick={() => { onIr(alvo); onFechar(); }}><SV d={d} /><span>{n}</span></button>
  );
  return (
    <>
      <div className={"drawer" + (on ? " on" : "")} onClick={ev => { if (ev.target === ev.currentTarget) onFechar(); }}>
        <div className="dwbox" role="dialog" aria-label="Menu">
          <span className="sbbrand"><img src="tostao-logo.png" alt="Um Tostão" /></span>
          <div className="sbgrp"><small>Menu principal</small>{b("inicio", "Início", IC.inicio)}{b("contas", "Contas", IC.contas)}{b("cartoes", "Cartões", IC.cartoes)}</div>
          <div className="sbgrp"><small>Planejamento</small>{b("plan", "Compromissos", IC.plan, "metas")}</div>
          <div className="sbgrp"><small>Análises</small>{b("rel", "Relatórios", IC.rel, "relatorios")}</div>
          <div className="sbgrp"><small>Conta</small>
            <button className={"sb" + (cur === "voce" ? " on" : "")} onClick={() => { onIr("voce"); onFechar(); }}><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg><span>Você e ajustes</span></button>
          </div>
        </div>
      </div>
    </>
  );
}
