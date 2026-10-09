# Minhas Despesas — contexto para o Claude

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
- Acesso: no app do iPhone (PWA) cada pessoa cria nome + senha de 6 dígitos no primeiro acesso (tela estilo app de
  banco). A senha fica só no aparelho (`despesas.auth`, PBKDF2 com sal); não dá para recuperar, só apagar os dados e
  recomeçar. Pede de novo ao reabrir o app ou depois de 5 min em segundo plano; "Bloquear app" na tela Você.
  Não é login na nuvem: os dados continuam só no aparelho de cada um.
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
  fonte do app (`cardBadge`). **Não usar logos nem fontes dos bancos** (marcas; repositório e site são públicos).
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
- **Pagar com duas formas** ("+ Pagar com duas formas" no lançamento novo, só "Só uma vez"): cria 2 lançamentos com o mesmo
  `group` ("s…"), a 2ª parte com outra forma (e cartão, se Crédito); o resto fica na forma principal.
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
  do Worker + APP_KEY em `despesas.of` (fora do backup e do repo; vai para os outros aparelhos pelo Drive, em `SYNC_PREFS`, criptografado) → "Conectar banco" abre o widget
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
- **Sincronizar com o Google Drive** (out/2026, só a conta dele): `GDRIVE_CLIENT` = ID do cliente OAuth (projeto Google
  Cloud dele "Minhas Despesas", tela de consentimento em **teste** com o Gmail dele como usuário de teste, origem
  `https://camilosavi.github.io`, escopo `drive.appdata`). Vazio = seção escondida. Seção na tela Você (`syncSection`):
  Conectar → **redirecionamento** para o Google (a janelinha GIS não volta no app da tela de início do iPhone;
  `gAuth(after)` → volta em `/despesas/#access_token=…`, `G_BACK` guarda o token em `despesas.gtok` e limpa o endereço,
  `gResume()` continua depois de destravar; URI de redirecionamento `https://camilosavi.github.io/despesas/` cadastrado
  no cliente; token ~1 h, quando expira a faixa `#syncBanner` pede toque) → senha de sincronização
  (≥ 8, mesma em todos os aparelhos, guardada em `despesas.syncPass` no aparelho). Arquivo `despesas-sync.json` na
  appDataFolder, criptografado (PBKDF2 250k + AES-GCM). `syncNow` junta em 3 vias com a base `despesas.syncBase`
  (hash por lançamento/compra/chave do cfg): quem mudou desde a base vence; os dois → este aparelho (1ª vez → nuvem).
  Apagar sincroniza (some da base). Roda 3 s depois de gravar (`_emit`), ao abrir/voltar, ao destravar e a cada 2 min.
  Foto e tema também sincronizam (`SYNC_PREFS`, parte `prefs` do arquivo); claro/escuro (`despesas.mode`), senha do
  app e `cfg.seeded` ficam de cada aparelho. Testado com Drive simulado (2 aparelhos, apagar/editar/somar,
  senha errada).
  **Status claro** (out/2026, ele não sabia se "sincronizar" enviava ou recebia): o arquivo leva `dev` (`syDev()`: iPhone/
  celular/computador) e `at`; `syncMeta` guarda `upAt/upN` (↑ enviado) e `downAt/downN/downFrom` (↓ recebido de qual
  aparelho); `syncPend()` conta mudanças daqui ainda não enviadas (snapState × `syncBase`). Tela mostra "Em dia com o
  Drive ✓" ou "N mudanças daqui esperando envio"; botão "Enviar agora"/"Conferir agora"; toast diz o que foi e veio.
  **Login renova sozinho** (`syAutoAuth`): token vencido + e-mail conhecido → `gAuth("auto")` (prompt=none) ao abrir,
  voltar ao app ou destravar, no máximo a cada 20 min (`despesas.gAutoAt`), sem janela aberta; erro só liga a faixa.
  **Erros com motivo** (out/2026): o catch do `syncNow` diz o que houve (login recusado 401/403 → apaga o token e refaz o
  login sozinho, respeitando os 20 min para não ficar em loop; sem internet; Drive fora do ar 5xx; 429; senão mostra o
  código/motivo do Google). `syncMeta.errMsg/errAt` guarda o último erro (aparece mesmo depois de reabrir; some ao dar certo).
  **Apagado não volta** (out/2026, ele: "mescla depois volta tudo"): `store.items.remove` grava lápide em
  `despesas.syncDel` ({id: hora}, 180 dias); o arquivo do Drive leva `del` e o `syncNow` junta as lápides dos dois lados e
  tira esses ids de items/fx (antes um aparelho sem base ou com cópia velha ressuscitava o que foi mesclado/apagado).
  `syDelForget` tira lápides ao desfazer "Zerar mês" e ao restaurar backup. **Corrida:** se os dados mudaram enquanto o
  Drive respondia (`snapState` ≠ foto do início), a rodada desiste sem gravar e reagenda (`syncSoon`).
  **PC não enviava** (out/2026, ele: "o PC só recebe"): no computador a aba fica aberta, o token vencia em ~1 h e o
  `syncNow` só marcava pendente (a renovação só rodava ao voltar ao app). Agora, com mudanças daqui (`syncPend`) e
  token vencido, `syAutoAuth` renova sozinho (a cada 3 min; 20 min se a última renovação falhou, `despesas.gAutoErr`),
  só com a pessoa parada 15 s (`syTouch`), sem janela aberta nem campo em foco; guarda tela/mês/rolagem em
  `sessionStorage despesas.gview` e volta igual. `syFlush` envia na hora ao sair do app/aba (antes esperava 3 s).
  **Ponto na foto** (`#tabAv[data-sync]`): laranja = falta enviar/entrar, vermelho = erro, azul piscando = sincronizando,
  sem ponto = em dia. A faixa `#syncBanner` diz quantas mudanças não foram.
  **Base64 em pedaços** (`binStr`): `String.fromCharCode(...array)` estourava a pilha ("Maximum call stack size
  exceeded") com o arquivo da sincronização grande (foto + muitos lançamentos). Nunca usar spread em array grande.
- **Computador** (`@media (min-width:980px)`, out/2026): abas na lateral esquerda (cápsula vertical, pílula desliza em Y),
  topo vira cartão arredondado, conteúdo em 2 colunas (3 a partir de 1500 px) com `column-count` e `break-inside:avoid`
  nas seções, janelas de lançamento abrem no centro (modal), botão + no canto inferior direito. Testar em 1440×900.
  Tela do cartão: "Fora da fatura do banco" e "Parecidos" ficam sempre na coluna da direita (`.cdwrap` em grade:
  `.cdmain`/`.cdmain2` à esquerda — 2 colunas a partir de 1500 px — e `.cdside` à direita; no celular `display:contents`).
  Com mouse (`hover:hover`): linhas e cartões clareiam ao passar o mouse. Atalhos (fora de campos de texto): **N** novo
  (= botão +), **1–4** abas, **← →** mês, **/** buscar, **Esc** fecha janela (`sheetUp()`; cuidado: `openSheet(x)` ABRE
  o lançamento).

- **Tela Você** (out/2026, pedido dele: "config do usuário ao clicar no rosto, não no Ano"): painel `pMe` (`renderMe()`),
  não é aba da barra; abre pela foto (`#tabAv`, atalho **5** no computador). Topo mostra foto + nome, último backup e
  Google Drive. Seções: Aparência, Senha e Face ID (`secSection`), Sincronizar, Categorias, Backup e exportação,
  Estatísticas, Zerar tudo. A pílula da barra some (`nav.tabs.onme`) e a foto ganha anel. Sem botão +.
  O **Ano** ficou só com números: próximos meses, caixinhas, gráfico, resumo, previstos e gastos que se repetem.
  **Senha no computador** (`IS_PC` = mouse): vale 6 h (`despesas.unlockAt`, `pcUnlocked()`, `RELOCK_MS`); "Bloquear app"
  zera. Celular continua: ao abrir e depois de 5 min fora. **Teclado numérico**: `numKey(e)` lê `e.code` NumpadN (com Num
  Lock desligado o navegador manda End/←/↓…); vale na senha, nos campos de valor (insere o dígito) e nos atalhos.

