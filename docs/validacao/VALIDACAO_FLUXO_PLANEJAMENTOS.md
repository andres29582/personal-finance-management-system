# Validacao do Fluxo de Planejamentos Compartilhados

## Resumo executivo

Validacao realizada em 2026-07-08 na branch `codex/planejamentos-frontend-acertos-reapply`.

O frontend e o backend do modulo Planejamentos Compartilhados estao presentes e conectados por 12 endpoints reais. O cliente HTTP compartilhado do frontend desembrulha o envelope padrao `{ success, data, timestamp, requestId }`, e os services de Planejamentos consomem corretamente `response.data` ja normalizado.

O erro interno foi reproduzido por request HTTP real contra `http://localhost:3000`: o fluxo falha em `POST /planejamentos`, antes de chegar ao detalhe, participantes, gastos ou acertos.

Estado local no inicio da validacao:

- Branch: `codex/planejamentos-frontend-acertos-reapply`.
- `git status -sb`: havia mudancas locais em `backendnest/src/planejamentos/planejamentos.service.ts` e `backendnest/src/planejamentos/planejamentos.service.spec.ts`.
- Ultimo commit local: `6b4bbbb feat(frontend): add shared planning settlements`.
- O frontend completo de Planejamentos esta presente na branch atual: listagem/criacao/detalhe, participantes, gastos e acertos.
- Nao foi feito commit, push ou alteracao de Swagger.

Observacao importante: as mudancas locais de backend ja existiam antes deste documento. Esta validacao nao alterou backend, frontend nem `backendnest/swagger.yaml`.

## Estado atual do fluxo

Fluxo codificado:

1. Usuario acessa `/planejamentos`.
2. Frontend lista planejamentos com `GET /planejamentos`.
3. Usuario clica em `Novo`.
4. Frontend navega para `/planejamentos-form`.
5. Usuario preenche dados basicos e envia.
6. Frontend chama `POST /planejamentos`.
7. Backend cria o planejamento e cria automaticamente o participante proprietario.
8. Frontend deveria navegar para `/planejamentos-detail?id={id}`.
9. No detalhe, frontend carrega em paralelo:
   - `GET /planejamentos/:id`
   - `GET /planejamentos/:id/gastos`
   - `GET /planejamentos/:id/acertos`
10. A partir do detalhe, usuario pode adicionar participantes, gastos e sincronizar acertos.

Resultado real observado no backend local vivo:

- Login funciona.
- `POST /planejamentos` falha com HTTP 500 e body `{"statusCode":500,"message":"Erro interno no servidor."}`.
- Como a criacao falha, o fluxo nao alcanca o detalhe nem os demais endpoints no teste manual real.

## Mapa frontend

### `/planejamentos`

- Arquivo router: `frontend/app/planejamentos.tsx`
- Screen: `PlanejamentosScreen`
- Responsabilidade: listar planejamentos, filtrar por status e navegar para criacao/detalhe.
- Params: nenhum.
- Navegacao anterior: menu lateral `Planejamentos` ou retorno de telas internas.
- Navegacao posterior:
  - `/planejamentos-form` pelo botao `Novo`.
  - `/planejamentos-detail?id={id}` pelo botao `Ver detalhe`.
- Auth: protegida pelo fluxo global de token do `api`; em erro unauthorized faz `router.replace('/login')`.
- Services usados:
  - `listPlanejamentos`
- Endpoint:
  - `GET /planejamentos`
- Testes:
  - `frontend/src/modules/planejamentos/__tests__/planejamentos-screen.test.tsx`
  - `frontend/src/modules/planejamentos/__tests__/planejamentoService.test.ts`

### `/planejamentos-form`

- Arquivo router: `frontend/app/planejamentos-form.tsx`
- Screen: `PlanejamentoFormScreen`
- Responsabilidade: criar planejamento com dados basicos.
- Params: nenhum.
- Navegacao anterior: `/planejamentos`.
- Navegacao posterior:
  - sucesso: `/planejamentos-detail?id={planejamento.id}` via `router.replace`.
  - cancelar: `router.back()`.
- Auth: via `api`; em unauthorized faz `router.replace('/login')`.
- Services usados:
  - `createPlanejamento`
