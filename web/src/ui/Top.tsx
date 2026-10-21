import { useEffect } from "react";
import { useStore } from "../lib/createStore";
import { boxTotalsByCur, fmtMoneyCur } from "../lib/boxes";
import { accBal, cardMonthLbl, cardSpent, cardUsed, isCard, monIn, totBal } from "../lib/ledger";
import { MESN, R, brl, textOn, today } from "../lib/format";
import { ledger } from "../lib/store";
import { session, syncState, syncText } from "../lib/sync";
import { backHome, hidden, openSheet, toggleHide, ui } from "./uiStore";

/** o topo é o cartão: cor da conta aberta (ou do tema); texto claro ou escuro pelo contraste */
export function Top() {
  const { accts, entries, boxes } = useStore(ledger, s => s);
  const openId = useStore(ui, s => s.openId);
  const ses = useStore(session, s => s.ses);
  const hide = useStore(hidden, s => s.on);
  useStore(syncState, s => s); // redesenha o botão ☁ quando o estado da sincronização muda
  const a = openId ? accts.find(x => x.id === openId) : undefined, col = a ? a.color : null;

  useEffect(() => {
    const st = document.documentElement.style;
    if (col) { st.setProperty("--hc", col); st.setProperty("--tci", textOn(col)); } else { st.removeProperty("--hc"); st.removeProperty("--tci"); }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", col || "#14203A");
  }, [col]);

  const bt = boxTotalsByCur(boxes), boxParts = a ? [] : (["BRL", "EUR", "USD"] as const).filter(c => bt[c] !== 0).map(c => fmtMoneyCur(bt[c], c));
  const none = !accts.length, card = !!a && isCard(a), v = a ? (card ? cardSpent(a, entries) : accBal(a, entries)) : totBal(accts, entries);
  return (
    <header className="top">
      <div className={"tcard" + (boxParts.length ? " hasbox" : "")} id="tcard">
        <div className="trow">
          <button type="button" className="tb" id="back" hidden={!a} onClick={backHome}>‹ Contas</button>
          <div className="trr">
            <button type="button" className="tb" id="editCard" hidden={!a} onClick={() => openSheet({ kind: "edit" })}>Personalizar</button>
            <button type="button" className="tb eye" id="eyeBtn" aria-label={hide ? "Mostrar valores" : "Esconder valores"} aria-pressed={hide} onClick={toggleHide}>
              <svg viewBox="0 0 24 24">{hide ? <><path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0112 6c5 0 8.5 4.2 9.5 6a14 14 0 01-3 3.5M6.5 7.5A14 14 0 002.5 12c1 1.8 4.5 6 9.5 6 1.3 0 2.5-.3 3.5-.8" /><path d="M9.9 10a3 3 0 004.1 4.1" /></> : <><path d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6S3.5 13.8 2.5 12z" /><circle cx="12" cy="12" r="3" /></>}</svg>
            </button>
            <button type="button" className="tb" id="meBtn" hidden={!!a || !ses} onClick={() => openSheet({ kind: "me" })}>☁ {syncText() || "Conta"}</button>
          </div>
        </div>
        <h1 id="ptitle">{a ? a.name : "Minhas contas"}</h1>
        <div className="bigrow"><div>
          <p className="label" id="bigLabel">{none ? "Comece por aqui" : card ? cardMonthLbl(a!, MESN[+today().slice(5, 7) - 1]) : a ? "Saldo" : "Saldo total"}</p>
          <div className="big" id="big">{none ? "Sem contas" : <><small>R$</small>{v < 0 ? "−" : ""}{brl(Math.abs(v))}</>}</div>
        </div></div>
        <div className="split" id="split" hidden={none || (card && !a!.limit)}>
          {card
            ? <><span id="s1l">Limite disponível</span><b id="s1">{R(a!.limit! - cardUsed(a!, entries))}</b></>
            : <><span id="s1l">Entrou em {MESN[+today().slice(5, 7) - 1]}</span><b id="s1">{R(monIn(entries, a ? a.id : null))}</b></>}
        </div>
        {boxParts.length > 0 && <div className="boxline" id="boxline"><span>Nas caixinhas</span><b>{boxParts.join(" · ")}</b></div>}
      </div>
    </header>
  );
}
