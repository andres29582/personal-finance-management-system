# Planejamentos Compartilhados - Estrategia de testes

> Nota de status:
> Este documento contem especificacoes conceituais e itens de roadmap. O
> contrato atual implementado deve ser conferido no Swagger oficial
> (`backendnest/swagger.yaml`) e na validacao documental disponivel em
> `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`.

## Objetivo

Definir e acompanhar a estrategia de testes do modulo de Planejamentos
Compartilhados. O modulo ja possui cobertura unitaria, de controller e E2E; os
itens ainda nao implementados permanecem como cobertura esperada de roadmap.

Os testes devem cobrir regras financeiras, DTOs, services, controllers e fluxos
E2E autenticados, com foco especial em isolamento de dados entre usuarios e
calculos em centavos.

## Estrategia de testes unitarios de dominio

Criar testes unitarios para funcoes ou services puros responsaveis por:

- divisao igualitaria em centavos;
- distribuicao deterministica de sobras;
- calculo de total pago por participante;
- calculo de total devido por participante;
- calculo de saldo final;
- classificacao de participante como devedor, recebedor ou quitado;
- calculo de acertos minimos;
- exclusao de gastos cancelados dos calculos;
- tratamento de gastos pendentes de revisao;
- replicacao conceitual de gastos fixos, variaveis e eventuais.

Casos obrigatorios:

| Caso | Entrada | Resultado esperado |
| --- | --- | --- |
| Divisao exata | `9000 / 3` | `3000`, `3000`, `3000`. |
| Sobra de 1 centavo | `10000 / 3` | `3334`, `3333`, `3333`. |
| Sobra de 2 centavos | `10001 / 3` | `3334`, `3334`, `3333`. |
| Um participante | `12345 / 1` | `12345`. |
| Valor invalido | `0` | erro de dominio ou validacao. |
| Valor menor que participantes | `2 / 3` | erro de dominio ou validacao. |
| Sem participantes | lista vazia | erro de dominio ou validacao. |
| Ordem deterministica | mesma entrada repetida | mesma saida repetida. |

## Testes de DTOs

Validar DTOs com o mesmo comportamento do `ValidationPipe` global:

- `CreatePlanejamentoDto`;
- `UpdatePlanejamentoDto`;
- `CreateParticipantePlanejamentoDto`;
- `UpdateParticipantePlanejamentoDto`;
- `CreateGastoPlanejamentoDto`;
- `UpdateGastoPlanejamentoDto`;
- `PagarAcertoPlanejamentoDto`;
- `ReabrirAcertoPlanejamentoDto`;
- `CancelarAcertoPlanejamentoDto`;
- `ReplicarPlanejamentoDto`;
- DTOs de filtros, se existirem.

Casos esperados:

- rejeitar campos extras quando `forbidNonWhitelisted` estiver ativo;
- exigir campos obrigatorios;
- validar enums;
- validar `valorCentavos` maior que zero;
- validar `mesReferencia` no formato `YYYY-MM`;
- validar listas de participantes nao vazias;
- validar UUIDs;
- aceitar campos opcionais de comprovante sem exigir upload.

## Testes de services

Services devem ser testados com repositories mockados ou banco controlado,
conforme padrao do modulo.

Cobertura minima:

- criar planejamento usando `usuarioId` autenticado;
- listar apenas planejamentos do usuario;
- bloquear acesso a planejamento de outro usuario;
- adicionar participante manual;
- remover participante por status, sem exclusao fisica;
- criar gasto com pagador e participantes validos;
- rejeitar pagador de outro planejamento;
- rejeitar participante de divisao de outro planejamento;
- recalcular divisoes ao editar valor;
- recalcular saldos ao editar pagador;
- recalcular saldos ao editar participantes da divisao;
- cancelar gasto e remove-lo dos calculos;
- calcular resumo financeiro;
- calcular acertos minimos;
- materializar acertos pendentes apos alteracoes financeiras relevantes;
- garantir que consultas `GET` de resumo e acertos nao alterem o banco de dados;
- marcar acerto como pago;
- reabrir acerto pago;
- fechar planejamento com acertos pendentes e preservar esses acertos;
- bloquear alteracoes estruturais e de gastos depois do fechamento;
- permitir pagamento e correcao de acertos existentes depois do fechamento;
- arquivar somente planejamento `FECHADO` e financeiramente `QUITADO`;
- manter planejamento `ARQUIVADO` em somente leitura;
- reconciliar e recalcular o resumo oficial antes de arquivar, com rollback se
  a validacao financeira ou a persistencia falhar;
- serializar arquivamentos concorrentes no lock do planejamento;
- permitir operacoes de acerto somente em `ABERTO` e `FECHADO`, bloqueando-as
  em `ARQUIVADO` e `CANCELADO`;