- Endpoint:
  - `POST /planejamentos`
- Testes:
  - `frontend/src/modules/planejamentos/__tests__/planejamentos-form.test.tsx`
  - `frontend/src/modules/planejamentos/__tests__/planejamentoService.test.ts`

### `/planejamentos-detail`

- Arquivo router: `frontend/app/planejamentos-detail.tsx`
- Screen: `PlanejamentoDetailScreen`
- Responsabilidade: exibir dados gerais, participantes, gastos e acertos; navegar para formularios relacionados; executar sincronizacao e acoes de acertos.
- Params:
  - `id`: id do planejamento.
- Navegacao anterior:
  - `/planejamentos` pelo botao `Ver detalhe`.
  - `/planejamentos-form` apos criacao.
  - formularios de participante/gasto apos salvar.
- Navegacao posterior:
  - `/planejamentos-participante-form?id={id}`.
  - `/planejamentos-gasto-form?id={id}`.
  - `/planejamentos`.
- Auth: via `api`; em unauthorized faz `router.replace('/login')`.
- Services usados:
  - `getPlanejamentoById`
  - `listGastosPlanejamento`
  - `listAcertosPlanejamento`
  - `syncAcertosPlanejamento`
  - `payAcertoPlanejamento`
  - `cancelAcertoPlanejamento`
  - `reopenAcertoPlanejamento`
- Endpoints:
  - `GET /planejamentos/:id`
  - `GET /planejamentos/:planejamentoId/gastos`
  - `GET /planejamentos/:planejamentoId/acertos`
  - `POST /planejamentos/:planejamentoId/acertos/sincronizar`
  - `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/pagar`
  - `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/cancelar`
  - `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/reabrir`
- Testes:
  - `frontend/src/modules/planejamentos/__tests__/planejamentos-detail.test.tsx`

### `/planejamentos-participante-form`

- Arquivo router: `frontend/app/planejamentos-participante-form.tsx`
- Screen: `PlanejamentoParticipanteFormScreen`
- Responsabilidade: adicionar participante manual ou com email.
- Params:
  - `id`: id do planejamento.
- Navegacao anterior:
  - `/planejamentos-detail?id={id}`.
  - empty state de gasto sem participantes.
- Navegacao posterior:
  - sucesso/voltar: `/planejamentos-detail?id={id}`.
  - sem id: `/planejamentos`.
- Auth: via `api`; em unauthorized faz `router.replace('/login')`.
- Services usados:
  - `addParticipantePlanejamento`
- Endpoint:
  - `POST /planejamentos/:id/participantes`
- Testes:
  - `frontend/src/modules/planejamentos/__tests__/planejamentos-participante-form.test.tsx`

### `/planejamentos-gasto-form`

- Arquivo router: `frontend/app/planejamentos-gasto-form.tsx`
- Screen: `PlanejamentoGastoFormScreen`
- Responsabilidade: criar gasto compartilhado, escolher pagador e participantes da divisao.
- Params:
  - `id`: id do planejamento.
- Navegacao anterior:
  - `/planejamentos-detail?id={id}`.
- Navegacao posterior:
  - sucesso/voltar: `/planejamentos-detail?id={id}`.
  - se nao ha participantes: `/planejamentos-participante-form?id={id}`.
- Auth: via `api`; em unauthorized faz `router.replace('/login')`.
- Services usados:
  - `getPlanejamentoById`
  - `createGastoPlanejamento`
- Endpoints:
  - `GET /planejamentos/:id`
  - `POST /planejamentos/:planejamentoId/gastos`
- Testes:
  - `frontend/src/modules/planejamentos/__tests__/planejamentos-gasto-form.test.tsx`

## Mapa backend

Todos os endpoints reais estao em `backendnest/src/planejamentos/planejamentos.controller.ts` e usam `@UseGuards(JwtAuthGuard)`.

