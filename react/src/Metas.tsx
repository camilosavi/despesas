import { useEffect, useState } from "react";
import { caixaApagarMov, caixaCriar, caixaMoeda, caixaSaldos, caixaTem, cxMovDe, caixaExcluir, caixaMover, caixas, dividaApagarMov, dividaCriar, dividaExcluir, dividaFalta, dividaMover, dividas } from "./loja";
import type { Backup, Caixinha, Divida, MoedaCx } from "./loja";
import { buscarTaxas, lerCache } from "./Moedas";
import { assinaturas, cobrancasFuturas, subCancelar, subDia, subDividir, subReativar, subSuaParte } from "./assinaturas";
import { CX_TIPOS, bancosSugeridos, caixaBancos, caixaEditar, caixaEditarMov, caixaRitmo, cxIcone } from "./caixinhas";
import type { Ritmo } from "./caixinhas";
import { centsDe } from "./Lancar";
import { R, RM, dm } from "./format";
import "./lancar.css";
import "./pessoas.css";
import "./metas.css";

interface Props { onCats?: () => void; onFixos?: () => void; onMoedas?: () => void; onRel?: () => void; subs?: ReturnType<typeof assinaturas>; b: Backup | null; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void }
const ritmoTxt = (r: Ritmo | null, g: MoedaCx): string => !r ? "" : r.estado === "batida" ? "meta batida ✓" : r.estado === "passou" ? `prazo passou · falta ${RM(r.falta, g)}`
  : r.estado === "ritmo" ? "no ritmo ✓" : r.estado === "adiantada" ? `adiantada ${RM(r.diff, g)}` : r.estado === "atrasada" ? `atrasada ${RM(-r.diff, g)}` : `guarde ${RM(r.porMes, g)} por mês`;
