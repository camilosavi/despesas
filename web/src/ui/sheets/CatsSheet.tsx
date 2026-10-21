import { useState } from "react";
import { CAT_IN, CAT_OUT, catsOf, isFixedCat } from "../../lib/categories";
import { CAT_PALETTE, catColor, catPrefs, isHidden, moveCatColor, setCatColor, toggleHide } from "../../lib/catcolor";
import { useStore } from "../../lib/createStore";
import { actions, ledger } from "../../lib/store";
import { Dot } from "../Dot";
import { SheetHead } from "../Sheet";
import { toast } from "../uiStore";

/** categorias: cor de cada uma; padrão pode esconder (some das listas), própria pode renomear ou apagar */
export function CatsSheet() {
  const entries = useStore(ledger, s => s.entries);
  useStore(catPrefs, s => s);
  const [type, setType] = useState<"desp" | "rec">("desp"), [sel, setSel] = useState(""), [name, setName] = useState("");
  const fixed = type === "rec" ? CAT_IN : CAT_OUT;
  const all = [...fixed.filter(c => c !== "Outros"), ...catsOf(type, entries).filter(c => !fixed.includes(c)), "Outros"];
  const rename = (from: string, to: string) => { actions.renameCat(from, to); moveCatColor(from, to.trim()); setSel(""); toast(to.trim() ? "Categoria renomeada" : "Categoria apagada (lançamentos ficam sem categoria)"); };
  return (<>
    <SheetHead title="Categorias" />
    <div className="seg"><button type="button" aria-pressed={type === "desp"} onClick={() => { setType("desp"); setSel(""); }}>Saídas</button><button type="button" aria-pressed={type === "rec"} onClick={() => { setType("rec"); setSel(""); }}>Entradas</button></div>
    {all.map(c => (
      <div key={c} className="catrow">
        <button type="button" className="catname" data-cat={c} aria-expanded={sel === c} onClick={() => { setSel(sel === c ? "" : c); setName(c); }}>
          <Dot c={c} /><span style={isHidden(c) ? { opacity: .5, textDecoration: "line-through" } : undefined}>{c}</span>
        </button>
        {sel === c && <div className="catedit">
          <div className="swatches">{CAT_PALETTE.map(col => <button type="button" key={col} aria-label={"Cor " + col} aria-pressed={catColor(c) === col} style={{ background: col }} onClick={() => setCatColor(c, col)} />)}</div>
          {isFixedCat(c) && c !== "Outros" && <button type="button" className="btn soft wide" onClick={() => toggleHide(c)}>{isHidden(c) ? "Mostrar nas listas" : "Esconder das listas"}</button>}
          {!isFixedCat(c) && <div className="smedit">
            <input type="text" aria-label="Nome da categoria" maxLength={20} value={name} onChange={e => setName(e.target.value)} />
            <button type="button" className="btn soft" disabled={!name.trim() || name.trim() === c} onClick={() => rename(c, name)}>Renomear</button>
            <button type="button" className="btn soft bad-txt" onClick={() => rename(c, "")}>Apagar</button>
          </div>}
        </div>}
      </div>
    ))}
    <p className="hint">Cores e categorias escondidas valem só neste aparelho.</p>
  </>);
}
