import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as C from "./engine";
import type { Estado, Pers } from "./engine";
import { MES, MESL, R, dm } from "./format";
import { notaDeSaude, saudeVisivel } from "./saude";
import { marcaDe } from "./marcas";
import { CatIco } from "./icones";
import { catDe } from "./blocos";
import type { Destino } from "./blocos";

const MIN_YM = "2026-09";
const CINZA = "var(--muted)";
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const mCurto = (m: string) => MES[+m.slice(5) - 1];
const mTit = (m: string) => cap(mCurto(m)) + ". de " + m.slice(0, 4);
const monthLabel = (m: string) => cap(MESL[+m.slice(5) - 1]) + " de " + m.slice(0, 4);
type Lim = { livre: number; passou?: number; pct: number } | null | undefined;

const Sv = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const SETA_IN = "M17 7L7 17M7 9v8h8", SETA_OUT = "M7 17L17 7M9 7h8v8";

function Rosca({ parts, tot }: { parts: { c: string; v: number }[]; tot: number }) {
  const r = 42, perim = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg className="dn" viewBox="0 0 120 120" aria-hidden="true">
      <circle r={r} cx="60" cy="60" fill="none" stroke="var(--line)" strokeWidth="16" />
      {parts.map((p, i) => { const l = (p.v / tot) * perim, o = off; off += l;
        return <circle key={i} r={r} cx="60" cy="60" fill="none" stroke={p.c} strokeWidth="16" strokeDasharray={`${Math.max(0, l - 1.5)} ${perim}`} strokeDashoffset={-o} transform="rotate(-90 60 60)" />; })}
    </svg>
  );
}

function CartaoDash({ e, c }: { e: Estado; c: string }) {
  const aberta = C.mesFaturaAberta(e, c) as string, lm = C.limite(e, c) as Lim, atual = C.fatura(e, c, aberta);
  const m = marcaDe(c, e), cor = e.cartoes[c]?.cor || m.cor;
  const sit = (f: { ym: string; aberto: number; total: number; vencida: boolean; cartao: string }): [string, string] => {
    const paga = (e.faturas || []).some(r => r.cartao === f.cartao && r.ym === f.ym && r.paga);
    return f.aberto === 0 && f.total >= 0 && paga ? ["ok", "Paga"] : f.vencida ? ["late", "Vencida"] : f.ym === aberta ? ["open", "Aberta"] : ["next", "Próxima"];
  };
  const fats = [-1, 0, 1].map(d => C.fatura(e, c, C.somaMeses(aberta, d))).filter(f => f.total || f.aberto);
  const compras = e.lancamentos.filter(l => l.cartao === c && l.tipo === "desp").sort((a, b) => (b.compra || b.data).localeCompare(a.compra || a.data)).slice(0, 4);
  const pct = lm ? Math.min(100, lm.pct) : null;
  const doMes = compras.filter(l => (l.compra || l.data).slice(0, 7) === C.mesDe(e.hoje)).reduce((s, l) => s + l.cents, 0);
  const st = { "--cc": cor, color: m.escuro ? "#1A1A1A" : "#fff" } as CSSProperties;
  return (
    <div className="dcard" role="button" tabIndex={0}>
      <span className="dcplast" style={st}>
        {m.logo ? <span className="dclogo" style={{ "--ls": 1 } as CSSProperties} dangerouslySetInnerHTML={{ __html: m.logo.startsWith("<svg") ? m.logo.replace("<svg ", '<svg preserveAspectRatio="xMinYMid meet" ') : m.logo }} /> : <span className="dclogo lt">{m.rotulo}</span>}
        <span className="dcchip" />
        <span className="dcinfo">
          <span><small>Fatura</small><b>{R(atual.total)}</b></span>
          <span><small>Vence</small><b>{dm(atual.vence)}</b></span>
          {lm && <span><small>{lm.passou ? "Acima" : "Livre"}</small><b className={lm.passou ? "neg" : ""}>{R(lm.passou ?? lm.livre)}</b></span>}
        </span>
      </span>
      <span className="mini" style={pct == null ? { visibility: "hidden" } : undefined}><i style={{ width: (pct || 0) + "%", background: (pct || 0) >= 100 ? "var(--neg)" : (pct || 0) >= 80 ? "var(--warn)" : cor }} /></span>
      {fats.length > 0 && <><span className="dsub2">Faturas</span><span className="dfat">{fats.map(f => { const [k, t] = sit(f); return (
        <span key={f.ym} className={"dfr" + (f.ym === aberta ? " cur" : "")}><span>{mTit(f.ym)}</span><em className={"dst " + k}>{t}</em><b>{R(f.total)}</b></span>); })}</span></>}
      {compras.length > 0 && <><span className="dsub2">Últimas compras<em>Neste mês <b>{R(doMes)}</b></em></span>
        <span className="dcmp">{compras.map(l => <span key={l.id} className="dcr"><span><b>{l.nome}</b><small>{dm(l.compra || l.data)}</small></span><b>−{R(l.cents)}</b></span>)}</span></>}
    </div>
  );
}

