import { useStore } from "../lib/createStore";
import { accBal } from "../lib/ledger";
import { signR } from "../lib/format";
import { ledger } from "../lib/store";
import { Badge } from "./Badge";
import { openAccount, openSheet } from "./uiStore";

import { boxBal, boxBrl, boxIcon, boxProgress, boxTotalsByCur, fmtMoneyCur } from "../lib/boxes";

/** lista de contas e caixinhas */
export function Home() {
  const { accts, entries, boxes } = useStore(ledger, s => s);
  const totals = boxTotalsByCur(boxes);

  return (
    <>
      <section className="sec ctas">
        <h2>Contas</h2>
        {accts.map(a => {
          const b = accBal(a, entries);
          return (
            <button type="button" key={a.id} className="acrow" data-open={a.id} onClick={() => openAccount(a.id)}>
              <Badge name={a.name} color={a.color} label={a.label} /><span className="nm">{a.name}</span><b className={b < 0 ? "bad" : ""}>{signR(b)}</b>
            </button>
          );
        })}
        <button type="button" className="acrow add" id="acctNew" onClick={() => openSheet({ kind: "add" })}><span className="fi">+</span><span className="nm">Adicionar conta</span></button>
      </section>

      <section className="sec ctas" style={{ marginTop: "28px" }}>
        <div className="sec-head-row">
          <h2>Dinheiro guardado</h2>
          <div className="sec-totals-row">
            {totals.BRL > 0 && <span className="boxtot-chip">{fmtMoneyCur(totals.BRL, "BRL")}</span>}
            {totals.EUR > 0 && <span className="boxtot-chip">{fmtMoneyCur(totals.EUR, "EUR")}</span>}
            {totals.USD > 0 && <span className="boxtot-chip">{fmtMoneyCur(totals.USD, "USD")}</span>}
          </div>
        </div>

        {boxes.map(b => {
          const bal = boxBal(b), inBrl = boxBrl(b);
          const prog = boxProgress(b);
          return (
            <button
              type="button"
              key={b.id}
              className="acrow boxrow"
              onClick={() => openSheet({ kind: "box", id: b.id })}
            >
              <span className="boxico">{boxIcon(b)}</span>
              <div className="boxrow-info">
                <span className="nm">{b.name}</span>
                {prog && (
                  <div className="boxrow-prog">
                    <div className="boxrow-bar"><i style={{ width: `${prog.pct}%` }} /></div>
                    <small>{prog.done ? "Meta batida ✓" : `${prog.pct}% · falta ${fmtMoneyCur(prog.left, b.cur)}`}</small>
                  </div>
                )}
              </div>
              <div className="boxrow-vals">
                <b className={`boxrow-val ${bal < 0 ? "bad" : ""}`}>{fmtMoneyCur(bal, b.cur)}</b>
                {inBrl !== 0 && <small>+ {fmtMoneyCur(inBrl, "BRL")}</small>}
              </div>
            </button>
          );
        })}

        <button
          type="button"
          className="acrow add"
          onClick={() => openSheet({ kind: "boxForm" })}
        >
          <span className="fi">+</span>
          <span className="nm">Nova caixinha</span>
        </button>
      </section>
    </>
  );
}

