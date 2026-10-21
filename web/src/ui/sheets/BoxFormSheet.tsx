import { useState } from "react";
import { BOX_KINDS } from "../../lib/boxes";
import { brl, digits, uid } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import { useStore } from "../../lib/createStore";
import type { Currency, SaveBox } from "../../lib/types";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, toast } from "../uiStore";

export function BoxFormSheet({ editId }: { editId?: string }) {
  const existing = useStore(ledger, s => (editId ? s.boxes.find(b => b.id === editId) : undefined));

  const [kind, setKind] = useState(existing?.kind || "viagem");
  const [name, setName] = useState(existing?.name || (BOX_KINDS.find(k => k.k === "viagem")?.n || ""));
  const [cur, setCur] = useState<Currency>(existing?.cur || "BRL");
  const [goal, setGoal] = useState(existing?.goal ? brl(existing.goal) : "");
  const [target, setTarget] = useState(existing?.target || "");

  const onSelectKind = (k: string, n: string) => {
    setKind(k);
    if (!existing) setName(n);
  };

  const onSave = () => {
    const finalName = name.trim();
    if (!finalName) { toast("Dê um nome à caixinha"); return; }

    const goalCents = digits(goal);
    const boxData: SaveBox = {
      id: existing?.id || uid(),
      name: finalName,
      kind,
      icon: BOX_KINDS.find(k => k.k === kind)?.i || "💰",
      cur,
      goal: goalCents > 0 ? goalCents : undefined,
      target: target.trim() || undefined,
      moves: existing?.moves || [],
    };

    if (existing) {
      actions.updateBox(existing.id, boxData);
      toast("Caixinha atualizada");
    } else {
      actions.addBox(boxData);
      toast("Caixinha criada");
    }
    closeSheet();
  };

  return (
    <>
      <SheetHead title={existing ? "Editar Caixinha" : "Nova Caixinha"} />

      <div className="field">
        <label className="lbl">Tipo de caixinha</label>
        <div className="box-kinds-grid">
          {BOX_KINDS.map(k => (
            <button
              key={k.k}
              type="button"
              className={`box-kind-btn ${kind === k.k ? "active" : ""}`}
              onClick={() => onSelectKind(k.k, k.n)}
            >
              <span className="box-kind-ico">{k.i}</span>
              <span className="box-kind-lbl">{k.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="lbl">Nome</label>
        <input
          type="text"
          value={name}
          maxLength={30}
          placeholder="Ex: Reserva, Viagem, Reforma..."
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="lbl">Moeda</label>
        <div className="seg">
          <button type="button" aria-pressed={cur === "BRL"} onClick={() => setCur("BRL")}>Real (R$)</button>
          <button type="button" aria-pressed={cur === "EUR"} onClick={() => setCur("EUR")}>Euro (€)</button>
          <button type="button" aria-pressed={cur === "USD"} onClick={() => setCur("USD")}>Dólar (US$)</button>
        </div>
      </div>

      <div className="field">
        <label className="lbl">Meta de economia (opcional)</label>
        <div className="amount-input-row">
          <span>{cur === "BRL" ? "R$" : cur === "EUR" ? "€" : "US$"}</span>
          <MoneyInput aria-label="Meta" value={goal} onChange={setGoal} />
        </div>
      </div>

      <div className="field">
        <label className="lbl">Mês-alvo da meta (opcional)</label>
        <input
          type="month"
          value={target}
          onChange={e => setTarget(e.target.value)}
        />
      </div>

      <button type="button" className="btn primary wide" onClick={onSave}>
        {existing ? "Salvar alterações" : "Criar caixinha"}
      </button>
    </>
  );
}
