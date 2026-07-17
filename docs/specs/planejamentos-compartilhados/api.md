# Planejamentos Compartilhados - API conceitual

> Nota de status:
> Este documento contem especificacoes conceituais e itens de roadmap. O
> contrato atual implementado deve ser conferido no Swagger oficial
> (`backendnest/swagger.yaml`) e na validacao documental disponivel em
> `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`.

## Visao geral

Este documento descreve endpoints planejados para o modulo de Planejamentos
Compartilhados. A API deve seguir o padrao REST do backend NestJS atual, com JWT,
DTOs validados, respostas padronizadas e documentacao Swagger/OpenAPI quando a
implementacao for iniciada.

Rotas conceituais usam o prefixo:

```text
/planejamentos
```

Todas as rotas do MVP devem ser autenticadas.

## Contrato atual implementado

Endpoints atualmente implementados no backend e documentados no Swagger oficial:

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/planejamentos` | Cria planejamento compartilhado. |
| `GET` | `/planejamentos` | Lista planejamentos do usuario autenticado. |
| `GET` | `/planejamentos/:id` | Consulta detalhes do planejamento. |
| `GET` | `/planejamentos/:id/resumo` | Retorna o resumo financeiro derivado, sem persistencia, reconciliacao ou alteracao do agregado. |
| `PATCH` | `/planejamentos/:id/fechar` | Fecha operacionalmente um planejamento `ABERTO`, com lock, reconciliacao final e preservacao dos acertos pendentes. |
| `PATCH` | `/planejamentos/:id/arquivar` | Arquiva transacionalmente um planejamento `FECHADO + QUITADO` e o torna somente leitura sem excluir seu historico. |
| `POST` | `/planejamentos/:id/participantes` | Adiciona participante atomicamente; duplicidades ativas por nome manual, email ou usuario vinculado retornam conflito `409`. |
| `DELETE` | `/planejamentos/:planejamentoId/participantes/:participanteId` | Remove participante ativo logicamente, sem recalcular obrigacoes existentes; operacao exclusiva do proprietario. |
| `POST` | `/planejamentos/:planejamentoId/gastos` | Registra o gasto, suas divisoes e reconcilia os acertos pendentes do planejamento na mesma transacao. |
| `GET` | `/planejamentos/:planejamentoId/gastos` | Lista gastos do planejamento. |
| `GET` | `/planejamentos/:planejamentoId/gastos/:gastoId` | Consulta gasto do planejamento. |
| `PATCH` | `/planejamentos/:planejamentoId/gastos/:gastoId` | Atualiza parcialmente um gasto ativo e, quando houver alteracao financeira, reconcilia seus efeitos de forma transacional; operacao exclusiva do proprietario. |
| `PATCH` | `/planejamentos/:planejamentoId/gastos/:gastoId/cancelar` | Cancela logicamente o gasto e reconcilia os acertos atomicamente; operacao exclusiva do proprietario. |
| `GET` | `/planejamentos/:planejamentoId/acertos` | Lista acertos oficiais persistidos. |
| `POST` | `/planejamentos/:planejamentoId/acertos/sincronizar` | Executa sincronizacao explicita e idempotente dos acertos pendentes para reparacao ou recuperacao operacional. |
| `PATCH` | `/planejamentos/:planejamentoId/acertos/:acertoId/pagar` | Marca acerto como pago. |
| `PATCH` | `/planejamentos/:planejamentoId/acertos/:acertoId/cancelar` | Cancela acerto mantendo historico. |
| `PATCH` | `/planejamentos/:planejamentoId/acertos/:acertoId/reabrir` | Reabre acerto para pendente. |

## Roadmap / futuro

Os endpoints abaixo sao planejamento futuro e nao devem ser tratados como
contrato disponivel no backend atual.

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `PATCH` | `/planejamentos/:id` | Edita dados basicos do planejamento. |
| `PATCH` | `/planejamentos/:id/cancelar` | Cancela planejamento logicamente. |
| `DELETE` | `/planejamentos/:id` | Atalho opcional para cancelamento logico, nunca exclusao fisica. |
| `GET` | `/planejamentos/:id/participantes` | Lista participantes. |
| `PATCH` | `/planejamentos/:id/participantes/:participanteId` | Edita participante. |
| `POST` | `/planejamentos/:id/replicar` | Replica planejamento mensal. |

## Payloads conceituais

### Criar planejamento

`POST /planejamentos`

```json
{
  "nome": "Casa compartilhada - Julho/2026",
  "descricao": "Despesas mensais do apartamento",
  "tipo": "CASA",
  "mesReferencia": "2026-07"
}
```

Resposta conceitual:

```json
{
  "id": "uuid",
  "nome": "Casa compartilhada - Julho/2026",
  "descricao": "Despesas mensais do apartamento",
  "tipo": "CASA",
  "status": "ABERTO",
  "mesReferencia": "2026-07",
  "criadoEm": "2026-07-03T10:00:00.000Z"
}
```

### Editar planejamento

`PATCH /planejamentos/:id`

```json
{
  "nome": "Casa compartilhada - Julho/2026",
  "descricao": "Despesas revisadas do apartamento",
  "status": "ABERTO"
}
```

Campos editaveis no MVP:

- `nome`;
- `descricao`;
- `tipo`, se nao houver restricao de dominio;
- `mesReferencia`;
- `status`, para transicoes permitidas.

### Alterar status do planejamento

Endpoints implementados:

```text
PATCH /planejamentos/:id/fechar
PATCH /planejamentos/:id/arquivar
```

Endpoints de roadmap:

```text
PATCH /planejamentos/:id/cancelar
POST /planejamentos/:id/replicar
```

Regras conceituais:

- `fechar` deve bloquear fechamento enquanto houver gastos `PENDENTE_REVISAO`;
- `fechar` exige proprietario autenticado, planejamento `ABERTO`, transacao
  serializada no agregado e reconciliacao final dos acertos;
- `fechar` preserva acertos pendentes e nao exige quitacao total;
- `arquivar` exige planejamento `FECHADO` sem obrigacao financeira residual
  valida, calculada pelo resumo financeiro oficial depois da reconciliacao;
- `arquivar` exige proprietario autenticado e executa acesso, propriedade,
  lock pessimista, recarga do agregado, reconciliacao, nova recarga, calculo do
  resumo e persistencia do status em uma unica transacao;
- se a reconciliacao ou a validacao financeira falhar, toda alteracao da
  transacao sofre rollback;
- `ARQUIVADO` preserva detalhe, gastos, acertos, resumo e historico para
  consulta, mas bloqueia mutacoes estruturais, financeiras e de acertos;
- `cancelar` e cancelamento logico, mas seu efeito sobre obrigacoes existentes
  permanece a definir antes da implementacao;
- se `DELETE /planejamentos/:id` for mantido, ele deve ser tratado como
  cancelamento logico, nunca exclusao fisica.

O status do planejamento representa seu ciclo operacional. A situacao financeira
e derivada, nao persistida nesta fase, e conceitualmente possui os valores
`PENDENTE` e `QUITADO`. Nao deve existir `PlanejamentoStatus.QUITADO`.

Em `FECHADO`, entidades e historico permanecem visiveis. Ficam bloqueadas a
adicao, remocao ou edicao de participantes, a criacao, edicao ou cancelamento de
gastos e as alteracoes de pagador ou divisoes. Consulta, pagamento e correcao de
acertos existentes, alem de sincronizacao para consistencia operacional que nao
altere a origem das obrigacoes, continuam permitidos. Portanto,
`FECHADO + PENDENTE` e valido.

O fechamento implementado nao recebe body e retorna o planejamento com status
`FECHADO`. Erros de dominio atuais:

- `403 PLANEJAMENTO_OWNER_REQUIRED`: usuario com acesso nao e proprietario;
- `404 PLANEJAMENTO_NOT_FOUND`: planejamento inexistente ou inacessivel;
- `422 PLANEJAMENTO_FECHAR_STATUS_INVALIDO`: planejamento nao esta `ABERTO`,
  com `statusAtual` nos detalhes;
- `422 PLANEJAMENTO_FECHAR_GASTO_PENDENTE_REVISAO`: existe gasto com revisao
  pendente.

As mutacoes estruturais implementadas exigem planejamento `ABERTO`: adicionar
ou remover participante e criar, editar ou cancelar gasto. Quando o planejamento
esta `FECHADO`, `ARQUIVADO` ou `CANCELADO`, elas retornam
`422 PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO`, com `statusAtual` nos
detalhes. Consultas e operacoes de acerto nao usam esse bloqueio estrutural.
Operacoes de acerto usam politica propria e sao permitidas somente em `ABERTO`
ou `FECHADO`; em `ARQUIVADO` ou `CANCELADO`, retornam
`422 PLANEJAMENTO_ACERTO_OPERACAO_STATUS_INVALIDO`, com `statusAtual`.

O arquivamento nao recebe body e retorna o planejamento com status
`ARQUIVADO`. Erros de dominio:

- `403 PLANEJAMENTO_OWNER_REQUIRED`: usuario com acesso nao e proprietario;
- `404 PLANEJAMENTO_NOT_FOUND`: planejamento inexistente ou inacessivel;
- `422 PLANEJAMENTO_ARQUIVAR_STATUS_INVALIDO`: planejamento nao esta
  `FECHADO`, com `statusAtual` nos detalhes;
- `422 PLANEJAMENTO_ARQUIVAR_PENDENCIA_FINANCEIRA`: resumo oficial retorna
  `PENDENTE`, com `situacaoFinanceira` e `obrigacaoResidualCentavos`.

### Adicionar participante

`POST /planejamentos/:id/participantes`

```json
{
  "nome": "Ana",
  "email": "ana@example.com",
  "telefone": "+5511999999999"
}
```

Resposta conceitual:

```json
{
  "id": "uuid",
  "planejamentoId": "uuid",
  "nome": "Ana",
  "email": "ana@example.com",
  "telefone": "+5511999999999",
  "tipo": "MANUAL",
  "status": "ATIVO"
}
```

### Editar participante

`PATCH /planejamentos/:id/participantes/:participanteId`

```json
{
  "nome": "Ana Silva",
  "email": "ana.silva@example.com",
  "telefone": "+5511988888888"
}
```

### Remover participante

`DELETE /planejamentos/:planejamentoId/participantes/:participanteId`

Operacao sem corpo e exclusiva do proprietario. A operacao e executada de forma
transacional e serializada no agregado do planejamento, altera somente o status
de `ATIVO` para `REMOVIDO` e retorna o participante recarregado depois do commit.
O participante do usuario criador nao pode ser removido.

Nenhum gasto, divisao ou acerto e cancelado ou alterado. A operacao nao executa
reconciliacao, nao cria transacoes financeiras pessoais e preserva o
participante nas relacoes e calculos historicos enquanto ele for financeiramente
relevante. Participantes removidos nao podem ser usados como novos pagadores ou
introduzidos em novas divisoes.

Erros:

- `403 PLANEJAMENTO_OWNER_REQUIRED`: usuario autenticado nao e proprietario;
- `404 PLANEJAMENTO_NOT_FOUND`: planejamento inexistente ou inacessivel;
- `404 PLANEJAMENTO_PARTICIPANTE_NOT_FOUND`: participante inexistente ou de
  outro planejamento;
- `422 PLANEJAMENTO_PARTICIPANTE_REMOVER_STATUS_INVALIDO`: participante nao
  esta `ATIVO`;
- `422 PLANEJAMENTO_PARTICIPANTE_PROPRIETARIO_NAO_REMOVIVEL`: participante
  representa o usuario criador do planejamento;
- `422 PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO`: planejamento nao esta
  `ABERTO`.

### Registrar gasto

`POST /planejamentos/:id/gastos`

Registra o gasto, suas divisoes e reconcilia os acertos pendentes do
planejamento na mesma transacao. Qualquer falha durante a persistencia ou a
reconciliacao causa rollback integral. A operacao nao cria automaticamente
transacoes financeiras pessoais.

```json
{
  "descricao": "Luz",
  "valorCentavos": 18500,
  "dataGasto": "2026-07-10",
  "comportamento": "VARIAVEL",
  "pagoPorParticipanteId": "uuid",
  "participantesIds": [
    "uuid-ana",
    "uuid-bruno",
    "uuid-carla"
  ],
  "observacao": "Conta enviada no grupo",
  "mesReferencia": "2026-07"
}
```

Resposta conceitual:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "planejamentoId": "uuid",
    "descricao": "Luz",
    "valorCentavos": 18500,
    "dataGasto": "2026-07-10",
    "comportamento": "VARIAVEL",
    "pagoPorParticipanteId": "uuid",
    "observacao": "Conta enviada no grupo",
    "mesReferencia": "2026-07",
    "status": "ATIVO",
    "divisoes": [
      {
        "participanteId": "uuid-ana",
        "valorDevidoCentavos": 6167,
        "status": "ATIVA"
      },
      {
        "participanteId": "uuid-bruno",
        "valorDevidoCentavos": 6167,
        "status": "ATIVA"
      },
      {
        "participanteId": "uuid-carla",
        "valorDevidoCentavos": 6166,
        "status": "ATIVA"
      }
    ]
  },
  "timestamp": "2026-07-10T12:00:00.000Z",
  "requestId": "uuid-request"
}
```

