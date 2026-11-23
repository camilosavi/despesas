// Planejar, Orçamento, Pessoas, Caixinhas, Moedas.
import { S, salvarCfg, salvarMoeda, apagarMoeda } from "../store.mjs";
import * as B from "../../../base/calculo.mjs";
import { categoria, lista } from "../../../base/categorias.mjs";
import { somaMeses, mesDe } from "../../../base/datas.mjs";
import { R, mLab, mCurto, dm, e$, $, abrirFolha, fecharFolha, aviso, paraCentavos, deCentavos } from "../ui.mjs";

const reler = () => 0;
// ---------- Planejar ----------
export function desenharPlanejar() {
  const e = S.estado, ym = mesDe(e.hoje), M = [0, 1, 2, 3, 4, 5].map(n => somaMeses(ym, n));
  const subs = {}; for (const l of e.lancamentos) if (l.recorrente && l.tipo === "desp" && l.data >= e.hoje.slice(0, 7)) { const k = l.nome.toLowerCase(); if (!subs[k] || l.data > subs[k].data) subs[k] = l; }
  const sl = Object.values(subs).sort((a, b) => b.cents - a.cents), tot = sl.reduce((s, x) => s + x.cents, 0);
  return `<div class="tit"><h1>Planejar</h1></div>
  <div class="card"><h2>Próximos meses</h2><table class="tb"><thead><tr><th>Mês</th><th>Entra</th><th>Sai</th><th>Na conta no fim</th></tr></thead><tbody>${M.map(m => `<tr><td>${mCurto(m)}</td><td>${R(m === ym ? B.entraAinda(e, m) : B.entrou(e, m))}</td><td>${R(B.aPagar(e, m))}</td><td><b>${R(B.fimDoMes(e, m))}</b></td></tr>`).join("")}</tbody></table><small style="color:var(--muted)">No mês atual, "Entra" é o que ainda vai cair e "Sai" o que ainda falta pagar.</small></div>
  <div class="card"><h2>Assinaturas e contas fixas <span class="dim">${R(tot)}/mês</span></h2>${sl.length ? sl.map(l => `<div class="lin" role="button" tabindex="0" data-act="editar" data-id="${e$(l.id)}"><span class="mid"><b>${e$(l.nome)}</b><small>${l.cartao ? e$(l.cartao) + " · " : ""}próxima ${dm(l.data)}</small></span><span class="v">${R(l.cents)}</span></div>`).join("") : `<div class="vazio">Nenhuma repetição mensal encontrada.</div>`}</div>`;
}
// ---------- Orçamento ----------
export function desenharOrcamento() {
  const e = S.estado, ym = mesDe(e.hoje), B_ = S.raw.cfg.budgets || {}, gasto = Object.fromEntries(B.gastosPorCategoria(e, ym).map(x => [x.k, x.cents]));
  const L = lista("desp", S.pers).filter(c => c.k !== "outros" || B_.outros || gasto.outros);
  return `<div class="tit"><h1>Orçamento</h1><span class="dim">${mLab(ym)}</span></div>
  <div class="card"><h2>Limite por categoria</h2>${L.map(c => { const g = gasto[c.k] || 0, lim = B_[c.k] || 0, p = lim ? g / lim * 100 : 0;
    return `<form class="lin" data-form="o-salvar" data-k="${c.k}" style="cursor:default;flex-wrap:wrap"><span class="ic" style="background:${c.c}">${e$(c.n[0])}</span><span class="mid"><b>${e$(c.n)}</b><small>gastou ${R(g)}${lim ? " de " + R(lim) : ""}</small>${lim ? `<span class="barra ${p > 100 ? "estou" : ""}" style="margin-top:.4em"><i style="width:${Math.min(100, p)}%"></i></span>` : ""}</span><input name="v" inputmode="decimal" placeholder="Limite" value="${lim ? deCentavos(lim) : ""}" style="width:8em" aria-label="Limite de ${e$(c.n)}"><button class="btn ghost" type="submit">Salvar</button></form>`; }).join("")}</div>`;
}
// ---------- Pessoas (conta corrente por pessoa: cfg.pp) ----------
const pps = () => (S.raw.cfg.pp || []).map(p => ({ ...p, e: (p.e || []).map(x => ({ ...x })) }));
export const ppBal = p => (p.e || []).reduce((s, x) => s + (x.c || 0), 0);
export const ppSaldos = () => (S.raw.cfg.pp || []).map(p => ({ pessoa: p.name, cents: ppBal(p) })).filter(x => x.cents).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
export const V = { pid: "" };
export function desenharPessoas() {
  const L = pps(), rec = L.reduce((s, p) => s + Math.max(0, ppBal(p)), 0), dev = L.reduce((s, p) => s + Math.max(0, -ppBal(p)), 0);
  return `<div class="tit"><h1>Pessoas</h1><button class="btn" data-act="p-nova">+ Pessoa</button></div>
  <div class="kpis"><div class="kpi"><span>A receber</span><b class="pos">${R(rec)}</b></div><div class="kpi"><span>A pagar</span><b class="${dev ? "neg" : ""}">${R(dev)}</b></div></div>
  <div class="card">${L.length ? L.slice().sort((a, b) => Math.abs(ppBal(b)) - Math.abs(ppBal(a))).map(p => { const b = ppBal(p); return `<div class="lin" role="button" tabindex="0" data-act="p-abrir" data-id="${e$(p.id)}"><span class="av" style="background:hsl(${[...p.name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360} 45% 42%)">${e$((p.name[0] || "?").toUpperCase())}</span><span class="mid"><b>${e$(p.name)}</b><small>${b > 0 ? "te deve" : b < 0 ? "você deve" : "quitado ✓"}</small></span><span class="v ${b < 0 ? "neg" : ""}">${R(Math.abs(b))}</span></div>`; }).join("") : `<div class="vazio">Ninguém ainda. Crie uma pessoa para controlar quem te deve e quem você deve.</div>`}</div>`;
}
function folhaPessoa(id) {
  const p = pps().find(x => x.id === id); if (!p) return; V.pid = id; const b = ppBal(p);
  const ext = p.e.slice().sort((a, c) => (c.d || "").localeCompare(a.d || ""));
  abrirFolha(p.name, `<div><b style="font-size:1.6rem" class="${b < 0 ? "neg" : ""}">${R(Math.abs(b))}</b><div style="color:var(--muted)">${b > 0 ? "te deve" : b < 0 ? "você deve" : "quitado ✓"}</div></div>
  ${b > 0 ? `<a class="btn ghost" style="text-decoration:none" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(`Oi ${p.name}, tudo bem? Estamos com ${R(b)} em aberto. Quando puder me passa por Pix, por favor.`)}">Cobrar no WhatsApp</a>` : ""}
  <form class="form" data-form="p-lanca"><div class="seg" role="group" aria-label="Tipo"><select id="pl-k"><option value="d1">Ela me deve</option><option value="d2">Eu devo a ela</option><option value="p1">Ela me pagou</option><option value="p2">Eu paguei a ela</option></select></div>
  <div class="dois"><label class="f">Valor<input id="pl-v" inputmode="decimal" placeholder="0,00"></label><label class="f">Data<input id="pl-d" type="date" value="${S.hoje}"></label></div><label class="f">Descrição<input id="pl-t" maxlength="60"></label><div id="pl-err" class="msg" hidden></div><button class="btn" type="submit">Lançar</button></form>
  <div><h2 style="font-size:.8rem;color:var(--muted)">Extrato</h2>${ext.length ? ext.map(x => `<div class="lin" style="cursor:default"><span class="mid"><b>${e$(x.t || (x.k === "p" ? "Pagamento" : "Cobrança"))}</b><small>${dm(x.d || "")} · ${x.k === "p" ? "pagamento" : "cobrança"}</small></span><span class="v ${x.c < 0 ? "neg" : "rec"}">${x.c > 0 ? "+" : "−"}${R(Math.abs(x.c))}</span><button class="fx" data-act="p-del" data-e="${e$(x.id)}" aria-label="Excluir">✕</button></div>`).join("") : "<small>Nada lançado.</small>"}</div>
  <button class="btn neg" data-act="p-apagar" data-id="${e$(id)}">Excluir pessoa</button>`);
}
const gravaPP = async L => { try { await salvarCfg("pp", L); return true; } catch (e) { aviso("Não consegui salvar", true); return false; } };
const idN = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const acoesOutras = {
  "p-nova": () => abrirFolha("Nova pessoa", `<form class="form" data-form="p-criar"><label class="f">Nome<input id="pn" maxlength="40" autocomplete="off"></label><div id="pn-err" class="msg" hidden></div><button class="btn" type="submit">Criar</button></form>`),
  "p-abrir": a => folhaPessoa(a.dataset.id),
  "p-del": async a => { const L = pps(), p = L.find(x => x.id === V.pid); p.e = p.e.filter(x => x.id !== a.dataset.e); if (await gravaPP(L)) folhaPessoa(V.pid); },
  "p-apagar": async a => { if (!a.dataset.s) { a.dataset.s = 1; a.textContent = "Toque de novo para excluir"; return; } if (await gravaPP(pps().filter(x => x.id !== a.dataset.id))) fecharFolha(); },
  "s-nova": () => formCaixinha(), "s-abrir": a => formMov(a.dataset.id), "s-apagar": async a => { if (!a.dataset.s) { a.dataset.s = 1; a.textContent = "Toque de novo para excluir"; return; } try { await salvarCfg("save", (S.raw.cfg.save || []).filter(b => b.id !== a.dataset.id)); fecharFolha(); } catch (e) { aviso("Não consegui salvar", true); } },
  "f-nova": () => formMoeda(), "f-del": async a => { if (!a.dataset.s) { a.dataset.s = 1; a.textContent = "Toque de novo"; return; } try { await apagarMoeda(a.dataset.id); fecharFolha(); } catch (e) { aviso("Não consegui salvar", true); } },
  "f-moeda": a => { fxCur = a.dataset.m; }, "f-cot": () => cotar(true),
};
export const formsOutras = {
  "o-salvar": async f => { const v = paraCentavos(f.elements.v.value), b = { ...(S.raw.cfg.budgets || {}) }; if (v > 0) b[f.dataset.k] = v; else delete b[f.dataset.k]; try { await salvarCfg("budgets", b); aviso("Limite salvo"); } catch (e) { aviso("Não consegui salvar", true); } },
  "p-criar": async () => { const n = $("#pn").value.trim(); if (!n) { const x = $("#pn-err"); x.textContent = "Dê um nome."; x.hidden = false; return; } const L = pps(); if (L.some(p => p.name.toLowerCase() === n.toLowerCase())) { const x = $("#pn-err"); x.textContent = "Já existe."; x.hidden = false; return; } const p = { id: idN(), name: n, e: [] }; L.push(p); if (await gravaPP(L)) folhaPessoa(p.id); },
  "p-lanca": async () => {
    const err = m => { const x = $("#pl-err"); x.textContent = m; x.hidden = false; }, v = paraCentavos($("#pl-v").value), d = $("#pl-d").value, k = $("#pl-k").value; if (!v || v <= 0) return err("Informe o valor."); if (!d) return err("Escolha a data.");
    const L = pps(), p = L.find(x => x.id === V.pid), sinal = { d1: 1, d2: -1, p1: -1, p2: 1 }[k];
    p.e.push({ id: idN(), d, c: sinal * v, k: k[0] === "p" ? "p" : "d", ...($("#pl-t").value.trim() ? { t: $("#pl-t").value.trim().slice(0, 60) } : {}) });
    if (await gravaPP(L)) folhaPessoa(V.pid);
  },
  "s-criar": async () => {
    const n = $("#sn").value.trim(), g = paraCentavos($("#sg").value), cur = $("#sc").value; if (!n) { const x = $("#sn-err"); x.textContent = "Dê um nome."; x.hidden = false; return; }
    const L = [...(S.raw.cfg.save || [])]; L.push({ id: idN(), name: n, ...(g ? { goal: g } : {}), goalCur: cur, moves: [] });
    try { await salvarCfg("save", L); fecharFolha(); aviso("Caixinha criada"); } catch (e) { aviso("Não consegui salvar", true); }
  },
  "s-mov": async f => {
    const err = m => { const x = $("#sm-err"); x.textContent = m; x.hidden = false; }, v = paraCentavos($("#sm-v").value), d = $("#sm-d").value, sin = $("#sm-t").value === "tira" ? -1 : 1; if (!v || v <= 0) return err("Informe o valor.");
    const L = (S.raw.cfg.save || []).map(b => ({ ...b, moves: [...(b.moves || [])] })), b = L.find(x => x.id === f.dataset.id);
    b.moves.push({ id: idN(), date: d, cents: sin * v, ...(b.goalCur && b.goalCur !== "BRL" ? { cur: b.goalCur } : {}) });
    try { await salvarCfg("save", L); formMov(b.id); } catch (e) { err("Não consegui salvar."); }
  },
  "f-salvar": async () => {
    const err = m => { const x = $("#fm-err"); x.textContent = m; x.hidden = false; }, cur = $("#fm-c").value, q = paraCentavos($("#fm-q").value), brl = paraCentavos($("#fm-b").value), d = $("#fm-d").value; if (!q || !brl || q <= 0 || brl <= 0) return err("Informe o valor recebido e o quanto pagou em R$.");
    const m = cur === "USD" ? { cur: "USD", usd: q, brl, date: d, where: $("#fm-o").value.trim().slice(0, 40) } : { eur: q, brl, date: d, where: $("#fm-o").value.trim().slice(0, 40) };
    try { await salvarMoeda(m); fecharFolha(); aviso("Compra salva"); } catch (e) { err("Não consegui salvar."); }
  },
};
// ---------- Caixinhas ----------
const MO = { BRL: "R$", EUR: "€", USD: "US$" };
const fmtM = (c, cur) => cur === "BRL" || !cur ? R(c) : (c < 0 ? "−" : "") + MO[cur] + " " + (Math.abs(c) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const temNaCaixa = b => { const o = {}; for (const m of b.moves || []) o[m.cur || "BRL"] = (o[m.cur || "BRL"] || 0) + m.cents; return o; };
export function desenharCaixinhas() {
  const L = S.raw.cfg.save || [];
  return `<div class="tit"><h1>Caixinhas</h1><button class="btn" data-act="s-nova">+ Caixinha</button></div>
  ${L.length ? `<div class="cols">${L.map(b => { const h = temNaCaixa(b), cur = b.goalCur || "BRL", tem = h[cur] || 0, p = b.goal ? Math.max(0, Math.min(100, tem / b.goal * 100)) : 0, outras = Object.entries(h).filter(([c]) => c !== cur && h[c]);
    return `<button class="card lin" style="display:block;cursor:pointer;width:100%" data-act="s-abrir" data-id="${e$(b.id)}"><h2><span>${e$(b.name)}</span><span>${b.goal ? Math.round(p) + "%" : ""}</span></h2><b style="font-size:1.4rem">${fmtM(tem, cur)}</b>${b.goal ? ` <span class="dim">de ${fmtM(b.goal, cur)}</span><div class="barra" style="margin-top:.6em"><i style="width:${p}%"></i></div>` : ""}${outras.length ? `<small style="color:var(--muted);display:block;margin-top:.4em">+ ${outras.map(([c, v]) => fmtM(v, c)).join(" · ")}</small>` : ""}</button>`; }).join("")}</div>` : `<div class="card vazio">Nenhuma caixinha ainda.<br><button class="btn" style="margin-top:1em" data-act="s-nova">+ Caixinha</button></div>`}`;
}
function formCaixinha() { abrirFolha("Nova caixinha", `<form class="form" data-form="s-criar"><label class="f">Nome<input id="sn" maxlength="40" placeholder="Ex.: Reserva"></label><div class="dois"><label class="f">Meta (opcional)<input id="sg" inputmode="decimal"></label><label class="f">Moeda<select id="sc"><option value="BRL">R$</option><option value="EUR">€</option><option value="USD">US$</option></select></label></div><div id="sn-err" class="msg" hidden></div><button class="btn" type="submit">Criar</button></form>`); }
function formMov(id) {
  const b = (S.raw.cfg.save || []).find(x => x.id === id); if (!b) return; const cur = b.goalCur || "BRL", h = temNaCaixa(b);
  abrirFolha(b.name, `<div><b style="font-size:1.6rem">${fmtM(h[cur] || 0, cur)}</b>${b.goal ? `<div style="color:var(--muted)">meta ${fmtM(b.goal, cur)}</div>` : ""}</div>
  <form class="form" data-form="s-mov" data-id="${e$(id)}"><div class="dois"><label class="f">Tipo<select id="sm-t"><option value="guarda">Guardar</option><option value="tira">Tirar</option></select></label><label class="f">Valor (${MO[cur]})<input id="sm-v" inputmode="decimal"></label></div><label class="f">Data<input id="sm-d" type="date" value="${S.hoje}"></label><small style="color:var(--muted)">Nesta prévia o movimento não mexe no saldo das contas.</small><div id="sm-err" class="msg" hidden></div><button class="btn" type="submit">Lançar</button></form>
  <div><h2 style="font-size:.8rem;color:var(--muted)">Movimentos</h2>${(b.moves || []).slice().sort((a, c) => (c.date || "").localeCompare(a.date || "")).slice(0, 30).map(m => `<div class="lin" style="cursor:default"><span class="mid"><b>${m.cents < 0 ? "Tirou" : "Guardou"}</b><small>${dm(m.date || "")}${m.bank ? " · " + e$(m.bank) : ""}</small></span><span class="v ${m.cents < 0 ? "neg" : "rec"}">${fmtM(m.cents, m.cur || "BRL")}</span></div>`).join("") || "<small>Nada ainda.</small>"}</div>
  <button class="btn neg" data-act="s-apagar" data-id="${e$(id)}">Excluir caixinha</button>`);
}
// ---------- Moedas ----------
export let fxCur = "EUR"; const cot = { EUR: null, USD: null, em: 0, erro: "" };
const curOf = x => (x.cur === "USD" ? "USD" : "EUR");
const qtd = x => (x.cur === "USD" ? x.usd : x.eur) || 0;
export async function cotar(forca) {
  if (!forca && Date.now() - cot.em < 300000) return;
  try { const r = await fetch("https://economia.awesomeapi.com.br/json/last/EUR-BRL,USD-BRL"); const j = await r.json(); cot.EUR = Math.round(parseFloat(j.EURBRL.bid) * 100); cot.USD = Math.round(parseFloat(j.USDBRL.bid) * 100); cot.em = Date.now(); cot.erro = ""; }
  catch (e) { cot.erro = "Não consegui buscar a cotação agora."; cot.em = Date.now() - 240000; }
  window.dispatchEvent(new Event("tostao-redesenhar"));
}
export function desenharMoedas() {
  cotar(false);
  const cur = fxCur, L = Object.values(S.raw.fx).filter(x => curOf(x) === cur).sort((a, b) => (b.date || "").localeCompare(a.date || "")), q = L.reduce((s, x) => s + qtd(x), 0), pago = L.reduce((s, x) => s + (x.brl || 0), 0), med = q ? Math.round(pago / q * 100) : 0, hoje = cot[cur], sym = MO[cur];
  return `<div class="tit"><h1>Moedas</h1><div class="seg" role="group" aria-label="Moeda"><button data-act="f-moeda" data-m="EUR" aria-pressed="${cur === "EUR"}">€ Euro</button><button data-act="f-moeda" data-m="USD" aria-pressed="${cur === "USD"}">US$ Dólar</button></div><button class="btn" data-act="f-nova">+ Compra</button></div>
  <div class="kpis"><div class="kpi"><span>${cur === "EUR" ? "Euro" : "Dólar"} que você tem</span><b>${sym} ${(q / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b><small>pagou ${R(pago)}</small></div><div class="kpi"><span>Cotação hoje</span><b>${hoje ? R(hoje) : "…"}</b><small>${cot.erro || (hoje && q ? "vale " + R(Math.round(q * hoje / 100)) : "")} <button class="dlink" data-act="f-cot">Atualizar</button></small></div><div class="kpi"><span>Seu preço médio</span><b>${med ? R(med) : "—"}</b><small>${hoje && med ? (hoje > med ? "hoje está acima do seu médio" : "hoje está abaixo do seu médio") : ""}</small></div></div>
  <div class="card"><h2>Compras</h2>${L.length ? L.map(x => `<div class="lin" role="button" tabindex="0" data-act="f-ver" data-id="${e$(x.id)}"><span class="mid"><b>${dm(x.date || "")}${x.where ? " · " + e$(x.where) : ""}</b><small>R$ ${(x.brl / 100 / (qtd(x) / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} por ${sym}</small></span><span class="v">${sym} ${(qtd(x) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}<small>${R(x.brl)}</small></span></div>`).join("") : `<div class="vazio">Nenhuma compra.</div>`}</div>`;
}
function formMoeda() { abrirFolha("Nova compra de moeda", `<form class="form" data-form="f-salvar"><div class="dois"><label class="f">Moeda<select id="fm-c"><option value="EUR" ${fxCur === "EUR" ? "selected" : ""}>€ Euro</option><option value="USD" ${fxCur === "USD" ? "selected" : ""}>US$ Dólar</option></select></label><label class="f">Data<input id="fm-d" type="date" value="${S.hoje}"></label></div><div class="dois"><label class="f">Valor recebido<input id="fm-q" inputmode="decimal"></label><label class="f">Pagou em R$<input id="fm-b" inputmode="decimal"></label></div><label class="f">Onde<input id="fm-o" maxlength="40"></label><div id="fm-err" class="msg" hidden></div><button class="btn" type="submit">Salvar</button></form>`); }
acoesOutras["f-ver"] = a => { const x = S.raw.fx[a.dataset.id]; if (!x) return; abrirFolha("Compra de moeda", `<div><b>${MO[curOf(x)]} ${(qtd(x) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b> por ${R(x.brl)}<br><small>${dm(x.date || "")} ${e$(x.where || "")}</small></div><button class="btn neg" data-act="f-del" data-id="${e$(x.id)}">Excluir compra</button>`); };
