// Contas e lançamentos do aparelho. Guardados no localStorage (mesmas chaves do app anterior) e sincronizados por sync.ts.
import { createStore } from "./createStore";
import { cardColor } from "./banks";
import { uid } from "./format";
import { lsGet, lsJson, lsSet } from "./storage";
import type { Account, Entry } from "./types";

export const KEY_ACCTS = "despesas.zero.accts", KEY_ENTRIES = "despesas.zero.entries";
export interface LedgerState { accts: Account[]; entries: Entry[] }

function load(): LedgerState {
  let accts = lsJson<Account[] | null>(KEY_ACCTS, null);
  const entries = lsJson<Entry[]>(KEY_ENTRIES, []);
  if (!Array.isArray(accts)) { // a versão anterior guardava só cartões (nome e cor): viram contas com saldo zero
    accts = [];
    try {
      const old = JSON.parse(lsGet("despesas.zero.cards") || "{}") || {};
      accts = Object.keys(old).map(n => ({ id: uid(), name: n, color: old[n].color || cardColor(n), start: 0 }));
    } catch { /* sem cartões antigos */ }
  }
  return { accts, entries: Array.isArray(entries) ? entries : [] };
}

export const ledger = createStore<LedgerState>(load());

let onChange: (() => void) | null = null;
/** chamado a cada mudança feita neste aparelho (o sync usa para enviar) */
export const onLedgerChange = (fn: () => void) => { onChange = fn; };

function save(s: LedgerState) { lsSet(KEY_ACCTS, JSON.stringify(s.accts)); lsSet(KEY_ENTRIES, JSON.stringify(s.entries)); }
function commit(next: LedgerState, notify = true) { ledger.set(next); save(next); if (notify) onChange?.(); }
save(ledger.get());

export const accOf = (id: string | null | undefined) => (id ? ledger.get().accts.find(a => a.id === id) : undefined);

export const actions = {
  addAccount(a: Account) { const s = ledger.get(); commit({ ...s, accts: [...s.accts, a] }); },
  updateAccount(id: string, patch: Partial<Account>) {
    const s = ledger.get();
    commit({ ...s, accts: s.accts.map(a => (a.id === id ? { ...a, ...patch } : a)) });
  },
  deleteAccount(id: string) { const s = ledger.get(); commit({ accts: s.accts.filter(a => a.id !== id), entries: s.entries.filter(e => e.acct !== id) }); },
  addEntries(...es: Entry[]) { const s = ledger.get(); commit({ ...s, entries: [...s.entries, ...es] }); },
  updateEntry(id: string, next: Entry) { const s = ledger.get(); commit({ ...s, entries: s.entries.map(e => (e.id === id ? next : e)) }); },
  /** apaga o lançamento; transferência leva o par junto */
  deleteEntry(id: string) {
    const s = ledger.get(), e = s.entries.find(x => x.id === id);
    commit({ ...s, entries: s.entries.filter(x => x.id !== id && !(e && e.tr && x.tr === e.tr)) });
  },
  /** o banco mandou o estado verdadeiro: troca tudo sem disparar novo envio */
  replaceFromServer(accts: Account[], entries: Entry[]) { commit({ accts, entries }, false); },
  clear() { commit({ accts: [], entries: [] }, false); },
};
