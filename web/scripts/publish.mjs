// Publica o build na raiz do repositório (o GitHub Pages serve a raiz da branch main).
// Uso: npm run publish:pages  (roda o build antes). Apaga o que o build anterior deixou e copia o novo.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../dist"), root = resolve(here, "../..");
if (!existsSync(join(dist, "index.html"))) throw new Error("Rode o build antes (npm run build).");

// 1) limpa o que a publicação anterior colocou na raiz (pastas assets/ e arquivos listados no último manifesto de publicação)
const mf = join(root, ".published.json");
if (existsSync(mf)) for (const f of JSON.parse(readFileSync(mf, "utf8"))) rmSync(join(root, f), { recursive: true, force: true });

// 2) versão do cache = hash do index.html (que cita os arquivos com hash do bundle)
const ver = createHash("md5").update(readFileSync(join(dist, "index.html"))).digest("hex").slice(0, 8);
const swPath = join(dist, "sw.js");
writeFileSync(swPath, readFileSync(swPath, "utf8").replace("__VERSION__", ver));

// 3) copia dist/* para a raiz e guarda a lista
const files = readdirSync(dist);
for (const f of files) cpSync(join(dist, f), join(root, f), { recursive: true });
writeFileSync(mf, JSON.stringify(files, null, 1) + "\n");
console.log(`publicado na raiz (${files.length} itens, cache despesas-${ver})`);
