import { useState } from "react";
import type { Estado, Pers } from "./engine";
import * as C from "./engine";
import { ano, porCategoria } from "./relatorios";
import { catDe } from "./blocos";
import { R, MES, mLab } from "./format";
import "./relatorios.css";

export function Relatorios({ e, pers, onVoltar }: { e: Estado; pers: Pers; onVoltar: () => void }) {
  const cur = C.mesDe(e.hoje), [de, setDe] = useState(C.somaMeses(cur, 0)), [sel, setSel] = useState(cur);
  const L = ano(e, de), cats = porCategoria(e, sel), tot = cats.reduce((s, x) => s + x.cents, 0);
  const ate = L.reduce((s, x) => s + x.sobra, 0), max = Math.max(1, ...L.map(x => Math.max(x.entrou, x.gastou)));
  const lab = (ym: string) => MES[+ym.slice(5) - 1] + "/" + ym.slice(2, 4);
  return (
    <main className="pg rel">
      <button type="button" className="btn voltar" onClick={onVoltar}>‹ Metas</button>
      <h1>Relatórios</h1>
      <div className="relnav" role="group" aria-label="Período">
        <button type="button" className="btn" aria-label="Meses anteriores" onClick={() => setDe(C.somaMeses(de, -6))}>‹</button>
        <b>{lab(L[0].ym)} a {lab(L[11].ym)}</b>
        <button type="button" className="btn" aria-label="Próximos meses" onClick={() => setDe(C.somaMeses(de, 6))}>›</button>
      </div>
      <section aria-labelledby="rm"><h2 id="rm">Mês a mês <span className="dim">sobra no período {R(ate)}</span></h2>
        <ul className="rlista">{L.map(x => (
          <li key={x.ym}><button type="button" className={"rrow" + (x.ym === sel ? " on" : "")} aria-pressed={x.ym === sel} onClick={() => setSel(x.ym)}>
            <span className="rmes">{lab(x.ym)}{x.atual ? " · hoje" : ""}</span>
            <span className="rbars" aria-hidden="true"><i className="e" style={{ width: (x.entrou / max) * 100 + "%" }} /><i className="g" style={{ width: (x.gastou / max) * 100 + "%" }} /></span>
            <span className="rv"><small>entrou {R(x.entrou)} · saiu {R(x.gastou)}</small><b className={x.sobra < 0 ? "neg" : ""}>{x.sobra < 0 ? "−" : ""}{R(Math.abs(x.sobra))}</b></span>
          </button></li>))}</ul>
      </section>
      <section aria-labelledby="rc"><h2 id="rc">Por categoria · {mLab(sel)} <span className="dim">{R(tot)}</span></h2>
        {cats.length ? <ul className="rlista">{cats.map(x => {
          const c = x.k === "_falta" ? { n: "Fatura além dos itens", c: "#8A8F98" } : catDe(x.k, "desp", pers);
          return <li key={x.k} className="rcat"><span className="ic" style={{ background: c.c }} aria-hidden="true">{c.n[0]}</span><span className="dtn"><b>{c.n}</b>
            <i className="mbar" style={{ ["--p" as string]: Math.round((x.cents / tot) * 100) + "%" }} /></span><b>{R(x.cents)}</b></li>;
        })}</ul> : <p className="vazio">Nada gasto neste mês.</p>}
      </section>
    </main>
  );
}
