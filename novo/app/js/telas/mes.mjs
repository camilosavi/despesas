// Mês: seletor, resumo, lista por dia, filtros e busca. Compra de cartão não entra na lista: o cartão vira UMA linha "Fatura X".
import { S, salvarItens } from "../store.mjs";
import * as B from "../../../base/calculo.mjs";
import { categoria, lista, SEM_CATEGORIA } from "../../../base/categorias.mjs";
import { mesDe, somaMeses } from "../../../base/datas.mjs";
import { R, mLab, dm, e$, aviso } from "../ui.mjs";

export const V = { ym: "", filtro: "todos", cat: "", q: "" };
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const catDe = (k, t) => categoria(t, k || SEM_CATEGORIA[t], S.pers);
export function desenharMes() {
  const e = S.estado; if (!V.ym) V.ym = mesDe(e.hoje); const ym = V.ym, r = B.resumoMes(e, ym);
  // linhas: lançamentos fora de cartão + uma linha por fatura
  let L = e.lancamentos.filter(l => !l.cartao && !l.saldoAnterior && mesDe(l.data) === ym && !(l.pagoCom && (e.cartoes[l.pagoCom] || {}).tipo === "beneficio"))
    .map(l => ({ t: "l", id: l.id, data: l.caiu || l.compra || l.data, nome: l.nome, cat: l.cat, tipo: l.tipo, cents: l.cents, pago: l.tipo === "rec" ? true : l.pago !== false, sub: [catDe(l.cat, l.tipo).n, l.parc ? "" : ""].filter(Boolean).join(" · ") }));
  for (const c of B.cartoesDeCredito(e)) {
    const f = B.fatura(e, c, ym); if (!f.total) continue;
    const reg = (e.faturas || []).find(x => x.cartao === c && x.ym === ym), paga = !!(reg && reg.paga) || f.aberto === 0;
    L.push({ t: "f", c, data: f.vence, nome: "Fatura " + c, tipo: "desp", cents: f.total, pago: paga, vencida: f.vencida && !paga, sub: f.itens.length + " itens" + (f.falta ? " · falta lançar " + R(f.falta) : "") });
  }
  const q = norm(V.q);
  if (V.filtro === "apagar") L = L.filter(x => x.tipo === "desp" && !x.pago);
  else if (V.filtro === "pagos") L = L.filter(x => x.tipo === "desp" && x.pago);
  else if (V.filtro === "receitas") L = L.filter(x => x.tipo === "rec");
  if (V.cat) L = L.filter(x => x.cat === V.cat);
  if (q) L = L.filter(x => norm(x.nome + " " + (x.sub || "") + " " + (x.cat ? catDe(x.cat, x.tipo).n : "")).includes(q));
  L.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));
  const dias = {}; for (const x of L) (dias[x.data] ||= []).push(x);
  const cats = [...lista("desp", S.pers), ...lista("rec", S.pers)];
  const linhas = Object.keys(dias).sort().reverse().map(d => {
    const tot = dias[d].reduce((s, x) => s + (x.tipo === "rec" ? x.cents : -x.cents), 0);
    return `<div class="dia"><span>${dm(d)}</span><span>${R(tot)}</span></div>${dias[d].map(x => {
      const c = x.t === "l" ? catDe(x.cat, x.tipo) : { n: "Cartão", c: cardColor(x.c) };
      const abre = x.t === "l" ? `data-act="editar" data-id="${e$(x.id)}"` : `data-act="ir-cartao" data-c="${e$(x.c)}" data-ym="${ym}"`;
      return `<div class="lin" role="button" tabindex="0" ${abre}>${x.tipo === "desp" && x.t === "l" ? `<button class="pg2 ${x.pago ? "on" : ""}" data-act="pagar" data-id="${e$(x.id)}" aria-label="${x.pago ? "Marcar como a pagar" : "Marcar como pago"}" aria-pressed="${x.pago}">${x.pago ? "✓" : ""}</button>` : `<span class="ic" style="background:${c.c}">${e$(c.n[0])}</span>`}<span class="mid"><b>${e$(x.nome)}</b><small>${e$(x.sub || c.n)}${x.vencida ? " · atrasada" : ""}${x.t === "f" ? (x.pago ? " · paga ✓" : "") : ""}</small></span><span class="v ${x.tipo === "rec" ? "rec" : ""}">${x.tipo === "rec" ? "+" : "−"}${R(x.cents)}</span></div>`;
    }).join("")}`;
  }).join("");
  return `<div class="tit"><h1>Mês</h1><div class="mesw"><button data-act="mes" data-n="-1" aria-label="Mês anterior">‹</button><b>${mLab(ym)}</b><button data-act="mes" data-n="1" aria-label="Próximo mês">›</button></div><button class="btn" data-act="novo" data-t="desp">+ Lançar</button></div>
  <div class="kpis"><div class="kpi"><span>Entrou</span><b>${R(r.entrou)}</b><small>${r.entraAinda ? "falta receber " + R(r.entraAinda) : "tudo recebido"}</small></div><div class="kpi"><span>Gastou</span><b>${R(r.gastou)}</b><small>pago ${R(r.pago)}</small></div><div class="kpi"><span>A pagar</span><b>${R(r.aPagar)}</b><small>ainda vai sair da conta</small></div><div class="kpi"><span>Sobra</span><b class="${r.sobra < 0 ? "neg" : ""}">${R(r.sobra)}</b><small>${r.fimDoMes != null ? "fim do mês " + R(r.fimDoMes) : ""}</small></div></div>
  <div class="card"><div style="display:flex;gap:.8em;flex-wrap:wrap;align-items:center;margin-bottom:.6em"><div class="seg" role="group" aria-label="Filtro">${[["todos", "Todos"], ["apagar", "A pagar"], ["pagos", "Pagos"], ["receitas", "Receitas"]].map(([k, t]) => `<button data-act="filtro" data-k="${k}" aria-pressed="${V.filtro === k}">${t}</button>`).join("")}</div>
  <select id="m-cat" data-chg="m-cat" style="width:auto;min-width:11em" aria-label="Categoria"><option value="">Todas as categorias</option>${cats.map(c => `<option value="${c.k}" ${V.cat === c.k ? "selected" : ""}>${e$(c.n)}</option>`).join("")}</select>
  <input id="m-q" type="search" placeholder="Buscar" value="${e$(V.q)}" style="width:12em;margin-left:auto" aria-label="Buscar"></div>
  ${linhas || `<div class="vazio">${q || V.cat || V.filtro !== "todos" ? "Nada com esse filtro." : "Nada lançado neste mês."}<br><button class="btn" style="margin-top:1em" data-act="novo" data-t="desp">+ Lançar</button></div>`}</div>`;
}
export const acoesMes = {
  mes: a => { V.ym = somaMeses(V.ym, +a.dataset.n); },
  filtro: a => { V.filtro = a.dataset.k; },
  pagar: async (a, ev) => {
    ev.stopPropagation(); const it = S.raw.items[a.dataset.id]; if (!it) return;
    const pago = it.paid !== false; const novo = { ...it, paid: !pago };
    if (!pago) novo.paidAt = Date.now(); else delete novo.paidAt;
    try { await salvarItens([novo]); } catch (e) { aviso("Não consegui salvar", true); }
  },
};
