import { useState } from "react";
import type { Backup } from "./loja";
import { ajuste, holApagar, holNaoUsar, holerites, modo, plano, previstos, salAjustarMes, salAumento, salExtras, salModo, seg13, somaMes, terco } from "./salario";
import type { Evt, Hol } from "./salario";
import { centsDe } from "./Lancar";
import { R, MES, dm } from "./format";
import "./lancar.css";
import "./pessoas.css";
import "./metas.css";
import "./fixos.css";

const ml = (ref: string) => MES[+ref.slice(5) - 1];
const bonito = (d: string) => d.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, c) => a + c.toUpperCase());
const dig = (c?: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");
// adiantamento descontado na folha: o líquido já vem sem ele, então salário do mês = líquido + adiantamento
const adv = (h: Hol) => h.ev.filter(e => e.s === "d" && /ADIANT/i.test(e.d) && !/13/.test(e.d)).reduce((s, e) => s + e.c, 0);

interface Props { b: Backup | null; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void; onVoltar: () => void }
export function Fixos({ b, hoje, onSalvar, onAviso, onVoltar }: Props) {
  if (!b) return (
    <main className="pg metas fixos"><button type="button" className="btn" onClick={onVoltar}>‹ Metas</button><h1>Fixos</h1>
      <p className="vazio">Escolha “Começar do zero” ou “Usar meus dados” para ver o salário previsto.</p></main>
  );
  const P = plano(b), m = modo(b), hs = holerites(b), ym = hoje.slice(0, 7);
  const prox = [ym, somaMes(ym, 1), somaMes(ym, 2)].flatMap(x => previstos(b, x, hoje));
  return (
    <main className="pg metas fixos">
      <button type="button" className="btn" onClick={onVoltar}>‹ Metas</button>
      <h1>Fixos</h1>
      <section aria-labelledby="fs">
        <h2 id="fs">Salário previsto {P && <span className="dim">{P.n} holerites · {ml(P.from)} a {ml(P.to)}</span>}</h2>
        {!P ? <p className="vazio">Precisa de 2 ou mais holerites lidos. Importe os PDFs no app atual (a leitura de PDF ainda não veio para esta versão) e eles aparecem aqui ao usar seus dados.</p> : <>
          <div className="lseg" role="group" aria-label="Previsão">
            {([["off", "Não usar"], ["base", "Só o fixo"], ["avg", "Com a média"]] as const).map(([k, n]) => <button key={k} type="button" aria-pressed={m === k} onClick={() => onSalvar(salModo(b, k))}>{n}</button>)}
          </div>
          <div className="fxcards">{([["base", "Só o fixo", P.base], ["avg", "Com a média", P.avg]] as const).map(([k, n, v]) => (
            <div key={k} className={m === k ? "on" : ""}><small>{n} · no mês</small><b>{R(v + P.adv)}</b><em>{P.adv ? `${R(P.adv)} dia 15 + ${R(v)} no fim do mês` : "folha no fim do mês"}</em></div>))}</div>
          <p className="mdica">Folha que caiu: {P.real.map(r => `${ml(r.ref)} ${R(r.liq)}`).join(" · ")}</p>
          {prox.length > 0 && m !== "off" && <ul className="ppext">{prox.map(p => <Prev key={p.id} p={p} b={b} onSalvar={onSalvar} />)}</ul>}
          <details className="fxdet"><summary>O que é fixo e o que varia</summary>
            <Grupo t="Fixo (todo mês igual)" ev={P.fix.filter(e => e.s === "p")} />
            {P.adv > 0 && <Linha e={{ s: "d", d: "Adiantamento quinzenal", c: P.adv }} />}
            {P.taxB > 0 && <Linha e={{ s: "d", d: `I.N.S.S. (~${(P.rate * 100).toFixed(1).replace(".", ",")}%)`, c: P.taxB }} />}
            {P.fix.filter(e => e.s === "d").map(e => <Linha key={e.d} e={e} />)}
            {P.vari.length > 0 && <Grupo t="Varia (média por mês)" ev={P.vari} n={P.n} />}
          </details>
          <details className="fxdet"><summary>Aumento, 13º e férias</summary><Extras b={b} P={P} hoje={hoje} onSalvar={onSalvar} onAviso={onAviso} /></details>
        </>}
      </section>
      <section aria-labelledby="fh">
        <h2 id="fh">Holerites lidos <span className="dim">{hs.length || ""}</span></h2>
        {hs.length ? <HolLista b={b} hs={hs} onSalvar={onSalvar} /> : <p className="vazio">Nenhum holerite lido ainda.</p>}
      </section>
    </main>
  );
}

const Linha = ({ e }: { e: Evt }) => <div className="fxl"><span>{bonito(e.d)}{e.seen != null ? ` · ${e.seen}` : ""}</span><b className={e.s === "d" ? "neg" : ""}>{e.s === "d" ? "− " : ""}{R(e.c)}</b></div>;
const Grupo = ({ t, ev, n }: { t: string; ev: Evt[]; n?: number }) => <><h3 className="pph">{t}{n ? ` · ${n} meses` : ""}</h3>{ev.map(e => <Linha key={e.s + e.d} e={e} />)}</>;

function Prev({ p, b, onSalvar }: { p: ReturnType<typeof previstos>[number]; b: Backup; onSalvar: (b: Backup) => void }) {
  const [ab, setAb] = useState(false), [v, setV] = useState(dig(p.cents));
  return (
    <li><button type="button" aria-expanded={ab} onClick={() => setAb(!ab)}><span>{p.desc}<em>cai em {dm(p.caiu || p.data)}</em></span><b>{R(p.cents)}</b></button>
      {ab && <div className="lgrupo">
        <label>Valor só deste mês<input inputMode="decimal" value={v} onChange={e => setV(e.target.value)} /></label>
        <div className="lacoes">
          <button type="button" className="btn principal" onClick={() => { const c = centsDe(v); if (c > 0) onSalvar(salAjustarMes(b, p.id, { c })); }}>Salvar valor</button>
          {p.ov && <button type="button" className="btn" onClick={() => onSalvar(salAjustarMes(b, p.id, null))}>Voltar ao previsto ({R(p.orig ?? 0)})</button>}
          <button type="button" className="btn" onClick={() => onSalvar(salAjustarMes(b, p.id, { skip: 1 }))}>Não vai cair</button>
        </div></div>}
    </li>
  );
}

function Extras({ b, P, hoje, onSalvar, onAviso }: { b: Backup; P: NonNullable<ReturnType<typeof plano>>; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void }) {
  const r = b.cfg.salRaise || {}, X = b.cfg.salX || {};
  const [from, setFrom] = useState<string>(r.from || ""), [gross, setGross] = useState(dig(r.gross)), [net, setNet] = useState(dig(r.net));
  const [d13, setD13] = useState(dig(X.d13)), [fer, setFer] = useState<string>(X.fer || "");
  const salvar = () => {
    const g = centsDe(gross), n = centsDe(net);
    if ((g || n) && !from) return onAviso("Escolha a partir de qual folha vale o aumento.");
    onSalvar(salExtras(salAumento(b, g || n ? { from, ...(g ? { gross: g } : {}), ...(n ? { net: n } : {}) } : null), { d13: centsDe(d13) || undefined, fer: fer || undefined }));
    onAviso("Salvo.");
  };
  const A = ajuste(P, b, from || "9999");
  return (
    <div className="lgrupo">
      <div className="lduas"><label>Folha de<input type="month" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Novo bruto<input inputMode="decimal" value={gross} onChange={e => setGross(e.target.value)} placeholder="R$ 0,00" /></label></div>
      <label>ou líquido no mês (adiantamento + folha)<input inputMode="decimal" value={net} onChange={e => setNet(e.target.value)} placeholder="opcional" /></label>
      {A.up && <p className="mdica">Com o aumento: {R(A.adv + A.avg)} no mês.</p>}
      <label>13º, 2ª parcela (estimativa {R(seg13(P, b, hoje.slice(0, 4)))})<input inputMode="decimal" value={d13} onChange={e => setD13(e.target.value)} placeholder="se souber o valor" /></label>
      <label>Mês das férias (terço ≈ {R(terco(P))})<input type="month" value={fer} onChange={e => setFer(e.target.value)} /></label>
      <div className="lacoes"><button type="button" className="btn principal" onClick={salvar}>Salvar</button>
        {(r.from || X.d13 || X.fer) && <button type="button" className="btn" onClick={() => { onSalvar(salExtras(salAumento(b, null), null)); setFrom(""); setGross(""); setNet(""); setD13(""); setFer(""); }}>Limpar</button>}</div>
      <p className="mdica">É estimativa: com aumento grande o INSS sobe de faixa e pode entrar imposto de renda. Some quando o holerite de verdade é lançado.</p>
    </div>
  );
}

function HolLista({ b, hs, onSalvar }: { b: Backup; hs: Hol[]; onSalvar: (b: Backup) => void }) {
  const [aberto, setAberto] = useState<string | null>(null), [ex, setEx] = useState(false);
  const folhas = hs.filter(h => h.k === "sal").slice(-8), max = Math.max(1, ...folhas.map(h => h.liq + adv(h)));
  return (
    <>
      {folhas.length > 1 && <div className="fxbar" role="img" aria-label={"Salário do mês: " + folhas.map(h => `${ml(h.ref)} ${R(h.liq + adv(h))}`).join(", ")}>
        {folhas.map(h => <div key={h.ref}><i style={{ height: Math.round(((h.liq + adv(h)) / max) * 100) + "%" }} /><span>{ml(h.ref)}</span></div>)}</div>}
      <ul className="ppext">{[...hs].reverse().map(h => {
        const key = `${h.ref}|${h.k}`, a = adv(h);
        return <li key={key}><button type="button" aria-expanded={aberto === key} onClick={() => { setAberto(aberto === key ? null : key); setEx(false); }}>
          <span>{h.k === "sal" ? "Folha" : h.k === "fer" ? "Férias" : "13º"} · {ml(h.ref)}/{h.ref.slice(0, 4)}<em>{h.x ? "fora do previsto" : a ? `com adiantamento ${R(h.liq + a)}` : (h.emp || "")}</em></span><b>{R(h.liq)}</b></button>
          {aberto === key && <div className="lgrupo">
            {h.ev.map((e, i) => <Linha key={i} e={{ s: e.s, d: e.d, c: e.c }} />)}
            <div className="lacoes">
              {h.k === "sal" && <button type="button" className="btn" onClick={() => onSalvar(holNaoUsar(b, key, !h.x))}>{h.x ? "Usar no previsto" : "Não usar no previsto"}</button>}
              <button type="button" className="perigo" onClick={() => { if (!ex) setEx(true); else { onSalvar(holApagar(b, key)); setAberto(null); } }}>{ex ? "Toque de novo para apagar" : "Apagar dos lidos"}</button>
            </div></div>}</li>;
      })}</ul>
    </>
  );
}
