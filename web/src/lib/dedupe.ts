// O mesmo pagamento vindo de fontes diferentes (lançado à mão, PDF da fatura, Open Finance): reconhecer e juntar em um só.
import { fold } from "./format";
import type { Entry } from "./types";

const dayN = (d: string) => Math.round(Date.parse(d + "T12:00:00Z") / 864e5);
const gap = (a: Entry, b: Entry) => Math.abs(dayN(a.date) - dayN(b.date));
/** pagamento de fatura (do PDF, do "Pagar" ou do débito do banco) */
export const isFatPay = (e: Entry) => !!e.imp && (e.imp.startsWith("pagfatura-") || e.imp.startsWith("fatura-"));
const isOf = (e: Entry) => !!e.imp && (e.imp.startsWith("of-") || e.imp.startsWith("pagfatura-of-"));
const STOP = new Set(["de", "do", "da", "dos", "das", "pix", "compra", "no", "na", "em", "debito", "credito", "pagamento", "conta", "recebido", "enviado", "receber"]);
const words = (d: string) => fold(d).replace(/[^a-z0-9/ ]+/g, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
const inst = (w: string[]) => w.find(x => /^\d+\/\d+$/.test(x));
/** descrições parecidas: palavras em comum (ou uma começando pela outra), e a mesma parcela quando tem "4/10" */
export const similar = (a: string, b: string) => {
  const wa = words(a), wb = words(b); if (!wa.length || !wb.length) return false;
  const ia = inst(wa), ib = inst(wb); if (ia && ib && ia !== ib) return false;
  const same = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)));
  const shared = wa.filter(x => wb.some(y => same(x, y))).length;
  return shared >= 1 && shared / Math.min(wa.length, wb.length) >= 0.5;
};
const basic = (a: Entry, b: Entry) => a.id !== b.id && a.acct === b.acct && a.type === b.type && a.cents === b.cents && !a.xfer && !b.xfer && !a.tr && !b.tr;
/** dois lançamentos que parecem o mesmo pagamento */
export const sameTx = (a: Entry, b: Entry) => {
  if (!basic(a, b) || (isOf(a) && isOf(b))) return false; // dois do banco com a mesma chave diferente são compras diferentes
  if (isFatPay(a) && isFatPay(b)) return gap(a, b) <= 10;
  return gap(a, b) <= 4 && similar(a.desc, b.desc);
};
/** ao importar do banco: o lançamento que já existe e é o mesmo pagamento (manual sem chave; ou pagamento de fatura já lançado por PDF / "Pagar") */
export function matchForImport(existing: Entry[], inc: Entry, used: Set<string> = new Set()): Entry | undefined {
  const cand = existing.filter(x => !used.has(x.id) && basic(x, inc));
  if (inc.imp?.startsWith("pagfatura-of-") || inc.imp?.startsWith("fatura-")) return cand.filter(x => (isFatPay(x) || (!x.imp && /fatura/i.test(x.desc))) && x.imp !== inc.imp && !(isOf(x) && isOf(inc)) && gap(x, inc) <= 10).sort((p, q) => gap(p, inc) - gap(q, inc))[0];
  return cand.filter(x => !x.imp && gap(x, inc) <= 4 && similar(x.desc, inc.desc)).sort((p, q) => gap(p, inc) - gap(q, inc))[0];
}
/** pares que parecem duplicados (entre os que já estão no app), sem os que ele disse que são diferentes */
export function findDupes(entries: Entry[], ignored: Set<string> = new Set()): [Entry, Entry][] {
  const out: [Entry, Entry][] = [], by = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < by.length; i++) for (let j = i + 1; j < by.length && gap(by[i], by[j]) <= 10; j++) {
    const a = by[i], b = by[j]; if (!sameTx(a, b) || ignored.has(pairKey(a, b))) continue;
    out.push([a, b]);
  }
  return out;
}
export const pairKey = (a: Entry, b: Entry) => [a.id, b.id].sort().join("|");
/** quem fica: o lançamento que ele mesmo fez (sem chave do banco), senão o que tem itens, senão o mais antigo */
export const pickKeep = (a: Entry, b: Entry): [Entry, Entry] => {
  const score = (e: Entry) => (isOf(e) ? 0 : 2) + (e.items?.length ? 1 : 0);
  return score(a) !== score(b) ? (score(a) > score(b) ? [a, b] : [b, a]) : (a.at || 0) <= (b.at || 0) ? [a, b] : [b, a];
};
/** o lançamento resultante: fica o de `keep`, ganhando o que só o outro tinha (chave do banco, categoria, itens) */
export function mergedEntry(keep: Entry, drop: Entry): Entry {
  const m: Entry = { ...keep };
  if (!m.imp && drop.imp) m.imp = drop.imp;
  if (!m.cat && drop.cat) m.cat = drop.cat;
  if (!m.items && drop.items) m.items = drop.items;
  if (m.open && !drop.open) delete m.open;
  return m;
}
