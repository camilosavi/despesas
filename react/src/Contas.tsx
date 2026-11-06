import { useState } from "react";
import * as C from "./engine";
import type { Estado, Pers } from "./engine";
import { catDe } from "./blocos";
import type { Destino } from "./blocos";
import { contasEmReal, linhasDoMes, porDia } from "./contas";
import type { Filtro, Linha } from "./contas";
import { dataLonga, mLab, pct1, R } from "./format";
import "./contas.css";

const FILTROS: [Filtro, string][] = [["todos", "Todos"], ["apagar", "A pagar"], ["pagos", "Pagos"], ["receitas", "Receitas"]];

function Item({ x, pers, onIr }: { x: Linha; pers: Pers; onIr: (d: Destino) => void }) {
  const c = x.tipo === "fatura" ? { n: "Cartão", c: "#5b6b9a" } : catDe(x.cat || (C.SEM_CATEGORIA as Record<string, string>)[x.rec ? "rec" : "desp"], x.rec ? "rec" : "desp", pers);
  const sit = x.rec ? "" : x.pago ? "paga ✓" : x.atrasada ? "atrasada" : "a pagar";
  const corpo = (
    <>
      <span className="ic" style={{ background: c.c }} aria-hidden="true">{x.nome[0]}</span>
      <span className="dtn"><b>{x.nome}</b><small className={x.atrasada ? "neg" : ""}>{x.tipo === "fatura" ? "Cartão · " : ""}{c.n !== "Cartão" ? c.n : ""}{sit && c.n !== "Cartão" ? " · " : ""}{sit}</small></span>
      <span className={"v " + (x.rec ? "rec" : "")}>{x.rec ? "+" : "−"}{R(x.cents)}</span>
    </>
  );
  return <li>{x.tipo === "fatura"
    ? <button type="button" className="crow" onClick={() => onIr("cartoes")}>{corpo}</button>
    : <div className="crow">{corpo}</div>}</li>;
}

export function Contas({ e, pers, onIr }: { e: Estado; pers: Pers; onIr: (d: Destino) => void }) {
  const hoje = C.mesDe(e.hoje), min = C.mesDe(e.inicio || e.hoje);
  const [ym, setYm] = useState(hoje);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aba, setAba] = useState<"lanc" | "cat">("lanc");
  const [q, setQ] = useState("");
  const contas = contasEmReal(e), r = C.resumoMes(e, ym);
  const dias = porDia(linhasDoMes(e, ym, filtro, q));
  const gc = C.gastosPorCategoria(e, ym) as { k: string; cents: number }[];
  const totG = gc.reduce((s, x) => s + x.cents, 0);
  return (
    <div className="pg cts">
      <header className="dtop">
        <h1 className="ctit">Contas</h1>
        <nav className="mnav" aria-label="Mês">
          <button type="button" aria-label="Mês anterior" disabled={ym <= min} onClick={() => setYm(C.somaMeses(ym, -1))}>‹</button>
          <span aria-live="polite">{mLab(ym)}</span>
          <button type="button" aria-label="Próximo mês" onClick={() => setYm(C.somaMeses(ym, 1))}>›</button>
        </nav>
      </header>
      <div className="cgrid">
        <section className="cb cb-saldo" aria-label="Saldos">
          <h3>Na conta hoje</h3>
          <b className="dbig">{R(C.naConta(e))}</b>
          {contas.length > 0 && <ul className="clist">{contas.map(a => <li key={a.nome}><span>{a.nome}</span><b>{R(C.saldoDaConta(e, a.nome))}</b></li>)}</ul>}
          {r.fimDoMes != null && <small className="dsub">Fim de {mLab(ym).split(" de ")[0]}: {R(r.fimDoMes)}</small>}
        </section>
        <section className="cb cb-res" aria-label="Resumo do mês">
          <h3>{mLab(ym)}</h3>
          <div className="drs">
            <div className="drc"><span>Entrou</span><b>{R(r.entrou)}</b></div>
            <div className="drc out"><span>Pago</span><b>{R(r.pago)}</b></div>
            <div className="drc sob"><span>A pagar</span><b>{R(r.aPagar)}</b></div>
          </div>
        </section>
        <section className="cb cb-lista" aria-label="Lançamentos do mês">
          <div className="cbusca"><label className="sr" htmlFor="cq">Buscar lançamento</label>
            <input id="cq" type="search" placeholder="Buscar nome ou valor" value={q} onChange={ev => setQ(ev.target.value)} /></div>
          <div className="chips" role="group" aria-label="Filtro">
            {FILTROS.map(([k, t]) => <button key={k} type="button" className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t}</button>)}
          </div>
          <div className="mseg" role="tablist" aria-label="Visão">
            <button type="button" role="tab" aria-selected={aba === "lanc"} onClick={() => setAba("lanc")}>Lançamentos</button>
            <button type="button" role="tab" aria-selected={aba === "cat"} onClick={() => setAba("cat")}>Categorias</button>
          </div>
          {aba === "lanc" ? (
            dias.length ? dias.map(d => (
              <div key={d.data} className="cdia">
                <h4><span>{dataLonga(d.data)}</span><em className={d.total < 0 ? "" : "pos"}>{d.total < 0 ? "−" : "+"}{R(Math.abs(d.total))}</em></h4>
                <ul>{d.linhas.map(x => <Item key={x.id} x={x} pers={pers} onIr={onIr} />)}</ul>
              </div>
            )) : <p className="vazio">{q || filtro !== "todos" ? "Nada encontrado com esse filtro." : `Nada lançado em ${mLab(ym)}.`}</p>
          ) : (
            totG ? <ul className="ccat">{gc.map(x => { const c = catDe(x.k, "desp", pers), p = (x.cents / totG) * 100; return (
              <li key={x.k}><span className="ic" style={{ background: c.c }} aria-hidden="true">{c.n[0]}</span>
                <span className="cn"><b>{c.n}</b><span className="mini" role="presentation"><i style={{ width: p + "%", background: c.c }} /></span></span>
                <span className="cv"><b>{R(x.cents)}</b><small>{pct1(p)}%</small></span></li>); })}</ul>
              : <p className="vazio">Nada gasto em {mLab(ym)}.</p>
          )}
          <small className="vazio cfoot">Compras no cartão aparecem dentro da fatura; os totais já contam todas.</small>
        </section>
      </div>
    </div>
  );
}
