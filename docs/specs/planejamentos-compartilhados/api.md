# Planejamentos Compartilhados - API conceitual

## Fonte oficial

Este documento resume o contrato para leitura humana. Ele nao substitui:

```text
backendnest/swagger.yaml
```

Paths, metodos, schemas, codigos HTTP e seguranca devem ser confirmados no
Swagger antes de alterar consumidores.

## Autenticacao e ocultacao

Todas as rotas usam bearer JWT. Leitura e mutacoes permitidas a participante
exigem uma linha com `usuarioId` correspondente, `tipo = VINCULADO` e
`status = ATIVO`. Propriedade e verificada separadamente por
`usuarioCriadorId`.

Recursos inexistentes ou inacessiveis usam:

```text
404 PLANEJAMENTO_NOT_FOUND
```

Operacoes em que o usuario tem acesso, mas somente o proprietario pode agir,
podem retornar `403 PLANEJAMENTO_OWNER_REQUIRED` conforme documentado no
Swagger.

## Endpoints implementados

| Metodo | Path | Operacao |
| --- | --- | --- |
| `POST` | `/planejamentos` | Criar planejamento e participante proprietario. |
| `GET` | `/planejamentos` | Listar planejamentos acessiveis; aceita filtro `status`. |
| `GET` | `/planejamentos/:id` | Consultar detalhe acessivel. |
| `GET` | `/planejamentos/:id/resumo` | Consultar resumo financeiro derivado. |
| `PATCH` | `/planejamentos/:id/fechar` | Fechar planejamento aberto. |
| `PATCH` | `/planejamentos/:id/arquivar` | Arquivar planejamento fechado e quitado. |
| `PATCH` | `/planejamentos/:id/cancelar` | Cancelar planejamento aberto e quitado. |
| `POST` | `/planejamentos/:id/participantes` | Adicionar participante. |
| `DELETE` | `/planejamentos/:planejamentoId/participantes/:participanteId` | Remover participante logicamente. |
| `POST` | `/planejamentos/:planejamentoId/gastos` | Criar gasto e divisoes. |
| `GET` | `/planejamentos/:planejamentoId/gastos` | Listar gastos. |
| `GET` | `/planejamentos/:planejamentoId/gastos/:gastoId` | Consultar gasto. |
| `PATCH` | `/planejamentos/:planejamentoId/gastos/:gastoId` | Atualizar gasto ativo. |
| `PATCH` | `/planejamentos/:planejamentoId/gastos/:gastoId/cancelar` | Cancelar gasto. |
| `GET` | `/planejamentos/:planejamentoId/acertos` | Listar acertos persistidos. |
| `POST` | `/planejamentos/:planejamentoId/acertos/sincronizar` | Sincronizar acertos. |
| `PATCH` | `/planejamentos/:planejamentoId/acertos/:acertoId/pagar` | Pagar acerto pendente. |
| `PATCH` | `/planejamentos/:planejamentoId/acertos/:acertoId/cancelar` | Cancelar acerto pendente ou pago. |
| `PATCH` | `/planejamentos/:planejamentoId/acertos/:acertoId/reabrir` | Reabrir acerto pago. |

Nao existe endpoint dedicado para listar participantes. O detalhe de
planejamento inclui a colecao completa acessivel.

## Requests atuais

### Criar planejamento

`POST /planejamentos`

```json
{
  "nome": "Viagem",
  "descricao": "Ferias do grupo",
  "tipo": "VIAGEM",
  "dataInicio": "2026-09-01",
  "dataFim": "2026-09-10"
}
```

`nome` e `tipo` sao obrigatorios. `descricao`, `dataInicio` e `dataFim` sao
opcionais. Tipos: `CASA`, `FESTA`, `VIAGEM`, `EVENTO`, `GRUPO`, `OUTRO`.

`CreatePlanejamentoDto` nao aceita campos de proprietario nem status. O
`ValidationPipe` global usa `whitelist: true` e `forbidNonWhitelisted: true`;
portanto, campos extras sao rejeitados pela validacao HTTP.
`usuarioCriadorId`, status inicial `ABERTO` e participante proprietario
`VINCULADO + ATIVO` sao definidos exclusivamente pelo backend.

### Filtro de listagem

`GET /planejamentos?status=ABERTO`

Status aceitos: `ABERTO`, `FECHADO`, `ARQUIVADO`, `CANCELADO`.

