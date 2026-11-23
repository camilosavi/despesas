// Você: conta, aparência, categorias, backup. Open Finance e leitores de PDF entram copiados do app atual na próxima etapa.
import { S, salvarCfg, backupJson, carregar } from "../store.mjs";
import * as sb from "../sb.mjs";
import { criar, remover, lista, MAX_PERSONALIZADAS } from "../../../base/categorias.mjs";
import { e$, $, aviso, abrirFolha, fecharFolha } from "../ui.mjs";

export const tema = () => { try { return localStorage.getItem("tostao.tema") || "auto"; } catch (e) { return "auto"; } };
export function aplicarTema() { const t = tema(), h = document.documentElement; if (t === "auto") h.removeAttribute("data-theme"); else h.dataset.theme = t; }
export function desenharVoce() {
  const s = sb.sessao() || {}, pers = S.pers, t = tema();
  const catsLinha = tp => lista(tp, pers).map(c => `<span class="chips" style="display:inline-flex"><button type="button" ${c.personalizada ? `data-act="v-cat-del" data-t="${tp}" data-k="${e$(c.k)}" title="Toque para remover"` : "disabled"} style="border-left:.7em solid ${c.c}">${e$(c.n)}${c.personalizada ? " ✕" : ""}</button></span>`).join(" ");
  return `<div class="tit"><h1>Você</h1></div>
  <div class="cols"><div class="card"><h2>Conta</h2><div class="dfr"><span>E-mail</span><b>${e$(s.email || "")}</b></div><div class="dfr"><span>Dados carregados</span><b>${S.resumo ? S.resumo.lancamentos + " lançamentos · " + S.resumo.faturas + " faturas" : "—"}</b></div>
   <div style="display:flex;gap:.6em;flex-wrap:wrap;margin-top:.8em"><button class="btn ghost" data-act="v-recarregar">Recarregar da nuvem</button><button class="btn neg" data-act="v-sair">Sair</button></div></div>
  <div class="card"><h2>Aparência</h2><div class="seg" role="group" aria-label="Tema">${[["auto", "Automático"], ["light", "Claro"], ["dark", "Escuro"]].map(([k, n]) => `<button data-act="v-tema" data-t="${k}" aria-pressed="${t === k}">${n}</button>`).join("")}</div></div>
  <div class="card"><h2>Categorias de despesa</h2><div class="chips">${catsLinha("desp")}</div><form class="form" data-form="v-cat" data-t="desp" style="margin-top:.8em"><div class="dois"><label class="f">Nova categoria<input name="n" maxlength="24"></label><label class="f">Cor<input name="c" type="color" value="#6c7bd9" style="padding:.2em"></label></div><button class="btn ghost" type="submit">Adicionar (${(pers.desp || []).length}/${MAX_PERSONALIZADAS})</button></form></div>
  <div class="card"><h2>Categorias de receita</h2><div class="chips">${catsLinha("rec")}</div><form class="form" data-form="v-cat" data-t="rec" style="margin-top:.8em"><div class="dois"><label class="f">Nova categoria<input name="n" maxlength="24"></label><label class="f">Cor<input name="c" type="color" value="#2f8f9d" style="padding:.2em"></label></div><button class="btn ghost" type="submit">Adicionar (${(pers.rec || []).length}/${MAX_PERSONALIZADAS})</button></form></div>
  <div class="card"><h2>Backup</h2><p style="margin:0 0 .8em;font-size:.88rem;color:var(--muted)">Baixa um arquivo com todos os seus lançamentos e ajustes (o mesmo formato do app atual).</p><button class="btn ghost" data-act="v-backup">Baixar backup (JSON)</button></div>
  <div class="card"><h2>Ainda no app atual</h2><p style="margin:0;font-size:.88rem;color:var(--muted)">Importar fatura, extrato, holerite e print, e o Open Finance, continuam no app atual por enquanto. Entram aqui na próxima etapa.</p></div></div>`;
}
export const acoesVoce = {
  "v-tema": a => { try { localStorage.setItem("tostao.tema", a.dataset.t); } catch (e) {} aplicarTema(); },
  "v-recarregar": async () => { await carregar(); aviso(S.erro || "Dados atualizados", !!S.erro); },
  "v-sair": async a => { if (!a.dataset.s) { a.dataset.s = 1; a.textContent = "Toque de novo para sair"; return; } await sb.sair(); location.hash = ""; location.reload(); },
  "v-backup": () => { const b = new Blob([JSON.stringify(backupJson())], { type: "application/json" }), u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = "backup-" + S.hoje + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); },
  "v-cat-del": async a => { const r = remover(S.pers, a.dataset.t, a.dataset.k); if (!r.ok) return aviso(r.erro, true); await grava(a.dataset.t, r.pers); },
};
async function grava(tp, pers) {
  const chave = tp === "rec" ? "catsRec" : "cats";
  try { await salvarCfg(chave, (pers[tp] || []).map(c => ({ k: c.k, n: c.n, c: c.c }))); } catch (e) { aviso("Não consegui salvar", true); }
}
export const formsVoce = {
  "v-cat": async f => { const n = f.elements.n.value.trim(); if (!n) return aviso("Dê um nome.", true); const r = criar(S.pers, f.dataset.t, n, f.elements.c.value); if (!r.ok) return aviso(r.erro, true); await grava(f.dataset.t, r.pers); f.reset(); },
};
