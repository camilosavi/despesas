// Categorias: uma lista única para o app todo (nome, cor e chave).
// As básicas são fixas. Cada pessoa pode ADICIONAR as suas (guardadas na conta dela); nada de editar, esconder ou regras.
// Fatura de cartão, câmbio e transferência NÃO são categorias: são tipos de movimento (ver README).

export const SEM_CATEGORIA = { desp: "outros", rec: "rout" };

export const BASICAS = {
  desp: [
    { k: "alim", n: "Alimentação", c: "#E07A5F" },
    { k: "merc", n: "Mercado", c: "#3D9A6B" },
    { k: "transp", n: "Transporte", c: "#4F7CAC" },
    { k: "casa", n: "Casa e contas", c: "#8E6BBF" },
    { k: "saude", n: "Saúde", c: "#D6556B" },
    { k: "educ", n: "Educação", c: "#2F8F9D" },
    { k: "lazer", n: "Lazer", c: "#E0A13A" },
    { k: "compras", n: "Compras", c: "#C26FA1" },
    { k: "assin", n: "Assinaturas", c: "#6C7BD9" },
    { k: "outros", n: "Outros", c: "#8A8F98" },
  ],
  rec: [
    { k: "sal", n: "Salário", c: "#3D9A6B" },
    { k: "d13", n: "13º salário", c: "#C9A25A" },
    { k: "extra", n: "Extras", c: "#4F7CAC" },
    { k: "rend", n: "Rendimentos", c: "#2F8F9D" },
    { k: "rout", n: "Outras", c: "#8A8F98" },
  ],
};

export const MAX_PERSONALIZADAS = 20;
const CORES = ["#E07A5F", "#3D9A6B", "#4F7CAC", "#8E6BBF", "#D6556B", "#2F8F9D", "#E0A13A", "#C26FA1", "#6C7BD9"];

const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

// `pers` = { desp: [{k,n,c}], rec: [{k,n,c}] }, as categorias que a pessoa criou
export const lista = (tipo, pers = {}) => [
  ...BASICAS[tipo],
  ...(pers[tipo] || []).map(c => ({ ...c, personalizada: true })),
];

// chave que não existe (ou foi apagada) cai em Outros, nunca some do total
export const categoria = (tipo, k, pers = {}) => {
  const L = lista(tipo, pers);
  return L.find(c => c.k === k) || L.find(c => c.k === SEM_CATEGORIA[tipo]);
};

export function criar(pers, tipo, nome, cor) {
  const n = String(nome || "").trim().replace(/\s+/g, " ");
  if (!n) return { ok: false, erro: "Dê um nome para a categoria." };
  if (n.length > 24) return { ok: false, erro: "Nome com até 24 letras." };
  if (lista(tipo, pers).some(c => norm(c.n) === norm(n))) return { ok: false, erro: "Já existe uma categoria com esse nome." };
  const mine = pers[tipo] || [];
  if (mine.length >= MAX_PERSONALIZADAS) return { ok: false, erro: `No máximo ${MAX_PERSONALIZADAS} categorias suas.` };
  if (cor != null && !/^#[0-9a-f]{6}$/i.test(cor)) return { ok: false, erro: "Cor inválida." };
  const slug = norm(n).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "cat";
  let k = `u_${slug}`, i = 2;
  while (mine.some(c => c.k === k)) k = `u_${slug}_${i++}`;
  const cat = { k, n, c: cor || CORES[mine.length % CORES.length] };
  return { ok: true, pers: { ...pers, [tipo]: [...mine, cat] }, cat };
}

// só as personalizadas saem; os lançamentos dela passam para `moverPara`
export function remover(pers, tipo, k) {
  const mine = pers[tipo] || [];
  if (!mine.some(c => c.k === k)) return { ok: false, erro: "Só as categorias que você criou podem ser apagadas." };
  return { ok: true, pers: { ...pers, [tipo]: mine.filter(c => c.k !== k) }, moverPara: SEM_CATEGORIA[tipo] };
}

// Do app atual para a lista nova. `movimento` avisa que aquilo não é categoria e sim um tipo de movimento.
const ANTIGAS = {
  desp: {
    alim: "alim", merc: "merc", transp: "transp", casa: "casa", saude: "saude", educ: "educ", lazer: "lazer",
    compras: "compras", assin: "assin", outros: "outros",
    esporte: "lazer", interc: "outros", cidad: "outros",
    cartao: { k: "outros", movimento: "fatura" },
    euro: { k: "outros", movimento: "cambio" },
  },
  rec: { sal: "sal", d13: "d13", extra: "extra", rend: "rend", rout: "rout", caixa: "rout", divid: "rout" },
};

export function migrar(tipo, k, pers = {}) {
  const m = ANTIGAS[tipo][k];
  if (m) return typeof m === "string" ? { k: m } : { ...m };
  if ((pers[tipo] || []).some(c => c.k === k)) return { k };
  return { k: SEM_CATEGORIA[tipo] };
}
