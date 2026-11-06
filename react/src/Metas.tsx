import { useState } from "react";
import { caixaApagarMov, caixaCriar, caixaExcluir, caixaMover, caixas, caixaSaldo, dividaApagarMov, dividaCriar, dividaExcluir, dividaFalta, dividaMover, dividas } from "./loja";
import type { Backup, Caixinha, Divida } from "./loja";
import { assinaturas } from "./assinaturas";
import { centsDe } from "./Lancar";
import { R, dm } from "./format";
import "./lancar.css";
import "./pessoas.css";
import "./metas.css";

interface Props { onMoedas?: () => void; onRel?: () => void; subs?: ReturnType<typeof assinaturas>; b: Backup | null; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void }
const id = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function Metas({ onMoedas, onRel, subs = [], b, hoje, onSalvar, onAviso }: Props) {
  const [cx, setCx] = useState<string | null>(null), [dv, setDv] = useState<string | null>(null);
  const [nc, setNc] = useState(""), [meta, setMeta] = useState(""), [nd, setNd] = useState(""), [tot, setTot] = useState("");
  const cs = b ? caixas(b) : [], ds = b ? dividas(b) : [];
  const guardado = cs.reduce((s, c) => s + caixaSaldo(c), 0), falta = ds.reduce((s, d) => s + Math.max(0, dividaFalta(d)), 0);
  const precisa = () => { if (!b) onAviso("Escolha “Começar do zero” ou “Usar meus dados” para criar caixinhas e dívidas."); return !!b; };
  const novaC = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!precisa() || !b) return;
    const i = id(), nb = caixaCriar(b, i, nc, centsDe(meta) || undefined);
    if (nb === b) return onAviso("Dê um nome para a caixinha.");
    onSalvar(nb); setNc(""); setMeta(""); setCx(i);
  };
  const novaD = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!precisa() || !b) return;
    const i = id(), nb = dividaCriar(b, i, nd, centsDe(tot));
    if (nb === b) return onAviso("Informe o nome e o valor total da dívida.");
    onSalvar(nb); setNd(""); setTot(""); setDv(i);
  };
  const ac = cs.find(c => c.id === cx), ad = ds.find(d => d.id === dv);
  return (
    <main className="pg metas">
      <h1>Metas</h1>
      {onMoedas && <button type="button" className="btn" onClick={onMoedas}>Moedas: euro e dólar ›</button>}
      {onRel && <button type="button" className="btn" onClick={onRel}>Relatórios: mês a mês e por categoria ›</button>}
      <section aria-labelledby="mc">
        <h2 id="mc">Dinheiro guardado <span className="dim">{R(guardado)}</span></h2>
        <form className="ppnova" onSubmit={novaC}>
          <input value={nc} onChange={e => setNc(e.target.value)} placeholder="Nome (ex.: Viagem)" aria-label="Nome da caixinha" />
          <input value={meta} onChange={e => setMeta(e.target.value)} inputMode="decimal" placeholder="Meta (R$)" aria-label="Meta da caixinha" className="mmeta" />
          <button type="submit" className="btn">+ Caixinha</button>
        </form>
        {cs.length ? <ul className="pplista">{cs.map(c => {
          const s = caixaSaldo(c), p = c.goal ? Math.min(100, Math.round((s / c.goal) * 100)) : 0;
          return <li key={c.id}><button type="button" className="pprow mrow" onClick={() => setCx(c.id)}>
            <span className="ppav" aria-hidden="true">{c.name.slice(0, 1).toUpperCase()}</span>
            <span className="ppnm">{c.name}<em>{c.goal ? `${p}% de ${R(c.goal)}` : "sem meta"}</em>{c.goal ? <i className="mbar" style={{ ["--p" as string]: p + "%" }} /> : null}</span>
            <b>{R(s)}</b></button></li>;
        })}</ul> : <p className="vazio">Nenhuma caixinha ainda.</p>}
      </section>
      <section aria-labelledby="md">
        <h2 id="md">Dívidas <span className="dim">{falta ? "falta " + R(falta) : ""}</span></h2>
        <form className="ppnova" onSubmit={novaD}>
          <input value={nd} onChange={e => setNd(e.target.value)} placeholder="Nome (ex.: Empréstimo)" aria-label="Nome da dívida" />
          <input value={tot} onChange={e => setTot(e.target.value)} inputMode="decimal" placeholder="Total (R$)" aria-label="Valor total da dívida" className="mmeta" />
          <button type="submit" className="btn">+ Dívida</button>
        </form>
        {ds.length ? <ul className="pplista">{ds.map(d => {
          const f = dividaFalta(d), p = Math.max(0, Math.min(100, Math.round(((d.total - f) / d.total) * 100)));
          return <li key={d.id}><button type="button" className="pprow mrow" onClick={() => setDv(d.id)}>
            <span className="ppav" aria-hidden="true">{d.name.slice(0, 1).toUpperCase()}</span>
            <span className="ppnm">{d.name}<em>{f <= 0 ? "quitada ✓" : `${p}% pago`}</em><i className="mbar" style={{ ["--p" as string]: p + "%" }} /></span>
            <b className={f > 0 ? "neg" : ""}>{f > 0 ? R(f) : "—"}</b></button></li>;
        })}</ul> : <p className="vazio">Nenhuma dívida registrada. Serve para acompanhar o que falta; não entra em despesa nem em saldo.</p>}
      </section>
      <section aria-labelledby="ma">
        <h2 id="ma">Assinaturas <span className="dim">{subs.length ? R(subs.reduce((t, x) => t + x.cents, 0)) + "/mês · " + R(subs.reduce((t, x) => t + x.cents, 0) * 12) + "/ano" : ""}</span></h2>
        {subs.length ? <ul className="pplista">{subs.map(a => <li key={a.nome} className="pprow mrow"><span className="ppav" aria-hidden="true">{a.nome.slice(0, 1).toUpperCase()}</span>
          <span className="ppnm">{a.nome}<em>{a.cartao ? a.cartao + " · " : ""}última cobrança {dm(a.ultima)}</em></span><b>{R(a.cents)}</b></li>)}</ul>
          : <p className="vazio">Nenhuma assinatura encontrada. Lançamentos que se repetem todo mês aparecem aqui.</p>}
      </section>
      {ac && b && <FolhaCx b={b} c={ac} hoje={hoje} onSalvar={onSalvar} onFechar={() => setCx(null)} />}
      {ad && b && <FolhaDv b={b} d={ad} hoje={hoje} onSalvar={onSalvar} onFechar={() => setDv(null)} />}
    </main>
  );
}