- cancelar somente planejamento `ABERTO + QUITADO`, preservando historico;
- permitir cancelamento com gasto `PENDENTE_REVISAO` sem obrigacao valida;
- rejeitar cancelamento de `ABERTO + PENDENTE`, `FECHADO`, `ARQUIVADO` e
  `CANCELADO`;
- serializar cancelamentos concorrentes e a corrida entre fechar e cancelar;
- reverter a reconciliacao se a persistencia de `CANCELADO` falhar;
- replicar planejamento mensal;
- marcar gastos variaveis replicados como `PENDENTE_REVISAO`;
- nao criar transacoes pessoais automaticamente.

## Testes de controllers

Controllers devem validar:

- uso de `req.user.id` ou equivalente como fonte de `usuarioId`;
- delegacao correta para services;
- parametros de rota;
- queries e body DTOs;
- respostas de sucesso;
- propagacao de erros de dominio;
- protecao por guard JWT quando testado no nivel apropriado.

Casos por endpoint:

| Endpoint | Cobertura esperada |
| --- | --- |
| `POST /planejamentos` | cria planejamento com usuario autenticado. |
| `GET /planejamentos` | lista planejamentos do usuario. |
| `GET /planejamentos/:id` | consulta detalhes. |
| `PATCH /planejamentos/:id` | edita dados basicos. |
| `PATCH /planejamentos/:id/fechar` | fecha planejamento sem pendencias impeditivas. |
| `PATCH /planejamentos/:id/arquivar` | delega o ID validado e o usuario autenticado para arquivar `FECHADO + QUITADO`. |
| `PATCH /planejamentos/:id/cancelar` | delega o ID validado e o usuario autenticado, sem body, para cancelar `ABERTO + QUITADO`. |
| `DELETE /planejamentos/:id` | se existir, cancela logicamente e nunca exclui fisicamente. |
| `POST /planejamentos/:id/participantes` | adiciona participante. |
| `GET /planejamentos/:id/participantes` | lista participantes. |
| `PATCH /planejamentos/:id/participantes/:participanteId` | edita participante. |
| `DELETE /planejamentos/:planejamentoId/participantes/:participanteId` | contrato atual implementado: remove logicamente. |
| `POST /planejamentos/:id/gastos` | registra gasto e retorna divisoes. |
| `GET /planejamentos/:id/gastos` | lista gastos. |
| `PATCH /planejamentos/:id/gastos/:gastoId` | edita gasto. |
| `DELETE /planejamentos/:id/gastos/:gastoId` | cancela gasto. |
| `GET /planejamentos/:id/resumo` | retorna totais e saldos. |
| `GET /planejamentos/:id/acertos` | retorna acertos. |
| `PATCH /planejamentos/:id/acertos/:acertoId/pagar` | marca acerto como pago. |
| `PATCH /planejamentos/:id/acertos/:acertoId/reabrir` | reabre acerto. |
| `PATCH /planejamentos/:id/acertos/:acertoId/cancelar` | cancela acerto. |
| `POST /planejamentos/:id/replicar` | replica planejamento mensal. |

## Testes E2E

E2E deve usar o padrao existente do backend com PostgreSQL, Supertest e JWT.

O contrato atual de fechamento possui suite E2E dedicada cobrindo fechamento
com acerto pendente, autorizacao exclusiva do proprietario, repeticao e
concorrencia de fechamento, rollback por gasto `PENDENTE_REVISAO`, bloqueio das
cinco mutacoes estruturais implementadas e continuidade de sincronizacao,
pagamento, cancelamento e reabertura de acertos em `FECHADO`.

O resumo financeiro possui testes puros de dominio, testes de service e
controller e suite E2E PostgreSQL dedicada. A cobertura valida totais e saldos
por participante, obrigacao residual contada somente pelo lado credor,
`ABERTO/FECHADO + PENDENTE/QUITADO`, gastos excluidos, isolamento de acesso e
repeticao do `GET` sem alterar acertos, status ou timestamps do agregado.

O cancelamento possui suite E2E PostgreSQL dedicada. A cobertura valida
planejamento vazio e historico financeiro quitado, `PENDENTE_REVISAO`, estados
e autorizacoes invalidos, preservacao integral do historico, consultas e
somente leitura, concorrencia cancelar x cancelar, corrida fechar x cancelar e
rollback real da reconciliacao quando a persistencia de `CANCELADO` falha.

O arquivamento possui suite E2E PostgreSQL dedicada. A cobertura valida
`FECHADO + QUITADO`, rejeicoes de status e pendencia financeira, isolamento de
acesso, propriedade, consultas depois do arquivamento, bloqueio das cinco
mutacoes estruturais e das quatro operacoes de acerto, concorrencia com uma
unica transicao vencedora e rollback real da reconciliacao quando a persistencia
do status falha.

