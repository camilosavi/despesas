// Contas e lançamentos do aparelho. Guardados no localStorage (mesmas chaves do app anterior) e sincronizados por sync.ts.
import { createStore } from "./createStore";
import { cardColor } from "./banks";
import { uid } from "./format";
import { lsGet, lsJson, lsSet } from "./storage";
import { CAT_RENAME } from "./categories";
import { matchForImport, mergedEntry } from "./dedupe";
import type { Account, Entry, SaveBox, SaveMove } from "./types";

export const KEY_ACCTS = "despesas.zero.accts", KEY_ENTRIES = "despesas.zero.entries", KEY_BOXES = "despesas.zero.boxes";
export interface LedgerState { accts: Account[]; entries: Entry[]; boxes: SaveBox[] }

function load(): LedgerState {
  let accts = lsJson<Account[] | null>(KEY_ACCTS, null);
  const entries = lsJson<Entry[]>(KEY_ENTRIES, []);
  let boxes = lsJson<SaveBox[] | null>(KEY_BOXES, null);
  if (!Array.isArray(accts)) { // a versão anterior guardava só cartões (nome e cor): viram contas com saldo zero
    accts = [];
    try {
      const old = JSON.parse(lsGet("despesas.zero.cards") || "{}") || {};
      accts = Object.keys(old).map(n => ({ id: uid(), name: n, color: old[n].color || cardColor(n), start: 0 }));
    } catch { /* sem cartões antigos */ }
  }
  if (!Array.isArray(boxes)) {
    boxes = [];
    try {
      const oldCfg = JSON.parse(lsGet("despesas.cfg") || "{}") || {};
      if (Array.isArray(oldCfg.save)) {
        boxes = oldCfg.save.map((b: any) => ({
          id: b.id || uid(),
          name: b.name || "Caixinha",
          kind: b.kind || "outro",
          cur: b.goalCur || "BRL",
          goal: b.goal || 0,
          target: b.target,
          moves: Array.isArray(b.moves) ? b.moves.map((m: any) => ({
            id: m.id || uid(),
            date: m.date || new Date().toISOString().slice(0, 10),
            cents: m.cents || 0,
            cur: m.cur || b.goalCur || "BRL",
            rate: m.rate,
            brl: m.brl,
          })) : [],
        }));
      }
    } catch { /* sem caixinhas antigas */ }
  }
  return { accts, entries: Array.isArray(entries) ? entries : [], boxes: Array.isArray(boxes) ? boxes : [] };
}

export const ledger = createStore<LedgerState>(load());

let onChange: (() => void) | null = null;
/** chamado a cada mudança feita neste aparelho (o sync usa para enviar) */
export const onLedgerChange = (fn: () => void) => { onChange = fn; };

function save(s: LedgerState) {
  lsSet(KEY_ACCTS, JSON.stringify(s.accts));
  lsSet(KEY_ENTRIES, JSON.stringify(s.entries));
  lsSet(KEY_BOXES, JSON.stringify(s.boxes));
}
function commit(next: LedgerState, notify = true) { ledger.set(next); save(next); if (notify) onChange?.(); }
save(ledger.get());

export const accOf = (id: string | null | undefined) => (id ? ledger.get().accts.find(a => a.id === id) : undefined);
export const boxOf = (id: string | null | undefined) => (id ? ledger.get().boxes.find(b => b.id === id) : undefined);

