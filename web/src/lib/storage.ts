// localStorage sem quebrar quando o navegador bloqueia (modo privado etc.)
export const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
export const lsSet = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sem espaço ou bloqueado */ } };
export const lsJson = <T>(k: string, fallback: T): T => { try { const v = JSON.parse(lsGet(k) || "null"); return v ?? fallback; } catch { return fallback; } };