### Adicionar participante

`POST /planejamentos/:id/participantes`

Participante manual:

```json
{
  "nome": "Ana",
  "email": "ana@example.com"
}
```

Participante vinculado:

```json
{
  "nome": "Bruno",
  "usuarioId": "00000000-0000-0000-0000-000000000000"
}
```

Campos aceitos: `nome`, `email?`, `usuarioId?`. Nao existem `telefone`,
`observacao`, `tipo` ou `status` no request. O service deriva tipo e status.

### Criar gasto

`POST /planejamentos/:planejamentoId/gastos`

```json
{
  "descricao": "Hospedagem",
  "valorCentavos": 120000,
  "dataGasto": "2026-09-01",
  "comportamento": "EVENTUAL",
  "pagoPorParticipanteId": "00000000-0000-0000-0000-000000000001",
  "participantesIds": [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002"
  ],
  "categoria": "Hospedagem",
  "observacao": "Reserva do grupo",
  "mesReferencia": "2026-09"
}
```

Obrigatorios: `descricao`, `valorCentavos`, `dataGasto`, `comportamento`,
`pagoPorParticipanteId`, `participantesIds`. Opcionais: `categoria`,
`observacao`, `mesReferencia`.

`comportamento`: `FIXO`, `VARIAVEL` ou `EVENTUAL`. O request atual nao aceita
`comprovanteUrl`, `comprovanteNome`, `status` ou configuracao de percentual.

### Atualizar gasto

`PATCH /planejamentos/:planejamentoId/gastos/:gastoId`

Aceita pelo menos um dos mesmos campos editaveis da criacao:

```json
{
  "valorCentavos": 125000,
  "participantesIds": [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002"
  ]
}
```

Todos os campos sao opcionais isoladamente, mas o request deve informar ao
menos um campo. Request vazio e rejeitado com
`PLANEJAMENTO_GASTO_ATUALIZACAO_VAZIA`; um DTO valido semanticamente equivalente
ao estado atual retorna sem escrita, reconciliacao ou audit log. `status` nao e
editavel por este endpoint.

Somente `categoria`, `observacao` e `mesReferencia` aceitam `null` no DTO de
atualizacao. Para esses tres campos:

- campo omitido mantem o valor atual;
- campo enviado como `null` remove o valor opcional;
- campo enviado com valor atualiza o valor.

Essa semantica nao se aplica aos demais campos, que nao aceitam `null`.

### Lifecycle, cancelamentos e acertos

Os seguintes endpoints nao recebem body:

```text
PATCH /planejamentos/:id/fechar
PATCH /planejamentos/:id/arquivar
PATCH /planejamentos/:id/cancelar
DELETE /planejamentos/:planejamentoId/participantes/:participanteId
PATCH /planejamentos/:planejamentoId/gastos/:gastoId/cancelar
POST /planejamentos/:planejamentoId/acertos/sincronizar
PATCH /planejamentos/:planejamentoId/acertos/:acertoId/pagar
PATCH /planejamentos/:planejamentoId/acertos/:acertoId/cancelar
PATCH /planejamentos/:planejamentoId/acertos/:acertoId/reabrir
```

Em especial, pagar acerto nao aceita `dataPagamento` nem `observacao`; o
backend registra o instante da operacao.

## Politica por endpoint

| Grupo | Proprietario | Vinculado ativo |
| --- | --- | --- |
| Listar/detalhe/gastos/resumo/acertos | permitido | permitido |
| Adicionar/remover participante | `ABERTO` | proibido |
| Criar gasto | `ABERTO` | `ABERTO` |
| Editar/cancelar gasto | `ABERTO`, gasto `ATIVO` | proibido |
| Sincronizar acertos | `ABERTO` ou `FECHADO` | `ABERTO` ou `FECHADO` |
| Pagar acerto | acerto `PENDENTE` | apenas quando representa o devedor |
| Cancelar/reabrir acerto | conforme estado | proibido |
| Lifecycle | conforme pre-condicoes | proibido |

## Resumo e acertos

`GET /planejamentos/:id/resumo` e uma consulta pura. Retorna totais, saldos por
participante, obrigacao residual e `situacaoFinanceira` derivada como
`PENDENTE` ou `QUITADO`.

`GET /planejamentos/:planejamentoId/acertos` lista registros persistidos em
todos os status. `POST .../sincronizar` e a mutacao explicita para materializar
o plano atual e retorna os acertos oficiais conforme o schema do Swagger.