export const actions = {
  addAccount(a: Account) { const s = ledger.get(); commit({ ...s, accts: [...s.accts, a] }); },
  updateAccount(id: string, patch: Partial<Account>) {
    const s = ledger.get();
    commit({ ...s, accts: s.accts.map(a => (a.id === id ? { ...a, ...patch } : a)) });
  },
  /** junta duas contas do mesmo tipo: os lançamentos de `from` passam para `into` (que mantém saldo inicial e nome; limite e dias da fatura vêm de `from` se faltarem) e `from` some */
  mergeAccount(from: string, into: string) {
    const s = ledger.get(), a = s.accts.find(x => x.id === from), b = s.accts.find(x => x.id === into); if (!a || !b || from === into) return;
    const fill: Partial<Account> = {}; for (const k of ["limit", "closeDay", "dueDay"] as const) if (!b[k] && a[k]) fill[k] = a[k];
    commit({ ...s, accts: s.accts.filter(x => x.id !== from).map(x => (x.id === into ? { ...x, ...fill } : x)), entries: s.entries.map(e => (e.acct === from ? { ...e, acct: into } : e)) });
  },
  /** passa os nomes de categoria da versão de 21/10 (manhã) para os do app antigo, nos lançamentos e nos itens das faturas; sem nada para trocar não grava */
  migrateCats() {
    const s = ledger.get(); let n = 0;
    const entries = s.entries.map(e => {
      const m = CAT_RENAME[e.type], c = e.cat && m[e.cat];
      const items = e.items?.some(i => i.cat && CAT_RENAME.desp[i.cat]) ? e.items.map(i => (i.cat && CAT_RENAME.desp[i.cat] ? { ...i, cat: CAT_RENAME.desp[i.cat] } : i)) : e.items;
      if (!c && items === e.items) return e;
      n++; return { ...e, ...(c ? { cat: c } : {}), ...(items ? { items } : {}) };
    });
    if (n) commit({ ...s, entries });
  },
  /** lança um (do PDF); se já existe o mesmo pagamento (à mão ou do banco), junta nele em vez de duplicar. true = juntou */
  addOrMerge(e: Entry): boolean {
    const m = matchForImport(ledger.get().entries, e);
    if (!m) { commit({ ...ledger.get(), entries: [...ledger.get().entries, e] }); return false; }
    const s = ledger.get(); commit({ ...s, entries: s.entries.map(x => (x.id === m.id ? mergedEntry(x, e) : x)) }); return true;
  },
  /** junta dois lançamentos que são o mesmo pagamento: fica `keep`, ganhando o que só o outro tinha, e `drop` some */
  mergeEntries(keepId: string, dropId: string) {
    const s = ledger.get(), k = s.entries.find(e => e.id === keepId), d = s.entries.find(e => e.id === dropId); if (!k || !d || k.id === d.id) return;
    commit({ ...s, entries: s.entries.filter(e => e.id !== dropId).map(e => (e.id === keepId ? mergedEntry(k, d) : e)) });
  },
  deleteAccount(id: string) { const s = ledger.get(); commit({ ...s, accts: s.accts.filter(a => a.id !== id), entries: s.entries.filter(e => e.acct !== id) }); },
  addEntries(...es: Entry[]) { const s = ledger.get(); commit({ ...s, entries: [...s.entries, ...es] }); },
  updateEntry(id: string, next: Entry) { const s = ledger.get(); commit({ ...s, entries: s.entries.map(e => (e.id === id ? next : e)) }); },
  /** apaga o lançamento; transferência leva o par junto */
  deleteEntry(id: string) {
    const s = ledger.get(), e = s.entries.find(x => x.id === id);
    commit({ ...s, entries: s.entries.filter(x => x.id !== id && !(e && e.tr && x.tr === e.tr)) });
  },
  /** troca o nome de uma categoria em todos os lançamentos (nome vazio = tira a categoria) */
  renameCat(from: string, to: string) {
    const s = ledger.get(), nm = to.trim();
    const ren = <T extends { cat?: string }>(x: T): T => { if (x.cat !== from) return x; const n = { ...x }; if (nm) n.cat = nm; else delete n.cat; return n; };
    commit({ ...s, entries: s.entries.map(e => { const n = ren(e); return n.items ? { ...n, items: n.items.map(ren) } : n; }) });
  },
  addBox(b: SaveBox) { const s = ledger.get(); commit({ ...s, boxes: [...s.boxes, b] }); },
  updateBox(id: string, patch: Partial<SaveBox>) {
    const s = ledger.get();
    commit({ ...s, boxes: s.boxes.map(b => (b.id === id ? { ...b, ...patch } : b)) });
  },
  deleteBox(id: string) { const s = ledger.get(); commit({ ...s, boxes: s.boxes.filter(b => b.id !== id) }); },
  addBoxMove(boxId: string, m: SaveMove) {
    const s = ledger.get();
    commit({ ...s, boxes: s.boxes.map(b => (b.id === boxId ? { ...b, moves: [m, ...(b.moves || [])] } : b)) });
  },
  updateBoxMove(boxId: string, moveId: string, m: SaveMove) {
    const s = ledger.get();
    commit({ ...s, boxes: s.boxes.map(b => (b.id === boxId ? { ...b, moves: b.moves.map(x => (x.id === moveId ? m : x)) } : b)) });
  },
  deleteBoxMove(boxId: string, moveId: string) {
    const s = ledger.get();
    commit({ ...s, boxes: s.boxes.map(b => (b.id === boxId ? { ...b, moves: b.moves.filter(m => m.id !== moveId) } : b)) });
  },
  /** o banco mandou o estado verdadeiro: troca tudo sem disparar novo envio */
  replaceFromServer(accts: Account[], entries: Entry[], boxes?: SaveBox[]) { const s = ledger.get(); commit({ accts, entries, boxes: boxes ?? s.boxes }, false); },
  clear() { commit({ accts: [], entries: [], boxes: [] }, false); },
};
