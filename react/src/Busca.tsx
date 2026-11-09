import { useMemo, useState } from "react";
import type { Estado, Pers } from "./engine";
import { buscar } from "./busca";
import { R, dm, mLab } from "./format";
import "./telas.css";

export function Busca({ e, pers, onEdit, onVoltar }: { e: Estado; pers: Pers; onEdit?: (id: string) => void; onVoltar: () => void }) {
  const [q, setQ] = useState("");
  const r = useMemo(() => buscar(e, q, pers), [e, q, pers]);
  const tem = q.trim().length > 0;
  return (
    <main className="pg tela busca">
      <button type="button" className="btn ghost" onClick={onVoltar}>‹ Início</button>
      <h1>Buscar</h1>
      <label className="tbusca">
        <span className="sr">Buscar em todos os meses</span>
        <input type="search" autoFocus autoComplete="off" enterKeyHint="search" placeholder="Nome, categoria, cartão, #tag ou valor" value={q} onChange={x => setQ(x.target.value)} />
      </label>
      {!tem && <p className="vazio">Procura em todos os meses: nome, categoria, cartão, conta, #tag, parcela ou valor (ex.: 150 ou 89,90). Várias palavras buscam juntas.</p>}
      {tem && r.total === 0 && <p className="vazio" role="status">Nada encontrado para “{q.trim()}”.</p>}
      {r.total > 0 && (
        <>
          <p className="tresumo" role="status">
            <b>{r.total}</b> {r.total === 1 ? "lançamento" : "lançamentos"}
            {r.desp > 0 && <> · gastos <b>{R(r.desp)}</b></>}
            {r.rec > 0 && <> · receitas <b className="pos">{R(r.rec)}</b></>}
            {r.cortou && <> · mostrando os 300 mais novos</>}
          </p>
          {r.meses.map(m => (
            <section key={m.ym} className="tmes" aria-label={mLab(m.ym)}>
              <h2>{mLab(m.ym)} <small>{m.desp > 0 ? R(m.desp) : ""}{m.desp > 0 && m.rec > 0 ? " · " : ""}{m.rec > 0 ? "+" + R(m.rec) : ""}</small></h2>
              <ul className="tlista">
                {m.itens.map(({ l, cat, data }) => {
                  const corpo = (
                    <>
                      <span className="tnm"><b>{l.nome}</b><em>{dm(data)}{cat ? " · " + cat : ""}{l.cartao ? " · " + l.cartao : ""}{l.parcela ? " · " + l.parcela : ""}{l.pago === false && l.tipo !== "rec" ? " · a pagar" : ""}</em></span>
                      <span className={"tv" + (l.tipo === "rec" ? " pos" : "")}>{l.tipo === "rec" ? "+" : ""}{R(l.cents)}</span>
                    </>
                  );
                  return <li key={l.id}>{onEdit ? <button type="button" className="trow" aria-label={`Editar ${l.nome}`} onClick={() => onEdit(l.id)}>{corpo}</button> : <div className="trow">{corpo}</div>}</li>;
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