As suites de fechamento, arquivamento e cancelamento validam ainda a criacao de
um unico `AuditLog` por transicao vencedora, a ausencia de evento de sucesso em
rejeicoes e concorrencia e o rollback integral quando a auditoria transacional
falha, incluindo status, reconciliacao de acertos e o proprio log.

Fluxo minimo recomendado:

1. Criar usuario A e usuario B.
2. Fazer login dos dois usuarios.
3. Usuario A cria planejamento.
4. Usuario A adiciona participantes.
5. Usuario A registra gastos com pagadores diferentes.
6. Usuario A consulta resumo.
7. Usuario A consulta acertos.
8. Usuario A marca acerto como pago.
9. Usuario A reabre acerto.
10. Usuario A marca outro acerto como pago e cancela esse acerto.
11. Usuario A cancela gasto.
12. Usuario A valida novo resumo sem o gasto cancelado e com acertos pagos preservados.
13. Usuario A replica planejamento mensal.
14. Usuario A valida que gastos `PENDENTE_REVISAO` nao geram acertos oficiais.
15. Usuario B tenta acessar recursos do usuario A e recebe erro.

## Casos obrigatorios de isolamento de dados

- Usuario B nao lista planejamento do usuario A.
- Usuario B nao consulta `GET /planejamentos/:id` do usuario A.
- Usuario B nao adiciona participante em planejamento do usuario A.
- Usuario B nao edita participante do planejamento do usuario A.
- Usuario B nao registra gasto no planejamento do usuario A.
- Usuario B nao edita ou cancela gasto do usuario A.
- Usuario B nao consulta resumo do planejamento do usuario A.
- Usuario B nao consulta acertos do planejamento do usuario A.
- Usuario B nao marca acerto do usuario A como pago.
- Usuario B nao replica planejamento do usuario A.
- IDs existentes de outro usuario nao devem vazar dados sensiveis na resposta.

## Casos obrigatorios de arredondamento em centavos

- Dividir `10000` entre 3 participantes deve gerar `3334`, `3333`, `3333`.
- Dividir `10001` entre 3 participantes deve gerar `3334`, `3334`, `3333`.
- Dividir `1` entre 3 participantes deve ser rejeitado no MVP.
- Dividir valor menor que a quantidade de participantes deve ser rejeitado.
- Repetir o mesmo payload deve gerar a mesma distribuicao.
- Alterar a ordem dos participantes deve alterar apenas a distribuicao da sobra,
  nao a soma total.
- Soma das divisoes deve sempre igualar o valor total do gasto.

## Casos de edicao e recalculo

- Editar valor do gasto recalcula divisoes.
- Editar pagador altera total pago e saldo.
- Editar participantes da divisao altera total devido e saldo.
- Editar descricao nao altera calculos financeiros.
- Editar comprovante opcional nao altera calculos financeiros.
- Editar gasto com acertos pendentes recalcula acertos pendentes.
- Editar gasto apos acerto pago preserva historico financeiro e cria novos
  acertos pendentes para compensacao quando houver nova pendencia.

## Casos de cancelamento de gasto

- Cancelar gasto altera status para `CANCELADO`.
- Gasto cancelado permanece na listagem historica quando filtro permitir.
- Gasto cancelado sai do resumo financeiro.
- Divisoes do gasto cancelado nao entram em total devido.
- Pagador do gasto cancelado nao recebe total pago por esse gasto.
- Acertos sao recalculados apos cancelamento.
- Cancelar gasto deve registrar auditoria.
- Acertos pagos permanecem como historico financeiro apos cancelamento de gasto.

## Casos de acertos minimos

- Um devedor e um recebedor geram um acerto.
- Dois devedores e um recebedor geram dois acertos.
- Um devedor e dois recebedores geram dois acertos.
- Participante com saldo zero nao gera acerto.
- Acerto com valor zero nao e exibido.
- Soma dos acertos por devedor fecha com sua divida.
- Soma dos acertos por recebedor fecha com seu credito.
- Ordem de retorno e deterministica.
- Acertos `PENDENTE` sao substituidos apos novo recalculo.
- Acertos `PAGO` nao sao apagados automaticamente apos novo recalculo.
- Consulta `GET /planejamentos/:id/acertos` nao cria nem altera acertos.
- Consulta `GET /planejamentos/:id/acertos` retorna entidades persistidas com
  IDs, todos os status e participantes envolvidos, inclusive em planejamento
  `ARQUIVADO` ou `CANCELADO`.
- O ID obtido pelo `GET` permanece operavel depois de reload, pagamento e
  reabertura.
- Reabertura aceita somente `PAGO -> PENDENTE`, preserva o mesmo ID e rejeita
  `PENDENTE`, `CANCELADO`, `CONFIRMADO`, obrigacao obsoleta e duplicidade.
