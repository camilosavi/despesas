import { useState } from "react";
import { useStore } from "../lib/createStore";
import { ofCfg, ofConnect, ofRun, ofSetCfg, ofState, ofWhenText } from "../lib/openfinance";
import { toast } from "./uiStore";

/** Open Finance (Meu Pluggy): servidor, conexão com o banco e atualização na hora */
export function OfSection() {
  useStore(ofState, s => s);
  const busy = useStore(ofState, s => s.busy), err = useStore(ofState, s => s.err);
  const c = ofCfg(), [edit, setEdit] = useState(false), [url, setUrl] = useState(c.url || ""), [key, setKey] = useState(c.key || "");
  const ready = !!(c.url && c.key) && !edit;
  function save() {
    let u = url.trim(); if (u && !/^https?:\/\//.test(u)) u = "https://" + u;
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(u)) { toast("Endereço do servidor inválido."); return; }
    if (key.trim().length < 8) { toast("Chave muito curta."); return; }
    ofSetCfg({ url: u.replace(/\/+$/, ""), key: key.trim() }); setEdit(false); toast("Servidor salvo");
  }
  async function connect() { try { toast(await ofConnect(matchMedia("(prefers-color-scheme: dark)").matches)); } catch (e) { toast("Não deu: " + (e instanceof Error ? e.message : e)); } }
  async function now() { const m = await ofRun(true); if (m) toast(m); }
  return (<>
    <h4 className="ofh">Open Finance</h4>
    {!ready ? (<>
      <div className="field"><label htmlFor="ofUrl">Endereço do servidor</label><input type="url" id="ofUrl" placeholder="…workers.dev" autoComplete="off" autoCapitalize="off" spellCheck={false} value={url} onChange={e => setUrl(e.target.value)} /></div>
      <div className="field"><label htmlFor="ofKey">Chave do servidor</label><input type="password" id="ofKey" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></div>
      <button type="button" className="btn primary wide" id="ofSave" onClick={save}>Salvar servidor</button>
    </>) : (<>
      <p className="mekv" id="ofInfo">{c.items?.length ? c.items.map(i => i.name).join(", ") + " conectado" : "Servidor salvo. Conecte o banco."}{ofWhenText() ? <><br />{ofWhenText()}</> : null}{err ? <><br /><span className="bad">{err}</span></> : null}</p>
      {!!c.items?.length && <button type="button" className="btn wide" id="ofNow" disabled={busy} onClick={() => void now()}>{busy ? "Buscando…" : "Atualizar do banco agora"}</button>}
      <button type="button" className="btn wide" id="ofConnect" onClick={() => void connect()}>{c.items?.length ? "Conectar outro banco" : "Conectar banco"}</button>
      <button type="button" className="btn wide" id="ofEdit" onClick={() => setEdit(true)}>Trocar servidor</button>
    </>)}
  </>);
}
