// Estado da interface: conta aberta, janela aberta, aviso (toast) e o resultado da leitura de PDFs.
import { createStore } from "../lib/createStore";
import type { ReadResult } from "../lib/pdf/read";

export type SheetState =
  | { kind: "add" } | { kind: "edit" } | { kind: "entry"; id: string } | { kind: "lanc"; editId?: string } | { kind: "tran" }
  | { kind: "me" } | { kind: "results" } | { kind: "diag"; idx: number }
  | { kind: "pay"; id: string; ym?: string } | { kind: "box"; id: string } | { kind: "boxForm"; editId?: string };

export const ui = createStore<{ openId: string | null; sheet: SheetState | null; toast: { text: string; n: number } | null }>({ openId: null, sheet: null, toast: null });
export const openSheet = (sheet: SheetState) => ui.set({ sheet });
export const closeSheet = () => ui.set({ sheet: null });
export const openAccount = (id: string) => { ui.set({ openId: id }); scrollTo(0, 0); };
export const backHome = () => { ui.set({ openId: null }); scrollTo(0, 0); };
let toastN = 0;
export const toast = (text: string) => ui.set({ toast: { text, n: ++toastN } });
export const hideToast = () => ui.set({ toast: null });

export const pdfResults = createStore<{ items: ReadResult[] }>({ items: [] });
/** escolhe a conta (e a data de vencimento, quando o PDF não traz) de um resultado lido */
export const patchResult = (i: number, p: { acct?: string; date?: string }) =>
  pdfResults.set(s => ({ items: s.items.map((x, k) => (k === i ? { ...x, ...p } : x)) }));
