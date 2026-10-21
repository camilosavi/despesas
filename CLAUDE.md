# Minhas Despesas — contexto para o Claude

App pessoal de controle de gastos do Camilo, usado no iPhone 16 Pro Max (440 pt de largura).
Publicado como PWA em **https://camilosavi.github.io/despesas/** (GitHub Pages, branch `main`, pasta raiz).
Fala português; respostas curtas e diretas.

## Recomeço (21/10/2026)

Pedido dele: "apaga tudo e vamos começar do 0, função por função". O app antigo (6.900 linhas: lançamentos, Mês, Contas,
caixinhas, dívidas, moedas, sincronização, avisos, Open Finance…) foi removido. **A última versão antiga é o commit
`68e3b9b`** (`git show 68e3b9b:src/app.html`): serve de consulta quando ele pedir uma função de volta, mas não copiar
em bloco — cada função volta sozinha, quando ele pedir, do jeito que ele pedir.

Ficou só:
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

`localStorage`: `despesas.zero.cards` (`{nome:{color}}`) e `despesas.zero.sel` (cartão aberto). Nada vai para a nuvem.
As chaves antigas (`despesas.v3`, `despesas.cfg3`, `despesas.fx3`…) continuam no iPhone dele, intactas, mas o app novo não lê.
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
