// Junta a base + dados de exemplo + a tela num HTML só. Uso: node novo/visao-geral/montar.mjs saida.html
import { readFileSync, writeFileSync } from "node:fs";
const rd = f => readFileSync(new URL(f, import.meta.url), "utf8");
const lim = s => s.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const { demo } = await import("./demo.mjs");
const js = [lim(rd("../base/datas.mjs")), lim(rd("../base/categorias.mjs")), lim(rd("../base/calculo.mjs")), lim(rd("../base/pessoas.mjs")), "const DEMO=" + JSON.stringify(demo) + ";", rd("tela.js")].join("\n");
const html = rd("pagina.html").replace("/*CSS*/", rd("tela.css")).replace("/*JS*/", () => js);
writeFileSync(process.argv[2] || "visao-geral.html", html);