export function Inicio({ e, pers, nome, onIr, nAvisos = 0, onAbrir, faixa }: {
  e: Estado; pers: Pers; nome: string; onIr: (d: Destino) => void; nAvisos?: number; onAbrir?: (id: string) => void; faixa?: React.ReactNode }) {
  const ym = C.mesDe(e.hoje), r = C.resumoMes(e, ym), n = e.contas.length, recebe = r.entraAinda as number;
  const nota = notaDeSaude(e), mostraSaude = saudeVisivel(nota);
  const [q, setQ] = useState("");
  const car = useRef<HTMLDivElement>(null);
  const f0 = C.somaMeses(ym, -5) < MIN_YM ? MIN_YM : C.somaMeses(ym, -5);
  const ms = [0, 1, 2, 3, 4, 5].map(d => C.somaMeses(f0, d)).map((m: string) => ({ m, r: C.entrou(e, m) as number, d: C.gastou(e, m) as number }));
  const mx = Math.max(1, ...ms.flatMap(x => [x.r, x.d]));
  const gc = C.gastosPorCategoria(e, ym) as { k: string; cents: number }[];
  const tot = gc.reduce((s, x) => s + x.cents, 0);
  const top = gc.slice(0, 5).map(x => ({ ...x, ...catDe(x.k, "desp", pers) }));
  const resto = tot - top.reduce((s, x) => s + x.cents, 0);
  if (resto > 0) top.push({ k: "_", cents: resto, n: "Outras categorias", c: CINZA });
  const cartoes = C.cartoesDeCredito(e) as string[];
  const ult = e.lancamentos.slice().sort((a, b) => (b.compra || b.caiu || b.data).localeCompare(a.compra || a.caiu || a.data) || (b.id || "").localeCompare(a.id || "")).slice(0, 7);
  const sc = { pos: "var(--pos)", accent: "var(--c1)", warn: "var(--warn)", neg: "var(--neg)" }[nota.tom as "pos"] || "var(--pos)";
  return (
    <main id="pHome">
      {faixa}
      <div className="dtop">
        <button className="dlogo" id="dMenu" aria-label="Abrir o menu" onClick={() => onIr("menu")}><img src="tostao-logo.png" alt="" /><svg className="dham" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
        <div><b className="dgr">Olá{nome ? ", " + nome : ""}</b><small>{cap(new Date(e.hoje + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }))}</small></div>
        <label className="dsearch" onClick={() => { if (window.matchMedia("(max-width:979px)").matches) onIr("busca"); }}>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input id="dashQ" placeholder="Buscar lançamentos…" autoComplete="off" value={q} onChange={ev => setQ(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") onIr("busca"); }} />
        </label>
        <button className="dbell" id="hBell2" aria-label={nAvisos ? `Avisos (${nAvisos})` : "Avisos"} onClick={() => onIr("avisos")}><Sv d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" />{nAvisos > 0 && <b className="dbn" aria-hidden="true">{nAvisos > 9 ? "9+" : nAvisos}</b>}</button>
      </div>
      <div className={"dgrid" + (mostraSaude ? "" : " nosaude")}>
        <section className="db d-saldo">
          <h3>Saldo total <button className="dlink" onClick={() => onIr("contas")}>Ver contas</button></h3>
          <b className="dbig">{R(C.naConta(e))}</b>
          <small className="dsub">{n ? `${n} ${n === 1 ? "conta ativa" : "contas ativas"}` : "sem conta cadastrada"}</small>
          <span className="dqa">
            <button type="button" data-dqa="rec" onClick={() => onIr("lancar-rec")}><Sv d={SETA_IN} />Receita</button>
            <button type="button" data-dqa="desp" onClick={() => onIr("lancar-desp")}><Sv d={SETA_OUT} />Despesa</button>
          </span>
        </section>
        <section className="db d-res">
          <h3>Resumo do mês <small>{monthLabel(ym)}</small></h3>
          <div className="drs">
            <div className="drc in"><span><Sv d={SETA_IN} />Entrou</span><b>{R(r.entrou)}</b><small>{recebe ? <>a receber <span className="nw">{R(recebe)}</span></> : "tudo recebido"}</small></div>
            <div className="drc out"><span><Sv d={SETA_OUT} />Gastou</span><b>{R(r.gastou)}</b><small>{r.aPagar ? <>a pagar <span className="nw">{R(r.aPagar)}</span></> : "tudo pago"}</small></div>
            <div className={"drc " + (r.sobra >= 0 ? "in" : "out")}><span><Sv d="M12 3v18M5 8h14M7 8l-3 7h6zM17 8l-3 7h6z" />{r.sobra >= 0 ? "Sobra" : "Falta"}</span><b>{R(Math.abs(r.sobra))}</b><small>{r.entrou > 0 ? `${Math.round(Math.abs(r.sobra) / r.entrou * 100)}% da receita` : "sem receita no mês"}</small></div>
          </div>
        </section>
        {mostraSaude && (
          <section className="db d-saude">
            <h3>Nota de saúde</h3>
            <div className="dsc2"><b>{nota.score}</b><span>/100</span><em className="dbadge" style={{ "--bc": sc } as CSSProperties}>{nota.rotulo}</em></div>
            <span className="dbar"><i style={{ width: nota.score + "%", background: sc }} /></span>
            <p className="dwhy">{nota.motivos.length ? <><b>Por onde começar:</b> {nota.motivos.join(". ")}.</> : "Tudo em dia. Continue assim."}</p>
          </section>
        )}
        <section className="db d-fluxo">
          <h3>Fluxo de caixa <span className="flleg"><span><i className="r" />Entrou</span><span><i className="d" />Gastou</span></span></h3>
          <div className="fl">{ms.map(x => (
            <div key={x.m} className={"flc" + (x.m === ym ? " now" : "")}><div className="flb"><i className="r" style={{ height: (x.r / mx) * 100 + "%" }} /><i className="d" style={{ height: (x.d / mx) * 100 + "%" }} /></div><small>{cap(mCurto(x.m))}</small></div>
          ))}</div>
        </section>
        <section className="db d-gastos">
          <h3>Gastos</h3>
          {tot ? (
            <div className="dnw">
              <div className="dnb"><Rosca parts={top.map(x => ({ c: x.c, v: x.cents }))} tot={tot} />
                <div className="dnc"><small>Maior gasto</small><b>{((top[0].cents / tot) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b><small className="dnn">{top[0].n}</small></div></div>
              <ul className="dleg">{top.map(x => <li key={x.k} title={Math.round((x.cents / tot) * 100) + "%"}><i style={{ background: x.c }} /><span>{x.n}</span><b>{R(x.cents)}</b><em>{Math.round((x.cents / tot) * 100)}%</em></li>)}</ul>
            </div>
          ) : <p className="dempty">Nenhum gasto neste mês ainda.</p>}
        </section>
        <section className="db d-cartoes">
          <h3>Cartões <button className="dlink" onClick={() => onIr("cartoes")}>Ver cartões</button></h3>
          {cartoes.length ? (
            <div className="dcar"><div className="dcards" id="dcar" ref={car}>{cartoes.map(c => <CartaoDash key={c} e={e} c={c} />)}</div></div>
          ) : <p className="dempty">Nenhum cartão ainda.</p>}
        </section>
        <section className="db d-trans">
          <h3>Últimas transações <button className="dlink" onClick={() => onIr("transacoes")}>Ver todas</button></h3>
          {ult.length ? ult.map(l => (
            <div key={l.id} className="item dtr" role="button" tabIndex={0} onClick={() => onAbrir?.(l.id)}>
              <CatIco k={l.cat || (C.SEM_CATEGORIA as Record<string, string>)[l.tipo]} t={l.tipo} pers={pers} />
              <span className="dtn"><b>{l.nome}</b><small>{catDe(l.cat || (C.SEM_CATEGORIA as Record<string, string>)[l.tipo], l.tipo, pers).n} · {l.cartao || (l.tipo === "rec" ? "Conta" : l.pagoCom || l.conta || "")}</small></span>
              <span className="dtv"><b className={l.tipo === "rec" ? "pos" : ""}>{l.tipo === "rec" ? "+" : "−"}{R(l.cents)}</b><small>{dm(l.compra || l.caiu || l.data)}</small></span>
            </div>
          )) : <p className="dempty">Sem lançamentos.</p>}
        </section>
      </div>
    </main>
  );
}
