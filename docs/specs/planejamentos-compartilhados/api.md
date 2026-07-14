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
| `POST` | `/planejamentos/:id/participantes` | Adiciona participante manual. |
| `POST` | `/planejamentos/:planejamentoId/gastos` | Registra o gasto, suas divisoes e reconcilia os acertos pendentes do planejamento na mesma transacao. |
| `GET` | `/planejamentos/:planejamentoId/gastos` | Lista gastos do planejamento. |
| `GET` | `/planejamentos/:planejamentoId/gastos/:gastoId` | Consulta gasto do planejamento. |
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
| `PATCH` | `/planejamentos/:id/gastos/:gastoId` | Edita gasto e recalcula divisoes. |
| `DELETE` | `/planejamentos/:id/gastos/:gastoId` | Cancela gasto logicamente. |
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
  "pagoPorParticipanteId": "uuid",
  "comportamentoFinanceiro": "VARIAVEL",
  "participantesDivisao": ["uuid-ana", "uuid-bruno", "uuid-carla"],
  "observacaoComprovante": "Conta enviada no grupo"
}
```

Resposta conceitual:

```json
{
  "id": "uuid",
  "planejamentoId": "uuid",
  "descricao": "Luz",
  "valorCentavos": 18500,
  "dataGasto": "2026-07-10",
  "pagoPorParticipanteId": "uuid",
  "comportamentoFinanceiro": "VARIAVEL",
  "status": "ATIVO",
  "divisoes": [
    {
      "participanteId": "uuid-ana",
      "valorCentavos": 6167
    },
    {
      "participanteId": "uuid-bruno",
      "valorCentavos": 6167
    },
    {
      "participanteId": "uuid-carla",
      "valorCentavos": 6166
    }
  ]
}
```

### Editar gasto

`PATCH /planejamentos/:id/gastos/:gastoId`

```json
{
  "descricao": "Luz revisada",
  "valorCentavos": 19240,
  "pagoPorParticipanteId": "uuid-bruno",
  "participantesDivisao": ["uuid-ana", "uuid-bruno", "uuid-carla"],
  "status": "ATIVO"
}
```

Ao alterar `valorCentavos`, `pagoPorParticipanteId` ou
`participantesDivisao`, o backend deve recalcular divisoes, saldos e acertos.
Se existirem acertos `PAGO`, eles devem permanecer como historico financeiro, e
novos acertos `PENDENTE` devem representar apenas a compensacao restante.

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
