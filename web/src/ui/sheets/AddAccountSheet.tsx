import { useEffect, useRef, useState } from "react";
import { useStore } from "../../lib/createStore";
import { BANK_PICK, BEN_PICK, CARD_PALETTE, FX_PICK, bankOf } from "../../lib/banks";
import { digits, moneyMask, uid } from "../../lib/format";
import { actions, ledger } from "../../lib/store";
import { BankBadge } from "../Badge";
import { MoneyInput } from "../MoneyInput";
import { SheetHead } from "../Sheet";
import { closeSheet, openAccount, toast } from "../uiStore";

/** nova conta: grade com os bancos (nome e cor já vêm), contas de câmbio, vale-refeição e "Outro"; saldo de hoje */
export function AddAccountSheet() {
  const accts = useStore(ledger, s => s.accts);
  const have = new Set(accts.map(c => c.name.toLowerCase()));
  const [picked, setPicked] = useState<string | null>(null);
  const [color, setColor] = useState(() => CARD_PALETTE.find(c => !accts.some(a => a.color === c)) || CARD_PALETTE[0]);
  const [name, setName] = useState(""), [bal, setBal] = useState(""), [err, setErr] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (picked === "") nameRef.current?.focus(); }, [picked]);

  const pick = (n: string) => {
    setPicked(n);
    if (n) { setName(n); const k = bankOf(n); if (k) setColor(k.c); } else setName("");
  };
  const btn = (n: string) => (
    <button type="button" key={n} aria-pressed={picked === n} disabled={have.has(n.toLowerCase())} aria-label={have.has(n.toLowerCase()) ? `${n} (já existe)` : undefined} onClick={() => pick(n)}>
      <BankBadge name={n} /><span>{n}</span>
    </button>
  );
  const pal = CARD_PALETTE.includes(color) ? CARD_PALETTE : [color, ...CARD_PALETTE.slice(0, -1)];

  function save() {
    const nm = name.trim().replace(/\s+/g, " ");
    if (picked === null) { setErr("Escolha o banco ou toque em Outro."); return; }
    if (!nm) { setErr("Dê um nome à conta."); return; }
    if (nm.toLowerCase() === "outro" || accts.some(c => c.name.toLowerCase() === nm.toLowerCase())) { setErr("Já existe uma conta com esse nome."); return; }
    const a = { id: uid(), name: nm, color, start: digits(bal) };
    actions.addAccount(a); closeSheet(); openAccount(a.id); toast("Conta " + nm + " criada");
  }
  return (<>
    <SheetHead title="Nova conta" />
    <div className="field"><span className="lbl">Banco ou loja</span>
      <div className="bpick">
        {BANK_PICK.map(btn)}
        <span className="bsub">Contas de câmbio</span>{FX_PICK.map(btn)}
        <span className="bsub">Vale-refeição e alimentação</span>{BEN_PICK.map(btn)}
        <button type="button" aria-pressed={picked === ""} onClick={() => pick("")}><span className="fi" style={{ background: "var(--chip)", color: "var(--ink)" }}>+</span><span>Outro</span></button>
      </div>
    </div>
    <div className="field" hidden={picked !== ""}><label htmlFor="cdName">Nome da conta</label><input type="text" id="cdName" ref={nameRef} placeholder="Ex.: Nubank, C6, Itaú" maxLength={20} value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="field"><label htmlFor="cdBal">Saldo agora (R$)</label><MoneyInput id="cdBal" value={bal} onChange={v => setBal(moneyMask(v))} /></div>
    <div className="field"><span className="lbl">Cor</span>
      <div className="swatches">{pal.map(c => <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={`Cor ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} />)}</div>
    </div>
    <p className="err" id="cdErr">{err}</p>
    <button type="button" className="btn primary wide" id="cdSave" onClick={save}>Criar conta</button>
  </>);
}
