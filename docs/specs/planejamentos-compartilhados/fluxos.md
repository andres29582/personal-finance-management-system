# Planejamentos Compartilhados - Fluxos

## Status

Os fluxos abaixo refletem o backend e o frontend atuais. A autorizacao varia por
operacao; nao e suficiente afirmar genericamente que o planejamento "pertence"
ao usuario. O contrato HTTP oficial esta em `backendnest/swagger.yaml`.

## Leitura do agregado

1. Usuario autenticado lista ou consulta um planejamento.
2. O repository concede acesso quando o usuario e o proprietario ou possui
   participante com `usuarioId` correspondente, `tipo = VINCULADO` e
   `status = ATIVO`.
3. A query de autorizacao e separada dos joins de hidratacao.
4. O detalhe retorna o agregado acessivel completo, inclusive participantes
   historicos, gastos, divisoes e acertos.
5. Usuario sem acesso recebe `404 PLANEJAMENTO_NOT_FOUND`.

Consultas de detalhe, gastos, resumo e acertos sao somente leitura: nao
reconciliam nem persistem dados.

## Criacao de planejamento

1. Usuario autenticado envia `POST /planejamentos`.
2. Backend valida DTO e periodo.
3. Dentro de uma transacao, persiste planejamento `ABERTO`.
4. Busca participante vinculado ativo do criador no planejamento.
5. Se ausente, cria participante com `usuarioId` do criador,
   `tipo = VINCULADO` e `status = ATIVO`; se presente, reutiliza seu ID.
6. Registra `PLANEJAMENTO_CRIADO` com o mesmo `EntityManager`.
7. O commit confirma planejamento, participante e audit log.
8. Depois do commit, o agregado e relido para resposta.

Falha da auditoria impede o commit e a releitura.

## Adicao de participante

1. Proprietario envia `POST /planejamentos/:id/participantes`.
2. Backend bloqueia o planejamento, revalida propriedade e exige `ABERTO`.
3. Rejeita duplicidade ativa por usuario, email ou nome manual.
4. Cria `VINCULADO` quando `usuarioId` foi informado; caso contrario, cria
   `MANUAL`. O status inicial e `ATIVO`.
5. Persiste o participante.
6. Registra `PLANEJAMENTO_PARTICIPANTE_ADICIONADO` na mesma transacao.
7. Retorna o participante depois do commit.

Participante vinculado ativo pode ler o agregado, mas nao executar esse fluxo.

## Remocao de participante

1. Proprietario envia
   `DELETE /planejamentos/:planejamentoId/participantes/:participanteId`.
2. Backend bloqueia o agregado, exige `ABERTO` e revalida propriedade.
3. Confirma que o participante esta `ATIVO` e nao representa o proprietario.
4. Altera somente o status para `REMOVIDO`.
5. Registra `PLANEJAMENTO_PARTICIPANTE_REMOVIDO` na mesma transacao.
6. Mantem gastos, divisoes, acertos e obrigacoes historicas.

## Criacao de gasto

1. Proprietario ou participante `VINCULADO + ATIVO` abre o formulario ou chama
   `POST /planejamentos/:planejamentoId/gastos`.
2. Frontend carrega identidade e planejamento antes de habilitar o formulario;
   deep link sem capacidade exibe estado bloqueado.
3. Backend bloqueia o planejamento, revalida acesso e exige `ABERTO`.
4. Valida pagador, participantes, valor e divisao.
5. Persiste gasto `ATIVO` e divisoes `ATIVA`.
6. Recarrega o agregado financeiro e reconcilia acertos.
7. Registra `PLANEJAMENTO_GASTO_CRIADO` depois das escritas derivadas.
8. Confirma tudo no mesmo commit.

## Edicao de gasto

1. Somente proprietario pode abrir operacionalmente o formulario de edicao ou
   chamar `PATCH /planejamentos/:planejamentoId/gastos/:gastoId`.
2. Frontend distingue criacao de edicao e bloqueia deep link de edicao para
   participante vinculado.
3. Backend exige planejamento `ABERTO` e gasto `ATIVO`.
4. Compara o DTO com o estado atual.
5. Se nao houver mudanca semantica, retorna sem save, reconciliacao ou evento.
6. Alteracao textual salva o gasto; alteracao de pagador tambem reconcilia;
   alteracao de valor ou participantes cancela divisoes ativas, cria novas e
   reconcilia.
7. Registra `PLANEJAMENTO_GASTO_ATUALIZADO` com somente campos alterados e sem
   conteudo textual sensivel.

## Cancelamento de gasto

1. Proprietario chama
   `PATCH /planejamentos/:planejamentoId/gastos/:gastoId/cancelar`.
2. Backend exige planejamento `ABERTO` e gasto `ATIVO`.
3. Altera o gasto para `CANCELADO` e cancela divisoes ativas.
4. Recarrega o agregado e reconcilia acertos.
5. Registra `PLANEJAMENTO_GASTO_CANCELADO` como ultima escrita logica.
6. Historico permanece consultavel.

## Resumo financeiro

