import { useState } from "react";
import * as C from "./engine";
import type { Estado } from "./engine";
import { Marca } from "./blocos";
import { cartoes, detalhe, posso, resumoCartoes, restam } from "./cartoes";
import type { Item } from "./cartoes";
import { dm, mLab, R } from "./format";
import "./contas.css";
import "./cartoes.css";

const mCurto = (m: string) => mLab(m).split(" de ")[0];

function Linha({ x, onEdit }: { x: Item; onEdit?: (id: string) => void }) {
  const sub = [dm(x.compra || x.data), x.parcela ? `parcela ${x.parcela.replace("/", " de ")}` : "", x.taxa ? "taxa" : "", x.pago ? "pago ✓" : ""].filter(Boolean).join(" · ");
  return (
    <li>{onEdit
      ? <button type="button" className="crow" aria-label={`Editar ${x.nome}`} onClick={() => onEdit(x.id)}><span className="dtn"><b>{x.nome}</b><small>{sub}</small></span><span className="v">−{R(x.cents)}</span></button>
      : <div className="crow"><span className="dtn"><b>{x.nome}</b><small>{sub}</small></span><span className="v">−{R(x.cents)}</span></div>}</li>
  );
}

function Posso({ e, cartao }: { e: Estado; cartao: string }) {
  const [v, setV] = useState(""), [n, setN] = useState("1");
  const cents = Math.round((parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0) * 100);
  const p = cents > 0 ? posso(e, cartao, cents, parseInt(n, 10) || 1) : null;
  return (
    <section className="cb" aria-label="Posso comprar?">
      <h3>Posso comprar?</h3>
      <div className="cpainel">
        <label className="cl">Valor (R$)<input inputMode="decimal" value={v} onChange={ev => setV(ev.target.value)} placeholder="0,00" /></label>
        <label className="cl">Parcelas<select value={n} onChange={ev => setN(ev.target.value)}>{[1, 2, 3, 4, 5, 6, 10, 12].map(i => <option key={i} value={i}>{i}x</option>)}</select></label>
      </div>
      {p && (
        <div className="cpos" role="status">
          {p.livreAntes != null && <p className={p.passa ? "neg" : ""}>{p.passa ? `Passa do limite em ${R(-(p.livreDepois ?? 0))}.` : `Limite livre: ${R(p.livreAntes)} → ${R(p.livreDepois ?? 0)}.`}</p>}
          <ul>{p.meses.map(m => <li key={m.ym}><span>{mCurto(m.ym)}</span><b>{R(m.antes)} → {R(m.depois)}</b></li>)}</ul>
        </div>
      )}
    </section>
  );
}

