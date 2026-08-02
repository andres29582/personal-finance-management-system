# Planejamentos Compartilhados - Modelo de dados

## Status e fontes

O modelo persistido atual e definido pelas entities em
`backendnest/src/planejamentos/entities`, pelas migrations
`backendnest/migrations/0007_create_planejamentos_compartilhados.sql` e
`0005_add_audit_log.sql` e pelos enums do modulo. Campos conceituais e entidades
futuras aparecem em secoes separadas.

## Modelo persistido atual

### `planejamento`

| Coluna | Tipo | Nulo | Observacao |
| --- | --- | --- | --- |
| `id` | UUID | nao | Chave primaria. |
| `usuario_criador_id` | UUID | nao | FK para `usuario`; identifica o proprietario. |
| `nome` | varchar(150) | nao | Nome do planejamento. |
| `descricao` | varchar(500) | sim | Descricao opcional. |
| `tipo` | varchar(20) | nao | `CASA`, `FESTA`, `VIAGEM`, `EVENTO`, `GRUPO` ou `OUTRO`. |
| `status` | varchar(20) | nao | `ABERTO`, `FECHADO`, `ARQUIVADO` ou `CANCELADO`. |
| `data_inicio` | date | sim | Inicio opcional. |
| `data_fim` | date | sim | Fim opcional. |
| `created_at` | timestamp | nao | Criacao. |
| `updated_at` | timestamp | nao | Ultima atualizacao. |
| `deleted_at` | timestamp | sim | Suporte a exclusao logica; lifecycle nao usa exclusao fisica. |

Nao existem `mesReferencia`, `planejamentoOrigemId`, ordem ou campos de
replicacao no planejamento atual.

### `participante_planejamento`

| Coluna | Tipo | Nulo | Observacao |
| --- | --- | --- | --- |
| `id` | UUID | nao | Chave primaria. |
| `planejamento_id` | UUID | nao | FK para planejamento com `ON DELETE CASCADE`. |
| `usuario_id` | UUID | sim | FK para usuario com `ON DELETE SET NULL`. |
| `nome` | varchar(150) | nao | Nome apresentado no agregado. |
| `email` | varchar(150) | sim | Email opcional; nao concede acesso. |
| `tipo` | varchar(20) | nao | `MANUAL`, `CONVIDADO` ou `VINCULADO`. |
| `status` | varchar(20) | nao | `ATIVO`, `PENDENTE` ou `REMOVIDO`. |
| `created_at` | timestamp | nao | Criacao. |
| `updated_at` | timestamp | nao | Ultima atualizacao. |

O acesso compartilhado exige `usuario_id` correspondente,
`tipo = VINCULADO` e `status = ATIVO`. Email, linha `MANUAL` ou `CONVIDADO`,
status `PENDENTE` ou `REMOVIDO` nao concedem acesso.

Nao existem telefone, observacao, ordem, token ou timestamps de convite nessa
tabela.

### `gasto_planejamento`

| Coluna | Tipo | Nulo | Observacao |
| --- | --- | --- | --- |
| `id` | UUID | nao | Chave primaria. |
| `planejamento_id` | UUID | nao | FK para planejamento com `ON DELETE CASCADE`. |
| `descricao` | varchar(255) | nao | Descricao do gasto. |
| `valor_centavos` | integer | nao | Valor positivo em centavos. |
| `data_gasto` | date | nao | Data civil do gasto. |
| `categoria` | varchar(100) | sim | Categoria textual opcional. |
| `comportamento` | varchar(20) | nao | `FIXO`, `VARIAVEL` ou `EVENTUAL`. |
| `status` | varchar(20) | nao | `ATIVO`, `CANCELADO` ou `PENDENTE_REVISAO`. |
| `pago_por_participante_id` | UUID | nao | FK do participante pagador. |
| `observacao` | varchar(500) | sim | Observacao opcional. |
| `comprovante_url` | varchar(500) | sim | Campo persistido, sem fluxo de upload atual. |
| `comprovante_nome` | varchar(255) | sim | Campo persistido, sem fluxo de upload atual. |
| `mes_referencia` | varchar(7) | sim | `YYYY-MM`; aceito nos DTOs de gasto. |
| `ultima_alteracao_valor_em` | timestamp | sim | Atualizado quando o valor muda. |
| `requer_revisao_mensal` | boolean | nao | Default `false`; nao implementa replicacao por si so. |
| `created_at` | timestamp | nao | Criacao. |
| `updated_at` | timestamp | nao | Ultima atualizacao. |
| `deleted_at` | timestamp | sim | Campo de exclusao logica; cancelamento usa status. |

`comprovante_url` e `comprovante_nome` nao sao aceitos pelos DTOs atuais de
criacao/edicao e nao significam upload implementado. Nao existe
`gastoOrigemId` nem `valorReplicadoDeMes`.

### `divisao_gasto`

| Coluna | Tipo | Nulo | Observacao |
| --- | --- | --- | --- |
| `id` | UUID | nao | Chave primaria. |
| `gasto_id` | UUID | nao | FK para gasto com `ON DELETE CASCADE`. |
| `participante_id` | UUID | nao | FK para participante. |
| `valor_devido_centavos` | integer | nao | Parcela positiva em centavos. |
| `status` | varchar(20) | nao | `ATIVA` ou `CANCELADA`. |
| `created_at` | timestamp | nao | Criacao. |
| `updated_at` | timestamp | nao | Ultima atualizacao. |

Nao existe coluna de ordem, percentual ou valor manual informado. A ordem
deterministica e resolvida pela regra de dominio ao criar as divisoes.

### `acerto_planejamento`

