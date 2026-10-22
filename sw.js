// Service worker do Tostão. 47c3328c é trocado a cada publicação (scripts/publish.mjs).
const C = "despesas-__VERSION__", RT = "despesas-runtime";
const ASSETS = ["./", "index.html", "manifest.webmanifest", "tostao-180.png", "tostao-192.png", "tostao-512.png", "tostao-maskable-512.png", "tostao-logo.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C && x !== RT).map(x => caches.delete(x)))));
  self.clients.claim();
});
const fromCache = req => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined));
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET") return;
  if (u.origin === location.origin) {
    // rede primeiro (pega atualizações), mas sem esperar mais de 2,5 s: com sinal fraco ou offline abre do cache
    e.respondWith(new Promise(res => {
      let done = false; const fin = r => { if (!done && r) { done = true; res(r); } };
      const t = setTimeout(() => fromCache(req).then(fin), 2500);
      fetch(req, { cache: "no-cache" }).then(r => {
        if (r && r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(req, cp)); }
        clearTimeout(t); if (done) return;
        if (r && r.ok) fin(r); else fromCache(req).then(c => fin(c || r));
      }).catch(() => { clearTimeout(t); fromCache(req).then(c => fin(c || Response.error())); });
    }));
  } else if (/fonts\.g/.test(u.hostname)) {
    // fontes: cache que não some a cada versão
    e.respondWith(caches.open(RT).then(c => c.match(req).then(r => r || fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
      return res;
    }))));
  }
});
