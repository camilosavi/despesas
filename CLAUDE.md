# Um Tostão (antes "Minhas Despesas") — contexto para o Claude

> **27/10/2026: o `main` ganhou login + banco no Supabase** (seção "Conta e sincronização no Supabase" abaixo; no lugar do Drive).
> **21/10/2026 (noite): o app antigo voltou ao `main`** (árvore idêntica ao commit `68e3b9b`), por pedido dele.
> A versão nova (Tostão, React + TypeScript, login Supabase, contas, faturas, Open Finance) ficou guardada na branch
> **`novo-tostao-21-10`** (último commit `1f22325`). Aqui valem as regras do app antigo abaixo (`src/app.html` + `build_pwa.py`).


App pessoal de controle de gastos do Camilo, usado no iPhone 16 Pro Max (440 pt de largura).
Publicado como PWA em **https://camilosavi.github.io/despesas/** (GitHub Pages, branch `main`, pasta raiz).
O Camilo adiciona pelo Safari → Adicionar à Tela de Início. Fala português; respostas curtas e diretas.

## Como editar (sempre assim)

1. Edite **só `src/app.html`** (fonte única). Nunca edite `index.html` à mão.
2. Rode `python3 build_pwa.py` → gera `index.html` e `sw.js` (versão do cache muda sozinha).
3. Teste em 440 px de largura (claro e escuro) e confira que não há erro de console.
4. Antes de começar, `git pull` (outras conversas podem ter publicado).
5. Commit e push direto na `main` (o Camilo liberou em out/2026: "pode mudar tudo e comitar direto"); depois mostre o
   que mudou. O Pages publica em ~1 min; o app atualiza ao fechar/abrir.

**Várias conversas ao mesmo tempo** (o Camilo edita coisas diferentes em chats paralelos):
- Antes do push: `git fetch origin main && git rebase origin/main`. Nunca `push --force`.
- Conflito em `src/app.html`: juntar as duas versões à mão (não descartar a do outro chat).
- Conflito em `index.html`/`sw.js`: não resolver à mão; aceitar qualquer lado, rodar `python3 build_pwa.py` de novo
  e seguir o rebase (`git add index.html sw.js && git rebase --continue`).
- Se o push for recusado (alguém publicou no meio), repetir fetch + rebase + build e tentar de novo.
- Conversa parada há tempo: puxar antes de editar, senão trabalha em cima de versão velha.

**Histórico recomeçado em 09/10/2026** (pedido dele: tirar valores pessoais que estavam em commits antigos). Clone
antigo de antes dessa data não serve: clonar de novo, nunca dar rebase/push de um clone velho (traria o histórico de volta).

Para trabalhar no repo numa sessão nova: anexe `camilosavi/despesas` com acesso de push
(o GitHub App do Claude já está instalado nesse repo).

## Onde ficam os dados

- **PWA (versão em uso):** `localStorage` do iPhone — chaves `despesas.v3` (lançamentos),
  `despesas.fx3` (compras de euro), `despesas.cfg3` (config), `despesas.rates2` (cache da cotação euro/dólar).
  Nada de dados pessoais vai para o repositório (ele é público). Backup = arquivo JSON
  exportado/importado na tela **Você** (foto na barra de baixo) (`{app:"minhas-despesas", v:1, items, fx, cfg}`).
