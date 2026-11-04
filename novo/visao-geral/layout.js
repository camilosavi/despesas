// Widgets da tela inicial: cada bloco tem tamanhos (largura × altura em "quadrados") e a grade encaixa tudo sozinha, como no Tetris.
const TAM = {
  saldo: { n: "Na conta hoje", t: [[1, 2], [2, 2], [1, 3]] },
  resumo: { n: "Resumo do mês", t: [[2, 2], [3, 2], [4, 2], [2, 3]] },
  saude: { n: "Nota de saúde", t: [[1, 2], [2, 2], [1, 3]] },
  fluxo: { n: "Fluxo de caixa", t: [[2, 4], [4, 4], [2, 6]] },
  gastos: { n: "Gastos", t: [[1, 6], [2, 6], [2, 8]] },
  cartoes: { n: "Cartões", t: [[1, 6], [2, 8], [1, 8]] },
  pagar: { n: "Vence em 10 dias", t: [[2, 2], [1, 4], [2, 4]] },
  trans: { n: "Últimas transações", t: [[3, 4], [4, 4], [2, 5], [2, 8], [1, 6]] },
  pessoas: { n: "Pessoas", t: [[1, 4], [2, 3]] },
};
const PADRAO = () => ({ ordem: Object.keys(TAM), tam: {}, oculto: [] });
function carregarLayout() {
  try {
    const j = JSON.parse(localStorage.getItem("tostao.layout") || "null");
    if (j && Array.isArray(j.ordem)) { const L = { ...PADRAO(), ...j }; L.ordem = [...L.ordem.filter(k => TAM[k]), ...Object.keys(TAM).filter(k => !L.ordem.includes(k))]; return L; }
  } catch (e) {}
  return PADRAO();
}
let LAYOUT = carregarLayout(), EDIT = false, ULT = null, WID = {};
const salvarLayout = () => { try { localStorage.setItem("tostao.layout", JSON.stringify(LAYOUT)); } catch (e) {} };
const tamDe = id => TAM[id].t[Math.min(LAYOUT.tam[id] || 0, TAM[id].t.length - 1)];
const redesenhar = () => ULT && desenhar(...ULT);

function grade() {
  return LAYOUT.ordem.filter(id => !LAYOUT.oculto.includes(id)).map(id => {
    const [w, h] = tamDe(id);
    const ctl = EDIT ? `<div class="ctl"><button class="grip" data-grip="${id}" aria-label="Arrastar ${esc(TAM[id].n)}">⠿</button><span>${esc(TAM[id].n)}</span><button data-tam="${id}">Tamanho ${w}×${h}</button><button data-ocultar="${id}" aria-label="Ocultar">✕</button></div>` : "";
    return `<section class="db d-${id}" data-w="${id}" style="--w:${w};--h:${h}">${ctl}${WID[id] || ""}</section>`;
  }).join("");
}
function editBar() {
  if (!EDIT) return `<div class="orgbar"><button class="dlink" data-org="1">Organizar widgets</button></div>`;
  const ocultos = LAYOUT.oculto.map(id => `<button class="chip" data-mostrar="${id}">+ ${esc(TAM[id].n)}</button>`).join("");
  return `<div class="orgbar edit"><span>Arraste pelo ⠿ para encaixar. Toque em Tamanho para mudar o quadro.</span><button class="btn" data-pronto="1">Pronto</button><button class="btn ghost" data-reset="1">Restaurar padrão</button>${ocultos ? `<div class="bandeja">${ocultos}</div>` : ""}</div>`;
}
document.addEventListener("click", ev => {
  const q = s => ev.target.closest(s);
  let a;
  if (q("[data-org]")) EDIT = true;
  else if (q("[data-pronto]")) EDIT = false;
  else if (q("[data-reset]")) LAYOUT = PADRAO();
  else if ((a = q("[data-tam]"))) { const id = a.dataset.tam; LAYOUT.tam[id] = ((LAYOUT.tam[id] || 0) + 1) % TAM[id].t.length; }
  else if ((a = q("[data-ocultar]"))) LAYOUT.oculto.push(a.dataset.ocultar);
  else if ((a = q("[data-mostrar]"))) LAYOUT.oculto = LAYOUT.oculto.filter(k => k !== a.dataset.mostrar);
  else return;
  salvarLayout(); redesenhar();
});
// arrastar pelo ⠿: o bloco vai atrás do dedo/mouse e os outros se encaixam na hora
document.addEventListener("pointerdown", ev => {
  const g = ev.target.closest("[data-grip]"); if (!g) return;
  ev.preventDefault();
  const el = g.closest(".db"), grid = el.parentElement, r = el.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
  const gh = el.cloneNode(true); gh.classList.add("ghost");
  gh.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:50;pointer-events:none;margin:0`;
  document.body.appendChild(gh); el.classList.add("slot");
  let ultimo = 0;
  const mv = e2 => {
    gh.style.left = e2.clientX - dx + "px"; gh.style.top = e2.clientY - dy + "px";
    if (performance.now() - ultimo < 140) return;
    const o = [...grid.children].find(c => { if (c === el) return false; const b = c.getBoundingClientRect(); return e2.clientX >= b.left && e2.clientX <= b.right && e2.clientY >= b.top && e2.clientY <= b.bottom; });
    if (!o) return;
    const antes = el.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING;
    grid.insertBefore(el, antes ? o.nextSibling : o); ultimo = performance.now();
  };
  const up = () => {
    document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
    gh.remove(); el.classList.remove("slot"); setTimeout(ajustar, 0);
    const vis = [...grid.children].map(c => c.dataset.w);
    LAYOUT.ordem = [...vis, ...LAYOUT.ordem.filter(k => !vis.includes(k))]; salvarLayout();
  };
  document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
});

// Cabe na janela: no computador a grade encolhe por igual (texto, números, quadros) até aparecer inteira; no celular rola.
function ajustar() {
  const g = document.getElementById("grade"); if (!g) return;
  g.style.zoom = "";
  const pg = document.getElementById("pg");
  if (pg.clientWidth < 640) return;
  const H = g.getBoundingClientRect().height, topo = g.getBoundingClientRect().top + scrollY, livre = innerHeight - (topo - scrollY) - 16;
  const k = Math.max(.5, Math.min(1, livre / H));
  if (k < 1) g.style.zoom = k.toFixed(3);
}
addEventListener("resize", ajustar);
