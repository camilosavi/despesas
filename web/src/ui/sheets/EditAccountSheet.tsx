import { useState } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../../lib/createStore";
import { CARD_PALETTE, cardLabel } from "../../lib/banks";
import { brl, digits, moneyMask, textOn } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import { Badge } from "../Badge";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, toast, ui } from "../uiStore";

/** personalizar o cartão da conta: nome, letra, cor e saldo inicial, com prévia do cartão */
export function EditAccountSheet() {
  const accts = useStore(ledger, s => s.accts), openId = useStore(ui, s => s.openId);
  const a = accts.find(x => x.id === openId);
  const [name, setName] = useState(a?.name ?? ""), [label, setLabel] = useState(a?.label ?? ""), [color, setColor] = useState(a?.color ?? CARD_PALETTE[0]);
  const [bal, setBal] = useState(a?.start ? brl(a.start) : ""), [err, setErr] = useState("");
  const [card, setCard] = useState(a?.kind === "cartao");
  if (!a) return null;
  const pal = CARD_PALETTE.includes(color) ? CARD_PALETTE : [color, ...CARD_PALETTE.slice(0, -1)];

  function save() {
    const nm = name.trim().replace(/\s+/g, " ");
    if (!nm) { setErr("Dê um nome à conta."); return; }
    if (accts.some(c => c.id !== a!.id && c.name.toLowerCase() === nm.toLowerCase())) { setErr("Já existe uma conta com esse nome."); return; }
    actions.updateAccount(a!.id, { name: nm, label, color, start: card ? 0 : digits(bal), kind: card ? "cartao" : undefined }); closeSheet(); toast("Cartão atualizado");
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
    <div className="field" hidden={card}><label htmlFor="edBal">Saldo inicial (R$)</label><MoneyInput id="edBal" value={bal} onChange={v => setBal(moneyMask(v))} /></div>
    <div className="field"><span className="lbl">Cor</span>
      <div className="swatches" id="edSw">
        {pal.map(c => <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={`Cor ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} />)}
        <label className="swatch custom" aria-label="Outra cor"><input type="color" id="edCol" value={color.length === 7 ? color : "#6B7A75"} onChange={e => setColor(e.target.value)} /></label>
      </div>
    </div>
    <p className="err" id="edErr">{err}</p>
    <button type="button" className="btn primary wide" id="edSave" onClick={save}>Salvar</button>
  </>);
}
