import { catsOf } from "../lib/categories";
import { useStore } from "../lib/createStore";
import { ledger } from "../lib/store";

/** categoria de um item da fatura (lista de saídas, com as que ele criou) */
export function CatSelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const entries = useStore(ledger, s => s.entries);
  return (
    <select className="icat" aria-label="Categoria" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Sem categoria</option>
      {catsOf("desp", entries, value).map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
