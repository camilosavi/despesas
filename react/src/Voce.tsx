import { ContaNuvem } from "./ContaNuvem";
import type { EstadoNuvem } from "./useNuvem";
import { useEffect, useRef, useState } from "react";
import { CORES, MODOS, csvLancamentos, estatisticas, fotoDe, fotoDeGuardar, fotoDeUrl, fotoGuardar, fotoLer, fotoPreparar, hexOk, nomeDe, salvarNome } from "./voce";
import type { Visual } from "./voce";
import type { Backup } from "./loja";
import { Trava } from "./Trava";
import { bioAtivar, bioDesligar, bioDisponivel, bioNome, removerSenha, temBio, temSenha } from "./senha";
import { R, dm } from "./format";
import "./voce.css";

interface Props {
  b: Backup | null; hoje: string; visual: Visual; desfazer: number;
  onVisual: (v: Visual) => void; onSalvar: (b: Backup) => void; onBaixar: () => void; onAbrir: (f?: File) => void;
  onZerar: () => void; onDesfazer: () => void; onContas: () => void; onBloquear: () => void; onExtrato: () => void; onOpenFin: () => void; onVoltar: () => void; onAviso: (m: string) => void;
  conta?: { email: string; st: EstadoNuvem; onAgora: () => void; onSair: () => Promise<string>; onSync: () => Promise<void> };
}

