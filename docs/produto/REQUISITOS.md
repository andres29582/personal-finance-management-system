# Requisitos e Matriz de Rastreabilidade do MVP

Objetivo: relacionar os requisitos centrais do MVP financeiro com endpoints,
servicos e testes que aumentam a confianca tecnica do backend.

Referencia desta revisao documental: `main` em `31d5566` (fase documental 1).
A leitura de codigo, suites e CI nao executa testes nem comprova operacao real.
Para interpretar evidencias, consultar o [indice documental](../README.md).

Convencoes:

- A coluna `status` descreve implementacao do requisito listado: integrada, parcial ou pendente. Nao certifica cobertura completa nem publicacao.
- `Controller/DTO` identifica suites existentes; sua presenca nao comprova todos os cenarios HTTP. `Pendente` nesta coluna significa cobertura dedicada ainda nao registrada, nao ausencia da funcionalidade.
- `E2E` identifica cenarios implementados; `Financial flow (e2e)` pertence a `backendnest/test/app.e2e-spec.ts` e usa PostgreSQL de teste, nao dados reais da aplicacao.
- Resultado de execucao deve registrar revisao, data, ambiente e escopo separadamente. Nenhuma suite foi executada nesta revisao documental.

| requisito | endpoint principal | service test | controller/DTO test | E2E relacionado | risco coberto | status |
| --- | --- | --- | --- | --- | --- | --- |
| Auth: cadastro, login e JWT | `POST /auth/register`, `POST /auth/login`, rotas com `JwtAuthGuard` | `backendnest/src/auth/auth.service.spec.ts`, `backendnest/src/auth/strategies/jwt.strategy.spec.ts` | `backendnest/src/auth/auth.controller.spec.ts` | `Financial flow (e2e)` registra usuarios A/B, faz login, usa JWT e rejeita token invalido | Credenciais invalidas, rota financeira sem JWT, token invalido, senha/token fora da response | Integrada |
| Contas e saldo atual | `POST /contas`, `GET /contas`, `GET /contas/:id`, `PATCH /contas/:id/desativar` | `backendnest/src/contas/contas.service.spec.ts` | `backendnest/src/contas/contas.controller.spec.ts`, `backendnest/src/contas/dto/conta.dto.spec.ts` | `Financial flow (e2e)` valida saldo via `GET /contas` apos receitas, despesas, soft delete, transferencias e pagamento de divida | Saldo incorreto, conta de outro usuario, conta inativa em listagem, payload invalido | Integrada |
| Categorias por tipo | `POST /categorias`, `GET /categorias`, `GET /categorias/:id` | `backendnest/src/categorias/categorias.service.spec.ts` | Pendente | `Financial flow (e2e)` cria categorias de receita/despesa e usa categoria despesa no pagamento de divida | Categoria com usuario errado, categoria inativa, tipo incompativel com transacao/pagamento | Integrada |
| Transacoes financeiras | `POST /transacoes`, `GET /transacoes`, `GET /transacoes/:id`, `DELETE /transacoes/:id` | `backendnest/src/transacoes/transacoes.service.spec.ts` | `backendnest/src/transacoes/transacoes.controller.spec.ts`, `backendnest/src/transacoes/dto/transacao.dto.spec.ts` | `Financial flow (e2e)` cria receita/despesa, valida saldo, faz soft delete e confirma ausencia no saldo/listagem | Valor `<= 0`, categoria de tipo incorreto, soft delete ignorado, isolamento por usuario, filtros invalidos | Integrada |
| Transferencias entre contas | `POST /transferencias`, `GET /transferencias`, `GET /transferencias/:id`, `DELETE /transferencias/:id` | `backendnest/src/transferencias/transferencias.service.spec.ts`, `backendnest/src/contas/contas.service.spec.ts` | `backendnest/src/transferencias/transferencias.controller.spec.ts`, `backendnest/src/transferencias/dto/transferencia.dto.spec.ts` | `Financial flow (e2e)` valida transferencia entre contas, comissao, saldo de origem/destino e bloqueio de conta alheia | Origem igual ao destino, conta de outro usuario, comissao negativa, saldo incorreto, soft delete | Integrada |
| Dividas | `POST /dividas`, `GET /dividas`, `GET /dividas/:id`, `PATCH /dividas/:id/desativar` | `backendnest/src/dividas/dividas.service.spec.ts` | `backendnest/src/dividas/dividas.controller.spec.ts`, `backendnest/src/dividas/dto/divida.dto.spec.ts` | `Financial flow (e2e)` cria divida antes do pagamento associado | Valor total/parcela invalida, taxa negativa, vencimento anterior ao inicio, conta de outro usuario, acesso indevido, periodicidade invalida | Integrada |
| Pagamentos de divida | `POST /pagos-divida`, `GET /pagos-divida/divida/:dividaId`, `GET /pagos-divida/:id`, `DELETE /pagos-divida/:id` | `backendnest/src/pagos-divida/pagos-divida.service.spec.ts` | `backendnest/src/pagos-divida/pagos-divida.controller.spec.ts`, `backendnest/src/pagos-divida/dto/pago-divida.dto.spec.ts` | `Financial flow (e2e)` cria pagamento, valida `transacaoId`, transacao `DESPESA`, saldo e isolamento | Operacao atomica pagamento/transacao, categoria nao despesa, soft delete conjunto, saldo incorreto | Integrada |
| Dashboard financeiro | `GET /dashboard` | `backendnest/src/dashboard/dashboard.service.spec.ts` | `backendnest/src/dashboard/dashboard.controller.spec.ts`, `backendnest/src/dashboard/dto/dashboard.dto.spec.ts` | `backendnest/test/dashboard.e2e-spec.ts` valida agregados mensais reais, soft delete e isolamento multiusuario | Totais consolidados com dados excluidos, ultimas transacoes indevidas, mistura entre usuarios, mes invalido | Integrada |
| Relatorios | `GET /relatorios` | `backendnest/src/relatorios/relatorios.service.spec.ts` | `backendnest/src/relatorios/relatorios.controller.spec.ts`, `backendnest/src/relatorios/dto/relatorio.dto.spec.ts` | `backendnest/test/relatorios.e2e-spec.ts` valida relatorio mensal real, filtros, totais e soft delete | Agregados por periodo incorretos, transacoes soft-deleted em totais, vazamento multiusuario, filtros invalidos | Integrada |
| Previsao de deficit | `GET /previsoes/deficit?mes=` | `backendnest/src/previsoes/previsoes.service.spec.ts` | `backendnest/src/previsoes/previsoes.controller.spec.ts`, `backendnest/src/previsoes/dto/previsao.dto.spec.ts` | `backendnest/test/previsoes.e2e-spec.ts` valida features reais em PostgreSQL, isolamento multiusuario e contrato ML controlado | Mes invalido, usuario autenticado nao propagado, contrato com ML sem cobertura integrada | Integrada |
| Audit logs | `GET /audit-logs?limit=&offset=` | `backendnest/src/security/logs.service.security.spec.ts` | `backendnest/src/logs/audit-logs.controller.spec.ts`, `backendnest/src/logs/dto/audit-logs.dto.spec.ts` | `backendnest/test/audit-logs.e2e-spec.ts` valida eventos reais, paginacao, sanitizacao e isolamento multiusuario | Vazamento de senha/token em logs, paginacao invalida, listagem de outro usuario, consulta de auditoria sem sanitizacao | Integrada |
| Metas | `POST /metas`, `GET /metas`, `GET /metas/:id`, `PATCH /metas/:id` | `backendnest/src/metas/metas.service.spec.ts` | Pendente | `backendnest/test/metas-alertas-integrity.e2e-spec.ts` valida `PATCH` com `montoActual: 0` | Objetivo positivo, valor atual `>= 0`, data limite real, conta/divida de outro usuario, meta inativa em listagem | Integrada |
| Alertas | `POST /alertas`, `GET /alertas`, `GET /alertas/:id`, `PATCH /alertas/:id/desativar` | `backendnest/src/alertas/alertas.service.spec.ts` | Pendente | `backendnest/test/metas-alertas-integrity.e2e-spec.ts` rejeita referencia de meta de outro usuario | Referencia existente, do tipo correto e do usuario autenticado; alerta inativo em listagem | Integrada |
| Orcamentos | `POST /orcamentos`, `GET /orcamentos`, `GET /orcamentos/:id`, `PATCH /orcamentos/:id` | `backendnest/src/orcamentos/orcamentos.service.spec.ts` | Pendente | `backendnest/test/orcamento-write-contract.e2e-spec.ts` valida criacao concorrente, duplicidade, isolamento e PATCH vazio | Valor planejado invalido, duplicidade por usuario/mes (`409`), PATCH vazio (`422`), acesso indevido | Integrada (global por usuario/mes; categorias pendentes) |

