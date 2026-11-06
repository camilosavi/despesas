// Salário previsto: porta fiel do salPlan/salVirt do app atual (src/app.html). Lê só cfg.hol, cfg.salPrev, cfg.salRaise, cfg.salX, cfg.salOv.
import type { Backup } from "./loja";

export interface HolEv { d: string; c: number; s: "p" | "d" }
export interface Hol { ref: string; k: string; date?: string; liq: number; tp?: number; ev: HolEv[]; kind?: string; x?: number; emp?: string }
export interface Evt { s: "p" | "d"; d: string; c: number; seen?: number }
export interface Plano { n: number; from: string; to: string; fix: Evt[]; vari: Evt[]; adv: number; rate: number; taxB: number; base: number; avg: number; fp: number; fd: number; real: { ref: string; liq: number }[]; fell: "last" | number }
export interface Previsto { id: string; desc: string; cents: number; data: string; caiu?: string; ov?: boolean; orig?: number; cat: "sal" | "d13" }

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const evKey = (d: string) => fold(d).toUpperCase().replace(/[^A-Z0-9% ]/g, "").replace(/\s+/g, " ").trim();
const pad = (n: number) => String(n).padStart(2, "0");
export const somaMes = (ym: string, n: number) => { const t = +ym.slice(0, 4) * 12 + (+ym.slice(5) - 1) + n; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`; };
const lastDay = (ym: string) => new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();
const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };

export const holerites = (b: Backup): Hol[] => Object.values((b.cfg.hol || {}) as Record<string, Hol>).sort((a, c) => (a.ref + a.k).localeCompare(c.ref + c.k));

export function plano(b: Backup): Plano | null {
  const F = holerites(b).filter(h => h.k === "sal" && h.ev?.length && !h.x).slice(-6);
  if (F.length < 2) return null;
  const n = F.length;
  const G: Record<string, { s: "p" | "d"; d: string; v: number[]; seen: number }> = {};
  F.forEach((h, i) => h.ev.forEach(e => {
    const k = e.s + "|" + evKey(e.d); if (/ARRED/.test(k)) return;
    const g = (G[k] = G[k] || { s: e.s, d: e.d, v: Array(n).fill(0), seen: 0 }); g.v[i] += e.c; g.d = e.d;
  }));
  Object.values(G).forEach(g => (g.seen = g.v.filter(Boolean).length));
  const isAdv = (g: { s: string; d: string }) => g.s === "d" && /ADIANT/.test(evKey(g.d));
  const isTax = (g: { s: string; d: string }) => g.s === "d" && /INSS|IRRF|IMPOSTODERENDA/.test(evKey(g.d).replace(/ /g, ""));
  const fix: Evt[] = [], vari: Evt[] = [], tax: (typeof G)[string][] = []; let adv = 0;
  Object.values(G).forEach(g => {
    if (isAdv(g)) { adv = g.v[n - 1] || med(g.v.filter(Boolean)); return; }
    if (isTax(g)) { tax.push(g); return; }
    const nz = g.v.filter(Boolean), m = nz.length ? med(nz) : 0, same = nz.filter(v => Math.abs(v - m) <= m * 0.05).length;
    if (g.seen >= Math.ceil(n * 0.6) && same >= Math.ceil(n * 0.6)) fix.push({ s: g.s, d: g.d, c: [...g.v].reverse().find(Boolean) || 0 });
    else vari.push({ s: g.s, d: g.d, c: Math.round(g.v.reduce((a, c) => a + c, 0) / n), seen: g.seen });
  });
  const sum = (a: Evt[], s: "p" | "d") => a.filter(e => e.s === s).reduce((t, e) => t + e.c, 0);
  const fp = sum(fix, "p"), fd = sum(fix, "d");
  const rate = tax.length ? med(F.map((h, i) => { const t = tax.reduce((a, g) => a + g.v[i], 0), tp = h.tp || h.ev.filter(e => e.s === "p").reduce((a, e) => a + e.c, 0); return tp ? t / tp : 0; })) : 0;
  const vp = sum(vari, "p"), vd = sum(vari, "d");
  const taxB = Math.round(fp * rate), taxV = Math.round((fp + vp) * rate);
  const last = F[n - 1].date, dia = last ? +last.slice(8) : 0;
  return { n, from: F[0].ref, to: F[n - 1].ref, fix, vari, adv, rate, taxB, fp, fd, base: fp - adv - taxB - fd, avg: fp + vp - adv - taxV - fd - vd,
    real: F.map(h => ({ ref: h.ref, liq: h.liq })), fell: last ? (dia >= 25 ? "last" : dia) : "last" };
}

export const modo = (b: Backup): "off" | "base" | "avg" => (b.cfg.salPrev === "off" ? "off" : b.cfg.salPrev === "base" ? "base" : "avg");

interface Raise { from: string; gross?: number; net?: number }
const raise = (b: Backup): Raise | null => { const r = b.cfg.salRaise; return r && r.from && (r.gross || r.net) ? r : null; };
export function ajuste(P: Plano, b: Backup, ref: string) {
  const r = raise(b), out = { adv: P.adv, base: P.base, avg: P.avg, up: false };
  if (!r || ref < r.from) return out;
  const S = P.fix.filter(e => e.s === "p" && /HORAS NORMAIS|SALARIO|ORDENADO|SAL BASE|VENCIMENTO/.test(evKey(e.d))).reduce((a, e) => a + e.c, 0) || P.fp || 1;
  const var0 = P.avg - P.base;
  if (r.gross) { const f = r.gross / S, fp = (P.fp || S) - S + r.gross; out.adv = Math.round(P.adv * f); out.base = fp - out.adv - Math.round(fp * P.rate) - (P.fd || 0); }
  if (r.net) { if (!r.gross) out.adv = Math.round((P.adv * r.net) / Math.max(1, P.adv + P.base)); out.base = r.net - out.adv; }
  out.avg = out.base + var0; out.up = true; return out;
}
export const terco = (P: Plano) => Math.round(((P.fp || 0) / 3) * (1 - P.rate));
export function seg13(P: Plano, b: Backup, ano: string) {
  const X = b.cfg.salX || {}; if (X.d13) return X.d13 as number;
  const primeira = ((b.items || []) as any[]).filter(x => x.type === "rec" && (x.cat === "d13" || (x.cat === "sal" && /\b13/.test(x.desc || ""))) && (x.date || "").startsWith(ano + "-")).reduce((s, x) => s + x.cents, 0);
  const fp = P.fp || 0; return Math.max(0, Math.round(fp - (primeira || fp / 2) - fp * P.rate));
}

// receitas previstas do mês (mês atual em diante); `hoje` = "AAAA-MM-DD"
export function previstos(b: Backup, ym: string, hoje: string): Previsto[] {
  if (ym < hoje.slice(0, 7) || modo(b) === "off") return [];
  const P = plano(b); if (!P) return [];
  const R0 = ((b.items || []) as any[]).filter(x => x.type === "rec" && (x.cat === "sal" || x.cat === "d13") && (x.date || "").startsWith(ym));
  const ehAdv = (x: any) => /adiant|adto|\bvale\b/i.test(fold(x.desc || "")) || (!/13|f[ée]rias/i.test(fold(x.desc || "")) && +(x.date || "").slice(8) >= 10 && +(x.date || "").slice(8) <= 20);
  const temAdv = R0.some(x => x.cat === "sal" && ehAdv(x));
  const temSal = R0.some(x => x.cat === "sal" && !ehAdv(x) && !/13|f[ée]rias/i.test(fold(x.desc || "")));
  const A = ajuste(P, b, ym), B = ajuste(P, b, somaMes(ym, -1)), out: Previsto[] = [];
  if (P.adv && !temAdv) { const d = `${ym}-15`; if (d >= hoje) out.push({ id: "_sp_adv_" + ym, cat: "sal", desc: A.up ? "Adiantamento (previsto, com aumento)" : "Adiantamento (previsto)", cents: A.adv, data: d }); }
  if (ym.endsWith("-12") && !R0.some(x => x.cat === "d13" || /\b13/.test(x.desc || ""))) { const d = `${ym}-20`, v = seg13(P, b, ym.slice(0, 4)); if (d >= hoje && v > 0) out.push({ id: "_sp_13_" + ym, cat: "d13", desc: "13º salário, 2ª parcela (previsto)", cents: v, data: d }); }
  const X = b.cfg.salX || {};
  if (X.fer === ym && !R0.some(x => /f[ée]rias/i.test(x.desc || ""))) { const d = `${ym}-01`, v = terco(P); if (v > 0 && `${ym}-${pad(lastDay(ym))}` >= hoje) out.push({ id: "_sp_fer_" + ym, cat: "sal", desc: "Terço de férias (previsto)", cents: v, data: d < hoje ? hoje : d }); }
  const v = modo(b) === "base" ? B.base : B.avg;
  if (v > 0 && !temSal) {
    const pm = somaMes(ym, -1), dia = P.fell === "last" ? lastDay(pm) : Math.min(P.fell, lastDay(pm)), caiu = `${pm}-${pad(dia)}`;
    if (caiu >= hoje) out.push({ id: "_sp_sal_" + ym, cat: "sal", desc: "Salário (previsto)", cents: v, data: dia >= 25 ? `${ym}-01` : caiu, ...(dia >= 25 ? { caiu } : {}) });
  }
  const O = (b.cfg.salOv || {}) as Record<string, { c?: number; skip?: number }>;
  return out.filter(x => !O[x.id]?.skip).map(x => (O[x.id]?.c && O[x.id].c! > 0 ? { ...x, orig: x.cents, cents: O[x.id].c!, ov: true, desc: x.desc.replace(" (previsto", " (ajustado") } : x));
}

// ---- gravação (imutável, devolve backup novo) ----
const setCfg = (b: Backup, k: string, v: unknown): Backup => ({ ...b, cfg: { ...b.cfg, [k]: v } });
export const salModo = (b: Backup, m: "off" | "base" | "avg") => setCfg(b, "salPrev", m);
export const salAumento = (b: Backup, r: { from: string; gross?: number; net?: number } | null) => setCfg(b, "salRaise", r && r.from && (r.gross || r.net) ? r : null);
export const salExtras = (b: Backup, x: { d13?: number; fer?: string } | null) => setCfg(b, "salX", x && (x.d13 || x.fer) ? { ...(x.d13 ? { d13: x.d13 } : {}), ...(x.fer ? { fer: x.fer } : {}) } : null);
export function salAjustarMes(b: Backup, id: string, v: { c: number } | { skip: 1 } | null): Backup {
  const O = { ...((b.cfg.salOv || {}) as Record<string, unknown>) }; if (v) O[id] = v; else delete O[id]; return setCfg(b, "salOv", O);
}
export const holNaoUsar = (b: Backup, key: string, x: boolean): Backup => {
  const H = { ...((b.cfg.hol || {}) as Record<string, Hol>) }; if (!H[key]) return b;
  const h = { ...H[key] }; if (x) h.x = 1; else delete h.x; H[key] = h; return setCfg(b, "hol", H);
};
export const holApagar = (b: Backup, key: string): Backup => { const H = { ...((b.cfg.hol || {}) as Record<string, Hol>) }; delete H[key]; return setCfg(b, "hol", H); };