| Metodo | Endpoint | Controller method | Service method | Auth | Possiveis erros | Frontend usa? |
|---|---|---|---|---|---|---|
| POST | `/planejamentos` | `create` | `create` | Sim | DTO invalido, periodo invalido, erro TypeORM/transacao ao salvar planejamento/participante | Sim |
| GET | `/planejamentos` | `findAll` | `findAll` | Sim | Status invalido, auth | Sim |
| GET | `/planejamentos/:id` | `findOne` | `findOne` | Sim | UUID invalido, not found/acesso negado | Sim |
| POST | `/planejamentos/:id/participantes` | `addParticipante` | `addParticipante` | Sim | DTO invalido, not owner, participante duplicado | Sim |
| POST | `/planejamentos/:planejamentoId/gastos` | `createGasto` | `createGasto` | Sim | DTO invalido, pagador invalido, divisao invalida, sem acesso | Sim |
| GET | `/planejamentos/:planejamentoId/gastos` | `findGastos` | `findGastos` | Sim | UUID invalido, sem acesso | Sim |
| GET | `/planejamentos/:planejamentoId/gastos/:gastoId` | `findGasto` | `findGasto` | Sim | UUID invalido, gasto nao encontrado, sem acesso | Service existe; tela atual nao chama diretamente |
| GET | `/planejamentos/:planejamentoId/acertos` | `findAcertos` | `findAcertos` | Sim | UUID invalido, sem acesso, erro de calculo | Sim |
| POST | `/planejamentos/:planejamentoId/acertos/sincronizar` | `sincronizarAcertos` | `sincronizarAcertos` | Sim | Sem acesso, participante invalido no calculo, conflito unico | Sim |
| PATCH | `/planejamentos/:planejamentoId/acertos/:acertoId/pagar` | `pagarAcerto` | `pagarAcerto` | Sim | Sem acesso, acerto nao encontrado, transicao invalida, permissao | Sim |
| PATCH | `/planejamentos/:planejamentoId/acertos/:acertoId/cancelar` | `cancelarAcerto` | `cancelarAcerto` | Sim | Sem acesso, acerto nao encontrado, transicao invalida, not owner | Sim |
| PATCH | `/planejamentos/:planejamentoId/acertos/:acertoId/reabrir` | `reabrirAcerto` | `reabrirAcerto` | Sim | Sem acesso, acerto nao encontrado, transicao invalida, not owner | Sim |

Parametros:

- `POST /planejamentos/:id/participantes` usa `id` no backend e frontend.
- Rotas de gastos/acertos usam `planejamentoId`, `gastoId` e `acertoId` no backend e frontend.
- Nao foi encontrada divergencia de nomes de params entre frontend e backend.

## Mapa frontend -> backend

| Funcao frontend | Metodo | Endpoint | Payload | Response esperada | Screen que usa | Status |
|---|---|---|---|---|---|---|
| `listPlanejamentos` | GET | `/planejamentos` | query `status?` | `Planejamento[]` | `PlanejamentosScreen` | Implementado e testado |
| `createPlanejamento` | POST | `/planejamentos` | `nome`, `tipo`, `descricao?`, `dataInicio?`, `dataFim?` | `Planejamento` | `PlanejamentoFormScreen` | Implementado; request real falha 500 no backend vivo |
| `getPlanejamentoById` | GET | `/planejamentos/:id` | path `id` | `Planejamento` | `PlanejamentoDetailScreen`, `PlanejamentoGastoFormScreen` | Implementado |
| `addParticipantePlanejamento` | POST | `/planejamentos/:id/participantes` | `nome`, `email?`, `usuarioId?` | `ParticipantePlanejamento` | `PlanejamentoParticipanteFormScreen` | Implementado |
| `listGastosPlanejamento` | GET | `/planejamentos/:planejamentoId/gastos` | path `planejamentoId` | `GastoPlanejamento[]` | `PlanejamentoDetailScreen` | Implementado |
| `createGastoPlanejamento` | POST | `/planejamentos/:planejamentoId/gastos` | `descricao`, `valorCentavos`, `dataGasto`, `comportamento`, `pagoPorParticipanteId`, `participantesIds`, opcionais | `GastoPlanejamento` | `PlanejamentoGastoFormScreen` | Implementado |
| `getGastoPlanejamentoById` | GET | `/planejamentos/:planejamentoId/gastos/:gastoId` | path params | `GastoPlanejamento` | Nenhuma tela atual identificada | Service implementado |
| `listAcertosPlanejamento` | GET | `/planejamentos/:planejamentoId/acertos` | path `planejamentoId` | `AcertoPlanejamentoSugerido[]` | `PlanejamentoDetailScreen` | Implementado |
| `syncAcertosPlanejamento` | POST | `/planejamentos/:planejamentoId/acertos/sincronizar` | path `planejamentoId` | `AcertoPlanejamento[]` | `PlanejamentoDetailScreen` | Implementado |
| `payAcertoPlanejamento` | PATCH | `/planejamentos/:planejamentoId/acertos/:acertoId/pagar` | path params | `AcertoPlanejamento` | `PlanejamentoDetailScreen` | Implementado |
| `cancelAcertoPlanejamento` | PATCH | `/planejamentos/:planejamentoId/acertos/:acertoId/cancelar` | path params | `AcertoPlanejamento` | `PlanejamentoDetailScreen` | Implementado |
| `reopenAcertoPlanejamento` | PATCH | `/planejamentos/:planejamentoId/acertos/:acertoId/reabrir` | path params | `AcertoPlanejamento` | `PlanejamentoDetailScreen` | Implementado |

