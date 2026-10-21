/** iOS: no app da tela de início o touch-action às vezes é ignorado. O 2º toque rápido no mesmo lugar vira um clique normal (sem zoom);
 *  campos de texto ficam de fora. Também bloqueia a pinça. */
export function installIosTouchFix() {
  let last = 0, lx = 0, ly = 0;
  document.addEventListener("touchend", e => {
    const t = e.changedTouches && e.changedTouches[0]; if (!t) return; const n = Date.now(), tg = e.target as Element;
    if (n - last < 350 && Math.abs(t.clientX - lx) < 40 && Math.abs(t.clientY - ly) < 40 && !tg.closest("input,textarea,select,[contenteditable]")) {
      e.preventDefault(); ((tg.closest("button,a,label") || tg) as HTMLElement).click();
    }
    last = n; lx = t.clientX; ly = t.clientY;
  }, { passive: false });
  ["gesturestart", "gesturechange"].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
}
