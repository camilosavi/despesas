import re,os,json,glob
import os; os.chdir(os.path.dirname(os.path.abspath(__file__))); src=open('src/app.html').read()
assert 'const PWA=false;' in src
body=src.replace('const PWA=false;','const PWA=true;',1)
# drop the in-page <title>/<meta> lines that belong in head
head_extra=[]
for pat in [r'<title>.*?</title>\n', r'<meta name="apple-mobile-web-app-capable"[^>]*>\n', r'<meta name="apple-mobile-web-app-title"[^>]*>\n', r'<meta name="theme-color"[^>]*>\n']:
    body=re.sub(pat,'',body,count=1)
doc=f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Minhas Despesas</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Despesas">
<meta name="theme-color" content="#0E3B35">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-192.png">
<style>:root{{color-scheme:light;padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,-apple-system,sans-serif;background:#F3F5F2}}img{{max-width:100%}}[hidden]{{display:none!important}}*{{-webkit-touch-callout:none}}input,textarea{{-webkit-touch-callout:default}}</style>
</head><body>
{body}
</body></html>
'''
open('index.html','w').write(doc)
json.dump({"name":"Minhas Despesas","short_name":"Despesas","start_url":"./","scope":"./","display":"standalone","background_color":"#0E3B35","theme_color":"#0E3B35","lang":"pt-BR",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]},open('manifest.webmanifest','w'),ensure_ascii=False,indent=1)
import hashlib; ver=hashlib.md5(doc.encode()).hexdigest()[:8]
open('sw.js','w').write(f'''const C="despesas-{ver}", RT="despesas-runtime";
const ASSETS=["./","index.html","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{{e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)));self.skipWaiting()}});
self.addEventListener("activate",e=>{{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==RT&&x!=="despesas-av").map(x=>caches.delete(x)))));self.clients.claim()}});
const fromCache=req=>caches.match(req,{{ignoreSearch:true}}).then(r=>r||(req.mode==="navigate"?caches.match("index.html"):undefined));
self.addEventListener("fetch",e=>{{
  const req=e.request, u=new URL(req.url);
  if(req.method!=="GET") return;
  if(u.origin===location.origin){{
    // rede primeiro (pega atualizações), mas sem esperar mais de 2,5 s: com sinal fraco ou offline abre do cache
    e.respondWith(new Promise(res=>{{
      let done=false;const fin=r=>{{if(!done&&r){{done=true;res(r)}}}};
      const t=setTimeout(()=>fromCache(req).then(fin),2500);
      fetch(req,{{cache:"no-cache"}}).then(r=>{{if(r&&r.ok){{const cp=r.clone();caches.open(C).then(c=>c.put(req,cp))}}clearTimeout(t);if(done)return;if(r&&r.ok)fin(r);else fromCache(req).then(c=>fin(c||r))}})
        .catch(()=>{{clearTimeout(t);fromCache(req).then(c=>fin(c||Response.error()))}});
    }}));
  }} else if(/fonts\\.g|cdnjs\\.cloudflare\\.com/.test(u.hostname)){{
    // fontes e leitor de PDF: cache que não some a cada versão
    e.respondWith(caches.open(RT).then(c=>c.match(req).then(r=>r||fetch(req).then(res=>{{if(res&&(res.ok||res.type==="opaque"))c.put(req,res.clone());return res}}))));
  }}
}});
// avisos de vencimento (Web Push): o texto chega criptografado e o navegador decifra; aqui só mostra
self.addEventListener("push",e=>{{
  let d={{}};try{{d=e.data?e.data.json():{{}}}}catch(_){{d={{body:e.data?e.data.text():""}}}}
  // número no ícone = avisos ainda não abertos (igual ao sininho); o app recalcula ao abrir
  const bump=caches.open("despesas-av").then(c=>c.match("n").then(r=>r?r.text():"0").then(t=>{{const n=(+t||0)+1;return c.put("n",new Response(String(n))).then(()=>self.navigator&&self.navigator.setAppBadge?self.navigator.setAppBadge(n):0)}})).catch(()=>{{}});
  e.waitUntil(Promise.all([bump,self.registration.showNotification(d.title||"Minhas Despesas",{{body:d.body||"",tag:d.tag||undefined,renotify:!!d.tag,icon:"icon-192.png",badge:"icon-192.png",data:{{url:d.url||"./",av:d.av||""}}}})]));
}});
self.addEventListener("notificationclick",e=>{{
  e.notification.close();
  const d=e.notification.data||{{}};
  // guarda qual aviso foi tocado (o app lê ao abrir/voltar e vai direto ao lugar) e avisa a janela aberta
  e.waitUntil((d.av?caches.open("despesas-av").then(c=>c.put("av",new Response(d.av))):Promise.resolve()).then(()=>clients.matchAll({{type:"window",includeUncontrolled:true}})).then(L=>{{
    for(const c of L){{try{{c.postMessage({{av:d.av||""}})}}catch(_){{}}if("focus" in c)return c.focus()}}
    return clients.openWindow(d.url||"./");
  }}));
}});
''')
open('README.md','w').write("# Minhas Despesas\n\nApp pessoal de controle de gastos (PWA). Os dados ficam salvos só no aparelho (localStorage); nada é enviado para este repositório.\n\nAbra no Safari do iPhone → Compartilhar → Adicionar à Tela de Início.\n")
print("index.html gerado",len(doc))
