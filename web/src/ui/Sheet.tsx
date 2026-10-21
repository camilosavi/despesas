import { useEffect, useRef } from "react";
import { useStore } from "../lib/createStore";
import { closeSheet, ui } from "./uiStore";
import { AddAccountSheet } from "./sheets/AddAccountSheet";
import { EditAccountSheet } from "./sheets/EditAccountSheet";
import { EntrySheet } from "./sheets/EntrySheet";
import { LancSheet } from "./sheets/LancSheet";
import { TranSheet } from "./sheets/TranSheet";
import { MeSheet } from "./sheets/MeSheet";
import { ResultsSheet } from "./sheets/ResultsSheet";
import { DiagSheet } from "./sheets/DiagSheet";
import { PaySheet } from "./sheets/PaySheet";
import { BoxSheet } from "./sheets/BoxSheet";
import { BoxFormSheet } from "./sheets/BoxFormSheet";

export function SheetHead({ title }: { title: string }) {
  return (<>
    <div className="grip" />
    <h3><span>{title}</span><button type="button" className="x" onClick={closeSheet} aria-label="Fechar">✕</button></h3>
  </>);
}

/** janela que sobe de baixo (no computador, no meio da tela) */
export function SheetHost() {
  const sheet = useStore(ui, s => s.sheet);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [sheet]);
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, [sheet]);
  if (!sheet) return null;
  return (<>
    <div className="scrim" onClick={closeSheet} />
    <div className="sheet" id="sheet" ref={ref} role="dialog" aria-modal="true">
      {sheet.kind === "add" && <AddAccountSheet />}
      {sheet.kind === "edit" && <EditAccountSheet />}
      {sheet.kind === "entry" && <EntrySheet id={sheet.id} />}
      {sheet.kind === "lanc" && <LancSheet editId={sheet.editId} />}
      {sheet.kind === "tran" && <TranSheet />}
      {sheet.kind === "me" && <MeSheet />}
      {sheet.kind === "results" && <ResultsSheet />}
      {sheet.kind === "diag" && <DiagSheet idx={sheet.idx} />}
      {sheet.kind === "pay" && <PaySheet id={sheet.id} ym={sheet.ym} />}
      {sheet.kind === "box" && <BoxSheet id={sheet.id} />}
      {sheet.kind === "boxForm" && <BoxFormSheet editId={sheet.editId} />}
    </div>
  </>);
}