Envelope:

- Backend usa `ResponseInterceptor` global para envelopar respostas com `{ success: true, data, timestamp, requestId }`.
- Frontend usa `frontend/src/shared/services/api.ts`.
- `unwrapApiResponse` detecta `success === true` e substitui `response.data` por `response.data.data`.
- Os services de Planejamentos retornam `response.data`; isto esta correto porque o interceptor ja desembrulhou o envelope.
- Nao foi encontrado acesso equivocado `response.data.data` nos services de Planejamentos.

## Mapa Swagger

Fonte: `backendnest/swagger.yaml`.

| Endpoint usado no frontend | Existe no backend | Existe no Swagger | Divergencia |
|---|---|---|---|
| `POST /planejamentos` | Sim | Sim | Nenhuma detectada |
| `GET /planejamentos` | Sim | Sim | Nenhuma detectada |
| `GET /planejamentos/{id}` | Sim | Sim | Swagger usa `{id}`, compativel |
| `POST /planejamentos/{id}/participantes` | Sim | Sim | Swagger usa `{id}`, compativel |
| `POST /planejamentos/{planejamentoId}/gastos` | Sim | Sim | Nenhuma detectada |
| `GET /planejamentos/{planejamentoId}/gastos` | Sim | Sim | Nenhuma detectada |
| `GET /planejamentos/{planejamentoId}/gastos/{gastoId}` | Sim | Sim | Service existe; tela atual nao usa diretamente |
| `GET /planejamentos/{planejamentoId}/acertos` | Sim | Sim | Nenhuma detectada |
| `POST /planejamentos/{planejamentoId}/acertos/sincronizar` | Sim | Sim | Nenhuma detectada |
| `PATCH /planejamentos/{planejamentoId}/acertos/{acertoId}/pagar` | Sim | Sim | Nenhuma detectada |
| `PATCH /planejamentos/{planejamentoId}/acertos/{acertoId}/cancelar` | Sim | Sim | Nenhuma detectada |
| `PATCH /planejamentos/{planejamentoId}/acertos/{acertoId}/reabrir` | Sim | Sim | Nenhuma detectada |

## Fluxo manual testado

Backend local detectado em `http://localhost:3000` via `GET /health` com HTTP 200.

Foi criado usuario temporario de validacao por `POST /auth/register` e autenticado por `POST /auth/login`. Dados sensiveis nao foram registrados neste documento.

### Paso 1 - Login

- Request:
  - Metodo: `POST`
  - Endpoint: `/auth/login`
  - Payload: email/senha de usuario temporario de validacao.
- Response:
  - Status HTTP: 200
  - Body resumido: `success=true`, `access_token` presente.
- Resultado: OK.

### Paso 2 - Criar planejamento

- Request:
  - Metodo: `POST`
  - Endpoint: `/planejamentos`
  - Payload:
    - `nome`: `Planejamento E2E Codex`
    - `tipo`: `CASA`
    - `descricao`: `Validacao e2e`
    - `dataInicio`: `2026-07-01`
    - `dataFim`: `2026-07-31`
- Response:
  - Status HTTP: 500
  - Body: `{"statusCode":500,"message":"Erro interno no servidor."}`
