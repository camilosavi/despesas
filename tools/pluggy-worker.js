// Open Finance do Minhas Despesas — Cloudflare Worker (plano grátis) que fala com a Pluggy (Meu Pluggy).
//
// Por que existe: o app é estático e o repositório é público, então o CLIENT_ID/CLIENT_SECRET da Pluggy não podem ficar
// no app. Este Worker guarda as chaves como "secrets" do Cloudflare e só responde a quem manda a APP_KEY certa.
// Nada de segredo neste arquivo.
//
// Como publicar:
//  1. Pluggy: crie conta em meu.pluggy.ai e conecte seus bancos lá (Open Finance). No dashboard.pluggy.ai:
//     Customização → Conectores → deixe "MeuPluggy" (200) ativo; Aplicações → crie uma aplicação de desenvolvimento.
//  2. Cloudflare: Workers & Pages → Create → Worker ("Hello World") → Deploy → Edit code → cole este arquivo → Deploy.
//  3. No worker: Settings → Variables and Secrets → adicione como Secret: CLIENT_ID e CLIENT_SECRET (da aplicação da
//     Pluggy) e APP_KEY (uma senha que você inventa).
//  4. No app: tela Você → Open Finance → endereço do worker + APP_KEY → Conectar banco → MeuPluggy.
//
// Rotas (todas pedem o cabeçalho x-app-key): /token[?itemId] · /item?itemId · /accounts?itemId ·
// /transactions?accountId[&from&to] · /bills?accountId
// Meu Pluggy: a conexão só atualiza 1x por dia (a Pluggy decide a hora; /item mostra lastUpdatedAt e nextAutoSyncAt).

const API = 'https://api.pluggy.ai';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-app-key',
};
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });

async function apiKey(env) {
  const r = await fetch(API + '/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: env.CLIENT_ID, clientSecret: env.CLIENT_SECRET }),
  });
  return (await r.json()).apiKey;
}

async function get(key, path) {
  const r = await fetch(API + path, { headers: { 'X-API-KEY': key } });
  return r.json();
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.headers.get('x-app-key') !== env.APP_KEY) return json({ error: 'unauthorized' }, 401);

    const url = new URL(req.url);
    const q = url.searchParams;
    const key = await apiKey(env);

    // token para abrir o widget (com itemId = reconectar/atualizar)
    if (url.pathname === '/token') {
      const body = q.get('itemId') ? { itemId: q.get('itemId') } : {};
      const r = await fetch(API + '/connect_token', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return json({ accessToken: (await r.json()).accessToken });
    }

    // situação da conexão (quando atualizou, quando atualiza de novo)
    if (url.pathname === '/item') {
      const d = await get(key, '/items/' + encodeURIComponent(q.get('itemId')));
      if (!d.id) return json({ error: 'Pluggy: ' + (d.message || 'conexão não encontrada') });
      return json({ id: d.id, status: d.status, executionStatus: d.executionStatus, createdAt: d.createdAt,
        lastUpdatedAt: d.lastUpdatedAt, nextAutoSyncAt: d.nextAutoSyncAt, error: undefined, pluggyError: d.error || null });
    }

    // contas (corrente e cartão) de uma conexão
    if (url.pathname === '/accounts') {
      return json(await get(key, '/accounts?itemId=' + encodeURIComponent(q.get('itemId'))));
    }

    // transações de uma conta, todas as páginas (/v2/transactions, paginação por cursor; o /transactions antigo foi
    // desativado pela Pluggy em out/2026)
    if (url.pathname === '/transactions') {
      const base = '/v2/transactions?accountId=' + encodeURIComponent(q.get('accountId')) +
        (q.get('from') ? '&dateFrom=' + encodeURIComponent(q.get('from')) : '') +
        (q.get('to') ? '&dateTo=' + encodeURIComponent(q.get('to')) : '');
      let all = [], after = null, n = 0;
      do {
        const d = await get(key, base + (after ? '&after=' + encodeURIComponent(after) : ''));
        if (!d.results) return json({ error: 'Pluggy: ' + (d.message || 'sem transações') });
        all = all.concat(d.results);
        after = d.next ? new URL(d.next, API).searchParams.get('after') : null;
      } while (after && ++n < 50);
      return json({ results: all });
    }

    // faturas do cartão
    if (url.pathname === '/bills') {
      return json(await get(key, '/bills?accountId=' + encodeURIComponent(q.get('accountId'))));
    }

    return json({ error: 'not found' }, 404);
  },
};
