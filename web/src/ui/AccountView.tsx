import { useState } from "react";
import { useStore } from "../lib/createStore";
import { ofHasBank, ofRun, ofState, ofWhenText } from "../lib/openfinance";
import { acctEntries, entMonth, cardUsed, faturaPaid, faturas, groupByCat, isCard, isFut, matchEntry } from "../lib/ledger";
import { MESN, R, dayLbl, fmtD, fmtDM, signR } from "../lib/format";
import { actions, ledger } from "../lib/store";
import type { Entry } from "../lib/types";
import { useArmed } from "./hooks";
import { backHome, openSheet, toast } from "./uiStore";

const ExRow = ({ e, byCat }: { e: Entry; byCat?: boolean }) => (
  <button type="button" className="ex" data-ex={e.id} onClick={() => openSheet({ kind: "entry", id: e.id })}>
    <i className={e.type}>{e.xfer ? "⇄" : e.type === "rec" ? "↓" : "↑"}</i>
    <span className="nm">{e.desc}{byCat ? <small>{fmtDM(e.date)}</small> : e.cat ? <small>{e.cat}</small> : null}</span>
    <b className={e.type === "rec" ? "cr" : ""}>{e.type === "rec" ? "+" : "−"}{R(e.cents)}</b>
  </button>
);