### Editar gasto

`PATCH /planejamentos/:planejamentoId/gastos/:gastoId`

```json
{
  "descricao": "Luz revisada",
  "valorCentavos": 19240,
  "dataGasto": "2026-07-11",
  "comportamento": "VARIAVEL",
  "pagoPorParticipanteId": "uuid-bruno",
  "participantesIds": [
    "uuid-ana",
    "uuid-bruno",
    "uuid-carla"
  ],
  "categoria": null,
  "observacao": "Valor conferido",
  "mesReferencia": "2026-07"
}
```

Todos os campos sao opcionais, mas o body deve conter ao menos uma propriedade.
`categoria`, `observacao` e `mesReferencia` aceitam `null` para limpeza.
`status` nao e editavel por este endpoint. A operacao e exclusiva do
proprietario, e somente gastos com status `ATIVO` podem ser atualizados.

O efeito depende dos campos realmente alterados:

- alteracao somente descritiva salva o gasto, sem recriar divisoes nem
  reconciliar acertos;
- mudanca somente do pagador preserva as divisoes, recalcula os saldos e
  reconcilia os acertos pendentes;
- mudanca de `valorCentavos` ou do conjunto de `participantesIds` cancela
  somente as divisoes `ATIVA`, preserva divisoes ja `CANCELADA`, cria novas
  divisoes `ATIVA` e reconcilia os acertos na mesma transacao.

