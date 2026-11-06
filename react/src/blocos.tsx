import * as C from "./engine";
import type { Estado, Pers } from "./engine";
import { MES, R, dm, mLab, pct1 } from "./format";
import { notaDeSaude } from "./saude";

export type Destino = "contas" | "cartoes" | "transacoes" | "lancar-rec" | "lancar-desp" | "menu" | "busca" | "avisos";
export interface BlocoProps { e: Estado; pers: Pers; onIr: (d: Destino) => void }
type Lim = { livre: number; passou?: number; pct: number } | null | undefined;
const cinza = "#8A8F98";          // "Outras categorias"
const semItens = "#A08F7A";       // "Faturas sem itens lançados": cor própria, não repete a de nenhuma outra fatia

function Ver({ para, onIr, children }: { para: Destino; onIr: (d: Destino) => void; children: string }) {
  return <button type="button" className="dlink" onClick={() => onIr(para)}>{children}</button>;
}
export const catDe = (k: string, t: "desp" | "rec", pers: Pers): { n: string; c: string } =>
  k === "_falta" ? { n: "Faturas sem itens lançados", c: semItens } : C.categoria(t, k, pers);

export function Saldo({ e, onIr }: BlocoProps) {
  const r = C.resumoMes(e, C.mesDe(e.hoje)), n = e.contas.length, recebe = C.aReceber(e);
  return (
    <>
      <h3>Na conta hoje <Ver para="contas" onIr={onIr}>Ver contas</Ver></h3>
      <b className="dbig">{R(C.naConta(e))}</b>
      <small className="dsub">
        {n} {n === 1 ? "conta ativa" : "contas ativas"} · fim do mês {R(r.fimDoMes)}{recebe ? " · a receber " + R(recebe) : ""}
      </small>
      <div className="dqa">
        <button type="button" className="sec" onClick={() => onIr("lancar-rec")}>+ Receita</button>
        <button type="button" className="prim" onClick={() => onIr("lancar-desp")}>− Despesa</button>
      </div>
    </>
  );
}

export function Resumo({ e }: BlocoProps) {
  const ym = C.mesDe(e.hoje), r = C.resumoMes(e, ym);
  return (
    <>
      <h3>Resumo do mês <small>{mLab(ym)}</small></h3>
      <div className="drs">
        <div className="drc"><span>Entrou</span><b>{R(r.entrou)}</b><small>{r.entraAinda ? "falta receber " + R(r.entraAinda) : "tudo recebido"}</small></div>
        <div className="drc out"><span>Gastou</span><b>{R(r.gastou)}</b><small>A pagar {R(r.aPagar)}</small></div>
        <div className="drc sob"><span>Sobra</span><b className={r.sobra < 0 ? "neg" : ""}>{R(r.sobra)}</b><small>{r.entrou ? Math.round((r.sobra / r.entrou) * 100) + "% do que entrou" : ""}</small></div>
      </div>
    </>
  );
}

export function Saude({ e }: BlocoProps) {
  const s = notaDeSaude(e);
  return (
    <>
      <h3>Nota de saúde</h3>
      <div className="dsc2"><b>{s.score}</b><span>/100</span><em className={"dbadge t-" + s.tom}>{s.rotulo}</em></div>
      <span className="dbar" role="presentation"><i className={"t-" + s.tom} style={{ width: s.score + "%" }} /></span>
      {s.motivos.length > 0 && <ul className="dwhy">{s.motivos.map(m => <li key={m}>{m}</li>)}</ul>}
    </>
  );
}

