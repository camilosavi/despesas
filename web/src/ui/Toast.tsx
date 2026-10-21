import { useEffect } from "react";
import { useStore } from "../lib/createStore";
import { hideToast, ui } from "./uiStore";

export function Toast() {
  const t = useStore(ui, s => s.toast);
  useEffect(() => { if (!t) return; const id = setTimeout(hideToast, t.undo ? 6000 : 3200); return () => clearTimeout(id); }, [t]);
  return t ? <div className="toast" role="status"><span>{t.text}</span>{t.undo && <button type="button" onClick={() => { t.undo!(); hideToast(); }}>Desfazer</button>}</div> : null;
}