const id = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function Metas({ onCats, onFixos, onMoedas, onRel, subs = [], b, hoje, onSalvar, onAviso }: Props) {
  const [cx, setCx] = useState<string | null>(null), [dv, setDv] = useState<string | null>(null);
  const [nc, setNc] = useState(""), [meta, setMeta] = useState(""), [mo, setMo] = useState<MoedaCx>("BRL"), [nd, setNd] = useState(""), [tot, setTot] = useState("");
  const [sb, setSb] = useState<string | null>(null), [arm, setArm] = useState<string | null>(null), [dia, setDia] = useState(""), [pes, setPes] = useState("");
  const ativas = subs.filter(x => !x.off), totS = ativas.reduce((t, x) => t + x.cents, 0);
  const abrirSub = (a: (typeof subs)[number]) => { setArm(null); if (sb === a.nome) return setSb(null); setSb(a.nome); setDia(a.dia ? String(a.dia) : ""); setPes(a.pessoas ? String(a.pessoas) : ""); };
  const cs = b ? caixas(b) : [], ds = b ? dividas(b) : [];
  const tot3 = cs.reduce((t, c) => { const x = caixaSaldos(c); return { BRL: t.BRL + x.BRL, EUR: t.EUR + x.EUR, USD: t.USD + x.USD }; }, { BRL: 0, EUR: 0, USD: 0 });
  const guardado = (["BRL", "EUR", "USD"] as const).filter(m => tot3[m] !== 0 || m === "BRL").map(m => RM(tot3[m], m)).join(" · "), falta = ds.reduce((s, d) => s + Math.max(0, dividaFalta(d)), 0);
  const precisa = () => { if (!b) onAviso("Escolha “Começar do zero” ou “Usar meus dados” para criar caixinhas e dívidas."); return !!b; };
  const novaC = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!precisa() || !b) return;
    const i = id(), nb = caixaCriar(b, i, nc, centsDe(meta) || undefined, undefined, mo);
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
      {onCats && <button type="button" className="btn" onClick={onCats}>Categorias e limites ›</button>}
      {onFixos && <button type="button" className="btn" onClick={onFixos}>Fixos: salário previsto e holerites ›</button>}
      {onMoedas && <button type="button" className="btn" onClick={onMoedas}>Moedas: euro e dólar ›</button>}
      {onRel && <button type="button" className="btn" onClick={onRel}>Relatórios: mês a mês e por categoria ›</button>}
      <section aria-labelledby="mc">
        <h2 id="mc">Dinheiro guardado <span className="dim">{guardado}</span></h2>
        <form className="ppnova" onSubmit={novaC}>
          <input value={nc} onChange={e => setNc(e.target.value)} placeholder="Nome (ex.: Viagem)" aria-label="Nome da caixinha" />
          <select value={mo} onChange={e => setMo(e.target.value as MoedaCx)} aria-label="Moeda da caixinha" className="mmoeda"><option value="BRL">R$</option><option value="EUR">€</option><option value="USD">US$</option></select>
          <input value={meta} onChange={e => setMeta(e.target.value)} inputMode="decimal" placeholder={`Meta (${mo === "BRL" ? "R$" : mo === "EUR" ? "€" : "US$"})`} aria-label="Meta da caixinha" className="mmeta" />
          <button type="submit" className="btn">+ Caixinha</button>
        </form>
        {cs.length ? <ul className="pplista">{cs.map(c => {
          const g = caixaMoeda(c), s = caixaTem(c), sb = caixaSaldos(c), p = c.goal ? Math.max(0, Math.min(100, Math.round((s / c.goal) * 100))) : 0;
          const outras = (["BRL", "EUR", "USD"] as const).filter(m => m !== g && sb[m] !== 0).map(m => RM(sb[m], m)).join(" + ");
          const rt = ritmoTxt(caixaRitmo(c, hoje), g);
          return <li key={c.id}><button type="button" className="pprow mrow" onClick={() => setCx(c.id)}>
            <span className="ppav" aria-hidden="true">{cxIcone(c) || c.name.slice(0, 1).toUpperCase()}</span>
            <span className="ppnm">{c.name}<em>{c.goal ? `${p}% de ${RM(c.goal, g)}` : "sem meta"}{rt ? " · " + rt : ""}{outras ? " · + " + outras : ""}</em>{c.goal ? <i className="mbar" style={{ ["--p" as string]: p + "%" }} /> : null}</span>
            <b>{RM(s, g)}</b></button></li>;
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
        <h2 id="ma">Assinaturas <span className="dim">{ativas.length ? R(totS) + "/mês · " + R(totS * 12) + "/ano" : ""}</span></h2>
        {subs.length ? <ul className="pplista">{subs.map(a => <li key={a.nome}>
          <button type="button" className="pprow mrow" aria-expanded={sb === a.nome} onClick={() => abrirSub(a)}>
            <span className="ppav" aria-hidden="true">{a.nome.slice(0, 1).toUpperCase()}</span>
            <span className="ppnm">{a.nome}<em>{a.off ? "cancelada · última cobrança em " + a.ultima.slice(5, 7) + "/" + a.ultima.slice(2, 4) : (a.cartao ? a.cartao + " · " : "") + (a.dia ? "cobra dia " + a.dia : "última cobrança " + dm(a.ultima)) + (a.pessoas ? ` · ÷${a.pessoas}` : "")}</em></span>
            <b className={a.off ? "dim" : ""}>{R(a.off ? a.cents : subSuaParte(a.cents, a.pessoas))}</b></button>
          {sb === a.nome && b && (
            <div className="lgrupo">
              {a.pessoas ? <p className="lnota">Total {R(a.cents)} dividido entre {a.pessoas} pessoas: sua parte é {R(subSuaParte(a.cents, a.pessoas))}.</p> : null}
              <label>Dia da cobrança (1 a 31)<input inputMode="numeric" value={dia} onChange={x => setDia(x.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="usa o dia do último lançamento" /></label>
              <label>Dividido entre quantas pessoas (contando você)<input inputMode="numeric" value={pes} onChange={x => setPes(x.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="1 = sem divisão" /></label>
              <div className="lacoes"><button type="button" className="btn principal" onClick={() => { onSalvar(subDividir(subDia(b, a.nome, +dia || 0), a.nome, +pes || 1, a.cents)); setSb(null); onAviso("Assinatura salva."); }}>Salvar</button>
                {a.off ? <button type="button" className="btn" onClick={() => { onSalvar(subReativar(b, a.nome)); setSb(null); }}>Reativar</button>
                  : <button type="button" className="perigo" onClick={() => { if (arm !== a.nome) setArm(a.nome); else { onSalvar(subCancelar(b, a.nome, hoje)); setArm(null); setSb(null); onAviso("Assinatura cancelada."); } }}>
                    {arm === a.nome ? `Apagar ${cobrancasFuturas(b, a.nome, hoje)} cobranças futuras? Toque de novo` : "Cancelada"}</button>}</div>
            </div>
          )}</li>)}</ul>
          : <p className="vazio">Nenhuma assinatura encontrada. Lançamentos que se repetem todo mês aparecem aqui.</p>}
      </section>
      {ac && b && <FolhaCx b={b} c={ac} hoje={hoje} onSalvar={onSalvar} onFechar={() => setCx(null)} />}
      {ad && b && <FolhaDv b={b} d={ad} hoje={hoje} onSalvar={onSalvar} onFechar={() => setDv(null)} />}
    </main>
  );
}

function Mov({ rows, onDel }: { rows: { id: string; date: string; cents: number; rot: string; cur?: MoedaCx; sub?: string }[]; onDel: (id: string) => void }) {
  const [arm, setArm] = useState<string | null>(null);
  return rows.length ? (
    <ul className="ppext">{[...rows].sort((a, c) => c.date.localeCompare(a.date)).map(m => (
      <li key={m.id}><button type="button" onClick={() => setArm(arm === m.id ? null : m.id)}><span>{m.rot}<em>{dm(m.date)}{m.sub ? " · " + m.sub : ""}</em></span><b className={m.cents < 0 ? "neg" : ""}>{RM(Math.abs(m.cents), m.cur)}</b></button>
        {arm === m.id && <button type="button" className="perigo" onClick={() => onDel(m.id)}>Excluir movimento</button>}</li>))}</ul>
  ) : <p className="vazio">Sem movimentos ainda.</p>;
}

function FolhaCx({ b, c, hoje, onSalvar, onFechar }: { b: Backup; c: Caixinha; hoje: string; onSalvar: (b: Backup) => void; onFechar: () => void }) {
  const g = caixaMoeda(c), est = g !== "BRL";
  const [v, setV] = useState(""), [d, setD] = useState(hoje), [conta, setConta] = useState(""), [msg, setMsg] = useState(""), [ex, setEx] = useState(false);
  const [ent, setEnt] = useState<MoedaCx>(est ? g : "BRL"), [rt, setRt] = useState(""), [hojeCot, setHojeCot] = useState(0);
  const [banco, setBanco] = useState(""), [edit, setEdit] = useState(false);
  const contas = ((b.cfg.accts || []) as { name: string; cur?: string }[]).filter(a => !a.cur || a.cur === "BRL").map(a => a.name);
  useEffect(() => {
    if (!est) return;
    const usa = (t: { EUR: number; USD: number }) => { const x = g === "USD" ? t.USD : t.EUR; if (x > 0) { setHojeCot(x); setRt(r => r || x.toFixed(4).replace(".", ",")); } };
    const k = lerCache(); if (k) usa(k);
    if (!k || Date.now() - k.at > 5 * 60_000) buscarTaxas().then(t => { usa(t); try { localStorage.setItem("despesas.rates2", JSON.stringify(t)); } catch { /* sem armazenamento */ } }).catch(() => undefined);
  }, [est, g]);
  const rate = parseFloat(rt.replace(/\./g, "").replace(",", ".")) || 0, x0 = centsDe(v);
  const simbolo = g === "EUR" ? "€" : "US$";
  const dica = est && x0 && rate ? (ent === "BRL" ? `${RM(x0, "BRL")} a R$ ${rt} = ${RM(Math.round(x0 / rate), g)}` : `${RM(x0, g)} a R$ ${rt} = ${RM(Math.round(x0 * rate), "BRL")} pagos`) : "";
  const mover = (sinal: 1 | -1) => {
    if (!x0) return setMsg("Informe o valor.");
    if (est && rate && hojeCot && (rate < hojeCot * 0.6 || rate > hojeCot * 1.6)) return setMsg("A cotação está muito longe da de hoje. Confira se não está invertida.");
    onSalvar(caixaMover(b, c.id, cxMovDe(c, { id: id(), date: d || hoje, valor: sinal * x0, entrada: ent, rate: est ? rate : undefined, bank: banco, ...(conta ? { acct: conta, ts: Date.now() } : {}) })));
    setV(""); setMsg("");
  };
  const sb = caixaSaldos(c), s = caixaTem(c), ritmo = caixaRitmo(c, hoje), bancos = caixaBancos(c).filter(x => x.banco || c.moves.some(m => m.bank));
  const outras = (["BRL", "EUR", "USD"] as const).filter(m => m !== g && sb[m] !== 0).map(m => RM(sb[m], m)).join(" + ");
  return (
    <div className="lfundo" onMouseDown={e => e.target === e.currentTarget && onFechar()}>
      <div className="lfolha" role="dialog" aria-modal="true" aria-labelledby="cxt">
        <h2 id="cxt">{c.name}</h2>
        <div className="ppsaldo"><small>{c.goal ? `meta ${RM(c.goal, g)} · falta ${RM(Math.max(0, c.goal - s), g)}` : "guardado"}{outras ? ` · + ${outras} em outras moedas` : ""}</small><b>{RM(s, g)}</b></div>
        {ritmo && <p className="lnota" role="status">{ritmoTxt(ritmo, g)}{ritmo.estado !== "batida" && ritmo.estado !== "semInicio" && ritmo.falta > 0 ? ` · para chegar em ${c.target!.slice(5)}/${c.target!.slice(2, 4)}, guarde ${RM(ritmo.porMes, g)} por mês` : ""}</p>}
        {bancos.length > 0 && <div className="lgrupo"><h3 className="pph">Onde está o dinheiro</h3>
          <ul className="ppext">{bancos.map(x => <li key={x.banco || "-"}><span className="mbank">{x.banco || "Sem banco definido"}</span><b>{(["BRL", "EUR", "USD"] as const).filter(m => x.saldo[m]).map(m => RM(x.saldo[m], m)).join(" + ")}</b></li>)}</ul></div>}
        <div className="lgrupo">
          {est && <div className="lseg" role="group" aria-label="Moeda do valor">
            {([["BRL", "R$"], [g, simbolo]] as [MoedaCx, string][]).map(([k, n]) => <button key={k} type="button" aria-pressed={ent === k} onClick={() => setEnt(k)}>{n}</button>)}
          </div>}
          <div className="lduas">
            <label>Valor ({ent === "BRL" ? "R$" : simbolo})<input inputMode="decimal" value={v} onChange={e => setV(e.target.value)} placeholder="0,00" aria-invalid={msg ? true : undefined} /></label>
            <label>Data<input type="date" value={d} onChange={e => setD(e.target.value)} /></label>
          </div>
          {est && <label>Cotação usada (R$ por {simbolo})<input inputMode="decimal" value={rt} onChange={e => setRt(e.target.value)} placeholder={hojeCot ? hojeCot.toFixed(4).replace(".", ",") : "ex.: 6,10"} /></label>}
          {dica && <p className="lnota" role="status">{dica}</p>}
          <label>Em qual banco (opcional)<input value={banco} onChange={e => setBanco(e.target.value)} list="cx-bancos" placeholder="onde o dinheiro está" /></label>
          <datalist id="cx-bancos">{bancosSugeridos(b).map(n => <option key={n} value={n} />)}</datalist>
          {contas.length > 0 && <label>Descontar da conta<select value={conta} onChange={e => setConta(e.target.value)}><option value="">Não mexer no saldo</option>{contas.map(n => <option key={n}>{n}</option>)}</select></label>}
          {msg && <p className="lerro" role="alert">{msg}</p>}
          <div className="lacoes"><button type="button" className="btn principal" onClick={() => mover(1)}>Guardar</button><button type="button" className="btn" onClick={() => mover(-1)}>Tirar</button></div>
        </div>
        <h3 className="pph">Movimentos</h3>
        <MovCx b={b} c={c} onSalvar={onSalvar} />
        <button type="button" className="btn ghost" aria-expanded={edit} onClick={() => setEdit(!edit)}>Editar caixinha (nome, tipo, meta, mês-alvo)</button>
        {edit && <EditarCx b={b} c={c} onSalvar={onSalvar} onFim={() => setEdit(false)} />}
        <button type="button" className="perigo" onClick={() => { if (!ex) setEx(true); else { onSalvar(caixaExcluir(b, c.id)); onFechar(); } }}>{ex ? "Toque de novo para excluir a caixinha" : "Excluir caixinha"}</button>
        <div className="lacoes"><button type="button" className="btn" onClick={onFechar}>Fechar</button></div>
      </div>
    </div>
  );
}

function MovCx({ b, c, onSalvar }: { b: Backup; c: Caixinha; onSalvar: (b: Backup) => void }) {
  const [ab, setAb] = useState<string | null>(null), [sinal, setSinal] = useState<1 | -1>(1), [v, setV] = useState(""), [d, setD] = useState(""), [bk, setBk] = useState(""), [arm, setArm] = useState(false), [msg, setMsg] = useState("");
  const abrir = (m: Caixinha["moves"][number]) => { if (ab === m.id) return setAb(null); setAb(m.id); setSinal(m.cents < 0 ? -1 : 1); setV((Math.abs(m.cents) / 100).toFixed(2).replace(".", ",")); setD(m.date); setBk(m.bank || ""); setArm(false); setMsg(""); };
  if (!c.moves.length) return <p className="vazio">Sem movimentos ainda.</p>;
  return (
    <ul className="ppext">{[...c.moves].sort((a, z) => z.date.localeCompare(a.date)).map(m => {
      const cur = m.cur || "BRL";
      return <li key={m.id}>
        <button type="button" aria-expanded={ab === m.id} onClick={() => abrir(m)}>
          <span>{m.cents < 0 ? "Tirou" : "Guardou"}<em>{dm(m.date)}{m.bank ? " · " + m.bank : ""}{m.brl && m.rate ? ` · ${RM(Math.abs(m.brl))} a R$ ${m.rate.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}` : ""}</em></span>
          <b className={m.cents < 0 ? "neg" : ""}>{RM(Math.abs(m.cents), cur)}</b></button>
        {ab === m.id && (
          <div className="lgrupo">
            <div className="lseg" role="group" aria-label="Tipo do movimento">
              <button type="button" aria-pressed={sinal === 1} onClick={() => setSinal(1)}>Guardou</button>
              <button type="button" aria-pressed={sinal === -1} onClick={() => setSinal(-1)}>Tirou</button>
            </div>
            <div className="lduas">
              <label>Valor ({cur === "BRL" ? "R$" : cur === "EUR" ? "€" : "US$"})<input inputMode="decimal" value={v} onChange={e => setV(e.target.value)} aria-invalid={msg ? true : undefined} /></label>
              <label>Data<input type="date" value={d} onChange={e => setD(e.target.value)} /></label>
            </div>
            <label>Banco<input value={bk} onChange={e => setBk(e.target.value)} list="cx-bancos" placeholder="onde o dinheiro está" /></label>
            {msg && <p className="lerro" role="alert">{msg}</p>}
            <div className="lacoes">
              <button type="button" className="btn principal" onClick={() => { const x = centsDe(v); if (!x) return setMsg("Informe o valor."); onSalvar(caixaEditarMov(b, c.id, m.id, { date: d, cents: sinal * x, bank: bk })); setAb(null); }}>Salvar</button>
              <button type="button" className="perigo" onClick={() => { if (!arm) setArm(true); else { onSalvar(caixaApagarMov(b, c.id, m.id)); setAb(null); } }}>{arm ? "Toque de novo para excluir" : "Excluir"}</button>
            </div>
          </div>)}
      </li>;
    })}</ul>
  );
}

function EditarCx({ b, c, onSalvar, onFim }: { b: Backup; c: Caixinha; onSalvar: (b: Backup) => void; onFim: () => void }) {
  const g = caixaMoeda(c);
  const [nome, setNome] = useState(c.name), [tipo, setTipo] = useState(c.kind || ""), [meta, setMeta] = useState(c.goal ? (c.goal / 100).toFixed(2).replace(".", ",") : ""), [alvo, setAlvo] = useState(c.target || "");
  return (
    <form className="lgrupo" onSubmit={ev => { ev.preventDefault(); onSalvar(caixaEditar(b, c.id, { name: nome, kind: tipo, goal: centsDe(meta), target: alvo })); onFim(); }}>
      <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} /></label>
      <label>Tipo<select value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Sem tipo</option>{CX_TIPOS.map(t => <option key={t.id} value={t.id}>{t.ico} {t.nome}</option>)}</select></label>
      <div className="lduas">
        <label>Meta ({g === "BRL" ? "R$" : g === "EUR" ? "€" : "US$"})<input inputMode="decimal" value={meta} onChange={e => setMeta(e.target.value)} placeholder="sem meta" /></label>
        <label>Mês-alvo<input type="month" value={alvo} onChange={e => setAlvo(e.target.value)} /></label>
      </div>
      <p className="lnota">O mês-alvo mostra se você está no ritmo e quanto guardar por mês. Moeda da meta não muda.</p>
      <div className="lacoes"><button type="submit" className="btn principal">Salvar caixinha</button></div>
    </form>
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