A ordem de `participantesIds` nao possui significado financeiro, mas listas
com identificadores duplicados sao invalidas. Referencias historicas ja
vinculadas podem permanecer mesmo que o participante tenha sido inativado
posteriormente; pagadores ou participantes realmente novos precisam estar
ativos.

Acertos `PAGO`, `CONFIRMADO` e `CANCELADO` permanecem como historico. Acertos
`PENDENTE` sao reconciliados e podem gerar compensacoes. Uma alteracao real de
`valorCentavos` atualiza `ultimaAlteracaoValorEm`. A operacao nao cria
transacoes financeiras pessoais. Qualquer falha na transacao causa rollback
integral.

Erros relevantes:

- `400 VALIDATION_ERROR`: campo com tipo, formato, limite ou enum invalido
  conforme a validacao estrutural;
- `401 UNAUTHORIZED`: JWT ausente ou invalido;
- `403 PLANEJAMENTO_OWNER_REQUIRED`: usuario com acesso nao e proprietario;
- `404 PLANEJAMENTO_NOT_FOUND`: usuario sem acesso ou planejamento inexistente;
- `404 PLANEJAMENTO_GASTO_NOT_FOUND`: gasto inexistente ou de outro
  planejamento;
- `422 PLANEJAMENTO_GASTO_ATUALIZACAO_VAZIA`: nenhum campo efetivo foi
  informado para atualizacao;
