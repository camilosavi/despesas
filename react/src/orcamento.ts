// Orçamento com sobra (cfg.budRoll) e regras de categoria (cfg.catRules) — mesmo formato do app atual.
import type { Backup } from "./loja";
import { limites } from "./loja";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const proximo = (ym: string) => { const [y, m] = ym.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

// ---------- sobra ----------
export const sobraDesde = (b: Backup): Record<string, string> => (b.cfg.budRoll || {}) as Record<string, string>;
export function sobraLigar(b: Backup, k: string, ym: string, ligar: boolean): Backup {
  const o = { ...sobraDesde(b) };
  if (ligar && limites(b)[k]) o[k] = ym; else delete o[k];
  return { ...b, cfg: { ...b.cfg, budRoll: o } };
}
/**
 * Limite do mês com a sobra levada. A sobra de cada mês (limite − gasto, nunca negativa) soma ao limite do seguinte,
 * a partir do mês em que foi ligada; estourar gasta a sobra. `gastoDe(ym)` = gasto da categoria naquele mês.
 */
export function limiteComSobra(base: number, desde: string | undefined, ym: string, gastoDe: (ym: string) => number): { limite: number; sobra: number } {
  if (!base || !desde || ym <= desde) return { limite: base, sobra: 0 };
  let sobra = 0, m = desde, passos = 0;
  while (m < ym && passos++ < 120) { sobra = Math.max(0, base + sobra - gastoDe(m)); m = proximo(m); }
  return { limite: base + sobra, sobra };
}

// ---------- regras de categoria ----------
export interface Regra { t: string; m: string; cat: string }
export const regras = (b: Backup): Regra[] => (Array.isArray(b.cfg.catRules) ? (b.cfg.catRules as Regra[]) : []);
/** categoria da primeira regra que casa ("contém", sem acento nem maiúscula) e que existe entre `validas` */
export const regraDe = (b: Backup, desc: string, validas: string[]): string => {
  const d = semAcento(desc); if (!d) return "";
  const r = regras(b).find(x => x.t && d.includes(semAcento(x.t)) && validas.includes(x.cat));
  return r ? r.cat : "";
};
export function regraCriar(b: Backup, texto: string, cat: string, tipo: "desp" | "rec"): { backup: Backup; erro?: string; mudou: number } {
  const t = texto.trim();
  if (t.length < 2) return { backup: b, erro: "Digite pelo menos 2 letras do texto.", mudou: 0 };
  if (!cat) return { backup: b, erro: "Escolha a categoria.", mudou: 0 };
  const velhas = regras(b).filter(x => semAcento(x.t) !== semAcento(t));
  if (velhas.length >= 50) return { backup: b, erro: "Limite de 50 regras.", mudou: 0 };
  const n = semAcento(t);
  // quem estava em Outros / Outras receitas e bate com o texto passa para a categoria da regra
  let mudou = 0;
  const items = b.items.map(x => {
    if (x.type === tipo && (x.cat === "outros" || x.cat === "rout") && x.cat !== cat && semAcento(x.desc).includes(n)) { mudou++; return { ...x, cat }; }
    return x;
  });
  return { backup: { ...b, items, cfg: { ...b.cfg, catRules: [...velhas, { t, m: "c", cat }] } }, mudou };
}
export const regraApagar = (b: Backup, t: string): Backup => ({ ...b, cfg: { ...b.cfg, catRules: regras(b).filter(x => x.t !== t) } });