- Resultado: Falhou.
- Arquivo/metodo provavel:
  - `backendnest/src/planejamentos/planejamentos.controller.ts` -> `create`
  - `backendnest/src/planejamentos/planejamentos.service.ts` -> `create`
  - `criarPlanejamentoComProprietario`
  - `criarParticipanteProprietarioSeNecessario`

### Pasos 3 a 12

Nao executados no fluxo HTTP real porque o passo 2 bloqueou a criacao do planejamento e nao retornou `planejamento.id`.

Endpoints bloqueados por dependencia do planejamento criado:

- `GET /planejamentos`
- `GET /planejamentos/:id`
- `POST /planejamentos/:id/participantes`
- `POST /planejamentos/:planejamentoId/gastos`
- `GET /planejamentos/:planejamentoId/gastos`
- `POST /planejamentos/:planejamentoId/acertos/sincronizar`
- `GET /planejamentos/:planejamentoId/acertos`
- `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/pagar`
- `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/cancelar`
- `PATCH /planejamentos/:planejamentoId/acertos/:acertoId/reabrir`

## Ponto exato do erro interno

O erro interno ocorre em:

| Request | Status | Resultado |
|---|---:|---|
| `POST /planejamentos` | 500 | Falha com `Erro interno no servidor.` |
| `GET /planejamentos/:id` | Nao executado | Bloqueado pela falha na criacao |
| `GET /planejamentos/:id/gastos` | Nao executado | Bloqueado pela falha na criacao |
| `GET /planejamentos/:id/acertos` | Nao executado | Bloqueado pela falha na criacao |

Portanto, o erro observado na app ao tentar criar um planejamento nao vem do carregamento paralelo do detalhe. Ele acontece antes, na criacao do planejamento.

## Evidencia tecnica

Evidencias coletadas:

- Request HTTP real contra backend local:
  - `POST /planejamentos` retornou HTTP 500.
- Response real:
  - `{"statusCode":500,"message":"Erro interno no servidor."}`
- Controller:
  - `POST /planejamentos` delega para `planejamentosService.create(req.user, dto)`.
- Service:
  - `create` valida periodo, abre transacao, chama `criarPlanejamentoComProprietario`, depois retorna `findOne`.
  - `criarPlanejamentoComProprietario` salva `planejamento` e chama `criarParticipanteProprietarioSeNecessario`.
  - `criarParticipanteProprietarioSeNecessario` salva participante proprietario com dados do usuario autenticado.
- Tabela:
  - `participante_planejamento.nome` e `participante_planejamento.email` tem restricoes relevantes (`nome` NOT NULL, `email` nullable).
- Logs:
  - Os arquivos em `logs/` nao continham stack trace atual do request reproduzido.
  - `Get-CimInstance Win32_Process` para inspecionar o processo Node falhou com `Acceso denegado`.
- GitNexus:
  - `route_map` e `shape_check` para `/planejamentos` no repo `personal-finance-management-system` nao retornaram rotas. O apoio MCP foi tentado, mas o indice nao trouxe evidencia util para decorators Nest/Expo neste caso.

## Causa provavel

Causa provavel: erro nao tratado dentro da transacao de `PlanejamentosService.create`, especificamente na criacao automatica do participante proprietario.

O ponto de maior risco e `criarParticipanteProprietarioSeNecessario`, porque o backend salva um registro em `participante_planejamento` logo apos criar o planejamento. Se `req.user.nome` vier ausente/undefined no token do backend vivo, o insert tenta persistir `nome` invalido em coluna obrigatoria e TypeORM/PostgreSQL levanta excecao nao capturada como `AppException`, resultando no 500 generico.

Esta hipotese e consistente com:

- Falha somente em `POST /planejamentos`.
- Request com DTO valido.
- Registro automatico de participante proprietario no mesmo fluxo.
- Existencia de mudanca local pendente em `planejamentos.service.ts` que torna `nome` opcional e aplica fallback para prefixo do email.

Como os logs atuais nao mostraram stack trace, a causa acima deve ser tratada como provavel, nao como stack confirmada.

## Severidade

Alta.

Justificativa:

