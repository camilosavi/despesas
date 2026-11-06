import { useMemo, useState } from "react";
import { aplicarExtrato, contaDoExtrato } from "./extrato";
import type { Extrato as Ext, Item } from "./extrato";
import type { Backup } from "./loja";
import { R, dm } from "./format";
import "./lancar.css";
import "./extrato.css";

type Cats = { desp: { k: string; n: string }[]; rec: { k: string; n: string }[] };
interface Props { b: Backup; e: Ext; plano: Item[]; cats: Cats; onSalvar: (b: Backup) => void; onAviso: (t: string) => void; onFechar: () => void }

export function Extrato({ b, e, plano, cats, onSalvar, onAviso, onFechar }: Props) {
  const [it, setIt] = useState<Item[]>(plano);
  const conta = useMemo(() => contaDoExtrato(b, e.banco), [b, e.banco]);
  const maisNova = conta.existe && (conta.atTs || 0) > e.atTs;
  const [saldo, setSaldo] = useState(e.saldo != null && !maisNova);
  const mexe = (i: number, p: Partial<Item>) => setIt(l => l.map(x => (x.i === i ? { ...x, ...p } : x)));
  const vis = it.filter(x => x.acao !== "skip" || x.nota);
  const ent = it.filter(x => x.type === "rec" && x.acao !== "skip" && x.acao !== "transf").reduce((s, x) => s + x.cents, 0), sai = it.filter(x => x.type === "desp" && x.acao !== "skip" && x.acao !== "transf").reduce((s, x) => s + x.cents, 0);
  const nAdd = it.filter(x => x.on && x.acao === "add").length, nPay = it.filter(x => x.on && x.acao === "pay").length, nTr = it.filter(x => x.on && x.acao === "transf" && x.outra).length;
  const rotulo = [nAdd ? `Lançar ${nAdd}` : "", nPay ? `marcar ${nPay} ${nPay === 1 ? "pago" : "pagos"}` : "", nTr ? `${nTr} ${nTr === 1 ? "transferência" : "transferências"}` : ""].filter(Boolean).join(" e ") || (saldo && e.saldo != null ? "Só atualizar o saldo" : "Fechar");
  const ir = () => {
    if (!nAdd && !nPay && !nTr && !(saldo && e.saldo != null)) return onFechar();
    const r = aplicarExtrato(b, e, it, saldo, Date.now());
    onSalvar(r.backup); onAviso(r.n ? `${r.n} ${r.n === 1 ? "movimento" : "movimentos"} do extrato no app.` : "Saldo atualizado."); onFechar();
  };
  return (
    <div className="lfundo" onMouseDown={ev => ev.target === ev.currentTarget && onFechar()}>
      <div className="lfolha extsheet" role="dialog" aria-modal="true" aria-labelledby="ext-t">
        <h2 id="ext-t">Extrato {e.banco}</h2>
        {e.saldo != null && <>
          <div className="ppsaldo"><small>saldo em {dm(e.at)} · extrato de {dm(e.de)} a {dm(e.ate)}</small><b>{R(e.saldo)}</b></div>
          <label className="lcheck"><input type="checkbox" checked={saldo} disabled={maisNova} onChange={ev => setSaldo(ev.target.checked)} />
            {maisNova ? `O saldo da conta ${conta.nome} é mais novo que este extrato` : `Usar como saldo da conta ${conta.nome}${conta.existe ? ` (hoje: ${R(conta.cents || 0)})` : " (cria a conta)"}`}</label>
        </>}
        <p className="lnota">Entrou {R(ent)}, saiu {R(sai)} (sem transferências entre suas contas, investimento e fatura). Confira antes de lançar.</p>
        <ul className="extl">{vis.map(x => {
          const pode = x.acao === "add" || x.acao === "pay" || (x.acao === "transf" && !!x.outra);
          return (
            <li key={x.i} className={x.on ? "" : "off"}>
              <label className="extl-l"><input type="checkbox" checked={x.on} disabled={!pode} onChange={ev => mexe(x.i, { on: ev.target.checked })} />
                <span className="extl-d">{x.desc || x.rot}</span>
                <b className={x.type === "rec" ? "pos" : ""}>{x.type === "rec" ? "+ " : "− "}{R(x.cents)}</b></label>
              <div className="extl-m"><span>{dm(x.date)}{x.acao === "add" ? ` · ${x.pay}` : x.nota ? ` · ${x.nota}` : ""}</span>
                {x.acao === "add" && <select aria-label={`Categoria de ${x.desc}`} value={x.cat} onChange={ev => mexe(x.i, { cat: ev.target.value })}>
                  {cats[x.type].map(c => <option key={c.k} value={c.k}>{c.n}</option>)}</select>}
                {x.acao === "transf" && x.outras && <select aria-label="Outra conta" value={x.outra || ""} onChange={ev => mexe(x.i, { outra: ev.target.value, on: !!ev.target.value })}>
                  <option value="">escolha a conta</option>{x.outras.map(n => <option key={n} value={n}>{n}</option>)}</select>}</div>
            </li>
          );
        })}</ul>
        {!vis.length && <p className="vazio">Nenhum movimento neste arquivo.</p>}
        <div className="lacoes"><button type="button" className="btn" onClick={onFechar}>Cancelar</button><button type="button" className="btn principal" onClick={ir}>{rotulo}</button></div>
      </div>
    </div>
  );
}
