import type { CSSProperties, ReactNode } from "react";
import type { Estado, Pers } from "./engine";
import { dataLonga } from "./format";
import { notaDeSaude, saudeVisivel } from "./saude";
import { Cartoes, Fluxo, Gastos, Pagar, Pessoas, Resumo, Saldo, Saude, Trans } from "./blocos";
import type { BlocoProps, Destino } from "./blocos";

// Ordem e tamanho padrão de cada bloco (largura × altura em "quadrados"); a grade encaixa como no protótipo.
const BLOCOS: { id: string; nome: string; tam: [number, number]; quieto?: boolean; ver: (p: BlocoProps) => ReactNode }[] = [
  { id: "saldo", nome: "Na conta hoje", tam: [1, 3], ver: p => <Saldo {...p} /> },
  { id: "resumo", nome: "Resumo do mês", tam: [2, 2], ver: p => <Resumo {...p} /> },
  { id: "saude", nome: "Nota de saúde", tam: [1, 2], quieto: true, ver: p => <Saude {...p} /> },
  { id: "fluxo", nome: "Fluxo de caixa", tam: [2, 4], quieto: true, ver: p => <Fluxo {...p} /> },
  { id: "gastos", nome: "Gastos", tam: [1, 6], quieto: true, ver: p => <Gastos {...p} /> },
  { id: "cartoes", nome: "Cartões", tam: [1, 6], quieto: true, ver: p => <Cartoes {...p} /> },
  { id: "pagar", nome: "Vence em 10 dias", tam: [2, 2], quieto: true, ver: p => <Pagar {...p} /> },
  { id: "trans", nome: "Últimas transações", tam: [3, 4], quieto: true, ver: p => <Trans {...p} /> },
  { id: "pessoas", nome: "Pessoas", tam: [1, 4], quieto: true, ver: p => <Pessoas {...p} /> },
];

const Icone = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

export function Inicio({ e, pers, nome, onIr, nAvisos = 0 }: { e: Estado; pers: Pers; nome: string; onIr: (d: Destino) => void; nAvisos?: number }) {
  const p: BlocoProps = { e, pers, onIr };
  const mostraSaude = saudeVisivel(notaDeSaude(e));
  return (
    <div className="pg">
      <header className="dtop">
        <button type="button" aria-label="Menu" onClick={() => onIr("menu")}><Icone d="M4 7h16M4 12h16M4 17h16" /></button>
        <div className="ola"><h1>Olá{nome ? ", " + nome : ""}</h1><small>{dataLonga(e.hoje)}</small></div>
        <button type="button" aria-label="Buscar" onClick={() => onIr("busca")}><Icone d="M11 5a6 6 0 100 12 6 6 0 000-12zM20 20l-4-4" /></button>
        <button type="button" className="sino" aria-label={nAvisos ? `Avisos (${nAvisos})` : "Avisos"} onClick={() => onIr("avisos")}><Icone d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4" />{nAvisos > 0 && <b aria-hidden="true">{nAvisos > 9 ? "9+" : nAvisos}</b>}</button>
      </header>
      <main className="dgrid">
        {BLOCOS.filter(b => b.id !== "saude" || mostraSaude).map(b => (
          <section key={b.id} className={`db d-${b.id}${b.quieto ? " quieto" : ""}`} aria-label={b.nome}
            style={{ "--w": b.tam[0], "--h": b.tam[1] } as CSSProperties}>
            {b.ver(p)}
          </section>
        ))}
      </main>
    </div>
  );
}
