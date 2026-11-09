import { useMemo, useState } from "react";
import { aplicarFatura, aplicarHolerite, guardarHolerite, planoFatura, planoHolerite } from "./fatura";
import type { LinhaPlano, PlanoFatura } from "./fatura";
import type { Fatura as Fat, Holerite } from "./leitores/pdf.js";
import type { Backup } from "./loja";
import { R, dm } from "./format";
import "./lancar.css";
import "./extrato.css";

const id = () => Math.random().toString(36).slice(2, 10);
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesTxt = (ym: string) => `${MES[+ym.slice(5) - 1]}/${ym.slice(2, 4)}`;

interface PropsF { b: Backup; r: Fat; hoje: string; cartoes: string[]; cats: { k: string; n: string }[]; onSalvar: (b: Backup) => void; onAviso: (t: string) => void; onFechar: () => void }

/** Conferência da fatura lida no PDF: tudo marcado, "já lançado" desmarcado, total do banco contra a soma */
export function FaturaPdf({ b, r, hoje, cartoes, cats, onSalvar, onAviso, onFechar }: PropsF) {
  const sugerido = (r.bank && cartoes.find(c => c.toLowerCase().includes(String(r.bank).toLowerCase()))) || (cartoes.length === 1 ? cartoes[0] : "");
  const [card, setCard] = useState(sugerido);
  const [completa, setCompleta] = useState(false);
  const base = useMemo(() => (card ? planoFatura(b, r, card, completa) : null), [b, r, card, completa]);
  const [mexidas, setMexidas] = useState<Record<number, Partial<LinhaPlano>>>({});
  const plano: PlanoFatura | null = base && { ...base, linhas: base.linhas.map(l => ({ ...l, ...mexidas[l.i] })) };
  const mexe = (i: number, p: Partial<LinhaPlano>) => setMexidas(m => ({ ...m, [i]: { ...m[i], ...p } }));
  const nome = String(r.bank || "Cartão");
  const marcadas = plano ? plano.linhas.filter(l => l.on) : [];
  const soma = plano ? plano.linhas.reduce((s, l) => s + l.cents, 0) : 0;
  const bate = plano && plano.total != null ? Math.abs(plano.total - soma) <= 2 : null;
  const ir = () => {
    if (!plano) return;
    const res = aplicarFatura(b, plano, Date.now(), id, hoje);
    onSalvar(res.backup);
    onAviso(`${res.nAdd} ${res.nAdd === 1 ? "lançamento adicionado" : "lançamentos adicionados"}${res.nMerge ? ` · ${res.nMerge} juntados com o que já tinha` : ""}.`);
    onFechar();
  };
  return (
    <div className="lfundo" onMouseDown={ev => ev.target === ev.currentTarget && onFechar()}>
      <div className="lfolha extsheet" role="dialog" aria-modal="true" aria-labelledby="fp-t">
        <h2 id="fp-t">Fatura {nome}</h2>
        {!cartoes.length && <p className="lerro">Cadastre um cartão (Menu → Contas e cartões) antes de importar a fatura.</p>}
        {cartoes.length > 0 && (
          <label>De qual cartão é?
            <select value={card} onChange={ev => { setCard(ev.target.value); setMexidas({}); }}>
              <option value="">escolha o cartão</option>{cartoes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        {plano && <>
          <div className="ppsaldo"><small>vence {dm(plano.due)} · fatura de {mesTxt(plano.bill)}</small><b>{R(soma)}</b></div>
          {plano.total != null && <p className={bate ? "lnota" : "lerro"} role="status">{bate ? "Bate com o total do banco ✓" : `O banco diz ${R(plano.total)} (diferença de ${R(Math.abs(plano.total - soma))}). Confira os itens.`}</p>}
          {plano.estimado && <p className="lerro">O PDF não trouxe o vencimento: estimei {dm(plano.due)} pelo dia do cartão. Confira.</p>}
          {plano.jaImportada && <p className="lerro">Esta fatura já foi importada antes; só entra o que ainda não existe.</p>}
          {plano.velha && <p className="lerro">Vence antes de out/2026: só informativa; entram só as parcelas que vêm depois.</p>}
          {(plano.due < "2026-10-01") && <label className="lcheck"><input type="checkbox" checked={completa} onChange={ev => { setCompleta(ev.target.checked); setMexidas({}); }} />Lançar a fatura inteira mesmo assim (histórico)</label>}
          <ul className="extl">{plano.linhas.map(l => (
            <li key={l.i} className={l.on ? "" : "off"}>
              <label className="extl-l"><input type="checkbox" checked={l.on} disabled={l.acao === "done" || l.acao === "skip"} onChange={ev => mexe(l.i, { on: ev.target.checked })} />
                <span className="extl-d">{l.name}{l.parc ? ` · ${l.parc}` : ""}</span><b>{R(l.cents)}</b></label>
              <div className="extl-m"><span>{l.prev ? "saldo anterior" : dm(l.date)}{l.nota ? ` · ${l.nota}` : l.depois.length ? ` · +${l.depois.length} ${l.depois.length === 1 ? "parcela" : "parcelas"} depois` : ""}</span>
                {l.acao === "add" && !l.prev && <select aria-label={`Categoria de ${l.name}`} value={l.cat} onChange={ev => mexe(l.i, { cat: ev.target.value })}>
                  {[...cats, ...(cats.some(c => c.k === "cartao") ? [] : [{ k: "cartao", n: "Fatura de cartão" }])].map(c => <option key={c.k} value={c.k}>{c.n}</option>)}</select>}</div>
            </li>
          ))}</ul>
        </>}
        <div className="lacoes"><button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="button" className="btn principal" disabled={!plano || !marcadas.length} onClick={ir}>{marcadas.length ? `Lançar ${marcadas.length}` : "Nada novo"}</button></div>
      </div>
    </div>
  );
}

interface PropsH { b: Backup; h: Holerite; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void; onFechar: () => void }
/** Holerite lido: vira 1 receita (salário/adiantamento/13º) e entra no histórico do salário previsto */
export function HoleritePdf({ b, h, onSalvar, onAviso, onFechar }: PropsH) {
  const p = useMemo(() => planoHolerite(b, h), [b, h]);
  const [desc, setDesc] = useState(h.kind), [data, setData] = useState(h.date);
  const P = h.ev.filter(e => e.side === "p"), D = h.ev.filter(e => e.side === "d");
  const lanca = (trocar: string | null) => { onSalvar(aplicarHolerite(b, p, desc, data, trocar, Date.now(), id)); onAviso(trocar ? `${desc} atualizado.` : `${desc} lançado.`); onFechar(); };
  return (
    <div className="lfundo" onMouseDown={ev => ev.target === ev.currentTarget && onFechar()}>
      <div className="lfolha extsheet" role="dialog" aria-modal="true" aria-labelledby="hl-t">
        <h2 id="hl-t">Holerite · {mesTxt(h.ref)}</h2>
        <div className="ppsaldo"><small>líquido · cai em {dm(h.date)}{h.emp ? ` · ${h.emp}` : ""}</small><b>{R(h.cents)}</b></div>
        {p.velho && <p className="lerro">Antes de set/2026: entra só no histórico do salário previsto, não vira receita.</p>}
        {p.igual && !p.velho && <p className="lerro">{p.mesmo ? "Esse holerite já foi importado" : "Parece já lançado"}: “{p.igual.desc}”, {R(p.igual.cents)} em {dm(p.igual.date)}.</p>}
        {h.check === false && <p className="lerro">Proventos − descontos não bateu com o líquido. Confira o valor.</p>}
        {h.conv && <p className="lnota">Convênio no mês: {R(h.conv.cents)} (já descontado do holerite).</p>}
        <details><summary>Ver proventos e descontos</summary>
          <ul className="extl">{P.map((e, i) => <li key={"p" + i}><div className="extl-l"><span className="extl-d">{e.desc}</span><b>{R(e.cents)}</b></div></li>)}
            {D.map((e, i) => <li key={"d" + i}><div className="extl-l"><span className="extl-d">{e.desc}</span><b>− {R(e.cents)}</b></div></li>)}</ul></details>
        <label>Descrição<input value={desc} maxLength={80} onChange={ev => setDesc(ev.target.value)} /></label>
        <label>Data<input type="date" value={data} onChange={ev => setData(ev.target.value)} /></label>
        <div className="lacoes"><button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          {p.velho ? <button type="button" className="btn principal" onClick={() => { onSalvar(guardarHolerite(b, h)); onAviso("Guardado no histórico do salário."); onFechar(); }}>Guardar no histórico</button>
            : p.igual ? <><button type="button" className="btn" onClick={() => lanca(null)}>Lançar mesmo assim</button><button type="button" className="btn principal" onClick={() => lanca(p.igual!.id)}>Trocar pelo do holerite</button></>
            : <button type="button" className="btn principal" onClick={() => lanca(null)}>Lançar receita</button>}</div>
      </div>
    </div>
  );
}
