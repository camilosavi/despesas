import { useState } from "react";
import { salvarCartao, salvarConta } from "./loja";
import type { Backup } from "./loja";
import { centsDe } from "./Lancar";
import { R } from "./format";
import "./lancar.css";

interface Props { b: Backup; hoje: string; onSalvar: (b: Backup) => void; onBaixar: () => void; onFechar: () => void }

export function Ajustes({ b, hoje, onSalvar, onBaixar, onFechar }: Props) {
  const [conta, setConta] = useState(""), [saldo, setSaldo] = useState("");
  const [cartao, setCartao] = useState(""), [venc, setVenc] = useState(""), [lim, setLim] = useState(""), [fecha, setFecha] = useState("");
  const [msg, setMsg] = useState("");
  const contas = (b.cfg.accts || []) as { name: string; cents: number }[];
  const cartoes = Object.entries((b.cfg.cards || {}) as Record<string, { due?: number; limit?: number; kind?: string }>).filter(([, k]) => k.kind !== "ben");
  const dia = (s: string) => { const n = parseInt(s, 10); return n >= 1 && n <= 31 ? n : 0; };
  const addConta = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!conta.trim()) return setMsg("Dê um nome para a conta.");
    onSalvar(salvarConta(b, conta.trim(), centsDe(saldo), Date.now(), hoje)); setConta(""); setSaldo(""); setMsg("Conta salva.");
  };
  const addCartao = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!cartao.trim()) return setMsg("Dê um nome para o cartão.");
    if (!dia(venc)) return setMsg("Informe o dia do vencimento (1 a 31).");
    onSalvar(salvarCartao(b, cartao.trim(), { due: dia(venc), limit: centsDe(lim), close: dia(fecha) })); setCartao(""); setVenc(""); setLim(""); setFecha(""); setMsg("Cartão salvo.");
  };
  return (
    <div className="lfundo" onMouseDown={ev => ev.target === ev.currentTarget && onFechar()}>
      <div className="lfolha" role="dialog" aria-modal="true" aria-labelledby="at">
        <h2 id="at">Contas, cartões e backup</h2>
        {contas.length > 0 && <ul className="lista-ajuste">{contas.map(c => <li key={c.name}><span>{c.name}</span><b>{R(c.cents)}</b></li>)}</ul>}
        <form className="lgrupo" onSubmit={addConta}>
          <span className="lrot">Conta com saldo (digite o saldo que o banco mostra hoje; mesmo nome atualiza)</span>
          <label>Nome da conta<input value={conta} onChange={ev => setConta(ev.target.value)} placeholder="Ex.: Nubank" list="contas-nomes" /></label>
          <datalist id="contas-nomes">{contas.map(c => <option key={c.name} value={c.name} />)}</datalist>
          <label>Saldo (R$)<input inputMode="decimal" value={saldo} onChange={ev => setSaldo(ev.target.value)} placeholder="0,00" /></label>
          <button type="submit" className="btn">Salvar conta</button>
        </form>
        {cartoes.length > 0 && <ul className="lista-ajuste">{cartoes.map(([n, k]) => <li key={n}><span>{n}</span><b>vence dia {k.due || "?"}{k.limit ? " · limite " + R(k.limit) : ""}</b></li>)}</ul>}
        <form className="lgrupo" onSubmit={addCartao}>
          <span className="lrot">Cartão de crédito (mesmo nome atualiza)</span>
          <label>Nome<input value={cartao} onChange={ev => setCartao(ev.target.value)} placeholder="Ex.: Inter" list="cartoes-nomes" /></label>
          <datalist id="cartoes-nomes">{cartoes.map(([n]) => <option key={n} value={n} />)}</datalist>
          <div className="lduas">
            <label>Dia do vencimento<input inputMode="numeric" value={venc} onChange={ev => setVenc(ev.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
            <label>Melhor dia de compra - 1 (fechamento, opcional)<input inputMode="numeric" value={fecha} onChange={ev => setFecha(ev.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
          </div>
          <label>Limite (R$, opcional)<input inputMode="decimal" value={lim} onChange={ev => setLim(ev.target.value)} placeholder="0,00" /></label>
          <button type="submit" className="btn">Salvar cartão</button>
        </form>
        {msg && <p className="lnota" role="status">{msg}</p>}
        <div className="lacoes">
          <button type="button" className="btn" onClick={onBaixar}>Baixar backup (JSON)</button>
          <button type="button" className="btn principal" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
