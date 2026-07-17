# Validacao de Endpoints e APIs

## Definicao de Fonte Oficial

- Contrato oficial da API: `backendnest/swagger.yaml`
- Relatorio de auditoria: `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`
- Documentacao complementar: `backendnest/README.md`, `docs/README.md`, `docs/arquitetura/BACKEND.md`

O contrato oficial da API e `backendnest/swagger.yaml`.

Documentos em `docs/validacao/` sao relatorios de auditoria e nao substituem o contrato OpenAPI.

## Resumo Executivo

Estado geral: **coerente como contrato OpenAPI oficial, com pendencias documentais complementares menores**.

O backend possui **79 handlers HTTP reais** em controllers, e o `backendnest/swagger.yaml` documenta **79 operacoes**. A validacao mecanica confirmou a paridade entre controllers e Swagger.

O Swagger agora cobre endpoints publicos e protegidos, payloads de entrada, query params conhecidos, status codes principais, `operationId` unico por operacao, envelope global de sucesso `{ success, data, timestamp, requestId }` e os dois formatos de erro observados no runtime:

- erros de dominio envelopados com `{ success: false, error, timestamp, requestId }`;
- erros HTTP/Nest comuns com `{ statusCode, message, error }`.

As respostas 2xx usam schemas especificos de recurso onde aplicavel, como `ContaSuccess`, `TransacaoListSuccess`, `DashboardSuccess`, `RelatorioSuccess`, `PrevisaoDeficitSuccess`, `AuditLogsSuccess`, `PlanejamentoSuccess`, `GastoPlanejamentoSuccess` e `AcertoPlanejamentoSuccess`. Os responses genericos `OkObject` e `OkArray` continuam definidos apenas como fallback, mas nao sao referenciados pelas operacoes atuais.

Nao foi criada documentacao duplicada de endpoints. Este arquivo permanece como relatorio tecnico de auditoria; o contrato consumivel por clientes e ferramentas e o OpenAPI em `backendnest/swagger.yaml`.

## Escopo da Validacao

Pastas e arquivos revisados:

- Backend NestJS: `backendnest/src/**/*.controller.ts`, DTOs, services, repositories, guards, filters, interceptors, `main.ts`, `app.module.ts`, testes unitarios e E2E.
- Swagger/OpenAPI: `backendnest/swagger.yaml`.
- Documentacao: `backendnest/README.md`, `docs/README.md`, `docs/arquitetura/BACKEND.md`, `docs/specs/**`, `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`.
- Frontend Expo/React Native: services e tipos usados para conferir consumo das rotas existentes.

Documentos revisados sobre fonte oficial:

- `backendnest/swagger.yaml`: contem o contrato OpenAPI oficial.
- `backendnest/README.md`: agora aponta explicitamente para `backendnest/swagger.yaml` como contrato oficial.
- `docs/README.md`: agora aponta explicitamente para `backendnest/swagger.yaml` como contrato oficial.
- `docs/arquitetura/BACKEND.md`: ja indicava `backendnest/swagger.yaml` como contrato OpenAPI estatico.
- `docs/specs/**`: contem especificacoes complementares, especialmente planejamentos compartilhados, sem substituir o OpenAPI oficial.
- `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`: este relatorio de auditoria, nao contrato oficial.

## Convencoes Tecnicas Observadas

- Nao ha `setGlobalPrefix` em `backendnest/src/main.ts`; rotas reais saem da raiz (`/auth/login`, `/contas`, etc.).
- `ValidationPipe` global usa `whitelist`, `forbidNonWhitelisted` e `transform`.
- Respostas de sucesso sao envolvidas por `ResponseInterceptor` no formato `success/data/timestamp/requestId`.
- Erros de dominio (`AppException`) sao padronizados por `AppExceptionFilter`.
- Erros Nest/Passport/ValidationPipe podem sair no formato bruto `statusCode/message/error` pelo `LogsExceptionFilter`.
- Rotas protegidas usam `JwtAuthGuard`. Nao foi encontrado decorator de roles (`@Roles`) ou RBAC.
- Status esperado por convencao NestJS: `GET/PATCH/DELETE` retornam 200; `POST` retorna 201, exceto endpoints com `@HttpCode(200)` em auth (`login`, `forgot-password`, `reset-password-token`, `refresh`, `logout`). `POST /auth/reset-password` hoje retorna 201.

## Cobertura Consolidada do Swagger

