import { useState } from "react";
import type { Extrato } from "./extrato";
import type { Fatura } from "./leitores/pdf.js";
import { OF_MEU, OF_SDK, ofApi, ofBuscar, ofCents, ofCfg, ofExtrato, ofFatura, ofPronto, ofQuando, ofSet, ofServidor, ofSync, ofVisto } from "./openfinance";
import type { OfAcc, OfCfg, OfVisao } from "./openfinance";
import type { Backup } from "./loja";
import { R, dm } from "./format";
import "./telas.css";

interface Props { b: Backup | null; onSalvar: (b: Backup) => void; onAviso: (t: string) => void; onVoltar: () => void; onExtrato: (e: Extrato) => void; onFatura: (f: Fatura) => void }

type PC = new (o: Record<string, unknown>) => { init: () => Promise<void> };
const carregarSdk = (): Promise<PC> => {
  const get = () => { const P = (window as any).PluggyConnect; return (typeof P === "function" ? P : P && P.PluggyConnect) as PC | undefined; };
  const g = get(); if (g) return Promise.resolve(g);
  return new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = OF_SDK;
    s.onload = () => { const p = get(); p ? ok(p) : no(new Error("widget da Pluggy não carregou")); };
    s.onerror = () => no(new Error("widget da Pluggy não carregou"));
    document.head.appendChild(s);
  });
};
const tipoTxt = (x: OfAcc) => x.type === "CREDIT" ? "Cartão de crédito" : x.subtype === "SAVINGS_ACCOUNT" ? "Poupança" : x.type === "BANK" ? "Conta" : String(x.type || "");

