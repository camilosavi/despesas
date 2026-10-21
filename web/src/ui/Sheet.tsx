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
import { SummarySheet } from "./sheets/SummarySheet";
import { CatsSheet } from "./sheets/CatsSheet";
import { ConferSheet } from "./sheets/ConferSheet";
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
  const open = !!sheet;
  useEffect(() => { // arrastar para baixo fecha (só celular; no computador a janela fica no meio da tela)
    const el = ref.current; if (!open || !el || matchMedia("(min-width:700px)").matches) return;
    let y0 = 0, dy = 0, t0 = 0, drag = false, top = false;
    const start = (e: TouchEvent) => { y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); drag = false; top = el.scrollTop <= 0; };
    const move = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      if (!drag) { if (!top || el.scrollTop > 0) return; if (y - y0 > 6) drag = true; else return; } // só arrasta se o toque já começou com o conteúdo no topo (rolar até o topo não fecha)
      dy = Math.max(0, y - y0); e.preventDefault();
      el.style.transition = "none"; el.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if (!drag) return; drag = false;
      el.style.transition = "transform .2s ease";
      if (dy > 110 || dy / Math.max(1, Date.now() - t0) > 0.6) { el.style.transform = "translateY(100%)"; setTimeout(closeSheet, 180); } else el.style.transform = "";
    };
    el.addEventListener("touchstart", start, { passive: true }); el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end); el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, [open]);
  if (!sheet) return null;
  return (<>
    <div className="scrim" onClick={closeSheet} />
    <div className="sheet" id="sheet" ref={ref} role="dialog" aria-modal="true">
      {sheet.kind === "add" && <AddAccountSheet />}
      {sheet.kind === "edit" && <EditAccountSheet />}
      {sheet.kind === "entry" && <EntrySheet id={sheet.id} />}
      {sheet.kind === "lanc" && <LancSheet editId={sheet.editId} copyId={sheet.copyId} />}
      {sheet.kind === "tran" && <TranSheet />}
      {sheet.kind === "me" && <MeSheet />}
      {sheet.kind === "results" && <ResultsSheet />}
      {sheet.kind === "diag" && <DiagSheet idx={sheet.idx} />}
      {sheet.kind === "sum" && <SummarySheet />}
      {sheet.kind === "cats" && <CatsSheet />}
      {sheet.kind === "conf" && <ConferSheet id={sheet.id} />}
      {sheet.kind === "pay" && <PaySheet id={sheet.id} ym={sheet.ym} />}
      {sheet.kind === "box" && <BoxSheet id={sheet.id} />}
      {sheet.kind === "boxForm" && <BoxFormSheet editId={sheet.editId} />}
    </div>
  </>);
}