- Bloqueia o primeiro passo funcional de Planejamentos Compartilhados.
- Impede acesso ao detalhe, participantes, gastos e acertos para novos planejamentos.
- A app mostra erro generico, sem caminho de recuperacao para o usuario.

## Recomendacao de correcao

Correcao recomendada no backend:

- Em `backendnest/src/planejamentos/planejamentos.service.ts`, garantir nome valido para o participante proprietario:
  - usar `usuario.nome?.trim()` quando existir;
  - fallback para prefixo do email;
  - fallback final para string segura como `Usuario`.
- Adicionar teste unitario cobrindo usuario autenticado sem `nome`.
- Opcionalmente melhorar logs de excecoes nao controladas para registrar stack/requestId em ambiente de desenvolvimento.

Tambem e recomendado reiniciar o backend local apos aplicar a correcao, porque o processo vivo em `localhost:3000` pode estar rodando codigo anterior as mudancas locais.

## Testes existentes

Backend:

- `backendnest/src/planejamentos/planejamentos.controller.spec.ts`
  - Delegacao dos 12 handlers para o service.
- `backendnest/src/planejamentos/planejamentos.service.spec.ts`
  - Criacao de planejamento.
  - Criacao automatica do proprietario.
  - Participantes.
  - Gastos.
  - Calculo/listagem/sincronizacao de acertos.
  - Pay/cancel/reopen.
  - Regras de acesso e transicoes invalidas.
- `backendnest/src/planejamentos/planejamentos.repository.spec.ts`
  - Queries TypeORM, filtros de acesso, relations e salvamentos.
- `backendnest/src/planejamentos/dto/planejamento.dto.spec.ts`
  - DTOs e params.
- `backendnest/src/planejamentos/domain/*.spec.ts`
  - Calculo de divisoes, saldos e acertos.
- `backendnest/test/**/*.e2e-spec.ts`
  - Existem e2e de outros modulos, mas nao ha e2e especifico de Planejamentos.

Frontend:

- `frontend/src/modules/planejamentos/__tests__/planejamentoService.test.ts`
  - Mapeia todos os services para endpoints esperados.
- `planejamentos-screen.test.tsx`
  - Lista e navegacao.
- `planejamentos-form.test.tsx`
  - Validacao e criacao.
- `planejamentos-detail.test.tsx`
  - Carga paralela, empty states, navegacoes, acertos sugeridos/oficiais e acoes.
- `planejamentos-participante-form.test.tsx`
  - Validacao e envio de participante.
- `planejamentos-gasto-form.test.tsx`
  - Validacao de gasto, selecao de pagador/divisao e empty state sem participantes.

## Lacunas de teste

- Falta e2e backend cobrindo o fluxo completo de Planejamentos:
  - register/login;
  - criar planejamento;
  - validar participante proprietario automatico;
  - adicionar participante;
  - criar gasto;
  - listar/sincronizar/acertar acertos.
- Falta teste e2e/API para `POST /planejamentos` com usuario autenticado sem `nome` no payload JWT.
- Falta teste de integracao real com banco para garantir que o participante proprietario respeita `NOT NULL`.
- `PlanejamentoDetailScreen` usa `Promise.all`; se apenas um painel falha, a tela inteira cai em erro. Ha teste de erro geral, mas nao ha degradacao parcial por painel.
- Nao ha teste verificando o comportamento contra backend envelopado real; os tests de service mockam `api` ja desembrulhado.

## Validacoes executadas

Estado inicial:

- `git status -sb`: branch com mudancas locais em `backendnest/src/planejamentos/planejamentos.service.ts` e `.spec.ts`.
- `git branch --show-current`: `codex/planejamentos-frontend-acertos-reapply`.
- `git log --oneline -10`: ultimo commit `6b4bbbb feat(frontend): add shared planning settlements`.

Requests reais:

- `GET /health`: HTTP 200.
- `POST /auth/register`: HTTP 201.
- `POST /auth/login`: HTTP 200.
- `POST /planejamentos`: HTTP 500.

Backend:

- `npm test -- planejamentos --runInBand`: passou, 10 suites, 106 testes.
- `npm test -- --runInBand`: passou, 55 suites, 316 testes.
- `npm run test:e2e`: passou, 5 suites, 18 testes.
- `npm run build`: passou.
- `npm run lint`: nao executado porque o script `backendnest/package.json` usa `eslint ... --fix`, o que pode modificar backend, contrariando esta etapa.

