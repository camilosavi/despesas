import { useState } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../../lib/createStore";
import { CARD_PALETTE, cardLabel } from "../../lib/banks";
import { bankOf } from "../../lib/banks";
import { notCardBuy } from "../../lib/dedupe";
import { brl, digits, moneyMask, textOn } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import { Badge } from "../Badge";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { useArmed } from "../hooks";
import { backHome, closeSheet, openAccount, toast, ui } from "../uiStore";

/** personalizar o cartão da conta: nome, letra, cor e saldo inicial, com prévia do cartão */
export function EditAccountSheet() {
  const accts = useStore(ledger, s => s.accts), openId = useStore(ui, s => s.openId);
  const a = accts.find(x => x.id === openId);
  const [name, setName] = useState(a?.name ?? ""), [label, setLabel] = useState(a?.label ?? ""), [color, setColor] = useState(a?.color ?? CARD_PALETTE[0]);
  const [bal, setBal] = useState(a?.start ? brl(a.start) : ""), [err, setErr] = useState("");
  const [card, setCard] = useState(a?.kind === "cartao"), [lim, setLim] = useState(a?.limit ? brl(a.limit) : ""), [closeD, setCloseD] = useState(a?.closeDay ? String(a.closeDay) : ""), [dueD, setDueD] = useState(a?.dueDay ? String(a.dueDay) : "");
  const [into, setInto] = useState("");
  const mates = accts.filter(x => a && x.id !== a.id && (x.kind === "cartao") === (a.kind === "cartao")), target = mates.find(x => x.id === into);
  const merge = useArmed("Toque de novo para juntar", target ? `Juntar em ${target.name}` : "Juntar", () => { if (!a || !target) return; actions.mergeAccount(a.id, target.id); closeSheet(); openAccount(target.id); toast(`Juntado em ${target.name} ✓`); });
  const entries = useStore(ledger, s => s.entries), banks = accts.filter(x => x.kind !== "cartao");
  const strayN = a?.kind === "cartao" ? entries.filter(e => e.acct === a.id && notCardBuy(e)).length : 0;
  const bk = a ? bankOf(a.name) : "", dest = banks.find(x => bk && bankOf(x.name) === bk) || banks[0];
  const stray = useArmed("Toque de novo para mover", dest ? `Mover ${strayN} para ${dest.name}` : "Crie uma conta antes", () => { if (!a || !dest) return; const n = actions.moveNonCard(a.id, dest.id); toast(`${n} movido${n > 1 ? "s" : ""} para ${dest.name} ✓`); });
  const del = useArmed("Toque de novo: apaga e leva os lançamentos", a?.kind === "cartao" ? "Apagar este cartão" : "Apagar esta conta", () => {
    if (!a) return; const acc = a, gone = ledger.get().entries.filter(e => e.acct === a.id), cardLbl = a.kind === "cartao" ? "Cartão apagado" : "Conta apagada";
    actions.deleteAccount(a.id); closeSheet(); backHome(); toast(cardLbl, () => { actions.addAccount(acc); actions.addEntries(...gone); });
  });
  if (!a) return null;
  const pal = CARD_PALETTE.includes(color) ? CARD_PALETTE : [color, ...CARD_PALETTE.slice(0, -1)];

  function save() {
    const nm = name.trim().replace(/\s+/g, " ");
    if (!nm) { setErr("Dê um nome à conta."); return; }
    if (accts.some(c => c.id !== a!.id && c.name.toLowerCase() === nm.toLowerCase())) { setErr("Já existe uma conta com esse nome."); return; }
    actions.updateAccount(a!.id, { name: nm, label, color, start: card ? 0 : digits(bal), kind: card ? "cartao" : undefined, limit: card ? digits(lim) || undefined : undefined, closeDay: card ? (+closeD >= 1 && +closeD <= 31 ? +closeD : undefined) : undefined, dueDay: card ? (+dueD >= 1 && +dueD <= 31 ? +dueD : undefined) : undefined }); closeSheet(); toast("Cartão atualizado");
  }
  return (<>
    <SheetHead title="Personalizar cartão" />
    <div className="mcard" id="mc" style={{ "--hc": color, "--tci": textOn(color) } as CSSProperties}>
      <span className="mchip" /><b id="mcn">{name || "Nome"}</b><span id="mcb"><Badge name={name} color={color} label={label} /></span>
    </div>
    <div className="field"><label htmlFor="edName">Nome</label><input type="text" id="edName" maxLength={20} value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="field"><label htmlFor="edLab">Letra no ícone (até 4)</label><input type="text" id="edLab" maxLength={4} placeholder={cardLabel(name)} value={label} onChange={e => setLabel(e.target.value.trim().slice(0, 4))} /></div>
    <div className="seg" id="edKind">
      <button type="button" aria-pressed={!card} onClick={() => setCard(false)}>Conta com saldo</button>
      <button type="button" aria-pressed={card} onClick={() => setCard(true)}>Só cartão</button>
    </div>
        <div className="field" hidden={!card}><label htmlFor="edLim">Limite do cartão (R$)</label><MoneyInput id="edLim" value={lim} onChange={v => setLim(moneyMask(v))} /></div>
    <div className="field" hidden={!card}><span className="lbl">Fatura (dia do mês)</span>
      <div className="fx-calc-row">
        <label className="fx-f">Fecha dia<input type="text" inputMode="numeric" className="fld" id="edClose" aria-label="Fecha dia" placeholder="25" maxLength={2} value={closeD} onChange={e => setCloseD(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="fx-f">Vence dia<input type="text" inputMode="numeric" className="fld" id="edDue" aria-label="Vence dia" placeholder="2" maxLength={2} value={dueD} onChange={e => setDueD(e.target.value.replace(/\D/g, ""))} /></label>
      </div>
    </div>
    <div className="field" hidden={card}><label htmlFor="edBal">Saldo inicial (R$)</label><MoneyInput id="edBal" value={bal} onChange={v => setBal(moneyMask(v))} /></div>
    <div className="field"><span className="lbl">Cor</span>
      <div className="swatches" id="edSw">
        {pal.map(c => <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={`Cor ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} />)}
        <label className="swatch custom" aria-label="Outra cor"><input type="color" id="edCol" value={color.length === 7 ? color : "#6B7A75"} onChange={e => setColor(e.target.value)} /></label>
      </div>
    </div>
    {mates.length > 0 && (
      <div className="field" id="edMerge"><label htmlFor="edInto">Juntar {card ? "este cartão" : "esta conta"} em outro(a)</label>
        <select id="edInto" value={into} onChange={e => setInto(e.target.value)}><option value="">Escolher…</option>{mates.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        {target && <><p className="hint">Os lançamentos de <b>{a.name}</b> vão para <b>{target.name}</b> e {a.name} some. Fica o nome, a cor e o saldo inicial de {target.name}.</p>
          <button type="button" className="btn wide" id="edMergeGo" onClick={merge.onClick}>{merge.text}</button></>}
      </div>
    )}
    {strayN > 0 && dest && (
      <div className="field" id="edStray"><label>Movimentos de conta dentro do cartão</label>
        <p className="hint">{strayN} lançamento{strayN > 1 ? "s" : ""} (Pix, transferência, entrada, pagamento de fatura) não {strayN > 1 ? "são" : "é"} compra de cartão. Mover para <b>{dest.name}</b>.</p>
        <button type="button" className="btn wide" id="edStrayGo" onClick={stray.onClick}>{stray.text}</button></div>
    )}
    <p className="err" id="edErr">{err}</p>
    <button type="button" className="btn primary wide" id="edSave" onClick={save}>Salvar</button>
    <button type="button" className="btn wide bad-txt" id="edDel" onClick={del.onClick}>{del.text}</button>
  </>);
}
