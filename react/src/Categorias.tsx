import { useState } from "react";
import * as C from "./engine";
import type { Estado, Pers } from "./engine";
import { catApagar, catCriar, catsSuas, limiteSalvar, limites } from "./loja";
import type { Backup, TipoCat } from "./loja";
import { porCategoria } from "./relatorios";
import { centsDe } from "./Lancar";
import { R, mLab } from "./format";
import "./lancar.css";
import "./pessoas.css";
import "./metas.css";
import "./categorias.css";

const CORES = ["#E07A5F", "#3D9A6B", "#4F7CAC", "#8E6BBF", "#D6556B", "#2F8F9D", "#E0A13A", "#C26FA1", "#6C7BD9"];
interface Props { b: Backup | null; e: Estado; pers: Pers; hoje: string; onSalvar: (b: Backup) => void; onAviso: (t: string) => void; onVoltar: () => void }

export function Categorias({ b, e, pers, hoje, onSalvar, onAviso, onVoltar }: Props) {
  const [t, setT] = useState<TipoCat>("desp");
  const [nome, setNome] = useState(""), [cor, setCor] = useState(CORES[0]), [ex, setEx] = useState<string | null>(null), [ed, setEd] = useState<string | null>(null), [v, setV] = useState("");
  const ym = hoje.slice(0, 7);
  const lista = C.lista(t, pers) as { k: string; n: string; c: string; personalizada?: boolean }[];
  const gasto = Object.fromEntries(porCategoria(e, ym).map(x => [x.k, x.cents]));
  const lim = b ? limites(b) : {};
  const precisa = () => { if (!b) onAviso("Escolha “Começar do zero” ou “Usar meus dados” para mexer nas categorias."); return !!b; };
  const criar = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!precisa() || !b) return;
    const r = catCriar(b, t, nome, cor);
    if (r.erro) return onAviso(r.erro);
    onSalvar(r.backup); setNome(""); onAviso("Categoria criada.");
  };
  const total = Object.values(lim).reduce((s, x) => s + x, 0);
  return (
    <main className="pg metas cats">
      <button type="button" className="btn" onClick={onVoltar}>‹ Metas</button>
      <h1>Categorias</h1>
      <div className="lseg" role="group" aria-label="Tipo">
        {([["desp", "Despesa"], ["rec", "Receita"]] as const).map(([k, n]) => <button key={k} type="button" aria-pressed={t === k} onClick={() => { setT(k); setEd(null); setEx(null); }}>{n}</button>)}
      </div>
      <section aria-labelledby="cn">
        <h2 id="cn">Nova categoria</h2>
        <form className="ppnova" onSubmit={criar}>
          <input value={nome} onChange={x => setNome(x.target.value)} placeholder="Nome (ex.: Pets)" aria-label="Nome da categoria" maxLength={24} />
          <button type="submit" className="btn">+ Criar</button>
        </form>
        <div className="catcores" role="radiogroup" aria-label="Cor">
          {CORES.map(c => <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={"Cor " + c} style={{ background: c }} onClick={() => setCor(c)} />)}
        </div>
      </section>
      <section aria-labelledby="cl">
        <h2 id="cl">{t === "desp" ? "Despesas" : "Receitas"} {t === "desp" && <span className="dim">limite {total ? R(total) : "—"} · gasto em {mLab(ym).split(" de ")[0]}</span>}</h2>
        <ul className="pplista">{lista.map(c => {
          const g = gasto[c.k] || 0, l = lim[c.k] || 0, p = l ? Math.min(100, Math.round((g / l) * 100)) : 0;
          return (
            <li key={c.k}>
              <div className="catrow">
                <button type="button" className="pprow mrow" onClick={() => { if (t === "desp") { setEd(ed === c.k ? null : c.k); setV(l ? (l / 100).toFixed(2).replace(".", ",") : ""); setEx(null); } }} aria-expanded={t === "desp" ? ed === c.k : undefined}>
                  <span className="catdot" style={{ background: c.c }} aria-hidden="true" />
                  <span className="ppnm">{c.n}<em>{c.personalizada ? "sua" : "básica"}{t === "desp" ? (l ? ` · ${R(g)} de ${R(l)}` : g ? ` · ${R(g)} este mês` : "") : ""}</em>
                    {l ? <i className={"mbar" + (g > l ? " estourou" : "")} style={{ ["--p" as string]: p + "%" }} /> : null}</span>
                  {t === "desp" && <b className={g > l && l ? "neg" : ""}>{l ? (g > l ? "passou " + R(g - l) : "resta " + R(l - g)) : "sem limite"}</b>}
                </button>
              </div>
              {ed === c.k && b && (
                <div className="lgrupo">
                  <label>Limite por mês (R$)<input inputMode="decimal" value={v} onChange={x => setV(x.target.value)} placeholder="0,00 (sem limite)" /></label>
                  <div className="lacoes"><button type="button" className="btn principal" onClick={() => { onSalvar(limiteSalvar(b, c.k, centsDe(v))); setEd(null); }}>Salvar limite</button>
                    {l > 0 && <button type="button" className="btn" onClick={() => { onSalvar(limiteSalvar(b, c.k, 0)); setEd(null); }}>Tirar limite</button>}</div>
                </div>
              )}
              {c.personalizada && b && (
                <button type="button" className="perigo catdel" onClick={() => { if (ex !== c.k) setEx(c.k); else { onSalvar(catApagar(b, t, c.k)); setEx(null); onAviso("Categoria apagada. Os lançamentos foram para " + (t === "desp" ? "Outros" : "Outras") + "."); } }}>
                  {ex === c.k ? "Toque de novo: os lançamentos vão para " + (t === "desp" ? "Outros" : "Outras") : "Apagar " + c.n}</button>
              )}
            </li>
          );
        })}</ul>
        {b && catsSuas(b, t).length === 0 && <p className="vazio">Você ainda não criou nenhuma.</p>}
      </section>
    </main>
  );
}