| Area | Handlers reais | Operacoes no Swagger | Situacao |
| --- | ---: | ---: | --- |
| App e health | 2 | 2 | Coberto |
| CEP | 1 | 1 | Coberto |
| Auth | 7 | 7 | Coberto |
| Users | 2 | 2 | Coberto |
| Contas | 5 | 5 | Coberto |
| Categorias | 5 | 5 | Coberto |
| Transacoes | 5 | 5 | Coberto |
| Transferencias | 5 | 5 | Coberto |
| Dividas | 5 | 5 | Coberto |
| Pagos de divida | 4 | 4 | Coberto |
| Metas | 5 | 5 | Coberto |
| Alertas | 6 | 6 | Coberto |
| Orcamentos | 4 | 4 | Coberto |
| Relatorios | 1 | 1 | Coberto |
| Dashboard | 1 | 1 | Coberto |
| Previsoes | 1 | 1 | Coberto |
| Audit logs | 1 | 1 | Coberto |
| Planejamentos | 19 | 19 | Coberto |
| **Total** | **79** | **79** | **Coberto** |

Validacao mecanica executada:

- `rg --no-ignore '@(Get|Post|Patch|Delete|Put)\(' backendnest/src -g '*.controller.ts'`: 79 handlers (o `--no-ignore` inclui `src/logs`, ocultado pelo padrao generico `logs` do `.gitignore`).
- `rg '^\s{4}(get|post|patch|delete|put):' backendnest/swagger.yaml`: 79 operacoes.
- `rg '^\s+operationId:' backendnest/swagger.yaml`: 79 `operationId`, todos unicos.
- Parse YAML com Python/PyYAML: OK.
- Validacao interna de `$ref`: 467 referencias locais, 0 ausentes.
- Validacao de path params: 0 erros.
- Validacao de seguranca OpenAPI: endpoints publicos sem `BearerAuth`; endpoints protegidos com `BearerAuth`.
- Compatibilidade OpenAPI 3.0: `exclusiveMinimum` usa formato booleano com `minimum`; nao ha `exclusiveMinimum` numerico.

## Inconsistencias Encontradas

### Corrigidas nesta etapa

| ID | Situacao anterior | Correcao aplicada |
| --- | --- | --- |
| C-01 | Swagger tinha cobertura inferior aos handlers reais. | `backendnest/swagger.yaml` agora documenta as 79 operacoes correspondentes aos 79 handlers atuais. |
| C-02 | Swagger nao representava o envelope global de sucesso. | Schemas de resposta de sucesso agora usam envelope `{ success, data, timestamp, requestId }`. |
| C-03 | Contrato de auth estava defasado. | Payloads de cadastro/login/refresh/reset foram atualizados e endpoints publicos adicionais foram documentados. |
| I-01 | Politica de autenticacao publica/protegida estava incorreta no Swagger. | Endpoints publicos e protegidos foram marcados individualmente. |
| I-02 | `GET /transacoes` nao documentava filtros reais. | Query params `mes`, `tipo`, `contaId` e `categoriaId` foram documentados. |
| I-03 | `PATCH /transacoes/:id` nao documentava `tipo`. | Campo `tipo` foi incluido no DTO OpenAPI de atualizacao. |
| I-06 | Respostas 2xx ainda usavam `OkObject`/`OkArray` genericos em muitos endpoints. | Operacoes principais agora usam envelopes especificos por recurso/lista mantendo `{ success, data, timestamp, requestId }`. |
| I-07 | Operacoes nao tinham `operationId`, prejudicando geracao de clientes/SDKs. | As 79 operacoes atuais possuem `operationId` unico e estavel. |
| I-08 | Alguns schemas usavam `exclusiveMinimum: 0`, formato de JSON Schema/OpenAPI 3.1. | Corrigido para `minimum: 0` com `exclusiveMinimum: true`, compativel com OpenAPI 3.0. |
| P-01 | A remocao logica de participante implementada ainda aparecia como roadmap na spec conceitual. | `DELETE /planejamentos/:planejamentoId/participantes/:participanteId` foi movido para `Contrato atual implementado`. |
| P-02 | O resumo financeiro de Planejamentos ainda aparecia como roadmap e sem contrato OpenAPI explicito. | `GET /planejamentos/:id/resumo` foi implementado como consulta pura e documentado com schemas explicitos. |

### Pendencias restantes

