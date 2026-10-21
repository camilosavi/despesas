import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { installIosTouchFix } from "./lib/iosTouch";
import { startSync } from "./lib/sync";
import { App } from "./ui/App";
import { installNavHistory } from "./ui/navHistory";

startSync();
installIosTouchFix();
installNavHistory();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// PWA: service worker só em produção e em https (ou localhost)
if (import.meta.env.PROD && "serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => {
    void r.update();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void r.update(); });
  }).catch(() => { /* sem service worker: o app funciona do mesmo jeito, só não abre offline */ });
}
