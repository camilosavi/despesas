import { useState } from "react";
import { useStore } from "../../lib/createStore";
import { bankOf } from "../../lib/banks";
import { MESN, R, brl, digits, moneyMask, today, uid } from "../../lib/format";
import { bankAccts, faturaDue, faturaPaid, faturas } from "../../lib/ledger";
import { actions, ledger } from "../../lib/store";
import { Badge } from "../Badge";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, toast } from "../uiStore";

const monLbl = (ym: string) => MESN[+ym.slice(5) - 1] + "/" + ym.slice(2, 4);

/** pagar a fatura do cartão: vira uma despesa na conta que paga (com as compras dentro); a fatura fica marcada como paga */
export function PaySheet({ id, ym: first }: { id: string; ym?: string }) {
  const { accts, entries } = useStore(ledger, s => s);
  const card = accts.find(a => a.id === id), pays = bankAccts(accts);
  const open = card ? faturas(card, entries).filter(f => !faturaPaid(card, f.ym, entries)).sort((x, y) => x.ym.localeCompare(y.ym)) : [];
  const start = open.find(f => f.ym === first) || open.find(f => f.ym === today().slice(0, 7)) || open[0];
  const [ym, setYm] = useState(start?.ym ?? "");
  const [amt, setAmt] = useState(start ? brl(start.cents) : "");
  const [date, setDate] = useState(card && start ? faturaDue(card, start.ym) : today());
  const bk = card ? bankOf(card.name) : null;
  const [acct, setAcct] = useState(() => (bk && pays.find(a => bankOf(a.name) === bk)?.id) || pays[0]?.id || "");
  const [err, setErr] = useState("");
  if (!card) return null;
  const f = open.find(x => x.ym === ym);
  if (!f || !pays.length) return (<>
    <SheetHead title="Pagar fatura" />
    <p className="hint" style={{ color: "var(--muted)" }}>{pays.length ? "Nenhuma fatura em aberto neste cartão." : "Crie uma conta com saldo para pagar a fatura."}</p>
  </>);
  const pick = (x: (typeof open)[number]) => { setYm(x.ym); setAmt(brl(x.cents)); setDate(faturaDue(card, x.ym)); };
  function save() {
    const v = digits(amt);
    if (!v) { setErr("Informe o valor."); return; }
    if (!date) { setErr("Informe a data."); return; }
    if (!acct) return;
    actions.addEntries({ id: uid(), acct, type: "desp", cents: v, date, desc: "Fatura " + card!.name, cat: "Cartão", imp: `pagfatura-${card!.id}-${ym}`, at: Date.now(), items: f!.items.sort((a, b) => a.date.localeCompare(b.date)) });
    closeSheet(); toast("Fatura paga ✓");
  }
  return (<>
    <SheetHead title={"Pagar fatura " + card.name} />
    {open.length > 1 && <div className="field"><span className="lbl">Fatura</span>
      <div className="cards" id="pgMons">{open.map(x => <button type="button" key={x.ym} className="cpill txt" aria-pressed={x.ym === ym} onClick={() => pick(x)}>{monLbl(x.ym)} · {R(x.cents)}</button>)}</div>
    </div>}
    <div className="bigamt"><span>R$</span><MoneyInput id="pgAmt" aria-label="Valor" autoFocus value={amt} onChange={v => setAmt(moneyMask(v))} /></div>
    <p className="hint" style={{ color: "var(--muted)" }}>Fatura de {monLbl(ym)}: {f.items.length} compra{f.items.length > 1 ? "s" : ""} somam {R(f.cents)}</p>
    <div className="field"><span className="lbl">Paga pela conta</span>
      <div className="cards" id="pgAccts">{pays.map(a => <button type="button" key={a.id} className="cpill" aria-pressed={a.id === acct} onClick={() => setAcct(a.id)}><Badge name={a.name} color={a.color} label={a.label} /><span>{a.name}</span></button>)}</div>
    </div>
    <div className="field"><label htmlFor="pgDate">Data do pagamento</label><input type="date" id="pgDate" value={date} onChange={e => setDate(e.target.value)} /></div>
    <p className="err" id="pgErr">{err}</p>
    <button type="button" className="btn primary wide" id="pgSave" onClick={save}>Pagar</button>
  </>);
}
