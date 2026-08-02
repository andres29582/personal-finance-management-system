# Planejamentos Compartilhados - Requisitos

## Status e fontes de verdade

O modulo de Planejamentos esta implementado no backend NestJS e no frontend
Expo/React Native. Este documento descreve o comportamento atual e separa o
roadmap de funcionalidades ainda nao entregues.

A fonte oficial do contrato HTTP e `backendnest/swagger.yaml`. Controllers,
DTOs, services, repository, entities, enums, frontend e testes confirmam as
regras operacionais. Em caso de divergencia, este documento nao substitui o
Swagger nem o codigo.

## Objetivo implementado

Planejamentos organiza gastos de um grupo sem criar automaticamente transacoes
financeiras pessoais. O agregado permite:

- criar, listar e consultar planejamentos acessiveis;
- manter participantes manuais ou vinculados;
- registrar, editar e cancelar gastos com divisao igualitaria em centavos;
- consultar resumo financeiro e acertos persistidos;
- sincronizar, pagar, cancelar e reabrir acertos conforme autorizacao e estado;
- fechar, arquivar ou cancelar o planejamento;
- preservar historico e auditar transacionalmente as mutacoes implementadas.

## Atores e acesso atual

### Proprietario

O proprietario e identificado por:

```text
planejamento.usuarioCriadorId = usuario autenticado
```

Conforme estado e regras financeiras, pode consultar o agregado, administrar
participantes, criar, editar e cancelar gastos, sincronizar acertos, pagar,
cancelar e reabrir acertos e executar o lifecycle.

### Participante vinculado ativo

O acesso compartilhado exige simultaneamente:

```text
participante.usuarioId = usuario autenticado
participante.tipo = VINCULADO
participante.status = ATIVO
```

Esse ator pode listar e consultar planejamentos acessiveis, ler participantes,
gastos, resumo e acertos pelos endpoints existentes, criar gasto em
planejamento `ABERTO`, sincronizar acertos em `ABERTO` ou `FECHADO` e pagar
somente acerto em que representa o devedor.

Nao pode adicionar ou remover participantes, editar ou cancelar gastos,
cancelar ou reabrir acertos nem executar lifecycle. Registros `MANUAL`,
`CONVIDADO`, `PENDENTE` ou `REMOVIDO` nao concedem acesso autenticado, mesmo
quando uma linha inconsistente `MANUAL` ou `CONVIDADO` possui `usuarioId`.

Planejamento inexistente ou inacessivel preserva a ocultacao do recurso:

```text
404 PLANEJAMENTO_NOT_FOUND
```

## Participante proprietario

Ao criar um planejamento, a mesma transacao:

1. persiste o planejamento com status `ABERTO`;
2. cria ou reutiliza o participante que representa o proprietario;
3. associa esse participante ao `usuarioId` do criador;
4. garante `tipo = VINCULADO` e `status = ATIVO`;
5. registra `PLANEJAMENTO_CRIADO`.

Falha na auditoria desfaz planejamento, participante e audit log. Portanto, nao
e correto afirmar que a criacao deixa o agregado sem participantes.

## Funcionalidades implementadas atualmente

### Planejamento e lifecycle

- criar planejamento;
- listar planejamentos acessiveis, com filtro opcional de status;
- consultar detalhe e agregado acessivel;
- consultar resumo financeiro derivado;
- fechar planejamento;
- arquivar planejamento;
- cancelar planejamento.

### Participantes

- adicionar participante;
- remover participante logicamente, preservando o historico;
- consultar participantes como parte do detalhe do planejamento.

Nao existe endpoint dedicado para listar ou editar participantes.

### Gastos

- criar gasto;
- listar gastos;
- consultar gasto especifico;
- atualizar parcialmente gasto ativo;
- cancelar gasto logicamente;
- persistir divisoes igualitarias deterministicas;
- reconciliar acertos depois de mutacoes financeiras.

### Resumo e acertos

- consultar resumo financeiro sem efeitos colaterais;
- listar acertos persistidos;
- sincronizar acertos de forma explicita e idempotente;
- pagar acerto pendente;
- cancelar acerto pendente ou pago, conforme regra do proprietario;
- reabrir acerto pago para pendente quando a obrigacao ainda for valida.

