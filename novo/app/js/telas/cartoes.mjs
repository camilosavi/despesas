// Cartões: lista e tela do cartão (cartão grande com logo, ciclo, itens da fatura, valor do banco, limite, pagar).
import { S, salvarItens, salvarCfg } from "../store.mjs";
import * as B from "../../../base/calculo.mjs";
import { mesDe, somaMeses, pad, ultimoDia } from "../../../base/datas.mjs";
import { fechamentoDe } from "../regras.mjs";
import { R, mLab, mCurto, dm, e$, $, abrirFolha, fecharFolha, aviso, paraCentavos, deCentavos } from "../ui.mjs";

const cfgCards = () => ({ ...(S.raw.cfg.cards || {}) });
export const V = { ym: "" };
const todos = () => [...new Set([...B.cartoesDeCredito(S.estado), ...Object.keys(cfgCards()).filter(n => cfgCards()[n].kind !== "ben")])];
const hero = (c, ym) => {
  const e = S.estado, f = B.fatura(e, c, ym), lm = B.limite(e, c);
  return `<div class="dcard" style="--cc:${cardColor(c)}">${dcLogo(c)}<span class="nm">${e$(c)}</span><span class="vl">${R(f.total)}</span><small>vence ${dm(f.vence)}${lm ? " · " + (lm.passou ? "passou " + R(lm.passou) : "livre " + R(lm.livre)) : ""}</small></div>${lm ? `<span class="mini" style="max-width:26em"><i style="width:${Math.min(100, lm.pct)}%"></i></span>` : ""}`;
};
export function desenharCartoes(c) {
  const e = S.estado;
  if (c && todos().includes(c)) return detalhe(c);
  const L = todos();
  return `<div class="tit"><h1>Cartões</h1><button class="btn" data-act="c-novo">+ Novo cartão</button></div>
  ${L.length ? `<div class="cols">${L.map(n => { const ym = B.mesFaturaAberta(e, n), f = B.fatura(e, n, ym), lm = B.limite(e, n);
    return `<a class="card" href="#/cartoes/${encodeURIComponent(n)}" style="text-decoration:none;color:inherit;display:block"><div class="heroc" style="margin:0">${hero(n, ym)}</div><div class="dfr" style="margin-top:.8em"><span>Fatura de ${mCurto(ym)}<br><em>vence ${dm(f.vence)} · ${f.itens.length} itens</em></span><b>${R(f.total)}</b></div></a>`; }).join("")}</div>`
  : `<div class="card vazio">Nenhum cartão ainda.<br><button class="btn" style="margin-top:1em" data-act="c-novo">+ Novo cartão</button></div>`}`;
}
function detalhe(c) {
  const e = S.estado; if (!V.ym || V.c !== c) { V.ym = B.mesFaturaAberta(e, c); V.c = c; }
  const ym = V.ym, f = B.fatura(e, c, ym), lm = B.limite(e, c), k = cfgCards()[c] || {};
  const reg = (e.faturas || []).find(x => x.cartao === c && x.ym === ym), paga = !!(reg && reg.paga) || (f.aberto === 0 && f.total > 0);
  const fech = k.due ? fechamentoDe(S.raw.cfg, c, +k.due, f.vence) : null;
  const pct = fech ? Math.max(0, Math.min(100, (Date.parse(e.hoje) - Date.parse(somaDiasStr(fech, -30))) / (Date.parse(f.vence) - Date.parse(somaDiasStr(fech, -30))) * 100)) : 0;
  const itens = [...f.itens, ...f.rolados].sort((a, b) => (b.compra || b.data).localeCompare(a.compra || a.data));
  const prox = [1, 2, 3].map(n => B.fatura(e, c, somaMeses(ym, n)));
  return `<div class="tit"><a class="btn ghost" href="#/cartoes" style="text-decoration:none">‹ Cartões</a><h1>${e$(c)}</h1><div class="mesw"><button data-act="c-mes" data-n="-1" aria-label="Fatura anterior">‹</button><b>${mCurto(ym)}</b><button data-act="c-mes" data-n="1" aria-label="Próxima fatura">›</button></div><button class="btn" data-act="novo" data-t="desp" data-c="${e$(c)}">+ Compra</button></div>
  <div class="cols" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,24em),1fr))"><div>
   <div class="card"><div class="heroc" style="margin:0">${hero(c, ym)}</div>
    <div class="ciclo"><span>${fech ? "Fecha <b>" + dm(fech) + "</b>" : "Sem fechamento"}</span><span>Vence <b>${dm(f.vence)}</b></span></div><div class="barra"><i style="width:${pct}%"></i></div>
    <button class="btn ${paga ? "ghost" : ""}" style="width:100%;margin-top:1em" data-act="c-paga" data-ym="${ym}" ${f.total ? "" : "disabled"}>${paga ? "Fatura paga ✓ (toque para desfazer)" : "Marcar fatura de " + mCurto(ym) + " como paga"}</button></div>
   <div class="card"><h2>Fatura de ${mLab(ym)}</h2>
    <div class="dfr"><span>Lançado nos itens</span><b>${R(f.lancado)}</b></div>${f.doAnterior ? `<div class="dfr"><span>Veio da fatura anterior</span><b>${R(f.doAnterior)}</b></div>` : ""}
    <div class="dfr"><span>Valor do banco</span><b>${f.banco != null ? R(f.banco) : "—"}</b></div>
    ${f.falta ? `<div class="dfr"><span class="neg">Falta lançar</span><b class="neg">${R(f.falta)}</b></div>` : f.banco != null ? `<div class="dfr"><span class="pos">Bate com o banco ✓</span><b></b></div>` : ""}
    <form class="form" data-form="c-banco" style="margin-top:.8em"><label class="f">Valor da fatura no banco<input id="c-vb" inputmode="decimal" placeholder="0,00" value="${f.banco != null ? deCentavos(f.banco) : ""}"></label><button class="btn ghost" type="submit">Salvar valor do banco</button></form></div>
  </div><div>
   <div class="card"><h2>Itens da fatura <span class="dim">${itens.length}</span></h2>${itens.length ? itens.map(l => `<div class="lin" role="button" tabindex="0" data-act="editar" data-id="${e$(l.id)}"><span class="mid"><b>${e$(l.nome)}</b><small>${dm(l.compra || l.data)}${l.parc ? " · parcela " + e$(l.parc) : ""}${l.data !== f.vence ? " · veio de " + mCurto(mesDe(l.data)) : ""}</small></span><span class="v">${R(l.cents)}</span></div>`).join("") : `<div class="vazio">Nenhum item lançado nesta fatura.</div>`}</div>
   <div class="card"><h2>Limite <button class="dlink" data-act="c-editar" data-c="${e$(c)}">Editar cartão</button></h2>${lm ? `<div class="dfr"><span>Limite</span><b>${R(lm.limite)}</b></div><div class="dfr"><span>Usado</span><b>${R(lm.usado)}</b></div><div class="dfr"><span>${lm.passou ? "Passou do limite" : "Livre"}</span><b class="${lm.passou ? "neg" : "pos"}">${R(lm.passou || lm.livre)}</b></div><span class="mini" style="max-width:none"><i style="width:${Math.min(100, lm.pct)}%"></i></span>${lm.doBanco ? `<small style="color:var(--muted)">Livre informado pelo banco, com o que mexeu depois.</small>` : ""}` : `<small>Sem limite cadastrado.</small>`}</div>
   <div class="card"><h2>Próximas faturas</h2>${prox.map(p => `<button class="lin" data-act="c-mes-ir" data-ym="${p.ym}"><span class="mid"><b>${mLab(p.ym)}</b><small>vence ${dm(p.vence)}</small></span><span class="v">${R(p.total)}</span></button>`).join("")}</div>
  </div></div>`;
}
const somaDiasStr = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

