// Cor das categorias e categorias padrão escondidas: só neste aparelho (não há tabela nem sync novo).
import { createStore } from "./createStore";
import { lsJson, lsSet } from "./storage";

const KEY = "despesas.zero.cats";
export const CAT_PALETTE = ["#E8645A", "#F0A04B", "#E5C34B", "#6DBE6B", "#3FB8A5", "#4FA3E0", "#6F7BE0", "#A66FD6", "#E070A8", "#9A8C7A"];
const FIXED: Record<string, string> = { // as cores do app antigo
  Alimentação: "#12A57E", Mercado: "#E08A1E", Transporte: "#2E9BAA", "Casa e contas": "#2E9BAA", Lazer: "#B5487F", Esporte: "#12A57E", Saúde: "#D9534F",
  Compras: "#7A5CC7", Educação: "#3D7BD9", Assinaturas: "#B5487F", "Faturas de cartão": "#D9534F", Outros: "#8A8F8C",
  Salário: "#12A57E", Rendimentos: "#3D7BD9", Divisões: "#2E9BAA", "Saldo anterior": "#8A8F8C", "Outras receitas": "#8A8F8C",
};
interface Prefs { hide: string[]; color: Record<string, string> }
const load = (): Prefs => { const v = lsJson<Partial<Prefs>>(KEY, {}); return { hide: Array.isArray(v.hide) ? v.hide : [], color: v.color && typeof v.color === "object" ? v.color : {} }; };
export const catPrefs = createStore<Prefs>(load());
const save = () => lsSet(KEY, JSON.stringify(catPrefs.get()));

const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
/** cor da categoria: a que ele escolheu, a da fixa, ou uma da paleta pelo nome (sempre a mesma) */
export const catColor = (c: string, p: Prefs = catPrefs.get()) => (c ? p.color[c] || FIXED[c] || CAT_PALETTE[hash(c) % CAT_PALETTE.length] : "var(--muted)");
export const setCatColor = (c: string, col: string) => { catPrefs.set(s => ({ color: { ...s.color, [c]: col } })); save(); };
export const isHidden = (c: string) => c !== "Outros" && c !== "Outras receitas" && catPrefs.get().hide.includes(c);
export const toggleHide = (c: string) => { catPrefs.set(s => ({ hide: s.hide.includes(c) ? s.hide.filter(x => x !== c) : [...s.hide, c] })); save(); };
/** renomeou categoria própria: a cor vai junto */
export const moveCatColor = (from: string, to: string) => { const col = catPrefs.get().color[from]; if (!col) return; catPrefs.set(s => { const c = { ...s.color }; delete c[from]; if (to) c[to] = col; return { color: c }; }); save(); };
