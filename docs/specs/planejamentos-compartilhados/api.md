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
| `POST` | `/planejamentos/:id/participantes` | Adiciona participante atomicamente; duplicidades ativas por nome manual, email ou usuario vinculado retornam conflito `409`. |
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
| `PATCH` | `/planejamentos/:id/fechar` | Fecha planejamento quando nao houver pendencias impeditivas. |
| `PATCH` | `/planejamentos/:id/arquivar` | Arquiva planejamento sem exclusao fisica. |
| `PATCH` | `/planejamentos/:id/cancelar` | Cancela planejamento logicamente. |
| `DELETE` | `/planejamentos/:id` | Atalho opcional para cancelamento logico, nunca exclusao fisica. |
| `GET` | `/planejamentos/:id/participantes` | Lista participantes. |
| `PATCH` | `/planejamentos/:id/participantes/:participanteId` | Edita participante. |
| `DELETE` | `/planejamentos/:id/participantes/:participanteId` | Remove participante logicamente. |
| `GET` | `/planejamentos/:id/resumo` | Retorna resumo financeiro do planejamento. |
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

Endpoints preferenciais:

```text
PATCH /planejamentos/:id/fechar
PATCH /planejamentos/:id/arquivar
PATCH /planejamentos/:id/cancelar
```

Regras conceituais:

- `fechar` deve bloquear fechamento enquanto houver gastos `PENDENTE_REVISAO`;
- `arquivar` preserva historico e nao exclui registros;
- `cancelar` e cancelamento logico;
- se `DELETE /planejamentos/:id` for mantido, ele deve ser tratado como
  cancelamento logico, nunca exclusao fisica.

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
  um centavo para cada participante.

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

## Endpoint de resumo

`GET /planejamentos/:id/resumo`

O resumo oficial deve considerar gastos ativos, divisoes ativas e acertos pagos.
Gastos `PENDENTE_REVISAO` nao devem gerar acertos oficiais; eles podem aparecer
em totais provisorios separados.

Resposta conceitual:

```json
{
  "planejamentoId": "uuid",
  "totalCentavos": 394700,
  "participantes": [
    {
      "participanteId": "uuid-ana",
      "nome": "Ana",
      "totalPagoCentavos": 300000,
      "totalDevidoCentavos": 131567,
      "saldoCentavos": 168433,
      "statusFinanceiro": "RECEBEDOR"
    },
    {
      "participanteId": "uuid-bruno",
      "nome": "Bruno",
      "totalPagoCentavos": 94600,
      "totalDevidoCentavos": 131567,
      "saldoCentavos": -36967,
      "statusFinanceiro": "DEVEDOR"
    }
  ],
  "gastosPendentesRevisao": [
    {
      "gastoId": "uuid",
      "descricao": "Luz",
      "valorReplicadoDeMes": "2026-06"
    }
  ]
}
```

`statusFinanceiro` conceitual:

- `DEVEDOR`, quando `saldoCentavos < 0`;
- `RECEBEDOR`, quando `saldoCentavos > 0`;
- `QUITADO`, quando `saldoCentavos = 0`.

## Endpoint de acertos

`GET /planejamentos/:id/acertos`

Consulta de acertos nao deve alterar o banco de dados. Os acertos oficiais devem
ter sido materializados por operacoes de escrita anteriores. Gastos
`PENDENTE_REVISAO` nao devem gerar acertos oficiais ate serem revisados e
confirmados.

`POST /planejamentos/:planejamentoId/acertos/sincronizar` permanece disponivel
como sincronizacao explicita e idempotente para reparacao ou recuperacao
operacional dos acertos pendentes.

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

Payload opcional:

```json
{
  "observacao": "Pago via Pix"
}
```

Resposta conceitual:

```json
{
  "id": "uuid",
  "status": "PAGO",
  "pagoEm": "2026-07-03T10:30:00.000Z"
}
```

### Reabrir acerto

`PATCH /planejamentos/:id/acertos/:acertoId/reabrir`

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
