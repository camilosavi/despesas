# react/ — Um Tostão em React + TypeScript (branch `react-tostao`)

**Não é publicado.** O GitHub Pages só serve a `main`; o app no ar (`src/app.html` + `build_pwa.py`) continua como está.

## Regra
- **O motor de cálculo é um só**: `../novo/base/*.mjs` (34+ testes lá). O React só importa de lá, via `src/engine.ts`. Nenhuma tela soma por conta própria.
- Tela = componente que lê `estado` e chama o motor. Dados reais entram pelo backup JSON (`src/dados.ts` → `deAppAtual`), só no navegador.
- Estilo: tokens no topo de `src/estilo.css` (espaço, raio, fonte, cor, foco). Nada de número solto; texto mínimo `.8rem` (≈ 11 px); alvos de toque ≥ 44 px; foco visível; sem `user-scalable=no`.
- **A regra do celular fica no fim do CSS de propósito** (mesma especificidade das de cima).

## Rodar
```
cd react && npm install
npm run dev          # http://localhost:5173
npm test             # vitest (13 testes)
npm run typecheck && npm run build
```
Testes do motor: `node --test "novo/teste/*.test.mjs"` (na raiz).

## O que já tem
Início (Visão geral) e Contas redesenhada (saldo + fim do mês, lista "Ainda vai acontecer / Já aconteceu" com saldo depois de cada item e linha de hoje, cartão como uma linha "Fatura X", busca e filtro recolhidos, categorias na coluna da direita): Na conta hoje, Resumo do mês, Nota de saúde (só quando há o que dizer), Fluxo de caixa (com tabela para leitor de tela), Gastos (rosca com legenda e valor), Cartões, Vence em 10 dias, Últimas transações, Pessoas. "Usar meus dados" lê o backup JSON.

## O que ainda NÃO tem (continua no app atual)
Cartões (tela), lançar/editar, leitores de PDF/OFX/holerite/print, Open Finance, login/sincronização Supabase, avisos, temas, organizar widgets (arrastar/redimensionar do protótipo), logos dos bancos (`novo/marcas`), "Merece atenção". Os botões que levam a essas telas mostram um aviso.
