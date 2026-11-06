// App fora do ar (reconstrução): limpa os caches antigos e não guarda mais nada. Não mexe em localStorage nem na conta.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
