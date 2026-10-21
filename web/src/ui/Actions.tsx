import { openSheet } from "./uiStore";
import { pickPdf } from "./PdfSection";

const Svg = ({ children }: { children: React.ReactNode }) => <svg viewBox="0 0 24 24">{children}</svg>;

/** linha de ações redonda sob o cartão (padrão de app de banco) */
export function Actions() {
  return (
    <div id="acts">
      <div className="acts">
        <button type="button" data-act="lanc" onClick={() => openSheet({ kind: "lanc" })}><i><Svg><path d="M12 5v14M5 12h14" /></Svg></i><span>Lançar</span></button>
        <button type="button" data-act="tran" onClick={() => openSheet({ kind: "tran" })}><i><Svg><path d="M4 8h14l-3-3M20 16H6l3 3" /></Svg></i><span>Transferir</span></button>
        <button type="button" data-act="sum" onClick={() => openSheet({ kind: "sum" })}><i><Svg><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg></i><span>Resumo</span></button>
        <button type="button" data-act="pdf" onClick={pickPdf}><i><Svg><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></Svg></i><span>Ler PDF</span></button>
      </div>
    </div>
  );
}
