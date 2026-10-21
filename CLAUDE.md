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
   - Ainda **não** tem: categorias, editar lançamento, limite/cartão como item próprio, conferência com o saldo real, busca/filtro no extrato.

## Como editar (sempre assim)

1. Edite **só `src/app.html`** (fonte única). Nunca edite `index.html` à mão.
2. Rode `python3 build_pwa.py` → gera `index.html` e `sw.js` (versão do cache muda sozinha).
3. Teste em 440 px de largura, claro e escuro, e confira que não há erro de console. Se mexer em layout, teste também em
   1440 px (computador) e em 375 px.
4. Antes de começar, `git pull` (outras conversas podem ter publicado).
5. Commit e push direto na `main` (ele liberou); depois mostre o que mudou. O Pages publica em ~1 min.

Várias conversas ao mesmo tempo: antes do push `git fetch origin main && git rebase origin/main`; nunca `push --force`.
Conflito em `src/app.html`: juntar à mão. Conflito em `index.html`/`sw.js`: aceitar qualquer lado e rodar o build de novo.
O histórico foi recomeçado em 09/10/2026 (tirar valores pessoais): clone antigo não serve, clonar de novo.

## Regras que valem sempre

- **Nada de valores pessoais neste repositório (ele é público).** Limites, faturas, saldos ficam no Projeto "App Despesas"
  do claude.ai (`claude/contexto-pessoal.md`). Quem abre o app pela primeira vez começa limpo, sem cartões.
- Valores sempre em **centavos** (inteiros); datas ISO `AAAA-MM-DD`.
- Menos texto: nada de parágrafo de apoio; só aviso que muda o que a pessoa faz.

## Dados no aparelho

`localStorage`: `despesas.zero.accts` (`[{id,name,color,label?,start}]`) e `despesas.zero.entries`
(`[{id,acct,type:"rec"|"desp",cents,date,desc,imp?,at}]`). Nada vai para a nuvem. A versão de 21/10 de manhã guardava
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
