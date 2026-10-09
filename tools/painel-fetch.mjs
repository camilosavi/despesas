// Roda no GitHub Actions a cada 6 h: lê as estatísticas do GoatCounter e grava CRIPTOGRAFADO
// (o repositório é público). Só o painel.html, com a senha do Camilo, consegue abrir.
import { webcrypto as wc } from "node:crypto";
import { writeFileSync } from "node:fs";

const TOKEN = process.env.GOATCOUNTER_TOKEN, SENHA = process.env.PAINEL_SENHA;
const SITE = process.env.GOATCOUNTER_SITE || "https://camilosavi.goatcounter.com";
if (!TOKEN || !SENHA) { console.error("Faltam os secrets GOATCOUNTER_TOKEN e/ou PAINEL_SENHA"); process.exit(1); }

const day = d => d.toISOString().slice(0, 10);
const end = new Date(), start = new Date(Date.now() - 89 * 864e5);
async function api(path, params = {}) {
  const u = new URL(SITE + "/api/v0" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" } });
    if (r.status === 429) { await new Promise(s => setTimeout(s, 1500)); continue; }
    if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
  throw new Error(path + " -> limite de requisições");
}

const range = { start: day(start), end: day(end) };
const total = await api("/stats/total", { ...range });
let hits = [], more = true, exclude = [];
while (more && hits.length < 1000) {
  const r = await api("/stats/hits", { ...range, daily: "true", limit: "100", ...(exclude.length ? { exclude_paths: exclude.join(",") } : {}) });
  const list = r.hits || [];
  hits.push(...list);
  exclude.push(...list.map(h => h.path_id));
  more = !!r.more && list.length > 0;
}
const slim = hits.map(h => ({
  path: h.path, title: h.title || "", event: !!h.event, count: h.count ?? h.count_unique ?? 0,
  days: (h.stats || []).filter(s => (s.daily || 0) > 0).map(s => ({ day: s.day, n: s.daily })),
}));
const payload = JSON.stringify({ updatedAt: new Date().toISOString(), range, total: { total: total.total ?? null, stats: (total.stats || []).map(s => ({ day: s.day, n: s.daily || 0 })) }, hits: slim });

// AES-GCM com chave derivada da senha (PBKDF2-SHA256)
const enc = new TextEncoder(), b64 = u => Buffer.from(u).toString("base64");
const salt = wc.getRandomValues(new Uint8Array(16)), iv = wc.getRandomValues(new Uint8Array(12)), iter = 250000;
const base = await wc.subtle.importKey("raw", enc.encode(SENHA), "PBKDF2", false, ["deriveKey"]);
const key = await wc.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(payload));
writeFileSync(process.argv[2] || "dados.enc.json", JSON.stringify({ v: 1, iter, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) }));
console.log(`ok: ${slim.length} caminhos, ${range.start} a ${range.end}`);