- Falha da auditoria transacional reverte reabertura e reconciliacao.

## Casos de replicacao mensal

- Replicacao cria novo planejamento com `mesReferencia` informado.
- Replicacao copia participantes ativos.
- Replicacao nao copia participantes removidos como ativos.
- Replicacao copia gastos fixos como `ATIVO`, quando nao exigem revisao.
- Replicacao copia gastos variaveis como `PENDENTE_REVISAO`.
- Replicacao nao copia gastos eventuais por padrao.
- Replicacao nao copia acertos do planejamento anterior.
- Replicacao registra origem do planejamento e dos gastos quando modelado.
- Replicacao registra auditoria.

## Casos de gastos variaveis com revisao pendente

- Gasto variavel replicado nasce `PENDENTE_REVISAO`.
- Gasto pendente de revisao aparece no resumo ou endpoint dedicado.
- Gasto pendente de revisao nao gera acertos oficiais.
- Gasto pendente de revisao bloqueia fechamento do planejamento.
- Revisar valor recalcula divisao.
- Confirmar revisao altera status para `ATIVO`.
- Sistema informa mes de origem do valor replicado.
- Sistema informa ultima alteracao de valor quando houver.

## Casos de lifecycle e situacao financeira

- Fechar exige usuario autenticado proprietario e planejamento `ABERTO`.
- Fechar e transacional, serializado no agregado e executa reconciliacao final.
- Gasto `PENDENTE_REVISAO` bloqueia fechamento.
- Acerto `PENDENTE` nao bloqueia fechamento e permanece preservado.
- Planejamento pode ficar `FECHADO + PENDENTE`.
- Planejamento `FECHADO` mantem entidades e historico visiveis, mas bloqueia
  adicionar, remover ou editar participante, criar, editar ou cancelar gasto e
  alterar pagador ou divisoes.
- Planejamento `FECHADO` permite consultar historico, sincronizar acertos para
  consistencia operacional e pagar, cancelar ou reabrir acertos existentes.
- No contrato atual, pagamento marcado em 05/07 para obrigacao consolidada no
  fechamento de 30/06 registra o instante da marcacao em 05/07, sem reabrir o
  planejamento ou alterar junho/2026.
- Em evolucao futura, quando `dataPagamento` for informada em DTO, o sistema
  registra essa data efetiva em vez do instante da marcacao.
- Situacao `QUITADO` e derivada depois de considerar gastos validos, divisoes
  ativas, acertos pagos, cancelados ou obsoletos e reconciliacao atual.
- Ausencia fisica de linha `PENDENTE` nao basta para concluir `QUITADO`.
- Arquivar exige `FECHADO + QUITADO` e torna o agregado somente leitura.
- Arquivar valida acesso e propriedade antes do lock, recarrega o agregado
  depois do lock, reconcilia, recarrega novamente, calcula o resumo oficial e
  persiste somente `id` e status `ARQUIVADO` na mesma transacao.
- Duas solicitacoes concorrentes de arquivamento resultam em uma aprovacao e
  uma rejeicao por status `ARQUIVADO`, sem reconciliacao duplicada inconsistente.
- Planejamento `ARQUIVADO` ou `CANCELADO` bloqueia sincronizacao, pagamento,
  cancelamento e reabertura de acertos; consultas permanecem disponiveis.
- Cancelar exige `ABERTO + QUITADO`; `FECHADO + QUITADO` deve seguir para
  `ARQUIVADO`, nunca para `CANCELADO`.
- Cancelamento reconcilia e calcula o resumo oficial na mesma transacao, sem
  usar a guarda de fechamento para gastos `PENDENTE_REVISAO`.
- `CANCELADO` preserva participantes, gastos, divisoes, acertos e historico e
  bloqueia mutacoes estruturais, financeiras e novas transicoes de lifecycle.
- `PlanejamentoStatus` nao recebe o valor `QUITADO`.

## Casos de nao criacao automatica de transacoes pessoais

- Criar gasto compartilhado nao cria registro em `transacoes`.
- Editar gasto compartilhado nao cria nem altera transacao pessoal.
- Cancelar gasto compartilhado nao cancela transacao pessoal.
- Marcar acerto como pago nao cria receita, despesa ou transferencia.
- Reabrir acerto pago nao altera saldo de conta pessoal.
- Replicar planejamento mensal nao cria transacoes pessoais.

## Evidencias esperadas na implementacao futura

Quando o modulo for implementado, a entrega tecnica deve registrar:

- suites unitarias executadas;
- suites de controller/DTO executadas;
- suites E2E executadas;
- cenarios de isolamento de dados cobertos;
- cenarios de arredondamento em centavos cobertos;
- confirmacao de que nenhuma transacao pessoal automatica foi criada.
