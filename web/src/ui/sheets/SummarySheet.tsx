import { useState } from "react";
import { useStore } from "../../lib/createStore";
import { isFixedCat } from "../../lib/categories";
import { MESN, R, dayLbl } from "../../lib/format";
import { summary, summaryMonths } from "../../lib/ledger";
import { actions, ledger } from "../../lib/store";
import { SheetHead } from "../Sheet";
import { toast } from "../uiStore";

const monLbl = (ym: string) => MESN[+ym.slice(5) - 1] + "/" + ym.slice(2, 4);

/** resumo do mês por categoria (todas as contas); categorias criadas por ele podem ser renomeadas ou apagadas aqui */
export function SummarySheet() {
  const { accts, entries } = useStore(ledger, s => s);
  const months = summaryMonths(accts, entries);
  const [ym, setYm] = useState(months[0]), [type, setType] = useState<"desp" | "rec">("desp");
  const [open, setOpen] = useState(""), [name, setName] = useState("");
  const { rows, total } = summary(accts, entries, ym, type);
  const other = summary(accts, entries, ym, type === "desp" ? "rec" : "desp").total;
  const label = (c: string) => c || "Sem categoria";
  const rename = (from: string, to: string) => { actions.renameCat(from, to); setOpen(""); toast(to.trim() ? "Categoria renomeada" : "Categoria apagada (lançamentos ficam sem categoria)"); };
  return (<>
    <SheetHead title="Resumo do mês" />
    <div className="cards" id="smMons">{months.map(m => <button type="button" key={m} className="cpill txt" data-sm={m} aria-pressed={m === ym} onClick={() => { setYm(m); setOpen(""); }}>{monLbl(m)}</button>)}</div>
    <div className="seg" id="smSeg">
      <button type="button" aria-pressed={type === "desp"} onClick={() => { setType("desp"); setOpen(""); }}>Saídas</button>
      <button type="button" aria-pressed={type === "rec"} onClick={() => { setType("rec"); setOpen(""); }}>Entradas</button>
    </div>
    <p className="smtot" id="smTot"><small>{type === "desp" ? "Saiu" : "Entrou"} em {monLbl(ym)}</small><b>{R(total)}</b>
      {other > 0 && <small>{type === "desp" ? "Entrou" : "Saiu"} {R(other)} · saldo do mês {R(type === "desp" ? other - total : total - other)}</small>}</p>
    {!rows.length && <p className="hint">Nada neste mês.</p>}
    {rows.map(r => (
      <details className="smrow" key={r.cat} open={open === r.cat} onToggle={e => { if ((e.target as HTMLDetailsElement).open) { setOpen(r.cat); setName(r.cat); } else if (open === r.cat) setOpen(""); }}>
        <summary>
          <span className="smn">{label(r.cat)}<small>{r.list.length} lançamento{r.list.length > 1 ? "s" : ""} · {Math.round((r.cents / total) * 100)}%</small></span>
          <b>{R(r.cents)}</b>
          <div className="smbar"><i style={{ width: Math.max(2, Math.round((r.cents / total) * 100)) + "%" }} /></div>
        </summary>
        {[...r.list].sort((a, b) => b.date.localeCompare(a.date)).map(e => <div className="ln" key={e.id}><span>{dayLbl(e.date).replace(/ de .*/, "")}</span><span className="dsc">{e.desc}</span><b>{R(e.cents)}</b></div>)}
        {r.cat && !isFixedCat(r.cat) && (
          <div className="smedit">
            <input type="text" aria-label="Nome da categoria" maxLength={20} value={name} onChange={e => setName(e.target.value)} />
            <button type="button" className="btn soft" data-rn={r.cat} disabled={!name.trim() || name.trim() === r.cat} onClick={() => rename(r.cat, name)}>Renomear</button>
            <button type="button" className="btn soft bad-txt" data-rm={r.cat} onClick={() => rename(r.cat, "")}>Apagar</button>
          </div>
        )}
      </details>
    ))}
  </>);
}
