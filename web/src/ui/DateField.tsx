import { today, ymd } from "../lib/format";

/** campo de data com atalhos Hoje e Ontem */
export function DateField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field"><label htmlFor={id}>Data</label>
      <input type="date" id={id} value={value} onChange={e => onChange(e.target.value)} />
      <div className="cards" style={{ marginTop: 8 }}>
        {([["Hoje", today()], ["Ontem", ymd(-1)]] as const).map(([l, d]) => <button type="button" key={l} className="cpill txt" aria-pressed={value === d} onClick={() => onChange(d)}>{l}</button>)}
      </div>
    </div>
  );
}
