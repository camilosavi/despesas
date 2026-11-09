import { useEffect, useMemo, useRef, useState } from "react";
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
import { Fixos } from "./Fixos";
import { Categorias } from "./Categorias";
import { Relatorios } from "./Relatorios";
import { Transferencias } from "./Transferencias";
import { Voce } from "./Voce";
import { Extrato } from "./Extrato";
import { Busca } from "./Busca";
import { Trava } from "./Trava";
import { FUNDO_MS, temSenha } from "./senha";
import { Avisos } from "./Avisos";
import { Patrimonio } from "./Patrimonio";
import { avisos as listaAvisos } from "./avisos";
import { lerExtrato, planoExtrato } from "./extrato";
import type { Extrato as Ext, Item as ItemExt } from "./extrato";
import * as C from "./engine";
import { aplicarVisual, guardarVisual, lerVisual, zerarLancamentos } from "./voce";
import type { Visual } from "./voce";
import { assinaturas } from "./assinaturas";
import { marcarVarios, transfs, vazio } from "./loja";
import type { Backup } from "./loja";
import { hojeISO } from "./format";
import { Login } from "./Login";
import { useNuvem, LOGIN } from "./useNuvem";
import { lapideAdd, sessao, sumiram } from "./nuvem";

const CHAVE = "despesas.react.backup";
const CH_ANTES = "despesas.react.antesZerar";
function guardado(): Backup | null {
  try { const t = localStorage.getItem(CHAVE); return t ? (JSON.parse(t) as Backup) : null; } catch { return null; }
}
function guardar(b: Backup | null) {
  try { if (b) localStorage.setItem(CHAVE, JSON.stringify(b)); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento: segue na memória */ }
}