| ID | Descricao | Evidencia | Impacto | Recomendacao |
| --- | --- | --- | --- | --- |
| I-05 | Contrato de erro tem dois formatos em runtime. | `AppExceptionFilter` e `LogsExceptionFilter` podem emitir envelopes diferentes. | Clientes precisam tratar ambos os formatos. | Manter ambos documentados no OpenAPI ou unificar filtros em etapa futura. |
| M-01 | Colecao Postman ausente. | Nao ha `.postman`, `postman` nem `*.postman_collection.json`. | Nao ha artefato Postman para validacao manual. | Opcionalmente gerar colecao a partir do OpenAPI oficial, sem manter contrato paralelo. |
| M-02 | Frontend tipa algumas operacoes destrutivas/desativacao como `Promise<void>`. | Services ignoram payload envelopado de sucesso. | Baixo; payload nao e usado. | Manter se intencional ou criar tipo `ApiEmptySuccess` no frontend. |
| M-03 | `POST /auth/reset-password` retorna 201 por default NestJS. | Endpoint nao define `@HttpCode(200)`. | Pequena incoerencia com outros comandos de auth. | Avaliar `@HttpCode(200)` se a equipe quiser uniformizar comandos sem criacao de recurso. |

## Divergencias Backend x Documentacao

| Item | Backend real | Documentacao atual | Situacao |
| --- | --- | --- | --- |
| Prefixo global | Sem prefixo global | Docs usam rotas raiz | Coerente |
| Fonte oficial | `backendnest/swagger.yaml` | README backend, README docs e este relatorio apontam para Swagger | Coerente |
| Health | `GET /health` publico | Swagger e runbook/documentos complementares | Coerente |
| Auth publicos | register, login, forgot-password, reset-password-token, refresh | Swagger documenta endpoints publicos e protegidos | Coerente |
| Users | `GET/PATCH /users/me` | Swagger documenta ambos | Coerente |
| Orcamentos | CRUD parcial implementado | Swagger documenta os 4 handlers reais | Coerente |
| Dashboard | `GET /dashboard` | Swagger documenta query params | Coerente |
| Relatorios | `GET /relatorios` | Swagger documenta query params | Coerente |
| Previsoes | `GET /previsoes/deficit` | Swagger documenta query params | Coerente |
| Audit logs | `GET /audit-logs` | Swagger documenta query params | Coerente |
| Planejamentos | 19 handlers implementados | Swagger documenta os 19 handlers reais, incluindo fechamento, resumo financeiro, arquivamento e cancelamento; a spec conceitual classifica os quatro como implementados | Coerente no contrato oficial |
| Respostas de sucesso | Envelope global | Swagger aplica schemas envelopados | Coerente |
| Schemas de resposta | Recursos e agregados retornados pelos services | Swagger usa schemas especificos onde aplicavel; `OkObject`/`OkArray` ficam como fallback nao referenciado | Coerente |

## Divergencias Backend x Frontend

| Item | Backend | Frontend | Situacao |
| --- | --- | --- | --- |
| Base URL | `PORT` default 3000 | `EXPO_PUBLIC_API_URL ?? http://localhost:3000` | Coerente |
| Envelope de sucesso | `ResponseInterceptor` envolve respostas | `api.ts` faz unwrap de `{ success:true,data }` | Coerente |
| Refresh token | `POST /auth/refresh` rotaciona refresh token | Interceptor salva novo access/refresh token | Coerente |
| Endpoints consumidos | Todos existem no backend | Services apontam para rotas reais | Coerente |
| ML | Frontend chama `GET /previsoes/deficit`; nao chama FastAPI direto | Coerente com docs |
| Planejamentos | Backend implementa modulo com 19 endpoints | Frontend consome o subconjunto de listagem, criacao, detalhe, participantes, gastos e acertos | Coerente; resumo, arquivamento e cancelamento ainda sem consumo frontend por estarem fora do escopo desta entrega |

Observacao atualizada em 2026-07-08: o frontend passou a consumir o modulo de
Planejamentos Compartilhados nas telas e fluxos de listagem, criacao, detalhe,
participantes, gastos e acertos. A observacao anterior de que o modulo nao era
consumido pelo frontend deve ser tratada como historica.

O backend expoe 19 endpoints de Planejamentos, cobertos pelo Swagger oficial, e
o fluxo local depende da migration
`backendnest/migrations/0007_create_planejamentos_compartilhados.sql`, que cria
as tabelas `planejamento`, `participante_planejamento`,
`gasto_planejamento`, `divisao_gasto` e `acerto_planejamento`.

## Divergencias Swagger/Postman