- `422 PLANEJAMENTO_GASTO_ATUALIZAR_STATUS_INVALIDO`: gasto nao esta `ATIVO`;
- `422 PLANEJAMENTO_GASTO_DIVISOES_ATIVAS_OBRIGATORIAS`: atualizacao financeira
  sem participantes informados e sem divisoes ativas existentes;
- `422 PLANEJAMENTO_PAGADOR_INVALIDO`: novo pagador nao e participante ativo;
- `422 PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO`: participante realmente novo
  da divisao nao esta ativo;
- `422 PARTICIPANTE_DUPLICADO`: `participantesIds` contem duplicidade;
- `422 VALOR_MENOR_QUE_PARTICIPANTES`: o valor nao permite distribuir ao menos
  um centavo para cada participante;
- `422 PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO`: planejamento nao esta
  `ABERTO`.

### Cancelar gasto

`PATCH /planejamentos/:planejamentoId/gastos/:gastoId/cancelar`

Operacao sem corpo e exclusiva do proprietario do planejamento. O gasto e
preservado com status `CANCELADO`; somente suas divisoes `ATIVA` passam para
`CANCELADA`, sem remocao fisica. O cancelamento e a reconciliacao dos acertos
pendentes ocorrem na mesma transacao, preservando acertos `PAGO`, `CONFIRMADO`
e `CANCELADO` como historico e criando pendencias compensatorias quando
necessario. A operacao nao cria transacoes financeiras pessoais.

