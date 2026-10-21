import type { Currency, SaveBox } from "./types";
import { brl } from "./format";

export interface BoxKind { k: string; n: string; i: string }
export const BOX_KINDS: BoxKind[] = [
  { k: "viagem", n: "Viagem", i: "✈️" },
  { k: "reserva", n: "Reserva de Emergência", i: "🛡️" },
  { k: "casa", n: "Casa Própria", i: "🏠" },
  { k: "carro", n: "Carro / Moto", i: "🚗" },
  { k: "tech", n: "Eletrônicos", i: "💻" },
  { k: "estudos", n: "Estudos", i: "📚" },
  { k: "invest", n: "Investimento", i: "📈" },
  { k: "outro", n: "Outro", i: "💰" },
];

export const boxIcon = (b: SaveBox) => {
  if (b.icon) return b.icon;
  const match = BOX_KINDS.find(k => k.k === b.kind);
  return match ? match.i : "💰";
};

/** onde está o dinheiro: saldo por banco e moeda (movimentos sem banco ficam de fora) */
export const boxByBank = (b: SaveBox) => {
  const m = new Map<string, { bank: string; cur: Currency; cents: number }>();
  for (const x of b.moves || []) {
    if (!x.bank) continue;
    const cur = x.cur || b.cur, k = x.bank + "|" + cur, v = m.get(k) || { bank: x.bank, cur, cents: 0 };
    v.cents += x.cents; m.set(k, v);
  }
  return [...m.values()].filter(v => v.cents !== 0);
};

/** saldo na moeda da caixinha (movimentos em outra moeda não entram: ver boxBrl) */
export const boxBal = (b: SaveBox): number =>
  (b.moves || []).reduce((sum, m) => sum + ((m.cur || b.cur) === b.cur ? m.cents : 0), 0);

/** em caixinha de euro/dólar: o que foi guardado direto em reais, sem converter (a meta só conta a moeda da caixinha) */
export const boxBrl = (b: SaveBox): number =>
  b.cur === "BRL" ? 0 : (b.moves || []).reduce((sum, m) => sum + (m.cur === "BRL" ? m.cents : 0), 0);

export const boxTotalsByCur = (boxes: SaveBox[]) => {
  const totals: Record<Currency, number> = { BRL: 0, EUR: 0, USD: 0 };
  for (const b of boxes) {
    totals[b.cur] = (totals[b.cur] || 0) + boxBal(b);
    totals.BRL += boxBrl(b);
  }
  return totals;
};

export const boxProgress = (b: SaveBox) => {
  if (!b.goal || b.goal <= 0) return null;
  const current = boxBal(b);
  const pct = Math.max(0, Math.min(100, Math.round((current / b.goal) * 100)));
  const left = Math.max(0, b.goal - current);
  return { pct, left, done: current >= b.goal };
};

export const fmtMoneyCur = (cents: number, cur: Currency): string => {
  const v = brl(Math.abs(cents));
  const sign = cents < 0 ? "−" : "";
  if (cur === "EUR") return `${sign}€ ${v}`;
  if (cur === "USD") return `${sign}US$ ${v}`;
  return `${sign}R$ ${v}`;
};

// Cotações com cache local de 30 minutos
let cachedRates: { EUR: number; USD: number; at: number } | null = null;
const DEFAULT_RATES = { EUR: 6.20, USD: 5.60 };

export async function fetchLiveRates(): Promise<{ EUR: number; USD: number }> {
  if (cachedRates && Date.now() - cachedRates.at < 30 * 60 * 1000) {
    return { EUR: cachedRates.EUR, USD: cachedRates.USD };
  }
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/last/EUR-BRL,USD-BRL");
    if (!res.ok) throw new Error("Falha na API de cotação");
    const data = await res.json();
    const eur = parseFloat(data.EURBRL?.bid || String(DEFAULT_RATES.EUR));
    const usd = parseFloat(data.USDBRL?.bid || String(DEFAULT_RATES.USD));
    cachedRates = { EUR: eur, USD: usd, at: Date.now() };
    return { EUR: eur, USD: usd };
  } catch {
    return cachedRates ? { EUR: cachedRates.EUR, USD: cachedRates.USD } : DEFAULT_RATES;
  }
}
