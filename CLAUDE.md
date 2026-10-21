# Tostão (antes "Minhas Despesas") — contexto para o Claude

App pessoal de controle de gastos do Camilo, usado no iPhone 16 Pro Max (440 pt de largura).
Publicado como PWA em **https://camilosavi.github.io/despesas/** (GitHub Pages, branch `main`, pasta raiz).
Fala português; respostas curtas e diretas.
Nome do app: **Tostão** (renomeado em 21/10/2026; repositório e endereço continuam `despesas`).

## Recomeço (21/10/2026)

Pedido dele: "apaga tudo e vamos começar do 0, função por função". O app antigo (6.900 linhas: lançamentos, Mês, Contas,
caixinhas, dívidas, moedas, sincronização, avisos, Open Finance…) foi removido. **A última versão antiga é o commit
`68e3b9b`** (`git show 68e3b9b:src/app.html`): serve de consulta quando ele pedir uma função de volta, mas não copiar
em bloco — cada função volta sozinha, quando ele pedir, do jeito que ele pedir.

Ficou o que está abaixo; o resto volta função por função, conversando tela por tela (não construir tela antes de ele aprovar o desenho).

1. **Visual do cartão no topo** (`.tcard`: chip, brilho, degradê na cor do cartão; moldura `header.top` com 22% da cor).
   Sem cartão aberto usa a cor do tema (`--head`); com cartão aberto, `--hc` = cor do cartão e o texto fica claro ou escuro
   pelo contraste (`lumHex`, p.ex. Banco do Brasil amarelo → texto escuro).
2. **Cartões disponíveis com cor e letra**: `BANKS` (cor + sigla escritas na fonte do app), `BANK_PICK`, `FX_PICK` (Wise,
   Nomad, ARQ, Revolut), `BEN_PICK` (Alelo, Pluxee, VR, Ticket, Flash, Caju), "Outro" com paleta. `cardBadge(c)` desenha a letra.
   **Não usar logos nem fontes dos bancos** (marcas; repositório público; ele testou SVGs e achou horríveis).
3. **Leitores de PDF**, só leitura (mostram o que leram numa janela, não gravam lançamento):
   fatura (`parseInvoice` → Inter, Pan, PicPay, Renner/Realize), conta/boleto (`parseConta`, `CONTAS`) e holerite
   (`parseHolerite`, com extrato do convênio). Código copiado do app antigo sem mexer na lógica.
   Extrato da conta, OFX, planilha e Open Finance **não** ficaram (ele não listou).
