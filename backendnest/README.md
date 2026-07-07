# Backend NestJS - Sistema de Gestao Financeira Pessoal

API REST do sistema de gestao financeira pessoal. Este backend atende o
frontend Expo, persiste os dados em PostgreSQL via TypeORM e integra a previsao
de deficit com o servico externo de Machine Learning quando ele esta ativo.

Documentos relacionados:

- Projeto completo: `../README.md`
- Arquitetura geral: `../docs/arquitetura/ARQUITETURA.md`
- Runbook local: `../docs/operacao/RUNBOOK.md`
- Contrato oficial da API: `swagger.yaml` (`backendnest/swagger.yaml` no repositorio)
- Baseline de banco: `migrations/0001_mvp_baseline.sql`

O contrato oficial da API e `backendnest/swagger.yaml`.

Documentos em `docs/validacao/` sao relatorios de auditoria e nao substituem o contrato OpenAPI.

## Papel do backend

O backend centraliza as regras de negocio financeiras e expoe endpoints
autenticados para:

- cadastro, login, refresh token, logout e recuperacao de senha;
- contas financeiras com saldo atual calculado em leitura;
- categorias de receitas e despesas;
- transacoes, transferencias, dividas e pagamentos de divida;
- dashboard, relatorios, orcamentos, metas e alertas;
- logs de auditoria consultaveis pelo usuario;
- previsao de deficit via API ML V2.

## Stack

- NestJS 11
- TypeScript
- TypeORM 0.3
- PostgreSQL
- JWT e Passport
- Bcrypt
- Helmet, CORS e throttling
- Jest e Supertest

## Estrutura principal

```text
src/
  auth/             # auth JWT, refresh sessions e reset de senha
  users/            # perfil do usuario
  contas/           # contas e saldo calculado
  categorias/       # categorias do usuario e seed padrao
  transacoes/       # receitas, despesas e ajustes
  transferencias/   # movimentacao entre contas proprias
  dividas/          # cadastro e ciclo de dividas
  pagos-divida/     # pagamentos atomicos com transacao associada
  dashboard/        # resumo financeiro mensal
  orcamentos/       # orcamento mensal por categoria
  relatorios/       # agregacoes por periodo
  previsoes/        # deficit features e cliente ML
  logs/             # auditoria, request context e filtros de log
  common/           # filtros, interceptors, utilitarios e DTOs base
```

O modulo raiz (`src/app.module.ts`) registra os modulos de dominio, TypeORM,
throttling global, filtro de logs e middlewares de request id/contexto.
O bootstrap (`src/main.ts`) aplica Helmet, CORS, `ValidationPipe`, interceptor
de resposta e filtro global de excecoes.

## Configuracao local

Pre-requisitos:

- Node.js compativel com o projeto
- npm
- PostgreSQL local
- banco criado com o nome definido em `DB_NAME`
- servico ML opcional em `http://127.0.0.1:8000`

Passos:

```powershell
cd backendnest
npm install
Copy-Item .env.example .env
```

Edite `.env` conforme seu ambiente. A aplicacao usa `synchronize: false`, entao
as migrations SQL precisam ser aplicadas manualmente na base.

## Variaveis de ambiente

| Variavel | Uso | Padrao/exemplo |
| --- | --- | --- |
| `PORT` | Porta HTTP da API | `3000` |
| `CORS_ORIGINS` | Origens liberadas para o frontend | `http://localhost:8081,http://localhost:19006,http://localhost:3000` |
| `THROTTLE_TTL_MS` | Janela global de rate limit | `60000` |
| `THROTTLE_LIMIT` | Limite global de requisicoes por janela | `60` |
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_PORT` | Porta PostgreSQL | `5432` |
| `DB_USERNAME` | Usuario PostgreSQL | `postgres` |
| `DB_PASSWORD` | Senha PostgreSQL | `postgres` |
| `DB_NAME` | Banco da aplicacao | `gestao_financeira` |
| `JWT_SECRET` | Fallback legado para JWT | trocar localmente |
| `JWT_ACCESS_SECRET` | Chave do access token | trocar localmente |
| `JWT_ACCESS_EXPIRES_IN` | Duracao do access token | `15m` |
| `JWT_REFRESH_SECRET` | Chave do refresh token | trocar localmente |
| `JWT_REFRESH_EXPIRES_IN` | Duracao do refresh token | `30d` |
| `ML_API_URL` | URL base da API de ML | `http://127.0.0.1:8000` |
| `ML_API_TIMEOUT_MS` | Timeout de chamada ML | `5000` |
| `AUTH_RETURN_RESET_TOKEN` | Retorna token de reset no JSON em desenvolvimento | `false` |
| `PASSWORD_RESET_TTL_MINUTES` | Validade do token de reset de senha | `60` |

## Banco de dados e migrations

As migrations ficam em `migrations/` e devem ser executadas em ordem:

