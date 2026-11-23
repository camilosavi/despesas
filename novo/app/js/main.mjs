// Casca do app: entrar → carregar → navegar. Ouvintes de clique/formulário/mudança ficam aqui, um só por tipo.
import * as sb from "./sb.mjs";
import { S, carregar, aoMudar } from "./store.mjs";
import { $, $$, e$, aviso, fecharFolha } from "./ui.mjs";
import { desenharEntrar, acoesEntrar, enviarEntrar } from "./telas/entrar.mjs";
import { desenharInicio } from "./telas/inicio.mjs";
import { desenharMes, acoesMes, V as VMes } from "./telas/mes.mjs";
import { desenharCartoes, acoesCartoes, formsCartoes } from "./telas/cartoes.mjs";
import { desenharContas, acoesContas, formsContas } from "./telas/contas.mjs";
import { desenharPlanejar, desenharOrcamento, desenharPessoas, desenharCaixinhas, desenharMoedas, acoesOutras, formsOutras } from "./telas/outras.mjs";
import { desenharVoce, acoesVoce, formsVoce, aplicarTema } from "./telas/voce.mjs";
import { abrirLancar, salvarForm, acoesLancar, mudancaLancar } from "./telas/lancar.mjs";

aplicarTema();
const raiz = $("#raiz");
const IC = {
  inicio: '<path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"/>', mes: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  contas: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>', cartoes: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  planejar: '<path d="M4 19V9M10 19V5M16 19v-7M21 19H3"/>', orcamento: '<circle cx="12" cy="12" r="8"/><path d="M12 12V4M12 12l6 4"/>',
  pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6M16 5.5a3 3 0 010 5.5M18 14.5c1.8.7 3 2.5 3 5.5"/>', caixinhas: '<path d="M5 10h14v9a1 1 0 01-1 1H6a1 1 0 01-1-1zM3 6h18v4H3zM12 6v14"/>',
  moedas: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5c-.6-.8-1.5-1.3-2.5-1.3-1.5 0-2.5.8-2.5 2 0 2.800 5 1.300 5 4 0 1.200-1.100 2-2.600 2-1.100 0-2-.5-2.700-1.300M12 6.500v1.700M12 16v1.700"/>', voce: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.900 3.100-6.500 7-6.500s7 2.600 7 6.500"/>',
};
const ROTAS = [["inicio", "Início"], ["mes", "Mês"], ["contas", "Contas"], ["cartoes", "Cartões"], ["planejar", "Planejar"], ["orcamento", "Orçamento"], ["pessoas", "Pessoas"], ["caixinhas", "Caixinhas"], ["moedas", "Moedas"], ["voce", "Você"]];
const rota = () => { const p = (location.hash || "").replace(/^#\/?/, "").split("/"); return { nome: ROTAS.some(r => r[0] === p[0]) ? p[0] : "inicio", arg: p[1] ? decodeURIComponent(p[1]) : "" }; };
const TELAS = { inicio: desenharInicio, mes: desenharMes, contas: desenharContas, cartoes: a => desenharCartoes(a), planejar: desenharPlanejar, orcamento: desenharOrcamento, pessoas: desenharPessoas, caixinhas: desenharCaixinhas, moedas: desenharMoedas, voce: desenharVoce };
let logado = false;

function sync() { return S.erro ? `<span class="sync err"><i></i>${e$(S.erro)}</span>` : S.pend || S.carregando ? `<span class="sync ocup"><i></i>Sincronizando…</span>` : `<span class="sync"><i></i>Sincronizado</span>`; }
export function desenhar() {
  if (!logado) { raiz.innerHTML = desenharEntrar(); return; }
  const { nome, arg } = rota();
  if (!S.estado) { raiz.innerHTML = `<div class="entrar"><div class="cx"><img src="../marcas/tostao-logo.png" alt=""><p style="text-align:center">${S.erro ? e$(S.erro) : "Carregando seus dados…"}</p>${S.erro ? '<button class="btn" data-act="v-recarregar2">Tentar de novo</button><button class="btn ghost" data-act="v-sair2">Sair</button>' : ""}</div></div>`; return; }
  const foco = document.activeElement && document.activeElement.id, pos = document.activeElement && document.activeElement.selectionStart;
  let corpo; try { corpo = TELAS[nome](arg); } catch (e) { console.error(e); corpo = `<div class="msg">Algo deu errado ao montar esta tela. Recarregue a página.</div>`; }
  raiz.innerHTML = `<div class="app"><nav class="sb" aria-label="Principal"><div class="marca"><img src="../marcas/tostao-logo.png" alt="Um Tostão"></div>${ROTAS.map(([k, n]) => `<a href="#/${k}" ${k === nome ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg><span>${n}</span></a>`).join("")}<div class="fim">${sync()}<span>Prévia do app novo</span></div></nav><main class="tela" id="tela">${corpo}</main>${["mes", "contas", "cartoes"].includes(nome) ? `<button class="fab" data-act="novo" data-t="desp" aria-label="Novo lançamento">+</button>` : ""}</div>`;
  if (typeof dcKeyAll === "function") try { dcKeyAll(); } catch (e) {}
  if (foco) { const el = document.getElementById(foco); if (el && el.focus) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) {} } }
}
const ACOES = { ...acoesEntrar, ...acoesMes, ...acoesCartoes, ...acoesContas, ...acoesOutras, ...acoesVoce, ...acoesLancar,
  novo: a => abrirLancar({ tipo: a.dataset.t || "desp", cartao: a.dataset.c || "" }),
  editar: a => abrirLancar({ id: a.dataset.id }),
  "ir-cartao": a => { import("./telas/cartoes.mjs").then(m => { m.V.ym = a.dataset.ym; m.V.c = a.dataset.c; location.hash = "#/cartoes/" + encodeURIComponent(a.dataset.c); }); },
  "v-recarregar2": () => carregar(), "v-sair2": async () => { await sb.sair(); location.reload(); },
};
const FORMS = { ...formsCartoes, ...formsContas, ...formsOutras, ...formsVoce };
document.addEventListener("click", ev => {
  const a = ev.target.closest("[data-act]"); if (!a) return;
  const f = ACOES[a.dataset.act]; if (!f) return;
  if (a.tagName === "A") ev.preventDefault();
  const r = f(a, ev); if (a.dataset.act === "e-modo") return desenhar(); if (!(r && r.then)) desenhar();
});
document.addEventListener("keydown", ev => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches('.lin[role="button"],.lin[data-act]') && ev.target.tagName !== "BUTTON") { ev.preventDefault(); ev.target.click(); } });
document.addEventListener("submit", ev => {
  ev.preventDefault(); const f = ev.target;
  if (f.id === "fe") return enviarEntrar(desenhar, iniciar);
  if (f.id === "fl") return salvarForm();
  const h = FORMS[f.dataset.form]; if (h) h(f, ev);
});
document.addEventListener("change", ev => { const t = ev.target; if (t.dataset.actChange && mudancaLancar[t.dataset.actChange]) return mudancaLancar[t.dataset.actChange](t); if (t.id === "m-cat") { VMes.cat = t.value; desenhar(); } });
document.addEventListener("input", ev => { if (ev.target.id === "m-q") { VMes.q = ev.target.value; desenhar(); } });
window.addEventListener("hashchange", () => { fecharFolha(); desenhar(); scrollTo(0, 0); });
window.addEventListener("tostao-redesenhar", desenhar);
aoMudar(desenhar);
sb.quandoPerder(() => { logado = false; desenhar(); });

async function iniciar() { logado = true; desenhar(); await carregar(); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && logado && !S.pend) carregar(); });
(async () => { sb.lerRetorno(); if (sb.sessao()) iniciar(); else desenhar(); })();