4. **Base de banco** (21/10/2026, 1ª função; ele quer um app "como a tela de um banco", com vários bancos e todas as despesas):
   - **Contas** (`accts`): uma por banco, com cor, letra do ícone e saldo inicial personalizáveis ("Personalizar" no cartão da conta,
     com prévia). Home = cartão com **Saldo total** + lista de contas (toque abre a conta, cartão na cor dela, "‹ Contas" volta).
   - **Extrato** (`entries`) por conta, por dia, "Agendado" para data futura. **Saldo = saldo inicial + entradas − saídas com data ≤ hoje.**
     Nada de saldo digitado por cima (ele disse que vai lançar os holerites); ajuste/conferência com o saldo real do banco fica para depois.
   - **Holerite → receita**: ao ler um holerite aparece "Entra em <conta>" e "Lançar R$ X em <conta>" (líquido, na data do crédito,
     `imp:"holerite-AAAA-MM-tipo"`; avisa "Já lançado"). Fatura e conta continuam só leitura.
   - **Fatura → despesa** (21/10/2026, "pode ligar as faturas"): ao ler uma fatura aparece "Paga pela conta" (já vem a conta do mesmo
     banco, se existir) e "Lançar fatura de R$ X em <conta>": **uma despesa** `Fatura <banco>` na data do vencimento, com o total do
     banco (`r.total`, senão a soma), `imp:"fatura-<banco>-<vencimento>"` (avisa "Já lançada") e os itens guardados em `items`
     (aparecem ao tocar no lançamento). Fica "Agendado" até o vencimento e só então tira do saldo. PDF sem vencimento pede a data.
     Compra no cartão **não** mexe no saldo da conta; só a fatura paga mexe. Sem limite do cartão por enquanto.
   - **Padrão de app de banco** (21/10/2026, "pode seguir com o padrão de um app de banco, as principais funcionalidades; decisões de layout
     me pergunte"): linha de ações redonda sob o cartão (**Lançar**, **Transferir**, **Importar PDF**). *Lançar* = saída/entrada com valor grande,
     descrição, conta e data. *Transferir* = de/para/valor/data: cria **duas** entradas ligadas por `tr` (`xfer:1`), não conta como "Entrou" e
     apagar uma apaga o par. *Conta/boleto* lido vira despesa no vencimento (`imp:"conta-<empresa>-<venc>"`).
   - **Login + banco (Supabase)** (21/10/2026, "quero um app a vera, com bd"): projeto `ndsiayzschaefigobwag.supabase.co`, esquema em
     `supabase/schema.sql` (tabelas `accts` e `entries` com `user_id` + RLS; Data API ligada, "expor novas tabelas" desligado, grants só
     para `authenticated`). Tudo por `fetch` (GoTrue e PostgREST), sem biblioteca; a chave *publishable* fica no código (pública por
     desenho; a senha do banco e a `service_role` **nunca** vão para o repositório nem para a memória). Tela de login (e-mail e senha;
     "Criar conta" e **Entrar com o Google**: redireciona para `/auth/v1/authorize?provider=google` e volta com `#access_token=` no endereço; o
     cliente OAuth do Google Cloud é o mesmo do app antigo, com o callback do Supabase adicionado; Apple fica de fora, exige conta paga); sem login o app não abre. O aparelho guarda cópia local (funciona sem internet) e `despesas.zero.base` = o que já subiu:
     a cada mudança envia o diff (apagados, novos, alterados) e depois baixa tudo (banco = verdade; se mexeram durante o envio, não
     sobrescreve). Sincroniza 1,2 s depois de mexer, a cada 60 s, ao voltar ao app e ao voltar a internet. Botão "☁ Em dia" no cartão da
     home abre "Sua conta" (sincronizar agora, sair; sair só com tudo enviado e limpa o aparelho). Holerite/fatura/conta repetidos em
     dois aparelhos: o índice único `(user_id, imp)` recusa o 2º e vale o que já estava no banco. Mapeamento: `start`↔`start_cents`,
     `desc`↔`descr`, `xfer` 1↔true. **Não testado contra o Supabase real** (sandbox sem acesso): só com simulação.
   - **Layout** (21/10/2026): celular = uma coluna (cartão, botões, contas, "Ler um PDF"); PC (≥ 900 px) usa a tela toda: `.colL` (cartão, `#acts`, PDF)
     fixa à esquerda e `#view` (contas em grade ou extrato) à direita. Tudo alinhado na borda da moldura do cartão.
   - **Editar lançamento** (21/10/2026): ao tocar num lançamento aparece **Editar** (reaproveita a janela Lançar, `openLanc(id)`: valor, descrição, conta, data,
     entrada/saída; mantém `imp` e `items`). Transferência não edita (apagar e refazer; apagar leva o par).
   - **Categorias** (21/10/2026): lista fixa (`CAT_OUT`: Mercado, Alimentação, Transporte, Moradia, Contas, Cartão, Saúde, Lazer, Educação, Assinaturas,
     Outros; `CAT_IN`: Salário, Rendimento, Reembolso, Outros), escolhida no Lançar/Editar (toque de novo desmarca). Campo `cat` no lançamento
     (coluna `cat text` em `entries`: **rodar a última linha de `supabase/schema.sql` antes de usar**; o app só manda `cat` quando existe, então
     quem não usa categoria sincroniza mesmo sem a coluna). Holerite lido → "Salário", fatura → "Cartão", conta/boleto → "Contas".
   - **Busca e filtro no extrato** (por conta): campo "Buscar no extrato" (descrição, categoria, valor ou data) + chips das categorias em uso;
     filtro ativo mostra "N lançamentos · Entradas · Saídas". Só a lista é redesenhada (o campo mantém o foco); some ao trocar de conta.
   - **Caixinhas** (21/10/2026, `lib/boxes.ts`, `despesas.zero.boxes`): metas em BRL/EUR/USD com movimentos (guardar/resgatar, cotação). Sincronizam como 1 linha por caixinha na tabela `boxes`
     (movimentos em `moves jsonb`; **rodar o bloco `boxes` de `supabase/schema.sql`**). Sem a tabela, contas e lançamentos seguem sincronizando e as caixinhas ficam no aparelho (mostra "Erro ao sincronizar" e não deixa sair).
   - **Cartão puro** (21/10/2026, `kind:"cartao"` na conta; Renner, etc.): sem saldo; mesma lista da home, depois das contas, com "Cartão · gasto em <mês>" e fora do Saldo total.
     Aberto: topo mostra "Gasto em <mês>"; "Lançar" vira só compra; fora de Transferir e de "Paga pela conta" do PDF (fatura lida continua virando despesa na conta que paga).
     Coluna `kind text` em `accts`: **rodar a última linha de `supabase/schema.sql`** (o app só manda `kind` quando é cartão). 
   - **Mês pelo vencimento da fatura** (21/10/2026): cartão tem `closeDay` e `dueDay` (Personalizar; o leitor de fatura preenche sozinho se faltar). `entMonth(a, data)` = mês do vencimento da fatura em que a compra cai
     (fecha 25, vence 2: compra de 20/09 = outubro; de 26/09 = novembro). Vale no "Fatura de <mês>" do cartão e no filtro de mês do extrato (chips "out/26"). A fatura lida vira despesa na data do vencimento (já era o mês certo).
     Colunas `close_day`, `due_day` em `accts`: **rodar as 2 últimas linhas de `supabase/schema.sql`**.
   - **Pagar fatura** (21/10/2026, `ui/sheets/PaySheet.tsx`): no cartão aberto, seção "Faturas" (por mês de vencimento: total, "Em aberto"/"Paga ✓ em", botão Pagar). Pagar = despesa "Fatura <cartão>" na conta escolhida
     (valor editável, data = vencimento do cartão), com as compras em `items`, `imp:"pagfatura-<idCartão>-AAAA-MM"`. Apagar o lançamento reabre a fatura. Fatura de PDF do mesmo banco que vence no mês também conta como paga
     (`faturaPaid`) e o leitor recusa lançar por cima de uma já paga. Sem coluna nova no banco.
   - **Limite do cartão** (21/10/2026, `limit` na conta cartão; "Limite do cartão" em Novo cartão/Personalizar): usado = faturas em aberto (`cardUsed`, todos os meses); topo do cartão mostra "Limite disponível" e a seção "Faturas" tem a barra
     (vermelha se passar). Pagar a fatura libera o limite. Coluna `limit_cents` em `accts`: **rodar a última linha de `supabase/schema.sql`**.
   - **Categorias próprias** (21/10/2026): "+ Nova" no Lançar/Editar; não há lista guardada: `catsOf(tipo, entries)` = fixas + qualquer nome usado nos lançamentos (sem tabela nem sync novo). Renomear/apagar só as próprias, no Resumo (`actions.renameCat`).
   - **Resumo por categoria** (botão "Resumo" na linha de ações; `SummarySheet`): mês (chips) × Saídas/Entradas, total, % e barra por categoria, toque abre os lançamentos. Todas as contas; cartão pelo mês do vencimento (`entMonth`).
     Fora do resumo: transferências, ajustes (`imp:"ajuste-…"`) e o pagamento de fatura (`pagfatura-…`, as compras do cartão já são os gastos). Fatura de PDF sem cartão cadastrado entra como "Cartão".
   - **Conferir saldo** (botão na conta, `ConferSheet`): digita o saldo do app do banco; mostra a diferença e "Lançar ajuste" (entrada/saída "Ajuste de saldo", `imp:"ajuste-<id>"`, não conta em "Entrou" nem no resumo).
   - **Caixinhas no topo**: na home, linha "Nas caixinhas R$ … · € …" sob o saldo total (por moeda; não entra no saldo).
   - **Qualidade de vida** (21/10/2026): *Desfazer* no aviso ao apagar lançamento, transferência ou conta (6 s; `toast(texto, undo)`); *Duplicar* no lançamento (`{kind:"lanc", copyId}`, só sem `tr`/`imp`);
     sugestão de descrição já usada (`descHints`, `<datalist>`) que preenche a categoria da última igual (`catForDesc`, só se ele ainda não tocou nas categorias); atalhos **Hoje/Ontem** (`DateField`, também em Transferir);
     **Enter** salva em Lançar/Transferir; Lançar abre na última conta usada (`despesas.zero.lastAcct`, só no aparelho).
   - **Olho** (21/10/2026, canto do cartão no topo, ao lado de Personalizar): borra os valores das listas e do cartão (`html.hide`, `despesas.zero.hide` só no aparelho); as janelas continuam legíveis.
   - **Voltar do celular** (`ui/navHistory.ts`): conta aberta e janela aberta são níveis do histórico; voltar fecha a janela, depois volta às contas, depois sai do app. ✕ e ‹ Contas desfazem as entradas com `history.go` (juntadas num só por microtask).
   - **Arrastar para baixo fecha a janela** (`SheetHost`, só < 700 px): o gesto precisa começar com o conteúdo da janela no topo (rolar até o topo não fecha); passou de ~110 px ou foi rápido, fecha; senão volta.
   - **Fatura lida** (21/10/2026, `faturaRows`/`isPay` em `lib/imports.ts`, sem mexer nos parsers): compras em ordem de data; crédito "Pagamento…" (Renner trazia o Pix da fatura anterior) fica à parte, **fora da soma, do total lançado e dos itens**; créditos aparecem como "−R$".
   - **Categoria por item da fatura** (21/10/2026): `EntryItem.cat` (dentro do jsonb `items`, sem coluna nova). Na leitura de fatura cada compra tem um seletor (`ui/CatSelect.tsx`) já sugerido por `catForDesc` (lançamentos e itens de faturas anteriores);
     na fatura lançada o seletor fica nos itens do lançamento. No Resumo, fatura com categorias é dividida pelos itens (`expandItems`; sem categoria e a diferença para o total do banco ficam em "Cartão"); fatura sem categoria continua uma linha. Renomear/apagar categoria também vale nos itens.
   - **Extrato por categoria** (alternador "Por dia | Por categoria" no extrato da conta, `groupByCat`): grupos do maior para o menor, total com sinal; transferências agrupadas à parte. Respeita busca e filtros.
   - Topo: na home, o olho e o botão da nuvem ("Em dia") ficam juntos no canto direito, nesta ordem (decisão dele: "Em dia" do lado direito do olho); na conta aberta, "‹ Contas" à esquerda e Personalizar + olho à direita.
   - **Lançar completo** (21/10/2026, "voltar o que funcionava": `lib/launch.ts`, `launchEntries`): *Pago / A pagar* (`open:1`, fora do saldo e do "Entrou" até "Marcar como paga/recebida"; grupo "A pagar" no extrato; coluna `open boolean` em `entries`:
     **rodar a última linha de `supabase/schema.sql`**; o sync manda `open`/`cat` vazios quando tirados); "Mais opções": **Parcelar** (valor = total, sobra na 1ª, desc "X 2/4"), **Todo mês** (N meses ou até um mês, máx. 60), **Dividir com N pessoas**
     (sai tudo; partes "A receber: …" cat Reembolso) e **Pagar com duas formas** (parte sai de outra conta). Cartão: só parcelar/repetir (cada parcela cai na fatura do mês).
   - **Categorias com cor** (`lib/catcolor.ts`, `despesas.zero.cats` só no aparelho): bolinha (`ui/Dot.tsx`) em pílulas, extrato, grupos e Resumo; `CatsSheet` ("Cores e categorias" no Resumo): cor de cada uma, esconder padrão (some do Lançar, nunca "Outros"), renomear/apagar as próprias.
   - **Open Finance** (21/10/2026, `lib/openfinance.ts`, `ui/OfSection.tsx`, Worker `tools/pluggy-worker.js`): Inter (conta + cartão) pelo Meu Pluggy. No aparelho (`despesas.zero.of`): endereço do Worker, chave e conexões (nunca no repositório).
     Roda sozinho ao abrir/voltar (máx. a cada 30 min) e em "Atualizar do banco" dentro da conta. Chaves `imp:"of-<idTx>"` (sem duplicar); pagamento de fatura = `pagfatura-of-…`; Pix para si e "Crédito liberado" = `xfer`.
     1ª importação ajusta o saldo inicial para bater com o do banco; cartão só compras da fatura em aberto, preenche limite/fechamento/vencimento. Testado com Worker simulado.
   - **Trazer o Open Finance do app antigo** (`lib/driveImport.ts`, botão em Open Finance quando falta servidor): o app antigo guardava `despesas.of` criptografado (PBKDF2 250000 + AES-GCM, senha de sincronização) no `appDataFolder` do Drive (`despesas-sync.json`).
     Login Google por redirecionamento (cliente OAuth do app antigo, escopo `drive.appdata`, `state` começa com `drv.` para não colidir com o login do Supabase), pede a senha, lê só `prefs["despesas.of"]` e grava no aparelho. Senha e token não ficam guardados (token em `sessionStorage`).
     Precisa de `https://camilosavi.github.io/despesas/` nos redirecionamentos autorizados do cliente e do escopo `drive.appdata` no consentimento. Testado com Google simulado.
   - Ainda **não** tem: orçamento/meta por categoria, gráfico mensal.

## Cores e logo (21/10/2026)

Base visual decidida por ele: **azul-marinho `#14203A`, dourado (`#C9A25A` claro / `#D9B66F` escuro) e branco**, nas telas de login e do app
(`--head`, `--accent`, `--bg`, `--surface`). Verde/vermelho ficam só para entrada/saída (`--pos`/`--neg`). Logo = **a imagem "UM TOSTÃO" que ele mandou** (moeda marinho e dourado: cruz, quatro flores, texto em arco, pontilhado), em
`tostao-logo.png` (login, fundo transparente) e nos ícones `tostao-180/192/512.png` + `tostao-maskable-512.png` (links com `?v=4`). Recusados antes:
cruz em círculo simples ("app de igreja"), "T" verde e moeda vetorial minha. Não usar a foto da moeda do site de numismática (direitos).

## Como editar (sempre assim) — base React + TypeScript (21/10/2026)

O app foi migrado de um HTML único para **Vite + React 18 + TypeScript estrito** em `web/` (mesma tela, mesmos dados, mesmo CSS em `web/src/styles.css`).
`src/app.html` e `build_pwa.py` foram removidos (estão no histórico: `git show 68e3b9b:src/app.html`).

1. Edite só em `web/src` (`lib/` = regras sem tela: ledger, sync, imports, parsers de PDF; `ui/` = telas e janelas). Nunca edite `index.html`, `assets/`, `sw.js` da raiz: são gerados.
2. `cd web && npm ci` (1ª vez), `npm test` (vitest) e `npm run publish:pages` (typecheck + build + copia para a raiz; versão do cache do `sw.js` muda sozinha; `.published.json` lista o que o script gerencia).
3. Teste em 440 px claro e escuro, console sem erro; se mexer em layout, também 1440 e 375 (Playwright: semear `despesas.zero.ses/accts/entries` no localStorage e bloquear `supabase.co`).
4. Antes de começar, `git pull`. Commit e push direto na `main` (ele liberou); depois mostre o que mudou. O Pages publica em ~1 min.
5. Parsers de PDF (`lib/pdf/parsers.ts`, `@ts-nocheck`) são calibrados: não mexer sem PDF de exemplo.
6. Instalar no iPhone: PWA pelo Safari (Compartilhar > Adicionar à Tela de Início); grátis e sem expirar. App nativo (Capacitor) só se ele pagar a conta Apple.

Várias conversas ao mesmo tempo: antes do push `git fetch origin main && git rebase origin/main`; nunca `push --force`.
Conflito em `web/src`: juntar à mão. Conflito em `index.html`/`assets`/`sw.js` da raiz: aceitar qualquer lado e rodar `npm run publish:pages` de novo.
O histórico foi recomeçado em 09/10/2026 (tirar valores pessoais): clone antigo não serve, clonar de novo.

## Regras que valem sempre

- **Nada de valores pessoais neste repositório (ele é público).** Limites, faturas, saldos ficam no Projeto "App Despesas"
  do claude.ai (`claude/contexto-pessoal.md`). Quem abre o app pela primeira vez começa limpo, sem cartões.
- Valores sempre em **centavos** (inteiros); datas ISO `AAAA-MM-DD`.
- Menos texto: nada de parágrafo de apoio; só aviso que muda o que a pessoa faz.

## Dados no aparelho

`localStorage` (cópia do banco): `despesas.zero.ses` (sessão), `despesas.zero.base` (já enviado), `despesas.zero.accts` (`[{id,name,color,label?,start}]`) e `despesas.zero.entries`
(`[{id,acct,type:"rec"|"desp",cents,date,desc,cat?,imp?,at}]`). Os dados vão para o Supabase do dono (ver acima). A versão de 21/10 de manhã guardava
`despesas.zero.cards` (só nome e cor): vira conta com saldo zero na primeira abertura (idempotente).
As chaves do app antigo (`despesas.v3`, `despesas.cfg3`, `despesas.fx3`…) continuam no iPhone dele, intactas, mas o app não lê.
Se ele pedir os lançamentos de volta, dá para importar dali (ou do backup JSON `{app:"minhas-despesas", v:1, items, fx, cfg}`).

## Leitores: o que já foi calibrado (não perder)

- Leitor de PDF: pdf.js 3.11.174 via cdnjs, no próprio aparelho; PDF com bytes antes do `%PDF-` é cortado (`pdfInfo`);
  PDF com senha pede a senha; PDF só imagem (passou por iLovePDF/scan) avisa para usar o original.
  Se falhar, "Ver diagnóstico" copia a estrutura com nomes mascarados (`diagText`) para calibrar um layout novo.
- Inter: datas "03 de mar. 2026", "(Parcela 01 de 03)", "Valor pendente do mês anterior" vira o item "Saldo da fatura
  anterior", "Fatura atual" = total, "Data de corte" = fechamento.
- Pan: duas colunas, DD/MM com ano pelo fechamento, "Resumo das faturas" (anterior − pago > 0 vira saldo), anuidade "04-12".
- PicPay: "Vencimento: … | Fechamento: …", duas colunas, parcela grudada ("PARC03/05"), estorno cancela compra de mesmo valor.
- Renner/Realize: "Lançamentos detalhados", colunas Estabelecimento / Valor.
- Holerite: "Demonstrativo/Recibo de Pagamento", líquido abaixo de "Valor Líquido", Data Crédito, Mês de Referência, eventos entre
  "Proventos | Descontos" e os totais (confere proventos − descontos = líquido); tipo pelo maior provento (Salário, Adiantamento,
  13º 1ª/2ª parcela, Férias); convênio só conta se houver desconto de coparticipação/convênio.
- Conta/boleto: empresa (`CONTAS`), "Vencimento" e valor total mais repetidos; "Débito Automático" marca `auto`.
- Cada layout novo precisa de um PDF de exemplo; manter esta lista em dia ao calibrar.
