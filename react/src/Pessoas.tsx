import { useState } from "react";
import { ppApagarEntrada, ppCriar, ppDe, ppExcluir, ppLancar, ppQuitar, ppRenomear, ppSaldo, ppSinal } from "./loja";
import type { Backup, PP, PPTipo } from "./loja";
import { centsDe } from "./Lancar";
import { R, dm as dataBR } from "./format";
import "./lancar.css";
import "./pessoas.css";

interface Props { b: Backup | null; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void }
const TIPOS: { k: PPTipo; n: string }[] = [
  { k: "elaDeve", n: "Ela me deve" }, { k: "euDevo", n: "Eu devo a ela" }, { k: "elaPagou", n: "Ela me pagou" }, { k: "euPaguei", n: "Eu paguei" },
];
const novoId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const texto = (p: PP) => { const s = ppSaldo(p); return s > 0 ? "te deve" : s < 0 ? "você deve" : "quitado ✓"; };

// Mensagem de cobrança: as cobranças mais novas até cobrir o saldo
export function cobranca(p: PP): string {
  let resta = ppSaldo(p);
  if (resta <= 0) return "";
  const linhas: string[] = [];
  for (const x of [...p.e].filter(x => x.k === "d" && x.c > 0).sort((a, b) => b.d.localeCompare(a.d))) {
    if (resta <= 0) break;
    const v = Math.min(x.c, resta); resta -= v;
    linhas.push(`• ${x.t || "Despesa"} (${dataBR(x.d)}): ${R(v)}`);
  }
  return `Oi, ${p.name.split(" ")[0]}! Passando para combinar o acerto:\n${linhas.join("\n")}\nTotal: ${R(ppSaldo(p))}`;
}

export function Pessoas({ b, hoje, onSalvar, onAviso }: Props) {
  const [aberta, setAberta] = useState<string | null>(null), [nova, setNova] = useState("");
  const pp = b ? ppDe(b) : [];
  const ord = [...pp].sort((a, c) => Math.abs(ppSaldo(c)) - Math.abs(ppSaldo(a)) || a.name.localeCompare(c.name));
  const receber = pp.reduce((s, p) => s + Math.max(0, ppSaldo(p)), 0), dever = pp.reduce((s, p) => s + Math.max(0, -ppSaldo(p)), 0);
  const criar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!b) return onAviso("Escolha “Começar do zero” ou “Usar meus dados” para cadastrar pessoas.");
    const id = novoId(), nb = ppCriar(b, nova, id);
    if (nb === b) return onAviso(nova.trim() ? "Já existe uma pessoa com esse nome." : "Digite o nome da pessoa.");
    onSalvar(nb); setNova(""); setAberta(id);
  };
  const atual = pp.find(p => p.id === aberta);
  return (
    <main className="pg pessoas">
      <h1>Pessoas</h1>
      <div className="ppresumo"><div><small>A receber</small><b>{R(receber)}</b></div><div><small>A pagar</small><b className={dever ? "neg" : ""}>{R(dever)}</b></div></div>
      <form className="ppnova" onSubmit={criar}>
        <input value={nova} onChange={ev => setNova(ev.target.value)} placeholder="Nome da pessoa" aria-label="Nome da nova pessoa" />
        <button type="submit" className="btn">+ Pessoa</button>
      </form>
      {ord.length ? (
        <ul className="pplista">
          {ord.map(p => (
            <li key={p.id}><button type="button" className="pprow" onClick={() => setAberta(p.id)}>
              <span className="ppav" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="ppnm">{p.name}<em>{texto(p)}</em></span>
              <b className={ppSaldo(p) < 0 ? "neg" : ""}>{ppSaldo(p) ? R(Math.abs(ppSaldo(p))) : "—"}</b>
            </button></li>
          ))}
        </ul>
      ) : <p className="vazio">Ninguém ainda. Crie a pessoa e lance o que ela te deve (ou o que você deve a ela). Nada entra sozinho.</p>}
      {atual && b && <Folha b={b} p={atual} hoje={hoje} onSalvar={onSalvar} onFechar={() => setAberta(null)} />}
    </main>
  );
}

