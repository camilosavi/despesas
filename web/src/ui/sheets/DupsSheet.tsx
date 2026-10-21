import { useState } from "react";
import { useStore } from "../../lib/createStore";
import { findDupes, pairKey, pickKeep } from "../../lib/dedupe";
import { R } from "../../lib/format";
import { lsJson, lsSet } from "../../lib/storage";
import { actions, ledger } from "../../lib/store";
import { SheetHead } from "../Sheet";
import { closeSheet, toast } from "../uiStore";

const KEY = "despesas.zero.dupOk";
export const dupIgnored = () => new Set<string>(lsJson<string[]>(KEY, []));

/** lançamentos que parecem o mesmo pagamento: juntar em um só, ou dizer que são diferentes */
export function DupsSheet() {
  const { entries, accts } = useStore(ledger, s => s), [ign, setIgn] = useState(dupIgnored);
  const list = findDupes(entries, ign), name = (id: string) => accts.find(a => a.id === id)?.name || "—";
  const src = (imp?: string) => (!imp ? "à mão" : imp.includes("of-") ? "banco" : "PDF");
  function join(a: typeof entries[0], b: typeof entries[0]) { const [k, d] = pickKeep(a, b); actions.mergeEntries(k.id, d.id); toast("Juntados ✓"); }
  function diff(a: typeof entries[0], b: typeof entries[0]) { const n = new Set(ign); n.add(pairKey(a, b)); lsSet(KEY, JSON.stringify([...n])); setIgn(n); }
  function all() { for (const [a, b] of list) { const cur = ledger.get().entries; if (cur.some(e => e.id === a.id) && cur.some(e => e.id === b.id)) join(a, b); } closeSheet(); }
  return (<>
    <SheetHead title="Possíveis duplicados" />
    {!list.length && <p className="hint">Nenhum.</p>}
    {list.map(([a, b]) => (
      <div className="hl" key={pairKey(a, b)} data-dup>
        {[a, b].map(e => <p key={e.id} style={{ margin: "0 0 4px" }}><b>{e.desc}</b> · {R(e.cents)}<br /><small>{name(e.acct)} · {e.date.slice(8) + "/" + e.date.slice(5, 7)} · {src(e.imp)}</small></p>)}
        <div style={{ display: "flex", gap: 8 }}><button type="button" className="btn primary" data-join onClick={() => join(a, b)}>Juntar</button><button type="button" className="btn soft" onClick={() => diff(a, b)}>São diferentes</button></div>
      </div>
    ))}
    {list.length > 1 && <button type="button" className="btn wide" onClick={all}>Juntar todos ({list.length})</button>}
  </>);
}