| Coluna | Tipo | Nulo | Observacao |
| --- | --- | --- | --- |
| `id` | UUID | nao | Chave primaria. |
| `planejamento_id` | UUID | nao | FK para planejamento com `ON DELETE CASCADE`. |
| `de_participante_id` | UUID | nao | FK do devedor. |
| `para_participante_id` | UUID | nao | FK do recebedor. |
| `valor_centavos` | integer | nao | Valor positivo. |
| `status` | varchar(20) | nao | `PENDENTE`, `PAGO`, `CONFIRMADO` ou `CANCELADO`. |
| `data_pagamento` | timestamp | sim | Instante do pagamento; limpo em cancelamento/reabertura. |
| `observacao` | varchar(500) | sim | Campo persistido, nao aceito pelo endpoint atual de pagamento. |
| `created_at` | timestamp | nao | Criacao. |
| `updated_at` | timestamp | nao | Ultima atualizacao. |

`CONFIRMADO` existe no schema e participa dos calculos como pagamento efetivo,
mas nao existe endpoint atual de confirmacao pelo recebedor.

### `audit_log`

Audit logs nao pertencem exclusivamente ao modulo, mas registram seus eventos.
Campos persistidos:

| Coluna | Tipo | Nulo |
| --- | --- | --- |
| `id` | uuid | nao |
| `created_at` | timestamp without time zone | nao |
| `level` | varchar(20) | nao |
| `event` | varchar(60) | nao |
| `module` | varchar(40) | nao |
| `action` | varchar(40) | nao |
| `success` | boolean | nao |
| `message` | varchar(255) | sim |
| `user_id` | uuid | sim |
| `entity` | varchar(40) | sim |
| `entity_id` | uuid | sim |
| `method` | varchar(10) | sim |
| `route` | varchar(255) | sim |
| `status_code` | integer | sim |
| `ip` | varchar(45) | sim |
| `user_agent` | varchar(255) | sim |
| `details` | jsonb | sim |

Nos eventos transacionais de Planejamentos, contexto HTTP como `statusCode` e
details operacionais sao mapeados para essas colunas. O timestamp e
`created_at`. Os payloads nao devem conter nomes, emails, observacoes, DTOs ou
entidades completas.

## Relacionamentos

```text
Usuario 1 --- N Planejamento (proprietario)
Planejamento 1 --- N ParticipantePlanejamento
Usuario 0..1 --- N ParticipantePlanejamento
Planejamento 1 --- N GastoPlanejamento
ParticipantePlanejamento 1 --- N GastoPlanejamento (pagador)
GastoPlanejamento 1 --- N DivisaoGasto
ParticipantePlanejamento 1 --- N DivisaoGasto
Planejamento 1 --- N AcertoPlanejamento
ParticipantePlanejamento 1 --- N AcertoPlanejamento (devedor/recebedor)
```

## Constraints e indices atuais

A migration `0007` define:

- primary keys UUID nas cinco tabelas;
- checks dos enums de planejamento, participante, gasto, divisao e acerto;
- checks positivos para valores de gasto, divisao e acerto;
- check de `mes_referencia` no formato `YYYY-MM`;
- FKs descritas acima;
- indices por proprietario/status de planejamento;
- indices por planejamento/status e usuario/status de participante;
- unicidade parcial de participante ativo por `(planejamento_id, usuario_id)`;
- unicidade parcial de email ativo por `(planejamento_id, email)`;
- indices de gastos, divisoes e acertos por suas FKs e status;
- unicidade parcial de acerto `PENDENTE` por planejamento, devedor, recebedor e
  valor.

O indice parcial de participante nao inclui `tipo`. A autorizacao fail-closed e
garantida pela query, que exige explicitamente `VINCULADO + ATIVO`.

A migration `0005` cria indices de auditoria por data, usuario/data, evento,
modulo e status HTTP.

## Modelo conceitual de roadmap - nao persistido atualmente

Os itens desta secao nao fazem parte do schema nem do contrato HTTP atual.
Somente devem ser promovidos ao modelo persistido quando a funcionalidade
correspondente for especificada.

### Marcos temporais especificos

Timestamps dedicados como `fechadoEm`, `arquivadoEm`, `canceladoEm`,
`removidoEm` ou `reabertoEm` podem ser considerados futuramente caso consultas
diretas desses marcos justifiquem a desnormalizacao. Hoje o historico e
preservado pelos status, `updated_at` e eventos de `audit_log`; esses campos
especificos nao existem.

### Convites

Um fluxo futuro de convite pode exigir uma estrutura conceitual com referencias
ao planejamento e participante, hash de token seguro, status, expiracao, aceite
e timestamps. Token em texto puro nao deve ser persistido. `CONVIDADO` ja
existe no enum, mas nao existe tabela, token, expiracao nem endpoint de convite.

### Upload de comprovante

`comprovante_url` e `comprovante_nome` existem em `gasto_planejamento`, mas nao
ha upload real. Uma implementacao futura pode exigir chave de armazenamento,
tipo MIME, tamanho, ator do envio e timestamp, possivelmente em entidade
separada. Nenhum desses campos adicionais esta persistido atualmente.

### Replicacao mensal

Referencias como `planejamentoOrigemId`, `gastoOrigemId` e mes de origem podem
ser necessarias para rastrear replicacoes futuras. Nao existem hoje entidade de
replicacao/recorrencia nem essas referencias no planejamento ou no gasto.

Tambem permanecem conceituais telefone ou observacao do participante, ordem
persistida da divisao, percentual ou valor manual de divisao e timestamp de
confirmacao pelo recebedor. Historico atual e preservado pelos status das
entidades e por `audit_log`.
