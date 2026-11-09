import { useState } from "react";
import * as C from "./engine";
import type { Estado, Pers } from "./engine";
import { Marca, catDe } from "./blocos";
import type { Destino } from "./blocos";
import { movimentos } from "./movimentos";
import type { Transf } from "./loja";
import { FILTRO0, contasEmReal, fluxoDoMes } from "./contas";
import type { Filtro, Linha, Tipo } from "./contas";
import { dataLonga, dm, mLab, pct1, R } from "./format";
import "./contas.css";

const TIPOS: [Tipo, string][] = [["tudo", "Tudo"], ["entradas", "Entradas"], ["saidas", "Saídas"]];
const ICO_BUSCA = "M11 5a6 6 0 100 12 6 6 0 000-12zM20 20l-4-4";
const ICO_FILTRO = "M4 6h16M7 12h10M10 18h4";
const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

function Item({ x, e, pers, onIr, onEdit, data }: { x: Linha; e: Estado; pers: Pers; onIr: (d: Destino) => void; onEdit?: (id: string) => void; data?: boolean }) {
  const c = x.tipo === "fatura" ? { n: "Cartão", c: "#5b6b9a" }
    : x.tipo === "previsto" ? { n: "Previsto", c: "#8A8F98" }
    : catDe(x.cat || (C.SEM_CATEGORIA as Record<string, string>)[x.rec ? "rec" : "desp"], x.rec ? "rec" : "desp", pers);
  const quando = data ? dm(x.data) : "";
  const sit = x.atrasada ? "atrasado" : x.pago ? (x.rec ? "" : "pago ✓") : "";
  const sub = [quando, x.tipo === "fatura" ? "cartão" : c.n, sit, x.parte ? `parte ${x.parte.i} de ${x.parte.n} · total ${R(x.parte.tot)}` : "", ...(x.tags || []).map(t => "#" + t)].filter(Boolean).join(" · ");
  const corpo = (
    <>
      {x.tipo === "fatura" ? <Marca nome={x.cartao!} e={e} /> : <span className="ic" style={{ background: c.c }} aria-hidden="true">{x.nome[0]}</span>}
      <span className="dtn"><b>{x.nome}</b><small className={x.atrasada ? "neg" : ""}>{sub}</small></span>
      <span className="cv2">
        <span className={"v " + (x.rec ? "rec" : "")}>{x.rec ? "+" : "−"}{R(x.cents)}</span>
        {x.saldoApos != null && <small className={x.saldoApos < 0 ? "neg" : ""}>{x.saldoApos < 0 ? "falta " + R(-x.saldoApos) : "sobra " + R(x.saldoApos)}</small>}
      </span>
    </>
  );
  return <li>{x.tipo === "fatura"
    ? <button type="button" className="crow" onClick={() => onIr("cartoes")}>{corpo}</button>
    : x.tipo === "lanc" && onEdit ? <button type="button" className="crow" aria-label={`Editar ${x.nome}`} onClick={() => onEdit(x.id)}>{corpo}</button>
    : <div className="crow">{corpo}</div>}</li>;
}

function MovConta({ e, nome, transf, onFechar }: { e: Estado; nome: string; transf: Transf[]; onFechar: () => void }) {
  const m = movimentos(e, nome, transf);
  return (
    <section className="cb cb-mov" aria-label={`Movimentos de ${nome}`}>
      <h3>{nome} <button type="button" className="dlink" onClick={onFechar}>Fechar</button></h3>
      <ul>
        {m.linhas.map(x => (
          <li key={x.id} className="crow"><span className="dtn"><b>{x.nome}</b><small>{dm(x.data)}{x.extra ? " · " + x.extra : ""}</small></span>
            <span className="cv2"><span className={"v " + (x.cents > 0 ? "rec" : "")}>{x.cents > 0 ? "+" : "−"}{R(Math.abs(x.cents))}</span><small className={x.saldoApos < 0 ? "neg" : ""}>saldo {R(x.saldoApos)}</small></span></li>
        ))}
        <li className="crow"><span className="dtn"><b>Saldo informado</b><small>ponto de partida</small></span><span className="cv2"><span className="v">{R(m.informado)}</span></span></li>
      </ul>
      {m.linhas.length === 0 && <p className="vazio">Nada mexeu nesta conta depois do saldo informado.</p>}
    </section>
  );
}

