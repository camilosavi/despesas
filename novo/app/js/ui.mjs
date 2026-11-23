// Pequenas ferramentas de tela: formatar, escapar, folhas e avisos. Nada de conta aqui.
export const R = c => (c < 0 ? "−" : "") + "R$ " + (Math.abs(c || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export const MESL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
export const mLab = m => MESL[+m.slice(5) - 1] + " de " + m.slice(0, 4);
export const mCurto = m => MES[+m.slice(5) - 1] + "/" + m.slice(2, 4);
export const dm = d => d ? d.slice(8) + "/" + d.slice(5, 7) : "";
export const dataLonga = d => { const x = new Date(d + "T12:00:00Z"); return ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"][x.getUTCDay()] + ", " + +d.slice(8) + " de " + MESL[+d.slice(5, 7) - 1]; };
export const e$ = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// "12,50" ou "1.234,56" → centavos (inteiro); vazio ou inválido → null
export function paraCentavos(t) {
  const s = String(t || "").replace(/[^\d,.-]/g, "").trim(); if (!s) return null;
  const n = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\.(?=\d{3}\b)/g, "");
  const v = Math.round(parseFloat(n) * 100); return Number.isFinite(v) ? v : null;
}
export const deCentavos = c => (c / 100).toFixed(2).replace(".", ",");

let tAv;
export function aviso(msg, ruim) {
  const a = $("#aviso"); a.textContent = msg; a.className = ruim ? "ruim" : ""; a.hidden = false;
  clearTimeout(tAv); tAv = setTimeout(() => (a.hidden = true), ruim ? 6000 : 2600);
}
// folha (painel): fecha com Esc, clique fora ou no ✕; foco volta a quem abriu
let ultimoFoco = null;
export function abrirFolha(titulo, html, aoFechar) {
  const f = $("#folha"); ultimoFoco = document.activeElement;
  f.innerHTML = `<div class="fv" data-fechar="1"></div><section class="fl" role="dialog" aria-modal="true" aria-labelledby="fltit"><header><h2 id="fltit">${e$(titulo)}</h2><button class="fx" data-fechar="1" aria-label="Fechar">✕</button></header><div class="fc">${html}</div></section>`;
  f.hidden = false; f._fim = aoFechar; document.body.classList.add("comfolha");
  const p = $("input,select,button:not(.fx)", $(".fc", f)); if (p && matchMedia("(hover:hover)").matches) p.focus();
}
export function fecharFolha() {
  const f = $("#folha"); if (f.hidden) return; f.hidden = true; f.innerHTML = ""; document.body.classList.remove("comfolha");
  const fim = f._fim; f._fim = null; if (ultimoFoco && ultimoFoco.focus) try { ultimoFoco.focus(); } catch (e) {} if (fim) fim();
}
document.addEventListener("keydown", ev => { if (ev.key === "Escape") fecharFolha(); });
document.addEventListener("click", ev => { if (ev.target.closest("[data-fechar]")) fecharFolha(); });
