import { useRef } from "react";
import { useStore } from "../../lib/createStore";
import { diagText } from "../../lib/pdf/diag";
import { SheetHead } from "../Sheet";
import { pdfResults, toast } from "../uiStore";

/** diagnóstico do PDF (com nomes mascarados) para colar no Claude e ajustar o leitor */
export function DiagSheet({ idx }: { idx: number }) {
  const x = useStore(pdfResults, s => s.items[idx]);
  const ta = useRef<HTMLTextAreaElement>(null);
  if (!x || !x.pdf) return null;
  const text = diagText(x.pdf);
  function copy() {
    const el = ta.current!;
    (navigator.clipboard ? navigator.clipboard.writeText(el.value) : Promise.reject()).then(() => toast("Copiado. Cole no Claude."))
      .catch(() => { el.focus(); el.setSelectionRange(0, el.value.length); let ok = false; try { ok = document.execCommand("copy"); } catch { /* sem cópia */ } toast(ok ? "Copiado. Cole no Claude." : "Selecione o texto e copie."); });
  }
  return (<>
    <SheetHead title="Diagnóstico" />
    <p className="hint" style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: ".88rem" }}>Copie e cole no Claude para ajustar o leitor. Nomes viram “Xxxx” e números longos viram “#”; datas e valores ficam.</p>
    <textarea id="diagTxt" ref={ta} className="diagtxt" readOnly rows={12} defaultValue={text} />
    <button type="button" className="btn primary wide" id="diagCopy" style={{ marginTop: 10 }} onClick={copy}>Copiar diagnóstico</button>
  </>);
}
