import * as sb from "../sb.mjs";
import { e$ } from "../ui.mjs";
let modo = "in", msg = "", ok = false, ocupado = false;
export function desenharEntrar() {
  const novo = modo === "new", esq = modo === "forgot";
  return `<div class="entrar"><div class="cx"><img src="../marcas/tostao-logo.png" alt="Um Tostão">
  <div class="card"><div class="seg" role="group" aria-label="Entrar ou criar conta" style="justify-self:center"><button data-act="e-modo" data-m="in" aria-pressed="${!novo && !esq}">Entrar</button><button data-act="e-modo" data-m="new" aria-pressed="${novo}">Criar conta</button></div>
  ${msg ? `<div class="msg ${ok ? "ok" : ""}" style="margin-top:1em" role="alert">${e$(msg)}</div>` : ""}
  <form class="form" id="fe" style="margin-top:1em" novalidate>
   <label class="f">E-mail<input id="em" type="email" autocomplete="email" inputmode="email" required></label>
   ${esq ? "" : `<label class="f">Senha<input id="se" type="password" autocomplete="${novo ? "new-password" : "current-password"}" required minlength="6"></label>`}
   ${novo ? `<label class="f">Repita a senha<input id="se2" type="password" autocomplete="new-password" required minlength="6"></label>` : ""}
   <button class="btn" type="submit" ${ocupado ? "disabled" : ""}>${ocupado ? "Aguarde…" : esq ? "Enviar o link" : novo ? "Criar conta" : "Entrar"}</button>
   ${modo === "in" ? `<button type="button" class="btn ghost" data-act="e-modo" data-m="forgot">Esqueci a senha</button>` : ""}
   ${esq ? `<button type="button" class="btn ghost" data-act="e-modo" data-m="in">Voltar</button>` : ""}
  </form>
  ${esq ? "" : `<a class="btn ghost" style="margin-top:.8em;text-decoration:none" href="${sb.urlGoogle()}">Entrar com o Google</a>`}</div>
  <small style="text-align:center">Prévia do app novo · usa a mesma conta e os mesmos dados do app atual</small></div></div>`;
}
export const acoesEntrar = {
  "e-modo": (a, redesenhar) => { modo = a.dataset.m; msg = ""; redesenhar(); },
};
export async function enviarEntrar(redesenhar, aoEntrar) {
  const em = document.getElementById("em").value.trim(), se = (document.getElementById("se") || {}).value || "", se2 = (document.getElementById("se2") || {}).value;
  ok = false; msg = "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) msg = "Confira o e-mail.";
  else if (modo !== "forgot" && se.length < 6) msg = "A senha precisa de pelo menos 6 caracteres.";
  else if (modo === "new" && se !== se2) msg = "As senhas não são iguais.";
  if (msg) return redesenhar();
  ocupado = true; redesenhar();
  try {
    if (modo === "forgot") { await sb.esqueci(em); ok = true; msg = "Enviei o link para o seu e-mail."; }
    else if (modo === "new") { const r = await sb.criarConta(em, se); if (r.sessao) return (ocupado = false, aoEntrar()); ok = true; msg = "Confira seu e-mail para confirmar a conta e volte para entrar."; modo = "in"; }
    else { await sb.entrar(em, se); ocupado = false; return aoEntrar(); }
  } catch (e) {
    msg = e.code === "over_email_send_rate_limit" ? "Muitos e-mails enviados. Tente de novo em alguns minutos." : e.status === 400 ? "E-mail ou senha incorretos." : e.status === 422 ? e.message : e.status === 429 ? "Muitas tentativas. Espere um pouco." : e.message || "Não deu para entrar agora.";
  }
  ocupado = false; redesenhar();
}
