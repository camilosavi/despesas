import { useState } from "react";
import { useStore } from "../../lib/createStore";
import { digits, moneyMask, today, uid } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import { Badge } from "../Badge";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, toast, ui } from "../uiStore";

/** transferir entre contas: cria duas entradas ligadas por `tr` (neutra no total) */
export function TranSheet() {
  const accts = useStore(ledger, s => s.accts), openId = useStore(ui, s => s.openId);
  const [from, setFrom] = useState(() => (openId && accts.some(a => a.id === openId) ? openId : accts[0]?.id ?? ""));
  const [to, setTo] = useState(() => accts.find(a => a.id !== from)?.id ?? "");
  const [amt, setAmt] = useState(""), [date, setDate] = useState(today()), [err, setErr] = useState("");

  if (accts.length < 2) return (<>
    <SheetHead title="Transferir" />
    <p className="hint" style={{ color: "var(--muted)" }}>Crie duas contas primeiro.</p>
    <button type="button" className="btn primary wide" onClick={() => { closeSheet(); ui.set({ sheet: { kind: "add" } }); }}>Adicionar conta</button>
  </>);

  const chip = (a: (typeof accts)[number], sel: string, on: () => void) => (
    <button type="button" key={a.id} className="cpill" aria-pressed={a.id === sel} onClick={on}><Badge name={a.name} color={a.color} label={a.label} /><span>{a.name}</span></button>
  );
  const pickFrom = (id: string) => { setFrom(id); if (to === id) setTo(accts.find(a => a.id !== id)?.id ?? ""); };
  function save() {
    const v = digits(amt);
    if (!v) { setErr("Informe o valor."); return; }
    if (!date) { setErr("Informe a data."); return; }
    const A = accts.find(a => a.id === from), B = accts.find(a => a.id === to); if (!A || !B) return;
    const tr = uid(), at = Date.now();
    actions.addEntries(
      { id: uid(), acct: A.id, type: "desp", cents: v, date, desc: "Transferência para " + B.name, xfer: 1, tr, at },
      { id: uid(), acct: B.id, type: "rec", cents: v, date, desc: "Transferência de " + A.name, xfer: 1, tr, at },
    );
    closeSheet(); toast("Transferência feita ✓");
  }
  return (<>
    <SheetHead title="Transferir" />
    <div className="bigamt"><span>R$</span><MoneyInput id="tfAmt" aria-label="Valor" autoFocus value={amt} onChange={v => setAmt(moneyMask(v))} /></div>
    <div className="field"><span className="lbl">De</span><div className="cards" id="tfFrom">{accts.map(a => chip(a, from, () => pickFrom(a.id)))}</div></div>
    <div className="field"><span className="lbl">Para</span><div className="cards" id="tfTo">{accts.filter(a => a.id !== from).map(a => chip(a, to, () => setTo(a.id)))}</div></div>
    <div className="field"><label htmlFor="tfDate">Data</label><input type="date" id="tfDate" value={date} onChange={e => setDate(e.target.value)} /></div>
    <p className="err" id="tfErr">{err}</p>
    <button type="button" className="btn primary wide" id="tfSave" onClick={save}>Transferir</button>
  </>);
}