Erros relevantes:

- `403 PLANEJAMENTO_OWNER_REQUIRED`: usuario com acesso nao e proprietario;
- `404 PLANEJAMENTO_NOT_FOUND`: usuario sem acesso ou planejamento inexistente;
- `404 PLANEJAMENTO_GASTO_NOT_FOUND`: gasto inexistente ou de outro planejamento;
- `422 PLANEJAMENTO_GASTO_CANCELAR_STATUS_INVALIDO`: gasto nao esta `ATIVO`.
- `422 PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO`: planejamento nao esta
  `ABERTO`.

## Endpoint de resumo

`GET /planejamentos/:id/resumo`

Endpoint implementado. O resumo oficial considera gastos `ATIVO`, divisoes
ativas e acertos `PAGO` ou `CONFIRMADO`. Gastos `CANCELADO` ou
`PENDENTE_REVISAO` nao entram nos totais oficiais. A consulta e pura: nao abre
transacao, nao adquire lock, nao reconcilia ou materializa acertos, nao persiste
entidades e nao altera o status operacional.

Resposta (`data` do envelope global de sucesso):

```json
{
  "planejamentoId": "uuid",
  "statusOperacional": "FECHADO",
  "situacaoFinanceira": "PENDENTE",
  "totalGastosAtivosCentavos": 10001,
  "obrigacaoResidualCentavos": 5000,
  "participantes": [
    {
      "participante": {
        "id": "uuid-ana",
        "nome": "Ana",
        "tipo": "VINCULADO",
        "status": "ATIVO"
      },
      "totalPagoCentavos": 10001,
      "totalDevidoCentavos": 5001,
      "totalPagoEmAcertosCentavos": 0,
      "totalRecebidoEmAcertosCentavos": 0,
      "saldoBrutoCentavos": 5000,
      "saldoAbertoCentavos": 5000,
      "statusFinanceiro": "RECEBEDOR"
    },
    {
      "participante": {
        "id": "uuid-bruno",
        "nome": "Bruno",
        "tipo": "MANUAL",
        "status": "ATIVO"
      },
      "totalPagoCentavos": 0,
      "totalDevidoCentavos": 5000,
      "totalPagoEmAcertosCentavos": 0,
      "totalRecebidoEmAcertosCentavos": 0,
      "saldoBrutoCentavos": -5000,
      "saldoAbertoCentavos": -5000,
      "statusFinanceiro": "DEVEDOR"
    }
  ]
}
```

