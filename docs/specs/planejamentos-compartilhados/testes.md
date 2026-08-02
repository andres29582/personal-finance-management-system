# Planejamentos Compartilhados - Estrategia de testes

## Status

Esta estrategia descreve a cobertura automatizada existente sem fixar um total
de testes, pois esse numero muda com frequencia. Itens sem endpoint ou fluxo
implementado aparecem somente como roadmap.

## Camadas atuais

### Dominio

As funcoes puras possuem suites para:

- divisao igualitaria e distribuicao deterministica de centavos;
- rejeicao de valor menor que a quantidade de participantes;
- saldos por participante;
- resumo financeiro e situacao `PENDENTE`/`QUITADO`;
- acertos minimos;
- identificacao do participante que representa o proprietario.

## Casos financeiros estaveis

| Caso | Resultado ou invariante esperado |
| --- | --- |
| Dividir `10000 / 3` | `3334, 3333, 3333`. |
| Dividir `10001 / 3` | `3334, 3334, 3333`. |
| Valor menor que a quantidade de participantes | Rejeicao com `VALOR_MENOR_QUE_PARTICIPANTES`; nenhuma parcela pode ser zero. |
| Soma das divisoes | Exatamente igual ao valor do gasto. |
| Soma dos saldos | Zero para o conjunto de participantes. |
| Acertos minimos | Nenhum acerto de valor zero e saldos reduzidos ate zerar. |
| Ordem | A mesma entrada ordenada produz os mesmos acertos e a mesma ordem. |
| Obrigacao residual | Soma somente o lado credor, sem dupla contagem de devedor e recebedor. |
| Acertos pagos | Permanecem como fatos historicos; somente pendencias restantes sao reconciliadas. |

### DTOs, enums e entities

`planejamento.dto.spec.ts`, `planejamentos-enums.spec.ts` e
`planejamentos-entities.spec.ts` validam os contratos realmente existentes:

- criacao de planejamento;
- filtro de listagem;
- parametros UUID;
- adicao de participante;
- criacao e atualizacao de gasto;
- enums e metadados das entidades.

Nao ha DTO de edicao de planejamento, edicao de participante, replicacao,
convite, upload ou body de pagamento. Esses itens nao pertencem a cobertura
atual.

### Repository

`planejamentos.repository.spec.ts` cobre:

- transacoes com repositories do mesmo `EntityManager`;
- query acessivel por proprietario ou participante
  `VINCULADO + ATIVO`;
- filtro fail-closed por `usuarioId`, tipo e status;
- hidratacao integral do agregado sem filtrar colecoes historicas;
- locks pessimistas;
- buscas e saves de planejamento, participante, gasto, divisao e acerto;
- ordenacao deterministica das consultas financeiras.

### Service

`planejamentos.service.spec.ts` cobre as operacoes publicas e regras de dominio,
incluindo:

- criacao do planejamento e do participante proprietario vinculado;
- acesso do proprietario e do participante vinculado ativo;
- rejeicoes por papel, status e recurso de outro planejamento;
- adicao e remocao de participante;
- criacao, edicao, no-op e cancelamento de gasto;
- calculo e reconciliacao de acertos;
- sincronizacao no-op e com alteracoes;
- pagamento por proprietario ou participante devedor;
- cancelamento e reabertura exclusivos do proprietario;
- fechar, arquivar e cancelar planejamento;
- propagacao de falha da auditoria e ausencia de releitura apos rollback;
- payload, ordem e mesmo `EntityManager` de cada evento transacional.

### Controller

`planejamentos.controller.spec.ts` valida delegacao, usuario autenticado,
parametros, DTOs e ausencia de body nos endpoints de lifecycle e acertos que nao
o aceitam.

### Frontend

As suites em `frontend/src/modules/planejamentos/__tests__` cobrem:

- paths e payloads do service;
- listagem, criacao e detalhe;
- autorizacao pura de proprietario e participante `VINCULADO + ATIVO`;
- rejeicao de `MANUAL`, `CONVIDADO`, `PENDENTE`, `REMOVIDO` e identidade
  ausente;
- capacidades centralizadas do detalhe;
- hidratacao completa do agregado;
- formularios de participante e gasto protegidos contra deep link;
- distincao entre criar gasto como vinculado e editar somente como
  proprietario;
