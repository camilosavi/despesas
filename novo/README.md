# novo/ — base do app refeito (branch `alinhar-variaveis`)

`novo/app/` é a prévia do app novo, publicada junto da `main` em `/despesas/novo/app/`. O app atual (`src/app.html`, na raiz) continua como está.
A prévia tem login próprio (`tostao.sb`, separado do app atual) e grava na mesma conta (`sync_rows`), no formato do app atual.

## Regra
Cada número do app tem **uma** função em `base/calculo.mjs`. As telas só chamam; nenhuma tela soma por conta própria.
Tudo é função pura de um `estado` (formato no topo do arquivo), então testa com dados de exemplo, sem navegador.

## O que tem
- `base/calculo.mjs`: Fatura, A pagar, Entrou / Gastou / Sobra, Na conta hoje, Fim do mês, Livre (limite do cartão).
- `base/categorias.mjs`: 10 de despesa + 5 de receita fixas; cada pessoa pode **adicionar** as suas (não edita/esconde as básicas). `migrar` leva as do app atual para a lista nova.
- `base/datas.mjs`: datas e meses como texto, sem depender do fuso.
- `base/pessoas.mjs`: divisão por pessoa (partes, saldo, acertos), vale para despesa e assinatura.
- `marcas/`: **logos, cores e siglas dos bancos e o logo do Tostão, copiados sem mudança do app atual** (27 logos). Não redesenhar.
- `visao-geral/`: a primeira tela (prévia com dados inventados). `node novo/visao-geral/montar.mjs saida.html`.
- `teste/`: dados inventados.

## Rodar os testes
```
node --test "novo/teste/*.test.mjs"
```

## Nomes (decididos)
Na conta hoje · A pagar · Fatura · Livre · Entrou / Gastou / Sobra · **Fim do mês**.

## Dois conceitos que antes se misturavam
- **Gastou** = competência: no mês do vencimento, mesmo que a fatura não tenha sido paga.
- **A pagar** = caixa: o que ainda vai sair da conta no mês. Fatura vencida e não paga rola para a próxima, como o banco faz, então os dois podem diferir.

## Ainda não tem
Telas, leitores de PDF/holerite (entram copiados do app atual, sem reescrever), sincronização.


## App novo (prévia, 23/11/2026)
`novo/app/`: `index.html`, `app.css`, `js/` (`sb` login e linhas, `store` estado e gravação, `regras` fatura/salário, `telas/*`). Telas: Início, Mês, Contas, Cartões (lista e tela do cartão), Planejar, Orçamento, Pessoas, Caixinhas, Moedas, Você + painel Lançar. Ainda no app atual: leitores de PDF/extrato/holerite/print e Open Finance.
Teste: Supabase simulado no Playwright (login, leitura, lançar, sem erro de console), 1440 e 440 px, claro e escuro.
