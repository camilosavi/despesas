import { useCallback, useEffect, useRef, useState } from "react";
import type { Backup } from "./loja";
import { aoExpirar, meta, pendentes, sair, sessao, sincronizar, textoErro } from "./nuvem";

/* login obrigatório, como no app atual; VITE_LOGIN=0 liga o modo sem conta (testes) */
export const LOGIN = import.meta.env.VITE_LOGIN !== "0";

export interface EstadoNuvem { busy: boolean; err: string; pend: number }
/* `b` = backup atual; `aplicar` grava o que veio da nuvem (sem gerar lápide). */
export function useNuvem(b: Backup | null, aplicar: (nb: Backup, aviso: string) => void) {
  const [ses, setSes] = useState(sessao);
  const [st, setSt] = useState<EstadoNuvem>({ busy: false, err: "", pend: 0 });
  const [vers, setVers] = useState(0);
  const ref = useRef<Backup | null>(b); ref.current = b;
  const busy = useRef(false);
  const aplicarRef = useRef(aplicar); aplicarRef.current = aplicar;

  useEffect(() => { aoExpirar.fn = () => setSes(null); return () => { aoExpirar.fn = () => {}; }; }, []);

  const agora = useCallback(async (manual = false) => {
    const cur = ref.current;
    if (!sessao() || busy.current || !cur) return;
    busy.current = true; setSt(s => ({ ...s, busy: true, err: "" }));
    try {
      const r = await sincronizar(cur, () => ref.current);
      if (!r) { busy.current = false; setSt(s => ({ ...s, busy: false })); setVers(v => v + 1); return; }
      if (r.mudou) { ref.current = r.backup; aplicarRef.current(r.backup, `Chegou ${r.desceu > 1 ? r.desceu + " mudanças" : "1 mudança"}${r.de && r.de !== "computador" ? " do " + r.de : " da nuvem"}`); }
      else if (manual) aplicarRef.current(cur, r.subiu ? `Enviei ${r.subiu} ${r.subiu > 1 ? "mudanças" : "mudança"}` : "Tudo igual à nuvem ✓");
      setSt({ busy: false, err: "", pend: 0 });
    } catch (e) {
      setSt({ busy: false, err: sessao() ? textoErro(e) : "", pend: cur ? pendentes(cur) : 0 });
    }
    busy.current = false;
  }, []);

  /* 3 s depois de mexer; ao abrir/voltar, ao voltar a internet, ao sair da aba e a cada 2 min */
  useEffect(() => {
    if (!ses || !b) return;
    setSt(s => ({ ...s, pend: pendentes(b) }));
    const t = setTimeout(() => void agora(), 3000);
    return () => clearTimeout(t);
  }, [b, ses, vers, agora]);
  useEffect(() => {
    if (!ses) return;
    const vis = () => { if (!document.hidden) void agora(); else if (ref.current && pendentes(ref.current)) void agora(); };
    const on = () => void agora(), iv = setInterval(() => { if (!document.hidden) void agora(); }, 120000);
    document.addEventListener("visibilitychange", vis); addEventListener("online", on); addEventListener("pagehide", vis);
    return () => { document.removeEventListener("visibilitychange", vis); removeEventListener("online", on); removeEventListener("pagehide", vis); clearInterval(iv); };
  }, [ses, agora]);

  const sairConta = useCallback(async (): Promise<string> => {
    await agora();
    const cur = ref.current;
    if (busy.current || (cur && pendentes(cur)) || meta().errMsg) return "Há mudanças que ainda não subiram. Conecte e tente de novo.";
    await sair(); return "";
  }, [agora]);

  return { ses, setSes, st, agora, sairConta };
}
