import { demo } from "../../novo/visao-geral/demo.mjs";
import { deAppAtual, normalizarBackup } from "./engine";
import type { Estado, Pers } from "./engine";
import type { Backup } from "./loja";

export interface Carga {
  estado: Estado; pers: Pers; nome: string; real: boolean;
  resumo?: { lancamentos: number; faturas: number; contas: number; cartoes: number; semData: number };
  erro?: string;
}

export const exemplo = (): Carga => ({ estado: demo as unknown as Estado, pers: {}, nome: "", real: false });

// Lê o backup JSON da tela Você (ou as linhas do sync_rows). Só leitura: nada é gravado nem enviado.
export function abrirBackup(texto: string): { backup?: Backup; erro?: string } {
  try {
    const nb = normalizarBackup(JSON.parse(texto));
    if (nb.erro) return { erro: nb.erro };
    const b = nb.backup;
    return { backup: { app: "minhas-despesas", v: 1, fx: [], ...b, items: b.items || [], cfg: b.cfg || {} } as Backup };
  } catch (err) { return { erro: err instanceof Error ? err.message : "Não consegui ler o arquivo." }; }
}

// Pessoas (cfg.pp) entram no motor como "acertos": saldo = o que as divisões devem − acertos, então c > 0 vira acerto negativo.
function comPessoas(bruto: any, b: Backup) {
  const pp = Array.isArray(b.cfg.pp) ? b.cfg.pp : [];
  if (!pp.length) return bruto;
  const ac = pp.flatMap((p: any) => (p.e || []).map((x: any) => ({ id: x.id, pessoa: p.name, cents: -x.c, data: x.d })));
  return { ...bruto, acertos: [...(bruto.acertos || []), ...ac] };
}

export function cargaDe(b: Backup, hoje: string): Carga {
  const { estado: bruto0, resumo } = deAppAtual(b, hoje);
  const estado = comPessoas(bruto0, b) as unknown as Estado;
  return { estado, pers: (estado.pers as Pers) ?? {}, nome: (b.cfg && (b.cfg.name || b.cfg.userName)) || "", real: true, resumo };
}

export function lerBackup(texto: string, hoje: string): Carga {
  try {
    const nb = normalizarBackup(JSON.parse(texto));
    if (nb.erro) throw new Error(nb.erro);
    const b = nb.backup;
    const { estado: bruto, resumo } = deAppAtual(b, hoje);
    const estado = bruto as unknown as Estado;
    return { estado, pers: (estado.pers as Pers) ?? {}, nome: (b.cfg && (b.cfg.name || b.cfg.userName)) || "", real: true, resumo };
  } catch (err) {
    return { ...exemplo(), erro: err instanceof Error ? err.message : "Não consegui ler o arquivo." };
  }
}

export const lerArquivo = (f: File) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => no(new Error("Não consegui abrir o arquivo."));
    r.readAsText(f);
  });
