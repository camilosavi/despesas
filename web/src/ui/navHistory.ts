// Botão/gesto de voltar do celular: fecha a janela aberta e depois volta da conta para as contas (em vez de sair do app).
// Cada nível aberto (conta, janela) vira uma entrada no histórico do navegador; `hl` é quantas já existem.
import { ui } from "./uiStore";

const level = () => { const s = ui.get(); return (s.openId ? 1 : 0) + (s.sheet ? 1 : 0); };

export function installNavHistory() {
  let hl = 0, skip = false, queued = false;
  history.replaceState({ ...(history.state || {}), d: 0 }, "");
  const sync = () => {
    queued = false;
    const lvl = level();
    if (lvl > hl) { for (let i = hl + 1; i <= lvl; i++) history.pushState({ d: i }, ""); hl = lvl; }
    else if (lvl < hl) { skip = true; setTimeout(() => { skip = false; }, 600); history.go(lvl - hl); hl = lvl; } // fechou pelo app (✕, ‹ Contas): tira as entradas que sobraram
  };
  // junta várias mudanças seguidas (fechar janela + voltar às contas) num único history.go
  ui.subscribe(() => { if (!queued) { queued = true; queueMicrotask(sync); } });
  addEventListener("popstate", e => {
    if (skip) { skip = false; return; }
    const d = Math.max(0, Math.min(Number(e.state?.d) || 0, 2));
    hl = d;
    while (level() > d) { // o usuário voltou: desfaz o nível mais de dentro
      if (ui.get().sheet) ui.set({ sheet: null }); else ui.set({ openId: null });
    }
    if (level() < d) sync(); // foi para a frente: alinha o histórico ao que está na tela
  });
}
