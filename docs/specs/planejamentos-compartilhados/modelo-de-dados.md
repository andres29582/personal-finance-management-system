# Planejamentos Compartilhados - Modelo de dados

## Objetivo do modelo

Documentar as entidades conceituais iniciais para orientar a implementacao do
modulo de Planejamentos Compartilhados no backend NestJS.

Este documento nao define migrations nem entidades TypeORM nesta fase. Os campos
abaixo sao proposta de modelagem para validacao tecnica e futura implementacao.

## Entidades propostas

Entidades minimas para o MVP:

- `Planejamento`
- `ParticipantePlanejamento`
- `GastoPlanejamento`
- `DivisaoGasto`
- `AcertoPlanejamento`

Entidades ou estruturas futuras documentadas:

- `ConvitePlanejamento`
- `HistoricoPlanejamento`
- `ComprovantePlanejamento`

## Planejamento

Representa o agrupador financeiro compartilhado.

| Campo | Tipo conceitual | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `id` | UUID | Sim | Identificador do planejamento. |
| `usuarioId` | UUID | Sim | Usuario criador e dono do planejamento no MVP. |
| `nome` | string | Sim | Nome exibido ao usuario. |
| `descricao` | string | Nao | Descricao livre. |
| `tipo` | enum `TipoPlanejamento` | Sim | `CASA`, `FESTA`, `VIAGEM`, `EVENTO`, `GRUPO`, `OUTRO`. |
| `status` | enum `StatusPlanejamento` | Sim | Inicialmente `ABERTO`. |
| `mesReferencia` | string `YYYY-MM` | Nao | Recomendado para planejamentos mensais. |
| `planejamentoOrigemId` | UUID | Nao | Prepara replicacao mensal. |
| `criadoEm` | datetime | Sim | Data de criacao. |
| `atualizadoEm` | datetime | Sim | Data da ultima atualizacao. |
| `fechadoEm` | datetime | Nao | Preparo para fechamento. |
| `arquivadoEm` | datetime | Nao | Quando status virar `ARQUIVADO`. |
| `canceladoEm` | datetime | Nao | Quando status virar `CANCELADO`. |

Relacionamentos:

- pertence a um usuario criador;
- possui muitos participantes;
- possui muitos gastos;
- possui muitos acertos;
- pode ter um planejamento de origem em replicacoes mensais;
- pode originar outros planejamentos replicados.

## ParticipantePlanejamento

Representa uma pessoa que participa do planejamento. No MVP, nao precisa ser
usuario real do sistema.

| Campo | Tipo conceitual | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `id` | UUID | Sim | Identificador do participante. |
| `planejamentoId` | UUID | Sim | Planejamento ao qual pertence. |
| `usuarioVinculadoId` | UUID | Nao | Futuro vinculo com usuario real. |
| `nome` | string | Sim | Nome informado manualmente. |
| `email` | string | Nao | Campo opcional para futuro convite. |
| `telefone` | string | Nao | Campo opcional. |
| `tipo` | enum `TipoParticipante` | Sim | No MVP, `MANUAL`. |
| `status` | enum `StatusParticipante` | Sim | Inicialmente `ATIVO`. |
| `ordem` | integer | Sim | Ordem estavel para listagem e desempates de centavos. |
| `criadoEm` | datetime | Sim | Data de criacao. |
| `atualizadoEm` | datetime | Sim | Data da ultima atualizacao. |
| `removidoEm` | datetime | Nao | Remocao logica. |

Relacionamentos:

- pertence a um planejamento;
- pode ser pagador de muitos gastos;
- pode participar de muitas divisoes;
- pode ser devedor em muitos acertos;
- pode ser recebedor em muitos acertos;
- futuramente pode estar vinculado a um usuario real.

## GastoPlanejamento

Representa uma despesa registrada dentro do planejamento.

| Campo | Tipo conceitual | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `id` | UUID | Sim | Identificador do gasto. |
| `planejamentoId` | UUID | Sim | Planejamento ao qual pertence. |
| `pagoPorParticipanteId` | UUID | Sim | Participante que pagou o gasto. |
| `gastoOrigemId` | UUID | Nao | Gasto original em caso de replicacao mensal. |
| `descricao` | string | Sim | Descricao do gasto. |
| `valorCentavos` | integer | Sim | Valor total em centavos, maior que zero. |
| `dataGasto` | date | Sim | Data do gasto. |
| `comportamentoFinanceiro` | enum `TipoComportamentoGasto` | Sim | `FIXO`, `VARIAVEL` ou `EVENTUAL`. |
| `status` | enum `StatusGasto` | Sim | `ATIVO`, `CANCELADO` ou `PENDENTE_REVISAO`. |
| `mesReferencia` | string `YYYY-MM` | Nao | Mes ao qual o gasto se refere. |
| `valorReplicadoDeMes` | string `YYYY-MM` | Nao | Mes de origem do valor copiado. |
| `valorAlteradoEm` | datetime | Nao | Ultima alteracao de valor. |
| `exigeRevisaoMensal` | boolean | Sim | Verdadeiro para variaveis replicados. |
| `observacaoComprovante` | string | Nao | Referencia textual opcional no MVP. |
| `comprovanteUrl` | string | Nao | Reservado para fase futura ou URL externa controlada. |
| `criadoPorUsuarioId` | UUID | Sim | No MVP, usuario criador. |
| `criadoEm` | datetime | Sim | Data de criacao. |
| `atualizadoEm` | datetime | Sim | Data da ultima atualizacao. |
| `canceladoEm` | datetime | Nao | Remocao logica do gasto. |

