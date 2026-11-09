import { useState } from "react";
import type { CSSProperties } from "react";
import * as C from "./engine";
import type { Estado } from "./engine";
import { Marca } from "./blocos";
import { marcaDe } from "./marcas";
import { cartoes, detalhe, posso, resumoCartoes, restam } from "./cartoes";
import type { Item } from "./cartoes";
import { MES, dm, mLab, R } from "./format";

const mCurto = (m: string) => mLab(m).split(" de ")[0];
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const SV = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const mini = (m: string) => MES[+m.slice(5) - 1];

function ItemRow({ x, onEdit }: { x: Item; onEdit?: (id: string) => void }) {
  const meta = [x.parcela ? x.parcela.replace("/", " de ") : "", x.taxa ? "taxa" : "", x.pago ? "pago" : ""].filter(Boolean).join(" · ");
  return (
    <button type="button" className="item" onClick={() => onEdit?.(x.id)}>
      <span className="t"><div className="d"><span className="dn">{x.nome}</span></div><div className="m"><b>{dm(x.compra || x.data)}</b>{meta ? " · " + meta : ""}</div></span>
      <span className="a">{R(x.cents)}</span>
    </button>
  );
}

function Posso({ e, cartao }: { e: Estado; cartao: string }) {
  const [v, setV] = useState(""), [n, setN] = useState("1");
  const cents = Math.round((parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0) * 100);
  const p = cents > 0 ? posso(e, cartao, cents, parseInt(n, 10) || 1) : null;
  return (
    <section aria-label="Posso comprar?">
      <h2>Posso comprar?</h2>
      <div className="card rate">
        <label className="src">Valor (R$)<input className="limin" inputMode="decimal" value={v} onChange={ev => setV(ev.target.value)} placeholder="0,00" /></label>
        <label className="src">Parcelas<select className="acsel" value={n} onChange={ev => setN(ev.target.value)}>{[1, 2, 3, 4, 5, 6, 10, 12].map(i => <option key={i} value={i}>{i}x</option>)}</select></label>
        {p && (
          <div role="status">
            {p.livreAntes != null && <div className={p.passa ? "limwarn over" : "pos"} style={{ fontWeight: 600 }}>{p.passa ? `Passa do limite em ${R(-(p.livreDepois ?? 0))}.` : `Limite livre: ${R(p.livreAntes)} → ${R(p.livreDepois ?? 0)}.`}</div>}
            <div className="cmp">{p.meses.map(m => <div key={m.ym}><span>{mCurto(m.ym)}</span><b>{R(m.antes)} → {R(m.depois)}</b></div>)}</div>
          </div>
        )}
      </div>
    </section>
  );
}

