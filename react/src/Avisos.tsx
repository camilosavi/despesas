import { useState } from "react";
import type { Estado } from "./engine";
import type { Backup } from "./loja";
import { avisoDispensar, avisos, avisosRestaurar, dispensados } from "./avisos";
import type { Aviso, Destino } from "./avisos";
import "./telas.css";

interface Props { e: Estado; b: Backup | null; pers: Record<string, unknown>; onSalvar: (b: Backup) => void; onIr: (d: Destino, a: Aviso) => void; onVoltar: () => void }

export function Avisos({ e, b, pers, onSalvar, onIr, onVoltar }: Props) {
  const [todos, setTodos] = useState(false);
  const L = avisos(e, b, pers, todos), off = dispensados(b).length;
  return (
    <main className="pg tela avisos">
      <button type="button" className="btn ghost" onClick={onVoltar}>‹ Início</button>
      <h1>Avisos</h1>
      {L.length === 0 && <p className="vazio" role="status">{todos ? "Nada para avisar agora." : "Tudo em dia: nenhum atraso, vencimento próximo, limite ou orçamento pedindo atenção."}</p>}
      <ul className="tlista">
        {L.map(a => (
          <li key={a.k} className={"tav " + a.nivel}>
            <button type="button" className="trow" onClick={() => onIr(a.ir, a)}>
              <i aria-hidden="true">{a.nivel === "alto" ? "!" : "•"}</i>
              <span className="tnm"><b>{a.titulo}</b><em>{a.detalhe}</em></span>
            </button>
            {b && !todos && <button type="button" className="tx" aria-label={`Dispensar: ${a.titulo}`} onClick={() => onSalvar(avisoDispensar(b, a.k))}>✕</button>}
          </li>
        ))}
      </ul>
      {b && off > 0 && (
        <p className="tdisp">
          <button type="button" className="dlink" onClick={() => setTodos(!todos)}>{todos ? "Esconder os dispensados" : `Ver também os ${off} dispensados`}</button>
          {" · "}
          <button type="button" className="dlink" onClick={() => { onSalvar(avisosRestaurar(b)); setTodos(false); }}>Voltar a avisar tudo</button>
        </p>
      )}
      <p className="vazio">Os avisos aparecem aqui dentro do app; notificações no celular só existem no app atual.</p>
    </main>
  );
}