export function OpenFinance({ b, onSalvar, onAviso, onVoltar, onExtrato, onFatura }: Props) {
  const [cfg, setCfg] = useState<OfCfg>(ofCfg());
  const [editar, setEditar] = useState(!ofPronto());
  const [url, setUrl] = useState(cfg.url || ""), [key, setKey] = useState(cfg.key || "");
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState("");
  const [v, setV] = useState<OfVisao | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [esquecer, setEsquecer] = useState("");
  const mexer = (p: Partial<OfCfg>) => { ofSet(p); setCfg(ofCfg()); };

  const salvarServidor = () => {
    const r = ofServidor(url, key); if (!r.ok) return setErro(r.erro);
    setErro(""); mexer({ url: r.url, key: r.key }); setEditar(false); onAviso("Servidor salvo.");
  };
  const conectar = async (atualizar?: string) => {
    setOcupado("conectar"); setErro("");
    try {
      const d = await ofApi<{ accessToken?: string }>("/token" + (atualizar ? "?itemId=" + encodeURIComponent(atualizar) : ""));
      if (!d.accessToken) throw new Error("o servidor não conseguiu falar com a Pluggy (confira CLIENT_ID e CLIENT_SECRET)");
      const PC = await carregarSdk();
      const escuro = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
      const w = new PC({
        connectToken: d.accessToken, theme: escuro ? "dark" : "light",
        ...(atualizar ? { updateItem: atualizar } : { connectorIds: [OF_MEU], selectedConnectorId: OF_MEU }),
        onSuccess: ({ item }: { item?: { id?: string; connector?: { name?: string } } }) => {
          if (!item?.id) return;
          const L = (ofCfg().items || []).filter(x => x.id !== item.id);
          L.push({ id: item.id, name: item.connector?.name || "Meu Pluggy", at: new Date().toISOString() });
          mexer({ items: L }); onAviso(atualizar ? "Conexão atualizada." : "Banco conectado.");
        },
        onError: (e: { message?: string }) => setErro("Pluggy: " + (e?.message || "erro na conexão")),
      });
      await w.init();
    } catch (e) { setErro("Não deu: " + (e as Error).message); }
    setOcupado("");
  };
  const buscar = async (id: string) => {
    setOcupado(id); setErro("");
    try {
      const nv = await ofBuscar(id); setV(nv);
      if (b) { const nb = ofSync(b, nv); if (nb !== b) onSalvar(nb); }
      ofVisto(nv);
    } catch (e) { setErro("Não deu: " + (e as Error).message); }
    setOcupado("");
  };
  const importar = (a: OfAcc) => {
    if (!v) return;
    if (!b) return onAviso("Escolha “Começar do zero” ou “Usar meus dados” para importar.");
    if (a.type !== "CREDIT") return onExtrato(ofExtrato(v, a));
    const f = ofFatura(v, a);
    if (!f.rows.length) return onAviso("Nenhuma compra na fatura em aberto ainda.");
    onFatura(f);
  };
  const copiar = () => {
    if (!v) return;
    const pick = (o: OfAcc) => ({
      type: o.type, subtype: o.subtype, name: o.name, balance: o.balance, creditData: o.creditData,
      transactions: (o._tx || []).map(t => ({ date: t.date, description: t.description, amount: t.amount, type: t.type, category: t.category, status: t.status, parc: t.creditCardMetadata?.installmentNumber ? `${t.creditCardMetadata.installmentNumber}/${t.creditCardMetadata.totalInstallments}` : undefined })),
    });
    navigator.clipboard.writeText(JSON.stringify({ from: v.from, accounts: v.acc.map(pick) }, null, 1)).then(() => onAviso("Copiado."), () => onAviso("Não deu para copiar."));
  };
  const esquecerItem = (id: string) => {
    if (esquecer !== id) { setEsquecer(id); setTimeout(() => setEsquecer(""), 5000); return; }
    mexer({ items: (cfg.items || []).filter(x => x.id !== id) }); setEsquecer(""); if (v?.id === id) setV(null);
  };
  const L = cfg.items || [];
  const it = v?.it;
  return (
    <main className="pg tela ofin">
      <button type="button" className="btn ghost" onClick={onVoltar}>‹ Você</button>
      <h1>Open Finance</h1>
      {erro && <p className="lerro" role="alert">{erro}</p>}
      {editar ? (
        <section aria-label="Servidor">
          <p className="vazio">Puxa conta e cartão direto do banco, pelo Meu Pluggy. Precisa de um servidor seu (instruções em tools/pluggy-worker.js no GitHub do app). O endereço e a chave ficam só neste aparelho: não vão para a nuvem nem para o backup.</p>
          <label>Endereço do servidor<input inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="…workers.dev" value={url} onChange={ev => setUrl(ev.target.value)} /></label>
          <label>Chave do servidor (APP_KEY)<input type="password" autoComplete="off" value={key} onChange={ev => setKey(ev.target.value)} /></label>
          <div className="vacoes">{ofPronto() && <button type="button" className="btn ghost" onClick={() => setEditar(false)}>Cancelar</button>}<button type="button" className="btn" onClick={salvarServidor}>Salvar servidor</button></div>
        </section>
      ) : (
        <section aria-label="Conexões">
          {L.length ? L.map(i => (
            <div key={i.id} className="ofitem">
              <div><b>{i.name}</b><small>conectado em {dm(i.at.slice(0, 10))}</small></div>
              <div className="vacoes">
                <button type="button" className="btn ghost" disabled={!!ocupado} onClick={() => buscar(i.id)}>{ocupado === i.id ? "Buscando…" : v?.id === i.id ? "Buscar de novo" : "Ver dados"}</button>
                <button type="button" className="btn ghost" onClick={() => esquecerItem(i.id)}>{esquecer === i.id ? "Toque de novo para esquecer" : "Esquecer"}</button>
              </div>
            </div>
          )) : <p className="vazio">Servidor salvo ✓. Agora conecte: escolha MeuPluggy, entre com a sua conta de lá e autorize cada banco.</p>}
          <div className="vacoes">
            <button type="button" className="btn" disabled={!!ocupado} onClick={() => conectar()}>{ocupado === "conectar" ? "Abrindo…" : L.length ? "Conectar outro banco" : "Conectar banco"}</button>
            <button type="button" className="btn ghost" onClick={() => { setUrl(cfg.url || ""); setKey(cfg.key || ""); setEditar(true); }}>Trocar servidor</button>
          </div>
        </section>
      )}
      {v && !editar && (
        <section aria-label="Dados do banco">
          {it?.old
            ? <p className="vazio">Para ver quando o banco atualiza, publique de novo o servidor (tools/pluggy-worker.js).</p>
            : <p className="vazio">{it?.lastUpdatedAt ? `Atualizado pelo banco em ${ofQuando(it.lastUpdatedAt)}` : "Ainda não atualizou"}{it?.nextAutoSyncAt ? ` · próxima atualização ${ofQuando(it.nextAutoSyncAt)}` : ""}{it?.status === "UPDATING" ? " · atualizando agora" : ""}{it?.status && it.status !== "UPDATED" && it.status !== "UPDATING" ? ` · situação: ${it.status}${it.pluggyError?.message ? " (" + it.pluggyError.message + ")" : ""}` : ""}</p>}
          <p className="vazio">Movimentos desde {dm(v.from)}. Importar mostra tudo para conferir antes, com as mesmas regras do extrato e da fatura em PDF. Saldo e limite já foram atualizados.</p>
          {v.acc.map(x => {
            const cr = x.type === "CREDIT", cd = x.creditData || {}, tx = x._tx || [], aberta = abertas.has(x.id);
            return (
              <div key={x.id} className="ofacc">
                <b>{x.name || x.marketingName}</b> <small>{tipoTxt(x)}</small>
                <p className="vazio">{cr ? `Fatura atual ${R(ofCents(x.balance))}${cd.availableCreditLimit != null ? ` · livre ${R(ofCents(cd.availableCreditLimit))}` : ""}${cd.balanceDueDate ? ` · vence ${dm(String(cd.balanceDueDate).slice(0, 10))}` : ""}` : `Saldo ${R(ofCents(x.balance))}`}</p>
                <div className="vacoes">
                  <button type="button" className="btn" onClick={() => importar(x)}>{cr ? "Importar fatura" : "Importar conta"}</button>
                  {tx.length > 0 && <button type="button" className="btn ghost" aria-expanded={aberta} onClick={() => setAbertas(s => { const n = new Set(s); aberta ? n.delete(x.id) : n.add(x.id); return n; })}>{aberta ? "Esconder" : `Ver ${tx.length}`}</button>}
                </div>
                {aberta && <ul className="ofrows">{tx.slice(0, 80).map((t, k) => {
                  const m = t.creditCardMetadata || {}, c = ofCents(t.amount), sai = cr ? c > 0 : c < 0;
                  return <li key={k}><span>{dm(String(t.date).slice(0, 10))}</span><span>{t.description}<small>{t.category || ""}{(m.totalInstallments || 0) > 1 ? ` · ${m.installmentNumber}/${m.totalInstallments}` : ""}{t.status === "PENDING" ? " · pendente" : ""}</small></span><b className={sai ? "" : "pos"}>{sai ? "−" : "+"}{R(Math.abs(c))}</b></li>;
                })}</ul>}
              </div>
            );
          })}
          {!v.acc.length && <p className="vazio">Nenhuma conta nessa conexão.</p>}
          <div className="vacoes"><button type="button" className="btn ghost" onClick={copiar}>Copiar dados para o Claude</button></div>
        </section>
      )}
    </main>
  );
}
