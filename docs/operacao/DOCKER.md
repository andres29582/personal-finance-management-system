# Auditoria Docker Local

## 1. Objetivo

Estado atual: este documento registra a auditoria tecnica da containerizacao
local do monorepo e a primeira implementacao das imagens isoladas de backend e
ML. Ainda nao existem Compose, scripts de inicializacao em container, migrations
automaticas ou seed automatico validados neste repositorio.

Decisao recomendada: a primeira versao Docker local deve permitir subir
PostgreSQL, backend NestJS, servico FastAPI/ML e frontend web com configuracao
versionada, previsivel e reproduzivel em Linux.

Ainda nao implementado: nenhum comando `docker compose up` deve ser tratado como
funcional ate que os arquivos Docker sejam criados e validados em PR futuro.

## 2. Estado atual

Estado atual:

- Backend em `backendnest`, com NestJS 11, TypeScript, TypeORM, PostgreSQL,
  `backendnest/Dockerfile` e `backendnest/.dockerignore`.
- Frontend em `frontend`, com Expo Router, React Native Web e export web
  estatico configurado em `frontend/app.json`.
- ML em `ml-finance-tcc`, com FastAPI, Uvicorn, scikit-learn, artefatos de
  inferencia versionados em `models/`, `ml-finance-tcc/Dockerfile` e
  `ml-finance-tcc/.dockerignore`.
- Migrations SQL versionadas em `backendnest/migrations`.
- CI em `.github/workflows/ci.yml` para frontend, backend, backend E2E com
  PostgreSQL 16 e ML.
- Runbook local em `docs/operacao/RUNBOOK.md`.
- Nao existem `docs/operacao/DEPLOY.md`, `docs/operacao/CI_CD.md` ou
  `docs/operacao/SEED.md` nesta auditoria.

Validacao futura necessaria: testar as imagens Docker em ambiente com Docker
disponivel e criar a stack Docker local em Linux antes de anunciar comandos
operacionais de Compose como funcionais.

## 3. Servicos do monorepo

| Servico | Codigo | Instalacao atual | Build atual | Inicio atual |
| --- | --- | --- | --- | --- |
| Backend | `backendnest` | `npm ci` na CI; `npm install` no README | `npm run build` | `npm run start:prod` apos build; `npm run start:dev` local |
| Frontend | `frontend` | `npm ci` na CI; `npm install` no README | `npm run export:web` | `npm run web` para dev; export estatico para Docker planejado |
| ML | `ml-finance-tcc` | `python -m pip install -r requirements.txt` | nao ha build; modelos ja versionados | `python -m uvicorn api.app:app --host 0.0.0.0 --port 8000` |
| PostgreSQL | externo ao codigo | imagem futura recomendada | nao aplicavel | servico `postgres` futuro |

Arquivos de runtime identificados:

- Backend: `backendnest/dist`, `backendnest/package.json`,
  `backendnest/package-lock.json`, dependencias de producao, variaveis de
  ambiente e acesso ao PostgreSQL. As migrations ficam fora do runtime da API,
  mas sao necessarias para preparar o banco.
- Frontend: export web gerado por `expo export --platform web`, com assets
  estaticos. A URL `EXPO_PUBLIC_API_URL` e incorporada no bundle no momento do
  export.
- ML: `ml-finance-tcc/api`, `domain`, `ml`, `persistence`,
  `models/modelo.pkl`, `models/scaler.pkl`, `models/features.json` e
  dependencias Python. `data/`, `examples/` e `reports/` nao sao necessarios
  para inferencia.

## 4. Matriz de versoes

| Componente | Evidencia atual | Decisao recomendada |
| --- | --- | --- |
| Node.js | CI usa `node-version: 22`; `@types/node` do backend e Node 22 | Node.js 22 LTS para backend e frontend |
| npm | `package-lock.json` nos dois projetos Node | `npm ci` em imagens para reproducibilidade |
| Python | CI usa `python-version: '3.11'` | Python 3.11 slim para ML |
| PostgreSQL | CI E2E usa `postgres:16` | PostgreSQL 16 |
| Expo | `expo ~54.0.33` | manter versao do lockfile |
| NestJS | `@nestjs/* ^11.0.x` | manter versao do lockfile |
| FastAPI/Uvicorn | `requirements.txt` | instalar pelo lock futuro ou pelo requirements atual |