```text
0001_mvp_baseline.sql
0002_align_schema_and_create_orcamento.sql
0003_add_usuario_cadastro_fields.sql
0004_add_auth_session.sql
0005_add_audit_log.sql
0006_soft_delete_lgpd_password_reset.sql
```

Exemplo de execucao com `psql`:

```powershell
psql -h localhost -U postgres -d gestao_financeira -f migrations/0001_mvp_baseline.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0002_align_schema_and_create_orcamento.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0003_add_usuario_cadastro_fields.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0004_add_auth_session.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0005_add_audit_log.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0006_soft_delete_lgpd_password_reset.sql
```

## Execucao

Modo recomendado para desenvolvimento local:

```powershell
npm run start:dev
```

Esse script usa `scripts/start-dev-onedrive-safe.js` e escreve saidas
temporarias em `%LOCALAPPDATA%\meu-sistema-financeiro\backendnest`, reduzindo
problemas de bloqueio quando o projeto esta em pasta sincronizada.

Fallback padrao do Nest:

```powershell
npm run start:dev:standard
```

Build e producao:

```powershell
npm run build
npm run start:prod
```

Healthcheck:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
```

Resposta esperada:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "backendnest",
    "timestamp": "2026-06-30T00:00:00.000Z"
  },
  "timestamp": "2026-06-30T00:00:00.000Z",
  "requestId": "..."
}
```

## Dados demo

Com o banco configurado e migrations aplicadas:

```powershell
npm run seed:demo
```

Credenciais:

```text
Email: demo.financeiro@exemplo.com
Senha: Demo@123456
```

O seed recria o usuario demo quando ele ja existe e preserva outros usuarios.
Ele popula dados para dashboard, contas, transacoes, categorias, orcamentos,
relatorios, metas, alertas, transferencias, dividas e previsao.

## API e autenticacao

Endpoints publicos principais:

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password-token`
- `POST /auth/refresh`
- `GET /cep/:cep` (consulta publica/utilitaria de CEP)

Endpoints autenticados usam `Authorization: Bearer <access_token>`:

- `/auth/logout`
- `/auth/reset-password`
- `/users/me`
- `/contas`
- `/categorias`
- `/transacoes`
- `/transferencias`
- `/dividas`
- `/pagos-divida`
- `/metas`
- `/alertas`
- `/orcamentos`
- `/relatorios`
- `/dashboard`
- `/previsoes/deficit`
- `/audit-logs`

Respostas de sucesso sao envolvidas pelo interceptor global:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-06-30T00:00:00.000Z",
  "requestId": "..."
}
```

Erros de dominio padronizados seguem:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem do erro"
  },
  "timestamp": "2026-06-30T00:00:00.000Z",
  "requestId": "..."
}
```

## Integracao com Machine Learning

O endpoint `GET /previsoes/deficit?mes=YYYY-MM` monta features financeiras do
usuario e chama a API ML em `ML_API_URL`. O cliente valida o contrato V2:

- `schema_version` esperado;
- lista exata de features numericas;
- `prediction` inteiro em `0` ou `1`;
- `probability` numerica entre `0` e `1`.

Para levantar o servico ML local:

```powershell
cd ..\ml-finance-tcc
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

Sem o servico ML ativo, os demais modulos continuam utilizaveis; apenas a
previsao de deficit deve retornar indisponibilidade.

## Scripts

| Script | Uso |
| --- | --- |
| `npm run start` | inicia Nest sem watch |
| `npm run start:dev` | inicia modo dev com saida segura fora do workspace |
| `npm run start:dev:standard` | inicia `nest start --watch` padrao |
| `npm run start:debug` | inicia Nest em debug |
| `npm run start:prod` | executa `dist/main` |
| `npm run build` | compila TypeScript/Nest |
| `npm run format` | aplica Prettier em `src` e `test` |
| `npm run lint` | executa ESLint com fix |
| `npm test` | roda testes unitarios |
| `npm run test:e2e` | roda testes e2e em serie |
| `npm run test:cov` | gera cobertura |
| `npm run seed:demo` | carrega perfil e dados demo |

## Testes e verificacao

Dentro de `backendnest`:

```powershell
npm test -- --runInBand
npm run test:e2e
npm run build
```

Da raiz do monorepo, o runbook recomenda:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1 -SkipLocalhost
```

Com backend e frontend ativos:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1
```

## Troubleshooting rapido

- `ECONNREFUSED` ou erro TypeORM ao iniciar: confirme PostgreSQL ativo,
  credenciais em `.env` e banco criado.
- Tabelas ou colunas ausentes: reaplique as migrations em ordem na base correta.
- CORS bloqueando o frontend: inclua a origem em `CORS_ORIGINS`.
- `EPERM` ao limpar `dist`: encerre processos Node/Nest antigos e tente de novo;
  preferencialmente use `npm run start:dev`.
- Previsao indisponivel: confirme `ML_API_URL`, healthcheck da API ML e contrato
  V2 do payload.
