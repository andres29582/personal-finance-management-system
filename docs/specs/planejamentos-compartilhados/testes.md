# Planejamentos Compartilhados - Estrategia de testes

## Objetivo

Definir a estrategia inicial de testes para o futuro modulo de Planejamentos
Compartilhados. Esta fase nao implementa testes; apenas registra a cobertura
esperada para orientar a implementacao.

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
- marcar acerto como pago;
- reabrir acerto pago;
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
| `DELETE /planejamentos/:id` | cancela ou arquiva logicamente. |
| `POST /planejamentos/:id/participantes` | adiciona participante. |
| `GET /planejamentos/:id/participantes` | lista participantes. |
| `PATCH /planejamentos/:id/participantes/:participanteId` | edita participante. |
| `DELETE /planejamentos/:id/participantes/:participanteId` | remove logicamente. |
| `POST /planejamentos/:id/gastos` | registra gasto e retorna divisoes. |
| `GET /planejamentos/:id/gastos` | lista gastos. |
| `PATCH /planejamentos/:id/gastos/:gastoId` | edita gasto. |
| `DELETE /planejamentos/:id/gastos/:gastoId` | cancela gasto. |
| `GET /planejamentos/:id/resumo` | retorna totais e saldos. |
| `GET /planejamentos/:id/acertos` | retorna acertos. |
| `PATCH /planejamentos/:id/acertos/:acertoId/pagar` | marca acerto como pago. |
| `PATCH /planejamentos/:id/acertos/:acertoId/reabrir` | reabre acerto. |
| `POST /planejamentos/:id/replicar` | replica planejamento mensal. |

## Testes E2E

E2E deve usar o padrao existente do backend com PostgreSQL, Supertest e JWT.

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
10. Usuario A cancela gasto.
11. Usuario A valida novo resumo sem o gasto cancelado.
12. Usuario A replica planejamento mensal.
13. Usuario B tenta acessar recursos do usuario A e recebe erro.

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
- Dividir `1` entre 3 participantes deve gerar `1`, `0`, `0` apenas se o
  dominio permitir valor devido zero por participante; recomendacao: permitir
  somente quando o valor total for positivo e documentar acertos zero como nao
  exibidos.
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
- Editar gasto apos acerto pago preserva historico e recalcula pendencias
  restantes conforme regra implementada.

## Casos de cancelamento de gasto

- Cancelar gasto altera status para `CANCELADO`.
- Gasto cancelado permanece na listagem historica quando filtro permitir.
- Gasto cancelado sai do resumo financeiro.
- Divisoes do gasto cancelado nao entram em total devido.
- Pagador do gasto cancelado nao recebe total pago por esse gasto.
- Acertos sao recalculados apos cancelamento.
- Cancelar gasto deve registrar auditoria.

## Casos de acertos minimos

- Um devedor e um recebedor geram um acerto.
- Dois devedores e um recebedor geram dois acertos.
- Um devedor e dois recebedores geram dois acertos.
- Participante com saldo zero nao gera acerto.
- Acerto com valor zero nao e exibido.
- Soma dos acertos por devedor fecha com sua divida.
- Soma dos acertos por recebedor fecha com seu credito.
- Ordem de retorno e deterministica.

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
- Revisar valor recalcula divisao.
- Confirmar revisao altera status para `ATIVO`.
- Sistema informa mes de origem do valor replicado.
- Sistema informa ultima alteracao de valor quando houver.

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