`situacaoFinanceira` e `QUITADO` somente quando todos os
`saldoAbertoCentavos` sao zero; havendo qualquer saldo diferente de zero, e
`PENDENTE`. `obrigacaoResidualCentavos` soma apenas saldos abertos positivos
(lado credor), evitando contar a mesma obrigacao novamente pelo lado devedor.

Participantes ativos sao retornados na ordem deterministica do agregado.
Participante removido continua no resumo enquanto referenciado por gasto ativo,
divisao ativa ou acerto efetivo; removido sem relevancia financeira e excluido.
Nao sao expostos `usuarioId`, email ou entidades completas.

`statusFinanceiro`:

- `DEVEDOR`, quando `saldoAbertoCentavos < 0`;
- `RECEBEDOR`, quando `saldoAbertoCentavos > 0`;
- `QUITADO`, quando `saldoAbertoCentavos = 0`.

## Endpoint de acertos

`GET /planejamentos/:id/acertos`

Consulta de acertos nao deve alterar o banco de dados. Os acertos oficiais devem
ter sido materializados por operacoes de escrita anteriores. Gastos
`PENDENTE_REVISAO` nao devem gerar acertos oficiais ate serem revisados e
confirmados.

`POST /planejamentos/:planejamentoId/acertos/sincronizar` permanece disponivel
como sincronizacao explicita e idempotente para reparacao ou recuperacao
operacional dos acertos pendentes em planejamentos `ABERTO` ou `FECHADO`.
Planejamentos `ARQUIVADO` ou `CANCELADO` bloqueiam a operacao.

Resposta conceitual:

```json
{
  "planejamentoId": "uuid",
  "acertos": [
    {
      "id": "uuid",
      "devedorParticipanteId": "uuid-diego",
      "devedorNome": "Diego",
      "recebedorParticipanteId": "uuid-ana",
      "recebedorNome": "Ana",
      "valorCentavos": 5000,
      "status": "PENDENTE"
    }
  ]
}
```

### Marcar acerto como pago

`PATCH /planejamentos/:id/acertos/:acertoId/pagar`

O pagamento de acerto existente e permitido em planejamento `ABERTO` ou
`FECHADO`. Pagamento tardio nao reabre o planejamento, nao altera o periodo
original, nao cria gasto e nao modifica divisoes. A operacao e bloqueada em
`ARQUIVADO` ou `CANCELADO`.

Regra de dominio: a data efetiva do pagamento deve ser registrada quando
informada.

Comportamento do contrato atual: o endpoint nao recebe DTO nem data de pagamento;
o service atribui `new Date()` a `dataPagamento`, registrando o instante em que o
acerto e marcado como `PAGO`.

Evolucao futura compativel, fora desta branch e sem alteracao do Swagger atual:

```ts
type PagarAcertoDto = {
  dataPagamento?: string;
  observacao?: string;
};
```

Resposta conceitual:

```json
{
  "id": "uuid",
  "status": "PAGO",
  "dataPagamento": "2026-07-03T10:30:00.000Z"
}
```

### Reabrir acerto

`PATCH /planejamentos/:id/acertos/:acertoId/reabrir`

Permitido somente quando o planejamento esta `ABERTO` ou `FECHADO`; bloqueado
em `ARQUIVADO` ou `CANCELADO`.

Payload opcional:

```json
{
  "motivo": "Pagamento informado por engano"
}
```

Resposta conceitual:

```json
{
  "id": "uuid",
  "status": "PENDENTE",
  "reabertoEm": "2026-07-03T10:40:00.000Z"
}
```