## 5. Matriz de portas

| Servico | Porta interna recomendada | Porta local sugerida | Evidencia |
| --- | --- | --- | --- |
| backend | `3000` | `3000:3000` | `backendnest/.env.example` e `src/main.ts` |
| frontend | `80` em servidor estatico | `8081:80` | `npm run web` usa Expo em `8081`; export estatico pode ser servido por Nginx/Caddy |
| ml | `8000` | `8000:8000` | README ML e Uvicorn |
| postgres | `5432` | `5432:5432` ou somente interno | CI E2E e envs de banco |

Decisao recomendada: publicar `backend`, `frontend` e opcionalmente `ml` para
debug local. O PostgreSQL pode ser publicado em `5432` na primeira versao para
facilitar inspecao com ferramentas locais, desde que documentado como ambiente
local.

## 6. Matriz de variaveis de ambiente

### Backend

| Variavel | Obrigatoria para container | Valor local de exemplo |
| --- | --- | --- |
| `NODE_ENV` | recomendada | `production` |
| `PORT` | recomendada | `3000` |
| `CORS_ORIGINS` | sim | `http://localhost:8081,http://localhost:3000` |
| `THROTTLE_TTL_MS` | recomendada | `60000` |
| `THROTTLE_LIMIT` | recomendada | `60` |
| `DB_HOST` | sim | `postgres` |
| `DB_PORT` | sim | `5432` |
| `DB_USERNAME` | sim | `postgres` |
| `DB_PASSWORD` | sim | senha local nao real |
| `DB_NAME` | sim | `gestao_financeira` |
| `JWT_SECRET` | sim, por compatibilidade legada | segredo local de desenvolvimento |
| `JWT_ACCESS_SECRET` | sim | segredo local de desenvolvimento |
| `JWT_ACCESS_EXPIRES_IN` | recomendada | `15m` |
| `JWT_REFRESH_SECRET` | sim | segredo local de desenvolvimento |
| `JWT_REFRESH_EXPIRES_IN` | recomendada | `30d` |
| `ML_API_URL` | sim para previsoes | `http://ml:8000` |
| `ML_API_TIMEOUT_MS` | recomendada | `5000` |
| `AUTH_RETURN_RESET_TOKEN` | recomendada | `false` |
| `PASSWORD_RESET_TTL_MINUTES` | recomendada | `60` |

Estado atual: `backendnest/.env.example` usa `DB_HOST=localhost` e
`ML_API_URL=http://127.0.0.1:8000`, corretos para host local, mas incorretos
dentro da rede Docker. No container, esses valores devem ser substituidos por
`postgres` e `http://ml:8000`.

### Frontend

| Variavel | Obrigatoria | Valor local de exemplo |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | sim | `http://localhost:3000` |

Estado atual: `frontend/src/shared/services/api.ts` usa
`process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'`.

Decisao recomendada: para export web estatico, tratar `EXPO_PUBLIC_API_URL`
como variavel de build/export, nao de runtime. Se for necessario trocar a URL
sem rebuild, sera preciso criar uma estrategia futura de configuracao runtime.

### ML

Estado atual: o servico ML nao le variaveis obrigatorias proprias. O comando de
Uvicorn deve informar `--host 0.0.0.0 --port 8000` para aceitar conexoes de
outros containers.

### PostgreSQL

| Variavel | Valor local de exemplo |
| --- | --- |
| `POSTGRES_DB` | `gestao_financeira` |
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_PASSWORD` | senha local nao real |

## 7. Dependencias entre servicos

```text
frontend
   |
   v
backend
   | \
   |  \--> ml
   v