Frontend:

- `npx tsc --noEmit`: passou.
- `npm test -- --runInBand`: passou, 45 suites, 440 testes.
- `npm run lint`: passou.
- `npx expo export --platform web --output-dir $env:TEMP\meu-sistema-financeiro-expo-export-check-planejamentos-flow`:
  - primeira tentativa no sandbox falhou com `spawn EPERM`;
  - segunda tentativa com permissao elevada passou;
  - rotas estaticas exportadas incluem `/planejamentos`, `/planejamentos-form`, `/planejamentos-detail`, `/planejamentos-gasto-form`, `/planejamentos-participante-form`.

## Correcao aplicada

- Causa confirmada:
  - O 500 reproduzido em `POST /planejamentos` no backend local estava sendo registrado em `audit_log` como `QueryFailedError`.
  - Mensagem do erro: `no existe la relacion "planejamento"`.
  - Portanto, a causa real do 500 observado no ambiente local era a migration de Planejamentos nao aplicada na base `gestao_financeira`.
  - A suspeita inicial sobre `req.user.nome` continua sendo um risco valido de robustez, mas nao foi a causa do 500 confirmado nos logs.
- Arquivo corrigido:
  - `backendnest/src/planejamentos/planejamentos.service.ts`.
- Mudanca aplicada:
  - `PlanejamentoUsuarioAutenticado` passou a tolerar `nome` e `email` ausentes.
  - A criacao do participante proprietario agora usa nome seguro:
    - `usuario.nome.trim()` quando existir;
    - prefixo do email quando `nome` nao existir;
    - fallback final `Proprietario`.
  - O email do participante proprietario e salvo como `usuario.email ?? null`.
  - A transacao, `tipo: VINCULADO`, `status: ATIVO` e contrato HTTP foram preservados.
- Testes adicionados/ajustados:
  - Teste para usuario autenticado sem `nome`, usando prefixo do email.
  - Teste para usuario autenticado sem `nome` nem `email`, usando fallback `Proprietario`.
  - O teste existente com `nome: Ana` cobre o caminho em que o nome vem no request user.
- Resultado antes/depois:
  - Antes: `POST /planejamentos` retornava HTTP 500 no ambiente local.
  - Diagnostico: `audit_log.details.errorMessage = "no existe la relacion \"planejamento\""`.
  - Acao de ambiente: aplicada localmente a migration `backendnest/migrations/0007_create_planejamentos_compartilhados.sql`.
  - Depois: `POST /planejamentos` retornou sucesso, e `GET /planejamentos/{id}` confirmou 1 participante proprietario automatico.
  - Participante proprietario verificado: `nome = Codex Fixed`, `tipo = VINCULADO`, `status = ATIVO`.
- Validacoes executadas apos a correcao:
  - `npm test -- planejamentos.service.spec.ts --runInBand`: passou, 45 testes.
  - `npm test -- --runInBand`: passou, 55 suites, 317 testes.
  - `npm run test:e2e`: passou, 5 suites, 18 testes.
  - `npm run build`: passou.
  - `.\node_modules\.bin\eslint.cmd "{src,apps,libs,test}/**/*.ts"`: passou sem erros; restaram warnings preexistentes de `no-unsafe-argument`.
  - Reproducao HTTP real em `localhost:3000`: register/login OK, `POST /planejamentos` OK, `GET /planejamentos/{id}` OK.

## Proximos passos recomendados

1. Garantir que a migration `0007_create_planejamentos_compartilhados.sql` seja aplicada nos ambientes de desenvolvimento/homologacao/producao antes de validar o modulo.
2. Adicionar e2e backend especifico para Planejamentos.
3. Considerar degradacao parcial no detalhe: falha de `acertos` nao deveria impedir a visualizacao de dados gerais e gastos.
4. Criar script de lint backend sem `--fix`, para permitir validacao sem modificar arquivos.
5. Opcionalmente melhorar observabilidade de excecoes nao controladas em desenvolvimento, exibindo requestId e stack em logs locais sem vazar detalhes para o cliente.