function Folha({ b, p, hoje, onSalvar, onFechar }: { b: Backup; p: PP; hoje: string; onSalvar: (b: Backup) => void; onFechar: () => void }) {
  const [tipo, setTipo] = useState<PPTipo>("elaDeve"), [val, setVal] = useState(""), [data, setData] = useState(hoje), [desc, setDesc] = useState("");
  const [edit, setEdit] = useState<string | null>(null), [apagar, setApagar] = useState<string | null>(null), [mais, setMais] = useState(false);
  const [nome, setNome] = useState(p.name), [excl, setExcl] = useState(false), [msg, setMsg] = useState("");
  const s = ppSaldo(p), msgWa = cobranca(p);
  const sal = (() => { let acc = 0; return [...p.e].sort((a, c) => a.d.localeCompare(c.d)).map(x => ({ ...x, depois: (acc += x.c) })).reverse(); })();
  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const c = centsDe(val);
    if (!c) return setMsg("Informe o valor.");
    const t = ppSinal(tipo, c);
    onSalvar(ppLancar(b, p.id, { id: edit || novoId(), d: data || hoje, c: t.c, k: t.k, t: desc.trim() || undefined }));
    setVal(""); setDesc(""); setEdit(null); setMsg("");
  };
  const editar = (id: string) => {
    const x = p.e.find(e => e.id === id); if (!x) return;
    setEdit(id); setVal(String(Math.abs(x.c) / 100).replace(".", ",")); setData(x.d); setDesc(x.t || "");
    setTipo(x.k === "d" ? (x.c > 0 ? "elaDeve" : "euDevo") : x.c < 0 ? "elaPagou" : "euPaguei");
  };
  return (
    <div className="lfundo" onMouseDown={ev => ev.target === ev.currentTarget && onFechar()}>
      <div className="lfolha" role="dialog" aria-modal="true" aria-labelledby="ppt">
        <h2 id="ppt">{p.name}</h2>
        <div className="ppsaldo"><small>{texto(p)}</small><b className={s < 0 ? "neg" : ""}>{R(Math.abs(s))}</b></div>
        <div className="lacoes">
          {s > 0 && <a className="btn principal ppwa" target="_blank" rel="noopener noreferrer" href={"https://wa.me/?text=" + encodeURIComponent(msgWa)}>Cobrar no WhatsApp</a>}
          {s !== 0 && <button type="button" className="btn" onClick={() => onSalvar(ppQuitar(b, p.id, hoje, novoId()))}>{s > 0 ? `${p.name.split(" ")[0]} pagou tudo` : "Eu paguei tudo"}</button>}
        </div>
        <form className="lgrupo" onSubmit={salvar}>
          <div className="lseg pptipos" role="group" aria-label="Tipo">
            {TIPOS.map(t => <button key={t.k} type="button" aria-pressed={tipo === t.k} onClick={() => setTipo(t.k)}>{t.n}</button>)}
          </div>
          <div className="lduas">
            <label>Valor (R$)<input inputMode="decimal" value={val} onChange={ev => setVal(ev.target.value)} placeholder="0,00" aria-invalid={msg ? true : undefined} /></label>
            <label>Data<input type="date" value={data} onChange={ev => setData(ev.target.value)} /></label>
          </div>
          <label>Descrição<input value={desc} onChange={ev => setDesc(ev.target.value)} placeholder="Ex.: Airbnb, jantar" /></label>
          {msg && <p className="lerro" role="alert">{msg}</p>}
          <button type="submit" className="btn principal">{edit ? "Salvar alteração" : "Lançar"}</button>
          {edit && <button type="button" className="btn" onClick={() => { setEdit(null); setVal(""); setDesc(""); }}>Cancelar edição</button>}
        </form>
        <h3 className="pph">Extrato</h3>
        {sal.length ? (
          <ul className="ppext">{sal.map(x => (
            <li key={x.id}>
              <button type="button" onClick={() => editar(x.id)}><span>{x.t || (x.k === "p" ? "Pagamento" : "Cobrança")}<em>{dataBR(x.d)} · saldo {R(x.depois)}</em></span><b className={x.c < 0 ? "pos" : ""}>{x.c > 0 ? "+" : "−"}{R(Math.abs(x.c))}</b></button>
              {edit === x.id && (apagar === x.id
                ? <button type="button" className="perigo" onClick={() => { onSalvar(ppApagarEntrada(b, p.id, x.id)); setEdit(null); setApagar(null); }}>Toque de novo para excluir</button>
                : <button type="button" className="perigo" onClick={() => setApagar(x.id)}>Excluir lançamento</button>)}
            </li>))}</ul>
        ) : <p className="vazio">Sem lançamentos ainda.</p>}
        <button type="button" className="btn" aria-expanded={mais} onClick={() => setMais(!mais)}>Mais</button>
        {mais && (
          <div className="lgrupo">
            <label>Renomear<input value={nome} onChange={ev => setNome(ev.target.value)} /></label>
            <button type="button" className="btn" onClick={() => { onSalvar(ppRenomear(b, p.id, nome)); setMais(false); }}>Salvar nome</button>
            <button type="button" className="perigo" onClick={() => { if (!excl) setExcl(true); else { onSalvar(ppExcluir(b, p.id)); onFechar(); } }}>{excl ? "Toque de novo para excluir a pessoa" : "Excluir pessoa"}</button>
          </div>
        )}
        <div className="lacoes"><button type="button" className="btn" onClick={onFechar}>Fechar</button></div>
      </div>
    </div>
  );
}
