# Arquitetura do backend

Este documento descreve a arquitetura do backend NestJS do sistema de gestao
financeira pessoal. Ele complementa o README operacional do backend e registra
as decisoes estruturais, fluxos centrais e pontos sensiveis de manutencao.

Para instalacao, comandos locais, dados demo e troubleshooting operacional,
consulte [backendnest/README.md](../../backendnest/README.md) e
[docs/operacao/RUNBOOK.md](../operacao/RUNBOOK.md).

## Visao geral

O backend fica em `backendnest/` e expoe uma API REST para o frontend Expo. A
aplicacao centraliza as regras de negocio financeiras, autentica usuarios com
JWT, persiste dados em PostgreSQL via TypeORM e integra a previsao de deficit
com o modulo externo de Machine Learning.

A composicao principal acontece em `backendnest/src/app.module.ts`:

- `ConfigModule` global para configuracao por variaveis de ambiente;
- `TypeOrmModule` com entidades explicitas e `synchronize: false`;
- `ThrottlerModule` como guarda global de rate limit;
- modulos de dominio financeiro e de suporte;
- middlewares de `requestId` e contexto de requisicao;
- filtro global para logs de excecao.

O bootstrap em `backendnest/src/main.ts` aplica:

- `helmet`;
- CORS configuravel;
- `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e
  `transform`;
- interceptor global de resposta;
- filtro global de excecoes de dominio.

## Stack tecnica

- **NestJS 11**: estrutura modular, controllers, providers, guards, pipes e
  filtros.
- **TypeScript**: tipagem dos DTOs, services, entidades e contratos internos.
- **TypeORM 0.3**: entidades, repositories e conexao PostgreSQL.
- **PostgreSQL**: banco relacional principal do backend.
- **JWT e Passport**: autenticacao por bearer token e estrategia
  `passport-jwt`.
- **bcrypt**: hash de senha.
- **Helmet, CORS e throttling**: protecoes HTTP basicas e limite de taxa.
- **Swagger/OpenAPI**: contrato estatico mantido em `backendnest/swagger.yaml`.
- **Jest e Supertest**: testes unitarios, controller tests e E2E.

O projeto nao depende de `synchronize` do TypeORM para evoluir schema. Mudancas
de modelo precisam ser refletidas por migrations SQL.

## Organizacao modular

O backend segue organizacao por dominio. Cada modulo tende a agrupar
controller, service, DTOs, entidade e repository quando aplicavel.

| Modulo | Papel arquitetural |
| --- | --- |
| `auth` | Cadastro, login, access token, refresh token, sessoes e reset de senha. |
| `users` | Perfil do usuario autenticado. |
| `contas` | Contas financeiras e saldo atual calculado em leitura. |
| `categorias` | Categorias de receitas e despesas, incluindo seed padrao por usuario. |
| `transacoes` | Receitas, despesas, filtros e exclusao logica. |
| `transferencias` | Movimentacao entre contas do mesmo usuario. |
| `dividas` | Cadastro, consulta e desativacao de dividas. |
| `pagos-divida` | Pagamentos de divida com transacao financeira associada. |
| `dashboard` | Agregacoes para resumo mensal. |
| `relatorios` | Consultas agregadas por periodo. |
| `orcamentos` | Planejamento mensal. |
| `metas` | Objetivos de economia ou reducao de divida. |
| `alertas` | Alertas por vencimento, metas e limite de gasto. |
| `previsoes` | Previsao de deficit e integracao com ML. |
| `logs` | Auditoria, request context, consulta de audit logs e filtro de excecoes. |
| `cep` | Consulta publica/utilitaria de CEP. |
| `common` | DTOs, excecoes, filtros, interceptors, middleware e utilitarios compartilhados. |

Os modulos financeiros compartilham algumas dependencias de negocio. Por
exemplo, pagamentos de divida criam transacoes associadas, transferencias
alteram saldos calculados e previsoes dependem de contas, transacoes e
transferencias historicas para construir features.

## Fluxo de autenticacao

O fluxo HTTP de autenticacao entra por `AuthController`:

1. `POST /auth/register` cria usuario, valida CPF/CEP, aplica hash de senha e
   cria categorias padrao.
2. `POST /auth/login` valida email/senha, cria uma sessao e devolve
   `access_token` e `refresh_token`.
3. `POST /auth/refresh` valida o refresh token, confere a sessao ativa,
   rotaciona o refresh token e devolve novo par de tokens.
4. Rotas protegidas usam `JwtAuthGuard`, que delega para `JwtStrategy`.
5. `JwtStrategy` valida o access token, exige `sid`, confere a sessao ativa e
   injeta o usuario autenticado na requisicao.
6. `POST /auth/logout` revoga a sessao atual.
7. Reset de senha revoga sessoes existentes para reduzir o risco de tokens
   antigos continuarem validos.

`AuthService` concentra a maior parte das regras sensiveis:

- validacao de credenciais;
- geracao de access e refresh token;
- leitura das chaves JWT via `ConfigService`;
- calculo de expiracao dos tokens;
- criacao, rotacao e revogacao de sessoes via `AuthSessionsService`;
- registro de eventos de auditoria de login, logout e reset de senha.

`AuthSessionsService` nao armazena refresh tokens em claro. Ele persiste apenas
hash SHA-256 do refresh token e compara hashes em validacoes futuras.

## Persistencia e migrations

A persistencia principal usa PostgreSQL com TypeORM. A conexao e declarada em
`AppModule` por `TypeOrmModule.forRootAsync`, lendo host, porta, usuario, senha
e banco via `ConfigService`.

Entidades registradas no modulo raiz incluem usuarios, sessoes de auth, tokens
de reset, logs de auditoria e os modelos financeiros principais: contas,
categorias, transacoes, transferencias, dividas, pagamentos, metas, alertas e
orcamentos.

Como `synchronize` esta desativado, migrations SQL sao parte do contrato de
evolucao do schema. Hoje elas ficam em `backendnest/migrations/`:

- `0001_mvp_baseline.sql`;
- `0002_align_schema_and_create_orcamento.sql`;
- `0003_add_usuario_cadastro_fields.sql`;
- `0004_add_auth_session.sql`;
- `0005_add_audit_log.sql`;
- `0006_soft_delete_lgpd_password_reset.sql`.

Ao alterar entidades, DTOs persistidos ou repositories, a manutencao deve
considerar:

- nova migration SQL ou ajuste de migration pendente;
- compatibilidade com dados existentes;
- impacto nos testes E2E que usam PostgreSQL;
- isolamento por `usuarioId` nos modulos financeiros.

## Integracao com Machine Learning

O modulo `previsoes` expoe `GET /previsoes/deficit?mes=YYYY-MM` como rota
autenticada. O fluxo principal e:

1. `PrevisoesController` recebe o usuario autenticado e a query opcional `mes`.
2. `PrevisoesService` coordena a construcao de features e a chamada ao cliente
   ML.
3. `DeficitFeaturesService` consulta historico financeiro, exige tres meses
   completos e monta o contrato de features numericas.
4. `MlPredictClientService` envia `POST /predict` para `ML_API_URL`.
5. A resposta V2 e validada antes de ser convertida para o DTO publico.

O contrato ML atual usa `schema_version = 2`, uma lista fechada de features e
resposta com `prediction` inteiro (`0` ou `1`) e `probability` numerica entre
`0` e `1`.

Essa integracao e um ponto de manutencao sensivel porque acopla:

- contrato de features do backend;
- API Python em `ml-finance-tcc`;
- historico financeiro persistido;
- mensagens e erros entregues ao usuario.

Mudancas no modelo ou no contrato V2 devem ser tratadas como alteracao
multi-modulo, com testes no backend e no servico ML.

## Validacao, guards e pipes

A validacao de entrada combina DTOs, decorators de `class-validator` e
`ValidationPipe` global.

O `ValidationPipe` e configurado para:

- remover campos nao declarados (`whitelist`);
- rejeitar campos extras (`forbidNonWhitelisted`);
- transformar tipos quando possivel (`transform`).

As rotas protegidas usam `JwtAuthGuard`, que depende da estrategia JWT e do
estado da sessao persistida. Isso significa que um access token valido
criptograficamente ainda precisa apontar para uma sessao ativa.

Alguns endpoints de auth tambem aplicam throttling especifico para reduzir
abuso em login, refresh e recuperacao de senha. Alem disso, ha throttling global
configurado no modulo raiz.

## Tratamento de erros e respostas

Respostas de sucesso passam pelo `ResponseInterceptor`, que envolve o retorno
dos controllers no formato:

```json
{
  "success": true,
  "data": {},
  "timestamp": "...",
  "requestId": "..."
}
```

Erros de dominio usam excecoes proprias em `common/exceptions` e sao
padronizados por `AppExceptionFilter` no formato:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem do erro"
  },
  "timestamp": "...",
  "requestId": "..."
}
```

