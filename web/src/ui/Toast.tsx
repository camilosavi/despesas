import { useEffect } from "react";
import { useStore } from "../lib/createStore";
import { hideToast, ui } from "./uiStore";

export function Toast() {
  const t = useStore(ui, s => s.toast);
  useEffect(() => { if (!t) return; const id = setTimeout(hideToast, 3200); return () => clearTimeout(id); }, [t]);
  return t ? <div className="toast" role="status">{t.text}</div> : null;
}
