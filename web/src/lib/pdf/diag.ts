// Diagnóstico: estrutura do PDF com nomes e números longos mascarados, para ajustar o leitor sem mandar a fatura.
import { R } from "../format";
import { pdfLines } from "./parsers";
import { pdfjsVersion } from "./read";
import type { PdfData } from "./read";

/* eslint-disable @typescript-eslint/no-explicit-any */
const DIAG_KEEP = new Set(("de da do das dos e em a o ao para no na nos nas por r$ us$ parcela parcelas total totais fatura faturas vencimento vence valor valores " +
  "data datas descrição movimentação movimentações beneficiário pagamento pagamentos compra compras cartão cartões final despesas despesa lançamentos lançamento " +
  "encargos iof juros saldo limite limites banco inter pan renner realize mínimo anterior atual crédito créditos débito débitos estorno estornos internacional " +
  "internacionais nacional nacionais próxima próximas próximo próximos parcelado parcelada parcelamento parcelamentos anuidade titular adicional resumo período fechamento " +
  "taxa taxas ajuste ajustes outros outras pago paga seguro tarifa multa rotativo pix boleto disponível utilizado emissão cotação dólar usd brl eur entrada pagar " +
  "mês meses cet am a.m dia dias desta fatura sua seu seus suas tipo cotação conversão estabelecimento cidade " +
  "jan fev mar abr mai jun jul ago set out nov dez janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro").split(" "));

export function diagTok(w: string) {
  const n = w.toLowerCase().replace(/^[(\[{"“']+|[)\]}"”':;,.!?]+$/g, "");
  if (!/[\p{L}\d]/u.test(n)) return w;
  if (/^[+-]?(r\$)?-?\d{1,3}(\.\d{3})*,\d{2}$/.test(n)) return w;
  if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(n) || /^\d{1,2}:\d{2}$/.test(n) || /^\d{1,4}$/.test(n)) return w;
  if (/bancointer|inter\.co|bancopan/.test(n) || DIAG_KEEP.has(n)) return w;
  return w.replace(/\d/g, "#").replace(/\p{Lu}/gu, "X").replace(/\p{Ll}/gu, "x");
}

export function diagText(pdf: PdfData) {
  const { pages, res, err: e, info: f } = pdf as any, all = pages.map((p: any) => p.items.map((i: any) => i.s).join(" ")).join(" ").replace(/\s+/g, " ");
  const out = [`Tostão · diagnóstico de fatura · ${pages.length} pág.`,
    `detecta: inter=${/Banco Inter|bancointer|inter\.co\//i.test(all) ? 1 : 0} pan=${/Banco Pan\b|bancopan/i.test(all) ? 1 : 0} renner=${/Realize|Renner/i.test(all) ? 1 : 0} picpay=${/PicPay/i.test(all) ? 1 : 0}`,
    f ? `arquivo: ${f.tipo} ${f.kb} KB (${f.bytes} bytes) · início "${f.head}" · hex ${f.hex} · %PDF em ${f.off} (${f.ver}) · startxref=${f.startxref} · fim "${f.fim}" · pdf=${f.pdf} · senha pedida=${f.senha || 0} · proteção=${f.enc} · %%EOF=${f.eof} objstm=${f.objstm} xrefstm=${f.xrefstm} · produtor=${f.producer}` : "arquivo: ?",
    `leitor: pdf.js ${pdfjsVersion()} · ${navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 90)}`,
    res ? `leitura: banco=${res.bank || "?"} vence=${res.due || "?"} itens=${res.rows.length} soma=${R(res.rows.reduce((s: number, r: any) => s + r.cents, 0))}` : `erro: ${e || "?"}`];
  pages.forEach((pg: any, n: number) => {
    out.push(`--- página ${n + 1} (${Math.round(pg.w)}x${Math.round(pg.h)})`);
    pdfLines(pg).forEach((l: any) => out.push(`${Math.round(l.t)}| ` + l.cells.map((c: any) => `${Math.round(c.x)}:${c.s.split(/\s+/).map(diagTok).join(" ")}`).join(" ¦ ")));
  });
  return out.join("\n");
}