O `LogsExceptionFilter` tambem atua globalmente para registrar negacoes de
acesso e erros internos. Para excecoes HTTP fora do modelo de dominio, ele
normaliza o payload e preserva o status HTTP.

## Auditoria e logs

O modulo `logs` registra eventos relevantes de autenticacao, acesso negado,
erros internos e eventos de entidade quando os services chamam `LogsService`.

O contexto de requisicao e propagado por middlewares:

- `RequestIdMiddleware` associa um identificador a cada request;
- `RequestContextMiddleware` guarda metodo, rota, IP, user-agent e usuario
  quando disponivel.

`LogsService` persiste `AuditLog` com tratamento defensivo: falhas ao salvar log
nao devem derrubar o fluxo principal. Antes de persistir detalhes, o service
sanitiza campos sensiveis como senha, password, token, access token, refresh
token e authorization. Emails e CPFs sao mascarados.

A consulta de auditoria fica em `GET /audit-logs`, protegida por JWT e limitada
ao usuario autenticado.

## Pontos sensiveis de manutencao

### AuthService

`AuthService` e pequeno em numero de consumidores diretos, mas concentra regras
criticas: credenciais, tokens, sessoes, reset de senha e auditoria. Alteracoes
devem preservar:

- hash de senha com bcrypt;
- refresh token armazenado apenas como hash;
- rotacao de refresh token;
- revogacao de sessoes em logout e reset;
- compatibilidade entre `JwtStrategy` e payload dos tokens;
- registros de auditoria sem vazamento de dados sensiveis.