function Mov({ rows, onDel }: { rows: { id: string; date: string; cents: number; rot: string }[]; onDel: (id: string) => void }) {
  const [arm, setArm] = useState<string | null>(null);
  return rows.length ? (
    <ul className="ppext">{[...rows].sort((a, c) => c.date.localeCompare(a.date)).map(m => (
      <li key={m.id}><button type="button" onClick={() => setArm(arm === m.id ? null : m.id)}><span>{m.rot}<em>{dm(m.date)}</em></span><b className={m.cents < 0 ? "neg" : ""}>{R(Math.abs(m.cents))}</b></button>
        {arm === m.id && <button type="button" className="perigo" onClick={() => onDel(m.id)}>Excluir movimento</button>}</li>))}</ul>
  ) : <p className="vazio">Sem movimentos ainda.</p>;
}

function FolhaCx({ b, c, hoje, onSalvar, onFechar }: { b: Backup; c: Caixinha; hoje: string; onSalvar: (b: Backup) => void; onFechar: () => void }) {
  const [v, setV] = useState(""), [d, setD] = useState(hoje), [conta, setConta] = useState(""), [msg, setMsg] = useState(""), [ex, setEx] = useState(false);
  const contas = ((b.cfg.accts || []) as { name: string }[]).map(a => a.name);
  const mover = (sinal: 1 | -1) => {
    const x = centsDe(v); if (!x) return setMsg("Informe o valor.");
    onSalvar(caixaMover(b, c.id, { id: id(), date: d || hoje, cents: sinal * x, ...(conta ? { acct: conta, ts: Date.now() } : {}) }));
    setV(""); setMsg("");
  };
  const s = caixaSaldo(c);
  return (
    <div className="lfundo" onMouseDown={e => e.target === e.currentTarget && onFechar()}>
      <div className="lfolha" role="dialog" aria-modal="true" aria-labelledby="cxt">
        <h2 id="cxt">{c.name}</h2>
        <div className="ppsaldo"><small>{c.goal ? `meta ${R(c.goal)} · falta ${R(Math.max(0, c.goal - s))}` : "guardado"}</small><b>{R(s)}</b></div>
        <div className="lgrupo">
          <div className="lduas">
            <label>Valor (R$)<input inputMode="decimal" value={v} onChange={e => setV(e.target.value)} placeholder="0,00" aria-invalid={msg ? true : undefined} /></label>
            <label>Data<input type="date" value={d} onChange={e => setD(e.target.value)} /></label>
          </div>
          {contas.length > 0 && <label>Descontar da conta<select value={conta} onChange={e => setConta(e.target.value)}><option value="">Não mexer no saldo</option>{contas.map(n => <option key={n}>{n}</option>)}</select></label>}
          {msg && <p className="lerro" role="alert">{msg}</p>}
          <div className="lacoes"><button type="button" className="btn principal" onClick={() => mover(1)}>Guardar</button><button type="button" className="btn" onClick={() => mover(-1)}>Tirar</button></div>
        </div>
        <h3 className="pph">Movimentos</h3>
        <Mov rows={c.moves.map(m => ({ id: m.id, date: m.date, cents: m.cents, rot: m.cents < 0 ? "Tirou" : "Guardou" }))} onDel={mid => onSalvar(caixaApagarMov(b, c.id, mid))} />
        <button type="button" className="perigo" onClick={() => { if (!ex) setEx(true); else { onSalvar(caixaExcluir(b, c.id)); onFechar(); } }}>{ex ? "Toque de novo para excluir a caixinha" : "Excluir caixinha"}</button>
        <div className="lacoes"><button type="button" className="btn" onClick={onFechar}>Fechar</button></div>
      </div>
    </div>
  );
}

