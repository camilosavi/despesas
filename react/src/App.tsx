import { useMemo, useRef, useState } from "react";
import { Inicio } from "./Inicio";
import { Contas } from "./Contas";
import { Cartoes } from "./Cartoes";
import type { Destino } from "./blocos";
import { abrirBackup, cargaDe, exemplo, lerArquivo } from "./dados";
import type { Carga } from "./dados";
import { Lancar } from "./Lancar";
import type { Pedido } from "./Lancar";
import { Ajustes } from "./Ajustes";
import { Pessoas } from "./Pessoas";
import { Metas } from "./Metas";
import { Moedas } from "./Moedas";
import { Relatorios } from "./Relatorios";
import { assinaturas } from "./assinaturas";
import { marcarVarios, vazio } from "./loja";
import type { Backup } from "./loja";
import { hojeISO } from "./format";

const CHAVE = "despesas.react.backup";
function guardado(): Backup | null {
  try { const t = localStorage.getItem(CHAVE); return t ? (JSON.parse(t) as Backup) : null; } catch { return null; }
}
function guardar(b: Backup | null) {
  try { if (b) localStorage.setItem(CHAVE, JSON.stringify(b)); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento: segue na memória */ }
}

const AINDA: Partial<Record<Destino, string>> = { busca: "Busca", avisos: "Avisos" };

export function App() {
  const [b, setB] = useState<Backup | null>(guardado);
  const [erro, setErro] = useState("");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const [aviso, setAviso] = useState("");
  const [tela, setTela] = useState<"inicio" | "contas" | "cartoes" | "pessoas" | "metas" | "relatorios" | "moedas">("inicio");
  const arq = useRef<HTMLInputElement>(null);
  const hoje = hojeISO();
  const c: Carga = useMemo(() => (b ? cargaDe(b, hoje) : erro ? { ...exemplo(), erro } : exemplo()), [b, hoje, erro]);
  const salvar = (nb: Backup) => { setB(nb); guardar(nb); setErro(""); };
  const abrir = async (f?: File) => {
    if (!f) return;
    const r = abrirBackup(await lerArquivo(f).catch(() => "")); 
    if (r.backup) salvar(r.backup); else setErro(r.erro || "Não consegui abrir o arquivo.");
    if (arq.current) arq.current.value = "";
  };
  const baixar = () => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: "application/json" }));
    a.download = `um-tostao-backup-${hoje}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  const lancar = (p: Pedido) => {
    if (!b) { setAviso("Para lançar, escolha “Começar do zero” ou “Usar meus dados”. O exemplo é só para olhar."); return; }
    setAviso(""); setPedido(p);
  };
  const ir = (d: Destino) => {
    setAviso("");
    if (d === "contas" || d === "transacoes") setTela("contas");
    else if (d === "cartoes") setTela("cartoes");
    else if (d === "pessoas") setTela("pessoas");
    else if (d === "lancar-rec") lancar({ tipo: "rec" });
    else if (d === "lancar-desp") lancar({ tipo: "desp" });
    else if (d === "menu") { if (b) setAjustes(true); else setAviso("Escolha “Começar do zero” ou “Usar meus dados” para configurar contas e cartões."); }
    else setAviso(`${AINDA[d]} ainda está só no app atual; entra no React na próxima etapa.`);
  };
  const r = c.resumo;
  return (
    <>
      <div className="carga">
        <button type="button" className="btn" onClick={() => arq.current?.click()}>Usar meus dados</button>
        {!b && <button type="button" className="btn" onClick={() => salvar(vazio())}>Começar do zero</button>}
        <input ref={arq} type="file" accept=".json,application/json" hidden onChange={ev => abrir(ev.target.files?.[0])} />
        {b && <button type="button" className="btn ghost" onClick={baixar}>Baixar backup</button>}
        {b && <button type="button" className="btn ghost" onClick={() => { if (confirm("Voltar ao exemplo? Os dados guardados neste navegador serão apagados (baixe o backup antes).")) { setB(null); guardar(null); } }}>Voltar ao exemplo</button>}
        <span className="st2" role="status">
          {c.erro ? <b className="neg">{c.erro}</b>
            : r ? `Seus dados: ${r.lancamentos} lançamentos · ${r.faturas} faturas · ${r.contas} ${r.contas === 1 ? "conta" : "contas"} · ${r.cartoes} ${r.cartoes === 1 ? "cartão" : "cartões"}${r.semData ? " · " + r.semData + " sem data/valor (ignorados)" : ""}. Ficam só neste navegador; baixe o backup de vez em quando.`
            : "Exemplo com dados inventados. “Começar do zero” cria o seu; “Usar meus dados” lê o backup JSON da tela Você. Nada sai deste navegador."}
        </span>
      </div>
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {tela === "inicio" ? <Inicio e={c.estado} pers={c.pers} nome={c.nome} onIr={ir} />
        : tela === "contas" ? <Contas e={c.estado} pers={c.pers} onIr={ir} onEdit={id => lancar({ id })} />
        : tela === "relatorios" ? <Relatorios e={c.estado} pers={c.pers} onVoltar={() => setTela("metas")} />
        : tela === "moedas" ? <Moedas b={b} hoje={hoje} onSalvar={salvar} onAviso={setAviso} onVoltar={() => setTela("metas")} />
        : tela === "metas" ? <Metas onMoedas={() => setTela("moedas")} onRel={() => setTela("relatorios")} subs={assinaturas(c.estado.lancamentos)} b={b} hoje={hoje} onSalvar={salvar} onAviso={setAviso} />
        : tela === "pessoas" ? <Pessoas b={b} hoje={hoje} onSalvar={salvar} onAviso={setAviso} />
        : <Cartoes e={c.estado} onVoltar={() => setTela("inicio")} onEdit={id => lancar({ id })} onPagar={b ? (ids, pago) => salvar(marcarVarios(b, ids, pago, Date.now())) : undefined} />}
      <button type="button" className="fab" aria-label="Novo lançamento" onClick={() => lancar({ tipo: "desp" })}>+</button>
      <nav className="bar" aria-label="Telas">
        <button type="button" aria-current={tela === "inicio" ? "page" : undefined} onClick={() => { setTela("inicio"); setAviso(""); }}>Início</button>
        <button type="button" aria-current={tela === "contas" ? "page" : undefined} onClick={() => { setTela("contas"); setAviso(""); }}>Contas</button>
        <button type="button" aria-current={tela === "cartoes" ? "page" : undefined} onClick={() => { setTela("cartoes"); setAviso(""); }}>Cartões</button>
        <button type="button" aria-current={tela === "pessoas" ? "page" : undefined} onClick={() => { setTela("pessoas"); setAviso(""); }}>Pessoas</button>
        <button type="button" aria-current={tela === "metas" || tela === "relatorios" || tela === "moedas" ? "page" : undefined} onClick={() => { setTela("metas"); setAviso(""); }}>Metas</button>
      </nav>
      {pedido && b && <Lancar key={pedido.id ?? pedido.tipo} b={b} pers={c.pers} hoje={hoje} pedido={pedido} onSalvar={salvar} onFechar={() => setPedido(null)} />}
      {ajustes && b && <Ajustes b={b} hoje={hoje} onSalvar={salvar} onBaixar={baixar} onFechar={() => setAjustes(false)} />}
    </>
  );
}
