import { useRef } from "react";
import type { ChangeEvent } from "react";
import { useStore } from "../lib/createStore";
import { readOne } from "../lib/pdf/read";
import type { ReadResult } from "../lib/pdf/read";
import { hideToast, openSheet, pdfResults, toast, ui } from "./uiStore";

const READS: [string, string][] = [
  ["Faturas de cartão", "Inter, Pan, PicPay e Renner/Realize"],
  ["Contas e boletos", "Claro, Vivo, TIM, Oi, Enel, CPFL, Elektro, Sabesp e Comgás"],
  ["Holerite", "demonstrativo de pagamento (salário, adiantamento, 13º, férias) com o extrato do convênio"],
];
/** abre o seletor de PDF (botão "Importar PDF" sob o cartão) */
export const pickPdf = () => document.getElementById("pdfIn")?.click();

export function PdfSection() {
  const openId = useStore(ui, s => s.openId);
  const inp = useRef<HTMLInputElement>(null);
  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files || [])]; e.target.value = ""; if (!files.length) return;
    toast(files.length > 1 ? `Lendo ${files.length} PDFs…` : "Lendo o PDF…");
    const items: ReadResult[] = []; pdfResults.set({ items });
    for (const f of files) items.push(await readOne(f));
    pdfResults.set({ items: [...items] });
    hideToast(); openSheet({ kind: "results" });
  }
  return (
    <section className="sec" id="secPdf" hidden={!!openId}>
      <h2>Ler um PDF</h2>
      <label className="btn primary wide" id="pdfBtn"><span>Escolher PDF (holerite, fatura ou conta)</span><input type="file" id="pdfIn" ref={inp} accept="application/pdf,.pdf" multiple hidden onChange={e => void onFiles(e)} /></label>
      <div className="reads" id="reads">
        {READS.map(([a, b]) => <div key={a}><b>{a}</b><small>{b}</small></div>)}
        <small style={{ color: "var(--muted)" }}>Use sempre o PDF original do banco, sem converter, comprimir ou escanear. O PDF é lido no próprio aparelho.</small>
      </div>
    </section>
  );
}