## Cobertura atual e limitacoes

As fases numeradas abaixo pertencem ao historico de ampliacao de testes;
nao sao as fases A-D do backend nem as fases da atualizacao documental.
Os cenarios descritos existem no repositorio; sua execucao atual exige evidencia propria.

- Fase 0 estabilizou o E2E para usar o mesmo contrato global de producao: `ValidationPipe`, `ResponseInterceptor` e o filtro global registrado por `APP_FILTER`.
- Fase 1 adicionou helpers/factories E2E em `backendnest/test/helpers` e `backendnest/test/factories`.
- Fase 2 adicionou cobertura controller/DTO dos modulos prioritarios: contas, transacoes, transferencias, dividas, pagos-divida, dashboard, relatorios, previsoes e audit-logs.
- Os unit tests cobrem regras financeiras criticas: valores positivos, comissao/taxa nao negativa, categoria `DESPESA` para pagamento de divida, isolamento por `usuarioId`, calculo de saldo, soft delete e agregacoes.
- O E2E atual cobre um fluxo real com PostgreSQL: registro de dois usuarios, login/JWT, contas, categorias, receita, despesa, saldo, isolamento multiusuario, soft delete de transacao, transferencia e pagamento de divida com transacao associada.
- Dashboard e relatorios ja possuem E2E dedicado na Fase 3 para validar consultas reais, agregacoes, filtros, soft delete e isolamento multiusuario.
- Audit logs ja possui E2E dedicado na Fase 3 para validar eventos reais, paginacao, sanitizacao e isolamento multiusuario.
- Previsao de deficit ja possui E2E dedicado na Fase 3 com cliente ML controlado, validando features reais calculadas a partir do PostgreSQL.
- A matriz de frontend fica separada em `docs/desenvolvimento/TESTES_FRONTEND.md` e ja registra screen tests para login, dashboard, transacoes, contas, transferencias, dividas, pagamentos de divida, relatorios, previsao de deficit e audit logs.
- `ml-finance-tcc` ja possui suite pytest inicial cobrindo data loader, preprocessing, model repository, API direta e integracao HTTP FastAPI.