/** extrato da conta aberta, com busca e filtro por categoria (o estado do filtro some ao trocar de conta: key={id}) */
export function AccountView({ id }: { id: string }) {
  const { accts, entries } = useStore(ledger, s => s);
  const a = accts.find(x => x.id === id);
  const [q, setQ] = useState(""), [catSel, setCat] = useState(""), [monSel, setMon] = useState(""), [by, setBy] = useState<"dia" | "cat">("dia");
  const ofBusy = useStore(ofState, s => s.busy);
  useStore(ofState, s => s.n);
  const del = useArmed("Toque de novo: apaga a conta e o extrato", `Apagar a conta ${a?.name ?? ""}`, () => { const acc = a, gone = entries.filter(e => e.acct === id); actions.deleteAccount(id); backHome(); toast("Conta apagada", () => { if (acc) { actions.addAccount(acc); actions.addEntries(...gone); } }); });
  if (!a) return null;

  const all = acctEntries(entries, id);
  const used = [...new Set(all.filter(e => e.cat).map(e => e.cat as string))];
  const cat = used.includes(catSel) ? catSel : "";
  const months = [...new Set(all.map(e => entMonth(a, e.date)))].sort().reverse(); // cartão: mês do vencimento da fatura
  const mon = months.includes(monSel) ? monSel : "";
  const L = all.filter(e => matchEntry(e, q, cat) && (!mon || entMonth(a, e.date) === mon));
  const fut = L.filter(e => isFut(e)), past = L.filter(e => !isFut(e)), days = [...new Set(past.map(e => e.date))];
  const filtering = !!(q || cat || mon);
  const sumIn = L.filter(e => e.type === "rec").reduce((s, e) => s + e.cents, 0), sumOut = L.filter(e => e.type === "desp").reduce((s, e) => s + e.cents, 0);

  const fats = isCard(a) ? faturas(a, entries) : [];
  return (<>
    {(fats.length > 0 || !!a.limit) && (
      <section className="sec" id="faturas">
        <h2>Faturas</h2>
        {!!a.limit && (() => {
          const used = cardUsed(a, entries), pct = Math.min(100, Math.round((used / a.limit!) * 100));
          return (
            <div className="limbox" id="limbox">
              <div className="limbar"><i className={used > a.limit! ? "over" : ""} style={{ width: pct + "%" }} /></div>
              <small>{R(used)} usados de {R(a.limit!)} · {used > a.limit! ? "passou " + R(used - a.limit!) : "disponível " + R(a.limit! - used)}</small>
            </div>
          );
        })()}
        {fats.map(f => {
          const paid = faturaPaid(a, f.ym, entries);
          return (
            <div key={f.ym} className="acrow fatrow" data-fat={f.ym}>
              <span className="nm">{MESN[+f.ym.slice(5) - 1]}/{f.ym.slice(2, 4)}<small className="cardtag">{paid ? "Paga ✓ em " + fmtD(paid.date) : "Em aberto"}</small></span>
              <b>{R(f.cents)}</b>
              {!paid && <button type="button" className="btn soft" data-pay={f.ym} onClick={() => openSheet({ kind: "pay", id, ym: f.ym })}>Pagar</button>}
            </div>
          );
        })}
      </section>
    )}
    {(!isCard(a) || ofHasBank(a)) && (
      <section className="sec">
        {!isCard(a) && <button type="button" className="btn soft wide" id="confBtn" onClick={() => openSheet({ kind: "conf", id })}>Conferir saldo com o banco</button>}
        {ofHasBank(a) && <>
          <button type="button" className="btn soft wide" id="ofBtn" style={isCard(a) ? undefined : { marginTop: 10 }} disabled={ofBusy} onClick={() => void ofRun(true).then(m => m && toast(m))}>{ofBusy ? "Buscando…" : "Atualizar do banco"}</button>
          {ofWhenText() && <p className="hint" style={{ margin: "8px 0 0", color: "var(--muted)" }}>{ofWhenText()}</p>}
        </>}
      </section>
    )}
    <section className="sec">
      <h2>Extrato</h2>
      {all.length > 0 && (
        <div className="exbar">
          <div className="seg" id="exBy">
            <button type="button" aria-pressed={by === "dia"} onClick={() => setBy("dia")}>Por dia</button>
            <button type="button" aria-pressed={by === "cat"} onClick={() => setBy("cat")}>Por categoria</button>
          </div>
          <input type="search" className="exq" id="exQ" placeholder="Buscar no extrato" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
          {months.length > 1 && (
            <div className="cards" id="exMons">
              <button type="button" className="cpill txt" aria-pressed={!mon} onClick={() => setMon("")}>Todos os meses</button>
              {months.map(m => <button type="button" key={m} className="cpill txt" data-xmon={m} aria-pressed={m === mon} onClick={() => setMon(m === mon ? "" : m)}>{MESN[+m.slice(5) - 1]}/{m.slice(2, 4)}</button>)}
            </div>
          )}
          <div className="cards" id="exCats">
            {used.length > 0 && <>
              <button type="button" className="cpill txt" aria-pressed={!cat} onClick={() => setCat("")}>Todas</button>
              {used.map(c => <button type="button" key={c} className="cpill txt" data-xcat={c} aria-pressed={c === cat} onClick={() => setCat(c === cat ? "" : c)}>{c}</button>)}
            </>}
          </div>
        </div>
      )}
      <div id="exList">
        {filtering && L.length > 0 && (
          <p className="exsum">{L.length} lançamento{L.length > 1 ? "s" : ""}{sumIn ? ` · Entradas ${R(sumIn)}` : ""}{sumOut ? ` · Saídas ${R(sumOut)}` : ""}</p>
        )}
        {by === "cat"
          ? groupByCat(L).map(g => <div key={g.cat}><div className="dayh" style={{ display: "flex", justifyContent: "space-between" }}><span>{g.cat}</span><span>{signR(g.cents)}</span></div>{g.list.map(e => <ExRow key={e.id} e={e} byCat />)}</div>)
          : <>
            {fut.length > 0 && <><div className="dayh">Agendado</div>{fut.map(e => <ExRow key={e.id} e={e} />)}</>}
            {days.map(d => <div key={d}><div className="dayh">{dayLbl(d)}</div>{past.filter(e => e.date === d).map(e => <ExRow key={e.id} e={e} />)}</div>)}
          </>}
        {!L.length && <p className="hint">{all.length ? "Nada encontrado." : "Nenhum movimento ainda."}</p>}
      </div>
    </section>
    <section className="sec"><button type="button" className="btn" id="acctDel" onClick={del.onClick}>{del.text}</button></section>
  </>);
}