1. Ator com acesso chama `GET /planejamentos/:id/resumo`.
2. Backend carrega o agregado acessivel completo.
3. Considera gastos `ATIVO`, divisoes `ATIVA` e acertos `PAGO` ou
   `CONFIRMADO`.
4. Calcula totais e saldo aberto de cada participante.
5. Deriva `situacaoFinanceira` como `PENDENTE` ou `QUITADO`.
6. Retorna sem save ou reconciliacao.

## Sincronizacao de acertos

1. Proprietario ou participante `VINCULADO + ATIVO` chama
   `POST /planejamentos/:planejamentoId/acertos/sincronizar` em `ABERTO` ou
   `FECHADO`.
2. Backend bloqueia o planejamento e carrega o agregado financeiro.
3. Cria um plano com pendentes preservados, obsoletos e novos acertos.
4. Se nao houver novos nem obsoletos, retorna como no-op sem save ou evento.
5. Caso contrario, cancela obsoletos e salva novos usando o mesmo plano.
6. Registra um unico `PLANEJAMENTO_ACERTOS_SINCRONIZADOS` com IDs criados e
   cancelados ordenados.

O lock serializa concorrentes: depois da escrita vencedora, a segunda execucao
recalcula o estado e tende a no-op.

## Pagamento de acerto

1. Proprietario, ou participante vinculado que representa o devedor, chama
   `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/pagar`, sem body.
2. Backend bloqueia o planejamento e o acerto e exige `ABERTO` ou `FECHADO`.
3. Revalida ator e exige origem `PENDENTE`.
4. Salva `PAGO` com `dataPagamento = new Date()`.
5. Recarrega o agregado, cria o plano e reconcilia acertos.
6. Registra `PLANEJAMENTO_ACERTO_PAGO` depois das escritas derivadas.

## Cancelamento de acerto

1. Proprietario chama
   `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/cancelar`.
2. Backend exige `ABERTO` ou `FECHADO` e origem `PENDENTE` ou `PAGO`.
3. Salva `CANCELADO`; quando era `PAGO`, limpa `dataPagamento`.
4. Recarrega o agregado, cria o plano e reconcilia.
5. Registra `PLANEJAMENTO_ACERTO_CANCELADO`.

## Reabertura de acerto

1. Proprietario chama
   `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/reabrir`.
2. Backend exige `ABERTO` ou `FECHADO` e origem `PAGO`.
3. Projeta o pagamento como pendente, cria o primeiro plano e reconcilia.
4. Salva o mesmo acerto como `PENDENTE`, com data de pagamento limpa.
5. Recalcula um segundo plano apenas para validar que o acerto reaberto continua
   sendo obrigacao atual.
6. Registra o evento legado `ACERTO_PLANEJAMENTO_REABERTO` usando os IDs
   derivados do primeiro plano.

## Fechamento

1. Proprietario chama `PATCH /planejamentos/:id/fechar`.
2. Backend bloqueia o planejamento e exige `ABERTO`.
3. Rejeita qualquer gasto `PENDENTE_REVISAO`.
4. Reconcilia acertos, preservando pendencias validas.
5. Altera para `FECHADO` e registra `PLANEJAMENTO_FECHADO`.

Fechar nao exige quitacao. Depois disso, participantes, gastos, pagador e
divisoes ficam congelados, mas acertos ainda podem ser sincronizados, pagos,
cancelados ou reabertos conforme autorizacao.

## Arquivamento

1. Proprietario chama `PATCH /planejamentos/:id/arquivar`.
2. Backend exige `FECHADO`, reconcilia e calcula o resumo.
3. Exige situacao financeira `QUITADO`.
4. Altera para `ARQUIVADO` e registra `PLANEJAMENTO_ARQUIVADO`.
5. O agregado passa a somente leitura.

## Cancelamento do planejamento

1. Proprietario chama `PATCH /planejamentos/:id/cancelar`, sem body.
2. Backend exige `ABERTO`, reconcilia e calcula o resumo.
3. Exige situacao financeira `QUITADO`.
4. Antes da transicao final, a reconciliacao oficial pode cancelar ou
   substituir acertos `PENDENTE` obsoletos.
5. Altera o status do planejamento para `CANCELADO` e registra
   `PLANEJAMENTO_CANCELADO`.
6. Gastos, divisoes, participantes, pagamentos e acertos historicos nao sao
   removidos nem cancelados em massa.

Reconciliacao, transicao de status e auditoria pertencem a mesma transacao.

Gasto `PENDENTE_REVISAO` nao bloqueia isoladamente o cancelamento.

## Protecao assincrona no frontend

Detalhe e formularios protegem troca de IDs, sequencias `A -> B -> A`, respostas
obsoletas, unmount, unauthorized antigo e duplo envio. Capacidades visuais e
handlers usam a mesma politica antes de confirmacao, lock local, service e
recarga. Unauthorized redireciona ao login somente quando pertence ao contexto
atual; falta de capacidade exibe estado bloqueado e preserva a acao de voltar.

## Roadmap / futuro

Nao existem fluxos implementados para editar planejamento, listar ou editar
participante em endpoint dedicado, replicar planejamento, convidar por token,
fazer upload real, confirmar recebimento ou integrar automaticamente com
transacoes pessoais.
