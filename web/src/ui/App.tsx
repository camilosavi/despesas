import { useEffect, useState } from "react";
import { useStore } from "../lib/createStore";
import { ledger } from "../lib/store";
import { finishGoogle, returningFromGoogle, session } from "../lib/sync";
import { Actions } from "./Actions";
import { AccountView } from "./AccountView";
import { Auth } from "./Auth";
import { Home } from "./Home";
import { PdfSection } from "./PdfSection";
import { SheetHost } from "./Sheet";
import { Toast } from "./Toast";
import { Top } from "./Top";
import { ui } from "./uiStore";

export function App() {
  const ses = useStore(session, s => s.ses);
  const openId = useStore(ui, s => s.openId);
  const hasOpen = useStore(ledger, s => (openId ? s.accts.some(a => a.id === openId) : false));
  const [finishing, setFinishing] = useState(returningFromGoogle());

  useEffect(() => { if (finishing) void finishGoogle().finally(() => setFinishing(false)); }, [finishing]);
  useEffect(() => { if (openId && !hasOpen) ui.set({ openId: null }); }, [openId, hasOpen]); // conta apagada ou que sumiu na sincronização
  useEffect(() => { if (!ses) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#1C2C45"); }, [ses]);

  if (!ses) return finishing ? null : <Auth />;
  return (<>
    <div className="wrap">
      <div className="colL"><Top /><Actions /><PdfSection /></div>
      <main id="view">{openId && hasOpen ? <AccountView key={openId} id={openId} /> : <Home />}</main>
    </div>
    <SheetHost />
    <Toast />
  </>);
}
