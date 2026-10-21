import { useState } from "react";
import { useStore } from "../../lib/createStore";
import { digits, moneyMask, signR, today, uid } from "../../lib/format";
import { accBal } from "../../lib/ledger";
import { actions, ledger } from "../../lib/store";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, toast } from "../uiStore";

/** conferir o saldo do app com o do banco; se não bate, lança um ajuste (não conta como receita nem gasto) */
export function ConferSheet({ id }: { id: string }) {
  const { accts, entries } = useStore(ledger, s => s);
  const a = accts.find(x => x.id === id);
  const [real, setReal] = useState(""), [neg, setNeg] = useState(false);
  if (!a) return null;
  const app = accBal(a, entries), typed = real !== "", bank = (neg ? -1 : 1) * digits(real), diff = bank - app;
  function adjust() {
    if (!diff) return;
    actions.addEntries({ id: uid(), acct: a!.id, type: diff > 0 ? "rec" : "desp", cents: Math.abs(diff), date: today(), desc: "Ajuste de saldo", imp: "ajuste-" + uid(), at: Date.now() });
    closeSheet(); toast("Saldo ajustado ✓");
  }
  return (<>
    <SheetHead title={"Conferir saldo " + a.name} />
    <p className="smtot"><small>Saldo no app (hoje)</small><b>{signR(app)}</b></p>
    <div className="field"><label htmlFor="cfAmt">Saldo no app do banco (R$)</label>
      <div className="fx-calc-row"><MoneyInput id="cfAmt" autoFocus value={real} onChange={v => setReal(moneyMask(v))} />
        <button type="button" className="btn soft" aria-pressed={neg} onClick={() => setNeg(!neg)}>{neg ? "Negativo" : "Positivo"}</button></div>
    </div>
    {typed && (diff === 0
      ? <p className="ok" id="cfRes" style={{ fontWeight: 600 }}>Bate com o banco ✓</p>
      : <div id="cfRes"><p className="bad" style={{ fontWeight: 600, margin: "0 0 4px" }}>{diff > 0 ? "Faltam " : "Sobram "}{signR(Math.abs(diff))} no app</p>
        <p className="hint" style={{ color: "var(--muted)", marginTop: 0 }}>Veja se esqueceu de lançar algo. Se não achar, o ajuste corrige o saldo sem virar receita nem gasto.</p>
        <button type="button" className="btn primary wide" id="cfAdj" onClick={adjust}>Lançar ajuste de {signR(diff)}</button></div>)}
  </>);
}
