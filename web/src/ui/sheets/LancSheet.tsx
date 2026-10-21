import { useState } from "react";
import { catsOf } from "../../lib/categories";
import { useStore } from "../../lib/createStore";
import { brl, digits, moneyMask, today, uid } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import type { Entry, EntryType } from "../../lib/types";
import { Badge } from "../Badge";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, toast, ui } from "../uiStore";

/** lançar à mão (saída/entrada) ou, com `editId`, editar um lançamento */
export function LancSheet({ editId }: { editId?: string }) {
  const { accts, entries } = useStore(ledger, s => s);
  const openId = useStore(ui, s => s.openId);
  const old = editId ? entries.find(x => x.id === editId) : undefined;
  const [type, setType] = useState<EntryType>(old?.type ?? "desp");
  const [amt, setAmt] = useState(old ? brl(old.cents) : ""), [desc, setDesc] = useState(old?.desc ?? ""), [cat, setCat] = useState(old?.cat ?? "");
  const [acct, setAcct] = useState(() => (old && accts.some(a => a.id === old.acct) ? old.acct : openId && accts.some(a => a.id === openId) ? openId : accts[0]?.id ?? ""));
  const [date, setDate] = useState(old?.date ?? today()), [err, setErr] = useState("");

  if (!accts.length) return (<>
    <SheetHead title="Lançar" />
    <p className="hint" style={{ color: "var(--muted)" }}>Crie uma conta primeiro.</p>
    <button type="button" className="btn primary wide" onClick={() => { closeSheet(); ui.set({ sheet: { kind: "add" } }); }}>Adicionar conta</button>
  </>);

  const changeType = (t: EntryType) => { setType(t); if (!catsOf(t).includes(cat)) setCat(""); };
  function save() {
    const v = digits(amt);
    if (!v) { setErr("Informe o valor."); return; }
    if (!date) { setErr("Informe a data."); return; }
    const ds = desc.trim() || (type === "rec" ? "Entrada" : "Saída");
    if (old) {
      const next: Entry = { ...old, acct, type, cents: v, date, desc: ds }; if (cat) next.cat = cat; else delete next.cat;
      actions.updateEntry(old.id, next); closeSheet(); toast("Lançamento atualizado ✓"); return;
    }
    actions.addEntries({ id: uid(), acct, type, cents: v, date, desc: ds, ...(cat ? { cat } : {}), at: Date.now() });
    closeSheet(); toast(type === "rec" ? "Entrada lançada ✓" : "Saída lançada ✓");
  }
  return (<>
    <SheetHead title={old ? "Editar" : "Lançar"} />
    <div className="seg" id="lcSeg">
      <button type="button" aria-pressed={type === "desp"} onClick={() => changeType("desp")}>Saída</button>
      <button type="button" aria-pressed={type === "rec"} onClick={() => changeType("rec")}>Entrada</button>
    </div>
    <div className="bigamt"><span>R$</span><MoneyInput id="lcAmt" aria-label="Valor" autoFocus value={amt} onChange={v => setAmt(moneyMask(v))} /></div>
    <div className="field"><label htmlFor="lcDesc">Descrição</label><input type="text" id="lcDesc" maxLength={60} placeholder="Ex.: mercado, Pix, salário" value={desc} onChange={e => setDesc(e.target.value)} /></div>
    <div className="field"><span className="lbl">Categoria</span>
      <div className="cards" id="lcCats">{catsOf(type).map(c => <button type="button" key={c} className="cpill txt" aria-pressed={c === cat} onClick={() => setCat(c === cat ? "" : c)}>{c}</button>)}</div>
    </div>
    <div className="field"><span className="lbl" id="lcAcctL">{type === "rec" ? "Entra na conta" : "Sai da conta"}</span>
      <div className="cards" id="lcAccts">{accts.map(a => <button type="button" key={a.id} className="cpill" aria-pressed={a.id === acct} onClick={() => setAcct(a.id)}><Badge name={a.name} color={a.color} label={a.label} /><span>{a.name}</span></button>)}</div>
    </div>
    <div className="field"><label htmlFor="lcDate">Data</label><input type="date" id="lcDate" value={date} onChange={e => setDate(e.target.value)} /></div>
    <p className="err" id="lcErr">{err}</p>
    <button type="button" className="btn primary wide" id="lcSave" onClick={save}>Salvar</button>
  </>);
}