export function Contas({ e, pers, onIr, onEdit, transf = [], onTransf, onExtrato, onPatri }: { e: Estado; pers: Pers; onIr: (d: Destino) => void; onEdit?: (id: string) => void; transf?: Transf[]; onTransf?: () => void; onExtrato?: () => void; onPatri?: () => void }) {
  const hoje = C.mesDe(e.hoje), min = C.mesDe(e.inicio || e.hoje);
  const [ym, setYm] = useState(hoje);
  const [f, setF] = useState<Filtro>(FILTRO0);
  const [painel, setPainel] = useState<"" | "busca" | "filtro">("");
  const [conta, setConta] = useState("");
  const [vista, setVista] = useState<"lista" | "cat">("lista");
  const contas = contasEmReal(e), r = C.resumoMes(e, ym), fx = fluxoDoMes(e, ym, f);
  const gc = C.gastosPorCategoria(e, ym) as { k: string; cents: number }[];
  const totG = gc.reduce((s, x) => s + x.cents, 0);
  const sai = r.pago + r.aPagar, pPago = sai ? (r.pago / sai) * 100 : 0;
  const tem = fx.futuro.length + fx.passado.length > 0;
  const filtrando = f.tipo !== "tudo" || !!f.cat || !!f.q;
  const toggle = (p: "busca" | "filtro") => setPainel(painel === p ? "" : p);
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
      <div className="cgrid" data-v={vista}>
        <section className="cb cb-saldo" aria-label="Saldos">
          <h3>Na conta hoje</h3>
          <b className="dbig">{R(C.naConta(e))}</b>
          {contas.length > 0 && <ul className="clist">{contas.map(a => <li key={a.nome}><button type="button" className="cabtn" aria-expanded={conta === a.nome} onClick={() => setConta(conta === a.nome ? "" : a.nome)}><Marca nome={a.nome} e={e} /><span>{a.nome}</span><b>{R(C.saldoDaConta(e, a.nome))}</b></button></li>)}</ul>}
          {onTransf && contas.length >= 2 && <button type="button" className="dlink ctransf" onClick={onTransf}>Transferências entre contas ›</button>}
          {onExtrato && <button type="button" className="dlink ctransf" onClick={onExtrato}>Importar PDF, extrato ou fatura ›</button>}
          {onPatri && <button type="button" className="dlink ctransf" onClick={onPatri}>Patrimônio ›</button>}
          {r.fimDoMes != null && <p className="cfim">Fim de {mLab(ym).split(" de ")[0]}: <b>{R(r.fimDoMes)}</b></p>}
          {fx.vermelho && <p className="cred" role="status">Fica no vermelho em {dm(fx.vermelho.data)}, depois de “{fx.vermelho.nome}”.</p>}
        </section>
        {conta && <MovConta e={e} nome={conta} transf={transf} onFechar={() => setConta("")} />}
        <section className="cb cb-res" aria-label="Resumo do mês">
          <p className="cres"><b>Entrou {R(r.entrou)}</b> · Pago {R(r.pago)} · Falta pagar {R(r.aPagar)}</p>
          <span className="cbar" role="img" aria-label={`Pago ${R(r.pago)} de ${R(sai)} que sai no mês`}><i style={{ width: pPago + "%" }} /></span>
        </section>
        <section className="cb cb-lista" aria-label="Lançamentos do mês">
          <div className="ctool">
            <button type="button" aria-expanded={painel === "busca"} onClick={() => toggle("busca")}><Ico d={ICO_BUSCA} />Buscar</button>
            <button type="button" aria-expanded={painel === "filtro"} onClick={() => toggle("filtro")}><Ico d={ICO_FILTRO} />Filtrar{filtrando && f.tipo !== "tudo" || f.cat ? " •" : ""}</button>
            <button type="button" className="ccatbtn" aria-pressed={vista === "cat"} onClick={() => setVista(vista === "cat" ? "lista" : "cat")}>Categorias</button>
          </div>
          {painel === "busca" && <div className="cpainel"><label className="sr" htmlFor="cq">Buscar nome ou valor</label>
            <input id="cq" type="search" autoFocus placeholder="Nome ou valor" value={f.q} onChange={ev => setF({ ...f, q: ev.target.value })} /></div>}
          {painel === "filtro" && (
            <div className="cpainel">
              <div className="chips" role="group" aria-label="Mostrar">
                {TIPOS.map(([k, t]) => <button key={k} type="button" className="chip" aria-pressed={f.tipo === k} onClick={() => setF({ ...f, tipo: k })}>{t}</button>)}
              </div>
              <label className="sr" htmlFor="ccat">Categoria</label>
              <select id="ccat" value={f.cat} onChange={ev => setF({ ...f, cat: ev.target.value })}>
                <option value="">Todas as categorias</option>
                {fx.cats.map(k => <option key={k} value={k}>{catDe(k, "desp", pers).n}</option>)}
              </select>
            </div>
          )}
          {filtrando && <button type="button" className="dlink climpa" onClick={() => setF(FILTRO0)}>Limpar filtros</button>}

          {fx.futuro.length > 0 && (
            <>
              <h4 className="csec">Ainda vai acontecer <em>{fx.futuro.length}</em></h4>
              <ul>{fx.futuro.map(x => <Item key={x.id} x={x} e={e} pers={pers} onIr={onIr} onEdit={onEdit} data />)}</ul>
            </>
          )}
          {ym === hoje && <div className="chj" role="separator" aria-label={"Hoje, " + dataLonga(e.hoje)}><span>hoje · {dm(e.hoje)}</span></div>}
          {fx.passado.length > 0 && (
            <>
              <h4 className="csec">Já aconteceu</h4>
              {fx.passado.map(d => (
                <div key={d.data} className="cdia">
                  <h5><span>{dataLonga(d.data)}</span><em className={d.total < 0 ? "" : "pos"}>{d.total < 0 ? "−" : "+"}{R(Math.abs(d.total))}</em></h5>
                  <ul>{d.linhas.map(x => <Item key={x.id} x={x} e={e} pers={pers} onIr={onIr} onEdit={onEdit} />)}</ul>
                </div>
              ))}
            </>
          )}
          {!tem && <p className="vazio">{filtrando ? "Nada encontrado com esse filtro." : `Nada lançado em ${mLab(ym)}.`}</p>}
        </section>
        <section className="cb cb-cat" aria-label="Gastos por categoria">
          <h3>Gastos por categoria <button type="button" className="dlink cvolta" onClick={() => setVista("lista")}>‹ Lançamentos</button></h3>
          {totG ? <ul className="ccat">{gc.map(x => { const c = catDe(x.k, "desp", pers), p = (x.cents / totG) * 100; return (
            <li key={x.k}><span className="ic" style={{ background: c.c }} aria-hidden="true">{c.n[0]}</span>
              <span className="cn"><b>{c.n}</b><span className="mini" role="presentation"><i style={{ width: p + "%", background: c.c }} /></span></span>
              <span className="cv"><b>{R(x.cents)}</b><small>{pct1(p)}%</small></span></li>); })}</ul>
            : <p className="vazio">Nada gasto em {mLab(ym)}.</p>}
        </section>
      </div>
    </div>
  );
}
