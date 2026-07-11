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
  config/           # configuracao validada de HTTP, throttling e banco
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
Para PostgreSQL local, mantenha `NODE_ENV=development` e
`DB_SSL_MODE=disable`.

## Variaveis de ambiente

| Variavel | Uso | Padrao/exemplo |
| --- | --- | --- |
| `PORT` | Porta HTTP da API | `3000` |
| `CORS_ORIGINS` | Origens liberadas para o frontend | `http://localhost:8081,http://localhost:19006,http://localhost:3000` |
| `HTTP_BODY_LIMIT_BYTES` | Limite global de JSON e URL-encoded (1 KiB a 1 MiB) | `102400` (100 KiB) |
| `THROTTLE_TTL_MS` | Janela global de rate limit | `60000` |
| `THROTTLE_LIMIT` | Limite global de requisicoes por janela | `60` |
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_PORT` | Porta PostgreSQL | `5432` |
| `DB_USERNAME` | Usuario PostgreSQL | `postgres` |
| `DB_PASSWORD` | Senha PostgreSQL | `postgres` |
| `DB_NAME` | Banco da aplicacao | `gestao_financeira` |
| `DB_SSL_MODE` | Politica TLS PostgreSQL: `disable` ou `verify-full` | `disable` somente em `development`/`test` |
| `DB_SSL_CA_BASE64` | CA PEM customizada codificada em Base64 | opcional em `verify-full` |
| `JWT_SECRET` | Fallback legado permitido somente em `development`/`test` | vazio no `.env.example` |
| `JWT_ACCESS_SECRET` | Chave do access token | obrigatoria em `production`/`demo` |
| `JWT_ACCESS_EXPIRES_IN` | Duracao do access token | `15m` |
| `JWT_REFRESH_SECRET` | Chave do refresh token | obrigatoria em `production`/`demo` |
| `JWT_REFRESH_EXPIRES_IN` | Duracao do refresh token | `30d` |
| `ML_API_URL` | URL base da API de ML | `http://127.0.0.1:8000` |
| `ML_API_TIMEOUT_MS` | Timeout de chamada ML | `5000` |
| `ML_INTERNAL_API_KEY` | Chave interna enviada ao servico ML | obrigatoria fora de `development`/`test` |
| `AUTH_RETURN_RESET_TOKEN` | Auxiliar local para retornar token de reset no JSON apenas em `development`/`test` | `false` |
| `PASSWORD_RESET_TTL_MINUTES` | Validade do token de reset de senha | `60` |

A configuracao do runtime HTTP falha no startup quando recebe valores
invalidos. `PORT` deve ser um inteiro entre `1` e `65535` (padrao `3000`).
`HTTP_BODY_LIMIT_BYTES` deve ser um inteiro entre `1024` e `1048576`; JSON ou
URL-encoded acima desse limite recebe HTTP `413`, sem eco do corpo.

Somente `development` e `test` usam as origens locais padrao quando
`CORS_ORIGINS` estiver ausente. Qualquer outro valor de `NODE_ENV`, inclusive
vazio ou desconhecido, e ambiente exposto: a allowlist e obrigatoria e aceita
apenas origens HTTPS absolutas, sem path, query, fragmento, credenciais ou
wildcard. Origens sao normalizadas e deduplicadas. Uma origem de navegador nao
autorizada nao recebe `Access-Control-Allow-Origin`; CORS nao substitui
autenticacao. Requisicoes sem header `Origin` continuam aceitas para o
aplicativo Expo nativo, health checks e comunicacao server-to-server.

O throttling global preserva os defaults de `60000` ms e `60` requisicoes. TTL
deve ser inteiro entre `1000` e `3600000`, e limite deve ser inteiro entre `1`
e `10000`; valores invalidos tambem interrompem o startup.

A configuracao PostgreSQL e validada antes de qualquer tentativa de conexao.
Somente `development` e `test` permitem `DB_SSL_MODE=disable`; qualquer outro
valor de `NODE_ENV`, inclusive vazio ou desconhecido, exige `verify-full`. Esse
modo usa verificacao de certificado (`rejectUnauthorized: true`). Quando a
cadeia da CA ja e reconhecida pelo trust store do sistema, a CA customizada nao
e necessaria. Caso contrario, `DB_SSL_CA_BASE64` deve conter o PEM da CA
codificado em Base64. Nunca versione certificados reais, senhas ou credenciais
do ambiente.

