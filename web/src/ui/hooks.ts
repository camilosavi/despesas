import { useEffect, useRef, useState } from "react";

/** botão de "toque de novo para confirmar": 1º toque muda o texto, 2º executa; volta ao normal em 3 s */
export function useArmed(armedText: string, normalText: string, onConfirm: () => void) {
  const [armed, setArmed] = useState(false); const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(t.current), []);
  return {
    text: armed ? armedText : normalText,
    onClick: () => {
      if (!armed) { setArmed(true); t.current = setTimeout(() => setArmed(false), 3000); return; }
      clearTimeout(t.current); onConfirm();
    },
  };
}
