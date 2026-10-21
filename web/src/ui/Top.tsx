import { useEffect } from "react";
import { useStore } from "../lib/createStore";
import { accBal, cardMonthLbl, cardSpent, isCard, monIn, totBal } from "../lib/ledger";
import { MESN, R, brl, textOn, today } from "../lib/format";
import { ledger } from "../lib/store";
import { session, syncState, syncText } from "../lib/sync";
import { backHome, openSheet, ui } from "./uiStore";

/** o topo é o cartão: cor da conta aberta (ou do tema); texto claro ou escuro pelo contraste */
export function Top() {
  const { accts, entries } = useStore(ledger, s => s);
  const openId = useStore(ui, s => s.openId);
  const ses = useStore(session, s => s.ses);
  useStore(syncState, s => s); // redesenha o botão ☁ quando o estado da sincronização muda
  const a = openId ? accts.find(x => x.id === openId) : undefined, col = a ? a.color : null;

  useEffect(() => {
    const st = document.documentElement.style;
    if (col) { st.setProperty("--hc", col); st.setProperty("--tci", textOn(col)); } else { st.removeProperty("--hc"); st.removeProperty("--tci"); }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", col || "#14203A");
  }, [col]);

  const none = !accts.length, card = !!a && isCard(a), v = a ? (card ? cardSpent(a, entries) : accBal(a, entries)) : totBal(accts, entries);
  return (
    <header className="top">
      <div className="tcard" id="tcard">
        <div className="trow">
          <button type="button" className="tb" id="meBtn" hidden={!!a || !ses} onClick={() => openSheet({ kind: "me" })}>☁ {syncText() || "Conta"}</button>
          <button type="button" className="tb" id="back" hidden={!a} onClick={backHome}>‹ Contas</button>
          <button type="button" className="tb" id="editCard" hidden={!a} onClick={() => openSheet({ kind: "edit" })}>Personalizar</button>
        </div>
        <h1 id="ptitle">{a ? a.name : "Minhas contas"}</h1>
        <div className="bigrow"><div>
          <p className="label" id="bigLabel">{none ? "Comece por aqui" : card ? cardMonthLbl(a!, MESN[+today().slice(5, 7) - 1]) : a ? "Saldo" : "Saldo total"}</p>
          <div className="big" id="big">{none ? "Sem contas" : <><small>R$</small>{v < 0 ? "−" : ""}{brl(Math.abs(v))}</>}</div>
        </div></div>
        <div className="split" id="split" hidden={none || card}>
          <span id="s1l">Entrou em {MESN[+today().slice(5, 7) - 1]}</span><b id="s1">{R(monIn(entries, a ? a.id : null))}</b>
        </div>
      </div>
    </header>
  );
}