## Participantes, tipos e status

- `MANUAL`: representa pessoa do grupo sem acesso autenticado obrigatorio;
- `VINCULADO`: associa um participante a um usuario real e concede acesso
  somente quando estiver `ATIVO`;
- `CONVIDADO`: valor persistivel do enum, mas o fluxo de convite por token nao
  esta implementado;
- `PENDENTE`: nao concede acesso;
- `REMOVIDO`: nao concede acesso e permanece no historico financeiro.

## Lifecycle e situacao financeira

O estado operacional persistido e:

```text
ABERTO -> FECHADO -> ARQUIVADO
ABERTO -> CANCELADO
```

`PlanejamentoStatus` contem apenas `ABERTO`, `FECHADO`, `ARQUIVADO` e
`CANCELADO`. A situacao financeira `PENDENTE` ou `QUITADO` e derivada; nao
existe `PlanejamentoStatus.QUITADO`.

- `FECHADO` congela participantes, gastos, pagador e divisoes, mas permite
  sincronizar, pagar e corrigir acertos;
- fechar nao exige quitacao, mas gasto `PENDENTE_REVISAO` bloqueia fechamento;
- arquivar exige `FECHADO + QUITADO`;
- cancelar exige `ABERTO + QUITADO`; gasto `PENDENTE_REVISAO` nao bloqueia
  isoladamente essa transicao;
- `ARQUIVADO` e `CANCELADO` sao somente leitura;
- todas as transicoes de lifecycle sao exclusivas do proprietario.

## Requisitos financeiros implementados

- valores sao inteiros em centavos;
- todo gasto possui pagador e ao menos um participante na divisao;
- a soma das divisoes equivale exatamente ao valor do gasto;
- centavos restantes sao distribuidos deterministicamente;
- gastos e divisoes cancelados nao participam dos calculos atuais;
- acertos `PAGO` e `CONFIRMADO` reduzem o saldo aberto;
- acertos `PENDENTE` e `CANCELADO` nao representam pagamento efetivo;
- consultas de detalhe, gastos, resumo e acertos nao reconciliam nem escrevem;
- gastos ou acertos nao criam transacoes pessoais automaticamente.

## Auditoria implementada

As mutacoes atuais registram, quando aplicavel:

- `PLANEJAMENTO_CRIADO`;
- `PLANEJAMENTO_FECHADO`;
- `PLANEJAMENTO_ARQUIVADO`;
- `PLANEJAMENTO_CANCELADO`;
- `PLANEJAMENTO_PARTICIPANTE_ADICIONADO`;
- `PLANEJAMENTO_PARTICIPANTE_REMOVIDO`;
- `PLANEJAMENTO_GASTO_CRIADO`;
- `PLANEJAMENTO_GASTO_ATUALIZADO`;
- `PLANEJAMENTO_GASTO_CANCELADO`;
- `PLANEJAMENTO_ACERTOS_SINCRONIZADOS`;
- `PLANEJAMENTO_ACERTO_PAGO`;
- `PLANEJAMENTO_ACERTO_CANCELADO`;
- `ACERTO_PLANEJAMENTO_REABERTO`.

Esses eventos usam o mesmo `EntityManager` da mutacao. A auditoria e a ultima
escrita logica da transacao e sua falha provoca rollback. Payloads evitam nome,
email, observacao, DTO completo e entidades completas. Sincronizacao sem
alteracao real nao gera evento.

## Rastreabilidade atual

### Requisitos implementados

