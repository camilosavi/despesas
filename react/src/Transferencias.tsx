import { useState } from "react";
import type { Backup, Transf } from "./loja";
import { transfExcluir, transfSalvar, transfs } from "./loja";
import { centsDe } from "./Lancar";
import { R, dm, mLab } from "./format";
import "./lancar.css";
import "./pessoas.css";
import "./metas.css";

interface Props { b: Backup | null; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void; onVoltar: () => void }
const contasR = (b: Backup) => ((b.cfg.accts || []) as { name: string; cur?: string }[]).filter(a => !a.cur || a.cur === "BRL").map(a => a.name);

export function Transferencias({ b, hoje, onSalvar, onAviso, onVoltar }: Props) {
  const nomes = b ? contasR(b) : [];
  const [filtro, setFiltro] = useState("");
  const [ed, setEd] = useState<string | "novo" | null>(null);
  const [de, setDe] = useState(nomes[0] || ""), [para, setPara] = useState(nomes[1] || "");
  const [valor, setValor] = useState(""), [data, setData] = useState(hoje), [desc, setDesc] = useState(""), [erro, setErro] = useState(""), [ex, setEx] = useState(false);
  const lista = (b ? transfs(b) : []).filter(t => !filtro || t.from === filtro || t.to === filtro).sort((x, y) => y.date.localeCompare(x.date) || y.ts - x.ts);
  const meses: [string, Transf[]][] = [];
  for (const t of lista) { const m = t.date.slice(0, 7), u = meses[meses.length - 1]; if (u && u[0] === m) u[1].push(t); else meses.push([m, [t]]); }
  const abrir = (t?: Transf) => {
    setErro(""); setEx(false);
    if (t) { setEd(t.id); setDe(t.from); setPara(t.to); setValor((t.cents / 100).toFixed(2).replace(".", ",")); setData(t.date); setDesc(t.desc || ""); }
    else { setEd("novo"); setDe(nomes[0] || ""); setPara(nomes[1] || ""); setValor(""); setData(hoje); setDesc(""); }
  };
  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!b) return;
    const r = transfSalvar(b, { id: ed && ed !== "novo" ? ed : undefined, from: de, to: para, cents: centsDe(valor), date: data, desc }, Date.now());
    if (r.erro) return setErro(r.erro);
    onSalvar(r.backup); setEd(null); onAviso(data > hoje ? "Transferência agendada." : "Transferência salva.");
  };
  return (
    <main className="pg metas transf">
      <button type="button" className="btn" onClick={onVoltar}>‹ Contas</button>
      <h1>Transferências</h1>
      {!b && <p className="vazio">Escolha “Começar do zero” ou “Usar meus dados” para registrar transferências.</p>}
      {b && nomes.length < 2 && <p className="vazio">Cadastre duas contas em R$ (Menu do Início) para transferir entre elas.</p>}
      {b && nomes.length >= 2 && (
        <>
          <p className="lnota">Transferência só move saldo entre contas: não é despesa nem receita.</p>
          {ed === null && <button type="button" className="btn principal" onClick={() => abrir()}>+ Nova transferência</button>}
          {ed !== null && (
            <form className="lgrupo" onSubmit={salvar} aria-label={ed === "novo" ? "Nova transferência" : "Editar transferência"}>
              <label>Sai de<select value={de} onChange={x => setDe(x.target.value)}>{nomes.map(n => <option key={n}>{n}</option>)}</select></label>
              <label>Entra em<select value={para} onChange={x => setPara(x.target.value)}>{nomes.map(n => <option key={n}>{n}</option>)}</select></label>
              <label>Valor (R$)<input inputMode="decimal" autoComplete="off" placeholder="0,00" value={valor} onChange={x => { setValor(x.target.value); setErro(""); }} /></label>
              <label>Data<input type="date" value={data} onChange={x => setData(x.target.value)} /></label>
              {data > hoje && <p className="lnota">Data futura: fica agendada e só mexe nos saldos quando chegar.</p>}
              <label>Descrição (opcional)<input value={desc} maxLength={40} onChange={x => setDesc(x.target.value)} /></label>
              {erro && <p className="lerro" role="alert">{erro}</p>}
              <div className="lacoes">
                <button type="submit" className="btn principal">Salvar</button>
                <button type="button" className="btn" onClick={() => setEd(null)}>Cancelar</button>
                {ed !== "novo" && <button type="button" className="perigo" onClick={() => { if (!ex) setEx(true); else { onSalvar(transfExcluir(b, ed)); setEd(null); onAviso("Transferência excluída."); } }}>{ex ? "Toque de novo para excluir" : "Excluir"}</button>}
              </div>
            </form>
          )}
          {nomes.length >= 3 && (
            <label className="lnota">Conta<select value={filtro} onChange={x => setFiltro(x.target.value)}><option value="">Todas</option>{nomes.map(n => <option key={n}>{n}</option>)}</select></label>
          )}
          {meses.length === 0 && <p className="vazio">Nenhuma transferência ainda.</p>}
          {meses.map(([m, ts]) => (
            <section key={m} aria-label={mLab(m)}>
              <h2>{mLab(m)}</h2>
              <ul className="pplista">{ts.map(t => (
                <li key={t.id}><button type="button" className="pprow mrow" aria-label={`Editar transferência de ${t.from} para ${t.to}`} onClick={() => abrir(t)}>
                  <span className="ppnm">{t.from} → {t.to}<em>{dm(t.date)}{t.date > hoje ? " · agendada" : ""}{t.desc ? " · " + t.desc : ""}</em></span>
                  <b>{R(t.cents)}</b></button></li>
              ))}</ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
