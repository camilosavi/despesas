import { useEffect, useState } from "react";
import { boxBal, boxIcon, boxProgress, fetchLiveRates, fmtMoneyCur } from "../../lib/boxes";
import { digits, today, uid } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import { useStore } from "../../lib/createStore";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, openSheet, toast } from "../uiStore";

export function BoxSheet({ id }: { id: string }) {
  const box = useStore(ledger, s => s.boxes.find(b => b.id === id));
  const [mode, setMode] = useState<"in" | "out">("in");
  const [val, setVal] = useState("");
  const [date, setDate] = useState(today());
  const [rate, setRate] = useState<number | "">("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (box && (box.cur === "EUR" || box.cur === "USD")) {
      fetchLiveRates().then(r => setRate(box.cur === "EUR" ? r.EUR : r.USD));
    }
  }, [box?.cur]);

  if (!box) return null;

  const bal = boxBal(box);
  const prog = boxProgress(box);
  const cents = digits(val);
  const isFx = box.cur === "EUR" || box.cur === "USD";

  const onConfirm = () => {
    if (!cents) { toast("Digite um valor"); return; }
    const sign = mode === "out" ? -1 : 1;
    const finalCents = sign * cents;
    const finalRate = typeof rate === "number" && rate > 0 ? rate : undefined;
    const brlVal = finalRate ? Math.round(cents * finalRate) : undefined;

    actions.addBoxMove(box.id, {
      id: uid(),
      date: date || today(),
      cents: finalCents,
      cur: box.cur,
      rate: finalRate,
      brl: brlVal,
      note: note.trim() || undefined,
    });

    setVal("");
    setNote("");
    toast(mode === "in" ? "Guardado com sucesso" : "Resgatado com sucesso");
  };

  const onDeleteBox = () => {
    if (confirm(`Excluir a caixinha "${box.name}"?`)) {
      actions.deleteBox(box.id);
      closeSheet();
      toast("Caixinha excluída");
    }
  };

  return (
    <>
      <SheetHead title={box.name} />
      <div className="boxhero">
        <span className="boxico-lg">{boxIcon(box)}</span>
        <div>
          <span className="boxcur-lbl">Saldo guardado ({box.cur})</span>
          <b className={`boxcur-val ${bal < 0 ? "bad" : ""}`}>{fmtMoneyCur(bal, box.cur)}</b>
          {prog && (
            <div className="boxprog-box">
              <div className="boxprog-bar"><i style={{ width: `${prog.pct}%` }} /></div>
              <small>{prog.done ? "Meta batida ✓" : `${prog.pct}% de ${fmtMoneyCur(box.goal || 0, box.cur)} · falta ${fmtMoneyCur(prog.left, box.cur)}`}</small>
            </div>
          )}
        </div>
      </div>

      <div className="boxmove-form">
        <div className="seg">
          <button type="button" aria-pressed={mode === "in"} onClick={() => setMode("in")}>+ Guardar</button>
          <button type="button" aria-pressed={mode === "out"} onClick={() => setMode("out")}>− Resgatar</button>
        </div>

        <div className="bigamt">
          <span>{box.cur === "BRL" ? "R$" : box.cur === "EUR" ? "€" : "US$"}</span>
          <MoneyInput aria-label="Valor" value={val} onChange={setVal} />
        </div>

        {isFx && (
          <div className="fx-rate-row">
            <label className="lbl">Cotação usada (R$ por 1 {box.cur === "EUR" ? "€" : "US$"}):</label>
            <div className="fx-calc-row">
              <input
                type="number"
                step="0.01"
                className="fld"
                value={rate}
                onChange={e => setRate(parseFloat(e.target.value) || "")}
                placeholder="Ex: 6.20"
              />
              {cents > 0 && typeof rate === "number" && rate > 0 && (
                <span className="fx-hint">≈ R$ {((cents * rate) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              )}
            </div>
          </div>
        )}

        <div className="field">
          <label className="lbl">Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label className="lbl">Anotação (opcional)</label>
          <input type="text" placeholder="Ex: Sobra do mês, Câmbio Nomad..." value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <button type="button" className="btn primary wide" onClick={onConfirm}>
          {mode === "in" ? "Confirmar depósito" : "Confirmar resgate"}
        </button>
      </div>

      {box.moves && box.moves.length > 0 && (
        <div className="boxmoves-list">
          <div className="dayh">Histórico de movimentações</div>
          {box.moves.map(m => (
            <div key={m.id} className="boxmv-item">
              <div>
                <span>{m.date} · {m.cents > 0 ? "Guardou" : "Resgatou"}</span>
                {m.note && <small className="boxmv-note">{m.note}</small>}
                {m.rate && <small className="boxmv-note">Cotação R$ {m.rate.toFixed(2)}</small>}
              </div>
              <div className="boxmv-right">
                <b className={m.cents > 0 ? "cr" : "bad"}>{fmtMoneyCur(m.cents, m.cur || box.cur)}</b>
                <button
                  type="button"
                  className="x sm"
                  onClick={() => actions.deleteBoxMove(box.id, m.id)}
                  title="Excluir movimentação"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="box-footer-btns">
        <button type="button" className="btn soft" onClick={() => openSheet({ kind: "boxForm", editId: box.id })}>
          Editar caixinha / meta
        </button>
        <button type="button" className="btn soft bad-txt" onClick={onDeleteBox}>
          Excluir caixinha
        </button>
      </div>
    </>
  );
}
