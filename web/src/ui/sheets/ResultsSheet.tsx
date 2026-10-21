import type { ReactNode } from "react";
import { useStore } from "../../lib/createStore";
import { bankOf } from "../../lib/banks";
import { R, fmtD, fmtDM, today } from "../../lib/format";
import { contaEntry, faturaDays, faturaEntry, ftKey, ftTotal, hlKey, hlName, holeriteEntry, itemName, ctKey } from "../../lib/imports";
import type { ContaPdf, Fatura, HoleritePdf, ReadResult } from "../../lib/pdf/read";
import { actions, ledger } from "../../lib/store";
import { bankAccts, faturaPaid } from "../../lib/ledger";
import { Badge, BankBadge } from "../Badge";
import { SheetHead } from "../Sheet";
import { closeSheet, openSheet, patchResult, pdfResults, toast, ui } from "../uiStore";

/** o que o leitor achou em cada PDF, com o botão de lançar na conta escolhida */
export function ResultsSheet() {
  const items = useStore(pdfResults, s => s.items);
  return (<>
    <SheetHead title="O que o app leu" />
    {items.map((x, i) => x.kind === "fatura" ? <FaturaView key={i} x={x} i={i} /> : x.kind === "conta" ? <ContaView key={i} x={x} i={i} /> : x.kind === "holerite" ? <HoleriteView key={i} x={x} i={i} /> : <ErroView key={i} x={x} i={i} />)}
  </>);
}

/** bloco "lançar": escolhe a conta e lança; mostra "Já lançado" quando a chave já existe */
function Block({ i, x, imp, doneText, label, preferred, children, button, onGo }: {
  i: number; x: ReadResult; imp: string | false; doneText: string; label: string; preferred?: string; children?: ReactNode; button: string; onGo: (acct: string) => void;
}) {
  const { accts: all, entries } = useStore(ledger, s => s);
  const accts = bankAccts(all); // quem paga é conta com saldo, não cartão
  const openId = useStore(ui, s => s.openId);
  const done = imp ? entries.find(e => e.imp === imp) : undefined;
  if (done) { const a = all.find(k => k.id === done.acct); return <div className="hl"><p className="ok" style={{ margin: 0, fontWeight: 600 }}>{doneText} {a ? a.name : "uma conta apagada"} ✓</p></div>; }
  if (!accts.length) return <div className="hl"><button type="button" className="btn wide" onClick={() => { closeSheet(); openSheet({ kind: "add" }); }}>Crie uma conta para lançar</button></div>;
  const acct = x.acct && accts.some(a => a.id === x.acct) ? x.acct : preferred && accts.some(a => a.id === preferred) ? preferred : openId && accts.some(a => a.id === openId) ? openId : accts[0].id;
  const a = accts.find(k => k.id === acct)!;
  return (
    <div className="hl" data-hl={i}>
      {children}
      <span className="lbl">{label}</span>
      <div className="cards">{accts.map(k => <button type="button" key={k.id} className="cpill" aria-pressed={k.id === acct} onClick={() => patchResult(i, { acct: k.id })}><Badge name={k.name} color={k.color} label={k.label} /><span>{k.name}</span></button>)}</div>
      <button type="button" className="btn primary wide" onClick={() => onGo(acct)}>{button.replace("{conta}", a.name)}</button>
    </div>
  );
}

function FaturaView({ x, i }: { x: Extract<ReadResult, { kind: "fatura" }>; i: number }) {
  const r: Fatura = x.r, entries = useStore(ledger, s => s.entries);
  const sum = r.rows.reduce((s, y) => s + y.cents, 0), d = r.due || x.date || "";
  const bankAcct = useStore(ledger, s => { const m = bankOf(r.bank || ""); return (m && bankAccts(s.accts).find(a => bankOf(a.name) === m)?.id) || undefined; });
  const chk = r.total == null ? null : Math.abs(sum - r.total) <= 1 ? <span className="ok">bate com o total do banco ✓</span> : <span className="bad">banco diz {R(r.total)}</span>;
  function go(acct: string) {
    if (!d) { toast("Informe o vencimento da fatura."); return; }
    if (entries.some(y => y.imp === ftKey(r, d))) return;
    const pk = bankOf(r.bank || ""), mine = pk && ledger.get().accts.find(a => a.kind === "cartao" && bankOf(a.name) === pk && faturaPaid(a, d.slice(0, 7), entries));
    if (mine) { toast("Essa fatura já foi paga pelo cartão " + mine.name + "."); return; }
    actions.addEntries(faturaEntry(acct, r, d)); toast("Fatura lançada ✓");
    // o cartão do mesmo banco aprende os dias de fechamento e vencimento (só se ainda não tiver)
    const bk = bankOf(r.bank || ""), card = bk && ledger.get().accts.find(a => a.kind === "cartao" && bankOf(a.name) === bk && !(a.closeDay && a.dueDay));
    if (card) { const dd = faturaDays(r, d); if (dd.closeDay && dd.dueDay) actions.updateAccount(card.id, dd); }
  }
  return (
    <details className="rd" open>
      <summary><span>{r.bank ? <><BankBadge name={r.bank} />{" "}</> : null}Fatura {r.bank || ""} <small>{x.name}</small></span></summary>
      <div className="kv">
        <span>Vencimento</span><b>{r.due ? fmtD(r.due) : "não achei"}</b>
        {r.close ? <><span>Fecha dia</span><b>{r.close}</b></> : null}
        <span>Lançamentos</span><b>{r.rows.length}</b><span>Soma lida</span><b>{R(sum)}</b>
        {r.total != null ? <><span>Total do banco</span><b>{R(r.total)}</b></> : null}
      </div>
      {chk && <div className="kv" style={{ paddingTop: 0 }}><span>Conferência</span><b>{chk}</b></div>}
      {r.rows.map((y, k) => <div className="ln" key={k}><span>{fmtDM(y.date)}</span><span className="dsc">{itemName(y)}</span><b className={y.cents < 0 ? "cr" : ""}>{R(y.cents)}</b></div>)}
      <Block i={i} x={x} imp={d ? ftKey(r, d) : false} doneText="Já lançada em" label="Paga pela conta" preferred={bankAcct} onGo={go}
        button={`Lançar fatura de ${R(ftTotal(r))} em {conta}${d ? ` · vence ${fmtDM(d)}` : ""}`}>
        {r.due ? null : <div className="field"><label htmlFor={`ftd${i}`}>Vencimento (não achei no PDF)</label><input type="date" id={`ftd${i}`} value={x.date || ""} onChange={e => patchResult(i, { date: e.target.value })} /></div>}
      </Block>
    </details>
  );
}