export function App() {
  const [b, setB] = useState<Backup | null>(guardado);
  const [erro, setErro] = useState("");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const [aviso, setAviso] = useState("");
  const [tela, setTela] = useState<"inicio" | "contas" | "cartoes" | "pessoas" | "metas" | "relatorios" | "moedas" | "fixos" | "categorias" | "transf" | "voce" | "busca" | "avisos" | "patrimonio">("inicio");
  const [visual, setVisual] = useState<Visual>(lerVisual);
  const [antes, setAntes] = useState<Backup | null>(() => { try { const t = localStorage.getItem(CH_ANTES); return t ? (JSON.parse(t) as Backup) : null; } catch { return null; } });
  const [ext, setExt] = useState<{ e: Ext; plano: ItemExt[] } | null>(null);
  const [travado, setTravado] = useState(temSenha);
  const fundo = useRef(0);
  useEffect(() => {
    const f = () => { if (document.hidden) fundo.current = Date.now(); else if (fundo.current && Date.now() - fundo.current > FUNDO_MS && temSenha()) setTravado(true); };
    document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f);
  }, []);
  const arq = useRef<HTMLInputElement>(null), arqExt = useRef<HTMLInputElement>(null);
  const hoje = hojeISO();
  const c: Carga = useMemo(() => (b ? cargaDe(b, hoje) : erro ? { ...exemplo(), erro } : exemplo()), [b, hoje, erro]);
  const salvar = (nb: Backup) => { lapideAdd(sumiram(b, nb)); setB(nb); guardar(nb); setErro(""); };
  const daNuvem = (nb: Backup, av: string) => { setB(nb); guardar(nb); if (av) setAviso(av); };
  const nv = useNuvem(b, daNuvem);
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
  const mudarVisual = (v: Visual) => { setVisual(v); guardarVisual(v); aplicarVisual(v); };
  const zerar = () => {
    if (!b) return;
    try { localStorage.setItem(CH_ANTES, JSON.stringify(b)); } catch { /* sem armazenamento */ }
    setAntes(b); salvar(zerarLancamentos(b));
  };
  const desfazer = () => {
    if (!antes) return;
    salvar(antes); setAntes(null); try { localStorage.removeItem(CH_ANTES); } catch { /* ok */ }
    setAviso("Lançamentos de volta.");
  };
  const pedirExtrato = () => { if (!b) setAviso("Escolha “Começar do zero” ou “Usar meus dados” para importar um extrato."); else arqExt.current?.click(); };
  const abrirExtrato = async (f?: File) => {
    if (!f || !b) return;
    const r = await lerExtrato(f, hoje);
    if (arqExt.current) arqExt.current.value = "";
    if (!r.ok) return setAviso(r.erro);
    setAviso(""); setExt({ e: r.extrato, plano: planoExtrato(b, r.extrato, String(b.cfg.name || b.cfg.userName || "")) });
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
    else if (d === "menu") setTela("voce");
    else if (d === "busca") setTela("busca");
    else if (d === "avisos") setTela("avisos");
  };
  const nAvisos = useMemo(() => listaAvisos(c.estado, b, c.pers).length, [c, b]);
  if (LOGIN && !nv.ses) return <Login onEntrou={() => nv.setSes(sessao())} />;
  if (travado) return <Trava modo="entrar" onOk={() => { setTravado(false); setTela("inicio"); }} />;
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
      {tela === "voce" ? <Voce b={b} hoje={hoje} visual={visual} desfazer={antes ? antes.items.length : 0} onVisual={mudarVisual} onSalvar={salvar} onBaixar={baixar} onAbrir={abrir}
          onZerar={zerar} onDesfazer={desfazer} onExtrato={pedirExtrato} onBloquear={() => setTravado(true)} conta={nv.ses ? { email: nv.ses.email, st: nv.st, onAgora: () => void nv.agora(true), onSair: async () => { const m = await nv.sairConta(); if (!m) location.reload(); return m; } } : undefined} onContas={() => b ? setAjustes(true) : undefined} onVoltar={() => setTela("inicio")} onAviso={setAviso} />
        : tela === "inicio" ? <Inicio e={c.estado} pers={c.pers} nome={c.nome} onIr={ir} nAvisos={nAvisos} />
        : tela === "contas" ? <Contas e={c.estado} pers={c.pers} onIr={ir} onEdit={id => lancar({ id })} transf={b ? transfs(b) : []} onTransf={() => setTela("transf")} onPatri={() => setTela("patrimonio")} onExtrato={pedirExtrato} />
        : tela === "busca" ? <Busca e={c.estado} pers={c.pers} onEdit={b ? id => lancar({ id }) : undefined} onVoltar={() => setTela("inicio")} />
        : tela === "avisos" ? <Avisos e={c.estado} b={b} pers={c.pers} onSalvar={salvar} onVoltar={() => setTela("inicio")}
            onIr={(d, a) => { if (a.id && b) lancar({ id: a.id }); else setTela(d === "categorias" ? "categorias" : d); }} />
        : tela === "patrimonio" ? <Patrimonio e={c.estado} b={b} onSalvar={salvar} onVoltar={() => setTela("contas")} />
        : tela === "transf" ? <Transferencias b={b} hoje={hoje} onSalvar={salvar} onAviso={setAviso} onVoltar={() => setTela("contas")} />
        : tela === "relatorios" ? <Relatorios e={c.estado} pers={c.pers} onVoltar={() => setTela("metas")} />
        : tela === "categorias" ? <Categorias b={b} e={c.estado} pers={c.pers} hoje={hoje} onSalvar={salvar} onAviso={setAviso} onVoltar={() => setTela("metas")} />
        : tela === "fixos" ? <Fixos b={b} hoje={hoje} onSalvar={salvar} onAviso={setAviso} onVoltar={() => setTela("metas")} />
        : tela === "moedas" ? <Moedas b={b} hoje={hoje} onSalvar={salvar} onAviso={setAviso} onVoltar={() => setTela("metas")} />
        : tela === "metas" ? <Metas onCats={() => setTela("categorias")} onFixos={() => setTela("fixos")} onMoedas={() => setTela("moedas")} onRel={() => setTela("relatorios")} subs={assinaturas(c.estado.lancamentos, b)} b={b} hoje={hoje} onSalvar={salvar} onAviso={setAviso} />
        : tela === "pessoas" ? <Pessoas b={b} hoje={hoje} onSalvar={salvar} onAviso={setAviso} />
        : <Cartoes e={c.estado} onVoltar={() => setTela("inicio")} onEdit={id => lancar({ id })} onPagar={b ? (ids, pago) => salvar(marcarVarios(b, ids, pago, Date.now())) : undefined} />}
      <button type="button" className="fab" aria-label="Novo lançamento" onClick={() => lancar({ tipo: "desp" })}>+</button>
      <nav className="bar" aria-label="Telas">
        <button type="button" aria-current={tela === "inicio" ? "page" : undefined} onClick={() => { setTela("inicio"); setAviso(""); }}>Início</button>
        <button type="button" aria-current={tela === "contas" || tela === "transf" || tela === "patrimonio" ? "page" : undefined} onClick={() => { setTela("contas"); setAviso(""); }}>Contas</button>
        <button type="button" aria-current={tela === "cartoes" ? "page" : undefined} onClick={() => { setTela("cartoes"); setAviso(""); }}>Cartões</button>
        <button type="button" aria-current={tela === "pessoas" ? "page" : undefined} onClick={() => { setTela("pessoas"); setAviso(""); }}>Pessoas</button>
        <button type="button" aria-current={tela === "metas" || tela === "relatorios" || tela === "moedas" || tela === "fixos" || tela === "categorias" ? "page" : undefined} onClick={() => { setTela("metas"); setAviso(""); }}>Metas</button>
      </nav>
      {pedido && b && <Lancar key={pedido.id ?? pedido.tipo} b={b} pers={c.pers} hoje={hoje} pedido={pedido} onSalvar={salvar} onFechar={() => setPedido(null)} />}
      <input ref={arqExt} type="file" accept=".ofx,.qfx,.csv,text/csv" hidden onChange={ev => abrirExtrato(ev.target.files?.[0])} />
      {ext && b && <Extrato key={ext.e.at + ext.e.linhas.length} b={b} e={ext.e} plano={ext.plano} cats={{ desp: C.lista("desp", c.pers) as { k: string; n: string }[], rec: C.lista("rec", c.pers) as { k: string; n: string }[] }} onSalvar={salvar} onAviso={setAviso} onFechar={() => setExt(null)} />}
      {ajustes && b && <Ajustes b={b} hoje={hoje} onSalvar={salvar} onBaixar={baixar} onFechar={() => setAjustes(false)} />}
    </>
  );
}
