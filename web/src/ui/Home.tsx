import { useStore } from "../lib/createStore";
import { accBal } from "../lib/ledger";
import { signR } from "../lib/format";
import { ledger } from "../lib/store";
import { Badge } from "./Badge";
import { openAccount, openSheet } from "./uiStore";

/** lista de contas (cada uma abre com o cartão na cor dela e o extrato) */
export function Home() {
  const { accts, entries } = useStore(ledger, s => s);
  return (
    <section className="sec ctas">
      <h2>Contas</h2>
      {accts.map(a => {
        const b = accBal(a, entries);
        return (
          <button type="button" key={a.id} className="acrow" data-open={a.id} onClick={() => openAccount(a.id)}>
            <Badge name={a.name} color={a.color} label={a.label} /><span className="nm">{a.name}</span><b className={b < 0 ? "bad" : ""}>{signR(b)}</b>
          </button>
        );
      })}
      <button type="button" className="acrow add" id="acctNew" onClick={() => openSheet({ kind: "add" })}><span className="fi">+</span><span className="nm">Adicionar conta</span></button>
    </section>
  );
}
