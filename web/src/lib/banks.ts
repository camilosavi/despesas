// Bancos: cor e sigla escritas na fonte do app (sem logos nem fontes dos bancos: marcas, repositório público).
import { lumHex } from "./format";

interface Bank { m: RegExp; c: string; l: string }
export const BANKS: Bank[] = [
  { m: /nubank|^nu$/, c: "#820AD1", l: "Nu" }, { m: /inter/, c: "#FF5A00", l: "Inter" }, { m: /ita[uú]/, c: "#EC7000", l: "Itaú" },
  { m: /bradesco/, c: "#E60028", l: "Brad" }, { m: /santander/, c: "#DA291C", l: "Sant" }, { m: /^c6/, c: "#242424", l: "C6" },
  { m: /banco do brasil|^bb$/, c: "#FFCC00", l: "BB" }, { m: /caixa/, c: "#145EA8", l: "Caixa" }, { m: /mercado ?pago/, c: "#1EA7E1", l: "MP" },
  { m: /picpay/, c: "#3DAD58", l: "Pic" }, { m: /^xp/, c: "#1A1A1A", l: "XP" }, { m: /^pan$|banco pan/, c: "#0266B2", l: "Pan" },
  { m: /renner|realize/, c: "#E31E24", l: "R" }, { m: /revolut/, c: "#191C1F", l: "R" }, { m: /neon/, c: "#0AA7C9", l: "Neon" }, { m: /^next/, c: "#00C35A", l: "Next" },
  { m: /sicoob/, c: "#00786A", l: "Sic" }, { m: /sicredi/, c: "#3FA535", l: "Sicr" },
  { m: /btg/, c: "#0B2E5A", l: "BTG" }, { m: /pagbank|pagseguro/, c: "#FFC900", l: "Pag" }, { m: /^wise/, c: "#9FE870", l: "Wise" }, { m: /nomad/, c: "#FFD500", l: "Nomad" },
  { m: /^arq\b|dolarapp/, c: "#111111", l: "ARQ" }, { m: /^ame\b/, c: "#E6007E", l: "Ame" }, { m: /porto/, c: "#0055A4", l: "Porto" },
  { m: /alelo/, c: "#0A8F4A", l: "Alelo" }, { m: /pluxee|sodexo/, c: "#14213D", l: "Plx" }, { m: /^ticket/, c: "#D7141A", l: "Tkt" }, { m: /^v[ra]\b/, c: "#00994D", l: "VR" },
  { m: /^flash/, c: "#F2295B", l: "Flash" }, { m: /^caju/, c: "#FF6340", l: "Caju" },
  { m: /carrefour/, c: "#1E4C9A", l: "Carr" }, { m: /riachuelo|midway/, c: "#E31B23", l: "Ria" }, { m: /c&a|^cea$/, c: "#1D3C8F", l: "C&A" },
];
export const BANK_PICK = ["Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Caixa", "Santander", "Inter", "C6", "Mercado Pago", "PicPay", "PagBank", "BTG", "XP", "Neon", "Pan", "Renner"];
export const FX_PICK = ["Wise", "Nomad", "ARQ", "Revolut"];
export const BEN_PICK = ["Alelo", "Pluxee", "VR", "Ticket", "Flash", "Caju"];
export const CARD_PALETTE = ["#8A05BE", "#E8730C", "#2C6BD6", "#C8102E", "#0F8F6C", "#1F1F1F", "#D4A017", "#6B7A75"];

export const bankOf = (n: string | undefined | null): Bank | null => {
  const t = (n || "").trim().toLowerCase();
  return t ? BANKS.find(b => b.m.test(t)) || null : null;
};
export const cardLabel = (c: string) => {
  const b = bankOf(c); if (b) return b.l;
  const w = (c || "?").trim().split(/\s+/)[0];
  return w.length <= 5 ? w : w.slice(0, 3);
};
export const cardColor = (c: string) => bankOf(c)?.c || "#6B7A75";
/** estilo do selo (cor, texto claro/escuro pelo contraste e escala da fonte pelo tamanho da sigla) */
export function badgeSpec(color: string, label: string) {
  const fs = label.length <= 2 ? 1 : label.length === 3 ? 0.88 : label.length === 4 ? 0.76 : 0.66;
  return { background: color, color: lumHex(color) > 0.5 ? "#1A1A1A" : "#fff", "--k": fs } as Record<string, string | number>;
}