export function Cartoes({ e, onVoltar, onEdit, onPagar, onPdf, onMenu }: { e: Estado; onVoltar: () => void; onPdf?: () => void; onEdit?: (id: string) => void; onPagar?: (ids: string[], pago: boolean) => void; onMenu?: () => void }) {
  const lista = cartoes(e), res = resumoCartoes(e);
  const hoje = C.mesDe(e.hoje), min = "2026-09";
  const [view, setView] = useState(hoje);
  const [sel, setSel] = useState<string>("");
  const [ym, setYm] = useState<string>(hoje);
  const abrir = (c: string, m: string) => { setSel(c); setYm(m); };
  const d = sel && lista.some(x => x.cartao === sel) ? detalhe(e, sel, ym) : null;
  const livreTot = lista.reduce((s, x) => s + (x.lim ? Math.max(0, x.lim.livre) : 0), 0);
  const proxMes = lista.reduce((s, x) => s + C.fatura(e, x.cartao, C.somaMeses(view, 1)).total, 0);
  const meses = [0, 1, 2, 3, 4, 5].map(i => C.somaMeses(view, i));

  if (d) {
    const m = marcaDe(d.cartao, e), cor = e.cartoes[d.cartao]?.cor || m.cor;
    const mn = mCurto(d.ym).toLowerCase();
    const fechado = C.fatura(e, d.cartao, d.ym) as { fecha?: string };
    return (
      <>
        <header className="top"><div className="tcard">
          <div className="titlerow">
            <button className="hmenu" id="hMenu" aria-label="Abrir o menu" onClick={onMenu}><SV d="M4 7h16M4 12h16M4 17h16" /></button>
            <button className="backbtn" onClick={() => setSel("")}><span aria-hidden="true">‹</span> <span>Cartões</span></button>
            <h1 id="ptitle">{d.cartao}</h1>
          </div>
          <div className="monthpill">
            <button aria-label="Fatura anterior" disabled={d.ym <= min} onClick={() => setYm(C.somaMeses(ym, -1))}>‹</button>
            <span>{cap(mLab(d.ym))}</span>
            <button aria-label="Próxima fatura" onClick={() => setYm(C.somaMeses(ym, 1))}>›</button>
          </div>
          <div className="bigrow"><div><p className="label">{d.paga ? "Fatura paga" : "A pagar"}</p><div className="big"><small>R$</small>{R(d.total).replace("R$ ", "")}</div></div></div>
          <div className="split"><div><span>Vencimento</span><b className="num">{dm(d.vence)}</b></div><div><span>Limite livre</span><b className="num">{d.lim ? R(d.lim.livre) : "—"}</b></div></div>
        </div></header>
        <main id="pCards" style={{ "--card-acc": cor, "--accent": cor, "--btn": cor, "--btn-ink": m.escuro ? "#1A1A1A" : "#fff" } as CSSProperties}>
          <section>
            {d.itens.length > 0 && onPagar && <button className={"btn paytop " + (d.paga ? "soft" : "primary")} onClick={() => onPagar(d.itens.map(x => x.id), !d.paga)}>{d.paga ? `Fatura de ${mn} paga ✓ · marcar como a pagar` : `Marcar fatura de ${mn} como paga`}</button>}
          </section>
          <section>
            <div className="card rate"><div className="top"><div>
              <span className="hint" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, fontSize: ".7rem" }}>Total da fatura{d.paga ? " · paga" : ""}</span>
              <div className={"val " + (d.paga ? "pos" : "")}><small>R$</small>{R(d.total).replace("R$ ", "")}</div>
              <div className="src">{d.banco != null && d.itens.length ? `valor do banco · lançado ${R(d.lancado)} em ${d.itens.length} ${d.itens.length === 1 ? "item" : "itens"}${d.doAnterior ? ` + ${R(d.doAnterior)} da anterior` : ""}` : `${d.itens.length} ${d.itens.length === 1 ? "item lançado" : "itens lançados"}`}</div></div></div>
              {d.banco != null && (d.faltaLancar > 0 ? <div className="warn" style={{ fontSize: ".88rem", fontWeight: 600 }}>Falta lançar {R(d.faltaLancar)} para bater com o banco</div>
                : <div className="pos" style={{ fontSize: ".88rem", fontWeight: 600 }}>Bate com o banco ✓</div>)}
              {d.lim && <div className="hint">Limite {R(d.lim.limite)} · usado {R(d.lim.limite - d.lim.livre)} · <b className={d.lim.passou ? "neg" : ""}>{d.lim.passou ? "passou do limite" : `livre ${R(d.lim.livre)}`}</b></div>}
            </div>
          </section>
          <section><h2>Itens da fatura <small>{d.itens.length}</small></h2>
            {d.itens.length ? <div className="card list">{d.itens.map(x => <ItemRow key={x.id} x={x} onEdit={onEdit} />)}</div> : <div className="empty"><strong>Nenhum item lançado</strong>Lance uma compra no Crédito escolhendo este cartão.</div>}
          </section>
          <section><h2>Próximas faturas</h2>
            <div className="card list">{d.prox.map(p => (
              <button key={p.ym} type="button" className="item" onClick={() => setYm(p.ym)}><span className="t"><div className="d"><span className="dn">{cap(mCurto(p.ym))}</span></div></span><span className="a">{p.total ? R(p.total) : "—"}</span></button>))}</div>
          </section>
          {d.parcelas.length > 0 && <section><h2>Parcelas desta fatura <small>{d.parcelas.length}</small></h2>
            <div className="card list">{d.parcelas.map(x => { const r = restam(x.parcela); return (
              <div key={x.id} className="item"><span className="t"><div className="d"><span className="dn">{x.nome}</span></div><div className="m">{x.parcela!.replace("/", " de ")}{r ? ` · faltam ${r}` : " · última"}</div></span><span className="a">{R(x.cents)}</span></div>); })}</div></section>}
          {d.taxas > 0 && <section><h2>Juros, IOF e tarifas <small>{R(d.taxas)}</small></h2></section>}
          <Posso key={d.cartao} e={e} cartao={d.cartao} />
          {fechado ? null : null}
        </main>
      </>
    );
  }

  return (
    <>
      <header className="top"><div className="tcard">
        <div className="titlerow">
          <button className="hmenu" id="hMenu" aria-label="Abrir o menu" onClick={onMenu}><SV d="M4 7h16M4 12h16M4 17h16" /></button>
          <h1 id="ptitle">Cartões</h1>
        </div>
        <div className="monthpill">
          <button aria-label="Mês anterior" disabled={view <= min} onClick={() => setView(C.somaMeses(view, -1))}>‹</button>
          <span>{cap(mLab(view))}</span>
          <button aria-label="Próximo mês" onClick={() => setView(C.somaMeses(view, 1))}>›</button>
        </div>
        <div className="bigrow"><div><p className="label">Faturas em aberto</p><div className="big"><small>R$</small>{R(res.aberto).replace("R$ ", "")}</div></div></div>
        <div className="split"><div><span>Limite livre</span><b className="num">{R(livreTot)}</b></div><div><span>Próximo mês</span><b className="num">{R(proxMes)}</b></div></div>
      </div></header>
      <main id="pCards">
        {lista.length === 0 ? <section><div className="empty"><strong>Nenhum cartão ainda</strong>Crie o seu em Você › Contas e cartões, com limite e dia de vencimento.</div></section> : (
          <section>
            <h2>Seus cartões</h2>
            <div className="folders">
              {lista.map(x => {
                const f = C.fatura(e, x.cartao, x.ym), n = (f.itens as unknown[]).length;
                const vals = meses.map(m => C.fatura(e, x.cartao, m).total), max = Math.max(...vals, 1);
                const pct = x.lim ? Math.min(100, x.lim.pct) : 0;
                return (
                  <button key={x.cartao} type="button" className="folder" onClick={() => abrir(x.cartao, x.ym)}>
                    <Marca nome={x.cartao} e={e} /><span className="fn">{x.cartao}</span><span className="fv">{R(x.total)}</span>
                    <span className="fm">{[x.total ? (x.paga ? "paga ✓" : `vence ${dm(x.vence)}`) : `fatura de ${mCurto(x.ym).toLowerCase()}`, n ? `${n} ${n === 1 ? "item" : "itens"}` : "sem itens", x.lim ? (x.lim.passou ? "acima do limite" : `livre ${R(x.lim.livre)}`) : ""].filter(Boolean).map((t, i) => <span key={i} className="nw">{t}</span>).reduce<React.ReactNode[]>((a, t, i) => i ? [...a, " · ", t] : [t], [])}</span>
                    <span className="fa">abrir ›</span>
                    {vals.some(v => v > 0) && <span className="spark">{vals.map((v, i) => <div key={i}><i className={i === 0 ? "now" : ""} style={{ height: v ? Math.max(3, (v / max) * 18) : 2 }} /><span>{mini(meses[i])}</span></div>)}</span>}
                    {x.lim && pct >= 80 && <span className="limtag">{x.lim.passou ? "passou do limite" : pct + "% do limite"}</span>}
                  </button>
                );
              })}
            </div>
            {onPdf && <div className="row pdfpair" style={{ marginTop: 14 }}><button type="button" className="btn soft" style={{ width: "100%" }} onClick={onPdf}>Importar PDF ou print</button></div>}
          </section>
        )}
      </main>
    </>
  );
}
