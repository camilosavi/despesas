import { useStore } from "../../lib/createStore";
import { isFut } from "../../lib/ledger";
import { R, fmtD, fmtDM, signR } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import { useArmed } from "../hooks";
import { SheetHead } from "../Sheet";
import { closeSheet, openSheet, toast } from "../uiStore";

/** ver um lançamento: editar ou apagar (transferência só apaga, e apaga o par) */
export function EntrySheet({ id }: { id: string }) {
  const { accts, entries } = useStore(ledger, s => s);
  const e = entries.find(x => x.id === id);
  const del = useArmed("Toque de novo para apagar", e?.tr ? "Apagar a transferência" : "Apagar este lançamento", () => { const gone = entries.filter(x => x.id === id || (e?.tr && x.tr === e.tr)); actions.deleteEntry(id); closeSheet(); toast("Lançamento apagado", () => actions.addEntries(...gone)); });
  if (!e) return null;
  const a = accts.find(x => x.id === e.acct);
  return (<>
    <SheetHead title={e.type === "rec" ? "Entrada" : "Saída"} />
    <div className="kv">
      <span>Descrição</span><b>{e.desc}</b>
      <span>Valor</span><b className={e.type === "rec" ? "ok" : ""}>{e.type === "rec" ? "+" : "−"}{R(e.cents)}</b>
      <span>Data</span><b>{fmtD(e.date)}{isFut(e) ? " (agendado)" : ""}</b>
      <span>Conta</span><b>{a ? a.name : "—"}</b>
      {e.cat ? <><span>Categoria</span><b>{e.cat}</b></> : null}
    </div>
    {e.items && e.items.length > 0 && <>
      <div className="ln sub">Itens da fatura · {e.items.length}</div>
      {e.items.map((y, i) => <div className="ln" key={i}><span>{fmtDM(y.date)}</span><span className="dsc">{y.desc}</span><b className={y.cents < 0 ? "cr" : ""}>{signR(y.cents)}</b></div>)}
    </>}
    {!e.tr && <button type="button" className="btn primary wide" id="exEdit" onClick={() => openSheet({ kind: "lanc", editId: e.id })}>Editar</button>}
    {!e.tr && !e.imp && <button type="button" className="btn wide" id="exDup" onClick={() => openSheet({ kind: "lanc", copyId: e.id })}>Duplicar</button>}
    <button type="button" className="btn wide" id="exDel" onClick={del.onClick}>{del.text}</button>
  </>);
}
