import type { Estado, Pers } from "./engine";
import * as C from "./engine";

// Ícones por categoria (mesmos traços do app antigo).
export const ICO: Record<string, string> = {
 cartao:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18M7 15h4"/>',
 interc:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>',
 euro:'<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/>',
 cidad:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8.5 16.5h7"/>',
 alim:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7h3"/>',
 merc:'<path d="M3 4h2.5l2 11h10l2-8H6.5"/><circle cx="9" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
 transp:'<path d="M5 16v-5l2-5h10l2 5v5M5 16h14M5 11h14M7 16v2M17 16v2"/>',
 casa:'<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
 lazer:'<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14.5 7v10"/>',
 esporte:'<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/>',
 saude:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
 compras:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
 educ:'<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
 assin:'<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
 outros:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
 sal:'<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.2"/>',
 extra:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
 caixa:'<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/>',
 rend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
 divid:'<circle cx="8" cy="8.5" r="2.8"/><circle cx="16.5" cy="8.5" r="2.8"/><path d="M3 19.5c0-3 2.3-5 5-5s5 2 5 5M11.5 19.5c0-3 2.3-5 5-5s5 2 5 5"/>',
 rout:'<path d="M12 5v14M5 12h14"/>',
 d13:'<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5.5-3.5-5.5-1.5S10 9 12 9zM12 9c1.5-3.5 5.5-3.5 5.5-1.5S14 9 12 9z"/>'
};
const ETIQ = '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.4"/>';

/** Quadradinho com o ícone da categoria, na cor dela (classe .ico.cat do app antigo). */
export function CatIco({ k, t, pers }: { k: string; t: "desp" | "rec"; pers: Pers }) {
  const c = C.categoria(t, k, pers) as { n: string; c: string; k?: string };
  const key = c.k || k;
  return (
    <span className="ico cat" style={{ "--cc": c.c } as React.CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICO[key] || (key.startsWith("u_") || key.startsWith("ur_") ? ETIQ : ICO.outros) }} />
    </span>
  );
}
export type { Estado };
