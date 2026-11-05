// Datas como texto "AAAA-MM-DD" e meses como "AAAA-MM". Sem Date local: nada aqui depende do fuso.

export const pad = n => String(n).padStart(2, "0");

export const mesDe = d => (d || "").slice(0, 7);

export const ultimoDia = ym => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();

export const somaMeses = (ym, n) => {
  const t = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};

// dia 31 num mês de 30 dias vira o último dia do mês
export const dataComDia = (ym, dia) => `${ym}-${pad(Math.min(dia, ultimoDia(ym)))}`;

export const somaDias = (d, n) => {
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
};
