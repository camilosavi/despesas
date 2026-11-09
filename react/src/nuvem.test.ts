import { beforeEach, describe, expect, it, vi } from "vitest";
import * as N from "./nuvem";
import type { Backup } from "./loja";

/* Supabase de mentira: auth + sync_rows */
function servidor() {
  const rows = new Map<string, { kind: string; id: string; data: any }>();
  const sv = { rows, logins: 0, refresh: 0, fail: 0, tabela: true };
  const resp = (s: number, j?: unknown) => new Response(j === undefined ? null : JSON.stringify(j), { status: s, headers: { "Content-Type": "application/json" } });
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(url), p = u.pathname, body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (sv.fail) return resp(sv.fail, { message: "boom" });
    if (p.endsWith("/auth/v1/token")) {
      if (u.searchParams.get("grant_type") === "password") { sv.logins++; return body.password === "certa1" ? resp(200, { access_token: "A" + sv.logins, refresh_token: "R", expires_in: 3600, user: { id: "u1", email: body.email } }) : resp(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" }); }
      sv.refresh++; return body.refresh_token === "R" ? resp(200, { access_token: "N" + sv.refresh, refresh_token: "R", expires_in: 3600 }) : resp(400, { msg: "bad refresh" });
    }
    if (p.endsWith("/auth/v1/signup")) return body.email === "existe@x.com" ? resp(200, { id: "u9", identities: [] }) : resp(200, { id: "u2", identities: [{}] });
    if (p.endsWith("/auth/v1/user")) return resp(200, { id: "u1", email: "a@b.com" });
    if (p.includes("/rest/v1/sync_rows")) {
      if (!sv.tabela) return resp(404, { code: "PGRST205", message: "no table" });
      if (init.method === "GET") { const o = +(u.searchParams.get("offset") || 0), l = +(u.searchParams.get("limit") || 1000); return resp(200, [...rows.values()].sort((a, b) => (a.kind + a.id).localeCompare(b.kind + b.id)).slice(o, o + l)); }
      if (init.method === "POST") { body.forEach((r: any) => rows.set(r.kind + "|" + r.id, { kind: r.kind, id: r.id, data: r.data })); return resp(201); }
      if (init.method === "DELETE") { const kind = u.searchParams.get("kind")!.replace("eq.", ""); const ids = [...(u.searchParams.get("id") || "").matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]); ids.forEach(i => rows.delete(kind + "|" + i)); return resp(204); }
    }
    return resp(404, {});
  });
  vi.stubGlobal("fetch", fn);
  return sv;
}
const bk = (items: any[] = [], cfg: any = {}): Backup => ({ app: "minhas-despesas", v: 1, items, fx: [], cfg });
const lc = (id: string, cents = 1000) => ({ id, type: "desp", desc: id, cat: "outros", cents, date: "2026-11-01", pay: "Pix", paid: false });

/* "aparelho": troca o localStorage inteiro */
function aparelho() { const m = new Map<string, string>(); return { m, usar() { vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; } }); } }; }

let sv: ReturnType<typeof servidor>;
beforeEach(() => { sv = servidor(); });

describe("login", () => {
  it("entra, grava sessão e erra senha com mensagem", async () => {
    aparelho().usar();
    await expect(N.entrar("a@b.com", "errada")).rejects.toThrow();
    try { await N.entrar("a@b.com", "errada"); } catch (e) { expect(N.mensagemAuth(e)).toBe("E-mail ou senha não conferem."); }
    const s = await N.entrar("a@b.com", "certa1");
    expect(s.uid).toBe("u1"); expect(N.sessao()?.email).toBe("a@b.com");
  });
  it("cadastro: novo pede confirmação e e-mail existente avisa", async () => {
    aparelho().usar();
    expect(await N.criarConta("novo@x.com", "certa1", "http://x/")).toBe("confirmar");
    await expect(N.criarConta("existe@x.com", "certa1", "http://x/")).rejects.toThrow(/already/);
  });
  it("lê a volta do Google/recuperação", () => {
    expect(N.lerVolta("#access_token=a&refresh_token=r&expires_in=100&type=recovery")).toEqual({ at: "a", rt: "r", exp: 100, rec: true });
    expect(N.lerVolta("#error=access_denied&error_description=venceu")?.err).toBe("venceu");
    expect(N.lerVolta("")).toBeNull(); expect(N.lerVolta("#foo=1")).toBeNull();
  });
  it("renova uma vez só mesmo com chamadas juntas e desloga em 400", async () => {
    aparelho().usar(); await N.entrar("a@b.com", "certa1");
    N.sessaoGravar({ ...N.sessao()!, exp: 0 });
    const t = await Promise.all([N.token(), N.token(), N.token()]);
    expect(sv.refresh).toBe(1); expect(new Set(t).size).toBe(1);
    N.sessaoGravar({ ...N.sessao()!, rt: "ruim", exp: 0 });
    const aoSair = vi.fn(); N.aoExpirar.fn = aoSair;
    await expect(N.token()).rejects.toThrow(); expect(N.sessao()).toBeNull(); expect(aoSair).toHaveBeenCalled();
  });
  it("500 não desloga", async () => {
    aparelho().usar(); await N.entrar("a@b.com", "certa1");
    N.sessaoGravar({ ...N.sessao()!, exp: 0 }); sv.fail = 503;
    await expect(N.token()).rejects.toThrow(); expect(N.sessao()).not.toBeNull();
  });
});