## Evidencia tecnica atual

Registro historico apos a antiga Fase 2 de testes. O registro original nao
identifica commit, data e ambiente; estes numeros sao preservados, nao
revalidados nem apresentados como resultado da revisao atual:

- `backendnest`: `npm test -- --runInBand` -> 42 suites / 198 tests passando.
- `backendnest`: `npm run test:e2e` -> 4 suites / 6 tests passando.
- `frontend`: suite critica financeira, analitica e auditoria -> 18 suites / 77 tests passando.
- `ml-finance-tcc`: `pytest tests -p no:cacheprovider` -> 15 tests passando.

## Proxima fase recomendada

A antiga Fase 3 de testes adicionou suites dedicadas dos modulos prioritarios.
A sugestao anterior de ampliar telas frontend fica como contexto historico:
essa frente evolui separadamente e nao foi reauditada nesta revisao documental.
O backlog vigente e seus limites ficam no [roadmap](ROADMAP_PROFISSIONALIZACAO.md).

## Entregas backend A-D e limites de evidencia

As referencias abaixo identificam integracao em `main`, nao uma nova execucao
de testes nem autorizacao para acessar dados reais. Os caminhos de codigo e
suite sao relativos a raiz do repositorio.

| Entrega | Evidencia integrada | Limite |
| --- | --- | --- |
| A: auditoria atomica de Transacoes | PR #121, `e0fe896`; `backendnest/src/transacoes/transacoes.service.ts`; `backendnest/test/transacoes-atomic-audit.e2e-spec.ts` | CRUD financeiro e auditoria de negocio na mesma transacao; suite provoca falha de auditoria e verifica rollback. Nao encerra atomicidade de auditoria em Transferencias, Pagamentos ou outros dominios. |
| B: contrato de Orcamentos | PR #122, `a9affdf`; `backendnest/src/orcamentos/orcamentos.service.ts`; `backendnest/test/orcamento-write-contract.e2e-spec.ts` | Duplicidade por usuario/mes, inclusive concorrente, retorna conflito `409`; PATCH vazio retorna `422`. Orcamento e global mensal, com progresso sobre despesas; nao ha alocacoes por categoria. |
| C1: diagnostico de dados | PR #123, `b01e12d`; `backendnest/scripts/data-readiness.cjs`; `backendnest/test/data-readiness.e2e-spec.ts` | Diagnostico read-only exige destino explicito e cobre esquema/dados financeiros selecionados, nao todo o banco. Nao comprova que a base real foi verificada. |
| C2: recuperacao sintetica | PR #124, `dbea09f`; `backendnest/test/backup-restore.e2e-spec.ts` | Ensaio com bases e dados ficticios usando pg_dump/pg_restore. Nao comprova backup ou restauracao dos dados reais. |
| C3: invariante SQL | PR #125, `5bda4da`; `backendnest/migrations/0011_validate_transacao_positive_amount.sql`; `backendnest/test/transacao-positive-amount.e2e-spec.ts` | CHECK exige valor positivo e diferente de NaN, incluindo registros excluidos logicamente. Arquivo versionado nao comprova migracao aplicada no destino real. |
| D: verificacao reproduzivel | PR #126, `9a71cee`; `backendnest/package.json`; `.github/workflows/ci.yml`; `backendnest/src/verification-scripts.spec.ts` | `lint:check` e `typecheck` compartilhados com CI; typecheck desativa escrita incremental. Comandos existentes nao comprovam execucao nesta revisao. |

### Pendencias distintas de defeitos

- **Produto:** alocacoes de orcamento por categoria e respectivo progresso ainda nao implementados; manter o orcamento global disponivel sem prometer categorias.
- **Integridade:** avaliar auditoria atomica dos demais dominios financeiros separadamente; a entrega A nao os inclui.
- **Dados reais:** conferir esquema aplicado e migracoes, autorizar diagnostico no destino, comprovar backup/restauracao e validar importacoes antes da sincronizacao definitiva. A fase C nao criou um importador nem realizou sincronizacao.
- **Autenticacao:** rotacao e revogacao de sessoes ja existem; refinamentos adicionais exigem avaliacao propria de risco/escopo, sem tratar a base existente como ausente.
- **Documentacao:** arquitetura, procedimentos e OpenAPI seguem nas fases documentais posteriores; esta revisao nao os declara atualizados.