export function Voce({ b, hoje, visual, desfazer, onVisual, onSalvar, onBaixar, onAbrir, onZerar, onDesfazer, onContas, onExtrato, onOpenFin, onBloquear, onVoltar, onAviso, conta }: Props) {
  const [nome, setNome] = useState(b ? nomeDe(b) : "");
  const [certo, setCerto] = useState(false);
  const arq = useRef<HTMLInputElement>(null), arqFoto = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState(fotoLer), [corFoto, setCorFoto] = useState("");
  const [gFoto, setGFoto] = useState(""), [origem, setOrigem] = useState(fotoDe);
  const usarGoogle = async (u: string, quieto = false) => {
    const r = await fotoDeUrl(u);
    if (!r) { if (!quieto) onAviso("Não consegui baixar a foto do Google."); return; }
    fotoGuardar(r.url); fotoDeGuardar("google"); setFoto(r.url); setOrigem("google"); setCorFoto(r.cor); if (!quieto) onAviso("Foto do Google em uso.");
  };
  const veioPerfil = (p: { avatar: string }) => { setGFoto(p.avatar); if (p.avatar && !fotoLer() && fotoDe() !== "manual") void usarGoogle(p.avatar, true); };
  const [senha, setSenha] = useState(temSenha()), [bio, setBio] = useState(temBio()), [bioOk, setBioOk] = useState(false);
  const [trava, setTrava] = useState<null | "criar" | "trocar" | "remover" | "bio">(null);
  useEffect(() => { bioDisponivel().then(setBioOk); }, []);
  const livre = hexOk(visual.livre) ? visual.livre! : "#2f7d5e";
  const escolherFoto = async (f?: File) => {
    if (!f) return;
    try { const r = await fotoPreparar(f); fotoGuardar(r.url); fotoDeGuardar("manual"); setOrigem("manual"); setFoto(r.url); setCorFoto(r.cor); onAviso(r.cor ? "Foto salva. Quer combinar o app com a cor dela?" : "Foto salva."); } catch { onAviso("Não consegui abrir essa imagem."); }
    if (arqFoto.current) arqFoto.current.value = "";
  };
  const csv = () => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csvLancamentos(b)], { type: "text/csv;charset=utf-8" }));
    a.download = `um-tostao-lancamentos-${hoje}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const zerar = () => {
    if (!certo) { setCerto(true); window.setTimeout(() => setCerto(false), 5000); return; }
    setCerto(false); onZerar(); onAviso("Lançamentos e saldos apagados. “Desfazer” volta tudo.");
  };
  return (
    <main className="pg voce" aria-label="Você">
      <header className="vtop">
        <button type="button" className="dlink" onClick={onVoltar}>‹ Início</button>
        <h1>Você</h1>
      </header>

      <section aria-labelledby="v-ap">
        <h2 id="v-ap">Aparência</h2>
        <div className="lgrupo"><span className="lrot" id="v-modo">Modo</span>
          <div className="vseg" role="group" aria-labelledby="v-modo">
            {MODOS.map(m => <button key={m.id} type="button" aria-pressed={visual.modo === m.id} onClick={() => onVisual({ ...visual, modo: m.id })}>{m.nome}</button>)}
          </div>
        </div>
        <div className="lgrupo"><span className="lrot" id="v-cor">Cor do app</span>
          <div className="vcores" role="group" aria-labelledby="v-cor">
            {CORES.map(c => (
              <button key={c.id} type="button" className="vcor" aria-pressed={visual.cor === c.id} onClick={() => onVisual({ ...visual, cor: c.id })}>
                <i style={{ background: c.cor }} aria-hidden="true" />{c.nome}
              </button>
            ))}
          </div>
        </div>
        <div className="lgrupo"><span className="lrot" id="v-cl">Cor livre</span>
          <div className="vlivre">
            <input type="color" aria-label="Escolher uma cor" value={livre} onChange={x => onVisual({ ...visual, cor: "livre", livre: x.target.value })} />
            <button type="button" className="vcor" aria-pressed={visual.cor === "livre"} onClick={() => onVisual({ ...visual, cor: "livre", livre })}><i style={{ background: livre }} aria-hidden="true" />Usar {livre}</button>
            {corFoto && <button type="button" className="vcor" onClick={() => { onVisual({ ...visual, cor: "livre", livre: corFoto }); setCorFoto(""); }}><i style={{ background: corFoto }} aria-hidden="true" />Combinar com a foto</button>}
          </div>
        </div>
        <div className="lgrupo"><span className="lrot" id="v-ft">Foto</span>
          <div className="vfoto">
            {foto ? <img src={foto} alt="Sua foto" width={64} height={64} /> : <span className="vfv" aria-hidden="true">{(nome || "?").slice(0, 1).toUpperCase()}</span>}
            <button type="button" className="btn ghost" onClick={() => arqFoto.current?.click()}>{foto ? "Trocar foto" : "Escolher foto"}</button>
            {foto && <button type="button" className="btn ghost" onClick={() => { fotoGuardar(""); fotoDeGuardar("manual"); setOrigem("manual"); setFoto(""); setCorFoto(""); }}>Tirar foto</button>}
            {gFoto && origem !== "google" && <button type="button" className="btn ghost" onClick={() => void usarGoogle(gFoto)}>Usar a do Google</button>}
            <input ref={arqFoto} type="file" accept="image/*" hidden onChange={ev => escolherFoto(ev.target.files?.[0])} />
          </div>
        </div>
        <p className="lnota">Cor e foto ficam só neste aparelho.{origem === "google" ? " A foto veio da sua conta do Google; escolha outra quando quiser." : ""}</p>
      </section>

      {conta && <ContaNuvem conta={conta} onAviso={onAviso} onPerfil={veioPerfil} />}

      <section aria-labelledby="v-sn">
        <h2 id="v-sn">Senha{bioOk ? " e " + bioNome() : ""}</h2>
        {!senha ? (
          <div className="vacoes"><button type="button" className="btn" onClick={() => setTrava("criar")}>Criar senha de 6 dígitos</button></div>
        ) : (
          <div className="vacoes">
            <button type="button" className="btn ghost" onClick={onBloquear}>Bloquear agora</button>
            <button type="button" className="btn ghost" onClick={() => setTrava("trocar")}>Trocar senha</button>
            {bioOk && (bio
              ? <button type="button" className="btn ghost" onClick={() => { bioDesligar(); setBio(false); onAviso(bioNome() + " desligado."); }}>Desligar {bioNome()}</button>
              : <button type="button" className="btn ghost" onClick={async () => { if (await bioAtivar(nome)) { setBio(true); onAviso(bioNome() + " ligado."); } else onAviso("Não consegui ligar " + bioNome() + "."); }}>Ligar {bioNome()}</button>)}
            <button type="button" className="perigo" onClick={() => setTrava("remover")}>Tirar a senha</button>
          </div>
        )}
        <p className="lnota">A senha só trava este aparelho e fica só aqui. Não dá para recuperar: se esquecer, é preciso apagar os dados do navegador.</p>
      </section>
      {trava === "criar" && <Trava modo="criar" onOk={() => { setTrava(null); setSenha(true); onAviso("Senha criada."); }} onCancelar={() => setTrava(null)} />}
      {trava === "trocar" && <Trava modo="conferir" onOk={() => setTrava("criar")} onCancelar={() => setTrava(null)} />}
      {trava === "remover" && <Trava modo="conferir" onOk={() => { removerSenha(); setSenha(false); setBio(false); setTrava(null); onAviso("Senha removida."); }} onCancelar={() => setTrava(null)} />}

      {b ? (
        <>
          <section aria-labelledby="v-eu">
            <h2 id="v-eu">Seu nome</h2>
            <form className="vlinha" onSubmit={ev => { ev.preventDefault(); onSalvar(salvarNome(b, nome)); onAviso("Nome salvo."); }}>
              <label className="sr" htmlFor="v-nome">Seu nome</label>
              <input id="v-nome" value={nome} maxLength={40} onChange={ev => setNome(ev.target.value)} placeholder="Como o app te chama" autoComplete="given-name" />
              <button type="submit" className="btn">Salvar</button>
            </form>
          </section>

          <section aria-labelledby="v-ct">
            <h2 id="v-ct">Contas e cartões</h2>
            <div className="vacoes"><button type="button" className="btn ghost" onClick={onContas}>Editar contas, saldos e cartões</button><button type="button" className="btn ghost" onClick={onExtrato}>Importar PDF, extrato ou fatura</button><button type="button" className="btn ghost" onClick={onOpenFin}>Open Finance (banco direto)</button></div>
          </section>

          <section aria-labelledby="v-bk">
            <h2 id="v-bk">Backup e exportação</h2>
            <div className="vacoes">
              <button type="button" className="btn" onClick={onBaixar}>Baixar backup (JSON)</button>
              <button type="button" className="btn ghost" onClick={() => arq.current?.click()}>Restaurar de um backup</button>
              <button type="button" className="btn ghost" onClick={csv}>Exportar lançamentos (CSV)</button>
              <input ref={arq} type="file" accept=".json,application/json" hidden onChange={ev => { onAbrir(ev.target.files?.[0]); ev.target.value = ""; }} />
            </div>
            <p className="lnota">Restaurar troca os dados deste navegador pelos do arquivo.</p>
          </section>

          <Estat b={b} />

          <section aria-labelledby="v-zr">
            <h2 id="v-zr">Zerar</h2>
            <p className="lnota">Apaga todos os lançamentos, saldos das contas e transferências. Cartões, euro, caixinhas, dívidas, pessoas e categorias ficam.</p>
            <div className="vacoes">
              <button type="button" className="perigo" onClick={zerar} aria-live="polite">{certo ? "Toque de novo para apagar" : "Zerar lançamentos e saldo"}</button>
              {desfazer > 0 && <button type="button" className="btn ghost" onClick={onDesfazer}>Desfazer ({desfazer})</button>}
            </div>
          </section>
        </>
      ) : <p className="lnota">Escolha “Começar do zero” ou “Usar meus dados” para ver nome, backup e zerar.</p>}
    </main>
  );
}

function Estat({ b }: { b: Backup }) {
  const s = estatisticas(b), y = (d: string) => d.slice(8) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
  const L: [string, string][] = [
    ["Lançamentos", `${s.lancamentos} (${s.despesas} despesas · ${s.receitas} receitas)`],
    ["Primeiro lançamento", s.desde ? `${y(s.desde)} · ${s.meses} ${s.meses === 1 ? "mês" : "meses"} com movimento` : "ainda não há"],
    ["Maior despesa", s.maior ? `${s.maior.desc} · ${R(s.maior.cents)} (${dm(s.maior.date)})` : "—"],
    ["Contas · cartões", `${s.contas} · ${s.cartoes}`],
    ["Caixinhas · dívidas · pessoas", `${s.caixinhas} · ${s.dividas} · ${s.pessoas}`],
    ["Tamanho dos dados", `${s.kb} KB neste navegador`],
  ];
  return (
    <section aria-labelledby="v-es">
      <h2 id="v-es">Estatísticas</h2>
      <dl className="vest">{L.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </section>
  );
}