### Cancelar acerto

`PATCH /planejamentos/:id/acertos/:acertoId/cancelar`

Permitido somente quando o planejamento esta `ABERTO` ou `FECHADO`; bloqueado
em `ARQUIVADO` ou `CANCELADO`.

Payload opcional:

```json
{
  "motivo": "Acerto cancelado apos revisao do planejamento"
}
```

Resposta conceitual:

```json
{
  "id": "uuid",
  "status": "CANCELADO",
  "canceladoEm": "2026-07-03T10:45:00.000Z"
}
```

O cancelamento deve preservar historico e auditoria. No MVP, ele nao deve criar,
alterar ou cancelar transacoes pessoais automaticamente.

## Endpoint de replicacao mensal

`POST /planejamentos/:id/replicar`

```json
{
  "nome": "Casa compartilhada - Agosto/2026",
  "mesReferencia": "2026-08",
  "replicarGastosEventuais": false
}
```

Resposta conceitual:

```json
{
  "planejamentoOrigemId": "uuid-julho",
  "planejamentoCriado": {
    "id": "uuid-agosto",
    "nome": "Casa compartilhada - Agosto/2026",
    "tipo": "CASA",
    "status": "ABERTO",
    "mesReferencia": "2026-08"
  },
  "participantesReplicados": 3,
  "gastosReplicados": 5,
  "gastosPendentesRevisao": 3
}
```

Regras conceituais:

- participantes ativos sao copiados;
- gastos fixos podem nascer `ATIVO`;
- gastos variaveis nascem `PENDENTE_REVISAO`;
- gastos eventuais nao sao replicados por padrao;
- acertos nao sao replicados.

## Erros esperados

| Codigo HTTP | Cenario | Codigo conceitual |
| --- | --- | --- |
| `400` | Payload invalido, valor menor ou igual a zero, enum invalido, mes invalido. | `VALIDATION_ERROR` |
| `401` | Requisicao sem JWT valido. | `UNAUTHORIZED` |
| `403` ou `404` | Recurso nao pertence ao usuario autenticado. | `PLANEJAMENTO_NOT_FOUND` ou `ACCESS_DENIED` |
| `404` | Planejamento, participante, gasto ou acerto inexistente. | `RESOURCE_NOT_FOUND` |
| `409` | Transicao de status invalida ou conflito com estado atual. | `INVALID_STATUS_TRANSITION` |
| `422` | Regra de negocio violada, como gasto sem participantes de divisao. | `BUSINESS_RULE_VIOLATION` |

Mensagens devem ser claras, em portugues, e sem revelar dados de outro usuario.

## Regras de autenticacao e autorizacao

- Todas as rotas do MVP devem usar `JwtAuthGuard`.
- O `usuarioId` deve vir do token autenticado, nunca do payload.
- Toda busca por planejamento deve filtrar por `id` e `usuarioId`.
- Participantes, gastos, divisoes e acertos devem ser validados contra o
  planejamento carregado do usuario autenticado.
- Tentativas de acesso a recurso de outro usuario devem retornar erro sem
  vazar existencia do recurso.
- Auditoria deve registrar usuario autenticado e recurso afetado nas acoes
  principais.

## Observacoes para Swagger/OpenAPI

- Criar tags dedicadas para `Planejamentos`.
- Documentar enums com exemplos:
  - `TipoPlanejamento`;
  - `StatusPlanejamento`;
  - `TipoParticipante`;
  - `StatusParticipante`;
  - `TipoComportamentoGasto`;
  - `StatusGasto`;
  - `StatusAcerto`.
- Informar que valores monetarios usam centavos.
- Documentar exemplos de divisao com sobra de centavos.
- Documentar que comprovante e opcional e upload real fica fora do MVP.
- Documentar que marcar acerto como pago nao cria transacao pessoal.
- Incluir respostas de erro para autenticacao, isolamento de dados e regras de
  negocio.
- Manter contratos alinhados aos DTOs quando a implementacao for criada.