export function Cartoes({ e, onVoltar, onEdit, onPagar }: { e: Estado; onVoltar: () => void; onEdit?: (id: string) => void; onPagar?: (ids: string[], pago: boolean) => void }) {
  const lista = cartoes(e), res = resumoCartoes(e);
  const [sel, setSel] = useState<string>(lista[0]?.cartao || "");
  const [ym, setYm] = useState<string>(lista[0]?.ym || C.mesDe(e.hoje));
  const escolher = (c: string) => { setSel(c); setYm(lista.find(x => x.cartao === c)?.ym || ym); };
  const d = sel && lista.some(x => x.cartao === sel) ? detalhe(e, sel, ym) : null;
  const min = C.mesDe(e.inicio || e.hoje);
  return (
    <div className="pg cts">
      <header className="dtop">
        <h1 className="ctit">Cartões</h1>
        <button type="button" className="kback" onClick={onVoltar}>‹ Início</button>
      </header>
      {lista.length === 0 ? <p className="aviso">Nenhum cartão de crédito ainda. Cadastre um no app atual ou use um backup que tenha cartões.</p> : (
        <div className="kgrid">
          <section className="cb cb-saldo" aria-label="Faturas em aberto">
            <h3>Faturas em aberto</h3>
            <b className="dbig">{R(res.aberto)}</b>
            <p className="cfim">{res.n} {res.n === 1 ? "cartão" : "cartões"}{res.prox ? <> · próxima vence <b>{dm(res.prox)}</b></> : ""}</p>
          </section>
          <ul className="kcards" aria-label="Seus cartões">
            {lista.map(x => {
              const pct = x.lim ? Math.min(100, x.lim.pct) : 0;
              return (
                <li key={x.cartao}>
                  <button type="button" className="kc" aria-pressed={x.cartao === sel} onClick={() => escolher(x.cartao)}>
                    <Marca nome={x.cartao} e={e} />
                    <span className="dtn"><b>{x.cartao}</b><small>{x.total ? (x.paga ? "paga ✓" : `vence ${dm(x.vence)}`) : "sem fatura"}</small></span>
                    <span className="cv2"><span className="v">{R(x.total)}</span>
                      {x.lim && <small className={x.lim.passou ? "neg" : ""}>{x.lim.passou ? "acima do limite" : `livre ${R(x.lim.livre)}`}</small>}</span>
                    {x.lim && <span className="cbar kbar" aria-hidden="true"><i style={{ width: pct + "%" }} /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {d && (
            <div className="kcol">
              <section className="cb kdet" aria-label={`Fatura de ${d.cartao}`}>
                <div className="khead">
                  <h3>Fatura de {mCurto(d.ym)}</h3>
                  <nav className="mnav" aria-label="Mês da fatura">
                    <button type="button" aria-label="Fatura anterior" disabled={d.ym <= min} onClick={() => setYm(C.somaMeses(ym, -1))}>‹</button>
                    <span aria-live="polite">{mCurto(d.ym)}</span>
                    <button type="button" aria-label="Próxima fatura" onClick={() => setYm(C.somaMeses(ym, 1))}>›</button>
                  </nav>
                </div>
                <b className="dbig">{R(d.total)}</b>
                <p className={"kst " + (d.paga ? "ok" : d.vencida ? "neg" : "")}>{d.paga ? "Paga ✓" : d.vencida ? `Venceu em ${dm(d.vence)}` : `Vence em ${dm(d.vence)}`}</p>
                {onPagar && d.itens.length > 0 && (
                  <button type="button" className="kpagar" onClick={() => onPagar(d.itens.map(x => x.id), !d.paga)}>{d.paga ? "Desfazer pagamento" : `Marcar fatura de ${mCurto(d.ym)} como paga`}</button>
                )}
                {d.banco != null && (
                  <p className="kconf">{d.faltaLancar > 0
                    ? <>Banco diz <b>{R(d.banco)}</b>. <span className="neg">Falta lançar {R(d.faltaLancar)}.</span></>
                    : <>Bate com o valor do banco ({R(d.banco)}) ✓</>}</p>
                )}
                {d.doAnterior > 0 && <p className="kconf">Inclui {R(d.doAnterior)} da fatura anterior que não foi paga.</p>}
                {d.lim && <p className="kconf">Limite {R(d.lim.limite)} · usado {R(d.lim.limite - d.lim.livre)} · <b className={d.lim.passou ? "neg" : ""}>{d.lim.passou ? "passou do limite" : `livre ${R(d.lim.livre)}`}</b></p>}
              </section>
              <section className="cb" aria-label="Itens da fatura">
                <h3>Itens <em>{d.itens.length}</em></h3>
                {d.itens.length ? <ul>{d.itens.map(x => <Linha key={x.id} x={x} onEdit={onEdit} />)}</ul> : <p className="kconf">Nenhum item lançado nesta fatura.</p>}
              </section>
              <section className="cb" aria-label="Próximas faturas">
                <h3>Próximas faturas</h3>
                <ul>{d.prox.map(p => <li key={p.ym} className="crow"><span className="dtn"><b>{mCurto(p.ym)}</b></span><span className="v">{p.total ? R(p.total) : "—"}</span></li>)}</ul>
              </section>
              {d.parcelas.length > 0 && (
                <section className="cb" aria-label="Parcelas">
                  <h3>Parcelas desta fatura <em>{d.parcelas.length}</em></h3>
                  <ul>{d.parcelas.map(x => { const r = restam(x.parcela); return (
                    <li key={x.id} className="crow"><span className="dtn"><b>{x.nome}</b><small>{x.parcela!.replace("/", " de ")}{r ? ` · faltam ${r}` : " · última"}</small></span><span className="v">−{R(x.cents)}</span></li>
                  ); })}</ul>
                </section>
              )}
              {d.taxas > 0 && <section className="cb" aria-label="Juros e tarifas"><h3>Juros, IOF e tarifas</h3><b className="dbig kfee">{R(d.taxas)}</b><p className="kconf">Nesta fatura.</p></section>}
              <Posso key={d.cartao} e={e} cartao={d.cartao} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
