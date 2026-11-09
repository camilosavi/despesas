// Tela Você: aparência (modo e cor), nome, backup e "zerar". Tudo puro (sem tela), para testar.
import type { Backup } from "./loja";

export type Modo = "auto" | "light" | "dark";
export interface Visual { modo: Modo; cor: string; livre?: string }
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
      cor: v && (v.cor === "livre" ? hexOk(v.livre) : CORES.some(c => c.id === v.cor)) ? (v.cor as string) : "tostao",
      ...(v && v.cor === "livre" && hexOk(v.livre) ? { livre: v.livre!.toLowerCase() } : {}),
    };
  } catch { return visualPadrao; }
}
export function guardarVisual(v: Visual) { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } }
export function aplicarVisual(v: Visual, el: HTMLElement = document.documentElement) {
  if (v.modo === "auto") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", v.modo);
  if (v.cor === "tostao") el.removeAttribute("data-accent"); else el.setAttribute("data-accent", v.cor);
  const st = el.ownerDocument.getElementById("thLivre");
  if (v.cor === "livre" && v.livre) {
    const t = st || el.ownerDocument.head.appendChild(Object.assign(el.ownerDocument.createElement("style"), { id: "thLivre" }));
    t.textContent = livreCss(v.livre);
  } else st?.remove();
}

// ---------- cor livre (hex) e cor da foto ----------
export const hexOk = (h?: string): boolean => typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h);
const rgb = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const hex = (c: number[]) => "#" + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
const mist = (h: string, alvo: number, t: number) => hex(rgb(h).map(x => x + (alvo - x) * t));
export const lum = (h: string) => { const [r, g, b] = rgb(h).map(x => { const v = x / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contraste = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** escurece/clareia até o texto (branco ou quase preto) ter contraste ≥ 4,5:1 sobre o destaque */
function destaque(h: string, claro: boolean): { accent: string; on: string } {
  let a = h;
  for (let i = 0; i < 40; i++) {
    const on = claro ? "#ffffff" : "#0d1119";
    if (contraste(a, on) >= 4.5) return { accent: a, on };
    a = claro ? mist(a, 0, 0.08) : mist(a, 255, 0.08);
  }
  return claro ? { accent: "#000000", on: "#ffffff" } : { accent: "#ffffff", on: "#0d1119" };
}
export function livreCss(h: string): string {
  const L = destaque(h, true), D = destaque(h, false);
  const claro = `--head:${mist(h, 0, 0.45)};--accent:${L.accent};--on-accent:${L.on};--focus:${L.accent}`;
  const escuro = `--head:${mist(h, 0, 0.7)};--accent:${D.accent};--on-accent:${D.on};--focus:${D.accent}`;
  return `:root[data-accent="livre"]{${claro}}\n:root:not([data-theme="light"])[data-accent="livre"]{${escuro}}\n:root[data-theme="dark"][data-accent="livre"]{${escuro}}`;
}
/** cor dominante (média das cores vivas) de uma lista de pixels RGBA */
export function corDominante(px: ArrayLike<number>): string {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 3 < px.length; i += 4) {
    if (px[i + 3] < 200) continue;
    const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]);
    if (mx < 40 || mn > 225 || mx - mn < 25) continue; // ignora preto, branco e cinza
    r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
  }
  return n ? hex([r / n, g / n, b / n]) : "";
}

// ---------- foto (só neste aparelho, fora do backup) ----------
const CH_FOTO = "despesas.react.foto";
export const fotoLer = (): string => { try { return localStorage.getItem(CH_FOTO) || ""; } catch { return ""; } };
export const fotoGuardar = (d: string) => { try { if (d) localStorage.setItem(CH_FOTO, d); else localStorage.removeItem(CH_FOTO); } catch { /* sem armazenamento */ } };
/** recorta em quadrado 320 px (JPEG) */
export async function fotoPreparar(f: File): Promise<{ url: string; cor: string }> {
  const bmp = await createImageBitmap(f), lado = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas"); c.width = c.height = 320;
  const g = c.getContext("2d")!; g.drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 320, 320);
  return { url: c.toDataURL("image/jpeg", 0.82), cor: corDominante(g.getImageData(0, 0, 320, 320).data) };
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