| Item | Swagger | Postman | Situacao |
| --- | --- | --- | --- |
| Existencia | `backendnest/swagger.yaml` existe e e fonte oficial | Nao encontrado | Postman ausente |
| Cobertura | 79 operacoes para 79 handlers reais | N/A | Swagger completo frente aos controllers |
| Envelope global | Aplicado nos schemas de sucesso | N/A | Coerente com runtime |
| Schemas 2xx | Envelopes especificos por recurso/lista/agregado | N/A | Reduzido uso de genericos; `OkMessage` e `EmptyEnvelope` mantidos onde fazem sentido |
| Formatos de erro | Dois formatos documentados | N/A | Coerente com runtime observado |
| Modulos recentes | Users, dashboard, relatorios, orcamentos, previsoes, audit logs, CEP, health e planejamentos documentados | N/A | Coberto no Swagger |

## Seguranca e Autorizacao

- Rotas financeiras principais estao protegidas por `JwtAuthGuard` em nivel de controller.
- `JwtStrategy` valida `sid` e sessao ativa, nao apenas assinatura do access token.
- Servicos e repositories filtram por `usuarioId` em contas, categorias, transacoes, transferencias, dividas, pagamentos, metas, alertas, orcamentos, dashboard, relatorios e audit logs.
- Nao ha roles/RBAC. O controle e baseado em usuario autenticado e, em planejamentos, em proprietario/participante autorizado.
- Endpoints publicos documentados no Swagger: `/`, `/health`, `/cep/{cep}`, `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password-token` e `/auth/refresh`.

## Resultado dos Testes

| Area | Comando | Resultado | Observacao |
| --- | --- | --- | --- |
| Backend | `npm test -- --runInBand planejamentos.service.spec.ts` | Passou: 1 suite, 191 tests | Inclui fluxo transacional de cancelamento, erros, ordem de reconciliacao e politica de somente leitura. |
| Backend | `npm test -- --runInBand planejamentos.controller.spec.ts` | Passou: 1 suite, 17 tests | Inclui delegacao sem body de `PATCH /planejamentos/:id/cancelar`. |
| Backend | `npm test -- --runInBand planejamentos` | Passou: 12 suites, 282 tests | Inclui dominio, service, controller, repository, DTOs e entidades de Planejamentos. |
| Backend | `npm test -- --runInBand --config ./test/jest-e2e.json planejamentos-resumo-financeiro.e2e-spec.ts` | Passou: 1 suite, 3 tests | PostgreSQL, Supertest e JWT reais. |
| Backend | `npm test -- --runInBand --config ./test/jest-e2e.json planejamentos-arquivar-lifecycle.e2e-spec.ts` | Passou: 1 suite, 4 tests | PostgreSQL real; cobre sucesso, somente leitura, autorizacao, concorrencia e rollback da reconciliacao. |
| Backend | `npm test -- --runInBand --config ./test/jest-e2e.json planejamentos-cancelar-lifecycle.e2e-spec.ts` | Passou: 1 suite, 7 tests | PostgreSQL real; cobre sucesso, historico, somente leitura, autorizacao, duas corridas e rollback da reconciliacao. |
| Backend | `npm run build` | Passou | `nest build`. |
| Backend | `npm run lint` | Passou | ESLint com a configuracao oficial do projeto. |
| OpenAPI | Parse YAML, refs, path params, seguranca, contagem e compatibilidade 3.0 | Passou | 79 operacoes, 79 `operationId` unicos, 467 referencias locais resolvidas, 0 ausentes, paridade integral com 79 handlers; 19 handlers e 19 operacoes de Planejamentos. |

## Recomendacoes de Manutencao

1. Manter `backendnest/swagger.yaml` como fonte oficial unica de contrato HTTP.
2. Atualizar o Swagger no mesmo PR de qualquer novo controller, rota, DTO ou alteracao de status code.
3. Usar documentos em `docs/validacao/` apenas como auditoria datada, sem duplicar contratos endpoint a endpoint.
4. Se uma colecao Postman for criada, gera-la a partir do OpenAPI oficial para evitar divergencia.
5. Sincronizar `docs/specs/planejamentos-compartilhados/api.md` com o MVP implementado ou marcar claramente os endpoints ainda planejados.

## Conclusao

A API esta funcionalmente coerente entre backend, frontend e testes automatizados para os fluxos usados hoje pela aplicacao. O contrato oficial agora esta formalizado em `backendnest/swagger.yaml`, e os README apontam para essa fonte. Este relatorio permanece como auditoria tecnica e nao substitui o contrato OpenAPI.