function FolhaDv({ b, d, hoje, onSalvar, onFechar }: { b: Backup; d: Divida; hoje: string; onSalvar: (b: Backup) => void; onFechar: () => void }) {
  const [v, setV] = useState(""), [dt, setDt] = useState(hoje), [msg, setMsg] = useState(""), [ex, setEx] = useState(false);
  const f = dividaFalta(d);
  const mover = (sinal: 1 | -1) => {
    const x = centsDe(v); if (!x) return setMsg("Informe o valor.");
    onSalvar(dividaMover(b, d.id, { id: id(), date: dt || hoje, cents: sinal * x })); setV(""); setMsg("");
  };
  return (
    <div className="lfundo" onMouseDown={e => e.target === e.currentTarget && onFechar()}>
      <div className="lfolha" role="dialog" aria-modal="true" aria-labelledby="dvt">
        <h2 id="dvt">{d.name}</h2>
        <div className="ppsaldo"><small>{f > 0 ? `falta pagar · total ${R(d.total)}` : "quitada ✓"}</small><b className={f > 0 ? "neg" : ""}>{R(Math.max(0, f))}</b></div>
        <div className="lgrupo">
          <div className="lduas">
            <label>Valor (R$)<input inputMode="decimal" value={v} onChange={e => setV(e.target.value)} placeholder="0,00" aria-invalid={msg ? true : undefined} /></label>
            <label>Data<input type="date" value={dt} onChange={e => setDt(e.target.value)} /></label>
          </div>
          {msg && <p className="lerro" role="alert">{msg}</p>}
          <div className="lacoes"><button type="button" className="btn principal" onClick={() => mover(1)}>Paguei</button><button type="button" className="btn" onClick={() => mover(-1)}>Acrescentou (juros)</button></div>
        </div>
        <h3 className="pph">Movimentos</h3>
        <Mov rows={d.moves.map(m => ({ id: m.id, date: m.date, cents: m.cents, rot: m.cents < 0 ? "Acrescentou" : "Paguei" }))} onDel={mid => onSalvar(dividaApagarMov(b, d.id, mid))} />
        <button type="button" className="perigo" onClick={() => { if (!ex) setEx(true); else { onSalvar(dividaExcluir(b, d.id)); onFechar(); } }}>{ex ? "Toque de novo para excluir a dívida" : "Excluir dívida"}</button>
        <div className="lacoes"><button type="button" className="btn" onClick={onFechar}>Fechar</button></div>
      </div>
    </div>
  );
}
