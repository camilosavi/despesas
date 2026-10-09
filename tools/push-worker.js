// Avisos do Minhas Despesas — Cloudflare Worker (plano grátis, sem cartão de crédito).
//
// O que ele guarda (no KV "AVISOS"): o endereço de push de cada aparelho e, para cada aviso, só o horário e o texto
// JÁ CRIPTOGRAFADO no próprio aparelho (RFC 8291). Este servidor nunca vê nomes, valores nem lançamentos.
// As chaves VAPID são criadas aqui na 1ª chamada e ficam só no KV (nada de segredo neste arquivo, que é público).
//
// Como publicar (painel do Cloudflare, tudo grátis):
//  1. Workers & Pages → Create → Worker ("Hello World") → nome "despesas-avisos" → Deploy → Edit code → cole este
//     arquivo inteiro → Deploy.
//  2. Storage & Databases → KV → Create → nome "despesas-avisos".
//  3. No worker: Settings → Bindings → Add → KV namespace → Variable name "AVISOS" → escolha o KV criado.
//  4. No worker: Settings → Triggers → Cron Triggers → Add → "*/15 * * * *".
//  5. Copie o endereço (https://despesas-avisos.<seu-subdominio>.workers.dev) para PUSH_URL em src/app.html.
//
// Rotas: GET /vapid (chave pública) · POST /sub {endpoint, items:[{t:ms,b:base64url}], now?:base64url} · POST /unsub {endpoint}
// Cron a cada 15 min: manda os avisos com horário em [agendado − 15 min, agendado).

const ORIGINS = /^(https:\/\/camilosavi\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const HOSTS = /^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
const SUB = "https://camilosavi.github.io/despesas/";
const MAX_ITEMS = 60, MAX_B = 4000, WIN = 15 * 60e3, DAY = 864e5;

const b64u = buf => { let s = ""; new Uint8Array(buf).forEach(c => s += String.fromCharCode(c)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") };
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const keyOf = async ep => "s:" + hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ep))).slice(0, 32);

async function vapid(env) {
  let v = await env.AVISOS.get("vapid", "json");
  if (!v) {
    const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    v = { priv: await crypto.subtle.exportKey("jwk", k.privateKey), pub: b64u(await crypto.subtle.exportKey("raw", k.publicKey)) };
    await env.AVISOS.put("vapid", JSON.stringify(v));
  }
  return v;
}

async function vapidAuth(env, endpoint) {
  const v = await vapid(env), aud = new URL(endpoint).origin;
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud, exp: Math.floor(Date.now() / 1e3) + 12 * 3600, sub: SUB });
  const key = await crypto.subtle.importKey("jwk", v.priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${v.pub}`;
}

// manda um aviso já criptografado; devolve o status do serviço de push (404/410 = aparelho saiu)
async function send(env, endpoint, b, ttl) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: await vapidAuth(env, endpoint), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(ttl || 86400), Urgency: "normal" },
    body: unb64u(b),
  });
  return r.status;
}

const okEndpoint = ep => { try { const u = new URL(ep); return u.protocol === "https:" && HOSTS.test(u.hostname) && ep.length < 1024 } catch (e) { return false } };

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": ORIGINS.test(origin) ? origin : "https://camilosavi.github.io", "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
    const out = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!env.AVISOS) return out({ error: "KV AVISOS não ligado" }, 500);
    const path = new URL(req.url).pathname;
    try {
      if (req.method === "GET" && path === "/vapid") return out({ key: (await vapid(env)).pub });
      if (req.method !== "POST") return out({ error: "rota" }, 404);
      const txt = await req.text();
      if (txt.length > 300e3) return out({ error: "grande demais" }, 413);
      const j = JSON.parse(txt);
      if (!okEndpoint(j.endpoint)) return out({ error: "endpoint" }, 400);
      const key = await keyOf(j.endpoint);
      if (path === "/unsub") { await env.AVISOS.delete(key); return out({ ok: true }) }
      if (path !== "/sub") return out({ error: "rota" }, 404);
      const now = Date.now();
      const it = (Array.isArray(j.items) ? j.items : [])
        .filter(x => x && Number.isFinite(x.t) && x.t > now - WIN && x.t < now + 45 * DAY && typeof x.b === "string" && x.b.length <= MAX_B && /^[\w-]+$/.test(x.b))
        .sort((a, b) => a.t - b.t).slice(0, MAX_ITEMS).map(x => ({ t: Math.round(x.t), b: x.b }));
      let test = null;
      if (typeof j.now === "string" && j.now.length <= MAX_B && /^[\w-]+$/.test(j.now)) test = await send(env, j.endpoint, j.now, 600);
      if (test === 404 || test === 410) { await env.AVISOS.delete(key); return out({ ok: false, gone: true }) }
      if (it.length) {
        const last = it[it.length - 1].t;
        await env.AVISOS.put(key, JSON.stringify({ e: j.endpoint, it }), {
          expirationTtl: Math.max(3 * DAY, last - now + 2 * DAY) / 1e3 | 0,
          metadata: { m: it.map(x => Math.floor(x.t / 60e3)) },  // minutos: o cron só lê quem tem aviso na janela
        });
      } else await env.AVISOS.delete(key);
      return out({ ok: true, n: it.length, test });
    } catch (e) { return out({ error: String(e && e.message || e) }, 500) }
  },

  async scheduled(ev, env, ctx) {
    const end = ev.scheduledTime, start = end - WIN, a = Math.floor(start / 60e3), z = Math.floor(end / 60e3);
    let cursor;
    do {
      const L = await env.AVISOS.list({ prefix: "s:", cursor });
      cursor = L.list_complete ? null : L.cursor;
      for (const k of L.keys) {
        const m = k.metadata && k.metadata.m;
        if (!m || !m.some(x => x >= a && x < z)) continue;
        const v = await env.AVISOS.get(k.name, "json");
        if (!v) continue;
        for (const x of v.it.filter(x => x.t >= start && x.t < end)) {
          try {
            const s = await send(env, v.e, x.b);
            if (s === 404 || s === 410) { await env.AVISOS.delete(k.name); break }
          } catch (e) { /* tenta o próximo */ }
        }
      }
    } while (cursor);
  },
};
