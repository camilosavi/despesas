// Painel Lançar / editar. Grava no formato do app atual (desc, cents, date, type, cat, pay, card, acct, paid, parc, group).
import { S, salvarItem, salvarItens, apagarItens } from "../store.mjs";
import { lista, SEM_CATEGORIA } from "../../../base/categorias.mjs";
import { cartoesDeCredito } from "../../../base/calculo.mjs";
import { somaMeses, ultimoDia, pad, mesDe } from "../../../base/datas.mjs";
import { abrirFolha, fecharFolha, e$, $, paraCentavos, deCentavos, aviso } from "../ui.mjs";
import { dataDaFatura, salShift, FORMAS } from "../regras.mjs";

const cfgAtual = () => S.raw.cfg;
let F = null; // rascunho aberto
const raw = id => S.raw.items[id];
const semCartao = x => (x.card && (x.desc || "").startsWith(x.card + " · ") ? x.desc.slice(x.card.length + 3) : x.desc || "");

export function abrirLancar(opc = {}) {
  const x = opc.id ? raw(opc.id) : null;
  F = { id: x ? x.id : null, tipo: x ? x.type : opc.tipo || "desp", cartao: x ? (x.card || "") : opc.cartao || "", pay: x ? x.pay : opc.cartao ? "Crédito" : "Pix", orig: x };
  desenharForm(x);
}
const cartoes = () => [...new Set([...Object.keys(cfgAtual().cards || {}).filter(n => (cfgAtual().cards[n] || {}).kind !== "ben"), ...cartoesDeCredito(S.estado)])];
const contas = () => (cfgAtual().accts || []).filter(a => !a.cur || a.cur === "BRL").map(a => a.name);
function desenharForm(x) {
  const t = F.tipo, pers = S.pers, cats = lista(t, pers), editando = !!x;
  const credito = F.pay === "Crédito", cs = cartoes(), ct = contas();
  const serie = x && x.group && x.parc;
  abrirFolha(editando ? "Editar lançamento" : "Novo lançamento", `<form class="form" id="fl" novalidate>
  <div class="seg" role="group" aria-label="Tipo" style="justify-self:start"><button type="button" data-act="l-tipo" data-t="desp" aria-pressed="${t === "desp"}">Despesa</button><button type="button" data-act="l-tipo" data-t="rec" aria-pressed="${t === "rec"}">Receita</button></div>
  <label class="f">Valor<input id="l-v" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${x ? deCentavos(x.cents) : ""}" style="font-size:1.5rem;font-weight:700"></label>
  <label class="f">Descrição<input id="l-d" maxlength="80" autocomplete="off" value="${e$(x ? semCartao(x) : "")}"></label>
  <div class="dois"><label class="f">${credito ? "Data da compra" : "Data"}<input id="l-dt" type="date" value="${x ? (x.buy || x.date) : S.hoje}"></label>
  <label class="f">Categoria<select id="l-c">${cats.map(c => `<option value="${c.k}" ${(x ? x.cat : SEM_CATEGORIA[t]) === c.k ? "selected" : ""}>${e$(c.n)}</option>`).join("")}</select></label></div>
  ${t === "desp" ? `<div class="dois"><label class="f">Forma<select id="l-p" data-act-change="l-pay">${FORMAS.map(p => `<option ${F.pay === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
  ${credito ? `<label class="f">Cartão<select id="l-k">${cs.map(c => `<option ${F.cartao === c ? "selected" : ""}>${e$(c)}</option>`).join("")}</select></label>` : ct.length > 1 ? `<label class="f">Conta<select id="l-a"><option value="">Principal</option>${ct.map(c => `<option ${x && x.acct === c ? "selected" : ""}>${e$(c)}</option>`).join("")}</select></label>` : "<span></span>"}</div>` : ct.length > 1 ? `<label class="f">Entra na conta<select id="l-a"><option value="">Principal</option>${ct.map(c => `<option ${x && x.acct === c ? "selected" : ""}>${e$(c)}</option>`).join("")}</select></label>` : ""}
  ${!editando && t === "desp" ? `<div class="dois"><label class="f">Parcelas<select id="l-n">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map(n => `<option value="${n}">${n === 1 ? "À vista / uma vez" : n + "x"}</option>`).join("")}</select></label>
  <label class="f">Repetir todo mês<select id="l-r"><option value="0">Não</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label></div>` : ""}
  ${t === "desp" && !credito ? `<label class="f" style="grid-template-columns:auto 1fr;align-items:center;gap:.6em"><input id="l-pg" type="checkbox" style="width:auto;min-height:0" ${!x || x.paid !== false ? "checked" : ""}> Já foi pago</label>` : ""}
  ${serie ? `<label class="f">Ao salvar<select id="l-ser"><option value="one">Alterar só esta parcela</option><option value="all">Alterar esta e as seguintes</option></select></label>` : ""}
  <div id="l-err" class="msg" role="alert" hidden></div>
  <div style="display:flex;gap:.6em;flex-wrap:wrap"><button class="btn" type="submit" style="flex:1">Salvar</button>${editando ? `<button type="button" class="btn neg" data-act="l-apagar">Excluir</button>` : ""}</div>
  </form>`);
}
const erro = m => { const e = $("#l-err"); e.textContent = m; e.hidden = false; };
function lerForm() {
  const t = F.tipo, v = paraCentavos($("#l-v").value);
  if (!v || v <= 0) return erro("Informe o valor."), null;
  const desc = $("#l-d").value.trim().slice(0, 80); if (!desc) return erro("Informe a descrição."), null;
  const dt = $("#l-dt").value; if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) return erro("Escolha a data."), null;
  return { t, v, desc, dt, cat: $("#l-c").value, pay: t === "desp" ? $("#l-p").value : "Pix", cartao: $("#l-k") ? $("#l-k").value : "", acct: $("#l-a") ? $("#l-a").value : "", pago: $("#l-pg") ? $("#l-pg").checked : true };
}
export async function salvarForm() {
  const f = lerForm(); if (!f) return;
  const cfg = cfgAtual(), cr = f.t === "desp" && f.pay === "Crédito" && f.cartao;
  if (f.t === "desp" && f.pay === "Crédito" && !f.cartao) return erro("Escolha o cartão (ou cadastre um na aba Cartões).");
  const base = (dt, extra = {}) => {
    const data = cr ? dataDaFatura(cfg, f.cartao, dt) : dt, sh = f.t === "rec" ? salShift(f.cat, data) : null;
    const it = { type: f.t, desc: cr ? `${f.cartao} · ${f.desc}` : f.desc, cat: f.cat, cents: f.v, date: sh ? sh.date : data, pay: f.pay, ...extra };
    if (sh) it.fell = sh.fell; if (cr) { it.card = f.cartao; if (data !== dt) it.buy = dt; } if (f.acct) it.acct = f.acct;
    if (f.t === "desp") { it.paid = cr ? false : f.pago; if (it.paid && !cr) it.paidAt = Date.now(); }
    return it;
  };
  try {
    if (F.id) {
      const o = raw(F.id), ser = $("#l-ser") ? $("#l-ser").value : "one";
      const novo = { ...o, ...base(f.dt), id: o.id, createdAt: o.createdAt, group: o.group, parc: o.parc };
      if (!cr) { delete novo.card; delete novo.buy; } if (!f.acct) delete novo.acct; if (o.fell && f.t !== "rec") delete novo.fell;
      const lote = [novo];
      if (ser === "all" && o.group) for (const y of Object.values(S.raw.items)) if (y.group === o.group && y.id !== o.id && (y.date || "") > (o.date || "")) lote.push({ ...y, desc: novo.desc, cat: novo.cat, cents: novo.cents, pay: novo.pay, ...(cr ? { card: f.cartao } : {}) });
      await salvarItens(lote);
    } else {
      const n = f.t === "desp" ? +($("#l-n") || { value: 1 }).value : 1, r = +($("#l-r") || { value: 0 }).value, qtd = n > 1 ? n : r > 1 ? r : 1;
      const grupo = qtd > 1 ? "g" + Date.now().toString(36) : "";
      const lote = [];
      for (let i = 0; i < qtd; i++) {
        const dt = i ? somaDiaMes(f.dt, i) : f.dt;
        const it = base(dt); if (grupo) { it.group = grupo; if (n > 1) it.parc = `${i + 1}/${n}`; }
        if (i && f.t === "desp" && !cr) it.paid = false, delete it.paidAt;
        lote.push(it);
      }
      await salvarItens(lote);
    }
    fecharFolha(); aviso("Salvo");
  } catch (e) { erro("Não consegui salvar. Tente de novo."); }
}
function somaDiaMes(d, n) { const ym = somaMeses(mesDe(d), n), dia = +d.slice(8); return `${ym}-${pad(Math.min(dia, ultimoDia(ym)))}`; }
export const acoesLancar = {
  "l-tipo": a => { const x = F.orig; F.tipo = a.dataset.t; desenharForm(x && x.type === F.tipo ? x : null); },
  "l-apagar": async () => { if (!F.id) return; const b = $('[data-act="l-apagar"]'); if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Toque de novo para excluir"; return; } await apagarItens([F.id]); fecharFolha(); aviso("Excluído"); },
};
export const mudancaLancar = { "l-pay": s => { F.pay = s.value; const x = F.orig; const guard = { desc: $("#l-d").value, v: $("#l-v").value, dt: $("#l-dt").value, c: $("#l-c").value }; desenharForm(x); $("#l-d").value = guard.desc; $("#l-v").value = guard.v; $("#l-dt").value = guard.dt; $("#l-c").value = guard.c; if (!F.cartao && F.pay === "Crédito" && $("#l-k")) F.cartao = $("#l-k").value; } };