### Integracao ML

`MlPredictClientService`, `DeficitFeaturesService` e o contrato V2 devem evoluir
juntos. Mudancas na lista de features, no `schema_version`, no endpoint
`/predict` ou nos limites de validacao podem quebrar a previsao de deficit sem
afetar os demais modulos.

### Modulos financeiros

Contas, transacoes, transferencias, dividas e pagamentos de divida formam o
nucleo financeiro. Eles afetam saldos, agregacoes, relatorios, dashboard,
features de ML e auditoria. O cuidado principal e manter:

- isolamento por usuario;
- soft delete consistente;
- calculo de saldo coerente com receitas, despesas, transferencias e pagamentos;
- validacao de categoria correta para operacoes financeiras;
- atomicidade em operacoes que criam registros relacionados.

### Migrations

Toda alteracao persistida precisa ser acompanhada por migration. O risco mais
alto e divergencia entre entidade TypeORM, schema real e testes E2E. Antes de
promover mudancas de schema, conferir:

- migrations em ordem;
- impacto em seed demo;
- queries de repositories;
- contratos de DTOs e OpenAPI;
- dados historicos usados pela previsao de deficit.

## Relacao com outros documentos

- [backendnest/README.md](../../backendnest/README.md): guia operacional do
  backend, com instalacao, variaveis, comandos, endpoints principais, seed demo
  e troubleshooting.
- [docs/produto/REQUISITOS.md](../produto/REQUISITOS.md): matriz de requisitos,
  endpoints, services, testes e riscos cobertos por funcionalidade.
- [docs/operacao/RUNBOOK.md](../operacao/RUNBOOK.md): checklist local para
  preparar demo, levantar backend/frontend/ML e executar verificacoes.
- [backendnest/swagger.yaml](../../backendnest/swagger.yaml): contrato OpenAPI
  estatico da API.

Este documento deve ficar focado na arquitetura. Passos operacionais detalhados,
comandos repetitivos e credenciais demo devem permanecer nos documentos
operacionais.
