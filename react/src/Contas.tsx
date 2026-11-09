import { useState } from "react";
import * as C from "./engine";
import type { Estado, Pers } from "./engine";
import { Marca, catDe } from "./blocos";
import type { Destino } from "./blocos";
import { movimentos } from "./movimentos";
import type { Transf } from "./loja";
import { FILTRO0, contasEmReal, fluxoDoMes } from "./contas";
import type { Filtro, Linha, Tipo } from "./contas";
import { dm, mLab, MESL, R } from "./format";
import { CatIco } from "./icones";
import { MES } from "./format";

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

const SV = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const mesNome = (ym: string) => MESL[+ym.slice(5) - 1];
const dia = (d: string, hoje: string) => {
  if (d === hoje) return "Hoje";
  const ont = new Date(hoje + "T12:00:00Z"); ont.setUTCDate(ont.getUTCDate() - 1);
  if (d === ont.toISOString().slice(0, 10)) return "Ontem";
  const w = new Date(d + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${cap(w)}, ${+d.slice(8)} ${MES[+d.slice(5, 7) - 1]}`;
};
type F4 = "all" | "open" | "paid" | "rec";

function Linha1({ x, e, pers, hoje, onIr, onEdit }: { x: Linha; e: Estado; pers: Pers; hoje: string; onIr: (d: Destino) => void; onEdit?: (id: string) => void }) {
  const t = x.rec ? "rec" : "desp", [, m, d] = x.data.split("-");
  const cat = x.cat || (C.SEM_CATEGORIA as Record<string, string>)[t];
  const meta = [x.tipo === "fatura" ? (x.cartao ? "cartão" : "") : catDe(cat, t, pers).n, x.parte ? `parte ${x.parte.i} de ${x.parte.n} · total ${R(x.parte.tot)}` : "", ...(x.tags || []).map(g => "#" + g)].filter(Boolean).join(" · ");
  const pago = x.pago, atras = x.atrasada;
  void hoje;
  return (
    <button type="button" className={"item" + (x.tipo === "fatura" ? " fatrow" : "")} onClick={() => x.tipo === "fatura" ? onIr("cartoes") : x.tipo === "lanc" && onEdit ? onEdit(x.id) : undefined}>
      {x.tipo === "fatura" ? <Marca nome={x.cartao!} e={e} /> : <CatIco k={cat} t={t} pers={pers} />}
      <span className="t"><div className="d"><span className="dn">{x.tipo === "fatura" ? `Fatura ${x.cartao}` : x.nome}</span></div><div className="m"><b>{+d} {MES[+m - 1]}</b>{meta ? " · " + meta : ""}</div></span>
      <span className={"a " + (t === "rec" ? "pos" : "")}>{t === "rec" ? "+ " : ""}{R(x.cents)}
        {t === "desp" && (pago ? <><br /><span className="m pos">{x.tipo === "fatura" ? "paga ✓" : "pago"}</span></> : atras ? <><br /><span className="m neg">atrasada</span></> : <><br /><span className="tag">a pagar</span></>)}
      </span>
    </button>
  );
}

export function Contas({ e, pers, onIr, onEdit, transf = [], onTransf, onExtrato, onPatri, onMenu }: { e: Estado; pers: Pers; onIr: (d: Destino) => void; onEdit?: (id: string) => void; transf?: Transf[]; onTransf?: () => void; onExtrato?: () => void; onPatri?: () => void; onMenu?: () => void }) {
  const hoje = C.mesDe(e.hoje), min = "2026-09";
  const [ym, setYm] = useState(hoje);
  const [f4, setF4] = useState<F4>("all");
  const [cat, setCat] = useState(""), [catOn, setCatOn] = useState(false);
  const [ord, setOrd] = useState<"rec" | "az">("rec");
  const [aba, setAba] = useState<"lanc" | "cats">("lanc");
  const [conta, setConta] = useState("");
  const [q, setQ] = useState("");
  const contas = contasEmReal(e), r = C.resumoMes(e, ym), fx = fluxoDoMes(e, ym, { ...FILTRO0, cat });
  const gc = C.gastosPorCategoria(e, ym) as { k: string; cents: number }[];
  const totG = gc.reduce((s, x) => s + x.cents, 0);
  const sai = r.pago + r.aPagar, pPago = sai ? Math.round((r.pago / sai) * 100) : 0;
  const todas: Linha[] = [...fx.futuro, ...fx.passado.flatMap(d => d.linhas)];
  const L = todas.filter(x => f4 === "all" ? true : f4 === "rec" ? x.rec : f4 === "open" ? !x.rec && !x.pago : !x.rec && !!x.pago);
  const grupos: Record<string, Linha[]> = {};
  L.forEach(x => (grupos[x.data] = grupos[x.data] || []).push(x));
  const datas = Object.keys(grupos).sort().reverse();
  const az = L.slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt"));
  const chip = (k: F4, t: string) => <button key={k} className={"mfp" + (f4 === k ? " on" : "")} onClick={() => setF4(k)}>{t}</button>;
  const cats = fx.cats;
  const nome = mesNome(ym);
  return (
    <>
      <header className="top"><div className="tcard">
        <div className="titlerow">
          <button className="hmenu" id="hMenu" aria-label="Abrir o menu" onClick={onMenu}><SV d="M4 7h16M4 12h16M4 17h16" /></button>
          <h1 id="ptitle">Contas</h1>
        </div>
        <div className="monthpill">
          <button aria-label="Mês anterior" disabled={ym <= min} onClick={() => setYm(C.somaMeses(ym, -1))}>‹</button>
          <span>{cap(mLab(ym))}</span>
          <button aria-label="Próximo mês" onClick={() => setYm(C.somaMeses(ym, 1))}>›</button>
        </div>
        <div className="bigrow"><div><p className="label">Gastou em {nome}</p><div className="big"><small>R$</small>{R(r.gastou).replace("R$ ", "")}</div></div></div>
        <div className="split">
          <div><span>Entrou</span><b className="num">{R(r.entrou)}</b></div>
          <div><span>Fim do mês</span><b className="num">{r.fimDoMes != null ? R(r.fimDoMes) : "—"}</b></div>
        </div>
      </div></header>
      <main id="pMes">
        <div className="msearch" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input id="mSearch" type="search" placeholder="Buscar em todos os meses" aria-label="Buscar lançamentos" autoComplete="off" value={q} onChange={ev => setQ(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") onIr("busca"); }} /></div>
        <div id="mBody">
          <section>
            <h2>Na conta <span className="h2act">
              {onExtrato && <button className="lk" onClick={onExtrato}>Extrato</button>}
              {onTransf && contas.length >= 2 && <button className="lk" onClick={onTransf}>Transferências</button>}
              {onPatri && <button className="lk" onClick={onPatri}>Patrimônio</button>}</span></h2>
            <div className="card">
              {contas.map(a => (
                <div key={a.nome} className="acone" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setConta(conta === a.nome ? "" : a.nome)}>
                  <Marca nome={a.nome} e={e} /><span className="t"><b>{a.nome}</b><span>{a.em ? "atualizado " + (new Date(a.em).toLocaleDateString("sv") === e.hoje ? "hoje" : dm(new Date(a.em).toLocaleDateString("sv"))) : ""}</span></span><span className="v">{R(a.cents)}</span>
                </div>
              ))}
              {contas.length > 1 && <div className="acone"><span className="t"><b>Total</b></span><span className="v">{R(C.naConta(e))}</span></div>}
              {contas.length === 0 && <div className="acone"><span className="t"><b>Sem conta cadastrada</b><span>Adicione uma em Você › Contas e cartões</span></span></div>}
              {fx.vermelho && <div className="limwarn over" role="status" style={{ fontSize: ".88rem" }}>Fica no vermelho em {dm(fx.vermelho.data)}, depois de “{fx.vermelho.nome}”.</div>}
            </div>
          </section>
          {conta && <MovConta e={e} nome={conta} transf={transf} onFechar={() => setConta("")} />}
          <div className="mfbar"><div className="mfrow">
            {chip("all", "Todos")}{chip("open", "A pagar")}{chip("paid", "Pagos")}{chip("rec", "Receitas")}
            <button className={"mfp" + (cat ? " on" : "")} aria-expanded={catOn || !!cat} onClick={() => { if (cat) { setCat(""); setCatOn(false); } else setCatOn(!catOn); }}>{cat ? catDe(cat, "desp", pers).n : "Categoria"} ▾</button></div>
            {(catOn || cat) && cats.length > 0 && <div className="mfrow mfcats">{cats.map(k => <button key={k} className={"mfp" + (cat === k ? " on" : "")} onClick={() => setCat(cat === k ? "" : k)}>{catDe(k, "desp", pers).n}</button>)}</div>}
          </div>
          <section className="mssum"><div className="msbar" role="img" aria-label={`${pPago}% do mês já pago`}><i style={{ width: pPago + "%" }} /></div>
            <div className="msrow"><div><small>Pago</small><b>{R(r.pago)}</b></div><div><small>A pagar</small><b className={r.aPagar ? "" : "mut"}>{R(r.aPagar)}</b></div></div></section>
          <div className="seg mseg" role="group" aria-label="Ver">
            <button type="button" aria-pressed={aba === "lanc"} onClick={() => setAba("lanc")}>Lançamentos</button>
            <button type="button" aria-pressed={aba === "cats"} onClick={() => setAba("cats")}>Categorias</button>
          </div>
          {aba === "lanc" ? (
            <section className="mlist">
              <h2>Lançamentos <small>{L.length}</small></h2>
              <div className="mfrow mesord"><button className={"mfp" + (ord === "rec" ? " on" : "")} aria-pressed={ord === "rec"} onClick={() => setOrd("rec")}>Recentes</button><button className={"mfp" + (ord === "az" ? " on" : "")} aria-pressed={ord === "az"} onClick={() => setOrd("az")}>A–Z</button></div>
              {L.length === 0 ? <div className="empty"><strong>{todas.length ? "Nada neste filtro" : `Nada lançado em ${nome}`}</strong>{todas.length ? "Toque em Todos para ver o mês inteiro." : "Registre um gasto ou uma receita para começar o mês."}</div>
                : ord === "az" ? <div className="card list">{az.map(x => <Linha1 key={x.id} x={x} e={e} pers={pers} hoje={e.hoje} onIr={onIr} onEdit={onEdit} />)}</div>
                : datas.map(d => { const g = grupos[d], out = g.filter(x => !x.rec).reduce((s, x) => s + x.cents, 0), inn = g.filter(x => x.rec).reduce((s, x) => s + x.cents, 0);
                  return (<div key={d} className="mgrp"><div className="mgh"><b>{dia(d, e.hoje)}</b>{(out || inn) ? <span className={out ? "" : "pos"}>{out ? "− " + R(out) : "+ " + R(inn)}</span> : null}</div>
                    <div className="card list">{g.map(x => <Linha1 key={x.id} x={x} e={e} pers={pers} hoje={e.hoje} onIr={onIr} onEdit={onEdit} />)}</div></div>); })}
            </section>
          ) : (
            <section id="catAllSec"><h2>Por categoria</h2>
              {totG ? (
                <div className="card list" style={{ padding: 0 }}><div className="catrows">{gc.map(x => { const c = catDe(x.k, "desp", pers), p = Math.round((x.cents / totG) * 100); return (
                  <div key={x.k} className="catg"><div className="catrow"><CatIco k={x.k} t="desp" pers={pers} /><span className="cn">{c.n}</span><span className="cv">{R(x.cents)}</span>
                    <span className="cb"><i><i style={{ width: (x.cents / gc[0].cents) * 100 + "%", background: c.c }} /></i><em>{p}%</em></span></div></div>); })}</div></div>
              ) : <div className="empty"><strong>Sem gastos por categoria</strong>Nenhuma despesa lançada em {nome}.</div>}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
