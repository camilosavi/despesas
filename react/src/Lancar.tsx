import { useEffect, useRef, useState } from "react";
import { regraDe } from "./orcamento";
import * as C from "./engine";
import type { Pers } from "./engine";
import { PAGAMENTOS, apagar, criar, criarEmPartes, dataNaFatura, editar, recentes, tagsParse } from "./loja";
import type { Backup, Form, ItemBackup, Repete } from "./loja";
import { R, dm } from "./format";
import "./lancar.css";

export const centsDe = (s: string): number => {
  const t = s.replace(/[^\d,.-]/g, "");
  const n = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const paraTexto = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

export interface Pedido { tipo?: "desp" | "rec"; id?: string; pre?: { desc: string; cents: number; cat: string; date: string; pay: string; paid: boolean; nota?: string } }
interface Props { b: Backup; pers: Pers; hoje: string; pedido: Pedido; onSalvar: (b: Backup) => void; onFechar: () => void }

export function Lancar({ b, pers, hoje, pedido, onSalvar, onFechar }: Props) {
  const item: ItemBackup | undefined = pedido.id ? b.items.find(x => x.id === pedido.id) : undefined;
  const [tipo, setTipo] = useState<"desp" | "rec">(item?.type ?? pedido.tipo ?? "desp");
  const pre = pedido.pre;
  const [valor, setValor] = useState(item ? paraTexto(item.cents) : pre ? paraTexto(pre.cents) : "");
  const [desc, setDesc] = useState(item?.desc ?? pre?.desc ?? "");
  const [cat, setCat] = useState(item?.cat ?? pre?.cat ?? ""), [tocou, setTocou] = useState(!!item || !!pre);
  const [data, setData] = useState(item ? item.buy || item.date : pre?.date ?? hoje);
  const [pay, setPay] = useState(item?.pay ?? pre?.pay ?? "Pix");
  const [cartao, setCartao] = useState(item?.card ?? "");
  const [conta, setConta] = useState(item?.acct ?? "");
  const [pago, setPago] = useState(item ? item.paid : pre ? pre.paid : true);
  const [modo, setModo] = useState<Repete["modo"]>("uma");
  const [n, setN] = useState("3");
  const [erro, setErro] = useState("");
  const [apagarArmado, setApagarArmado] = useState(false);
  const [tags, setTags] = useState(Array.isArray(item?.tags) ? (item!.tags as string[]).join(", ") : "");
  const [partes, setPartes] = useState<{ c: string; d: string }[] | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onFechar(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onFechar]);

  const cartoes = Object.entries((b.cfg.cards || {}) as Record<string, { kind?: string }>).filter(([, k]) => k.kind !== "ben").map(([nome]) => nome);
  const contas = ((b.cfg.accts || []) as { name: string }[]).map(a => a.name);
  const cats = C.lista(tipo, pers) as { k: string; n: string; c: string }[];
  const catAtual = cats.some(c => c.k === cat) ? cat : "";
  const credito = tipo === "desp" && pay === "Crédito";
  const cartaoEf = credito ? cartao || cartoes[0] || "" : "";
  const dica = cartaoEf && data ? `Entra na fatura do ${cartaoEf} que vence ${dm(dataNaFatura(b, cartaoEf, data))}.` : "";
  const mudaTipo = (t: "desp" | "rec") => { setTipo(t); setCat(""); setTocou(false); setPay("Pix"); setPago(true); };

  const rec = item ? [] : recentes(b, tipo, desc, centsDe(valor));
  const usar = (x: ItemBackup) => {
    setTocou(true); setDesc(x.desc); setCat(cats.some(c => c.k === x.cat) ? x.cat : ""); setPay(x.pay || "Pix"); setCartao(x.card || ""); setConta(x.acct || "");
    if (centsDe(valor) <= 0) setValor(paraTexto(x.cents));
  };
  const somaPartes = (partes || []).reduce((t, x) => t + centsDe(x.c), 0), primeira = centsDe(valor) - somaPartes;
  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const cents = centsDe(valor);
    if (cents <= 0) return setErro("Digite o valor.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Escolha a data.");
    if (credito && !cartaoEf) return setErro("Cadastre um cartão antes de lançar no crédito.");
    const nome = desc.trim() || cats.find(c => c.k === (catAtual || C.SEM_CATEGORIA[tipo]))?.n || "Lançamento";
    const k = catAtual || C.SEM_CATEGORIA[tipo], agora = Date.now();
    if (item) onSalvar(editar(b, item.id, { desc: nome, cents, cat: k, date: data, pay, paid: pago, card: cartaoEf, acct: conta, tags: tagsParse(tags) }, agora));
    else {
      const f: Form = { tipo, desc: nome, cents, cat: k, date: data, pay, paid: pago, card: cartaoEf, acct: conta || undefined,
        repete: modo === "uma" ? { modo } : { modo, n: Math.max(2, parseInt(n, 10) || 2) } };
      let i = 0;
      const nid = () => `${agora.toString(36)}${(i++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      f.tags = tagsParse(tags);
      if (partes) {
        const r = criarEmPartes(b, { ...f, repete: { modo: "uma" } }, partes.map(x => ({ c: centsDe(x.c), d: x.d })), hoje, agora, nid);
        if (r.erro) return setErro(r.erro);
        onSalvar(r.backup);
      } else onSalvar(criar(b, f, hoje, agora, nid));
    }
    onFechar();
  };
  const excluir = (seguintes: boolean) => {
    if (!item) return;
    if (!apagarArmado) { setApagarArmado(true); setTimeout(() => setApagarArmado(false), 4000); return; }
    onSalvar(apagar(b, item.id, seguintes)); onFechar();
  };

  return (
    <div className="lfundo" onMouseDown={ev => ev.target === ev.currentTarget && onFechar()}>
      <form className="lfolha" role="dialog" aria-modal="true" aria-labelledby="lt" onSubmit={salvar} noValidate>
        <h2 id="lt">{item ? "Editar lançamento" : tipo === "rec" ? "Nova receita" : "Nova despesa"}</h2>
        {pre?.nota && <p className="lnota" role="status">{pre.nota}</p>}
        {!item && (
          <div className="lseg" role="group" aria-label="Tipo">
            <button type="button" aria-pressed={tipo === "desp"} onClick={() => mudaTipo("desp")}>Despesa</button>
            <button type="button" aria-pressed={tipo === "rec"} onClick={() => mudaTipo("rec")}>Receita</button>
          </div>
        )}
        <label className="lvalor">Valor (R$)
          <input ref={campo} inputMode="decimal" autoComplete="off" placeholder="0,00" value={valor} aria-invalid={!!erro && centsDe(valor) <= 0} onChange={ev => { setValor(ev.target.value); setErro(""); }} />
        </label>
        <label>Descrição
          <input value={desc} autoComplete="off" placeholder={tipo === "rec" ? "Ex.: Salário" : "Ex.: Mercado"} onChange={ev => { setDesc(ev.target.value); if (!tocou) { const k = regraDe(b, ev.target.value, cats.map(c => c.k)); if (k) setCat(k); } }} />
        </label>
        {rec.length > 0 && (
          <div className="lgrupo" role="group" aria-label="Recentes">
            <span className="lrot">Recentes</span>
            <div className="chips">{rec.map(x => <button key={x.id} type="button" className="chip" onClick={() => usar(x)}>{x.desc} · {R(x.cents)}</button>)}</div>
          </div>
        )}
        <div className="lgrupo" role="group" aria-label="Categoria">
          <span className="lrot">Categoria</span>
          <div className="chips">{cats.map(c => <button key={c.k} type="button" className="chip" aria-pressed={catAtual === c.k} onClick={() => { setTocou(true); setCat(catAtual === c.k ? "" : c.k); }}><i style={{ background: c.c }} aria-hidden="true" />{c.n}</button>)}</div>
        </div>
        <label>Tags (opcional)
          <input value={tags} autoComplete="off" placeholder="ex.: viagem, trabalho" onChange={ev => setTags(ev.target.value)} />
        </label>
        <div className="lduas">
          <label>{credito ? "Data da compra" : "Data"}<input type="date" value={data} onChange={ev => setData(ev.target.value)} /></label>
          <label>Pagamento
            <select value={pay} onChange={ev => { setPay(ev.target.value); if (ev.target.value === "Crédito") setPago(false); }}>
              {PAGAMENTOS[tipo].map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
        </div>
        {credito && (
          <label>Cartão
            {cartoes.length ? <select value={cartaoEf} onChange={ev => setCartao(ev.target.value)}>{cartoes.map(c => <option key={c}>{c}</option>)}</select>
              : <span className="lnota neg">Nenhum cartão cadastrado ainda.</span>}
            {dica && <small className="lnota" role="status">{dica}</small>}
          </label>
        )}
        {contas.length > 1 && (
          <label>{tipo === "rec" ? "Entra na conta" : "Sai da conta"}
            <select value={conta || contas[0]} onChange={ev => setConta(ev.target.value)}>{contas.map(c => <option key={c}>{c}</option>)}</select>
          </label>
        )}
        {tipo === "desp" && !credito && (
          <label className="lcheck"><input type="checkbox" checked={pago} onChange={ev => setPago(ev.target.checked)} />Já paguei</label>
        )}
        {!item && modo === "uma" && (
          <div className="lgrupo" role="group" aria-label="Em partes">
            {!partes ? <button type="button" className="chip" onClick={() => setPartes([{ c: "", d: C.somaDias(data || hoje, 30) }])}>{tipo === "rec" ? "+ Receber em partes" : "+ Pagar em partes"}</button> : (
              <>
                <span className="lrot">{tipo === "rec" ? "Receber em partes" : "Pagar em partes"}: o valor de cima é o total</span>
                <p className="lnota" role="status">Parte 1 · {data ? dm(data) : "—"} · <b>{centsDe(valor) > 0 ? R(Math.max(0, primeira)) : "—"}</b> (o que sobra)</p>
                {partes.map((p, i) => (
                  <div className="lduas lparte" key={i}>
                    <label>Parte {i + 2} (R$)<input inputMode="decimal" value={p.c} placeholder="0,00" onChange={ev => setPartes(partes.map((x, k) => (k === i ? { ...x, c: ev.target.value } : x)))} /></label>
                    <label>Data<input type="date" value={p.d} onChange={ev => setPartes(partes.map((x, k) => (k === i ? { ...x, d: ev.target.value } : x)))} /></label>
                    <button type="button" className="perigo lrm" aria-label={`Tirar a parte ${i + 2}`} onClick={() => setPartes(partes.length > 1 ? partes.filter((_, k) => k !== i) : null)}>Tirar</button>
                  </div>
                ))}
                <div className="lacoes lpacoes">
                  {partes.length < 11 && <button type="button" className="btn" onClick={() => setPartes([...partes, { c: "", d: C.somaDias(partes[partes.length - 1].d, 30) }])}>+ Mais uma parte</button>}
                  <button type="button" className="btn" onClick={() => setPartes(null)}>Sem partes</button>
                </div>
              </>
            )}
          </div>
        )}
        {!item && !partes && (
          <div className="lgrupo" role="group" aria-label="Repetição">
            <span className="lrot">Quantas vezes</span>
            <div className="chips">
              {([["uma", "Só uma vez"], ["parcelas", "Parcelar"], ["mensal", "Repetir todo mês"]] as [Repete["modo"], string][]).map(([k, t]) =>
                <button key={k} type="button" className="chip" aria-pressed={modo === k} onClick={() => setModo(k)}>{t}</button>)}
            </div>
            {modo !== "uma" && (
              <label className="lnum">{modo === "parcelas" ? "Em quantas parcelas" : "Por quantos meses"}
                <input inputMode="numeric" value={n} onChange={ev => setN(ev.target.value.replace(/\D/g, "").slice(0, 3))} />
                {modo === "parcelas" && centsDe(valor) > 0 && <small className="lnota">{n || 0}x de {R(Math.floor(centsDe(valor) / Math.max(1, parseInt(n, 10) || 1)))}</small>}
              </label>
            )}
          </div>
        )}
        {item?.parc && <p className="lnota">Parcela {item.parc.replace("/", " de ")}: alterar aqui muda só esta parcela.</p>}
        {erro && <p className="lerro" role="alert">{erro}</p>}
        <div className="lacoes">
          <button type="submit" className="btn principal">Salvar</button>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
        </div>
        {item && (
          <div className="lexcluir">
            <button type="button" className="perigo" onClick={() => excluir(false)}>{apagarArmado ? "Toque de novo para excluir" : "Excluir"}</button>
            {item.group && item.parc && <button type="button" className="perigo" onClick={() => excluir(true)}>{apagarArmado ? "Toque de novo" : "Excluir esta e as seguintes"}</button>}
          </div>
        )}
      </form>
    </div>
  );
}
