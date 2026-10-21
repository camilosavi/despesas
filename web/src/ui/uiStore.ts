// Estado da interface: conta aberta, janela aberta, aviso (toast) e o resultado da leitura de PDFs.
import { createStore } from "../lib/createStore";
import { lsGet, lsSet } from "../lib/storage";
import type { ReadResult } from "../lib/pdf/read";

export type SheetState =
  | { kind: "add" } | { kind: "edit" } | { kind: "entry"; id: string } | { kind: "lanc"; editId?: string; copyId?: string } | { kind: "tran" }
  | { kind: "me" } | { kind: "results" } | { kind: "diag"; idx: number }
  | { kind: "pay"; id: string; ym?: string } | { kind: "dups" } | { kind: "sum" } | { kind: "cats" } | { kind: "conf"; id: string } | { kind: "box"; id: string } | { kind: "boxForm"; editId?: string };

export const ui = createStore<{ openId: string | null; sheet: SheetState | null; toast: { text: string; n: number; undo?: () => void } | null }>({ openId: null, sheet: null, toast: null });

/** "olho" do cartão: valores borrados na tela (a escolha fica no aparelho) */
const KEY_HIDE = "despesas.zero.hide";
export const hidden = createStore<{ on: boolean }>({ on: lsGet(KEY_HIDE) === "1" });
const paintHide = () => document.documentElement.classList.toggle("hide", hidden.get().on);
paintHide();
export const toggleHide = () => { hidden.set({ on: !hidden.get().on }); lsSet(KEY_HIDE, hidden.get().on ? "1" : null); paintHide(); };
export const openSheet = (sheet: SheetState) => ui.set({ sheet });
export const closeSheet = () => ui.set({ sheet: null });
export const openAccount = (id: string) => { ui.set({ openId: id }); scrollTo(0, 0); };
export const backHome = () => { ui.set({ openId: null }); scrollTo(0, 0); };
let toastN = 0;
/** aviso rápido; com `undo` aparece o botão Desfazer */
export const toast = (text: string, undo?: () => void) => ui.set({ toast: { text, n: ++toastN, undo } });
export const hideToast = () => ui.set({ toast: null });

export const pdfResults = createStore<{ items: ReadResult[] }>({ items: [] });
/** escolhe a conta (e a data de vencimento, quando o PDF não traz) de um resultado lido */
export const patchResult = (i: number, p: { acct?: string; date?: string }) =>
  pdfResults.set(s => ({ items: s.items.map((x, k) => (k === i ? { ...x, ...p } : x)) }));
