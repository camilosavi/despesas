// Contas: saldo de cada conta (informado + o que mexeu depois), extrato e cadastro.
import { S, salvarCfg } from "../store.mjs";
import * as B from "../../../base/calculo.mjs";
import { categoria, SEM_CATEGORIA } from "../../../base/categorias.mjs";
import { R, dm, e$, $, abrirFolha, fecharFolha, aviso, paraCentavos, deCentavos } from "../ui.mjs";

const accts = () => (S.raw.cfg.accts || []).map(a => ({ ...a }));
export const V = { sel: "" };
export function desenharContas() {
  const e = S.estado, L = e.contas, tem = B.temConta(e);
  const sel = L.find(a => a.nome === V.sel) || L[0];
  const mov = sel ? e.lancamentos.filter(l => B.contaDe(e, l) === sel.nome && l.data <= e.hoje && (l.tipo === "rec" || l.pago !== false) && !(l.cartao) && !l.saldoAnterior)
    .sort((a, b) => (b.caiu || b.pagoEm && 0 || b.data).localeCompare(a.caiu || a.data) || String(b.id).localeCompare(String(a.id))).slice(0, 80) : [];
  const ajs = sel ? (e.ajustes || []).filter(x => x.conta === sel.nome && x.em >= (sel.em || 0)) : [];
  return `<div class="tit"><h1>Contas</h1><button class="btn" data-act="ct-nova">+ Conta</button></div>
  <div class="kpis"><div class="kpi"><span>Na conta hoje</span><b>${R(tem ? B.naConta(e) : 0)}</b><small>${L.length} conta${L.length === 1 ? "" : "s"}</small></div><div class="kpi"><span>Fim do mês</span><b>${tem ? R(B.fimDoMes(e, e.hoje.slice(0, 7))) : "—"}</b><small>depois de tudo que entra e sai</small></div></div>
  ${L.length ? `<div class="cols"><div class="card"><h2>Suas contas</h2>${L.map(a => `<div class="lin" role="button" tabindex="0" data-act="ct-sel" data-n="${e$(a.nome)}" style="${sel && sel.nome === a.nome ? "background:color-mix(in srgb,var(--accent) 14%,transparent)" : ""}"><span class="mid"><b>${e$(a.nome)}</b><small>informado ${R(a.cents)} em ${dm(new Date(a.em).toISOString().slice(0, 10))}</small></span><span class="v">${R(B.saldoDaConta(e, a.nome))}</span></div>`).join("")}
  ${sel ? `<div style="display:flex;gap:.6em;margin-top:.8em"><button class="btn ghost" data-act="ct-edit" data-n="${e$(sel.nome)}">Atualizar saldo</button></div>` : ""}</div>
  <div class="card"><h2>Movimentos de ${e$(sel.nome)}</h2>${mov.length ? mov.map(l => { const c = categoria(l.tipo, l.cat || SEM_CATEGORIA[l.tipo], S.pers); return `<div class="lin" role="button" tabindex="0" data-act="editar" data-id="${e$(l.id)}"><span class="ic" style="background:${c.c}">${e$(c.n[0])}</span><span class="mid"><b>${e$(l.nome)}</b><small>${dm(l.caiu || l.data)} · ${e$(c.n)}</small></span><span class="v ${l.tipo === "rec" ? "rec" : ""}">${l.tipo === "rec" ? "+" : "−"}${R(l.cents)}</span></div>`; }).join("") : `<div class="vazio">Nenhum movimento.</div>`}${ajs.length ? `<small style="color:var(--muted)">${ajs.length} transferência${ajs.length > 1 ? "s" : ""}/caixinha${ajs.length > 1 ? "s" : ""} depois do saldo informado.</small>` : ""}</div></div>` : `<div class="card vazio">Nenhuma conta cadastrada.<br>Cadastre o saldo que aparece no banco para ver "Na conta hoje" e "Fim do mês".<br><button class="btn" style="margin-top:1em" data-act="ct-nova">+ Conta</button></div>`}`;
}
function form(nome) {
  const a = nome ? accts().find(x => x.name === nome) : null;
  abrirFolha(a ? "Atualizar saldo" : "Nova conta", `<form class="form" data-form="ct-salvar" data-orig="${e$(nome || "")}">
  <label class="f">Nome da conta<input id="ct-n" maxlength="30" value="${e$(nome || "")}" ${a ? "readonly" : ""} placeholder="Ex.: Inter"></label>
  <label class="f">Saldo que aparece no banco agora (R$)<input id="ct-v" inputmode="decimal" value="${a ? deCentavos(a.cents) : ""}"></label>
  <div id="ct-err" class="msg" hidden></div><button class="btn" type="submit">Salvar</button>${a ? `<button type="button" class="btn neg" data-act="ct-apagar" data-n="${e$(nome)}">Excluir conta</button>` : ""}</form>`);
}
export const acoesContas = {
  "ct-nova": () => form(null), "ct-edit": a => form(a.dataset.n), "ct-sel": a => { V.sel = a.dataset.n; },
  "ct-apagar": async a => { if (!a.dataset.s) { a.dataset.s = 1; a.textContent = "Toque de novo para excluir"; return; } try { await salvarCfg("accts", accts().filter(x => x.name !== a.dataset.n)); fecharFolha(); } catch (e) { aviso("Não consegui salvar", true); } },
};
export const formsContas = {
  "ct-salvar": async f => {
    const err = m => { const x = $("#ct-err"); x.textContent = m; x.hidden = false; };
    const n = $("#ct-n").value.trim(), v = paraCentavos($("#ct-v").value); if (!n) return err("Dê um nome à conta."); if (v == null) return err("Informe o saldo.");
    const L = accts(), orig = f.dataset.orig, agora = Date.now(), hoje = S.hoje;
    if (!orig && L.some(a => a.name === n)) return err("Já existe uma conta com esse nome.");
    const i = L.findIndex(a => a.name === n); const reg = { ...(i >= 0 ? L[i] : { id: "a" + agora.toString(36) }), name: n, cents: v, at: hoje, atTs: agora };
    if (i >= 0) L[i] = reg; else L.push(reg);
    try { await salvarCfg("accts", L); fecharFolha(); aviso("Conta salva"); } catch (e) { err("Não consegui salvar."); }
  },
};