function ContaView({ x, i }: { x: Extract<ReadResult, { kind: "conta" }>; i: number }) {
  const c: ContaPdf = x.c;
  return (
    <details className="rd" open>
      <summary><span>Conta {c.name} <small>{x.name}</small></span></summary>
      <div className="kv"><span>Empresa</span><b>{c.name}</b><span>Vencimento</span><b>{fmtD(c.due)}</b><span>Valor</span><b>{R(c.cents)}</b><span>Débito automático</span><b>{c.auto ? "sim" : "não"}</b></div>
      <Block i={i} x={x} imp={ctKey(c)} doneText="Já lançada em" label="Paga pela conta" onGo={acct => { if (!ledger.get().entries.some(y => y.imp === ctKey(c))) { actions.addEntries(contaEntry(acct, c)); toast("Conta lançada ✓"); } }}
        button={`Lançar conta de ${R(c.cents)} em {conta} · vence ${fmtDM(c.due)}`} />
    </details>
  );
}

function HoleriteView({ x, i }: { x: Extract<ReadResult, { kind: "holerite" }>; i: number }) {
  const h: HoleritePdf = x.h, P = h.ev.filter(e => e.side === "p"), D = h.ev.filter(e => e.side === "d");
  const ev = (e: { desc: string; cents: number }, k: number) => <div className="ln h2" key={k}><span className="dsc" style={{ color: "var(--ink)", fontSize: ".92rem" }}>{hlName(e.desc)}</span><b>{R(e.cents)}</b></div>;
  return (
    <details className="rd" open>
      <summary><span>Holerite · {h.kind} <small>{x.name}</small></span></summary>
      <div className="kv">
        <span>Líquido</span><b>{R(h.cents)}</b><span>Crédito em</span><b>{fmtD(h.date)}</b><span>Referência</span><b>{h.ref.slice(5)}/{h.ref.slice(0, 4)}</b>
        {h.emp ? <><span>Empresa</span><b>{h.emp}</b></> : null}
        {h.tp != null ? <><span>Proventos</span><b>{R(h.tp)}</b></> : null}
        {h.td != null ? <><span>Descontos</span><b>{R(h.td)}</b></> : null}
        {h.check == null ? null : <><span>Conferência</span><b>{h.check ? <span className="ok">proventos − descontos = líquido ✓</span> : <span className="bad">não bate com o líquido</span>}</b></>}
        {h.conv ? <><span>Convênio</span><b>{R(h.conv.cents)}{h.conv.n ? ` · ${h.conv.n} atend.` : ""}</b></> : null}
      </div>
      {h.conv && h.conv.by && h.conv.by.length > 0 && h.conv.by.map((b, k) => <div className="ln h2" key={k}><span>{b.k} · {b.n}</span><b>{R(b.cents)}</b></div>)}
      {P.length > 0 && <><div className="ln sub">Proventos</div>{P.map(ev)}</>}
      {D.length > 0 && <><div className="ln sub">Descontos</div>{D.map(ev)}</>}
      <Block i={i} x={x} imp={hlKey(h)} doneText="Já lançado em" label="Entra em" onGo={acct => { if (!ledger.get().entries.some(y => y.imp === hlKey(h))) { actions.addEntries(holeriteEntry(acct, h)); toast("Holerite lançado ✓"); } }}
        button={`Lançar ${R(h.cents)} em {conta}${h.date > today() ? ` · cai em ${fmtDM(h.date)}` : ""}`} />
    </details>
  );
}

function ErroView({ x, i }: { x: Extract<ReadResult, { kind: "erro" }>; i: number }) {
  return (
    <details className="rd" open>
      <summary><span>{x.name}</span></summary>
      <p className="err" style={{ display: "block" }}>{x.msg}</p>
      {x.pdf && <button type="button" className="btn" style={{ marginBottom: 12 }} onClick={() => openSheet({ kind: "diag", idx: i })}>Ver diagnóstico</button>}
    </details>
  );
}
