# ADR - Decisoes de implementacao para Planejamentos Compartilhados

> Nota de status:
> Este documento contem especificacoes conceituais e itens de roadmap. O
> contrato atual implementado deve ser conferido no Swagger oficial
> (`backendnest/swagger.yaml`) e na validacao documental disponivel em
> `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`.

## Status

Aceita.

## Contexto

A especificacao inicial de Planejamentos Compartilhados definiu o modulo como
parte do monolito modular NestJS atual, sem microservico, sem integracao
automatica com transacoes pessoais e com participantes manuais no MVP.

O diagnostico tecnico identificou decisoes que precisavam ser fechadas antes da
implementacao para evitar ambiguidades em calculos financeiros, status,
recorrencia mensal e historico.

## Decisao 1 - Acertos persistidos

Os acertos devem ser materializados e persistidos apos cada alteracao financeira
relevante.

Regras:

- acertos `PENDENTE` podem ser recalculados e substituidos;
- acertos `PAGO` nao devem ser apagados automaticamente;
- consultas `GET` nao devem alterar o banco de dados;
- o resumo financeiro deve considerar gastos ativos, divisoes ativas e acertos
  pagos.

Consequencia:

- operacoes de escrita ficam responsaveis por manter os acertos oficiais
  atualizados;
- consultas ficam previsiveis e sem efeito colateral.

## Decisao 2 - Recalculo apos edicao ou cancelamento de gasto

Ao editar valor, pagador ou participantes da divisao, ou ao cancelar um gasto, o
sistema deve recalcular divisoes, saldos e acertos pendentes.

Regras:

- gastos cancelados saem dos calculos;
- gastos cancelados permanecem em historico e auditoria;
- acertos pagos permanecem como historico financeiro;
- se a alteracao gerar novo saldo, o sistema cria novos acertos pendentes para
  compensacao.

Consequencia:

- o planejamento preserva o que ja foi marcado como pago;
- novos acertos pendentes representam apenas a pendencia financeira restante.

## Decisao 3 - Cancelamento ou reabertura de acerto pago

O criador podera cancelar ou reabrir um acerto marcado como `PAGO`.

Regras:

- a acao deve remover o efeito financeiro daquele pagamento;
- a acao deve manter auditoria;
- apos a acao, o sistema deve recalcular os acertos pendentes;
- a confirmacao de recebimento pelo recebedor permanece fora do MVP.

Consequencia:

- pagamento registrado por engano pode ser revertido sem apagar historico;
- o recebedor nao precisa confirmar recebimento nesta fase.

### Clarificacao do contrato atual

A implementacao contratual consolidada aceita exclusivamente a reabertura
`PAGO -> PENDENTE`. O estado `CANCELADO` nao e origem de reabertura. A operacao
preserva o mesmo identificador, somente e concluida quando a obrigacao permanece
valida apos retirar o efeito do pagamento e registra auditoria na mesma
transacao da reconciliacao. Esta clarificacao substitui a interpretacao anterior
do Swagger que permitia "cancelado ou pago", sem alterar o historico desta
decisao.

## Decisao 4 - Gastos `PENDENTE_REVISAO`

Gastos com status `PENDENTE_REVISAO` nao devem entrar nos acertos oficiais ate
serem revisados e confirmados.

Regras:

- devem aparecer no detalhe do planejamento como pendentes de revisao;
- podem aparecer em totais provisorios separados;
- nao devem gerar acertos oficiais;
- devem bloquear fechamento do planejamento enquanto nao forem revisados;
- gastos variaveis replicados, como luz, agua e mercado, devem nascer como
  `PENDENTE_REVISAO`.

Consequencia:

- valores mensais incertos nao geram cobrancas oficiais antes da revisao;
- o usuario continua vendo o impacto potencial em uma area provisoria.

## Decisao 5 - Status do planejamento

Evitar ambiguidade em `DELETE /planejamentos/:id`.

Endpoints preferenciais:

- `PATCH /planejamentos/:id/fechar`;
- `PATCH /planejamentos/:id/arquivar`;
- `PATCH /planejamentos/:id/cancelar`.

Se `DELETE /planejamentos/:id` for mantido, ele deve ser claramente documentado
como cancelamento logico, nunca exclusao fisica.

Consequencia:

- a API comunica melhor a intencao de cada transicao;
- exclusao fisica de planejamento fica fora do MVP.

## Decisao 6 - Participante removido

Participantes removidos nao devem ser apagados fisicamente.

Regras:

- participante `REMOVIDO` nao entra em novos gastos;
- participante `REMOVIDO` continua visivel em historico, divisoes antigas e
  acertos pendentes;
- se houver pendencia financeira, ela deve continuar aparecendo no
  resumo/acertos.

Consequencia:

- o historico financeiro permanece integro;
- remocao de participante nao apaga dividas ou creditos ja existentes.

## Decisao 7 - Divisoes com valor muito baixo

No MVP, nao permitir divisao quando `valorCentavos` for menor que a quantidade
de participantes selecionados.

Motivos:

- evitar divisoes com `0` centavo;
- garantir que cada participante selecionado tenha pelo menos 1 centavo de
  responsabilidade;
- simplificar regras financeiras e testes do MVP.

Consequencia:

- payloads com valor insuficiente para a quantidade de participantes devem ser
  rejeitados por regra de negocio ou validacao de dominio.

## Decisao 8 - Lifecycle operacional separado da situacao financeira

O estado do planejamento e operacional. A situacao financeira e derivada dos
fatos financeiros e nao sera persistida nesta fase.

Decisao definitiva:

```text
FECHADO congela a origem das obrigacoes financeiras, mas nao impede a liquidacao
ou correcao posterior dos acertos existentes.
```

Consequencias:

- fechamento nao significa quitacao e acertos pendentes nao impedem fechar;
- `FECHADO + PENDENTE` e uma combinacao valida;
- em `FECHADO`, entidades e historico permanecem visiveis, mas ficam bloqueadas
  a adicao, remocao ou edicao de participantes, a criacao, edicao ou cancelamento
  de gastos e as alteracoes de pagador ou divisoes;
- pagamentos, cancelamentos de marcacao incorreta, reaberturas validas e
  reconciliacao operacional de acertos existentes continuam permitidos;
- como regra de dominio, a data efetiva do pagamento deve ser registrada quando
  informada; o contrato atual nao recebe essa data e usa o instante em que o
  acerto e marcado como pago;
- pagamento tardio nao reabre o planejamento e nao altera seu periodo original;
- `ARQUIVADO` e somente leitura e exige planejamento `FECHADO` sem obrigacao
  financeira residual valida;
- a quitacao considera gastos validos, divisoes ativas, acertos pagos, acertos
  cancelados ou obsoletos e a reconciliacao atual, nao apenas a inexistencia
  fisica de linhas `PENDENTE`;
- `CANCELADO` exige planejamento `ABERTO + QUITADO`, preserva participantes,
  gastos, divisoes, acertos, pagamentos e historico, permite apenas os ajustes
  de acertos `PENDENTE` feitos pela reconciliacao oficial e torna o agregado
  terminal e somente leitura;
- `QUITADO` nao integra e nao deve ser adicionado a `PlanejamentoStatus`.

Representacao conceitual derivada:

```ts
type SituacaoFinanceiraPlanejamento =
  | 'PENDENTE'
  | 'QUITADO';
```
