import { useState } from "react";
import { catsOf } from "../../lib/categories";
import { catForDesc, descHints } from "../../lib/ledger";
import { lsGet, lsSet } from "../../lib/storage";
import { useStore } from "../../lib/createStore";
import { brl, digits, moneyMask, today, uid } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import type { Entry, EntryType } from "../../lib/types";
import { Badge } from "../Badge";
import { DateField } from "../DateField";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, toast, ui } from "../uiStore";

/** lançar à mão (saída/entrada) ou, com `editId`, editar um lançamento */
const KEY_LAST = "despesas.zero.lastAcct"; // última conta usada ao lançar
export function LancSheet({ editId, copyId }: { editId?: string; copyId?: string }) {
  const { accts, entries } = useStore(ledger, s => s);
  const openId = useStore(ui, s => s.openId);
  const base = entries.find(x => x.id === (editId ?? copyId)), old = editId ? base : undefined; // duplicar = mesmos dados, lançamento novo
  const [type, setType] = useState<EntryType>(base?.type ?? "desp");
  const [amt, setAmt] = useState(base ? brl(base.cents) : ""), [desc, setDesc] = useState(base?.desc ?? ""), [cat, setCat] = useState(base?.cat ?? ""), [newCat, setNewCat] = useState(false), [touched, setTouched] = useState(!!base);
  const [acct, setAcct] = useState(() => { const last = lsGet(KEY_LAST) ?? ""; return base && accts.some(a => a.id === base.acct) ? base.acct : openId && accts.some(a => a.id === openId) ? openId : accts.some(a => a.id === last) ? last : accts[0]?.id ?? ""; });
  const [date, setDate] = useState(old?.date ?? today()), [err, setErr] = useState("");

  if (!accts.length) return (<>
    <SheetHead title="Lançar" />
    <p className="hint" style={{ color: "var(--muted)" }}>Crie uma conta primeiro.</p>
    <button type="button" className="btn primary wide" onClick={() => { closeSheet(); ui.set({ sheet: { kind: "add" } }); }}>Adicionar conta</button>
  </>);

  const onCard = accts.find(a => a.id === acct)?.kind === "cartao"; // compra no cartão: só saída
  const typ: EntryType = onCard ? "desp" : type;
  const changeType = (t: EntryType) => { setType(t); if (!catsOf(t, entries).includes(cat)) setCat(""); };
  const pickCat = (c: string) => { setCat(c); setTouched(true); };
  const typeDesc = (v: string) => { setDesc(v); if (!touched && !cat) { const c = catForDesc(entries, typ, v); if (c) setCat(c); } }; // descrição já usada: sugere a categoria dela
  const enter = (e: React.KeyboardEvent) => { if (e.key === "Enter") save(); };
  function save() {
    const v = digits(amt);
    if (!v) { setErr("Informe o valor."); return; }
    if (!date) { setErr("Informe a data."); return; }
    const type = typ, ds = desc.trim() || (type === "rec" ? "Entrada" : onCard ? "Compra" : "Saída");
    if (old) {
      const next: Entry = { ...old, acct, type, cents: v, date, desc: ds }; if (cat) next.cat = cat; else delete next.cat;
      actions.updateEntry(old.id, next); closeSheet(); toast("Lançamento atualizado ✓"); return;
    }
    actions.addEntries({ id: uid(), acct, type, cents: v, date, desc: ds, ...(cat ? { cat } : {}), at: Date.now() }); lsSet(KEY_LAST, acct);
    closeSheet(); toast(type === "rec" ? "Entrada lançada ✓" : onCard ? "Compra lançada ✓" : "Saída lançada ✓");
  }
  return (<>
    <SheetHead title={old ? "Editar" : copyId ? "Duplicar" : "Lançar"} />
    <div className="seg" id="lcSeg" hidden={onCard}>
      <button type="button" aria-pressed={type === "desp"} onClick={() => changeType("desp")}>Saída</button>
      <button type="button" aria-pressed={type === "rec"} onClick={() => changeType("rec")}>Entrada</button>
    </div>
    <div className="bigamt"><span>R$</span><MoneyInput id="lcAmt" aria-label="Valor" autoFocus value={amt} onChange={v => setAmt(moneyMask(v))} onKeyDown={enter} /></div>
    <div className="field"><label htmlFor="lcDesc">Descrição</label><input type="text" id="lcDesc" maxLength={60} placeholder="Ex.: mercado, Pix, salário" list="lcDescList" autoComplete="off" value={desc} onChange={e => typeDesc(e.target.value)} onKeyDown={enter} /><datalist id="lcDescList">{descHints(entries, typ).map(d => <option key={d} value={d} />)}</datalist></div>
    <div className="field"><span className="lbl">Categoria</span>
      <div className="cards" id="lcCats">{catsOf(type, entries, cat).map(c => <button type="button" key={c} className="cpill txt" aria-pressed={c === cat} onClick={() => { pickCat(c === cat ? "" : c); setNewCat(false); }}>{c}</button>)}
        <button type="button" className="cpill txt add" id="lcCatNew" aria-pressed={newCat} onClick={() => { setNewCat(!newCat); if (!newCat) pickCat(""); }}>+ Nova</button></div>
      {newCat && <input type="text" id="lcCatName" aria-label="Nova categoria" placeholder="Nome da categoria" maxLength={20} autoFocus value={cat} onChange={e => setCat(e.target.value.replace(/^\s+/, "").replace(/^./, m => m.toUpperCase()))} />}
    </div>
    <div className="field"><span className="lbl" id="lcAcctL">{typ === "rec" ? "Entra na conta" : onCard ? "Compra no cartão" : "Sai da conta"}</span>
      <div className="cards" id="lcAccts">{accts.map(a => <button type="button" key={a.id} className="cpill" aria-pressed={a.id === acct} onClick={() => setAcct(a.id)}><Badge name={a.name} color={a.color} label={a.label} /><span>{a.name}</span></button>)}</div>
    </div>
    <DateField id="lcDate" value={date} onChange={setDate} />
    <p className="err" id="lcErr">{err}</p>
    <button type="button" className="btn primary wide" id="lcSave" onClick={save}>Salvar</button>
  </>);
}
