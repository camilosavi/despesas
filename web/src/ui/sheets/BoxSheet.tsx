import { useEffect, useState } from "react";
import { boxBal, boxBrl, boxByBank, boxIcon, boxProgress, fetchLiveRates, fmtMoneyCur } from "../../lib/boxes";
import { brl, digits, today, uid } from "../../lib/format";
import { FX_PICK } from "../../lib/banks";
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
  const [inReal, setInReal] = useState(false); // caixinha de euro/dólar: guardar direto em reais, sem converter
  const [rate, setRate] = useState("");
  const [brlV, setBrlV] = useState("");
  // valor na moeda, cotação e valor em R$: ao preencher 2 dos 3, o terceiro é calculado (o mais antigo de ordem de edição)
  const [order, setOrder] = useState<("val" | "rate" | "brl")[]>([]);
  const [note, setNote] = useState("");
  const allBoxes = useStore(ledger, s => s.boxes), accts = useStore(ledger, s => s.accts);
  const lastBank = (box?.moves || []).find(m => m.bank)?.bank || ""; // movimentos novos entram no começo da lista
  const [bank, setBank] = useState(lastBank);
  const [otherBank, setOtherBank] = useState(false);

  useEffect(() => {
    if (box && (box.cur === "EUR" || box.cur === "USD")) {
      fetchLiveRates().then(r => { setRate(String(box.cur === "EUR" ? r.EUR : r.USD).replace(".", ",")); setOrder(o => (o.length ? o : ["rate"])); });
    }
  }, [box?.cur]);

  if (!box) return null;

  const bal = boxBal(box);
  const prog = boxProgress(box);
  const cents = digits(val);
  const isFx = box.cur === "EUR" || box.cur === "USD";
  const fxMode = isFx && !inReal; // cotação e conversão só quando o valor é na moeda da caixinha
  const inBrl = boxBrl(box);
  const used = allBoxes.flatMap(b => (b.moves || []).map(m => m.bank || ""));
  const banks = [...new Set([...accts.map(a => a.name), ...(isFx ? FX_PICK : []), ...used].filter(Boolean))];
  const byBank = boxByBank(box);

  const rateN = parseFloat(rate.replace(",", ".")) || 0;
  const brlCents = digits(brlV);
  /** muda um dos 3 campos e recalcula o que ficou de fora dos 2 últimos editados */
  const edit = (f: "val" | "rate" | "brl", text: string) => {
    const v = { val: f === "val" ? text : val, rate: f === "rate" ? text : rate, brl: f === "brl" ? text : brlV };
    const num = { val: digits(v.val), rate: parseFloat(v.rate.replace(",", ".")) || 0, brl: digits(v.brl) };
    let ord = order.filter(x => x !== f);
    if (num[f]) ord = [...ord, f];
    ord = ord.filter(x => num[x]).slice(-2);
    if (ord.length === 2) {
      const d = (["val", "rate", "brl"] as const).find(x => !ord.includes(x))!;
      if (d === "brl") v.brl = num.val && num.rate ? brl(Math.round(num.val * num.rate)) : "";
      else if (d === "rate") v.rate = num.val && num.brl ? (num.brl / num.val).toFixed(4).replace(".", ",") : "";
      else v.val = num.rate && num.brl ? brl(Math.round(num.brl / num.rate)) : "";
    }
    if (ord.length < 2) for (const x of ["val", "rate", "brl"] as const) if (!ord.includes(x)) v[x] = x === f ? text : ""; // sem 2 campos, nada é calculado: o resto fica vazio
    setVal(v.val); setRate(v.rate); setBrlV(v.brl); setOrder(ord);
  };

  const pickReal = (r: boolean) => { setInReal(r); setVal(""); setBrlV(""); setOrder(rateN ? ["rate"] : []); };
  const onConfirm = () => {
    if (!cents) { toast("Digite um valor"); return; }
    const sign = mode === "out" ? -1 : 1;
    const finalCents = sign * cents;
    const finalRate = fxMode && rateN > 0 ? rateN : undefined;
    const brlVal = fxMode ? (brlCents || (finalRate ? Math.round(cents * finalRate) : undefined)) : undefined;

    actions.addBoxMove(box.id, {
      id: uid(),
      date: date || today(),
      cents: finalCents,
      cur: inReal ? "BRL" : box.cur,
      rate: finalRate,
      brl: brlVal,
      note: note.trim() || undefined,
      bank: bank.trim() || undefined,
    });

    setVal(""); setBrlV(""); setNote(""); setOrder(rateN ? ["rate"] : []); // a cotação fica para o próximo lançamento
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
          {byBank.length > 0 && <small className="boxmv-note">Está em: {byBank.map(v => `${v.bank} ${fmtMoneyCur(v.cents, v.cur)}`).join(" · ")}</small>}
          {inBrl !== 0 && <small className="boxmv-note">+ {fmtMoneyCur(inBrl, "BRL")} guardados em reais</small>}
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

        {isFx && (
          <div className="seg">
            <button type="button" aria-pressed={!inReal} onClick={() => pickReal(false)}>{box.cur === "EUR" ? "Em euro (€)" : "Em dólar (US$)"}</button>
            <button type="button" aria-pressed={inReal} onClick={() => pickReal(true)}>Em reais (R$)</button>
          </div>
        )}

        <div className="bigamt">
          <span>{box.cur === "BRL" || inReal ? "R$" : box.cur === "EUR" ? "€" : "US$"}</span>
          <MoneyInput aria-label="Valor" value={val} onChange={v => (inReal ? setVal(v) : edit("val", v))} />
        </div>

        {fxMode && (
          <div className="fx-rate-row">
            <label className="lbl">Preencha 2 dos 3: o terceiro é calculado</label>
            <div className="fx-calc-row">
              <label className="fx-f">Cotação (R$ por {box.cur === "EUR" ? "€" : "US$"})
                <input type="text" inputMode="decimal" className="fld" aria-label="Cotação" value={rate} placeholder="6,20" onChange={e => edit("rate", e.target.value.replace(/[^\d,.]/g, ""))} />
              </label>
              <label className="fx-f">Valor em R$
                <MoneyInput aria-label="Valor em reais" value={brlV} onChange={v => edit("brl", v)} />
              </label>
            </div>
          </div>
        )}

        <div className="field">
          <label className="lbl">{mode === "in" ? "Em que banco fica" : "De que banco sai"}</label>
          <div className="cards" id="bxBanks">
            {banks.map(n => <button type="button" key={n} className="cpill txt" aria-pressed={!otherBank && n === bank} onClick={() => { setOtherBank(false); setBank(n === bank ? "" : n); }}>{n}</button>)}
            <button type="button" className="cpill txt" aria-pressed={otherBank} onClick={() => { setOtherBank(true); setBank(""); }}>Outro…</button>
          </div>
          {otherBank && <input type="text" aria-label="Banco" placeholder="Nome do banco" maxLength={30} value={bank} onChange={e => setBank(e.target.value)} />}
        </div>

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
                <span>{m.date} · {m.cents > 0 ? "Guardou" : "Resgatou"}{m.bank ? ` · ${m.bank}` : ""}</span>
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
