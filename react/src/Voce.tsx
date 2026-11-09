import { useRef, useState } from "react";
import { CORES, MODOS, csvLancamentos, estatisticas, nomeDe, salvarNome } from "./voce";
import type { Visual } from "./voce";
import type { Backup } from "./loja";
import { R, dm } from "./format";
import "./voce.css";

interface Props {
  b: Backup | null; hoje: string; visual: Visual; desfazer: number;
  onVisual: (v: Visual) => void; onSalvar: (b: Backup) => void; onBaixar: () => void; onAbrir: (f?: File) => void;
  onZerar: () => void; onDesfazer: () => void; onContas: () => void; onExtrato: () => void; onVoltar: () => void; onAviso: (m: string) => void;
}

export function Voce({ b, hoje, visual, desfazer, onVisual, onSalvar, onBaixar, onAbrir, onZerar, onDesfazer, onContas, onExtrato, onVoltar, onAviso }: Props) {
  const [nome, setNome] = useState(b ? nomeDe(b) : "");
  const [certo, setCerto] = useState(false);
  const arq = useRef<HTMLInputElement>(null);
  const csv = () => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csvLancamentos(b)], { type: "text/csv;charset=utf-8" }));
    a.download = `um-tostao-lancamentos-${hoje}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const zerar = () => {
    if (!certo) { setCerto(true); window.setTimeout(() => setCerto(false), 5000); return; }
    setCerto(false); onZerar(); onAviso("Lançamentos e saldos apagados. “Desfazer” volta tudo.");
  };
  return (
    <main className="pg voce" aria-label="Você">
      <header className="vtop">
        <button type="button" className="dlink" onClick={onVoltar}>‹ Início</button>
        <h1>Você</h1>
      </header>

      <section aria-labelledby="v-ap">
        <h2 id="v-ap">Aparência</h2>
        <div className="lgrupo"><span className="lrot" id="v-modo">Modo</span>
          <div className="vseg" role="group" aria-labelledby="v-modo">
            {MODOS.map(m => <button key={m.id} type="button" aria-pressed={visual.modo === m.id} onClick={() => onVisual({ ...visual, modo: m.id })}>{m.nome}</button>)}
          </div>
        </div>
        <div className="lgrupo"><span className="lrot" id="v-cor">Cor do app</span>
          <div className="vcores" role="group" aria-labelledby="v-cor">
            {CORES.map(c => (
              <button key={c.id} type="button" className="vcor" aria-pressed={visual.cor === c.id} onClick={() => onVisual({ ...visual, cor: c.id })}>
                <i style={{ background: c.cor }} aria-hidden="true" />{c.nome}
              </button>
            ))}
          </div>
        </div>
        <p className="lnota">Fica só neste aparelho.</p>
      </section>

      {b ? (
        <>
          <section aria-labelledby="v-eu">
            <h2 id="v-eu">Seu nome</h2>
            <form className="vlinha" onSubmit={ev => { ev.preventDefault(); onSalvar(salvarNome(b, nome)); onAviso("Nome salvo."); }}>
              <label className="sr" htmlFor="v-nome">Seu nome</label>
              <input id="v-nome" value={nome} maxLength={40} onChange={ev => setNome(ev.target.value)} placeholder="Como o app te chama" autoComplete="given-name" />
              <button type="submit" className="btn">Salvar</button>
            </form>
          </section>

          <section aria-labelledby="v-ct">
            <h2 id="v-ct">Contas e cartões</h2>
            <div className="vacoes"><button type="button" className="btn ghost" onClick={onContas}>Editar contas, saldos e cartões</button><button type="button" className="btn ghost" onClick={onExtrato}>Importar extrato (OFX ou CSV)</button></div>
          </section>

          <section aria-labelledby="v-bk">
            <h2 id="v-bk">Backup e exportação</h2>
            <div className="vacoes">
              <button type="button" className="btn" onClick={onBaixar}>Baixar backup (JSON)</button>
              <button type="button" className="btn ghost" onClick={() => arq.current?.click()}>Restaurar de um backup</button>
              <button type="button" className="btn ghost" onClick={csv}>Exportar lançamentos (CSV)</button>
              <input ref={arq} type="file" accept=".json,application/json" hidden onChange={ev => { onAbrir(ev.target.files?.[0]); ev.target.value = ""; }} />
            </div>
            <p className="lnota">Restaurar troca os dados deste navegador pelos do arquivo.</p>
          </section>

          <Estat b={b} />

          <section aria-labelledby="v-zr">
            <h2 id="v-zr">Zerar</h2>
            <p className="lnota">Apaga todos os lançamentos, saldos das contas e transferências. Cartões, euro, caixinhas, dívidas, pessoas e categorias ficam.</p>
            <div className="vacoes">
              <button type="button" className="perigo" onClick={zerar} aria-live="polite">{certo ? "Toque de novo para apagar" : "Zerar lançamentos e saldo"}</button>
              {desfazer > 0 && <button type="button" className="btn ghost" onClick={onDesfazer}>Desfazer ({desfazer})</button>}
            </div>
          </section>
        </>
      ) : <p className="lnota">Escolha “Começar do zero” ou “Usar meus dados” para ver nome, backup e zerar.</p>}
    </main>
  );
}

function Estat({ b }: { b: Backup }) {
  const s = estatisticas(b), y = (d: string) => d.slice(8) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
  const L: [string, string][] = [
    ["Lançamentos", `${s.lancamentos} (${s.despesas} despesas · ${s.receitas} receitas)`],
    ["Primeiro lançamento", s.desde ? `${y(s.desde)} · ${s.meses} ${s.meses === 1 ? "mês" : "meses"} com movimento` : "ainda não há"],
    ["Maior despesa", s.maior ? `${s.maior.desc} · ${R(s.maior.cents)} (${dm(s.maior.date)})` : "—"],
    ["Contas · cartões", `${s.contas} · ${s.cartoes}`],
    ["Caixinhas · dívidas · pessoas", `${s.caixinhas} · ${s.dividas} · ${s.pessoas}`],
    ["Tamanho dos dados", `${s.kb} KB neste navegador`],
  ];
  return (
    <section aria-labelledby="v-es">
      <h2 id="v-es">Estatísticas</h2>
      <dl className="vest">{L.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </section>
  );
}
