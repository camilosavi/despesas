import { useCallback, useEffect, useState } from "react";
import { fxApagar, fxCompras, fxCotacao, fxAviso, fxCriar, fxTotais, fxValor } from "./loja";
import type { Backup, FxCompra, Moeda } from "./loja";
import { centsDe } from "./Lancar";
import { R, dm } from "./format";
import "./lancar.css";
import "./pessoas.css";
import "./metas.css";
import "./moedas.css";

const SIM = { EUR: "€", USD: "US$" } as const;
const NOME = { EUR: "Euro", USD: "Dólar" } as const;
const id = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (s: string) => { const n = parseFloat(s.trim().replace(/\./g, "").replace(",", ".")); return isFinite(n) && n > 0 ? n : 0; };
const M = (c: number, m: Moeda) => SIM[m] + " " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cot4 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const CH = "despesas.rates2";
export type Taxas = { EUR: number; USD: number; at: number };

// cotação do dia: AwesomeAPI, com frankfurter.dev de reserva; guarda a última no aparelho
export async function buscarTaxas(): Promise<Taxas> {
  const t = (u: string) => fetch(u, { signal: AbortSignal.timeout(6000) }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  try {
    const j = await t("https://economia.awesomeapi.com.br/json/last/EUR-BRL,USD-BRL");
    const e = +j.EURBRL.bid, u = +j.USDBRL.bid;
    if (e > 0 && u > 0) return { EUR: e, USD: u, at: Date.now() };
  } catch { /* tenta a reserva */ }
  const [e, u] = await Promise.all([t("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=BRL"), t("https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL")]);
  return { EUR: +e.rates.BRL, USD: +u.rates.BRL, at: Date.now() };
}
export const lerCache = (): Taxas | null => { try { const j = JSON.parse(localStorage.getItem(CH) || "null"); return j && j.EUR > 0 ? j : null; } catch { return null; } };

interface Props { b: Backup | null; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void; onVoltar: () => void }
export function Moedas({ b, hoje, onSalvar, onAviso, onVoltar }: Props) {
  const [m, setM] = useState<Moeda>("EUR");
  const [tx, setTx] = useState<Taxas | null>(lerCache), [erro, setErro] = useState(""), [carr, setCarr] = useState(false);
  const [nova, setNova] = useState(false);
  const atualizar = useCallback(async () => {
    setCarr(true); setErro("");
    try { const r = await buscarTaxas(); setTx(r); try { localStorage.setItem(CH, JSON.stringify(r)); } catch { /* sem armazenamento */ } }
    catch { setErro("Não consegui buscar a cotação agora."); }
    setCarr(false);
  }, []);
  useEffect(() => { if (!tx || Date.now() - tx.at > 5 * 60_000) void atualizar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hojeCot = tx ? tx[m] : 0;
  const ls = b ? fxCompras(b, m) : [], t = b ? fxTotais(b, m) : { valor: 0, brl: 0, medio: 0, n: 0 };
  const vale = hojeCot ? Math.round((t.valor / 100) * hojeCot * 100) : 0;
  return (
    <main className="pg metas moedas">
      <button type="button" className="btn" onClick={onVoltar}>‹ Metas</button>
      <h1>Moedas</h1>
      <div className="lseg" role="group" aria-label="Moeda">
        {(["EUR", "USD"] as Moeda[]).map(x => <button key={x} type="button" aria-pressed={m === x} onClick={() => { setM(x); setNova(false); }}>{SIM[x]} {NOME[x]}</button>)}
      </div>
      <div className="mcot">
        <span>{SIM[m]} 1 = <b>{hojeCot ? "R$ " + cot4(hojeCot) : "—"}</b>
          {hojeCot && t.medio ? <em className={hojeCot > t.medio ? "pos" : "neg"}>{hojeCot > t.medio ? "acima" : "abaixo"} do seu médio</em> : null}</span>
        <button type="button" className="btn" onClick={atualizar} disabled={carr}>{carr ? "Buscando…" : "Atualizar"}</button>
      </div>
      {erro && <p className="lerro" role="alert">{erro}</p>}
      <div className="ppsaldo"><small>{NOME[m]} que você tem</small><b>{M(t.valor, m)}</b></div>
      <dl className="mtot">
        <div><dt>Você pagou</dt><dd>{R(t.brl)}</dd></div>
        <div><dt>Preço médio</dt><dd>{t.medio ? "R$ " + cot4(t.medio) : "—"}</dd></div>
        <div><dt>Vale hoje</dt><dd>{vale ? R(vale) : "—"}</dd></div>
      </dl>
      <section aria-labelledby="mcomp">
        <h2 id="mcomp">Compras <span className="dim">{t.n ? t.n : ""}</span></h2>
        {nova && b ? <FormCompra b={b} m={m} hoje={hoje} hojeCot={hojeCot} onSalvar={nb => { onSalvar(nb); setNova(false); }} onFechar={() => setNova(false)} />
          : <button type="button" className="btn principal" onClick={() => (b ? setNova(true) : onAviso("Escolha “Começar do zero” ou “Usar meus dados” para lançar compras."))}>+ Compra de {SIM[m]}</button>}
        {ls.length ? <ul className="ppext mfx">{ls.map(x => <Linha key={x.id ?? x.date + x.brl} x={x} m={m} onDel={() => b && x.id && onSalvar(fxApagar(b, x.id))} />)}</ul> : <p className="vazio">Nenhuma compra de {NOME[m].toLowerCase()} ainda.</p>}
      </section>
    </main>
  );
}

function Linha({ x, m, onDel }: { x: FxCompra; m: Moeda; onDel: () => void }) {
  const [arm, setArm] = useState(false);
  const v = fxValor(x);
  return (
    <li><button type="button" onClick={() => setArm(!arm)} aria-expanded={arm}>
      <span>{x.where || "Compra"}<em>{dm(x.date)} · {R(x.brl)} a R$ {cot4(fxCotacao(x.brl, v))}</em></span><b>{M(v, m)}</b></button>
      {arm && x.id && <button type="button" className="perigo" onClick={onDel}>Excluir compra</button>}</li>
  );
}

const LOCAIS = ["Wise", "Nomad", "ARQ", "Revolut"];
function FormCompra({ b, m, hoje, hojeCot, onSalvar, onFechar }: { b: Backup; m: Moeda; hoje: string; hojeCot: number; onSalvar: (b: Backup) => void; onFechar: () => void }) {
  const [v, setV] = useState(""), [p, setP] = useState(""), [c, setC] = useState(""), [d, setD] = useState(hoje), [onde, setOnde] = useState(""), [msg, setMsg] = useState("");
  const [ult, setUlt] = useState<("v" | "p" | "c")[]>([]);
  // os dois últimos campos mexidos mandam; o terceiro sai sozinho
  const toca = (k: "v" | "p" | "c") => setUlt(u => [...u.filter(x => x !== k), k].slice(-2));
  const vc = centsDe(v), pc = centsDe(p), cn = num(c);
  const calc = ult.length === 2 ? ult : [];
  const auto = (["v", "p", "c"] as const).find(k => !calc.includes(k));
  let V = vc, P = pc, C = cn;
  if (calc.length === 2 && auto === "c") C = vc > 0 ? pc / vc : 0;
  if (calc.length === 2 && auto === "p") P = Math.round(vc * cn);
  if (calc.length === 2 && auto === "v") V = cn > 0 ? Math.round(pc / cn) : 0;
  if (calc.length < 2) { C = vc > 0 && pc > 0 ? pc / vc : cn; }
  const mostra = (k: "v" | "p" | "c", real: string) => (calc.length === 2 && auto === k ? (k === "c" ? (C ? cot4(C).replace(/\./g, "") : "") : k === "p" ? (P / 100).toFixed(2).replace(".", ",") : (V / 100).toFixed(2).replace(".", ",")) : real);
  const aviso = fxAviso(C, hojeCot);
  const salvar = () => {
    if (!(V > 0) || !(P > 0)) return setMsg("Informe quanto recebeu e quanto pagou em reais.");
    onSalvar(fxCriar(b, id(), m, V, P, d || hoje, onde));
  };
  return (
    <div className="lgrupo mform">
      <div className="lduas">
        <label>Recebido ({SIM[m]})<input inputMode="decimal" value={mostra("v", v)} onChange={e => { setV(e.target.value); toca("v"); setMsg(""); }} placeholder="0,00" /></label>
        <label>R$ pago<input inputMode="decimal" value={mostra("p", p)} onChange={e => { setP(e.target.value); toca("p"); setMsg(""); }} placeholder="0,00" /></label>
      </div>
      <label>Cotação usada (R$ por {SIM[m]})<input inputMode="decimal" value={mostra("c", c)} onChange={e => { setC(e.target.value); toca("c"); setMsg(""); }} placeholder={hojeCot ? cot4(hojeCot) : "0,00"} /></label>
      {hojeCot > 0 && <p className="mdica">hoje R$ {cot4(hojeCot)}{C > 0 ? ` (${C >= hojeCot ? "+" : ""}${(((C / hojeCot) - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)` : ""} · <button type="button" className="mlink" onClick={() => { setC(cot4(hojeCot).replace(/\./g, "")); toca("c"); }}>Usar a cotação de hoje</button></p>}
      {aviso !== "ok" && <p className="lerro" role="alert">{aviso === "inversa" ? "A cotação ficou invertida: parece que € e R$ foram trocados. " : "Cotação muito diferente da de hoje. Confira os valores. "}
        {aviso === "inversa" && <button type="button" className="mlink" onClick={() => { const a = v, bb = p; setV(bb); setP(a); setUlt(["v", "p"]); setC(""); }}>Trocar de lugar</button>}</p>}
      <div className="lduas">
        <label>Data<input type="date" value={d} onChange={e => setD(e.target.value)} /></label>
        <label>Onde<input value={onde} onChange={e => setOnde(e.target.value)} placeholder="Wise, Nomad…" list="mlocais" /></label>
      </div>
      <datalist id="mlocais">{LOCAIS.map(l => <option key={l} value={l} />)}</datalist>
      {msg && <p className="lerro" role="alert">{msg}</p>}
      <div className="lacoes"><button type="button" className="btn principal" onClick={salvar}>Salvar compra</button><button type="button" className="btn" onClick={onFechar}>Cancelar</button></div>
    </div>
  );
}