- **Versão antiga dentro do Claude** (artifact https://claude.ai/artifact/CueA1bQ9JMYxYHgMBjeHFm):
  mesmo código com `const PWA=false;`, dados no banco do artifact. Foi substituída pelo PWA;
  só republicar lá se o Camilo pedir.
- `src/app.html` tem `const PWA=false;` e o build troca para `true`.

## Modelo de dados (lançamento)

`{type:"desp"|"rec", desc, cat, cents (inteiro, centavos), date:"AAAA-MM-DD", pay, paid (bool),
card?, parc?:"i/n", group?, createdAt}`

- Valores sempre em **centavos**. Datas ISO.
- Cartão: campo `card` ou prefixo na descrição `"Inter · …"`. `"Fatura X"` (cat `cartao`) conta como cartão X.
- **Valor da fatura × itens:** o total do cartão/mês é **a soma do que está lançado** (pedido dele, out/2026).
  O lançamento `"Fatura X"` (cat `cartao`, `genFat()`) é só o valor do banco para conferir ("falta lançar" / "bate ✓");
  só conta quando aquele cartão/mês não tem nenhum item lançado. Toda soma usa `amt(x)` (fatura vale 0 se há itens).
  Nunca somar `x.cents` direto em totais de despesa — use `amt(x)`. (A regra antiga de corte por data `asOf` foi descartada.)
- Parcelas: um lançamento por mês com `parc:"i/n"`.
- Repetir: "Parcelar ou repetir" tem fixo mensal por 3/6/12 meses e **"Até um mês que eu escolher…"** (`rep="u"` + campo
  `until` tipo mês; vira `m<n>` com `monthsSpan`, máximo 120).

## Regras de negócio que o Camilo pediu

- **Valores pessoais (limites, metas, faturas) não entram neste repositório — ele é público.** Esse contexto fica
  no Projeto "App Despesas" do claude.ai (doc `claude/contexto-pessoal.md`). Quem abre o app pela primeira vez
  começa limpo: sem cartões, sem meta de câmbio.
- O app só mostra **a partir de set/2026** (`MIN_YM`): setas, Ano, gráfico e datas não vão antes disso.
  O normal é ele usar a partir do mês atual; setembro fica só para o caso de precisar.
- Datas automáticas: **fatura Renner e adiantamento → dia 15**; **outras faturas → vencimento do cartão** (sem ele, último dia);
  salário → último dia, que o `salShift` leva para o dia 1º do mês seguinte.
- Receitas são previsões: **não pré-lançar salário/adiantamento**, ele lança quando recebe.
- Cotação do euro e do dólar vem da AwesomeAPI e o próprio app atualiza a cada 5 min (fallback frankfurter.dev).
  O botão "Atualizar" busca na API na hora; **não existe mais digitação manual** (pedido dele, out/2026).
  Não usar tarefa agendada do Claude para isso.
- Fatura em PDF: dentro de um cartão, "Importar fatura (PDF)" lê no próprio aparelho (pdf.js via cdnjs), mostra para
  conferir, marca o que já foi lançado, cria as próximas parcelas e salva o dia de vencimento no cartão.
  Layouts conhecidos: Renner/Realize, Inter (`parseInter`, datas "03 de mar. 2026", "(Parcela 01 de 03)") e
  Pan (`parsePan`, duas colunas, datas DD/MM com ano pelo fechamento). Outros bancos precisam de um PDF de exemplo.
  Inter: quando a fatura anterior foi paga em parte, a linha "Valor pendente do mês anterior" vira o item
  **"Saldo da fatura anterior"** (cat `cartao`, `r.prev`), senão a soma fica só nas despesas do mês; "Fatura atual" vira
  `r.total` e a importação mostra "bate com o total do banco ✓" ou "banco diz R$ X".
  PicPay (`parsePicPay`, out/2026, calibrado com a fatura de uma amiga dele): "Vencimento: … | Fechamento: …" (ano das
  datas DD/MM pelo fechamento), duas colunas por página (a da direita continua a lista e pode vir acima do título; só
  páginas com "Transações Nacionais"/"Estabelecimento"), valores sem R$, parcela grudada no nome ("…PARC03/05"),
  "PAGAMENTO DE FATURA" ignorado, crédito/estorno cancela a compra de mesmo valor; "Total da fatura" vira `r.total` e
  "Fatura anterior" + "Pagamento recebido" > 0 vira "Saldo da fatura anterior". O texto bruto do PicPay vem fora de
  ordem: usar `pdfLines`.
  Pan: o "Resumo das faturas" (anterior, pago, lançamentos, total) faz o mesmo: anterior − pago > 0 vira "Saldo da fatura
  anterior" e o total vira `r.total`. Anuidade parcelada vem como "04-12" no fim do nome → parcela 4/12.
  **Fatura parcelada:** crédito do valor financiado (`FIN_RE`: "VL FAT EF", "Parcelamento de fatura"…) na fatura nova →
  checkbox "Tirar R$ X de <mês anterior>" (`imp.fin`): reduz o "Saldo da fatura anterior" daquele mês (`finOf`=tag,
  `finCut`) ou, sem ele, cria item negativo "Parcelado da fatura (volta nas parcelas)". Idempotente por `finOf`. O valor
  volta nas parcelas ("Parcelamento da fatura", cat `cartao`). A entrada paga ("PG ENT PR EF") é só pagamento, ignorada.
  **Nubank** (`parseNubank`, 27/10/2026, só layout; PDF de 8 páginas, sem valores guardados): detecta "Nu Pagamentos"/"Nubank" + "TRANSAÇÕES".
  Vencimento da capa "Data de vencimento: DD MÊS AAAA" (mês abreviado em maiúsculas); datas dos lançamentos "DD MÊS" sem ano (ano pelo
  fechamento de "DE DD MÊS A DD MÊS", virando o ano quando o mês passa do fechamento). Páginas "TRANSAÇÕES": célula da data, final do cartão
  ("•••• NNNN", ausente em compra por NuPay), descrição "… - Parcela i/n" e valor "R$ x"; blocos por titular ("Nome R$ subtotal", sem data) e
  seção "Pagamentos e Financiamentos". Valores negativos vêm com "−" (U+2212): `nuC` troca por "-". Ignora "Pagamento em DD MÊS" e
  "Crédito de parcelamento de compra". 'Parcelamento de Compra "LOJA" - Parcela i/n' (com a linha "Total a pagar: … valor da transação de R$ X")
  vira a parcela de LOJA e apaga a compra original de mesmo nome e valor (não por valor sozinho: há compras diferentes de mesmo valor).
  " - NuPay" some do nome. "Resumo da fatura atual": Fatura anterior + Pagamento recebido (negativo) > 0 vira "Saldo da fatura anterior";
  "Total a pagar" vira `r.total`. O banco arredonda parcelas com juros e a soma pode diferir 1 centavo do total: a importação aceita
  até 2 centavos de diferença ("bate com o total do banco ✓").
  **Santander** (`parseSantander`, 27/10/2026, só layout; 3 páginas): detecta "Santander" + "Detalhamento da Fatura". Vencimento = data logo abaixo
  do rótulo "Vencimento" na capa (caixas); fechamento de "compras e pagamentos realizados até DD/MM" (ano pelo vencimento). Por cartão:
  "Pagamento e Demais Créditos" e "Despesas" (colunas Compra/Data/Descrição/Parcela/R$/US$), linha "DD/MM DESCRIÇÃO [NN/NN] valor" — data e descrição
  chegam juntas na mesma célula; valor sem "R$", 1º número da linha = coluna R$; parcela em célula própria ("NN/NN" na anuidade). "VALOR TOTAL" e
  "Resumo da Fatura" encerram a seção. Pagamento ("DEB AUTOM DE FATURA…") ignorado; outro crédito entra negativo e cancela compra de mesmo valor
  (não calibrado: o PDF de exemplo não tinha estorno nem compra no exterior). "Resumo": Saldo Anterior − Total de pagamentos > 0 vira
  "Saldo da fatura anterior"; "Saldo Desta Fatura" vira `r.total`. Vários cartões (titular + adicional) repetem as seções.
- Acesso: no app do iPhone (PWA) cada pessoa cria nome + senha de 6 dígitos no primeiro acesso (tela estilo app de
  banco). A senha fica só no aparelho (`despesas.auth`, PBKDF2 com sal); não dá para recuperar, só apagar os dados e
  recomeçar. Pede de novo ao reabrir o app ou depois de 5 min em segundo plano; "Bloquear app" na tela Você.
  É só a trava local do aparelho; a conta na nuvem é o login do Supabase (seção abaixo), que vem antes.
  Face ID opcional: oferecido depois de criar a senha (ou "Ativar Face ID" na tela Você). Usa uma chave-senha do
  aparelho (WebAuthn, `auth.bio.id`) só como trava local. Com Face ID ativo o app abre na tela do Face ID
  (tenta sozinho; se o iPhone exigir toque, espera o toque); se falhar/cancelar vai para o teclado da senha.
  Nome e ícone pelo aparelho (`BIO`, `bioN()`, `BIO_SVG()`; out/2026, amigo no Android viu "Face ID" e o celular pediu a
  digital): iPhone = Face ID (rosto); Android = "biometria" (ícone de digital); Mac = Touch ID; Windows = Windows Hello.
  Teclado com resposta tátil (`haptic()`: vibrate no Android, switch escondido no iOS 18+). Testado com
  autenticador virtual; o comportamento real depende do iOS no app da tela de início.
- Dinheiro guardado: caixinhas na aba Ano (e bloco no Início), em
  `cfg.save = [{id,name,bank? (onde está o dinheiro, de ALL_BANKS()),goal?,goalCur:"BRL"|"EUR",target?:"AAAA-MM",fxAll?,moves:[{id,date,cents,cur?:"EUR"}]}]`
  (`cents` negativo = tirou). Uma caixinha junta R$ e €; o total converte o € pela cotação do dia.
  `fxAll:true` (só uma caixinha) soma as compras de euro da aba Câmbio. Não entra como despesa/receita do mês.
- Banco da caixinha: sem `bank` escolhido e com `fxAll`, `boxBanks(b)` usa onde ele comprou (o "Onde" das compras da aba
  Moedas reconhecido por `fxPlaceBank`, ex.: "Revolut") e mostra o selo ao lado do nome. A folha de compra tem atalhos
  Wise/Nomad/ARQ/Revolut (`#fxPlaceChips`) que preenchem o "Onde".
- Não existe mais "Meta da viagem" no Câmbio: a meta é a da caixinha com `fxAll`. A migração `migrateSave1()`
  (marca `cfg.save1:"v1"`, idempotente) transformou a meta antiga do aparelho em caixinha; não tem valores no código.
- **Offline:** `sw.js` (gerado pelo build) busca a rede com limite de 2,5 s e cai no cache; fontes e pdf.js ficam em
  `despesas-runtime`, que não é apagado a cada versão. A cotação usa o cache `despesas.rates2`.
- **Parecidos / mesclar** (`similarTo`): mesmo tipo, mesmo cartão (ou nenhum), mesmo mês, mesmo valor (±0,5%) e
  mesma parcela (ou parcela com outro número e nome em comum), ou nome em comum (`nameSim` ≥ 0,5, sobre o maior nome), ou data perto quando um não tem nome.
  Duas compras com `buy` a mais de 3 dias nunca são parecidas. Sinônimos em `SYN` (gasolina/combustível → posto, supermercado → mercado…).
  Lançado à mão com mesmo valor e mesma categoria (≠ outros/cartão) de um item da fatura também é parecido.
  Ao mesclar com item importado fica o **valor do banco** e o **nome/categoria que ele deu**. Usado em: aviso ao lançar à mão ("Mesclar" /
  "Lançar mesmo assim"), importação de fatura (vira "vai mesclar": completa o existente e cria parcelas futuras) e
  seção "Fora da fatura do banco" (itens à mão num mês que tem fatura importada: sugere o par, Mesclar/Apagar, leva
  junto as parcelas seguintes da mesma compra via `group`) e seção "Parecidos" na tela do cartão (`mergePair` fica com o que tem mais informação; "Não são" grava em `cfg.notDup`).
  **Só parcelas andam junto** (`laterSiblings` exige `parc`, out/2026): mesclar/apagar um item de repetição mensal
  (assinatura, `group` sem `parc`) não apaga os meses seguintes. **Mesclar no aviso do lançamento** (`mergeInto` +
  `mergePatchNew`): no item importado fica valor/data/situação do banco e entra nome/categoria; com "repetir" ou
  "parcelar", o 1º mês vira o existente e os seguintes são criados normalmente (antes perdia a repetição e trocava o valor).
  **"Mesclar todos"** (`data-mgall`, 2 toques): no topo de "Fora da fatura do banco" (pares sugeridos) e de "Parecidos", com 2+ pares.
- **Mês = mês em que se paga** (out/2026, pedido dele: "se o vencimento é outubro então é outubro"):
  - Fatura conta no **mês do vencimento** (`dueShift` = 0 sempre); itens importados ficam na data do vencimento (`impDate`).
    Inter (dia 02/10) é outubro, não setembro. Antes, vencimento antes do dia 10 contava no mês anterior.
  - Compra à mão no Crédito com cartão que tem vencimento: `billDate(card, compra)` põe na data de vencimento da fatura em
    que ela cai (fechamento `cfg.cards[c].close`, salvo na importação pela "Data de corte" do Inter / "fechamento" do Pan;
    sem ele, estima vencimento − 8 dias (dia < 10) ou − 16 dias); a data da compra vai em `buy`. O formulário mostra
    "Entra na fatura do X que vence dd/mm" (`dateHint`).
  - **Salário que cai do dia 25 em diante conta no mês seguinte** (`salShift`, cat `sal`): data = dia 1º do mês seguinte e
    `fell` = dia que caiu (aparece "caiu 30/09"). Vale no lançamento à mão e no holerite. Adiantamento (dia 15) não muda.
  - `migrateDue1()` (marca `cfg.due1:"v1"` e `dm1` em cada item, então não move duas vezes nem sincronizando): itens de
    cartão com vencimento antes do dia 10 andam 1 mês para a data do vencimento (compra à mão ganha `buy`); salário do
    fim do mês vai para o dia 1º seguinte.
- Importação de fatura: o mês vem do vencimento (Inter aceita "02/10/2026" e "02 de out. 2026"). Sem vencimento no PDF, `guessDueYM` estima pela compra à vista mais recente e pelo dia de vencimento
  do cartão, e avisa. **Só valem faturas com vencimento a partir de out/2026** (`MIN_DUE` = mês seguinte ao `MIN_YM`); as anteriores são
  só informativas e lançam apenas as parcelas que vencem de out/2026 em diante (`preParcs`), que a fatura seguinte mescla.
  **Histórico** (out/2026, pedido dele: subir a fatura de setembro mesmo já paga e lançada): fatura antiga com mês ≥ `MIN_YM`
  mostra "Lançar a fatura inteira mesmo assim" (`imp.full`, `imp.old`): vira importação normal (mescla com o que já existe,
  próximas parcelas), tudo pago sem `paidAt`, então não mexe no `accBal()`.
  Parcelas sempre normalizadas ("02/04" = "2/4", `normParc`/`sameParc`). "Fatura já paga" (vem marcada se o vencimento
  passou) marca como pagos os meses já vencidos. Aviso se a mesma fatura (`imp` = "fatura-<vencimento>") já foi importada.
  Se o PDF falha, folha "Diagnóstico" copia a estrutura com nomes mascarados; bytes antes do `%PDF-` são ignorados.
- **Passagem aérea em PDF** (22/10/2026, `parsePassagem`/`openPassagem`): no `readInvoice`, PDF sem banco e sem lançamentos de cartão tenta a passagem antes da conta. Exige 2+ datas "dd Mês aaaa hh:mm", a palavra "Tarifa" e uma linha com 4+ valores R$ (o último é o total; confere com a soma dos três anteriores). Calibrado com o PDF real ("Reserva Aérea - Plano de Viagem", agência de turismo/Iberia): `reserva` (ainda não emitida), `until`/`untilHm` (Prazo, sem ano no PDF) e `maxP` (maior "Nx" da "Condição de Pagamento"; as bandeiras são imagens, não dá para ler). Ignora códigos ADT/CHD/INF (tipo de passageiro, não aeroporto). Reserva nasce "A pagar". Não escolhe cartão nem parcelas (o PDF só traz a tabela de opções): abre o lançamento novo já com valor, "Passagem aérea ORI–DES" e categoria Transporte; ele escolhe pagamento e parcelas no formulário normal.
- **Importar PDF único** ("Importar fatura ou conta (PDF)" no topo do novo lançamento e na lista de cartões): `readInvoice(f,true)`
  reconhece o banco e manda para o cartão de mesmo nome (`bankCard` cria o cartão se faltar); sem banco conhecido pergunta
  o cartão (`pickCard`); sem lançamentos de cartão tenta conta (`parseConta`: empresa em `CONTAS`, vencimento e valor
  total) → folha "Conta X" (Casa e contas, data = vencimento, débito automático vira pago). Vencimento antes de out/2026 = só informativo.
  Botão "Colar" ao lado (`pastePdf`, `navigator.clipboard.read` procurando tipo PDF) + evento `paste` com arquivo PDF.
  No iPhone o Safari normalmente só entrega texto/imagem da área de transferência; aí avisa para usar Importar.
- **O que o app já lê** (`READS`/`readsBox()`, na lista de cartões e na tela Você → Importar planilha; também no README): manter em dia
  sempre que calibrar um layout novo.
- **Pagamento de fatura no extrato dá baixa** (out/2026, `billPaidBy`): cartão pelo texto (Realize/Renner → Renner, Pan →
  Pan, senão o cartão do próprio banco do extrato), fatura com vencimento de 5 dias antes a 10 dias depois do pagamento;
  se o valor bate (`closeC`) com o que está em aberto nela → `act:"payBill"` marca todos os itens pagos (`paidAt` = dia do
  pagamento). Não bate (ex.: entrada de parcelamento) → fica de fora com "tem R$ X em aberto (confira no cartão)".
- **Vencimento do cartão vem do banco** (`dueFix`, out/2026): importar fatura (PDF/OFX/Open Finance) e o `ofSync`
  (`balanceDueDate`) trocam o dia digitado à mão e marcam `dueBank`; depois disso só não troca quando o banco só
  empurrou do sáb/dom para a segunda. `close` também vem do `balanceCloseDate` se faltar.
- **Inter, nomes da fatura** (out/2026): "PIX CRED PARCELADO" → "Pix no crédito" (com parcela), "IOF CREDITO PARCELADO" →
  "IOF do Pix no crédito" (taxa); no Open Finance `ofPixWho` casa com o Pix da conta (mesmo dia ±1, total das parcelas
  = 1× a 1,6× o Pix) e vira "<quem recebeu> (Pix no crédito)" (Claro/Vivo/TIM/energia → Casa e contas); prefixo de intermediador ("EBN *", "PAYPAL *") sai do nome; Xsolla (Ubisoft+) → Assinaturas (e em `SUBN`); Steam/PSN/Xbox… → Lazer.
- **Categoria Esporte** (`esporte`, out/2026, pedido dele): academia/Wellhub/Gympass, Decathlon, Centauro, Netshoes, Nike,
  Adidas, Under Armour… (em `invoiceEntry` e no categorizador da planilha). "Magazine"/"Hobby" → Compras.
- **Extrato da conta em PDF** (out/2026): o mesmo "Importar PDF" (e "Extrato (PDF)" no bloco Saldo na conta) tenta
  `parseExtrato` depois do holerite e antes da fatura. Calibrado com o extrato do Inter ("Saldo total", dias "N de Mês de
  AAAA Saldo do dia: R$ X", linhas `Tipo: "detalhe"  valor  saldo`; "Solicitado em dd/mm/aaaa - HHhMM" vira `atTs`).
  Folha `openExtrato`/`extPlan`: saldo do extrato vira o Saldo na conta do banco (`exBal`, desativado se o saldo do app é
  mais novo); só movimentos a partir de `MIN_DUE`; transferência de/para o próprio titular (nome do extrato ou `myName()`),
  investimento (resgate/CDB) e pagamento de fatura/parcelamento ficam de fora; mesmo valor ±3 dias de um lançamento sem
  cartão → "já lançado" ou "marca como pago"; o resto vira lançamento pago (compra no débito → `invoiceEntry` para nome e
  categoria; Pix → "Pix de/para X", Outras receitas/Outros). `imp:"extrato-…"` evita importar de novo; `paidAt`/`createdAt`
  = dia do movimento (antes do `atTs`), então não descontam/somam de novo no `accBal()`.
- **Extrato OFX** (out/2026, para os amigos de qualquer banco): `readOfx` (pelo nome .ofx/.qfx ou pelo conteúdo
  "OFXHEADER"/"<OFX>" dentro do `readInvoice`; os inputs "Importar fatura ou conta" e "Extrato" aceitam OFX). UTF-8, senão
  windows-1252. Banco por BANKID/FID (`OFX_BANKS`) ou ORG. Conta → objeto do `parseExtrato` (MEMO "Tipo - detalhe" como no
  Nubank; "PIX TRANSF FULANO" vira who) → `openExtrato`, saldo de LEDGERBAL/DTASOF. Cartão (`<CCSTMTRS>`) → fatura
  (valor invertido, "- Parcela 2/5" → `parcTag`, pagamentos fora) → `bankCard` + `openImport`.
- **Menos poluição** (out/2026, ele perguntou se tinha coisa demais): Início mostra **uma faixa por vez** (`oneBanner`:
  conta no vermelho > Open Finance > primeiros passos > resumo do mês anterior > backup > compartilhar > instalar). No Ano,
  as 3 primeiras seções ficam abertas e as outras **recolhidas** (`anoFold`/`anoToggle`, título com total, toque abre,
  lembra em `despesas.anoOpen`; abre sozinha se estiver editando salário ou assinatura). "Dividir em duas formas" virou
  **"Pagar com duas formas"** (não confundir com "Dividir com outras pessoas").
- **Primeiro uso guiado** (`onbCard` no topo do Início, depois do "Começar do zero"): 3 passos — saldo na conta, cartões
  (ou "Não uso" → `cfg.onbNoCard`), receita — com ✓ quando feitos; some com tudo feito ou "Pular" (`cfg.onb`).
- **Resumo do mês em imagem** (Mês → "Compartilhar resumo de <mês>", `mesShare`): canvas 1080×1350 nas cores do tema
  (entrou, saiu, sobrou, 6 maiores categorias, juros) → compartilhar do celular (`navigator.share` com arquivo) ou baixar.
- **Ajuda** (`HELP`, `helpLink`/`helpSheet`): "Como funciona esta tela" no fim de cada aba (posto pelo `render()`); no
  lançamento, botão "?" ao lado de Salvar abre a ajuda dentro do formulário (`#lancHelp`, não fecha o que foi digitado).
- **Holerite em PDF** (out/2026): o mesmo "Importar PDF" (no lançamento, vira "Importar holerite (PDF)" quando o tipo é
  Receita) tenta `parseHolerite` antes da fatura. Reconhece "Demonstrativo/Recibo de Pagamento", "Holerite", "Contracheque"
  com "Valor Líquido"; lê por posição (`pdfLines`): líquido abaixo do rótulo, Data Crédito, Mês de Referência, empresa e os
  eventos entre "Proventos | Descontos" e os totais (confere proventos − descontos = líquido). Tipo pelo maior provento:
  Salário, Adiantamento, 13º salário (1ª/2ª parcela), Férias. Folha `openHolerite` → 1 receita `cat:"sal"` na data do crédito,
  `imp:"holerite-<AAAA-MM>-<tipo>"`; avisa se já importado ou parecido (mesmo nome no mês, ou mesmo valor) com
  "Trocar pelo do holerite". Descontos só aparecem para conferir (não viram despesa). Páginas sem "Valor Líquido"
  (ex.: extrato do convênio) não entram no líquido. Calibrado com o layout "Demonstrativo de Pagamento Mensal" (folha + 13º).
  **Convênio:** da página do extrato (linha "Total:" e atendimentos = linha com data + valor; linhas sem valor continuam o
  nome) sai `h.conv={cents,n,from,to,by}`; `convKind` separa Psicólogo / Médico / Pronto-socorro / Exames / Terapias / Outros
  (nome do procedimento + código TUSS). Só vale no holerite que tem desconto de coparticipação/convênio (o do 13º traz o
  mesmo extrato e não desconta). A receita guarda `conv` (centavos) e `convBy:[{k,cents,n}]`; Mês mostra `convTxt` na linha.
- **Salário previsto** (out/2026, pedido dele: "igual assinatura, uma ideia do salário base do que vai vir"): todo holerite
  lido (`openHolerite` → `holLearn`, inclusive os anteriores a `MIN_YM`) fica em `cfg.hol["AAAA-MM|sal|adv"]` (eventos e
  totais). "Importar holerites (PDF)" no Ano aceita vários de uma vez (`readMany`, `pdfPagesOf`). `salPlan()` usa as
  últimas 6 folhas: evento em ≥ 60% dos meses com valor ±5% da mediana = fixo; o resto = varia (média por mês, conta 0 no
  mês em que não veio); adiantamento à parte; INSS/IRRF pela taxa mediana sobre os proventos. `base` = só o fixo,
  `avg` = com a média do que varia. `salVirt(ym)` (só mês atual em diante) cria receitas **virtuais** (`virt`, não são
  lançamentos): "Adiantamento (previsto)" dia 15 e "Salário (previsto)" da folha que cai no fim do mês anterior (conta no
  1º, `fell`); some quando há receita `sal` real do mesmo tipo no mês, ou se a data já passou. Entra em `accFlow`, `endBal`
  (sem saldo), linha do tempo (linha em itálico → Ano) e coluna Entra do Ano (com `*`). Seção `salSection()` no Ano:
  "Não usar / Só o fixo / Com a média" → `cfg.salPrev` ("off"/"base"/padrão média). Precisa de ≥ 2 folhas. Os quadros mostram
  o **total do mês** = adiantamento + folha (pedido dele: "o fixo teria que ser a soma com o adiantamento").
- **Holerites lidos** (out/2026, pedido dele: "trate melhor os holerites"): `holLearn` agora guarda no `cfg.hol` todo holerite lido,
  não só folha/adiantamento: também 13º (`d131`/`d132`) e férias (`fer`), com `kind`, `td`, `emp` e `conv` (até 60). `salPlan` só usa
  `k==="sal"` e ignora os com `x:1`. Seção `holSection()` no Ano (aba Fixos, depois de Salário previsto, id `holSec`): gráfico do
  líquido das últimas 8 folhas (`.hvbar`; `.hbar` já existia no topo), comparação com o mês anterior (`HOL_ROWS`: líquido, proventos,
  descontos, hora extra, sobreaviso, convênio, INSS, IR, faltas; verde = melhor para ele), aviso de meses sem holerite e lista com
  estado de cada um (`holState`: lançado ✓ / parece já lançado / ainda não lançado / antes de `MIN_YM`). Tocar abre `holView`
  (`holFromRec` refaz o objeto do `parseHolerite`): lançar receita (`openHolerite`), "Não usar no salário previsto" (`x`),
  "Apagar dos lidos" (2 toques; não mexe na receita lançada). `readMany` (vários PDFs) abre o resumo `holImportSheet`: novo / já estava /
  atualizado, ignorados, repetidos no lote, "Lançar" em cada um e "Lançar os N que faltam" (`holLaunch`, usa `holData`, a mesma receita
  de `addHolerite`). Dados de teste: nada de valores reais no código.
- **Importar planilha** (out/2026; tela Você → "Importar planilha" e link na tela de boas-vindas, `input.xlsany`): SheetJS
  0.18.5 via cdnjs (`loadXlsx`); CSV lido à mão (`xlCsv`, separador ; , ou tab). Por aba escolhe sozinho: **grade** (`xlGrid`:
  linha com 2+ meses = cabeçalho, bloco até a linha vazia; coluna "pago" ao lado do mês marca pago; ano do 1º mês por
  `xlYear0` com seletor; meses seguintes viram o ano sozinhos) ou **lista** (`xlList`: acha cabeçalho e colunas data/valor/
  descrição/categoria/tipo/cartão por nome e conteúdo; a pessoa troca nos seletores; `cfg.xlsMaps[assinatura]` lembra).
  Pula totais (`XL_SKIP`), fórmulas que citam células (`ref`), linhas sem número. Linha com nome de cartão (`xlCard`) vira
  "Fatura X" (genFat: só conta se o cartão não tem itens no mês). Respeita `MIN_YM`/`MIN_DUE`; já lançado (`xlState`) e
  receita de mês futuro (não pré-lançar salário) ficam desmarcados. Itens levam `xls:<id>` e `xlsKey`; `cfg.xlsLast` →
  "Desfazer importação (N)". Grade junta linhas de mesmo nome entre blocos (`rowOpt` por nome).
- Zerar: "Zerar <mês>" na tela do cartão apaga os itens do cartão no mês + parcelas seguintes das mesmas compras
  (desfazer via `despesas.antesZerarMes`); "Zerar tudo" na tela Você (desfazer na tela de boas-vindas, `despesas.antesZerar`).
  **"Zerar lançamentos e saldo"** (tela Você, `wipeLanc`, out/2026): apaga todos os lançamentos e `cfg.accts` pelo `store`
  (sincroniza); cartões, euro, caixinhas e categorias ficam. Cópia em `despesas.antesZerarLanc` → botão "Desfazer (N)" (`undoLanc`).
- Cor: dentro de um cartão (e na importação) `cardTheme()` troca o verde (`--accent`/`--head`) pela cor do cartão.
- Backup: o Início lembra de exportar quando passa 7 dias sem backup (`cfg.lastBackup`, adiar 2 dias com `cfg.backupSnooze`).
- Botão + (`.fab`): some ao rolar para baixo (`away`), volta só "+" ao rolar para cima ou no fim da página (`compact`),
  completo no topo (`fabScroll`). Cuidado: a classe `.mini` já é a barrinha de progresso.
- Busca (aba Mês, `mq`/`searchHits`): campo no topo procura em todos os meses (≥ `MIN_YM`) por nome, cartão, categoria,
  forma de pagamento ou valor, sem acento; mostra total de gastos/receitas e resultados por mês. O campo fica fixo
  (`mesShell`) e só `#mBody` é redesenhado, para não perder o foco.
- Limite: a partir de 80% de uso (`limPct`/`limTag`) o cartão mostra "% do limite" (laranja) ou "passou do limite" (vermelho)
  no Início, em Cartões e na tela do cartão.
  **Usado** (`usedItems`/`cardUsed`, out/2026): itens em aberto do cartão a partir de `MIN_DUE`, sem os que o banco já
  cobrou no "Saldo da fatura anterior" (`rollGone`). `limBreak` mostra de onde vem (fatura por fatura + "parcelas e faturas
  depois"); fatura vencida em aberto tem **"Já paguei"** (`data-paidbill`) → paga com `paidAt` = dia do vencimento (não
  mexe no saldo da conta de hoje).
  Repetição mensal (`group` sem `parc`: assinatura, conta fixa) só conta até a fatura em aberto (`openBillYM`: 1º mês com
  vencimento ≥ hoje); as dos meses seguintes ainda não foram cobradas (pedido dele, "Netflix só pega o limite naquele mês").
  **Livre pelo banco** (`cardFree`, out/2026): com "livre no banco" informado (`bankFree`, `bankAt`, `bankAtTs`), o livre
  parte dele: compra nova depois daquele dia (`buy` > `bankAt`, ou `createdAt` > `bankAtTs` sem `buy`) e ainda no usado tira;
  item pago depois (`paidAt` > `bankAtTs`) devolve. Motivo: parcelas com juros (parcelamento de fatura, compra parcelada)
  somam mais do que o banco segura (no caso dele, centenas de reais de diferença). A conta pelos lançamentos aparece para comparar e as
  "Parcelas dos meses seguintes" abrem por compra. `limPct`/`limTag`, Início, faixa e lista usam `cardFree`.
- **"+" na tela Contas** (21/10/2026, pedido dele: "o + na contas não funciona"): abre a folha `walAddMenu` (`#walMenu`) com Conta ou saldo / Cartão / Caixinha / Dívida e rola até o formulário escolhido. Antes só abria o formulário de caixinha fora da tela e parecia que não fazia nada.
- **Tema Tostão = padrão** (21/10/2026, pedido dele: "tela de login e base do app na cor do logo"): `data-accent="tostao"` (azul-marinho `#14203A`
  + dourado `#C9A25A`/`#D9B66F` do logo "Um Tostão"; botões dourados com texto marinho; fundo/superfícies azulados no escuro). Sem tema salvo
  vale o Tostão (`applyTheme`/`lookSection`); o verde antigo continua escolhível ("Verde"). Tela da senha mostra o logo (`tostao-logo.png`,
  `.lk-logo`) no lugar do "R$". Ícones do app (`icon-180/192/512.png`, `icon-maskable-512.png`), `theme-color` e manifest vêm do logo (`build_pwa.py`).
- **Nome do app = "Um Tostão"** (21/10/2026, pedido dele): título, manifest, nome na Tela de Início, tela da senha, barra do PC, imagem do resumo e aviso padrão. O nome "Minhas Despesas" só sobra em textos internos (diagnóstico, comentários).
- **Ícones com nome novo** (`tostao-180/192/512.png`, `tostao-maskable-512.png`): o iPhone guarda o ícone da Tela de Início por endereço e só troca ao remover e adicionar o app de novo; nome novo força baixar o ícone certo. Os `icon-*.png` ficam só por compatibilidade.
- **Ícone da Tela de Início embutido** (`ICON180` no `build_pwa.py`): o `apple-touch-icon` vai como data URI dentro do `index.html`, para o iPhone não depender de baixar outro arquivo (apareceu a letra "U" no lugar do logo). A cor da barra de status (`theme-color`) fica marinho enquanto a senha está na tela e volta ao tema ao destravar.
- **Tela da senha fixa no marinho/dourado** (21/10/2026, pedido dele, print com tema Café ficando marrom ao lado do logo): `.lock` redefine
  `--head/--btn/--accent` e fundo em degradê radial, logo 112 px com aro dourado, "MINHAS DESPESAS" em caixa alta pequena, teclado e bolinhas
  com toque dourado. Não segue o tema escolhido (o logo é marinho).
- **Fatura paga → mostra a próxima** (`billShown`, out/2026, pedido dele): no Início (bloco Cartões, "fatura em aberto") e na
  faixa do Mês atual, cartão com a fatura do mês toda paga mostra a próxima com valor ("out paga ✓ · próxima vence dd/mm",
  abre naquele mês).
- Caixinha: cada movimento tem "editar" (tipo, data, valor, moeda, apagar com 2 toques; `svMvEdit`) e "Ver todos".
- Visual: ícone por categoria nas listas (`ICO`/`catIco`, data vai para a linha de baixo); número grande do topo conta até
  o valor (`setBig`); ao trocar de aba as seções sobem e as barras crescem (`animIn` → classe `anim` no body por 1 s);
  `toast(msg,true)` mostra check animado + `haptic()`; topo em cor sólida (o brilho no canto foi tirado a pedido, parecia embaçado) e que passa por trás do
  relógio/Dynamic Island: `header.top` soma `env(safe-area-inset-top)` e `body::before` é uma faixa fixa na cor `--head`
  (o `:root` não tem mais padding-top no `build_pwa.py`). Tudo respeita "Reduzir movimento".
- Início: anel `#hRing` com % da receita do mês já gasta (verde, laranja ≥ 85%, vermelho ≥ 100%; some sem receita).
  Nos 7 primeiros dias do mês aparece o resumo do mês anterior (`recapCard`, some com Ok → `cfg.recapSeen`).
- Confete quando uma caixinha bate a meta (`svCelCheck`, uma vez por "id:meta" em `cfg.svCel`; na 1ª vez só registra as
  já batidas, sem comemorar).
- Cartões: bancos conhecidos (`BANKS`/`bankOf`) vêm com a cor do banco e uma sigla ("Nu", "Itaú", "BB"…; Renner e Revolut só "R", a pedido dele) escrita na
  fonte do app (`cardBadge`). **Não usar logos nem fontes dos bancos** (marcas; repositório e site são públicos; out/2026: ele testou SVGs e achou horríveis, voltou à sigla).
  "Novo cartão" abre com uma grade (`BANK_PICK` + câmbio `FX_PICK`: Wise, Nomad, ARQ (ex-DolarApp), Revolut) que preenche nome e cor;
  "Outro" mostra o campo de nome. Cartão que já existe fica desativado na grade.
  Cores dos bancos tiradas de referências públicas (out/2026). `migrateBankCol1()` (marca `cfg.bankCol1:"v1"`) troca
  só cartões que ainda estavam com a cor padrão antiga do banco; cor escolhida à mão não muda.

## Abas

**Início (abre aqui)**: saldo do mês, o que vence nos próximos 10 dias (contas a pagar e faturas pelo dia de
vencimento do cartão, atrasados em vermelho), cartões, euro com meta e "fôlego" (acumulado em 3 e 6 meses); a ordem desses blocos é editável
("Organizar início", salva em `cfg.homeOrder`) ·
Mês (faixa "Cartões" no topo, `cardStrip()`: um quadrinho por cartão com a fatura do mês, situação e limite livre; rola de
lado no celular; tocar abre a tela do cartão naquele mês. Depois a linha do tempo "Saídas do mês", `timeline()`: faturas na
data de vencimento — tocar também abre a tela do cartão (não expande mais ali) —,
contas na data delas e receitas como +; no mês atual, com Saldo na conta, cada pagamento em aberto mostra "sobra/falta"
depois dele; no fim, "Por categoria": uma linha por categoria com ícone, barra e % (ou "de R$ X" com orçamento) que abre os
lançamentos dela ali (`catOpen`)) · Cartões **não é mais aba** (out/2026): "Ver todos" na faixa de cartões abre a lista (pastas → detalhe com
limite, itens, próximas faturas), com "‹ Mês" para voltar; a barra de baixo tem 4 abas · Moedas (antiga Câmbio; ícone de moeda) ·
Ano (próximos 12 meses com saldo acumulado, gráfico, resumo por categoria, previstos sem data, backup e exportação .csv).
A aba Planilha foi removida a pedido (out/2026). Botão + flutuante muda conforme a aba:
Início/Mês → lançamento; Cartões → novo cartão (ou compra, dentro de um cartão); Moedas → compra de € ou US$; Ano → previsto.
Cartões criados ficam em `cfg.cards[nome] = {color, limit?, due?}` (além dos que vêm dos lançamentos). Duplo toque não dá zoom: `touch-action:manipulation` + viewport `maximum-scale=1,user-scalable=no` (no `build_pwa.py`)
+ guarda em JS que transforma o 2º toque rápido em clique normal e bloqueia a pinça (o iOS no app da tela de início ignora o CSS às vezes).
Botão "‹ Voltar" fica separado do seletor de mês (o Camilo pediu isso explicitamente).

## Cuidados

- **Base única de espaçamento** (27/10/2026, pedido dele: "muita coisa, tudo bagunçado"; 1ª etapa da reorganização, sem mover nada):
  variáveis no topo do `<style>`: `--g-side` 12 (borda da tela), `--g-pad` 16 (respiro do bloco), `--g-gap` (12 celular / 20 PC, entre
  blocos), `--g-top` (12 / 24, do topo até o 1º bloco), `--g-col` 22 (entre colunas no PC). **Não escrever número solto de espaçamento**:
  usar as variáveis. Regras finais no fim do `<style>` ("BASE ÚNICA (fim)"): no PC os blocos só têm margem de baixo (sem somar com a de
  cima) e o topo → 1º bloco é igual em todas as telas. Resultado medido: no celular todo título começa em 28 px e o espaço entre blocos é 12 px
  em todas as telas (Hoje e Mês continuam "sem caixa", mas no mesmo alinhamento); no PC 24 px do topo, 20 px entre blocos, 22 px entre colunas.
  Caixinhas/Dívidas/Pessoas sem o recuo duplo; `.limbr` não estoura mais em 375 px. Teste: medir as bordas e os espaços de todas as telas
  em 320, 375, 440 (claro/escuro) e 1440 antes de publicar mudança visual.

- Nunca rode importações/migrações que possam duplicar dados (já aconteceu). Qualquer ajuste
  de dados deve ser idempotente e marcado em `cfg` (ex.: `personal1:"v1"`).
- Mudanças visuais: testar no tamanho do iPhone antes de publicar, e também em tela pequena (375×667 e 320×568:
  amigos usam iPhone SE/Android). Em telas ≤ 400 px de largura ou ≤ 760 px de altura o + fica redondo ao lado da barra
  de baixo (barra encurta; sem +, volta ao centro) e o teclado da senha encolhe com a altura (`--kb`).
- **Crédito nunca nasce pago com vencimento futuro** (out/2026): lançamento novo no Crédito com data (vencimento da
  fatura) depois de hoje fica a pagar; escolher Crédito desmarca "Pago". `migrateCredPaid1()` (`cfg.credPaid1`) corrigiu
  os já lançados à mão (sem `imp`/`xls`). Desde out/2026 o formulário **nem mostra "Pago / A pagar" no Crédito** (pedido
  dele: quem paga é a fatura): lançamento novo no Crédito sempre nasce a pagar; editar mantém a situação (arrastar ou
  "Já paguei" na fatura mudam).

## Moedas (euro e dólar)

- Compras em `despesas.fx3`: euro = `{eur, brl, date, where, obs}` (formato antigo, sem migração); dólar = `{cur:"USD", usd, brl, …}`.
  Use sempre `fxCurOf(x)`/`fxAmt(x)`/`fxSum(cur)`; `M(c,cur)` formata R$/€/US$.
- Seletor "€ Euro | US$ Dólar" no topo da aba; a moeda vista fica em `localStorage` `despesas.fxCur` (só no aparelho).
  Cotação, preço médio, lista e o botão + seguem a moeda escolhida; a folha de compra tem o mesmo seletor.
- **Cotação na compra** (20/10/2026, pedido dele: "ao informar uma compra, qual cotação utilizada"): a folha de compra tem o campo
  "Cotação usada (R$ por €/US$)" (`#fxRt`) ligado a "recebido" e "R$ pago" (`fxCalc`): os 2 últimos campos mexidos mandam e o 3º sai
  sozinho (campo apagado deixa de mandar; editar abre com eur+brl mandando). Mostra "hoje R$ X (±%)" e o botão "Usar a cotação de hoje"
  (`rateNum`). Nada muda no que é salvo (`eur`/`usd` + `brl`); a cotação é sempre brl ÷ valor.
- **Cotação no "Guardar" da caixinha** (20/10/2026, pedido dele: "cadê os campos que eu pedi?", print da caixinha Dublin): em caixinha com meta em €/US$ o
  formulário de movimento tem "Cotação usada (R$ por €)" (`#svRt`, já vem com a de hoje) e a conta ao vivo (`svEqHint`, `#svEq`).
  Guardar R$ → vira € pela cotação digitada (`svMove`); guardar € → calcula o R$ pago. O movimento fica na moeda da caixinha com
  `brl` (R$) e `rate`, então o valor em € **não oscila** com a cotação do dia; a lista mostra "R$ 1.000,00 a R$ 5,6387". Editar o valor
  de um movimento com `rate` recalcula `brl`; trocar a moeda tira `rate`/`brl`. Sem cotação preenchida = comportamento antigo.
- **Cotação invertida** (20/10/2026): se a cotação usada fica < 0,6× ou > 1,6× a de hoje, `fxCalc` avisa em vermelho; se é o inverso (€ e R$ digitados trocados), aparece o botão `#fxSwap` "Trocar € e R$ de lugar".
- Caixinhas aceitam meta e movimentos em R$, € ou US$ (`svAmt(b,cur)`, `rateNum(cur)`). `fxAll` soma as compras da moeda
  da caixinha (`boxFx`: meta em US$ → dólar; € ou R$ → euro, como antes); uma caixinha por moeda.
- Caixinha com meta e mês-alvo mostra quanto a sobra prevista do mês cobre do que precisa guardar (`svNeedTxt`).

## Leitura

- Textos pequenos um pouco maiores (h2, `.hint`, metas das listas). O aviso "Salvo neste iPhone…" (`#note`) só aparece na tela Você.
- Ano: meses sem nada lançado ficam apagados na tabela (`tr.zero`), menos a coluna do acumulado.
- **Saldo na conta** (bloco `conta` no Início, primeiro da lista): saldo que a pessoa vê no banco, digitado à mão,
  uma ou mais contas em `cfg.accts=[{id,name,cents,at}]` (só no aparelho). O banco é escolhido em `ALL_BANKS()`
  (cartões dele + `BANK_PICK` + `FX_PICK`, com o selo de cada banco); "Outro banco…" vira campo de texto. Mostra "Falta pagar em <mês>" (despesas
  não pagas do mês atual, igual ao cabeçalho) e "Sobra depois de pagar" / "Vai faltar". Avisa se o saldo tem mais de 3 dias.
- **Moedas:** o seletor € Euro / US$ Dólar fica no canto superior direito do cabeçalho (`#hFxSeg`, na linha do título), não no corpo.
- **Categorias de despesa:** criar (tela Você → "Categorias de despesa", ou "+ Nova" nos chips do lançamento) e apagar.
  Criadas em `cfg.cats=[{k:"u_…",n,c}]`, padrão apagadas em `cfg.catHide`; `applyCats()` monta `CATS.desp` a cada render.
  Faturas de cartão, Câmbio e Outros não podem ser apagadas. Apagar move os lançamentos para "outros".
- **Animações:** seletores `.seg`/`.segc`/`.hseg` têm pílula (`.segpill`; não usar `.pill`, que é outra coisa) que desliza (`syncPills`, MutationObserver; lembra a posição
  anterior em `pillPos` mesmo quando a tela é redesenhada). Troca euro↔dólar e setas de mês fazem o conteúdo entrar
  de lado (`slideIn`). O número grande anima também quando muda o símbolo. Tudo desliga com "reduzir movimento".
- **Aparência** (tela Você → `lookSection()`): foto da pessoa (`despesas.photo`, recortada em quadrado 320 px JPEG, `photoPick`)
  e tema de cor (`despesas.theme` → `data-accent` no `<html>`, troca `--head`/`--accent`; lista em **Temas** abaixo;
  `applyTheme()` roda no início do script). Só no aparelho, fora do backup. A foto (ou a inicial do nome, `myName()`)
  aparece no fim da barra de baixo (`#tabAv`, abre a tela Você) e na tela de entrada.
  Cuidado: `userName()` já existe (é o @usuário de compartilhamento), não confundir.
- **Benefícios (VR/VA) são cartões** (out/2026, "do jeito dos outros"): "Novo cartão" tem a grade "Vale-refeição e
  alimentação" (`BEN_PICK`: Alelo, Pluxee, VR, Ticket, Flash, Caju) com saldo hoje, crédito por mês e dia do crédito →
  `cfg.cards[nome]={color,kind:"ben",bal,credit,bday,at,atTs}`. `bens()` lê esses cartões; `migrateBen1()` (marca
  `cfg.ben1`) moveu o antigo `cfg.bens`. Saldo = `bal` em `at` + créditos (`benCredits`) − compras com `pay` = nome
  (`benBal`). Crédito = **dias úteis × valor por dia** (`daily`; `bizDays`: seg–sex menos feriados nacionais fixos e
  Sexta-feira Santa); crédito que cai do dia 15 em diante vale para o mês seguinte (`benCreditYM`). Conferido com o extrato real dele (valores no Projeto, não aqui). `credit` fixo só para cartão antigo sem `daily`. Na lista "Seus cartões" mostra o saldo; a tela do cartão (`benDetail`) tem Atualizar saldo, compras do mês
  e apagar; o + lança compra já com esse pagamento. `credCards()` = cartões sem benefício (use nos lugares de fatura/crédito).
  Compras com benefício ficam pagas, entram nas categorias mas **não** em `sumT` nem na linha do tempo; o Mês mostra
  "Pago com <cartão>" e o Início tem o bloco `bens` (só aparece se houver).
- **Editar lançamento de cartão** (21/10/2026, `editBill`): trocar de cartão ou passar para/de Crédito refaz a fatura a partir da data da compra (`buy`): Pix→Crédito vai para o vencimento, Crédito→Pix volta para a data da compra, cartão A→B usa o vencimento de B. Data mexida à mão em item que já era de cartão vale como digitada. O aviso "Entra na fatura…" aparece também ao editar. Parcelas/repetição em cartão com vencimento dia 30 ou 31 não viram "último dia do mês" (`endOfMonth` só sem cartão).
- **"+" dentro do cartão** (21/10/2026, `cardBuyDate`): o mês que se vê é o do vencimento da fatura, então a data padrão da compra não é o dia 1º dele (caía na fatura seguinte): é hoje, se hoje cabe naquele ciclo ou a fatura já fechou; fatura futura → 1º dia do ciclo dela. Cartão sem vencimento: como antes.
- **Pagar com duas formas** ("+ Pagar com duas formas" no lançamento novo, só "Só uma vez"): cria 2 lançamentos com o mesmo
  `group` ("s…"), a 2ª parte com outra forma (e cartão, se Crédito); o resto fica na forma principal.
  **Cada parte acerta a própria data e situação** (`fitPart`, 21/10/2026): parte no Crédito vai para o vencimento da fatura do cartão dela (`buy` = data da compra) e nasce a pagar; parte à vista fica na data da compra e vem paga se já passou.
- **Barra de baixo** (out/2026, pedido dele com print do Instagram): cápsula flutuante de vidro (`backdrop-filter`, cor do
  `--head` do tema), só ícones, pílula clara que desliza até a aba ativa (`--ti` no `nav.tabs`, setado em `go()`), e a
  foto da pessoa no fim (`#tabAv` → tela Você). A foto saiu do topo do Início (`#hAv` fica sempre escondido).
  `.fab` e `.toast` ficam acima da cápsula.
- **Temas** (Aparência): Sóbrios (verde, meia-noite, bordô, petróleo, oliva, café) e Vivos (ameixa, azul, roxo, laranja,
  rosa, grafite), mais **Sua foto** (`photoColor()` tira a cor dominante ao escolher a foto → `despesas.photoColor`; aparece
  um convite "Combinar o app com a cor da sua foto?") e **Cor livre** (`<input type=color>` → `despesas.themeColor`).
  Fundo, cartões, linhas, chips e textos apagados (`--bg/--surface/--zebra/--line/--chip/--muted/--ink`) seguem o tema
  (out/2026, ele achou o fundo verde destoando do topo meia-noite): `color-mix` do `--head` num neutro para todo
  `[data-accent]` ≠ verde (claro e escuro); o verde padrão mantém os tons originais.
  Os dois últimos usam `genTheme(hex)` → `<style id="thCustom">` com `data-accent="gen"`. Claro/Escuro/Automático em
  `despesas.mode` (vira `data-theme` no `<html>`). Tudo no `applyTheme()`.
  **Cor dos botões** (`--btn`/`--btn-ink`, out/2026): botão +, Salvar (`.btn.primary`), `.tbtn.go`, foto da barra e tela da
  senha usam `--btn` (padrão = `--accent`). Meia-noite escuro tem botão azul firme `#3A5FC2` com texto branco (o
  `--accent` claro `#7F9BD8` ficava lavado; ele: "feio que dói"). `cardTheme()` volta `--btn` para o `--accent` do cartão.
- **Vidro v3** (out/2026; a v1 foi desfeita pela faixa no topo e brilho nos campos; a v2 ele achou "falsa", com reflexo
  forte no canto): só nos elementos que flutuam — barra de baixo, pílula da aba ativa e botão +. Mais perto do Liquid
  Glass do iOS: tinta leve do `--head`/`--btn` (`--glass-t`/`--glass-b`: 46%/74% no escuro, 64%/88% no claro para os
  ícones brancos lerem), desfoque 12px com saturação e brilho, borda de luz fina e igual em volta (0,5px), sem reflexo
  no canto e sem degradê. Mantém o "gel" (cresce ao tocar e volta com mola). Campos, janelas e topo continuam sólidos.
- **Saldo na conta acompanha** (out/2026): ao marcar despesa como paga grava `paidAt` (`paidPatch`); `accBal()` = saldo
  informado − despesas pagas depois (`paidAt` > `atTs` do saldo, sem benefício) + receitas lançadas depois (`createdAt`).
  Compra nova no Crédito não desconta (só quando a fatura/itens são marcados pagos). Linha do tempo usa `accBal()`.
- **Saldos interligados** (out/2026, pedido dele: "precisam estar interligados"): com Saldo na conta, tudo parte de
  `accBal()`. `accFlow(ym)` = o que ainda mexe na conta naquele mês: receitas que ainda não caíram (`recDay(x)` = `fell`
  ou `date` > hoje) e despesas não pagas (sem benefício); no mês atual entram também atrasados de meses anteriores
  (data ≥ `MIN_DUE`). `endBal(ym)` = conta hoje + Σ(entra − sai) até o fim de `ym` (sem saldo: Σ receitas − despesas, como antes).
  Usado em: número grande do Início ("Na conta no fim de <mês>", s1 "Na conta hoje"), bloco Saldo na conta ("Ainda entra",
  "Falta pagar", "Sobra no fim", botão "Fim de <próximo>"), rodapé do Mês, linha do tempo (soma receitas futuras, "fica"),
  previsão "fecha na conta com", Fôlego e Ano (coluna "Na conta" com linha "Hoje"; no Resumo, "Na conta no fim").
  **Mês encadeado:** no Mês atual e nos futuros o número grande é `endBal(view)` ("Na conta no fim de <mês>" / sem saldo
  "Saldo no fim de <mês>"), rodapé "vem de <mês anterior>"; meses futuros também têm linha do tempo com "Vem de <mês>"
  (começa em `endBal(mês anterior)`, que já tira o que ficou a pagar). Meses passados continuam receitas − despesas.
  **Fatura não paga vai para a próxima** (out/2026, pedido dele com a do Pan): item de cartão de crédito não pago com data
  (vencimento) já passada e ≥ `MIN_DUE` → `rollYM(x)` = mês da próxima fatura do cartão que ainda não venceu. Conta lá
  (`rolledIn`/`rollAmt`: `accFlow`, linha do tempo "inclui R$ X da fatura anterior não paga", faixa de cartões, tela do
  cartão, "Vence nos próximos 10 dias", que agora olha também o mês seguinte); no mês de origem aparece "não paga · foi
  para a fatura de <mês>" e não desconta. Se a fatura de destino já tem "Saldo da fatura anterior" importado
  (`isPrevBal`), o banco já cobrou ali: `rollGone` → a antiga não conta de novo. Marcar como paga desfaz.
  `accMoves` usa `recDay` (salário que caiu 30/09 com data 01/10 já está na conta).
- **Avisos de vencimento** (Web Push, out/2026, pedido dele: "app de verdade" sem gastar): `PUSH_URL` = Worker do Cloudflare
  (`tools/push-worker.js`, plano grátis: KV `AVISOS` + cron `*/15 * * * *`; VAPID criada no próprio KV na 1ª chamada).
  Vazio = seção escondida. Tela Você → `pushSection()`: Ativar (`pushOn`, pede permissão no toque), horário
  (`PUSH_HOURS`), "Mostrar valores", teste, desligar. `pushPlan()` usa `upcoming(31)`: por dia com conta/fatura em
  aberto → véspera, no dia e dia seguinte, no horário (`despesas.push` = {on,h,v,hash,at,n,next,err,vk}, só no aparelho).
  `pushEnc` criptografa cada aviso no aparelho (RFC 8291, aes128gcm): o Worker só guarda endpoint + horário + bytes
  cifrados. `pushSync` reenvia quando o plano muda (hash) ou a cada 2 dias; roda 2 s depois do `render` e ao voltar.
  `sw.js` (no `build_pwa.py`) tem `push` e `notificationclick`. iPhone: só no app da tela de início (iOS 16.4+).
  **Caixa de avisos** (out/2026, pedido dele: "botão pra ler as notificações" e "abrir exatamente onde chegou"): sininho
  `#hBell` no topo do Início (com número de não lidos, `bellUpdate()` no `header()`) → folha `avSheet()` (no `diagSheet`),
  abrir marca tudo como lido. Log em `despesas.pushLog` (`avLogPlan` no `pushSync`: o plano todo + o que já passou, 60 dias,
  120 itens; só aparece o que já passou da hora). Cada aviso leva `k` ("venc-AAAA-MM-DD|-1/0/1") e `go`: `{c,ym}` tela do
  cartão, `{id}` abre o lançamento (no Mês dele), `{home:1}` Início no bloco Vence, `{me:1}` (teste) tela Você → `avGo`.
  Toque na notificação: o `sw.js` grava a chave no cache `despesas-av` (fica fora da limpeza de versão) e manda
  `postMessage`; o app lê em `avCheck()` (ao abrir, ao voltar e na mensagem) e espera destravar a senha antes de ir.
  `pushClear()` tira da Central de Notificações os avisos já mostrados quando o app abre.
- **Open Finance** (out/2026, 1ª etapa): Meu Pluggy (grátis para projeto pessoal; conector `OF_MEU` = 200). As chaves
  da Pluggy ficam num Worker do Cloudflare do próprio usuário (`tools/pluggy-worker.js`: secrets CLIENT_ID, CLIENT_SECRET,
  APP_KEY; rotas /token, /item, /accounts, /transactions, /bills, todas pedem `x-app-key`; erro da Pluggy em /transactions
  (usa `/v2/transactions` com cursor `after`; o antigo foi desativado) volta como `error`, não lista vazia). Tela Você → `ofSection()`: endereço
  do Worker + APP_KEY em `despesas.of` (fora do backup, do repo e da nuvem: não está em `SYNC_PREFS`; em outro aparelho, preencher de novo) → "Conectar banco" abre o widget
  (`pluggy-connect` latest via cdn.pluggy.ai, só o MeuPluggy) e guarda o `item.id`. **Sem "Reconectar"** (out/2026): item do
  Meu Pluggy não atualiza pelo widget (fica parado no aviso); só 1x por dia, na hora da Pluggy. `ofItemTxt` mostra
  "Atualizado pelo banco em … · próxima atualização …" (`/item`: `lastUpdatedAt`, `nextAutoSyncAt`, `status`); Worker antigo
  sem `/item` → pede para publicar de novo. "Ver dados" mostra contas e
  movimentos dos últimos 45 dias (lista de cada conta recolhida: "Ver N"/"Esconder", `ofOpenAcc`) e "Copiar dados para o Claude" copia o JSON (para calibrar outro banco).
  **Importar** (out/2026, calibrado com o JSON do Inter): conta → `ofExtrato` monta o mesmo objeto do `parseExtrato` e abre
  `openExtrato` (saldo da Pluggy vira Saldo na conta; "Tipo - detalhe"; "Compra no débito" = loja nos 22 primeiros
  caracteres (`ofShop`, largura fixa: depois vem a cidade); `category` "Same person transfer" → `r.self`; "Crédito liberado
  - Pix No Crédito" e o Pix de mesmo valor e hora → `r.pixCred`, fora (vai na fatura); fatura/Realize/"Credit card payment"
  → "Pagamento de fatura", fora). Cartão → `ofFatura`: só movimentos **sem `billId`** (fatura em aberto), vencimento =
  `balanceDueDate` + 1 mês, parcela de `creditCardMetadata` → `parcTag`; `bankCard` + `openImport` (mesma conferência e
  mesclagem do PDF). Banco pelo nome da conta corrente do item ("BANCO INTER" → Inter). Datas da Pluggy em UTC → dia local.
  **Saldo e limite automáticos** (`ofSync`, a cada busca): `balance` da conta vira o Saldo na conta do banco e
  `availableCreditLimit` vira o `bankFree` do cartão (só cartão que já existe; `limit` se faltar), com `at`/`bankAtTs` = hora
  em que o banco atualizou (`ofUpdTs`: `lastUpdatedAt` do `/item`), só se for mais novo que o que está no app.
  **Busca sozinha** (`ofAuto`: ao carregar e ao voltar ao app, no máximo a cada 30 min, `despesas.ofAuto` = {chk, seen}):
  se `lastUpdatedAt` ≠ visto, busca, roda `ofSync` e conta o que falta (`ofCount`: extPlan marcados + itens da fatura sem
  parecido) → faixa no topo do Início (`ofBanner`, "Importar conta"/"Importar fatura"/"Agora não"). Visto (`ofSeen`) ao
  importar pela faixa, dispensar ou "Buscar de novo".
- **Evolução do saldo** (gráfico no Início): feito e **tirado** em out/2026 a pedido dele ("não gostei"). Não recolocar.
- **Início no computador** (out/2026, pedido dele: "redesenhar por completo"): `renderHome` com `IS_WIDE` (matchMedia
  ≥ 980 px, redesenha ao cruzar) monta painel fixo tipo Meu Pluggy (`.hdash`): em cima 3 quadros do mesmo tamanho
  (`.htop`: Saldo na conta, Cartões, Dinheiro guardado); embaixo outra linha igual (`.htop.hlow`: Vence, Benefícios, Euro,
  lado a lado). Feito para caber sem rolar num 1440×900 (pedido dele, "parte pra descer"): topo do Início mais baixo,
  rodapé numa linha só (Posso comprar? · Organizar início · Como funciona), `.wrap` sem `min-height` no PC e botão +
  redondo no canto (não cobre os quadros). No PC a ordem do "Organizar início" não vale; no celular continua. Só no PC (`.pconly`):
  resumo dos cartões no topo do bloco (% do limite usado, limite, usado, livre via `cardFree`) e caixinhas com barra.
  Topo de todas as abas no PC: número grande à esquerda e os 2 valores à direita na mesma linha. `renderHome` põe o
  `helpLink` ele mesmo.
- **Visual simples** (out/2026, pedido dele: "simplificar o visual completo", visual + menos coisa; manteve topo na cor do
  tema, barra de vidro, temas e animações): bloco CSS "visual simples" no fim do `<style>` — sem caixas dentro de caixas
  (`.split` do topo e `.rate .cmp` viram linhas com divisória), bordas mais leves, `.dchip` sem quadradinho, `.tbtn` sem
  borda, rodapés ("Como funciona", "Posso comprar?") como link. Textos de explicação: `p.hint` direto nas seções de
  Início/Mês/Ano/Moedas escondidos (menos os com `neg` no estilo) e classe `.expl` (escondida) nos textos fixos da tela do
  cartão; `.tlproj small` escondido. **Fôlego saiu do Início** (o gráfico Evolução já mostra). Saldo na conta: Extrato e
  Atualizar viraram links no título (`h2 .h2act`), sem o botão "Fim de <próximo>". Ano: sem a coluna Saldo quando há
  Saldo na conta. **Você** recolhe as seções como o Ano (`FOLD`/`anoFold(pid)`: tudo recolhido, Aparência inclusive, `despesas.meOpen`);
  `renderAno`/`renderMe` chamam o `anoFold` no fim.
- **Banco limpo** (out/2026, ele não estava convencido do visual; escolheu "banco limpo", incomodava informação demais e
  caixas): bloco CSS "banco limpo" no fim do `<style>`. Fundo neutro quase preto (só ~10% da cor do tema; claro quase
  branco), cor forte só no topo e nos destaques; títulos `h2` em frase normal (sem caixa alta). No celular (≤ 979 px) as
  listas do Início e do Mês ficam direto no fundo (sem caixa), seções separadas por linha fina. Início: topo sem o anel de
  % e sem a frase com data (`hFoot` só avisa gastos > receitas); "Na conta" é uma linha por banco (`.acone`; ainda entra/
  falta/sobra já estão no topo; no PC continua o bloco completo); Euro some sem compra nem meta. Mês: rodapé do topo sem
  "na conta hoje"/"a pagar" (estão na linha do tempo); `.tlbal`/`.tlproj` sem caixa; "sobra R$ X" em cinza.
- **Novo app: Hoje / Mês / Planejar** (out/2026, desenho aprovado por ele no canvas "Minhas Despesas — novo app"):
  barra de baixo com **3 abas** (Hoje = `pHome`, Mês, Planejar = `pAno`) + foto; **Moedas saiu da barra** e abre pelo
  Planejar (seção "Euro e dólar", `fxRowSection`) — `pFx` continua igual (atalho 5) e acende a aba Planejar.
  Topo do **Hoje**: "Na conta hoje" (`accBal()`; sem saldo, "Saldo de <mês>") e, no celular, a barra do mês `#hBar`
  (pago / a pagar / entrou, "fim do mês" = `endBal`, ou "sobra"). Corpo no celular (`renderHome`, sem "Organizar
  início"): faixa única (backup vira uma linha, `.bline`), `hojeList()` = próximos pagamentos até o fim do mês (mín. 10
  dias) + receitas que ainda caem (inclui `salVirt`), `hojeCards()` = cartões em quadros com limite livre (`.htile`;
  benefícios com saldo), "Na conta" e Dinheiro guardado. No PC continua o painel. **Mês**: topo "Gastou em <mês>"
  (`hFoot` "de R$ X que entrou · sobra R$ Y"); no celular sem faixa de cartões, categorias numa barra com as 3 maiores
  (`.catsum`, "Todas as categorias" → `catAll`). **Planejar**: topo "Na conta no fim de <mês+5>" com 6 barras de
  `endBal` (`.hbchart`), sem seletor de ano no celular; ordem caixinhas → Euro e dólar → próximos meses; listas sem caixa.
- **Moedas refeita** (out/2026, ele: "ficou bem ruim a parte das moedas"): `renderFx` sem tabela e sem cartão de cotação —
  linha "€ 1 = R$ X" com "Atualizar" (`#rateRefresh`) e "acima/abaixo do seu médio", compras como lista `.due.fxrow`
  (data, onde, R$ pago · a R$ cotação, valor em €) e total com o médio. Topo: título só "Moedas", "<Moeda> que você tem",
  "Vale hoje" (× cotação) / "Você pagou", barra da meta da caixinha. Botão "‹ Planejar" volta (`backBtn` com `pFx`).
  No Planejar, seção "Moedas" (`fxRowSection`): uma linha por moeda (euro sempre, dólar se tiver compra) com
  `data-fxgo` → troca `fxCur` e abre `pFx`. Caixinha não repete "inclui as compras" nem os bancos no texto (selo já mostra).
- **Instalar app** (out/2026, `installBanner()` no topo do Início, só fora do app instalado): Android/Chrome guarda o
  `beforeinstallprompt` (`instEvt`) → botão "Instalar" (vira WebAPK; não precisa de APK/Play Store); iPhone (`IS_IOS`) →
  passo a passo Compartilhar → Adicionar à Tela de Início e, se já tem lançamentos, pede backup antes (no iPhone o app
  instalado tem armazenamento separado do Safari). "Agora não" esconde por 14 dias (`despesas.instHide`).
- **Arrastar para a esquerda** um lançamento (`.item`/`.tlrow`, despesa fora de benefício) marca pago ↔ a pagar
  (`swipeJust` evita abrir o lançamento logo depois). Direita continua sendo "voltar".
- **Número no ícone** (`appBadge`, `navigator.setAppBadge`): avisos ainda não abertos, **igual ao sininho** (`avUnread`; out/2026,
  ele via "1" no ícone e a lista de avisos vazia — antes contava vencimentos em 3 dias). O `sw.js` soma 1 a cada push
  (contador `n` no cache `despesas-av`, que o app regrava ao recalcular); abrir a lista zera.
- **Previsão** no Mês atual (`.tlproj`): receitas − despesas lançadas − ritmo diário dos gastos do dia a dia (sem cartão,
  parcela, grupo ou categorias fixas) até o fim do mês. Vale: `benRunOut` (média dos últimos 14 dias) → "acaba em dd/mm".
- **Juros, IOF e tarifas** (out/2026, pedido dele): `isFee` (`FEE_RE`: IOF, Juros, Encargos, Multa, Tarifa, Anuidade, Aval,
  rotativo, mora no nome). Mês → `feeSection(view)` depois de "Por categoria"; Ano → `feeYear(year)` (barra por mês até hoje).
- **Assinaturas** (Ano, `subSection`): `subOf(x)` = nome conhecido em `SUBN` (YouTube, Google One, Apple, Prime, Udemy,
  Patreon, Netflix…) ou cat `assin`, sem parcela; últimos 3 meses + próximo. Valor = soma do mês mais recente; mostra /mês,
  /ano e "fatura X de <mês>". **Divisão** (assinatura dividida com pessoas que pagam a parte por Pix): tocar abre
  "dividido entre quantas pessoas, contando você" (pedido dele: valor ÷ pessoas) → `cfg.subShare[nome]={n: pessoas − 1, c: valor ÷ pessoas}`;
  **Valor por pessoa** (out/2026, ele: Gympass "não é o mesmo valor pra todo"): no editor, "Todos iguais | Valor por pessoa"
  (`subMode`, `subRows`, `subEditor`); por pessoa grava `p:[{nm,c}]` (n = quantas, c = média). `shParts`/`shBack`/`shMatch`
  (casa pelo nome do Pix com `nmSame`, depois só pelo valor) valem nos dois jeitos; `subShareOf(cents,who)` no extrato;
  cobrança no WhatsApp com o valor de cada um (`shOwe`); quem tem nome e não pagou no mês aparece em "Faltam".
  Pix com arredondamento (8,99 para 8,98) conta: `shareK` aceita até 3 centavos por parte; mostra "sai R$ X para você" e quantos pagaram no mês (receitas = 1–3 × c).
  Na importação do extrato, Pix recebido de 1–3 × c vira "<assinatura> (divisão) · Fulano", cat de receita `divid`
  ("Divisões", `subShareOf`). `recurSection` não repete o que é assinatura.
- **Meta no ritmo** (caixinha com meta e mês-alvo, `svPace`): linha reta do 1º movimento (ou compra de moeda com `fxAll`)
  até o alvo; "no ritmo ✓" / "adiantada X" / "atrasada X" na linha da caixinha; aberta, diz quanto guardar por mês para recuperar.
- **Saindo do parcelamento** (tela do cartão, `parcSection`/`parcPlan`): parcelas em aberto do mês atual em diante,
  separando parcelamento da fatura (cat `cartao`/"Juros parcelado") de compras parceladas; quando cada um termina, mês em
  que a fatura volta ao normal e juros/IOF/tarifas do cartão nos últimos 3 meses.
- **Despesa dividida** (out/2026, pedido dele: "serve pra despesas também", ex.: Airbnb parcelado em 5 pessoas): campo
  "Dividir com outras pessoas" no lançamento (`#divN`, quantas contando ele) → `x.div`; numa compra parcelada vale para
  todas as parcelas (`buySeries`: mesmo `group`, ou mesmo cartão + nome + nº de parcelas + valor). Lista mostra "÷N, sua
  parte R$ X". Ano → "Contas divididas" (`divSection`/`divList`): cada um R$ (total ÷ N, e por parcela), recebido
  (receitas `divid` "<nome> (divisão)…") e quanto falta, com "Cobrar no WhatsApp". Extrato: Pix de 1–3 × a parte da
  parcela ou da parte inteira (`divShareOf`, depois de `subShareOf`) vira "<nome> (divisão) · Fulano". Totais do mês
  continuam cheios (sai inteiro; a devolução entra como receita).
- **Cobrar a divisão** (assinatura aberta no painel): `subPayers` olha os Pix/receitas de 1–3 × valor dos últimos 3 meses
  (nome depois de "·" ou de "Pix de") → "Pagaram / Faltam" no mês e botão "Cobrar X no WhatsApp" (`wa.me/?text=`, mensagem pronta).
- **Categoria aprendida** (`catLearnSet`/`catLearnGet`, `cfg.catLearn["desp|nome"]`): editar um lançamento trocando a
  categoria grava o nome; `invoiceEntry` (fatura, Open Finance) e `extPlan` (extrato) usam a aprendida (IOF/juros não).
- **Posso comprar?** (botão no fim do Início, `canBuySheet`): valor, parcelas e cartão ou Débito/Pix → limite livre
  antes/depois (`cardFree`), fatura de cada mês (`cardTotal` + parcela, a partir de `billDate`) e `endBal` antes/depois;
  avisa se passa do limite ou se a conta fica negativa. Só simula.
- **Conta no vermelho** (`negDay`): com Saldo na conta, `accBal()` + receitas que ainda caem (inclui `salVirt`) −
  `upcoming(31)`, dia a dia; 1º dia negativo → faixa no Início (`negBanner`, até 15 dias) e aviso 2 dias antes.
- **Avisos extras** (`pushExtra` no `pushPlan`): conta no vermelho; orçamento (`cfg.budgets`) a 80% e 100% no mês;
  resumo do mês no dia 1º às H h (entrou, saiu, 3 maiores categorias, juros). Avisos "agora" usam `pushOnceT`
  (`despesas.pushOnce`: hora gravada na 1ª vez, para o plano não mudar a cada conta). `avGo` aceita `{mes:ym}`.
- **Aumento, 13º e férias** (Salário previsto → "Aumento, 13º e férias", `salXHtml`): `cfg.salRaise={from (folha), gross?, net?}`
  → `salAdj(P,ref)`: bruto novo troca o evento de salário (HORAS NORMAIS/SALÁRIO…) no fixo, adiantamento na mesma
  proporção, descontos pela taxa de hoje; ou líquido do mês direto. `salVirt` usa na folha ≥ `from` (salário cai no mês
  seguinte) e no adiantamento do mês ≥ `from`. `cfg.salX={d13?, fer?}`: "13º salário, 2ª parcela (previsto)" em 20/12
  (`sal13`: fixo − 1ª parcela lançada − descontos, ou o valor dele) e "Terço de férias (previsto)" no mês escolhido.
- **Gastos que se repetem** (Ano, `recurSection`): mesmo nome em ≥ 2 dos últimos 4 meses com valor ±15% → lista com
  total por mês e por ano. Backup mostra "Último backup: há N dias" (já salvava pela tela de compartilhar do iPhone).
- **Conta e sincronização no Supabase** (27/10/2026, pedido dele: "quero pôr o Supabase na versão nova, tal qual estava na anterior"; a
  versão com Supabase/React ficou na branch `novo-tostao-21-10`, isto aqui é o app antigo com o mesmo login). **Substituiu a sincronização
  pelo Google Drive** (código do Drive removido; o cliente OAuth do Google Cloud é o mesmo que o Supabase usa no "Entrar com o Google").
  - **Login obrigatório no PWA** (`PWA&&!sbSes()` → `showAuth()`, overlay `#auth` na paleta marinho/dourado da tela da senha, z-index acima de
    `#lock`): e-mail + senha (`authGo`, `sbAuth` → `/auth/v1/token`, `/signup`) ou Google (`/auth/v1/authorize?provider=google&redirect_to=<app>`;
    volta com `#access_token=…&refresh_token=…`, lido por `SB_BACK` antes de tudo, `sbFinish`). Sessão em `despesas.sb` ({at,rt,exp,uid,email}),
    renovada sozinha em `sbTok`; refresh recusado (4xx) limpa a sessão e reabre o login. A senha de 6 dígitos/Face ID continuam como trava
    local do aparelho (vem **depois** do login; no 1º acesso o "name" pede nome e PIN).
  - **Auditoria do login** (27/10/2026): `sbTok` renova uma vez por vez (`sbTok.p`; duas renovações juntas gastavam o mesmo refresh_token e
    derrubavam o login) e só desloga em 400/401/403 (429 não). Cadastro: `redirect_to` no signup (link do e-mail volta ao app; `SB_BACK` entra),
    e-mail que já existe com "confirmar e-mail" ligado vem 200 com `identities` vazio → "já tem conta". Mensagens: `over_email_send_rate_limit`
    (limite de e-mails do Supabase, causa comum de "não deixa criar conta"), 5xx com texto do servidor. **Esqueci a senha** (`authForgot` →
    `/auth/v1/recover`; o link volta com `type=recovery` → `newPassForm`/`authSetPw`, PUT `/auth/v1/user`). `authGo.busy` evita toque duplo.
    **Formas de entrar** (Você → Conta e sincronização, `idHtml`/`idLoad`/`idLink`/`idSavePw`): lê `/auth/v1/user` (`app_metadata.providers`) e mostra E-mail e senha / Google / Apple com ✓; "Vincular" chama `GET /auth/v1/user/identities/authorize` (precisa de *Allow manual linking* ligado no Supabase) e volta pelo `SB_BACK`; "Criar/Trocar senha" = PUT `/auth/v1/user`. Sem desvincular. O Supabase também junta sozinho contas com o mesmo e-mail verificado.
    **Entrar com a Apple** (27/10/2026, `#auApple`): mesmo fluxo do Google (`/auth/v1/authorize?provider=apple`, volta pelo `SB_BACK`); precisa do provedor Apple ligado no Supabase (Services ID, Team ID, Key ID e chave .p8 da conta Apple Developer).
  - URL do projeto e chave *publishable* (`SB_URL`, `SB_KEY`) ficam no código (públicas por desenho). **Nunca** senha do banco, `service_role`
    ou chave secreta do Google no repositório.
  - **Tabela** `sync_rows` (esquema em `supabase/sync.sql`, ele roda uma vez no SQL Editor): `user_id`, `kind`, `id`, `data` ({"v": valor}),
    PK (user_id, kind, id), RLS por `auth.uid()`. `kind`: `i` lançamento, `f` compra de moeda, `c` chave do cfg, `p` foto/tema, `d` lápide,
    `m` (id `dev`) = quem enviou por último. Sem a tabela: erro claro na seção ("rodar supabase/sync.sql") e a seção abre sozinha.
  - **`syncNow`** (mesma junção em 3 vias de antes, só o transporte mudou): lê todas as linhas (`sbGetAll`, páginas de 1000), junta com a base
    `despesas.sbBase` (hash por item/chave; quem mudou desde a base vence; os dois → este aparelho; 1ª vez → nuvem), grava só o que
    mudou (`sbUp` em lotes, `sbDel` por `kind`+ids) e atualiza base, lápides (`despesas.syncDel`, 180 dias) e `syncMeta`. Roda 3 s depois de
    gravar (`_emit`), ao abrir/voltar ao app, ao voltar a internet, ao sair da aba (`syFlush`) e a cada 2 min. Se os dados mudaram enquanto a
    nuvem respondia, desiste e reagenda. Status/ponto na foto (`#tabAv[data-sync]`) e faixa `#syncBanner` (só com erro + mudanças pendentes).
  - **Dados em texto na nuvem** (antes o arquivo do Drive ia criptografado com a "senha de sincronização", que deixou de existir): a proteção
    agora é o login + RLS. O endereço/chave do Open Finance (`despesas.of`) **não sobe** (saiu de `SYNC_PREFS`; em outro aparelho, preencher de novo).
    Claro/escuro, senha do app e `cfg.seeded` continuam de cada aparelho.
  - **Sair da conta** (Você → "Conta e sincronização", 2 toques; `sbSignOut`): envia o que falta e, se tudo subiu, faz logout no Supabase e **apaga
    todas as chaves `despesas.*` do aparelho** (os dados continuam na conta). Quem entra de novo recebe tudo. Cuidado: qualquer rotina que apague
    dados locais **sem** apagar `despesas.sbBase` faz o próximo sync mandar apagar tudo na nuvem (o "Esqueci a senha" já limpa base, lápides e meta).
  - Testado com Supabase simulado no navegador (2 aparelhos, 440 px e 1440 px, claro e escuro): login, erro de senha, subida dos dados antigos,
    2º aparelho recebendo, apagar/lápide, edição, tabela ausente e sair/entrar de novo. O sandbox não alcança o Supabase real.
- **Computador** (`@media (min-width:980px)`, out/2026): abas numa **barra fixa no topo** (out/2026, ele achou a lateral solta: `nav.tabs` vira barra sólida com "Minhas Despesas" (`.tabbrand`, só PC), abas com ícone + nome e a foto à direita, alinhada com `--pcw`; o título repetido Hoje/Mês/Planejar some do topo, fica na tela do cartão e na Você),
  topo vira cartão arredondado, conteúdo em 2 colunas (3 a partir de 1500 px) com `column-count` e `break-inside:avoid`
  nas seções, janelas de lançamento abrem no centro (modal), botão + no canto inferior direito. Testar em 1440×900.
  Tela do cartão: "Fora da fatura do banco" e "Parecidos" ficam sempre na coluna da direita (`.cdwrap` em grade:
  `.cdmain`/`.cdmain2` à esquerda — 2 colunas a partir de 1500 px — e `.cdside` à direita; no celular `display:contents`).
  Com mouse (`hover:hover`): linhas e cartões clareiam ao passar o mouse. Atalhos (fora de campos de texto): **N** novo
  (= botão +), **1–4** abas, **← →** mês, **/** buscar, **Esc** fecha janela (`sheetUp()`; cuidado: `openSheet(x)` ABRE
  o lançamento).

- **Aparência alinhada** (27/10/2026, pedido dele: "realinha como achar melhor"; `lookSection`, bloco CSS "Aparência alinhada" no fim): blocos com o mesmo rótulo (Foto com miniatura, Modo, Cor do app, Faixa do relógio), seletores na largura toda, todas as cores numa grade só de 5 colunas (sóbrias + vivas + Sua foto + Cor livre), faixa do relógio por último. Seção recolhida por padrão como as outras da Você. A "Faixa do relógio (iPhone)" saiu da tela (o topo em cartão já resolve; o CSS `data-topo` ficou inerte e `applyTheme` limpa o atributo). **Cuidado com CSS de seção recolhível:** regra com `#id .card{display:…}` vence `section.fold:not(.open)>:not(h2){display:none}` e a seção "abre" (classe `open`) mas nunca esconde; testar a visibilidade real (altura do conteúdo), não só a classe. **Bug corrigido:** `anoFold` tirava a chave da seção de `h.firstChild`, que depois do 1º desenho era o ícone "›", então todas as seções dividiam a chave "›" e não fechavam; agora usa o 1º nó de texto do título.
- **Caixinhas v3 + Pessoas v2** (27/10/2026, pedido dele: "redesenha essas duas… ainda não ta bom"; só `#saveSec`/`#azSec`, bloco CSS "Caixinhas v3 + Pessoas v2" no fim do `<style>`): **sem caixas dentro de caixas**, linhas lisas com divisória. Caixinha = anel de progresso (`.svring`, `--p` %, `--rc` cor; conic-gradient) com o ícone no meio · nome + `.svsub` (selos, "% · falta") · valor, e uma linha `.svm2` (por mês · ritmo) embaixo; sem cabeçalhos "Em real/Em outras moedas". Aberta: painel plano com seções `.svsec` (aviso `.svneed`, Onde está o dinheiro, Guardar ou tirar, Movimentos) e rodapé Editar/Excluir; formulário `.svform` com rótulos. Pessoa = bolinha com a inicial (`.azav`, cor por nome via `--h`, 📌 se fixada) · nome + situação · saldo; filtro `.azfil` (Por mês/A–Z/Categoria) em chips; aberta (`.azpanel`): Fixar/↑/↓ no topo, "Novo acerto" (descrição + valor, Eu devo/Me deve), "Nome no Pix" dentro de `<details>`, "Histórico" agrupado. Cuidado: `button.svmv` tem borda de cima branca por padrão (precisa `border-top:0` logo depois de `.svsec`/`.azmh`). Dados e funções não mudaram. Dívidas continua no visual antigo.
- **Caixinha mexe na conta** (27/10/2026, pedido dele: "caixinha tá conversando com o saldo?" → opção 1): com conta em R$ cadastrada, Guardar/Tirar tem "Descontar da conta" (`svAcField`, `#svAc`; padrão = 1ª conta, "Não mexer no saldo" desliga). O movimento ganha `acct` (nome) e `ts` (hora); `accMoves` soma esses movimentos feitos depois do saldo informado (guardar = sai, tirar = volta; valor em R$ = `brl` se houver cotação, senão `cents`; movimento em moeda sem `brl` não mexe). Editar movimento tem o mesmo campo (`#mvAc`); apagar desfaz o efeito. Movimentos antigos não mexem na conta. Nada some em `accBal`/`endBal` além disso.
- **Pessoas: Por mês / A–Z / Categoria + ordem manual e fixar** (27/10/2026, pedido dele: "ordenar por A-Z e categoria… vincular 5 ao yt e 4 ao ir b… ajustar a ordem e fixar um em cima"): seletor no topo de Pessoas (`azView`, `data-azview`, `despesas.azView`). A–Z ordena as pessoas pelo nome e agrupa o histórico da pessoa aberta pelo nome do lançamento ("YouTube · 5 itens", total do grupo); Categoria agrupa pela categoria do lançamento (assinatura, Pix recebido e movimentos avulsos têm grupo próprio); Por mês é o de antes. Fora do A–Z a ordem é a manual (ordem de `cfg.acertos`): na pessoa aberta, "↑ Subir / ↓ Descer" trocam com a vizinha do mesmo grupo e "📌 Fixar no topo" grava `p.pin` (fixadas sempre vêm primeiro, em qualquer modo).
- **Mês v2** (27/10/2026, pedido dele com print do PC: "mês"): busca com espaço até os blocos; mês vazio mostra título + botão "+ Lançar" (`#mesEmptyAdd`, abre o lançamento) sem caixa tracejada; faixa de Cartões vira lista lisa com divisórias (`#mBody .cstrip .ctile`, sem quadradinhos) e `.tlbal`/`.tlproj` sem caixa. Só CSS "Mês v2" no fim do `<style>` + o estado vazio do `renderMes()`.
- **Onde está o dinheiro alinhado** (27/10/2026): linhas `.svbk` em grade (selo 32 px · nome · valor à direita), nome dentro de `<em>`; CSS "Onde está o dinheiro" no fim do `<style>`.
- **Tela Você** (out/2026, pedido dele: "config do usuário ao clicar no rosto, não no Ano"): painel `pMe` (`renderMe()`),
  não é aba da barra; abre pela foto (`#tabAv`, atalho **5** no computador). Topo mostra foto + nome, último backup e
  conta (e-mail e sincronização). Seções: Aparência, Senha e Face ID (`secSection`), Sincronizar, Categorias, Backup e exportação,
  Estatísticas, Zerar tudo. A pílula da barra some (`nav.tabs.onme`) e a foto ganha anel. Sem botão +.
  O **Ano** ficou só com números: próximos meses, caixinhas, gráfico, resumo, previstos e gastos que se repetem.
  **Senha no computador** (`IS_PC` = mouse): vale 6 h (`despesas.unlockAt`, `pcUnlocked()`, `RELOCK_MS`); "Bloquear app"
  zera. Celular continua: ao abrir e depois de 5 min fora. **Teclado numérico**: `numKey(e)` lê `e.code` NumpadN (com Num
  Lock desligado o navegador manda End/←/↓…); vale na senha, nos campos de valor (insere o dígito) e nos atalhos.


## Mudanças de 14–15/10/2026 (feitas no Antigravity, revisadas e corrigidas)

- **Planejar tem 3 sub-abas** (`anoSubTab`, `despesas.anoTab`): Metas & Caixinhas / Visão do Ano / Fixos & Salários. A barra
  usa `.ano-subnav` (não usar `.mestab-bar`: ela é escondida no PC). Em ≤ 480 px os emojis das abas somem e o texto encolhe.
- **Mês no celular** tem sub-abas Lançamentos | Categorias (`mesSubTab`); no PC é 2 colunas (`.mes-split`). A barra com as 3 maiores
  categorias do desenho antigo foi substituída por elas.
- **Cartões voltou como aba só no PC** (`.tab.pconly`). A pílula da barra (`--ti`) conta só as abas visíveis. Atalhos 1–N = abas
  visíveis, 5 = Você.
- **Posso comprar?** é um card no Hoje (celular) e um botão no rodapé do Início (PC); o clique usa `closest("#canBuy")`.
- **★ Melhor dia** (`isBestDay`): do dia seguinte ao fechamento até 3 dias depois, olhando fechamentos de vários meses.
- Tela do cartão com cartão físico (`.phys-card`) e ciclo da fatura; caixinhas em € sem converter para R$; categoria do lançamento
  num botão que abre a gaveta `#catSheet`; lista do Mês do mais recente para o mais antigo.
- O `.fab` fica só "+" no PC e em telas pequenas (`.fab span#addLbl` precisa de `display:none!important` nesses casos).

## Tela do cartão (15/10/2026, pedido dele)
- **"Marcar fatura de <mês> como paga"** é o botão `#payCard` logo abaixo do cartão (topo); alterna pago ↔ a pagar. Saiu da barra do fim.
- Ordem: cartão + pagar → Fatura do mês → Itens → Limite → **Saldo na conta <cartão>** → Próximas faturas → Parcelas → "Importar e limpar" (PDF, Zerar mês). Lado direito (PC): Fora da fatura / Parecidos.
- **Cartão também é conta**: `cardAcctBox(c)` grava em `cfg.accts` pelo nome do cartão (`setAcctBal`, `#cardBal`/`#cardBalSave`/`#cardBalDel`) e entra no "Na conta" do Hoje. Como o app tem um só `atTs`, `setAcctBal` joga o que mexeu desde o último saldo na 1ª outra conta antes de regravar, para o `accBal()` não mudar. A lista de cartões mostra "saldo R$ X".
- **Assinaturas previstas no cartão** (15/10/2026, pedido dele): `subPlanned(c,ym)` lista as assinaturas (`subOf`) que já caíram nesse cartão e ainda não estão lançadas no mês visto (mês atual até +3); valor = último mês. Seção "Assinaturas previstas" na tela do cartão, com "Fatura com as previstas". Só informativo: não entra em `cardTotal`/saldos. Não prevê se o último lançamento está a mais de 1 mês à frente (repetição com fim) ou tem mais de 3 meses.
- Abaixo do "Total da fatura" (só com previstas): **Já cobrado/lançado**, **Previsto (assinaturas)** e **Total previsto** (`.prevcard`: barra lançado / cobrado sem lançar / previsto listrado + legenda, `#totPrev`). Continua só informativo.
- **Ajustar salário/adiantamento previsto** (15/10/2026, pedido dele): tocar numa linha prevista (Hoje, Mês) abre `salOvSheet(id)`: valor só daquele mês (`cfg.salOv[id]={c}`), "Não vai cair este mês" (`{skip:1}`) ou voltar ao previsto. Aplicado no fim do `salVirt` (item ganha `ov`/`orig`, nome "(ajustado)"). O id virtual é `_sp_<tipo>_<AAAA-MM>`, então não afeta outros meses e a sobra antiga é inofensiva.
- Topo da tela do cartão: sem o quadro "Vencimento" (já está no cartão); fica só "A pagar" (`header()` esconde o pai de `#s1` quando há `selCard` que não é benefício). `billShown` só passa para o próximo mês se a fatura paga já venceu (`cardDue` < hoje); ao abrir o cartão sem mês explícito (`data-opencard` sem `data-ym`) o mês atual vira `billShown(...).ym`.
- **Topo em qualquer largura** (15/10/2026, pedido dele: "alinhado em todos os tipos de tela", não só 440 px): até 720 px o topo vai de ponta a ponta (passa atrás do relógio); de 721 a 979 px vira cartão arredondado com as mesmas bordas dos cards (`margin-inline:0`, sem a faixa do relógio); a faixa fixa do relógio tem canto de baixo arredondado. Testar o topo em 320, 375, 440, 768, 1024 e 1440.
- **Dia da cobrança da assinatura** (15/10/2026, pedido dele: "assinatura feita hoje… a partir daquele dia aparecer dentro do valor"): `subDayOf(nome, item)` = `cfg.subDay[nome]` (manual, campo "Dia da cobrança" no editor da assinatura em Planejar) ou, se não houver, o dia da compra (`buy`, senão `date`) do último lançamento — vale para as que já existem. `subPlanned` calcula a data da cobrança que cai na fatura do mês visto (`billDate`); se já passou (`charged`) conta em "Já cobrado (inclui R$ X de assinaturas sem lançar)" na tela do cartão; se não, fica "Previsto". Só na tela do cartão: `cardTotal`, saldos e o número grande do topo continuam só com o lançado.

## Menos texto (15/10/2026, pedido dele: "tira esses textos de apoio, carrega muito o app visualmente")
- Parágrafos só explicativos (`.hint`) ganharam a classe `expl` (some com `!important`): não escrever texto de apoio novo; só aviso que muda o que fazer (atraso, falta de saldo, conferência).
- Listas: sem categoria/forma de pagamento sob o nome (o ícone já mostra); fica só status (atrasado, vence hoje, pago ✓, parcela). "sobra/fica R$" por linha só aparece quando **falta** (vermelho). Sem a frase no topo do Hoje/Planejar/Você (`hFoot` vazio).
- `+` fica redondo ao lado da barra em qualquer celular (≤ 979 px), não só nas telas pequenas. Vidro da barra com mais tinta e desfoque 20px.
- PC: "Vence em 10 dias" em 2 colunas; caixinha vazia vira "Criar uma caixinha"; pedido de nome de usuário com 1 linha de aviso (mantida de propósito: é o aviso do que o Camilo vê).

## Redesenho visual (19/10/2026, pedido dele: "não to feliz com o visual")
- **Híbrido Papel + Blocos**: Fraunces (`--serif`) só em números grandes, títulos de seção e dia; topo vira bloco flutuante arredondado com névoa (degradê vertical do `--head`); seções em blocos arredondados sem borda e sem linhas entre elas. Cards dos cartões (`.htile`) mantêm o degradê/brilho na cor do cartão.
- **Tela do cartão inteira na cor do cartão**: `cardTheme()` também puxa `--bg/--surface/--zebra/--line/--chip` para a cor do cartão (volta ao normal ao sair).
- **Mês (celular)**: versão "Categorias primeiro" (`mesV2`; a "Dia a dia" `mesV1` fica atrás de `despesas.mesV="1"`) + filtro `mesFilterBar()`: quadrinhos dos cartões + pílulas Todos / A pagar / Pagos / Receitas (`mesF`).
- (feito em 20/10: ver "Blocos coloridos" abaixo.)
- **PC (20/10/2026)**: mesmo híbrido do celular (topo com névoa, Fraunces, blocos); tela do cartão em 2 colunas (`.cdhero`+`.cdmain2` à esquerda, 420 px; `.cdmain`+`.cdside` à direita); só a aba Cartões acende dentro do cartão; Mês no PC tem `mesFilterBar()` na largura toda (e `mesApply` filtra a linha do tempo); backup é sempre a linha `.bline`.

## Blocos coloridos + Hoje / Carteira / Mês (20/10/2026, pedido dele: "redesenhar tudo"; só caixinhas e cartões ficam como estavam)
- **Estrutura**: barra de baixo com 3 abas (Hoje, **Carteira**, Mês) + foto. A aba Planejar saiu e a aba Cartões do PC também.
  Carteira não tem painel próprio: `go("pWal")` abre o painel `pAno` com `anoSubTab==="metas"` (`inWal()` também vale para `pCards` e
  `pFx`, que acendem a Carteira). Carteira = `contaBlock()` + `hojeCards()` + `saveSection()` (+ `fxRowSection()`/`divSection()`).
  Mês tem o seletor **Mês | Ano | Fixos** (`mesSwitch`, `data-msw`): Ano e Fixos são `pAno` com `anoSubTab` "ano"/"fixos"; a barra
  acende Mês. Hoje (celular) = faixa + próximos pagamentos + Posso comprar + cartões; "Na conta" e "Dinheiro guardado" foram para a Carteira.
  `go()` limpa o HTML de `pHome`/`pAno` quando escondidos (ids repetidos como `#acEdit`); `rr()` re-renderiza a tela certa ao editar contas.
  Voltar de Moedas/lista de cartões vai para a Carteira. Cabeçalho da Carteira: "Na conta e guardado" com Nas contas / Guardado.
- **Visual** (bloco CSS "Blocos coloridos" no fim do `<style>`): fundo liso, topo sólido na cor do tema (sem névoa/degradê), números em
  Bricolage Grotesque bold (`--serif` agora aponta para ela; Fraunces não é mais usada), seções = blocos de 28 px com tinta por área via
  `:has()` (pagamentos laranja, contas turquesa, moedas azul, categorias azul, benefícios roxo; `--blk`), listas sem caixa interna, KPIs do
  Ano em 4 blocos. Caixinhas (`#saveSec`) e cartões (`.htile`, tela do cartão, `.phys-card`) ficam com o visual anterior.

## Dívidas (20/10/2026, pedido dele: "preciso de uma área dívidas")
- Seção **Dívidas** (`debtSection()`, `#debtSec`) na **Carteira**, logo abaixo de Dinheiro guardado. Mesmo padrão das caixinhas (linha → toque abre; `dbOpen`/`dbForm`/`dbMvEdit`).
- Dados em `cfg.debts=[{id,name,total (centavos),who?,per? (parcela),day? (dia do vencimento 1–31),moves:[{id,date,cents}]}]`;
  `cents > 0` = pagou ("Paguei"), `cents < 0` = acrescentou (juros / valor novo). Falta = total + acrescentos − pagos (`dbLeft`). Quitada vira selo "QUITADA".
- **Não entra como despesa/receita nem em saldos**: serve para acompanhar o que falta, sem somar duas vezes com parcelas e faturas já lançadas.
  Mostra total em aberto, barra de progresso, parcelas restantes (`per`) e próximo vencimento (`dbNext`). Sem valores no código; fica em `cfg` (backup/sincronização já levam).
- **Caixinhas separadas por moeda, sem somar** (20/10/2026, pedido dele; total e topo da Carteira também em linhas por moeda, sem converter): com caixinhas em R$ e em €/US$ ao mesmo tempo, `saveSection` mostra dois grupos ("Em real" / "Em outras moedas", `.svgrp`) com subtotal de cada um; só um tipo = lista como antes. O total geral não muda.

## Conta e categoria em cada lançamento (20/10/2026, pedido dele: "quando eu lanço uma receita ou despesa, em que conta entra ou sai… e a categoria, se não existe poder criar")
- Lançamento ganha `acct` (nome de uma conta de `cfg.accts`). No formulário o campo **"Entra na conta" / "Sai da conta"** (`#acctField`) só aparece com 2+ contas e não aparece em compra com benefício; vale também para despesa no Crédito (conta que paga a fatura).
  Sem `acct` (ou conta que não existe mais) = 1ª conta (`accOf`). `accMoves(nome)` e `accBalOf(a)` dão o saldo de cada conta (saldo informado + receitas que entraram − despesas pagas depois, só do que é dessa conta); a soma das contas continua `accBal()`.
  `setAcctBal` agora devolve a cada outra conta o que mexeu nela (antes jogava tudo na 1ª).
- **Categoria de receita criável**: "+ Nova categoria" aparece também em Receita (`addCat(nome,"rec")`) e a tela Você tem "Categorias de receita". Criadas em `cfg.catsRec=[{k:"ur_…",n,c}]` (chave `ur_`; `applyCats()` põe antes de "Outras receitas"); apagar move para `rout`. As padrão de receita não se apagam.
- **Hoje no PC, bloco "Dinheiro guardado"** (`k==="guard"` no `renderHome`): total também sem converter (R$ + € + US$ cada um no seu valor, `kR`/`kE`/`kU`). `svTotal()` (convertido) não é mais usado em tela.

## Adicionar cartão fácil (20/10/2026, pedido dele: "tinha que ter um botão fácil pra adicionar cartão")
- Lista "Seus cartões" (`renderCards`) tem **"+ Novo cartão"** no título (`#cardNew`) e um quadro tracejado **"Adicionar cartão"** (`.foladd`, `#cardNew2`) no fim da grade; sem cartão, botão grande no aviso vazio. Os dois abrem `openCardSheet()` (clique delegado no documento).

## Caixinha por tipo e com vários bancos (20/10/2026, pedido dele: "caixinha de categoria viagem, colocar dinheiro em vários bancos, as caixinhas mais famosas")
- Formulário da caixinha começa com a grade de **tipos** (`SV_KINDS`: Viagem, Reserva de emergência, Casa própria, Carro ou moto, Casamento, Estudos, Celular e eletrônicos, Presente, Saúde, Investir, Outro). Tocar preenche o nome (só se estiver vazio ou ainda com o nome do tipo anterior) e guarda `b.kind`; o ícone da linha vem de `svIcon(b)` (kind, senão pelo nome via `boxAvatar`). `svFormKind()` dá o tipo escolhido (Viagem por padrão no atalho `fxMeta` da aba Moedas).
- **Banco em cada movimento**: `moves[].bank` (texto, de `ALL_BANKS()` ou "Outro banco…"). Guardar/Tirar e editar movimento têm "Em qual banco" (`svBankField`/`svBankVal`; ids `svBk`/`svBkNew`, `mvBk`/`mvBkNew`). Movimento sem banco conta no `b.bank` (banco principal, opcional), senão em "Sem banco definido".
- Caixinha aberta mostra **"Onde está o dinheiro"** (`svBankRows(b)`: saldo por banco, R$/€/US$; compras de moeda com `fxAll` contam onde foram feitas). `boxBanks(b)` junta principal + bancos com saldo + `svFxBanks` e dá os selos ao lado do nome. O total da caixinha não muda (soma de tudo).

## Cartão no topo (21/10/2026, pedido dele: "começar do 0"; o visual do cartão é o que ele mais gosta)
- Desenho aprovado no canvas "Minhas Despesas — 3 direções" (artifact de design). Só no **celular (≤ 979 px)**; PC continua igual.
- O topo de toda tela é um cartão: `header.top` vira a moldura (cor do cartão 22% no fundo) e `.tcard` (wrapper novo dentro do
  header; no PC é `display:contents`) é o cartão com chip (`::before`), brilho (`::after`) e degradê. **Não confundir com `.hcard`**,
  que já é o bloco clicável do Início/Ano (o nome colidiu e quebrou os blocos; por isso `.tcard`).
- Cor: `--hc` = cor do cartão de verdade (setada no `cardTheme`, que agora inclui `--hc`); sem cartão, `--head` do tema.
  Hoje e Contas usam a cor da 1ª conta (`accts()[0].name`), e o título do Hoje é o nome dela.
- Linha do tempo embaixo do cartão: `#hTl` (`hTlSet(steps,pct)`, `hTlUpdate()` chamado pelo `header()`, que agora embrulha o `header0()`).
  Hoje: Hoje / próximos 2 vencimentos do mês / Dia N. Mês: Dia 1 / Hoje / Dia N. Tela do cartão: Aberta / Fecha / Vence (`closeOf`).
  Contas, Ano, Fixos, Você: sem linha do tempo.
- No cartão aparecem só 2 valores: `#big` à esquerda e o 1º item do `.split` à direita (o 2º some). ≤ 380 px empilha.
- Tela do cartão no celular: o `.phys-card` e o `.card-cycle` do corpo somem (o topo já é o cartão); fica só o "Marcar fatura como paga".
  "‹ Contas" fica no canto do cartão.
- Barra de baixo: cápsula lisa, home = círculo com ponto, aba ativa = pílula clara com o nome (`<span>` dentro do `.tab`; ≤ 380 px só ícone).
  "Carteira" agora se chama **Contas** (o id continua `pWal`).
- **Contas e cartões** (pedido dele: juntar "Na conta" com os cartões): no celular, com conta cadastrada, `contaBlock(true)` lista as
  contas e depois os cartões (`walCardRows`: livre, vencimento, fatura em aberto com `rollAmt`); os quadros grandes de cartões saem dessa tela.
- `billShown`: fatura **vazia** que já venceu também passa para a próxima (antes abria o cartão numa fatura passada de R$ 0,00).
- **Listas sem caixa** (celular): no Hoje e no Mês as seções ficam direto no fundo (título 1,22rem); quadros de cartões, faixas e
  caixinhas continuam como estavam. "Posso comprar?" virou faixa discreta. No Mês, os quadros de cartões do filtro viraram
  pílulas com a bolinha da cor do banco, na mesma linha de Todos / A pagar / Pagos / Receitas (`mesFilterBar`, `.mfc`; PC igual).
- **Lançar** (celular): `#sheet` vira flex em coluna; valor grande no topo (Bricolage 2,9rem), "Importar fatura ou conta (PDF)"
  desce para o fim (`order`) e a linha do Salvar fica grudada embaixo (sticky).

## Pessoas (27/10/2026, pedido dele: "coisas a pagar a minha mãe e ela tem coisas a me pagar")
- Seção **Pessoas** na Contas (`azSection()`, `#azSec`; dados em `cfg.acertos=[{id,name,moves:[{id,date,cents,desc?,done?}]}]`, `cents > 0` = a pessoa te deve, `< 0` = você deve a ela; "acertar" marca `done`). Não entra como despesa/receita nem em saldos.
- No lançamento, campo **Pessoa** (`#pessoaField`, só com pessoas criadas): `x.pessoa` (id) e `x.pv` (parte dela em centavos, vazio = tudo). Despesa soma (`azLv`: você pagou por ela ou a ela), receita subtrai (ela te pagou). `azBal` = movimentos em aberto + partes de assinatura dividida (Valor por pessoa, mesmo nome, ainda não paga no mês) + lançamentos ligados.
- **Várias pessoas no lançamento** (27/10/2026, pedido dele): `x.pessoas=[{id,v?}]` (v = parte dela em centavos; sem v: uma pessoa = tudo, várias = o resto dividido igual); o antigo `x.pessoa`/`x.pv` continua lido por `azParts(x)`. Chips do formulário alternam (várias), uma linha de valor por pessoa (`#pv_<i>`). `azLv(x,p)` dá a parte de cada uma.
- **Mensal × total nas Pessoas** (27/10/2026, pedido dele: "pra não cobrar errado"): a linha da pessoa mostra o total e "· este mês R$ X" (só quando difere do total); aberta, o histórico vem agrupado por mês (`azMonths`/`azEntries`; lançamento = mês da compra `buy`/data, movimento = mês da data, assinatura dividida em aberto = mês atual), cada mês com seu subtotal e "Total" no fim.
- **Pessoas por vencimento + Pix recebido** (27/10/2026, pedido dele): o mês do lançamento é o do `x.date` (vencimento da fatura), não o da compra. `azPix(p)`: receita "Pix de <nome>" (ou "… · <nome>", `shWho`) que bate (`nmSame`) com o nome da pessoa ou com o "Nome no Pix" (`p.pix`, vários separados por vírgula, campo ao abrir a pessoa) abate o saldo no mês em que caiu ("Pix recebido ✓"; tocar = ignorar/usar, `p.pixIgn`). Fora: receita já ligada à pessoa e cat `divid`.
- **Pix sem pessoa** (27/10/2026): com a pessoa aberta, "Pix recebidos sem pessoa (N) · é de X?" (`azLoose`, `data-azlink`) lista receitas "Pix de …" que ninguém pegou; tocar liga o lançamento à pessoa (`pessoas`) e guarda o nome no `p.pix`, então os próximos do mesmo nome entram sozinhos.
- Editar parcela/repetição (`group` fora das "s…" ou `buySeries`): nome, categoria, conta e pessoas passam para a série toda; valor, data e situação ficam por mês.
- Mesclar com item da fatura mantém `div` (divisão entre pessoas).
