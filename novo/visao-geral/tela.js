const e = DEMO, ym = mesDe(e.hoje), pers = {};
const R = c => (c < 0 ? "−" : "") + "R$ " + (Math.abs(c) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"], MESL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const mLab = m => MESL[+m.slice(5) - 1] + " de " + m.slice(0, 4), dm = d => d.slice(8) + "/" + d.slice(5, 7);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cor = { Roxinho: "#6B3FA0", Lojinha: "#B3263E" };
const catDe = (k, t = "desp") => k === "_falta" ? { n: "Faturas sem itens lançados", c: "#8A8F98" } : categoria(t, k, pers);

const R_ = resumoMes(e, ym), cartoes = cartoesDeCredito(e);
// nota de saúde (a lógica atual: sobra, limite alto, atrasados, conta no vermelho)
let score = 100; const why = [];
if (R_.entrou > 0) { const p = R_.sobra / R_.entrou; if (R_.sobra < 0) { score -= 35; why.push("gastou mais do que entrou no mês"); } else if (p < .1) { score -= 15; why.push("sobra pequena"); } }
const altos = cartoes.filter(c => (limite(e, c) || {}).pct >= 80); if (altos.length) { score -= 15; why.push("limite alto em " + altos.length + " cartão"); }
const atras = proximosPagamentos(e, 0).filter(d => d.data < e.hoje); if (atras.length) { score -= 20; why.push(atras.length + " atrasado" + (atras.length > 1 ? "s" : "")); }
if (temConta(e) && naConta(e) < 0) { score -= 20; why.push("conta no vermelho"); }
const sl = score >= 80 ? "Muito boa" : score >= 60 ? "Boa" : score >= 40 ? "Atenção" : "Crítica", sc = score >= 80 ? "var(--pos)" : score >= 60 ? "var(--accent)" : score >= 40 ? "var(--warn)" : "var(--neg)";

// fluxo: 6 meses seguidos, até o seguinte
const ms = [-4, -3, -2, -1, 0, 1].map(d => somaMeses(ym, d)).map(m => ({ m, r: entrou(e, m), d: gastou(e, m) }));
const mx = Math.max(1, ...ms.flatMap(x => [x.r, x.d]));
const flux = `<div class="fl">${ms.map(x => `<div class="flc${x.m === ym ? " now" : ""}"><div class="flb"><i class="r" style="height:${x.r / mx * 100}%"></i><i class="d" style="height:${x.d / mx * 100}%"></i></div><small>${MES[+x.m.slice(5) - 1]}</small></div>`).join("")}</div>`;

// gastos: rosca com 5 maiores + outras
const gc = gastosPorCategoria(e, ym), tot = gc.reduce((s, x) => s + x.cents, 0);
const topc = gc.slice(0, 5).map(x => ({ ...x, ...catDe(x.k) })); const rest = tot - topc.reduce((s, x) => s + x.cents, 0); if (rest > 0) topc.push({ k: "_", cents: rest, n: "Outras categorias", c: "#8A8F98" });
let acc = 0; const r = 40, C = 2 * Math.PI * r;
const rosca = `<svg viewBox="0 0 100 100"><g transform="rotate(-90 50 50)">${topc.map(x => { const len = x.cents / tot * C, s = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${x.c}" stroke-width="14" stroke-dasharray="${Math.max(0, len - 1)} ${C}" stroke-dashoffset="${-acc}"/>`; acc += len; return s; }).join("")}</g></svg>`;
const gastosH = tot ? `<div class="dnw"><div class="dnb">${rosca}<div class="dnc"><small>Maior gasto</small><b>${(topc[0].cents / tot * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b><small>${esc(topc[0].n)}</small></div></div><div class="dleg">${topc.map(x => `<div><i style="background:${x.c}"></i><span>${esc(x.n)}</span><em>${R(x.cents)}</em></div>`).join("")}</div></div>` : `<small>Nada gasto ainda neste mês.</small>`;

// cartões: o primeiro cartão + faturas (anterior, atual, próxima) + últimas compras
const c0 = cartoes[0], fAtual = c0 ? mesFaturaAberta(e, c0) : null, lm = c0 && limite(e, c0);
const stFat = f => f.aberto === 0 && f.total >= 0 && (e.faturas || []).some(r => r.cartao === f.cartao && r.ym === f.ym && r.paga) ? ["paga", "Paga"] : f.vencida ? ["venc", "Vencida"] : f.ym === fAtual ? ["abre", "Aberta"] : ["", "Próxima"];
const fats = c0 ? [-1, 0, 1].map(d => fatura(e, c0, somaMeses(fAtual, d))) : [];
const compras = c0 ? e.lancamentos.filter(l => l.cartao === c0 && l.tipo === "desp").sort((a, b) => (b.compra || b.data).localeCompare(a.compra || a.data)).slice(0, 4) : [];
const cartaoH = !c0 ? `<small>Nenhum cartão ainda.</small>` : `<div class="dcard" style="--cc:${cor[c0] || "#334"}"><span class="nm">${esc(c0)}</span><span class="vl">${R(fatura(e, c0, fAtual).total)}</span><small>vence ${dm(fatura(e, c0, fAtual).vence)}${lm ? " · " + (lm.passou ? "passou " + R(lm.passou) : "livre " + R(lm.livre)) : ""}</small></div>
${lm ? `<span class="mini"><i style="width:${Math.min(100, lm.pct)}%"></i></span>` : ""}
<div class="dsub2">Faturas</div>${fats.map(f => { const [k, t] = stFat(f); return `<div class="dfr"><span>${MES[+f.ym.slice(5) - 1]} <em>vence ${dm(f.vence)}</em></span><b>${R(f.total)}</b><i class="st ${k}">${t}</i></div>`; }).join("")}
<div class="dsub2">Últimas compras</div>${compras.map(l => `<div class="dcr"><span>${esc(l.nome)}<br><em>${dm(l.compra || l.data)}</em></span><b>${R(l.cents)}</b></div>`).join("")}`;

// últimas transações
const ult = e.lancamentos.slice().sort((a, b) => (b.compra || b.caiu || b.data).localeCompare(a.compra || a.caiu || a.data) || b.id.localeCompare(a.id)).slice(0, 9);
const trans = ult.map(l => { const c = catDe(l.cat || SEM_CATEGORIA[l.tipo], l.tipo); return `<div class="dtr"><span class="ic" style="background:${c.c}">${esc(c.n[0])}</span><span class="dtn"><b>${esc(l.nome)}</b><small>${esc(c.n)}${partes(l).length ? " · ÷" + (partes(l).length + 1) + " sua parte " + R(suaParte(l)) : ""}${l.cartao ? " · " + esc(l.cartao) : ""}</small></span><div><span class="v ${l.tipo === "rec" ? "rec" : ""}">${l.tipo === "rec" ? "+" : "−"}${R(l.cents)}</span><small>${dm(l.compra || l.caiu || l.data)}</small></div></div>`; }).join("");

const hr = 12, nome = "Camila";
document.getElementById("pg").innerHTML = `
<div class="dtop"><button aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><div class="ola">Olá, ${nome}<small>quarta-feira, 4 de novembro</small></div><button aria-label="Buscar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg></button><button aria-label="Avisos"><svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4"/></svg></button></div>
<div class="dgrid">
<section class="db d-saldo"><h3>Na conta hoje <button class="dlink">Ver contas</button></h3><b class="dbig">${R(naConta(e))}</b><small class="dsub">${e.contas.length} conta ativa · fim do mês ${R(R_.fimDoMes)}${aReceber(e) ? " · a receber " + R(aReceber(e)) : ""}</small><div class="dqa"><button>+ Receita</button><button>− Despesa</button></div></section>
<section class="db d-res"><h3>Resumo do mês <small>${mLab(ym)}</small></h3><div class="drs"><div class="drc"><span>Entrou</span><b>${R(R_.entrou)}</b><small>${R_.entraAinda ? "falta receber " + R(R_.entraAinda) : "tudo recebido"}</small></div><div class="drc out"><span>Gastou</span><b>${R(R_.gastou)}</b><small>A pagar ${R(R_.aPagar)}</small></div><div class="drc sob"><span>Sobra</span><b class="${R_.sobra < 0 ? "neg" : ""}">${R(R_.sobra)}</b><small>${R_.entrou ? Math.round(R_.sobra / R_.entrou * 100) + "% do que entrou" : ""}</small></div></div></section>
<section class="db d-saude"><h3>Nota de saúde</h3><div class="dsc2"><b>${score}</b><span>/100</span><em class="dbadge" style="--bc:${sc}">${sl}</em></div><span class="dbar"><i style="width:${score}%;background:${sc}"></i></span>${why.length ? `<ul class="dwhy">${why.map(w => `<li>• ${w}</li>`).join("")}</ul>` : ""}</section>
<section class="db d-fluxo"><h3>Fluxo de caixa <span class="leg"><span><i style="background:var(--rcol)"></i>Entrou</span><span><i style="background:var(--dcol)"></i>Gastou</span></span></h3>${flux}</section>
<section class="db d-gastos"><h3>Gastos</h3>${gastosH}</section>
<section class="db d-cartoes"><h3>Cartões <button class="dlink">Ver cartões</button></h3>${cartaoH}</section>
<section class="db d-trans"><h3>Últimas transações <button class="dlink">Ver todas</button></h3><div class="lista">${trans}</div></section>
</div>`;