postgres
```

Estado atual:

- O frontend chama apenas o backend.
- O backend depende do PostgreSQL para inicializar corretamente via TypeORM.
- O backend chama o ML somente no fluxo de `GET /previsoes/deficit`.
- O ML nao depende do backend nem do PostgreSQL para inferencia.
- O PostgreSQL precisa estar criado e com migrations aplicadas antes do uso
  funcional do backend.

Decisao recomendada: usar nomes internos `postgres`, `backend`, `ml` e
`frontend` em uma rede Docker unica da stack local.

## 8. Arquitetura Docker recomendada

Decisao recomendada para a primeira versao:

- `postgres`: imagem `postgres:16`, volume persistente e health check com
  `pg_isready`.
- `backend`: imagem implementada em `backendnest/Dockerfile` com
  `node:22-bookworm-slim`, build multi-stage, `npm ci`, `npm run build`,
  runtime com `npm ci --omit=dev`, usuario `node`, porta `3000`, health check
  nativo via Node `fetch` e `npm run start:prod`.
- `ml`: imagem implementada em `ml-finance-tcc/Dockerfile` com
  `python:3.11-slim-bookworm`, instalacao de `requirements.txt`, usuario
  `app`, porta `8000`, health check via `urllib.request` e Uvicorn em
  `0.0.0.0:8000`.
- `frontend`: build com Node 22 e `npm run export:web`; servir o resultado
  estatico com Nginx, Caddy ou outro servidor HTTP simples.

Ainda nao implementado: Compose, PostgreSQL integrado, frontend Docker,
healthcheck de Compose, entrypoints, scripts auxiliares, migrations automaticas
e seed automatico.

Comandos de build previstos para validacao em ambiente com Docker:

```powershell
docker build -t meu-sistema-financeiro-backend:local ./backendnest
docker build -t meu-sistema-financeiro-ml:local ./ml-finance-tcc
```

Estado atual da validacao: `docker version` e `docker info` falharam neste
ambiente porque o comando `docker` nao esta disponivel no PATH. Portanto, os
builds das imagens, `GET /health`, `POST /predict`, inspecao de usuario,
healthcheck e tamanho das imagens ainda nao foram validados nesta fase.

## 9. Estrategia de build por servico

### Backend

Estado atual:

- Instalacao: `npm ci` e a opcao mais reprodutivel porque existe
  `backendnest/package-lock.json`.
- Build: `npm run build`, que executa `nest build`.
- Diretorio final: `backendnest/dist`; validado localmente com `npm run build`,
  que gerou `dist/main.js`.
- Producao: `npm run start:prod`, que executa `node dist/main`.
- O build exclui `node_modules`, `test`, `dist` e `**/*spec.ts` via
  `tsconfig.build.json`.
- O Dockerfile remove do runtime `dist/scripts`, sourcemaps, declaracoes
  TypeScript e `tsconfig.build.tsbuildinfo`.

Risco Linux/container: `npm run start:dev` chama
`scripts/start-dev-onedrive-safe.js` e escreve em `%LOCALAPPDATA%` ou no home do
usuario. Esse script e util para Windows/OneDrive, mas nao deve ser o caminho
principal do container.

### Frontend

Estado atual:

- Instalacao: `npm ci` com `frontend/package-lock.json`.
- Export: `npm run export:web`, que executa `expo export --platform web`.
- Dev web: `npm run web`, que usa `scripts/start-expo-onedrive-safe.js --web`,
  Expo offline, cache fora do workspace e porta local esperada `8081`.
- Configuracao web: `frontend/app.json` define `"web": { "output": "static" }`.

Decisao recomendada: usar export web estatico na primeira versao Docker local.
Vantagens: mais proximo do artefato final, menor dependencia de Metro, menor
risco com watch/caches em container e validado pela CI. Riscos: a API URL fica
embutida no build/export; mudancas de URL exigem novo export.

Alternativa nao recomendada para a primeira versao: rodar o servidor Expo de
desenvolvimento dentro do Compose. Isso melhora hot reload, mas traz mais
complexidade de cache, filesystem, watch e portas.

### ML

Estado atual:

- Instalacao: `python -m pip install -r requirements.txt`.
- Startup: `python -m uvicorn api.app:app --host 0.0.0.0 --port 8000`.
- Health: `GET /health`.
- Inferencia: `POST /predict`.
- Startup carrega modelo, pre-processador e manifesto em `models/`.
- Startup nao executa treinamento.
- O Dockerfile copia para a imagem apenas `api/`, `domain/`, `ml/`,
  `persistence/`, `requirements.txt`, `models/modelo.pkl`,
  `models/scaler.pkl` e `models/features.json`.

Risco Linux/container: imports assumem o diretorio `ml-finance-tcc` no
`PYTHONPATH` ou como working directory. O container deve usar esse diretorio como
`WORKDIR`.

## 10. Estrategia de migrations

Estado atual:

- TypeORM esta com `synchronize: false`.
- Nao ha script npm de migration para producao/local.
- As migrations SQL ficam em `backendnest/migrations` e devem rodar em ordem.
- O helper E2E cria o banco de teste, recria o schema `public` e aplica os SQLs
  em ordem antes dos testes.
- As migrations `0002` e `0007` usam `CREATE EXTENSION IF NOT EXISTS pgcrypto`.

Decisao recomendada: na primeira versao Docker local, manter migrations como
passo manual documentado, executado contra o container `postgres` depois do
health check do banco e antes do seed. Automatizar migrations deve ser um PR
posterior, com estrategia explicita de idempotencia, locks e falha segura.

Validacao futura necessaria: testar os SQLs contra `postgres:16` em container e
confirmar que `pgcrypto` pode ser criado pelo usuario local escolhido.

## 11. Estrategia de seed

Estado atual:

- O seed demo roda com `npm run seed:demo`.
- O script executa `src/scripts/seed-demo-profile.ts` com `ts-node`.
- O seed cria/recria somente o usuario demo
  `demo.financeiro@exemplo.com` e preserva outros usuarios.
- O seed depende do backend conseguir criar `AppModule` e conectar no banco.

Decisao recomendada: na primeira versao Docker local, seed deve ser manual e
opt-in, nunca automatico no startup do backend. Isso evita apagar/recriar o
usuario demo de forma inesperada em volumes persistentes.

## 12. Health checks

| Servico | Endpoint/comando atual | Estado |
| --- | --- | --- |
| Backend | `GET /health` | existente |
| ML | `GET /health` | existente |
| Frontend | HTTP 200 em `/` do servidor estatico | planejado |
| PostgreSQL | `pg_isready -U postgres -d gestao_financeira` | planejado |

Limite atual: o health do backend retorna status da aplicacao, mas nao valida
explicitamente PostgreSQL nem ML. O health do ML valida que a app responde, mas
o carregamento de artefatos ocorre no lifespan; falhas de modelo impedem startup
saudavel.

Risco: `depends_on` sem condicao de saude apenas ordena criacao de containers e
nao garante que PostgreSQL esteja pronto para conexoes ou migrations.

## 13. Persistencia local

Decisao recomendada: usar volume nomeado para o PostgreSQL, por exemplo
`postgres-data`, mantendo dados locais entre execucoes.

Estado atual: nao ha volume Docker definido. Arquivos gerados locais ja
ignorados pelo `.gitignore` incluem `node_modules/`, `dist/`, `build/`,
`web-build/`, `.expo/`, caches Python, `.venv/`, logs e temporarios.

Diretorios que devem entrar em `.dockerignore` futuro:

- raiz: `.git`, `.gitnexus`, `.codex`, logs e temporarios;
- Node: `node_modules`, `dist`, `.dev-dist`, `.expo`, caches e cobertura;
- frontend: `smoke-web` se nao for usado como fonte do runtime, exports gerados
  e caches;
- ML: `.venv`, `__pycache__`, `.pytest_cache`, `tests/.tmp`, `reports` se a
  imagem for somente de inferencia.

## 14. Riscos identificados

- `localhost` e `127.0.0.1` aparecem em envs e fallbacks; dentro de containers
  devem ser substituidos por nomes de servico.
- `EXPO_PUBLIC_API_URL` e incorporada no export web em build time.
- Scripts `start-dev-onedrive-safe.js` sao especificos de desenvolvimento local
  e nao devem ser usados como entrypoint de container.
- Nao ha runner de migrations versionado para ambiente local Docker.
- Seed demo e manual, mas recria o usuario demo; nao deve rodar automaticamente.
- Health do backend nao comprova que migrations foram aplicadas.
- `depends_on` sem health condition pode iniciar backend antes do PostgreSQL
  aceitar conexoes.
- ML depende dos artefatos em `models/`; imagem de inferencia nao deve treinar
  nem regenerar `data/`, `models/` ou `reports/` no startup.
- Imagens Python com scikit-learn podem exigir cuidado com wheels e arquitetura
  Linux; usar Python 3.11 slim e instalar via pip deve ser validado em build.

## 15. Etapas de implementacao

Divisao final recomendada em PRs pequenos:

1. PR backend e ML: Dockerfiles de backend e ML, builds locais e health checks
   isolados sem Compose completo.
2. PR PostgreSQL e Compose base: servico `postgres`, rede, volume, envs locais
   de exemplo e conexao backend-postgres.
3. PR migrations manuais: documentar e validar comandos manuais de aplicacao
   dos SQLs contra `postgres:16`; manter automacao fora do escopo inicial.
4. PR frontend web estatico: build/export com `EXPO_PUBLIC_API_URL` definido e
   servidor estatico para o bundle.
5. PR seed e validacao integrada: seed manual opt-in, health checks finais,
   criterios de aceite e runbook operacional atualizado.

Justificativa: migrations e frontend carregam os maiores riscos de falsa
reprodutibilidade. Separar esses passos evita misturar infraestrutura basica com
decisoes de dados e URL embutida no bundle.

## 16. Criterios de aceite da primeira versao

- `postgres`, `backend`, `ml` e `frontend` sobem em Linux por configuracao
  versionada.
- Backend usa `DB_HOST=postgres` e `ML_API_URL=http://ml:8000`.
- PostgreSQL 16 tem volume persistente e health check.
- Migrations SQL rodam manualmente em ordem e sao validadas contra o container.
- Seed demo roda somente quando chamado manualmente.
- Backend `GET /health` responde.
- ML `GET /health` responde e `POST /predict` aceita payload V2.
- Frontend estatico abre no navegador e chama o backend pela URL definida no
  export.
- Nenhum treinamento ML ocorre no startup da imagem.
- Documentacao diferencia claramente estado atual, planejado e limites.

## 17. Itens fora do escopo

Ainda nao implementado nesta fase:

- `compose.yml` ou `docker-compose.yml`.
- Dockerfile do frontend.
- `.dockerignore` do frontend.
- Entry points.
- Scripts shell ou PowerShell para container.
- Migrations automaticas.
- Seed automatico.
- Deploy.
- Secrets reais.
- Mudancas em codigo-fonte, testes, CI, Swagger, lockfiles ou `.env.example`.

## 18. Limitacoes atuais

Estado atual: a documentacao registra Dockerfiles e `.dockerignore` para
backend e ML, mas ainda nao valida uma execucao Docker real porque Docker nao
esta disponivel no ambiente desta atualizacao. As recomendacoes acima foram
derivadas dos manifests, CI, READMEs, env examples, codigo de runtime auditado
e build local do backend.

Validacao futura necessaria:

- Confirmar build das imagens em Linux.
- Confirmar `npm ci` no backend dentro de container.
- Confirmar instalacao de `requirements.txt` no container ML.
- Confirmar instalacao Python e import de `api.app` no container ML.
- Confirmar `GET /health` do backend e do ML em containers isolados.
- Confirmar `POST /predict` do ML em container isolado.
- Confirmar usuario, healthcheck e tamanho aproximado das imagens.
- Confirmar `expo export --platform web` dentro de container Linux em fase
  futura do frontend.
- Confirmar aplicacao das migrations em `postgres:16`.
- Confirmar CORS entre frontend local e backend.
- Confirmar que nenhum artefato gerado por Docker fica versionado por engano.