Relacionamentos:

- pertence a um planejamento;
- possui um participante pagador;
- possui muitas divisoes;
- pode ter um gasto de origem em replicacao mensal;
- pode originar gastos replicados futuros.

## DivisaoGasto

Representa a parte de um gasto atribuida a um participante.

| Campo | Tipo conceitual | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `id` | UUID | Sim | Identificador da divisao. |
| `gastoId` | UUID | Sim | Gasto dividido. |
| `participanteId` | UUID | Sim | Participante que deve essa parte. |
| `valorCentavos` | integer | Sim | Valor devido pelo participante. |
| `ordemDistribuicaoCentavos` | integer | Sim | Ordem usada para distribuir sobra de centavos. |
| `criadoEm` | datetime | Sim | Data de criacao. |
| `atualizadoEm` | datetime | Sim | Data da ultima atualizacao. |

Relacionamentos:

- pertence a um gasto;
- referencia um participante do mesmo planejamento do gasto.

Observacoes:

- A soma de `valorCentavos` de todas as divisoes de um gasto ativo deve ser
  exatamente igual a `GastoPlanejamento.valorCentavos`.
- A ordem de distribuicao deve ser persistida ou reconstruivel de forma
  deterministica.
- Ao editar participantes da divisao, a implementacao pode recriar as linhas de
  divisao do gasto, preservando historico por auditoria.

## AcertoPlanejamento

Representa um pagamento sugerido ou registrado entre participantes para quitar
saldos do planejamento.

| Campo | Tipo conceitual | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `id` | UUID | Sim | Identificador do acerto. |
| `planejamentoId` | UUID | Sim | Planejamento ao qual pertence. |
| `devedorParticipanteId` | UUID | Sim | Participante que deve pagar. |
| `recebedorParticipanteId` | UUID | Sim | Participante que deve receber. |
| `valorCentavos` | integer | Sim | Valor do acerto em centavos. |
| `status` | enum `StatusAcerto` | Sim | No MVP: `PENDENTE` e `PAGO`; futuros: `CONFIRMADO`, `CANCELADO`. |
| `versaoCalculo` | integer | Nao | Ajuda a rastrear recalculos. |
| `calculadoEm` | datetime | Sim | Momento em que o acerto foi calculado e materializado. |
| `pagoEm` | datetime | Nao | Momento em que foi marcado como pago. |
| `reabertoEm` | datetime | Nao | Momento da ultima reabertura. |
| `canceladoEm` | datetime | Nao | Momento do cancelamento. |
| `criadoEm` | datetime | Sim | Data de criacao. |
| `atualizadoEm` | datetime | Sim | Data da ultima atualizacao. |

Relacionamentos:

- pertence a um planejamento;
- referencia um participante devedor;
- referencia um participante recebedor;
- pode ter eventos de historico ou auditoria associados.

Observacoes:

- Acertos oficiais devem ser materializados e persistidos apos cada alteracao
  financeira relevante.
- Acertos `PENDENTE` podem ser recalculados e substituidos.
- Acertos `PAGO` nao devem ser apagados automaticamente.
- Consultas `GET` de resumo e acertos nao devem alterar o banco de dados.
- Ao editar gastos depois de acertos pagos, a implementacao deve preservar o
  que ja foi pago e recalcular pendencias restantes de forma auditavel.

## ConvitePlanejamento

Entidade futura para acesso por convidados. Fora do MVP.

| Campo | Tipo conceitual | Observacoes |
| --- | --- | --- |
| `id` | UUID | Identificador do convite. |
| `planejamentoId` | UUID | Planejamento convidado. |
| `participanteId` | UUID | Participante associado ao convite. |
| `tokenHash` | string | Hash do token, nunca token em claro. |
| `email` | string | Email de destino, se houver. |
| `status` | enum | `PENDENTE`, `ACEITO`, `EXPIRADO`, `REVOGADO`. |
| `expiraEm` | datetime | Expiracao do convite. |
| `aceitoEm` | datetime | Data de aceite. |
| `criadoEm` | datetime | Data de criacao. |

## HistoricoPlanejamento

Entidade futura ou alternativa complementar ao modulo de audit logs.

