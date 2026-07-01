# Requisitos e Matriz de Rastreabilidade do MVP

Objetivo: relacionar os requisitos centrais do MVP financeiro com endpoints,
servicos e testes que aumentam a confianca tecnica do backend.

Convencoes:

- `Controller/DTO` cobre delegacao do controller usando `req.user.id`, query/body DTOs e validacoes de contrato HTTP.
- `E2E` aponta para o fluxo PostgreSQL em `backendnest/test/app.e2e-spec.ts` quando o requisito ja aparece no teste integrado.
- `Parcial` significa que existe cobertura relevante, mas ainda falta E2E dedicado, screen test frontend ou cenario automatizado mais especifico.

| requisito | endpoint principal | service test | controller/DTO test | E2E relacionado | risco coberto | status |
| --- | --- | --- | --- | --- | --- | --- |
| Auth: cadastro, login e JWT | `POST /auth/register`, `POST /auth/login`, rotas com `JwtAuthGuard` | `backendnest/src/auth/auth.service.spec.ts`, `backendnest/src/auth/strategies/jwt.strategy.spec.ts` | `backendnest/src/auth/auth.controller.spec.ts` | `Financial flow (e2e)` registra usuarios A/B, faz login, usa JWT e rejeita token invalido | Credenciais invalidas, rota financeira sem JWT, token invalido, senha/token fora da response | Coberto |
| Contas e saldo atual | `POST /contas`, `GET /contas`, `GET /contas/:id`, `PATCH /contas/:id/desativar` | `backendnest/src/contas/contas.service.spec.ts` | `backendnest/src/contas/contas.controller.spec.ts`, `backendnest/src/contas/dto/conta.dto.spec.ts` | `Financial flow (e2e)` valida saldo via `GET /contas` apos receitas, despesas, soft delete, transferencias e pagamento de divida | Saldo incorreto, conta de outro usuario, conta inativa em listagem, payload invalido | Coberto |
| Categorias por tipo | `POST /categorias`, `GET /categorias`, `GET /categorias/:id` | `backendnest/src/categorias/categorias.service.spec.ts` | Pendente | `Financial flow (e2e)` cria categorias de receita/despesa e usa categoria despesa no pagamento de divida | Categoria com usuario errado, categoria inativa, tipo incompativel com transacao/pagamento | Parcial |
| Transacoes financeiras | `POST /transacoes`, `GET /transacoes`, `GET /transacoes/:id`, `DELETE /transacoes/:id` | `backendnest/src/transacoes/transacoes.service.spec.ts` | `backendnest/src/transacoes/transacoes.controller.spec.ts`, `backendnest/src/transacoes/dto/transacao.dto.spec.ts` | `Financial flow (e2e)` cria receita/despesa, valida saldo, faz soft delete e confirma ausencia no saldo/listagem | Valor `<= 0`, categoria de tipo incorreto, soft delete ignorado, isolamento por usuario, filtros invalidos | Coberto |
| Transferencias entre contas | `POST /transferencias`, `GET /transferencias`, `GET /transferencias/:id`, `DELETE /transferencias/:id` | `backendnest/src/transferencias/transferencias.service.spec.ts`, `backendnest/src/contas/contas.service.spec.ts` | `backendnest/src/transferencias/transferencias.controller.spec.ts`, `backendnest/src/transferencias/dto/transferencia.dto.spec.ts` | `Financial flow (e2e)` valida transferencia entre contas, comissao, saldo de origem/destino e bloqueio de conta alheia | Origem igual ao destino, conta de outro usuario, comissao negativa, saldo incorreto, soft delete | Coberto |
| Dividas | `POST /dividas`, `GET /dividas`, `GET /dividas/:id`, `PATCH /dividas/:id/desativar` | `backendnest/src/dividas/dividas.service.spec.ts` | `backendnest/src/dividas/dividas.controller.spec.ts`, `backendnest/src/dividas/dto/divida.dto.spec.ts` | `Financial flow (e2e)` cria divida antes do pagamento associado | Valor total/parcela invalida, taxa negativa, conta de outro usuario, acesso indevido, periodicidade invalida | Coberto |
| Pagamentos de divida | `POST /pagos-divida`, `GET /pagos-divida/divida/:dividaId`, `GET /pagos-divida/:id`, `DELETE /pagos-divida/:id` | `backendnest/src/pagos-divida/pagos-divida.service.spec.ts` | `backendnest/src/pagos-divida/pagos-divida.controller.spec.ts`, `backendnest/src/pagos-divida/dto/pago-divida.dto.spec.ts` | `Financial flow (e2e)` cria pagamento, valida `transacaoId`, transacao `DESPESA`, saldo e isolamento | Operacao atomica pagamento/transacao, categoria nao despesa, soft delete conjunto, saldo incorreto | Coberto |
| Dashboard financeiro | `GET /dashboard` | `backendnest/src/dashboard/dashboard.service.spec.ts` | `backendnest/src/dashboard/dashboard.controller.spec.ts`, `backendnest/src/dashboard/dto/dashboard.dto.spec.ts` | `backendnest/test/dashboard-relatorios.e2e-spec.ts` valida agregados mensais reais, soft delete e isolamento multiusuario | Totais consolidados com dados excluidos, ultimas transacoes indevidas, mistura entre usuarios, mes invalido | Coberto |
| Relatorios | `GET /relatorios` | `backendnest/src/relatorios/relatorios.service.spec.ts` | `backendnest/src/relatorios/relatorios.controller.spec.ts`, `backendnest/src/relatorios/dto/relatorio.dto.spec.ts` | `backendnest/test/dashboard-relatorios.e2e-spec.ts` valida relatorio mensal real, filtros, totais e soft delete | Agregados por periodo incorretos, transacoes soft-deleted em totais, vazamento multiusuario, filtros invalidos | Coberto |
| Previsao de deficit | `GET /previsoes/deficit?mes=` | Pendente service test dedicado | `backendnest/src/previsoes/previsoes.controller.spec.ts`, `backendnest/src/previsoes/dto/previsao.dto.spec.ts` | `backendnest/test/previsoes.e2e-spec.ts` valida features reais em PostgreSQL, isolamento multiusuario e contrato ML controlado | Mes invalido, usuario autenticado nao propagado, contrato com ML sem cobertura integrada | Coberto |
| Audit logs | `GET /audit-logs?limit=&offset=` | `backendnest/src/security/logs.service.security.spec.ts` | `backendnest/src/logs/audit-logs.controller.spec.ts`, `backendnest/src/logs/dto/audit-logs.dto.spec.ts` | `backendnest/test/audit-logs.e2e-spec.ts` valida eventos reais, paginacao, sanitizacao e isolamento multiusuario | Vazamento de senha/token em logs, paginacao invalida, listagem de outro usuario, auditoria incompleta | Coberto |
| Metas | `POST /metas`, `GET /metas`, `GET /metas/:id`, `PATCH /metas/:id` | `backendnest/src/metas/metas.service.spec.ts` | Pendente | Pendente E2E dedicado | Valores `<= 0`, conta/divida de outro usuario, meta inativa em listagem | Parcial |
| Alertas | `POST /alertas`, `GET /alertas`, `GET /alertas/:id`, `PATCH /alertas/:id/desativar` | `backendnest/src/alertas/alertas.service.spec.ts` | Pendente | Pendente E2E dedicado | Alerta de outro usuario, alerta inativo em listagem, referencia financeira invalida | Parcial |
| Orcamentos | `POST /orcamentos`, `GET /orcamentos`, `GET /orcamentos/:id`, `PATCH /orcamentos/:id` | `backendnest/src/orcamentos/orcamentos.service.spec.ts` | Pendente | Pendente E2E dedicado | Valor planejado `<= 0`, categoria de outro usuario, duplicidade por mes/categoria, acesso indevido | Parcial |

## Cobertura atual e limitacoes

- Fase 0 estabilizou o E2E para usar o mesmo contrato global de producao: `ValidationPipe`, `ResponseInterceptor` e `AppExceptionFilter`.
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

Ultima verificacao executada apos Fase 2:

- `backendnest`: `npm test -- --runInBand` -> 42 suites / 198 tests passando.
- `backendnest`: `npm run test:e2e` -> 4 suites / 6 tests passando.
- `frontend`: suite critica financeira, analitica e auditoria -> 18 suites / 77 tests passando.
- `ml-finance-tcc`: `pytest tests -p no:cacheprovider` -> 15 tests passando.

## Proxima fase recomendada

Fase 3 dos modulos prioritarios esta coberta. Frontend financeiro critico, relatorios, previsao de deficit, audit logs e pytest inicial do ML tambem foram iniciados. Proxima evolucao recomendada: ampliar telas frontend ainda parciais, com prioridade para categorias, metas, orcamentos, alertas e usuario.
