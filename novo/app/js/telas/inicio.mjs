// Início: blocos da Visão geral. Cada número vem da base; aqui só se monta o HTML.
import { S } from "../store.mjs";
import * as B from "../../../base/calculo.mjs";
import { categoria, SEM_CATEGORIA } from "../../../base/categorias.mjs";
import { partes, suaParte } from "../../../base/pessoas.mjs";
import { ppSaldos } from "./outras.mjs";
import { mesDe, somaMeses } from "../../../base/datas.mjs";
import { R, MES, mLab, dm, dataLonga, e$ } from "../ui.mjs";

const catDe = (k, t = "desp") => k === "_falta" ? { n: "Faturas sem itens lançados", c: "#8A8F98" } : categoria(t, k, S.pers);
// tamanhos (largura × altura em quadrados) como na prévia: a grade encaixa tudo sozinha
const TAM = { saldo: [2, 2], resumo: [3, 2], saude: [1, 2], fluxo: [2, 4], gastos: [2, 6], cartoes: [2, 8], pagar: [1, 4], trans: [3, 4], pessoas: [1, 4] };
const ORDEM = ["saldo", "resumo", "saude", "fluxo", "gastos", "cartoes", "pagar", "trans", "pessoas"];

const aRec0 = () => ppSaldos().reduce((a, x) => a + Math.max(0, x.cents), 0);
export function desenharInicio() {
  const e = S.estado, ym = mesDe(e.hoje), r = B.resumoMes(e, ym), cartoes = B.cartoesDeCredito(e);
  let score = 100; const why = [];
  if (r.entrou > 0) { const p = r.sobra / r.entrou; if (r.sobra < 0) { score -= 35; why.push("gastou mais do que entrou no mês"); } else if (p < .1) { score -= 15; why.push("sobra pequena"); } }
  const altos = cartoes.filter(c => (B.limite(e, c) || {}).pct >= 80); if (altos.length) { score -= 15; why.push("limite alto em " + altos.length + " cartão"); }
  const atras = B.proximosPagamentos(e, 0).filter(d => d.data < e.hoje); if (atras.length) { score -= 20; why.push(atras.length + " atrasado" + (atras.length > 1 ? "s" : "")); }
  if (B.temConta(e) && B.naConta(e) < 0) { score -= 20; why.push("conta no vermelho"); }
  const sl = score >= 80 ? "Muito boa" : score >= 60 ? "Boa" : score >= 40 ? "Atenção" : "Crítica", sc = score >= 80 ? "var(--pos)" : score >= 60 ? "var(--accent)" : score >= 40 ? "var(--warn)" : "var(--neg)";

  const ms = [-4, -3, -2, -1, 0, 1].map(d => somaMeses(ym, d)).map(m => ({ m, r: B.entrou(e, m), d: B.gastou(e, m) }));
  const mx = Math.max(1, ...ms.flatMap(x => [x.r, x.d]));
  const flux = `<div class="fl">${ms.map(x => `<div class="flc${x.m === ym ? " now" : ""}"><div class="flb"><i class="r" style="height:${x.r / mx * 100}%"></i><i class="d" style="height:${x.d / mx * 100}%"></i></div><small>${MES[+x.m.slice(5) - 1]}</small></div>`).join("")}</div>`;

  const gc = B.gastosPorCategoria(e, ym), tot = gc.reduce((s, x) => s + x.cents, 0);
  const topc = gc.slice(0, 5).map(x => ({ ...x, ...catDe(x.k) })); const rest = tot - topc.reduce((s, x) => s + x.cents, 0); if (rest > 0) topc.push({ k: "_", cents: rest, n: "Outras categorias", c: "#8A8F98" });
  let acc = 0; const rr = 40, C = 2 * Math.PI * rr;
  const rosca = `<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-90 50 50)">${topc.map(x => { const len = x.cents / tot * C, s = `<circle cx="50" cy="50" r="${rr}" fill="none" stroke="${x.c}" stroke-width="14" stroke-dasharray="${Math.max(0, len - 1)} ${C}" stroke-dashoffset="${-acc}"/>`; acc += len; return s; }).join("")}</g></svg>`;
  const gastosH = tot ? `<div class="dnw"><div class="dnb">${rosca}<div class="dnc"><small>Maior gasto</small><b>${(topc[0].cents / tot * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b><small>${e$(topc[0].n)}</small></div></div><div class="dleg">${topc.map(x => `<div><i style="background:${x.c}"></i><span>${e$(x.n)}</span><em>${R(x.cents)}</em></div>`).join("")}</div></div>` : `<small>Nada gasto ainda neste mês.</small>`;

  const c0 = cartoes[0], fAtual = c0 ? B.mesFaturaAberta(e, c0) : null, lm = c0 && B.limite(e, c0);
  const stFat = f => (e.faturas || []).some(x => x.cartao === f.cartao && x.ym === f.ym && x.paga) && f.aberto === 0 ? ["paga", "Paga"] : f.vencida ? ["venc", "Vencida"] : f.ym === fAtual ? ["abre", "Aberta"] : ["", "Próxima"];
  const fats = c0 ? [-1, 0, 1].map(d => B.fatura(e, c0, somaMeses(fAtual, d))) : [];
  const compras = c0 ? e.lancamentos.filter(l => l.cartao === c0 && l.tipo === "desp").sort((a, b) => (b.compra || b.data).localeCompare(a.compra || a.data)).slice(0, 4) : [];
  const cartaoH = !c0 ? `<small>Nenhum cartão ainda.</small>` : `<a class="dcard" href="#/cartoes/${encodeURIComponent(c0)}" style="--cc:${cardColor(c0)};text-decoration:none">${dcLogo(c0)}<span class="nm">${e$(c0)}</span><span class="vl">${R(B.fatura(e, c0, fAtual).total)}</span><small>vence ${dm(B.fatura(e, c0, fAtual).vence)}${lm ? " · " + (lm.passou ? "passou " + R(lm.passou) : "livre " + R(lm.livre)) : ""}</small></a>
  ${lm ? `<span class="mini"><i style="width:${Math.min(100, lm.pct)}%"></i></span>` : ""}
  <div class="dsub2">Faturas</div>${fats.map(f => { const [k, t] = stFat(f); return `<div class="dfr"><span>${MES[+f.ym.slice(5) - 1]} <em>vence ${dm(f.vence)}</em></span><b>${R(f.total)}</b><i class="st ${k}">${t}</i></div>`; }).join("")}
  <div class="dsub2">Últimas compras</div>${compras.map(l => `<div class="dcr"><span>${e$(l.nome)}<br><em>${dm(l.compra || l.data)}</em></span><b>${R(l.cents)}</b></div>`).join("")}`;

  const ult = e.lancamentos.slice().sort((a, b) => (b.compra || b.caiu || b.data).localeCompare(a.compra || a.caiu || a.data) || String(b.id).localeCompare(String(a.id))).slice(0, 9);
  const trans = ult.map(l => { const c = catDe(l.cat || SEM_CATEGORIA[l.tipo], l.tipo); return `<button class="dtr lin" data-act="editar" data-id="${e$(l.id)}"><span class="ic" style="background:${c.c}">${e$(c.n[0])}</span><span class="dtn"><b>${e$(l.nome)}</b><small>${e$(c.n)}${partes(l).length ? " · ÷" + (partes(l).length + 1) + " sua parte " + R(suaParte(l)) : ""}${l.cartao ? " · " + e$(l.cartao) : ""}</small></span><div><span class="v ${l.tipo === "rec" ? "rec" : ""}">${l.tipo === "rec" ? "+" : "−"}${R(l.cents)}</span><small>${dm(l.compra || l.caiu || l.data)}</small></div></button>`; }).join("");

  const W = {};
  W.saldo = `<h3>Na conta hoje <a class="dlink" href="#/contas">Ver contas</a></h3><b class="dbig">${R(B.naConta(e))}</b><small class="dsub">${e.contas.length} conta${e.contas.length === 1 ? "" : "s"} · fim do mês ${R(r.fimDoMes)}${aRec0() ? " · a receber " + R(aRec0()) : ""}</small><div class="dqa"><button data-act="novo" data-t="rec">+ Receita</button><button data-act="novo" data-t="desp">− Despesa</button></div>`;
  W.resumo = `<h3>Resumo do mês <small>${mLab(ym)}</small></h3><div class="drs"><div class="drc"><span>Entrou</span><b>${R(r.entrou)}</b><small>${r.entraAinda ? "falta receber " + R(r.entraAinda) : "tudo recebido"}</small></div><div class="drc out"><span>Gastou</span><b>${R(r.gastou)}</b><small>A pagar ${R(r.aPagar)}</small></div><div class="drc sob"><span>Sobra</span><b class="${r.sobra < 0 ? "neg" : ""}">${R(r.sobra)}</b><small>${r.entrou ? Math.round(r.sobra / r.entrou * 100) + "% do que entrou" : ""}</small></div></div>`;
  W.saude = `<h3>Nota de saúde</h3><div class="dsc2"><b>${score}</b><span>/100</span><em class="dbadge" style="--bc:${sc}">${sl}</em></div><span class="dbar"><i style="width:${score}%;background:${sc}"></i></span>${why.length ? `<ul class="dwhy">${why.map(w => `<li>• ${w}</li>`).join("")}</ul>` : ""}`;
  W.fluxo = `<h3>Fluxo de caixa <span class="leg"><span><i style="background:var(--rcol)"></i>Entrou</span><span><i style="background:var(--dcol)"></i>Gastou</span></span></h3>${flux}`;
  W.gastos = `<h3>Gastos</h3>${gastosH}`;
  W.cartoes = `<h3>Cartões <a class="dlink" href="#/cartoes">Ver cartões</a></h3>${cartaoH}`;
  W.trans = `<h3>Últimas transações <a class="dlink" href="#/mes">Ver todas</a></h3><div class="lista">${trans || "<small>Nenhum lançamento ainda.</small>"}</div>`;
  const pg = B.proximosPagamentos(e, 10);
  W.pagar = `<h3>Vence em 10 dias <span class="dim">${R(pg.reduce((s, d) => s + d.cents, 0))}</span></h3><div class="lista1">${pg.length ? pg.map(d => `<div class="dfr"><span>${e$(d.nome)}<br><em class="${d.data < e.hoje ? "neg" : ""}">${d.data < e.hoje ? "atrasado · " : ""}${dm(d.data)}</em></span><b>${R(d.cents)}</b></div>`).join("") : "<small>Nada vence nos próximos 10 dias.</small>"}</div>`;
  const ps = ppSaldos(), aRec = ps.reduce((a, x) => a + Math.max(0, x.cents), 0);
  W.pessoas = `<h3>Pessoas <a class="dlink" href="#/pessoas">Ver</a></h3><div class="lista1">${ps.length ? ps.map(x => `<div class="dfr"><span>${e$(x.pessoa)}<br><em>${x.cents > 0 ? "te deve" : x.cents < 0 ? "você deve" : "quitado"}</em></span><b class="${x.cents < 0 ? "neg" : ""}">${R(Math.abs(x.cents))}</b></div>`).join("") : "<small>Ninguém te deve nada.</small>"}</div>`;
  const nome = S.raw.cfg.name || S.raw.cfg.userName || "";
  return `<div class="pg"><div class="dtop"><div class="ola">Olá${nome ? ", " + e$(nome) : ""}<small>${dataLonga(e.hoje)}</small></div></div>
  <div class="dgrid" id="grade">${ORDEM.map(id => `<section class="db d-${id}" data-w="${id}" style="--w:${TAM[id][0]};--h:${TAM[id][1]}">${W[id]}</section>`).join("")}</div></div>`;
}