Em ambientes expostos, use senha forte, uma base dedicada e um usuario de banco
dedicado com apenas os privilegios necessarios. Nao reutilize as credenciais de
exemplo. Valores ausentes, portas invalidas, TLS inseguro, senha previsivel,
banco administrativo ou CA invalida fazem a aplicacao falhar no startup sem
registrar a senha ou o conteudo da CA.

`JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` devem ser valores aleatorios,
distintos e com pelo menos 32 caracteres em `production` e `demo`. O
`JWT_SECRET` existe apenas para compatibilidade local legada em
`development`/`test`; ele nao substitui os secrets especificos em ambientes
expostos. Os valores vazios do `.env.example` sao marcadores de configuracao e
nao credenciais utilizaveis.

`AUTH_RETURN_RESET_TOKEN=true` e bloqueado fora de `NODE_ENV=development` ou
`NODE_ENV=test`, pois o token plano de recuperacao nao faz parte do contrato
publico de producao.

`ML_INTERNAL_API_KEY` e opcional em `development`/`test`. Quando configurada, o
backend envia o header `X-ML-Internal-Key` ao servico ML. Fora de
`development`/`test`, ela e obrigatoria, deve ter pelo menos 32 caracteres, nao
deve usar placeholders previsiveis e deve coincidir com a configuracao do
servico ML.

## Banco de dados e migrations

As migrations ficam em `migrations/` e devem ser executadas em ordem:

```text
0001_mvp_baseline.sql
0002_align_schema_and_create_orcamento.sql
0003_add_usuario_cadastro_fields.sql
0004_add_auth_session.sql
0005_add_audit_log.sql
0006_soft_delete_lgpd_password_reset.sql
0007_create_planejamentos_compartilhados.sql
```

Exemplo de execucao com `psql`:

```powershell
psql -h localhost -U postgres -d gestao_financeira -f migrations/0001_mvp_baseline.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0002_align_schema_and_create_orcamento.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0003_add_usuario_cadastro_fields.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0004_add_auth_session.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0005_add_audit_log.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0006_soft_delete_lgpd_password_reset.sql
psql -h localhost -U postgres -d gestao_financeira -f migrations/0007_create_planejamentos_compartilhados.sql
```

### Atencao: Planejamentos Compartilhados

A migration `0007_create_planejamentos_compartilhados.sql` cria as tabelas do
fluxo de Planejamentos Compartilhados:

- `planejamento`
- `participante_planejamento`
- `gasto_planejamento`
- `divisao_gasto`
- `acerto_planejamento`

Para testar o fluxo de Planejamentos localmente, a migration
`0007_create_planejamentos_compartilhados.sql` precisa estar aplicada no banco
PostgreSQL.

Se a migration nao estiver aplicada, endpoints como `POST /planejamentos` podem
falhar com erro interno porque a tabela `planejamento` ainda nao existe.

Antes de testar o frontend de Planejamentos:

- Aplicar migrations pendentes.
- Confirmar que as tabelas de Planejamentos existem no PostgreSQL.
- Iniciar backend.
- Validar `POST /planejamentos` por HTTP.
- So depois testar o fluxo pelo frontend.

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
- `/planejamentos`

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
usuario e chama a API ML interna em `ML_API_URL`. Quando `ML_INTERNAL_API_KEY`
esta configurada, o cliente envia `X-ML-Internal-Key`. O cliente valida o
contrato V2:

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
- `POST /planejamentos` retornando erro interno localmente: confirme se
  `0007_create_planejamentos_compartilhados.sql` foi aplicada e se as tabelas
  `planejamento`, `participante_planejamento`, `gasto_planejamento`,
  `divisao_gasto` e `acerto_planejamento` existem no PostgreSQL.
- CORS bloqueando o frontend: inclua a origem em `CORS_ORIGINS`.
- `EPERM` ao limpar `dist`: encerre processos Node/Nest antigos e tente de novo;
  preferencialmente use `npm run start:dev`.
- Previsao indisponivel: confirme `ML_API_URL`, healthcheck da API ML e contrato
  V2 do payload.