| Campo | Tipo conceitual | Observacoes |
| --- | --- | --- |
| `id` | UUID | Identificador do evento. |
| `planejamentoId` | UUID | Planejamento relacionado. |
| `usuarioId` | UUID | Usuario que executou a acao, quando houver. |
| `participanteId` | UUID | Participante relacionado, quando houver. |
| `tipoEvento` | string ou enum | Ex.: gasto criado, gasto cancelado, acerto pago. |
| `entidadeTipo` | string | Tipo da entidade afetada. |
| `entidadeId` | UUID | Identificador da entidade afetada. |
| `detalhes` | JSON | Dados sanitizados. |
| `criadoEm` | datetime | Data do evento. |

Observacao: se o `AuditLog` atual atender a rastreabilidade exigida, esta
entidade pode ser adiada.

## ComprovantePlanejamento

Entidade futura para upload real de comprovantes. Fora do MVP.

| Campo | Tipo conceitual | Observacoes |
| --- | --- | --- |
| `id` | UUID | Identificador do comprovante. |
| `gastoId` | UUID | Gasto associado. |
| `storageKey` | string | Chave do arquivo no provedor de storage. |
| `nomeOriginal` | string | Nome original do arquivo. |
| `mimeType` | string | Tipo do arquivo. |
| `tamanhoBytes` | integer | Tamanho do arquivo. |
| `enviadoPorUsuarioId` | UUID | Usuario que enviou. |
| `criadoEm` | datetime | Data de envio. |

## Enums

### TipoPlanejamento

- `CASA`
- `FESTA`
- `VIAGEM`
- `EVENTO`
- `GRUPO`
- `OUTRO`

### StatusPlanejamento

- `ABERTO`
- `FECHADO`
- `ARQUIVADO`
- `CANCELADO`

### TipoParticipante

- `MANUAL`
- `CONVIDADO`
- `VINCULADO`

No MVP, apenas `MANUAL` deve ser usado em fluxo real.

### StatusParticipante

- `ATIVO`
- `PENDENTE`
- `REMOVIDO`

No MVP, `PENDENTE` fica reservado para convites futuros.

### TipoComportamentoGasto

- `FIXO`
- `VARIAVEL`
- `EVENTUAL`

### StatusGasto

- `ATIVO`
- `CANCELADO`
- `PENDENTE_REVISAO`

### StatusAcerto

- `PENDENTE`
- `PAGO`
- `CONFIRMADO`
- `CANCELADO`

No MVP, o fluxo principal e `PENDENTE -> PAGO`. `CONFIRMADO` fica reservado para
confirmacao futura pelo recebedor.

## Relacionamentos principais

```text
Usuario 1 --- N Planejamento
Planejamento 1 --- N ParticipantePlanejamento
Planejamento 1 --- N GastoPlanejamento
GastoPlanejamento 1 --- N DivisaoGasto
ParticipantePlanejamento 1 --- N GastoPlanejamento como pagador
ParticipantePlanejamento 1 --- N DivisaoGasto
Planejamento 1 --- N AcertoPlanejamento
ParticipantePlanejamento 1 --- N AcertoPlanejamento como devedor
ParticipantePlanejamento 1 --- N AcertoPlanejamento como recebedor
Planejamento 1 --- N Planejamento como origem de replicacao mensal
GastoPlanejamento 1 --- N GastoPlanejamento como origem de replicacao mensal
```

## Observacoes para MER/DER futuro

- Todas as tabelas do modulo devem permitir rastrear `planejamentoId` direta ou
  indiretamente para facilitar isolamento por usuario.
- Chaves estrangeiras devem impedir que gastos, divisoes e acertos misturem
  participantes de planejamentos diferentes.
- Indices recomendados:
  - `planejamento.usuarioId`;
  - `planejamento.status`;
  - `planejamento.mesReferencia`;
  - `participante.planejamentoId`;
  - `participante.status`;
  - `gasto.planejamentoId`;
  - `gasto.status`;
  - `gasto.pagoPorParticipanteId`;
  - `divisao.gastoId`;
  - `divisao.participanteId`;
  - `acerto.planejamentoId`;
  - `acerto.status`.
- Exclusao fisica deve ser evitada em entidades com valor historico financeiro.
- Migrations futuras devem manter compatibilidade com `synchronize: false`.
- Campos monetarios devem usar inteiros em centavos e nunca `float`.

## Campos preparados para evolucao futura

- `usuarioVinculadoId` em participante para permitir associacao a usuario real.
- `tipo` e `status` de participante para suportar convidados e vinculos.
- `planejamentoOrigemId` em planejamento para replicacao mensal.
- `gastoOrigemId` em gasto para rastrear valores replicados.
- `valorReplicadoDeMes` e `valorAlteradoEm` para explicar revisao mensal.
- `observacaoComprovante` e `comprovanteUrl` como preparacao leve para
  comprovantes.
- `versaoCalculo` em acerto para rastrear recalculos.
- `CONFIRMADO` em acerto para confirmacao futura pelo recebedor.
- Entidades futuras de convite, historico especifico e comprovante podem ser
  adicionadas sem mudar o contrato principal do MVP.
