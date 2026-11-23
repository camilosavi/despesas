// Estado do app: linhas do Supabase → backup (formato do app atual) → `estado` da base. Tela nenhuma calcula: chama a base.
import * as sb from "./sb.mjs";
import { normalizarBackup, deAppAtual } from "../../base/importar.mjs";
import { pad } from "../../base/datas.mjs";

export const S = { linhas: [], raw: { items: {}, fx: {}, cfg: {}, prefs: {} }, estado: null, resumo: null, pers: {}, hoje: "", carregando: false, erro: "", pend: 0 };
const ouvintes = new Set();
export const aoMudar = f => { ouvintes.add(f); return () => ouvintes.delete(f); };
const avisar = () => ouvintes.forEach(f => f());
export const hojeLocal = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };

export function montar(rows) {
  const raw = { items: {}, fx: {}, cfg: {}, prefs: {} };
  for (const r of rows) { const v = r.data && "v" in r.data ? r.data.v : r.data; if (r.kind === "i") raw.items[r.id] = v; else if (r.kind === "f") raw.fx[r.id] = v; else if (r.kind === "c") raw.cfg[r.id] = v; else if (r.kind === "p") raw.prefs[r.id] = v; }
  S.raw = raw; recalcular();
}
export function recalcular() {
  S.hoje = hojeLocal();
  const b = { items: Object.values(S.raw.items), fx: Object.values(S.raw.fx), cfg: S.raw.cfg };
  const { estado, resumo } = deAppAtual(b, S.hoje);
  S.estado = estado; S.resumo = resumo; S.pers = estado.pers;
  // as marcas (logos e cores dos bancos) leem este objeto global
  if (typeof cfg !== "undefined") cfg.cards = S.raw.cfg.cards || {};
  avisar();
}
export async function carregar() {
  S.carregando = true; S.erro = ""; avisar();
  try { await sb.completarSessao(); S.linhas = await sb.lerTudo(); montar(S.linhas); }
  catch (e) { S.erro = e.status === 404 || /sync_rows/.test(e.message) ? "A tabela de sincronização não existe neste projeto." : e.message || "Não consegui carregar."; }
  S.carregando = false; avisar();
}
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const envia = async f => { S.pend++; avisar(); try { await f(); S.erro = ""; } catch (e) { S.erro = "Não consegui salvar: " + (e.message || "erro"); throw e; } finally { S.pend--; avisar(); } };

// grava no mesmo formato do app atual (item com desc/cents/date/type/cat...), então os dois apps leem a mesma conta
export async function salvarItem(it) {
  const x = { ...it, id: it.id || novoId() };
  if (!x.createdAt) x.createdAt = Date.now();
  S.raw.items[x.id] = x; recalcular();
  await envia(() => sb.gravar("i", { [x.id]: x }));
  return x;
}
export async function salvarItens(lista) {
  const o = {}; for (const it of lista) { const x = { ...it, id: it.id || novoId() }; if (!x.createdAt) x.createdAt = Date.now(); o[x.id] = x; S.raw.items[x.id] = x; }
  recalcular(); await envia(() => sb.gravar("i", o));
}
export async function apagarItens(ids) {
  for (const id of ids) delete S.raw.items[id]; recalcular();
  const lap = Object.fromEntries(ids.map(id => [id, Date.now()]));
  await envia(async () => { await sb.gravar("d", lap); await sb.apagar("i", ids); });
}
export async function salvarCfg(chave, valor) {
  S.raw.cfg[chave] = valor; recalcular();
  await envia(() => sb.gravar("c", { [chave]: valor }));
}
export async function salvarMoeda(m) { const x = { ...m, id: m.id || novoId() }; S.raw.fx[x.id] = x; recalcular(); await envia(() => sb.gravar("f", { [x.id]: x })); }
export async function apagarMoeda(id) { delete S.raw.fx[id]; recalcular(); await envia(async () => { await sb.gravar("d", { [id]: Date.now() }); await sb.apagar("f", [id]); }); }
export const backupJson = () => ({ app: "minhas-despesas", v: 1, items: Object.values(S.raw.items), fx: Object.values(S.raw.fx), cfg: S.raw.cfg });
export { normalizarBackup };