export function Fluxo({ e }: BlocoProps) {
  const ym = C.mesDe(e.hoje);
  const ms = [-4, -3, -2, -1, 0, 1].map(d => C.somaMeses(ym, d)).map((m: string) => ({ m, r: C.entrou(e, m) as number, d: C.gastou(e, m) as number }));
  const mx = Math.max(1, ...ms.flatMap(x => [x.r, x.d]));
  return (
    <>
      <h3>Fluxo de caixa <span className="leg"><span><i className="rcol" />Entrou</span><span><i className="dcol" />Gastou</span></span></h3>
      <div className="fl" aria-hidden="true">
        {ms.map(x => (
          <div key={x.m} className={"flc" + (x.m === ym ? " now" : "")}>
            <div className="flb"><i className="r" style={{ height: (x.r / mx) * 100 + "%" }} /><i className="d" style={{ height: (x.d / mx) * 100 + "%" }} /></div>
            <small>{MES[+x.m.slice(5) - 1]}</small>
          </div>
        ))}
      </div>
      <div className="sr">
        <table>
          <caption>Entrou e gastou por mês</caption>
          <thead><tr><th>Mês</th><th>Entrou</th><th>Gastou</th></tr></thead>
          <tbody>{ms.map(x => <tr key={x.m}><td>{mLab(x.m)}</td><td>{R(x.r)}</td><td>{R(x.d)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

export function Gastos({ e, pers }: BlocoProps) {
  const ym = C.mesDe(e.hoje);
  const gc = C.gastosPorCategoria(e, ym) as { k: string; cents: number }[];
  const tot = gc.reduce((s, x) => s + x.cents, 0);
  if (!tot) return <><h3>Gastos</h3><small className="vazio">Nada gasto ainda neste mês.</small></>;
  // cor segue a categoria (fixa), nunca a posição; o resto vai para "Outras categorias"
  const top = gc.slice(0, 5).map(x => ({ ...x, ...catDe(x.k, "desp", pers) }));
  const resto = tot - top.reduce((s, x) => s + x.cents, 0);
  if (resto > 0) top.push({ k: "_", cents: resto, n: "Outras categorias", c: cinza });
  const raio = 40, perim = 2 * Math.PI * raio;
  let acc = 0;
  const resumo = top.map(x => `${x.n} ${R(x.cents)}`).join("; ");
  return (
    <>
      <h3>Gastos</h3>
      <div className="dnw">
        <div className="dnb">
          <svg viewBox="0 0 100 100" role="img" aria-label={"Gastos por categoria: " + resumo}>
            <g transform="rotate(-90 50 50)">
              {top.map(x => {
                const len = (x.cents / tot) * perim, off = -acc;
                acc += len;
                return <circle key={x.k} cx="50" cy="50" r={raio} fill="none" stroke={x.c} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 1)} ${perim}`} strokeDashoffset={off} />;
              })}
            </g>
          </svg>
          <div className="dnc" aria-hidden="true"><small>Maior gasto</small><b>{pct1((top[0].cents / tot) * 100)}%</b><small>{top[0].n}</small></div>
        </div>
        <ul className="dleg">{top.map(x => <li key={x.k}><i style={{ background: x.c }} /><span>{x.n}</span><em>{R(x.cents)}</em></li>)}</ul>
      </div>
    </>
  );
}

export function Cartoes({ e, onIr }: BlocoProps) {
  const cartoes = C.cartoesDeCredito(e) as string[], c0 = cartoes[0];
  if (!c0) return <><h3>Cartões</h3><small className="vazio">Nenhum cartão ainda.</small></>;
  const aberta = C.mesFaturaAberta(e, c0) as string, lm = C.limite(e, c0) as Lim;
  const atual = C.fatura(e, c0, aberta);
  const sit = (f: { ym: string; aberto: number; total: number; vencida: boolean; cartao: string }): [string, string] => {
    const paga = (e.faturas || []).some(r => r.cartao === f.cartao && r.ym === f.ym && r.paga);
    return f.aberto === 0 && f.total >= 0 && paga ? ["paga", "Paga"] : f.vencida ? ["venc", "Vencida"] : f.ym === aberta ? ["abre", "Aberta"] : ["", "Próxima"];
  };
  const fats = [-1, 0, 1].map(d => C.fatura(e, c0, C.somaMeses(aberta, d)));
  const compras = e.lancamentos.filter(l => l.cartao === c0 && l.tipo === "desp")
    .sort((a, b) => (b.compra || b.data).localeCompare(a.compra || a.data)).slice(0, 4);
  return (
    <>
      <h3>Cartões <Ver para="cartoes" onIr={onIr}>Ver cartões</Ver></h3>
      <div className="dcard" style={{ "--cc": e.cartoes[c0]?.cor || "#3a4a7a" } as React.CSSProperties}>
        <span className="nm">{c0}</span>
        <span className="vl">{R(atual.total)}</span>
        <small>vence {dm(atual.vence)}{lm ? " · " + (lm.passou ? "passou " + R(lm.passou) : "livre " + R(lm.livre)) : ""}</small>
      </div>
      {lm && <span className="mini" role="presentation"><i style={{ width: Math.min(100, lm.pct) + "%" }} /></span>}
      <h4 className="dsub2">Faturas</h4>
      {fats.map(f => { const [k, t] = sit(f); return (
        <div key={f.ym} className="dfr"><span>{MES[+f.ym.slice(5) - 1]} <em>vence {dm(f.vence)}</em></span><b>{R(f.total)}</b><i className={"st " + k}>{t}</i></div>
      ); })}
      <h4 className="dsub2">Últimas compras</h4>
      {compras.length ? compras.map(l => <div key={l.id} className="dcr"><span>{l.nome}<br /><em>{dm(l.compra || l.data)}</em></span><b>{R(l.cents)}</b></div>)
        : <small className="vazio">Nenhuma compra lançada neste cartão.</small>}
    </>
  );
}

export function Pagar({ e }: BlocoProps) {
  const pg = C.proximosPagamentos(e, 10) as { nome: string; data: string; cents: number }[];
  return (
    <>
      <h3>Vence em 10 dias <span className="dim">{R(pg.reduce((s, d) => s + d.cents, 0))}</span></h3>
      <div className="lista1">
        {pg.length ? pg.map((d, i) => (
          <div key={i} className="dfr"><span>{d.nome}<br /><em className={d.data < e.hoje ? "neg" : ""}>{d.data < e.hoje ? "atrasado · " : ""}{dm(d.data)}</em></span><b>{R(d.cents)}</b></div>
        )) : <small className="vazio">Nada vence nos próximos 10 dias.</small>}
      </div>
    </>
  );
}

export function Trans({ e, pers, onIr }: BlocoProps) {
  const ult = e.lancamentos.slice()
    .sort((a, b) => (b.compra || b.caiu || b.data).localeCompare(a.compra || a.caiu || a.data) || b.id.localeCompare(a.id)).slice(0, 9);
  return (
    <>
      <h3>Últimas transações <Ver para="transacoes" onIr={onIr}>Ver todas</Ver></h3>
      <ul className="lista">
        {ult.map(l => {
          const c = catDe(l.cat || (C.SEM_CATEGORIA as Record<string, string>)[l.tipo], l.tipo, pers), np = (C.partes(l) as unknown[]).length;
          return (
            <li key={l.id} className="dtr">
              <span className="ic" style={{ background: c.c }} aria-hidden="true">{c.n[0]}</span>
              <span className="dtn"><b>{l.nome}</b><small>{c.n}{np ? ` · ÷${np + 1} sua parte ${R(C.suaParte(l))}` : ""}{l.cartao ? " · " + l.cartao : ""}</small></span>
              <div><span className={"v " + (l.tipo === "rec" ? "rec" : "")}>{l.tipo === "rec" ? "+" : "−"}{R(l.cents)}</span><small>{dm(l.compra || l.caiu || l.data)}</small></div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Pessoas({ e }: BlocoProps) {
  const ps = C.saldosPorPessoa(e) as { pessoa: string; cents: number }[], recebe = C.aReceber(e);
  return (
    <>
      <h3>Pessoas <span className="dim">{recebe ? "a receber " + R(recebe) : ""}</span></h3>
      <div className="lista1">
        {ps.length ? ps.map(x => (
          <div key={x.pessoa} className="dfr"><span>{x.pessoa}<br /><em>{x.cents > 0 ? "te deve" : x.cents < 0 ? "você deve" : "quitado"}</em></span><b className={x.cents < 0 ? "neg" : ""}>{R(Math.abs(x.cents))}</b></div>
        )) : <small className="vazio">Ninguém te deve nada. A divisão entra nas despesas e assinaturas.</small>}
      </div>
    </>
  );
}