function formCartao(nome) {
  const k = nome ? cfgCards()[nome] || {} : {};
  abrirFolha(nome ? "Editar cartão" : "Novo cartão", `<form class="form" data-form="c-salvar" data-orig="${e$(nome || "")}">
  ${nome ? "" : `<div class="chips" role="group" aria-label="Bancos">${BANK_PICK.concat(["Renner"]).map(b => `<button type="button" data-act="c-pick" data-n="${e$(b)}">${e$(b)}</button>`).join("")}</div>`}
  <label class="f">Nome<input id="ck-n" maxlength="30" value="${e$(nome || "")}" ${nome ? "readonly" : ""}></label>
  <div class="dois"><label class="f">Dia do vencimento<input id="ck-d" inputmode="numeric" maxlength="2" value="${k.due || ""}"></label><label class="f">Dia do fechamento<input id="ck-f" inputmode="numeric" maxlength="2" value="${k.close || ""}"></label></div>
  <label class="f">Limite (R$)<input id="ck-l" inputmode="decimal" value="${k.limit ? deCentavos(k.limit) : ""}"></label>
  <label class="f">Livre informado pelo banco (R$, opcional)<input id="ck-b" inputmode="decimal" value="${k.bankFree != null ? deCentavos(k.bankFree) : ""}"></label>
  <div id="ck-err" class="msg" hidden></div><button class="btn" type="submit">Salvar</button></form>`);
}
const dia = v => { const n = parseInt(v, 10); return n >= 1 && n <= 31 ? n : 0; };
export const acoesCartoes = {
  "c-novo": () => formCartao(null), "c-editar": a => formCartao(a.dataset.c),
  "c-pick": a => { $("#ck-n").value = a.dataset.n; },
  "c-mes": a => { V.ym = somaMeses(V.ym, +a.dataset.n); }, "c-mes-ir": a => { V.ym = a.dataset.ym; },
  "c-paga": async a => {
    const c = V.c, ym = a.dataset.ym, f = B.fatura(S.estado, c, ym);
    const regs = Object.values(S.raw.items).filter(x => x.type !== "rec" && (x.card === c || (x.desc || "").startsWith(c + " · ")) && mesDe(x.date) === ym);
    const desfaz = f.aberto === 0 && f.total > 0, agora = Date.now();
    const lote = regs.map(x => { const n = { ...x, paid: !desfaz }; if (desfaz) delete n.paidAt; else n.paidAt = agora; return n; });
    if (!lote.length) return aviso("Não há itens lançados nesta fatura. Salve o valor do banco primeiro.", true);
    try { await salvarItens(lote); aviso(desfaz ? "Fatura reaberta" : "Fatura marcada como paga"); } catch (e) { aviso("Não consegui salvar", true); }
  },
};
export const formsCartoes = {
  "c-banco": async () => {
    const c = V.c, ym = V.ym, v = paraCentavos($("#c-vb").value); if (v == null || v < 0) return aviso("Informe o valor.", true);
    const venc = B.fatura(S.estado, c, ym).vence;
    const ex = Object.values(S.raw.items).find(x => x.cat === "cartao" && x.card === c && mesDe(x.date) === ym && /Fatura /i.test(x.desc || ""));
    const it = ex ? { ...ex, cents: v } : { type: "desp", desc: `${c} · Fatura ${c}`, cat: "cartao", cents: v, date: venc, pay: "Crédito", card: c, paid: false };
    try { await salvarItens([it]); aviso("Valor do banco salvo"); } catch (e) { aviso("Não consegui salvar", true); }
  },
  "c-salvar": async f => {
    const err = m => { const x = $("#ck-err"); x.textContent = m; x.hidden = false; };
    const nome = $("#ck-n").value.trim(); if (!nome) return err("Dê um nome ao cartão.");
    const cards = cfgCards(), orig = f.dataset.orig; if (!orig && cards[nome]) return err("Já existe um cartão com esse nome.");
    const k = { ...(cards[nome] || {}) }, d = dia($("#ck-d").value), fe = dia($("#ck-f").value), lim = paraCentavos($("#ck-l").value), bf = paraCentavos($("#ck-b").value);
    if (d) k.due = d; else delete k.due; if (fe) k.close = fe; else delete k.close; if (lim) k.limit = lim; else delete k.limit;
    if (bf != null) { if (bf !== k.bankFree) { k.bankFree = bf; k.bankAt = S.hoje; k.bankAtTs = Date.now(); } } else { delete k.bankFree; delete k.bankAt; delete k.bankAtTs; }
    cards[nome] = k;
    try { await salvarCfg("cards", cards); fecharFolha(); aviso("Cartão salvo"); location.hash = "#/cartoes/" + encodeURIComponent(nome); } catch (e) { err("Não consegui salvar."); }
  },
};