describe("sincronização", () => {
  it("1ª vez sobe tudo; 2º aparelho recebe", async () => {
    const A = aparelho(); A.usar(); await N.entrar("a@b.com", "certa1");
    const ra = await N.sincronizar(bk([lc("a"), lc("b")], { accts: [{ name: "X" }], seeded: 1 }));
    expect(ra!.subiu).toBeGreaterThan(0); expect(sv.rows.size).toBeGreaterThan(3);
    expect([...sv.rows.keys()].some(k => k.includes("seeded"))).toBe(false);
    const B = aparelho(); B.usar(); await N.entrar("a@b.com", "certa1");
    const rb = await N.sincronizar(bk());
    expect(rb!.mudou).toBe(true); expect(rb!.backup.items.map((x: any) => x.id).sort()).toEqual(["a", "b"]);
    expect(rb!.backup.cfg.accts[0].name).toBe("X");
  });
  it("edição e exclusão com lápide passam ao outro aparelho", async () => {
    const A = aparelho(), B = aparelho();
    A.usar(); await N.entrar("a@b.com", "certa1"); let ba = bk([lc("a"), lc("b")]);
    await N.sincronizar(ba);
    B.usar(); await N.entrar("a@b.com", "certa1"); let bb = (await N.sincronizar(bk()))!.backup;
    A.usar();
    const antes = ba; ba = bk([lc("a", 5000)]); N.lapideAdd(N.sumiram(antes, ba));
    expect(N.pendentes(ba)).toBe(2);
    await N.sincronizar(ba); expect(N.pendentes(ba)).toBe(0);
    B.usar(); const r = (await N.sincronizar(bb))!;
    expect(r.backup.items.map((x: any) => [x.id, x.cents])).toEqual([["a", 5000]]);
  });
  it("mudanças em lados diferentes se juntam; conflito vence o aparelho daqui", async () => {
    const A = aparelho(), B = aparelho();
    A.usar(); await N.entrar("a@b.com", "certa1"); await N.sincronizar(bk([lc("a"), lc("b")]));
    B.usar(); await N.entrar("a@b.com", "certa1"); const bb0 = (await N.sincronizar(bk()))!.backup;
    A.usar(); await N.sincronizar(bk([lc("a", 111), lc("b")]));
    B.usar(); const r = (await N.sincronizar({ ...bb0, items: [lc("a", 222), lc("b", 333), lc("c")] as any }))!;
    const m = Object.fromEntries(r.backup.items.map((x: any) => [x.id, x.cents]));
    expect(m).toEqual({ a: 222, b: 333, c: 1000 });
  });
  it("nuvem vazia não apaga o aparelho", async () => {
    const A = aparelho(); A.usar(); await N.entrar("a@b.com", "certa1");
    const b0 = bk([lc("a"), lc("b")]); await N.sincronizar(b0);
    sv.rows.clear();
    const r = (await N.sincronizar(b0))!;
    expect(r.backup.items).toHaveLength(2); expect(sv.rows.size).toBeGreaterThan(2);
  });
  it("desiste se os dados mudaram enquanto a nuvem respondia", async () => {
    aparelho().usar(); await N.entrar("a@b.com", "certa1");
    expect(await N.sincronizar(bk([lc("a")]), () => bk([lc("a"), lc("z")]))).toBeNull();
  });
  it("tabela ausente vira mensagem clara; paginação passa de 1000", async () => {
    aparelho().usar(); await N.entrar("a@b.com", "certa1");
    sv.tabela = false;
    try { await N.sincronizar(bk()); } catch (e) { expect(N.textoErro(e)).toMatch(/sync\.sql/); }
    sv.tabela = true;
    const muitos = Array.from({ length: 1200 }, (_, i) => lc("i" + i));
    await N.sincronizar(bk(muitos)); expect(sv.rows.size).toBeGreaterThan(1200);
    expect((await N.lerTudo()).length).toBe(sv.rows.size);
  });
  it("sair apaga as chaves despesas.* mas não outras", async () => {
    const A = aparelho(); A.usar(); await N.entrar("a@b.com", "certa1");
    localStorage.setItem("despesas.react.backup", "x"); localStorage.setItem("outra", "y");
    await N.sair(); expect(localStorage.getItem("despesas.react.backup")).toBeNull(); expect(localStorage.getItem("outra")).toBe("y");
  });
});
