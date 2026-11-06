import { useRef, useState } from "react";
import { Inicio } from "./Inicio";
import { Contas } from "./Contas";
import { Cartoes } from "./Cartoes";
import type { Destino } from "./blocos";
import { exemplo, lerArquivo, lerBackup } from "./dados";
import type { Carga } from "./dados";
import { hojeISO } from "./format";

const AINDA: Record<Destino, string> = {
  contas: "Contas", cartoes: "Cartões", transacoes: "Transações", "lancar-rec": "Lançar receita", "lancar-desp": "Lançar despesa",
  menu: "Menu", busca: "Busca", avisos: "Avisos",
};

export function App() {
  const [c, setC] = useState<Carga>(exemplo);
  const [aviso, setAviso] = useState("");
  const [tela, setTela] = useState<"inicio" | "contas" | "cartoes">("inicio");
  const arq = useRef<HTMLInputElement>(null);
  const abrir = async (f?: File) => {
    if (!f) return;
    try { setC(lerBackup(await lerArquivo(f), hojeISO())); }
    catch (err) { setC({ ...exemplo(), erro: err instanceof Error ? err.message : "Não consegui abrir o arquivo." }); }
    if (arq.current) arq.current.value = "";
  };
  const ir = (d: Destino) => {
    if (d === "contas" || d === "transacoes") { setTela("contas"); setAviso(""); return; }
    if (d === "cartoes") { setTela("cartoes"); setAviso(""); return; }
    setAviso(`${AINDA[d]} ainda está só no app atual; entra no React na próxima etapa.`);
  };
  const r = c.resumo;
  return (
    <>
      <div className="carga">
        <button type="button" className="btn" onClick={() => arq.current?.click()}>Usar meus dados</button>
        <input ref={arq} type="file" accept=".json,application/json" hidden onChange={ev => abrir(ev.target.files?.[0])} />
        {c.real && <button type="button" className="btn ghost" onClick={() => { setC(exemplo()); setAviso(""); }}>Voltar ao exemplo</button>}
        <span className="st2" role="status">
          {c.erro ? <b className="neg">{c.erro}</b>
            : r ? `Lidos do seu backup: ${r.lancamentos} lançamentos · ${r.faturas} faturas · ${r.contas} ${r.contas === 1 ? "conta" : "contas"} · ${r.cartoes} ${r.cartoes === 1 ? "cartão" : "cartões"}${r.semData ? " · " + r.semData + " sem data/valor (ignorados)" : ""}. Os dados ficam só neste navegador.`
            : "Exemplo com dados inventados. Escolha o backup (JSON da tela Você) para ver os seus números; nada sai deste navegador."}
        </span>
      </div>
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {tela === "inicio" ? <Inicio e={c.estado} pers={c.pers} nome={c.nome} onIr={ir} />
        : tela === "contas" ? <Contas e={c.estado} pers={c.pers} onIr={ir} />
        : <Cartoes e={c.estado} onVoltar={() => setTela("inicio")} />}
      <nav className="bar" aria-label="Telas">
        <button type="button" aria-current={tela === "inicio" ? "page" : undefined} onClick={() => { setTela("inicio"); setAviso(""); }}>Início</button>
        <button type="button" aria-current={tela === "contas" ? "page" : undefined} onClick={() => { setTela("contas"); setAviso(""); }}>Contas</button>
        <button type="button" aria-current={tela === "cartoes" ? "page" : undefined} onClick={() => { setTela("cartoes"); setAviso(""); }}>Cartões</button>
      </nav>
    </>
  );
}
