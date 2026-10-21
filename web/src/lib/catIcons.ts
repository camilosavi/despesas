// Ícones das categorias (os do app antigo, 24×24, só traço). Categoria sem ícone (as que ele cria) usa a etiqueta.
const P: Record<string, string> = {
  cartao: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18M7 15h4"/>',
  alim: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7h3"/>',
  merc: '<path d="M3 4h2.5l2 11h10l2-8H6.5"/><circle cx="9" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
  transp: '<path d="M5 16v-5l2-5h10l2 5v5M5 16h14M5 11h14M7 16v2M17 16v2"/>',
  casa: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  lazer: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14.5 7v10"/>',
  esporte: '<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/>',
  saude: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  compras: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  educ: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  assin: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
  outros: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  sal: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.2"/>',
  caixa: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/>',
  rend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  divid: '<circle cx="8" cy="8.5" r="2.8"/><circle cx="16.5" cy="8.5" r="2.8"/><path d="M3 19.5c0-3 2.3-5 5-5s5 2 5 5M11.5 19.5c0-3 2.3-5 5-5s5 2 5 5"/>',
  rout: '<path d="M12 5v14M5 12h14"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.2 8.2z"/><circle cx="8" cy="8" r="1.2"/>',
};
const BY_NAME: Record<string, string> = {
  Alimentação: "alim", Mercado: "merc", Transporte: "transp", "Casa e contas": "casa", Lazer: "lazer", Esporte: "esporte", Saúde: "saude", Compras: "compras",
  Educação: "educ", Assinaturas: "assin", "Faturas de cartão": "cartao", Outros: "outros",
  Salário: "sal", Rendimentos: "rend", Divisões: "divid", "Saldo anterior": "caixa", "Outras receitas": "rout",
};
export const catIconPath = (c: string) => P[BY_NAME[c] || "tag"];
