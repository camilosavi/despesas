import { useStore } from "../../lib/createStore";
import { session, signOut, syncNow, syncState, syncText } from "../../lib/sync";
import { useArmed } from "../hooks";
import { SheetHead } from "../Sheet";
import { backHome, closeSheet, toast } from "../uiStore";

/** "Sua conta": e-mail, estado da sincronização, sincronizar agora e sair */
export function MeSheet() {
  const ses = useStore(session, s => s.ses);
  useStore(syncState, s => s);
  const out = useArmed("Toque de novo para sair", "Sair", async () => {
    const why = await signOut();
    if (why) { toast(why); return; }
    backHome(); closeSheet();
  });
  async function syncAgora() {
    toast("Sincronizando…"); await syncNow();
    const { err, off } = syncState.get(); toast(err ? "Erro: " + err : off ? "Sem conexão" : "Tudo em dia ✓");
  }
  return (<>
    <SheetHead title="Sua conta" />
    <p className="mekv">Entrou como <b>{ses?.email || ""}</b><br /><span id="meState">{syncText()}</span></p>
    <button type="button" className="btn wide" id="meSync" onClick={() => void syncAgora()}>Sincronizar agora</button>
    <button type="button" className="btn wide" id="meOut" onClick={out.onClick}>{out.text}</button>
  </>);
}
