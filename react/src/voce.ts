// Tela Você: aparência (modo e cor), nome, backup e "zerar". Tudo puro (sem tela), para testar.
import type { Backup } from "./loja";

export type Modo = "auto" | "light" | "dark";
export interface Visual { modo: Modo; cor: string }
export const CORES = [
  { id: "tostao", nome: "Tostão", cor: "#c9a25a" },
  { id: "verde", nome: "Verde", cor: "#2f7d5e" },
  { id: "azul", nome: "Azul", cor: "#2f5fc4" },
  { id: "bordo", nome: "Bordô", cor: "#9b2f48" },
  { id: "grafite", nome: "Grafite", cor: "#3b4252" },
] as const;
export const MODOS: { id: Modo; nome: string }[] = [{ id: "auto", nome: "Automático" }, { id: "light", nome: "Claro" }, { id: "dark", nome: "Escuro" }];

const CHAVE = "despesas.react.visual";
export const visualPadrao: Visual = { modo: "auto", cor: "tostao" };

export function lerVisual(): Visual {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || "null") as Partial<Visual> | null;
    return {
      modo: v && MODOS.some(m => m.id === v.modo) ? (v.modo as Modo) : "auto",
      cor: v && CORES.some(c => c.id === v.cor) ? (v.cor as string) : "tostao",
    };
  } catch { return visualPadrao; }
}
export function guardarVisual(v: Visual) { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } }
export function aplicarVisual(v: Visual, el: HTMLElement = document.documentElement) {
  if (v.modo === "auto") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", v.modo);
  if (v.cor === "tostao") el.removeAttribute("data-accent"); else el.setAttribute("data-accent", v.cor);
}

export const nomeDe = (b: Backup): string => String(b.cfg.name || b.cfg.userName || "");
export const salvarNome = (b: Backup, nome: string): Backup => ({ ...b, cfg: { ...b.cfg, name: nome.trim().slice(0, 40) } });

// "Zerar lançamentos e saldo": apaga lançamentos, contas com saldo e transferências (que dependem delas).
// Cartões, euro/dólar, caixinhas, dívidas, pessoas e categorias ficam.
export const zerarLancamentos = (b: Backup): Backup => ({ ...b, items: [], cfg: { ...b.cfg, accts: [], transf: [] } });

const celula = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita fórmula ao abrir no Excel
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const valor = (c: number) => (c / 100).toFixed(2).replace(".", ",");
export function csvLancamentos(b: Backup): string {
  const linhas = [...b.items].sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : 0)).map(x => [
    x.date, x.type === "rec" ? "Receita" : "Despesa", x.desc, x.cat, valor(x.cents), x.pay, x.card || "", x.parc || "", x.paid ? "Pago" : "A pagar",
  ].map(celula).join(";"));
  return "﻿" + ["Data;Tipo;Descrição;Categoria;Valor;Pagamento;Cartão;Parcela;Situação", ...linhas].join("\r\n");
}

// ---------- Estatísticas (só contagens do que está guardado; nenhum valor é somado) ----------
export interface Stats {
  lancamentos: number; despesas: number; receitas: number; desde: string; meses: number;
  maior: { desc: string; cents: number; date: string } | null;
  contas: number; cartoes: number; caixinhas: number; dividas: number; pessoas: number; kb: number;
}
export function estatisticas(b: Backup): Stats {
  const it = (b.items || []) as { type?: string; desc?: string; cents?: number; date?: string; cat?: string }[];
  const L = it.filter(x => x && typeof x.date === "string" && typeof x.cents === "number");
  const arr = (k: string) => (Array.isArray(b.cfg[k]) ? (b.cfg[k] as unknown[]).length : 0);
  const datas = L.map(x => x.date as string).sort();
  let maior: Stats["maior"] = null;
  for (const x of L) if (x.type === "desp" && x.cat !== "cartao" && (!maior || (x.cents as number) > maior.cents)) maior = { desc: x.desc || "Sem nome", cents: x.cents as number, date: x.date as string };
  let kb = 0; try { kb = Math.ceil(JSON.stringify(b).length / 1024); } catch { /* ok */ }
  return {
    lancamentos: L.length, despesas: L.filter(x => x.type !== "rec").length, receitas: L.filter(x => x.type === "rec").length,
    desde: datas[0] || "", meses: new Set(datas.map(d => d.slice(0, 7))).size, maior,
    contas: arr("accts"), cartoes: b.cfg.cards && typeof b.cfg.cards === "object" ? Object.keys(b.cfg.cards as object).length : 0,
    caixinhas: arr("save"), dividas: arr("debts"), pessoas: arr("pp"), kb,
  };
}