| ID | Requisito vigente | Evidencia funcional |
| --- | --- | --- |
| `REQ-IMP-01` | Criar planejamento `ABERTO` com participante proprietario `VINCULADO + ATIVO`. | Criacao transacional do agregado. |
| `REQ-IMP-02` | Garantir ao proprietario acesso e capacidades administrativas conforme estado. | `usuarioCriadorId` e guards do service/frontend. |
| `REQ-IMP-03` | Conceder acesso compartilhado somente a participante `VINCULADO + ATIVO` com `usuarioId` correspondente. | Query acessivel e autorizacao frontend fail-closed. |
| `REQ-IMP-04` | Ocultar planejamento inexistente ou inacessivel. | `404 PLANEJAMENTO_NOT_FOUND` observado no service e E2E. |
| `REQ-IMP-05` | Manter participantes manuais sem conceder acesso autenticado. | Tipo `MANUAL` e testes negativos de acesso. |
| `REQ-IMP-06` | Registrar gastos e divisoes igualitarias inteiras, exatas e deterministicas. | Dominio de divisao e fluxos de gasto. |
| `REQ-IMP-07` | Calcular resumo financeiro puro, saldos e situacao derivada. | Endpoint de resumo e funcoes de dominio. |
| `REQ-IMP-08` | Persistir, sincronizar, pagar, cancelar e reabrir acertos conforme ator e estado. | Service e E2E de acertos. |
| `REQ-IMP-09` | Executar lifecycle somente pelo proprietario e conforme status e situacao financeira. | Fechar, arquivar e cancelar. |
| `REQ-IMP-10` | Auditar mutacoes cobertas no mesmo commit ou rollback da operacao. | Eventos transacionais com o mesmo `EntityManager`. |
| `REQ-IMP-11` | Preservar participantes removidos, gastos, divisoes, pagamentos e acertos como historico. | Cancelamentos logicos e consultas do agregado. |
| `REQ-IMP-12` | Isolar dados entre usuarios e impedir que vinculos inconsistentes concedam acesso. | Filtro por proprietario ou `usuarioId + VINCULADO + ATIVO`. |

## Requisitos de roadmap

Os itens abaixo nao fazem parte do contrato atual:

| ID | Requisito futuro |
| --- | --- |
| `REQ-ROAD-01` | Editar dados basicos do planejamento. |
| `REQ-ROAD-02` | Disponibilizar endpoint dedicado para listar participantes. |
| `REQ-ROAD-03` | Editar participante. |
| `REQ-ROAD-04` | Replicar planejamento e recorrencias mensais. |
| `REQ-ROAD-05` | Convidar por token, com expiracao e aceite. |
| `REQ-ROAD-06` | Fazer upload real de comprovante. |
| `REQ-ROAD-07` | Confirmar recebimento pelo recebedor. |
| `REQ-ROAD-08` | Dividir por percentual ou valor manual avancado. |
| `REQ-ROAD-09` | Integrar automaticamente com transacoes pessoais. |
| `REQ-ROAD-10` | Enviar notificacoes e executar pagamentos reais. |

Campos persistidos que apoiam evolucao, como `mesReferencia`,
`ultimaAlteracaoValorEm`, `requerRevisaoMensal`, `comprovanteUrl` e
`comprovanteNome`, nao significam que replicacao ou upload estejam
implementados.

## Fora do escopo atual

- separar Planejamentos em microservico;
- gateway de pagamento ou Open Finance;
- criacao automatica de receita, despesa ou transferencia pessoal;
- convite por email/token;
- dashboard global ou relatorios avancados exclusivos de Planejamentos.

## Requisitos nao funcionais vigentes

| ID | Requisito nao funcional |
| --- | --- |
| `REQ-NF-01` | Exigir autenticacao JWT e sessao ativa em todas as rotas. |
| `REQ-NF-02` | Aplicar autorizacao fail-closed e ocultar recursos inacessiveis. |
| `REQ-NF-03` | Usar transacoes e, nos fluxos concorrentes previstos, lock pessimista e revalidacao. |
| `REQ-NF-04` | Preservar idempotencia e serializacao nos fluxos concorrentes. |
| `REQ-NF-05` | Executar calculos monetarios inteiros e deterministicos. |
| `REQ-NF-06` | Manter `backendnest/swagger.yaml` como contrato HTTP oficial. |
| `REQ-NF-07` | Cobrir regras com testes unitarios, frontend e E2E em PostgreSQL real. |
| `REQ-NF-08` | Preservar historico financeiro e excluir dados sensiveis dos payloads de auditoria. |
