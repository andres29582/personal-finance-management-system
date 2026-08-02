# ADR - Decisoes de implementacao para Planejamentos Compartilhados

> Nota de status:
> Este ADR preserva as decisoes historicas e registra clarificacoes aceitas
> depois da implementacao. O contrato HTTP oficial deve ser conferido em
> `backendnest/swagger.yaml`. Declaracoes antigas de futuro sao mantidas como
> contexto e podem ter sido superadas pelas decisoes posteriores deste ADR.

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

Clarificacao atual: o status e os campos de suporte existem no modelo, mas o
fluxo de replicacao mensal ainda e roadmap. Esta decisao rege o comportamento
quando esse fluxo vier a ser implementado; hoje, `PENDENTE_REVISAO` ja bloqueia
o fechamento e nao integra o resumo oficial.

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

## Decisao 9 - Participante proprietario vinculado

Ao criar o planejamento, o agregado cria ou reutiliza uma linha de participante
que representa o proprietario. Essa linha possui `usuarioId` do criador,
`tipo = VINCULADO` e `status = ATIVO`.

Consequencias:

- o proprietario participa corretamente de gastos, divisoes e acertos;
- planejamento, participante proprietario e auditoria de criacao compartilham
  a mesma transacao;
- falha da auditoria desfaz todo o agregado criado;
- a propriedade continua sendo definida por `usuarioCriadorId`, nao pela linha
  de participante.

## Decisao 10 - Acesso compartilhado por vinculo ativo

Um usuario nao proprietario recebe acesso somente quando existe participante
com os tres criterios simultaneos:

```text
usuarioId correspondente
tipo = VINCULADO
status = ATIVO
```

O participante vinculado ativo pode ler o agregado, criar gasto em `ABERTO`,
sincronizar acertos em `ABERTO` ou `FECHADO` e pagar apenas o acerto em que
representa o devedor. Administracao de participantes, edicao/cancelamento de
gastos, correcoes de acertos e lifecycle permanecem exclusivos do
proprietario.

Esta decisao supera a premissa inicial de que somente o criador teria acesso e
a previsao de que participantes vinculados seriam exclusivamente futuros.

## Decisao 11 - Autorizacao fail-closed e separacao de propriedade

A query central de acesso exige explicitamente `VINCULADO + ATIVO`; registros
inconsistentes `MANUAL` ou `CONVIDADO` com `usuarioId`, assim como participantes
`PENDENTE` ou `REMOVIDO`, nao concedem acesso. Identidade ou agregado ausente
tambem resulta em ausencia de capacidade.

O proprietario permanece autorizado pelo ramo independente
`planejamento.usuarioCriadorId = usuarioId`. Recursos inacessiveis sao ocultados
com `404 PLANEJAMENTO_NOT_FOUND`.

## Decisao 12 - Auditoria transacional

As mutacoes implementadas de planejamento, participantes, gastos e acertos usam
`logEntityEventTransactional` com o mesmo `EntityManager` da operacao. A
auditoria e a ultima escrita logica dentro da transacao e sua falha provoca
rollback da mutacao e de todos os efeitos derivados.

Payloads usam apenas IDs, status, valores e campos operacionais necessarios.
Nome, email, descricao, categoria, observacao, DTO completo e entidades
completas nao devem ser registrados. Sincronizacao sem alteracao real nao gera
evento. Em concorrencia, somente a transicao vencedora gera audit log.

O evento de reabertura preserva o nome historico
`ACERTO_PLANEJAMENTO_REABERTO`; nao deve ser renomeado sem analise de
compatibilidade.

## Decisao 13 - Historico financeiro preservado

Remocao e cancelamento sao logicos. Participantes removidos, gastos e divisoes
cancelados e acertos historicos permanecem persistidos para explicar fatos
financeiros anteriores. `ARQUIVADO` e `CANCELADO` preservam o agregado completo
em somente leitura.

Consequencia: autorizacao de acesso atual e elegibilidade para novas operacoes
nao devem ser confundidas com a necessidade de carregar registros historicos
nos calculos e nas consultas do agregado.

## Roadmap preservado

Continuam futuros: edicao de planejamento, listagem dedicada/edicao de
participante, convite por token, replicacao mensal, upload real de comprovante,
confirmacao de recebimento, divisao percentual/manual e integracao automatica
com transacoes pessoais.
