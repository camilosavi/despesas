import { useState } from "react";
import { catsOf } from "../../lib/categories";
import { catForDesc, descHints } from "../../lib/ledger";
import { lsGet, lsSet } from "../../lib/storage";
import { useStore } from "../../lib/createStore";
import { brl, digits, moneyMask, today } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import { MAX_REP, launchEntries, repCount, type Rep } from "../../lib/launch";
import type { Entry, EntryType } from "../../lib/types";
import { Badge } from "../Badge";
import { DateField } from "../DateField";
import { Dot } from "../Dot";
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
  const [open, setOpen] = useState(!!base?.open), [more, setMore] = useState(false);
  const [rk, setRk] = useState<"1" | "p" | "m" | "u">("1"), [rn, setRn] = useState("3"), [ru, setRu] = useState("");
  const [ppl, setPpl] = useState("1"), [two, setTwo] = useState(false), [acct2, setAcct2] = useState(""), [amt2, setAmt2] = useState("");

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
    const rep: Rep = rk === "1" ? { k: "1" } : rk === "u" ? { k: "u", until: ru } : { k: rk, n: Math.floor(+rn) || 0 };
    if (!old && rk !== "1" && !repCount(rep, date)) { setErr(rk === "u" ? "Escolha um mês final igual ou depois do mês da data." : `Informe de 2 a ${MAX_REP} meses.`); return; }
    const c2 = digits(amt2), useTwo = !old && two && !onCard && typ === "desp" && rk === "1";
    if (useTwo && (!acct2 || acct2 === acct || accts.find(a => a.id === acct2)?.kind === "cartao" || !c2 || c2 >= v)) { setErr("Escolha a outra conta e um valor menor que o total."); return; }
    const type = typ, ds = desc.trim() || (type === "rec" ? "Entrada" : onCard ? "Compra" : "Saída");
    if (old) {
      const next: Entry = { ...old, acct, type, cents: v, date, desc: ds }; if (cat) next.cat = cat; else delete next.cat;
      if (open && !onCard) next.open = 1; else delete next.open;
      actions.updateEntry(old.id, next); closeSheet(); toast("Lançamento atualizado ✓"); return;
    }
    const list = launchEntries({ acct, type, cents: v, date, desc: ds, cat, open: open && !onCard, rep, people: rk === "1" && !two ? Math.floor(+ppl) || 1 : 1, ...(useTwo ? { acct2, cents2: c2 } : {}) });
    actions.addEntries(...list); lsSet(KEY_LAST, acct);
    closeSheet(); toast(list.length > 1 ? `${list.length} lançamentos criados ✓` : open && !onCard ? (type === "rec" ? "A receber lançado ✓" : "A pagar lançado ✓") : type === "rec" ? "Entrada lançada ✓" : onCard ? "Compra lançada ✓" : "Saída lançada ✓");
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
      <div className="cards" id="lcCats">{catsOf(type, entries, cat).map(c => <button type="button" key={c} className="cpill txt" aria-pressed={c === cat} onClick={() => { pickCat(c === cat ? "" : c); setNewCat(false); }}><Dot c={c} />{c}</button>)}
        <button type="button" className="cpill txt add" id="lcCatNew" aria-pressed={newCat} onClick={() => { setNewCat(!newCat); if (!newCat) pickCat(""); }}>+ Nova</button></div>
      {newCat && <input type="text" id="lcCatName" aria-label="Nova categoria" placeholder="Nome da categoria" maxLength={20} autoFocus value={cat} onChange={e => setCat(e.target.value.replace(/^\s+/, "").replace(/^./, m => m.toUpperCase()))} />}
    </div>
    <div className="field"><span className="lbl" id="lcAcctL">{typ === "rec" ? "Entra na conta" : onCard ? "Compra no cartão" : "Sai da conta"}</span>
      <div className="cards" id="lcAccts">{accts.map(a => <button type="button" key={a.id} className="cpill" aria-pressed={a.id === acct} onClick={() => setAcct(a.id)}><Badge name={a.name} color={a.color} label={a.label} /><span>{a.name}</span></button>)}</div>
    </div>
    <DateField id="lcDate" value={date} onChange={setDate} />
    {!onCard && <div className="seg" id="lcOpen"><button type="button" aria-pressed={!open} onClick={() => setOpen(false)}>{typ === "rec" ? "Recebido" : "Pago"}</button><button type="button" aria-pressed={open} onClick={() => setOpen(true)}>{typ === "rec" ? "A receber" : "A pagar"}</button></div>}
    {open && !onCard && <p className="hint">Fica na lista e só mexe no saldo quando você marcar como {typ === "rec" ? "recebido" : "pago"}.</p>}
    {!old && <button type="button" className="btn soft wide" id="lcMore" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Menos opções ▴" : "Mais opções ▾"}</button>}
    {!old && more && <div id="lcMoreBox">
      <div className="field"><label htmlFor="lcRep">Repetir</label>
        <select id="lcRep" value={rk} onChange={e => { const k = e.target.value as typeof rk; setRk(k); if (k !== "1") setTwo(false); }}>
          <option value="1">Só uma vez</option><option value="p">Parcelado (o valor é o total)</option><option value="m">Todo mês (o valor se repete)</option><option value="u">Todo mês, até um mês</option>
        </select>
        {(rk === "p" || rk === "m") && <input type="number" id="lcRepN" aria-label="Quantos meses" inputMode="numeric" min={2} max={MAX_REP} value={rn} onChange={e => setRn(e.target.value)} placeholder="Quantos meses" />}
        {rk === "u" && <input type="month" id="lcRepU" aria-label="Até o mês" value={ru} onChange={e => setRu(e.target.value)} />}
        {rk !== "1" && repCount(rk === "u" ? { k: "u", until: ru } : { k: rk, n: Math.floor(+rn) || 0 }, date) > 0 && <p className="hint">{rk === "p" ? `${repCount({ k: "p", n: +rn }, date)}× de ${brl(Math.floor(digits(amt) / (+rn || 1)))}` : `${repCount(rk === "u" ? { k: "u", until: ru } : { k: "m", n: +rn }, date)} meses de ${amt || "0,00"}`} · todo dia {date.slice(8)}</p>}
        {onCard && rk !== "1" && <p className="hint">Cada parcela cai na fatura do mês dela.</p>}
      </div>
      {typ === "desp" && !onCard && rk === "1" && <>
        <div className="field"><label htmlFor="lcPpl">Dividir com outras pessoas</label>
          <select id="lcPpl" value={two ? "1" : ppl} disabled={two} onChange={e => setPpl(e.target.value)}>
            <option value="1">Não dividir</option>{[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>Entre {n} pessoas (você + {n - 1})</option>)}
          </select>
          {+ppl > 1 && !two && digits(amt) > 0 && <p className="hint">Sai tudo da conta; {+ppl - 1} partes de {brl(Math.floor(digits(amt) / +ppl))} ficam "A receber".</p>}
        </div>
        <div className="field"><span className="lbl">Pagar com duas formas</span>
          <button type="button" className="cpill txt" aria-pressed={two} onClick={() => { setTwo(!two); setPpl("1"); }}>{two ? "Sim" : "Não"}</button>
          {two && <>
            <div className="cards" id="lcAccts2">{accts.filter(a => a.id !== acct && a.kind !== "cartao").map(a => <button type="button" key={a.id} className="cpill" aria-pressed={a.id === acct2} onClick={() => setAcct2(a.id)}><Badge name={a.name} color={a.color} label={a.label} /><span>{a.name}</span></button>)}</div>
            <div className="bigamt sm"><span>R$</span><MoneyInput id="lcAmt2" aria-label="Valor na outra conta" value={amt2} onChange={v => setAmt2(moneyMask(v))} /></div>
            {digits(amt2) > 0 && digits(amt2) < digits(amt) && <p className="hint">{brl(digits(amt) - digits(amt2))} em {accts.find(a => a.id === acct)?.name}, {brl(digits(amt2))} na outra.</p>}
          </>}
        </div>
      </>}
    </div>}
    <p className="err" id="lcErr">{err}</p>
    <button type="button" className="btn primary wide" id="lcSave" onClick={save}>Salvar</button>
  </>);
}