- estados de loading, bloqueio por papel/status e sessao expirada;
- duplo envio;
- troca de planejamento/gasto, sequencia `A -> B -> A`, resposta obsoleta e
  resposta depois de unmount;
- guards de handlers antes de confirmacao, lock local, service e recarga;
- serializacao de mutacoes concorrentes no detalhe.

## Cobertura E2E atual

As suites `backendnest/test/planejamentos-*.e2e-spec.ts` usam PostgreSQL real.

### Acesso e ocultacao

- proprietario continua acessando por `usuarioCriadorId`;
- participante `VINCULADO + ATIVO` le o agregado e cria gasto;
- linhas inseridas diretamente como `MANUAL + ATIVO + usuarioId` ou
  `CONVIDADO + ATIVO + usuarioId` nao concedem acesso;
- `VINCULADO + PENDENTE` e `VINCULADO + REMOVIDO` nao concedem acesso;
- usuarios sem acesso recebem `404 PLANEJAMENTO_NOT_FOUND` em leitura e
  mutacao;
- o agregado acessivel preserva participantes e fatos historicos.

### Participantes e gastos

- duplicidade e concorrencia na adicao de participante;
- remocao logica, preservacao financeira e impossibilidade de remover o
  proprietario;
- criacao atomica de gasto, divisoes e reconciliacao;
- atualizacao textual, financeira e no-op;
- cancelamento logico e preservacao de historico;
- somente leitura fora de `ABERTO`.

### Resumo, acertos e lifecycle

- resumo financeiro puro e deterministico;
- sincronizacao com alteracoes e no-op;
- pagamento, cancelamento e reabertura;
- autorizacao do devedor para pagar o proprio acerto;
- fechar sem exigir quitacao;
- bloqueio por `PENDENTE_REVISAO` no fechamento;
- arquivar somente `FECHADO + QUITADO`;
- cancelar somente `ABERTO + QUITADO`;
- somente leitura em `ARQUIVADO` e `CANCELADO`;
- concorrencia com uma unica transicao vencedora.

### Auditoria transacional

Os E2E validam:

- exatamente um evento por mutacao confirmada;
- nenhum evento na sincronizacao no-op;
- nomes, ator, entidade, IDs e details operacionais;
- ordenacao deterministica de IDs derivados;
- ausencia de nome, email, descricao, categoria, observacao e entidades
  completas nos payloads;
- rollback real por trigger `BEFORE INSERT ON audit_log`;
- restauracao de planejamento, participante, gasto, divisoes, status,
  `dataPagamento`, acertos derivados e reconciliacao;
- zero log de sucesso depois do rollback;
- contagem unica de eventos sob concorrencia.

## Matriz minima de regressao

| Area | Evidencia esperada |
| --- | --- |
| Criacao | Planejamento `ABERTO`, proprietario `VINCULADO + ATIVO`, auditoria atomica. |
| Leitura | Proprietario e vinculado ativo recebem agregado completo; demais recebem 404. |
| Participantes | Somente proprietario em `ABERTO`; remocao preserva historico. |
| Gastos | Criacao compartilhada; edicao/cancelamento somente do proprietario. |
| Acertos | Sync compartilhado; pagamento pelo proprietario ou devedor; correcoes pelo proprietario. |
| Lifecycle | Somente proprietario e pre-condicoes de status/situacao. |
| Terminal | `ARQUIVADO` e `CANCELADO` somente leitura. |
| Concorrencia | Lock serializa; uma escrita e um evento vencedor. |
| Auditoria | Mesmo manager, rollback e payload sanitizado. |
| Frontend | Deep links e handlers usam a mesma capacidade da UI. |

## Comandos de regressao

Backend, conforme a alteracao:

```bash
npm test -- --runInBand planejamentos.repository.spec
npm test -- --runInBand planejamentos.service.spec
npm run test:e2e -- --runInBand planejamentos
npm run build
npm run lint
```

Frontend:

```bash
npm test -- --runInBand planejamentos
npm run typecheck
npm run lint
npm run export:web
```

## Roadmap de testes

Somente quando as funcionalidades correspondentes existirem:

- edicao de planejamento;
- listagem dedicada e edicao de participante;
- convite por token e expiracao;
- replicacao mensal;
- upload real de comprovante;
- confirmacao de recebimento;
- divisao percentual/manual;
- integracao com transacoes pessoais.