## Lifecycle

- fechar: `ABERTO`, sem gasto `PENDENTE_REVISAO`; quitacao nao e exigida;
- arquivar: somente `FECHADO + QUITADO`;
- cancelar planejamento: somente `ABERTO + QUITADO`;
- `ARQUIVADO` e `CANCELADO`: somente leitura;
- todas as transicoes: exclusivas do proprietario.

## Matriz concisa de erros atuais

Os codigos abaixo sao observaveis no service e/ou no Swagger atual. Erros
genericos do framework sao descritos pela categoria HTTP, sem inventar codigo
simbolico.

| Categoria | HTTP | Codigos ou situacoes confirmadas |
| --- | --- | --- |
| Validacao HTTP | `400` | Body, parametro UUID ou query invalidos; inclui campos extras rejeitados pelo `ValidationPipe`. |
| Autenticacao | `401` | JWT ausente, invalido ou sessao nao autenticada. |
| Ocultacao de recurso | `404` | `PLANEJAMENTO_NOT_FOUND`. |
| Propriedade obrigatoria | `403` | `PLANEJAMENTO_OWNER_REQUIRED`. |
| Conflito de duplicidade | `409` | `PLANEJAMENTO_PARTICIPANTE_DUPLICADO`. |
| Regra estrutural | `422` | `PLANEJAMENTO_PERIODO_INVALIDO`, `PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO`, `PLANEJAMENTO_ACERTO_OPERACAO_STATUS_INVALIDO`. |
| Lifecycle | `422` | `PLANEJAMENTO_FECHAR_STATUS_INVALIDO`, `PLANEJAMENTO_FECHAR_GASTO_PENDENTE_REVISAO`, `PLANEJAMENTO_ARQUIVAR_STATUS_INVALIDO`, `PLANEJAMENTO_ARQUIVAR_PENDENCIA_FINANCEIRA`, `PLANEJAMENTO_CANCELAR_STATUS_INVALIDO`, `PLANEJAMENTO_CANCELAR_PENDENCIA_FINANCEIRA`. |
| Participantes | `404`/`422` | `PLANEJAMENTO_PARTICIPANTE_NOT_FOUND`, `PLANEJAMENTO_PARTICIPANTE_REMOVER_STATUS_INVALIDO`, `PLANEJAMENTO_PARTICIPANTE_PROPRIETARIO_NAO_REMOVIVEL`. |
| Gastos | `404`/`422` | `PLANEJAMENTO_GASTO_NOT_FOUND`, `PLANEJAMENTO_GASTO_ATUALIZACAO_VAZIA`, `PLANEJAMENTO_GASTO_ATUALIZAR_STATUS_INVALIDO`, `PLANEJAMENTO_GASTO_CANCELAR_STATUS_INVALIDO`, `PLANEJAMENTO_GASTO_DIVISOES_ATIVAS_OBRIGATORIAS`, `PLANEJAMENTO_PAGADOR_INVALIDO`, `PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO`, `PARTICIPANTE_DUPLICADO`, `VALOR_MENOR_QUE_PARTICIPANTES`. |
| Acertos | `403`/`404`/`422` | `PLANEJAMENTO_ACERTO_PAGAR_FORBIDDEN`, `PLANEJAMENTO_ACERTO_NOT_FOUND`, `PLANEJAMENTO_ACERTO_PAGAR_STATUS_INVALIDO`, `PLANEJAMENTO_ACERTO_CANCELAR_STATUS_INVALIDO`, `PLANEJAMENTO_ACERTO_REABRIR_STATUS_INVALIDO`, `PLANEJAMENTO_ACERTO_REABRIR_OBSOLETO`. |

A matriz nao enumera toda excecao interna: registra apenas os erros relevantes
ao contrato observavel atual. A divergencia `403` versus `404` das leituras
indicadas acima permanece separada e nao muda esses codigos.

## Roadmap / endpoints nao implementados

Os paths abaixo sao apenas conceituais e nao existem no Swagger atual:

```text
PATCH /planejamentos/:id
GET /planejamentos/:id/participantes
PATCH /planejamentos/:id/participantes/:participanteId
POST /planejamentos/:id/replicar
```

Tambem permanecem futuros convite por token, upload real de comprovante,
confirmacao de recebimento, divisao percentual/manual e integracao com
transacoes pessoais.
