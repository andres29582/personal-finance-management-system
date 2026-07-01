# Estrategia geral de testes

Este documento consolida a estrategia de testes do projeto financeiro. Ele nao
substitui documentos especificos de cada modulo; o objetivo e orientar quais
camadas validar, quais comandos usar e quais fluxos exigem mais cuidado antes
de integrar mudancas.

O projeto possui tres superficies principais:

- backend NestJS em `backendnest/`, com Jest, Supertest, DTOs, services,
  controllers e E2E;
- frontend Expo/React Native em `frontend/`, com Jest, Testing Library React
  Native, testes de telas, services, storage, navegacao e API client;
- modulo ML FastAPI em `ml-finance-tcc/`, com pytest para API, feature
  engineering, treinamento, avaliacao, persistencia e contrato temporal.

A estrategia recomendada e combinar testes unitarios rapidos, testes de
contrato entre modulos e testes E2E nos fluxos que dependem de persistencia,
autenticacao ou integracao entre camadas. Numeros absolutos de testes devem ser
evitados nesta pagina, pois ficam desatualizados rapidamente; prefira consultar
os arquivos de teste e executar os comandos do modulo afetado.

## Backend NestJS

Os testes do backend ficam principalmente em `backendnest/src/**/*.spec.ts` e
`backendnest/test/*.e2e-spec.ts`.

### Unitarios

Os testes unitarios devem isolar regras de negocio em services, utilities e
guards usando mocks de repositories e dependencias externas. Eles sao a primeira
linha para validar:

- regras de autenticacao, login, refresh token, logout e reset de senha;
- validacoes financeiras de contas, categorias, transacoes, transferencias,
  dividas, pagamentos, orcamentos, metas e alertas;
- calculos de dashboard, relatorios e indicadores;
- sanitizacao de logs e ausencia de vazamento de dados sensiveis;
- erros de dominio, codigos de erro e status HTTP esperados.

Exemplos atuais incluem `auth.service.spec.ts`, `transacoes.service.spec.ts`,
`dashboard.service.spec.ts`, `ml-predict-client.service.spec.ts` e
`deficit-features.service.spec.ts`.

### Controllers, DTOs e services

Controllers e DTOs devem validar a fronteira HTTP do backend:

- controllers devem delegar ao service correto, propagar usuario autenticado e
  respeitar parametros de rota/query;
- DTOs devem cobrir formatos validos e invalidos, campos obrigatorios, enums e
  transformacoes esperadas pelo `ValidationPipe`;
- services devem proteger isolamento por `usuarioId`, soft delete, regras de
  categoria/tipo e consistencia de saldos.

Ao alterar um DTO, revisar tambem testes de controller, service, E2E e o
contrato OpenAPI quando aplicavel.

### Integracao e E2E

Os testes E2E em `backendnest/test/` usam Supertest e cobrem fluxos com banco,
autenticacao e modulo raiz. Eles sao importantes quando a mudanca envolve:

- guards JWT, sessoes ou refresh token;
- resposta global do backend (`success`, `data`, `error`, `requestId`);
- persistencia em PostgreSQL, migrations ou entidades TypeORM;
- composicao entre modulos financeiros;
- previsao de deficit, que monta features no backend e chama o cliente ML.

O E2E de previsao usa um cliente ML controlado para validar a montagem do
payload V2 sem depender de uma API FastAPI real durante o teste do backend.

## Frontend Expo/React Native

Os testes do frontend ficam em `frontend/__tests__/` e em
`frontend/src/modules/**/__tests__/`.

A documentacao detalhada de rastreabilidade por rota, tela, service, risco e
status fica em [TESTES_FRONTEND.md](TESTES_FRONTEND.md). Este documento geral
mantem apenas a visao transversal.

### Telas

Testes de tela devem cobrir renderizacao, interacoes principais, estados de
loading/erro/vazio, navegacao e mensagens exibidas ao usuario. Telas
financeiras devem validar tambem filtros, formularios, confirmacoes e retorno
para listas.

Fluxos com maior prioridade:

- login, cadastro, reset de senha e rotas protegidas;
- dashboard e paineis financeiros;
- transacoes, contas, transferencias, dividas e pagamentos;
- relatorios, auditoria e previsao de deficit.

### Hooks, services e storage

Services de dominio devem testar o contrato com o backend por meio do API
client compartilhado. Hooks devem cobrir coordenacao de carregamento,
tratamento de erro e atualizacao de estado.

O storage de autenticacao e o API client em `src/shared/services/api.ts` sao
criticos porque controlam:

- injecao do bearer token;
- unwrap de respostas `{ success: true, data }`;
- refresh automatico em `401`;
- serializacao de refresh concorrente;
- limpeza de sessao quando o refresh falha.

### Componentes e mappers

Componentes reutilizaveis e mappers devem ter testes quando concentram
formatacao, regras de exibicao ou transformacao de dados. No dashboard, por
exemplo, mappers e componentes ajudam a separar dados de API da apresentacao.

Builders tipados em `src/shared/test/builders/` devem ser preferidos para
fixtures compartilhadas, reduzindo mocks divergentes do contrato real.

## Modulo ML FastAPI

Os testes do modulo ML ficam em `ml-finance-tcc/tests/` e usam pytest.

### API e contrato FastAPI

Os testes da API devem cobrir:

- `GET /health` com `schema_version` esperado;
- `POST /predict` aceitando apenas contrato V2;
- rejeicao de schema antigo, campos extras, campos ausentes e valores invalidos;
- resposta com `prediction` binario e `probability` entre `0` e `1`;
- indisponibilidade quando modelo, pre-processador ou manifesto nao estao
  carregados corretamente.

### Feature engineering e vazamento temporal

Feature engineering e o ponto mais sensivel do ML. Os testes devem garantir que
a previsao do mes objetivo `M` usa apenas `M-3`, `M-2` e `M-1`, com cutoff:

```text
data < inicio_de_M
```

`receita_mes` e `despesa_mes` do mes objetivo podem existir no painel mensal
para construir o alvo de treinamento, mas nao podem entrar em `FEATURE_COLUMNS`
nem no payload de inferencia. Tambem e necessario validar que amostras sem tres
meses anteriores consecutivos sejam descartadas.

### Treinamento, avaliacao e artefatos

Testes de treinamento, avaliacao e repositorio de modelo devem validar:

- separacao temporal entre treino e teste;
- comparacao com baselines;
- persistencia coerente de `modelo.pkl`, `scaler.pkl` e `features.json`;
- manifesto com `schema_version`, lista de features, target e politica
  temporal;
- uso atual de dataset sintetico, sem assumir qualidade de producao.

O treinamento e manual. A aplicacao em execucao carrega artefatos existentes e
nao realiza reentrenamento automatico com dados reais.

## Contrato backend e ML

A previsao de deficit cruza backend NestJS e API FastAPI. O frontend nunca deve
chamar a API ML diretamente; ele chama `GET /previsoes/deficit` no backend.

O contrato deve permanecer sincronizado entre:

- `backendnest/src/previsoes/constants/ml-prediction-contract.ts`;
- `backendnest/src/previsoes/services/deficit-features.service.ts`;
- `backendnest/src/previsoes/services/ml-predict-client.service.ts`;
- `ml-finance-tcc/ml/feature_engineering.py`;
- `ml-finance-tcc/api/app.py`;
- `ml-finance-tcc/models/features.json`.

Testes de contrato devem verificar:

- `schema_version = 2` nos dois lados;
- lista fechada e ordem canonica das features;
- payload numerico agregado, sem tokens, usuario ou transacoes brutas;
- validacao da resposta da API ML antes de montar o DTO publico;
- historico minimo de tres meses completos;
- indisponibilidade da API ML sem quebrar outros modulos financeiros.

Sempre que uma feature for adicionada, removida ou renomeada, atualizar testes
do backend, testes pytest do ML, manifesto de artefatos e documentacao
arquitetural relacionada.

## Fluxos criticos

### Autenticacao

Autenticacao envolve cadastro, login, JWT, sessoes, reset de senha, logout,
guards no backend, storage no frontend e navegacao protegida. Mudancas nesse
fluxo devem validar:

- hash de senha e ausencia de senha em respostas;
- criacao e revogacao de sessoes;
- registros de auditoria sem dados sensiveis;
- comportamento de rotas publicas e protegidas;
- limpeza de sessao no frontend.

### Refresh token

Refresh token e sensivel nos dois lados. No backend, o refresh token e validado
e rotacionado por sessao ativa. No frontend, o API client tenta renovar uma
sessao em `401`, evita refresh para endpoints publicos de auth e faz retry da
requisicao original uma unica vez.

Cenarios importantes:

- refresh token ausente, invalido ou expirado;
- sessao revogada;
- corrida entre multiplas requisicoes que retornam `401`;
- falha de refresh limpando sessao local;
- ausencia de loop infinito de retry.

### Transacoes financeiras

Transacoes afetam saldos, dashboard, relatorios, auditoria e features de ML.
Testes devem cobrir:

- categoria compativel com tipo de transacao;
- valores positivos e datas validas;
- isolamento por usuario;
- soft delete;
- atualizacao de agregacoes dependentes;
- mensagens de erro de dominio.

### Dashboard

O dashboard agrega contas, receitas, despesas, transacoes recentes,
orcamentos, metas e comparativos mensais. Deve haver cuidado com:

- mappers de dados para apresentacao;
- estados parciais quando dados secundarios falham;
- formatacao monetaria;
- navegacao para historicos;
- tratamento de `401` e logout.

### Previsao de deficit

A previsao de deficit depende de historico financeiro, contrato V2 e API ML.
Testes devem preservar:

- uso exclusivo de meses anteriores ao mes objetivo;
- rejeicao de mes invalido ou futuro;
- erro para historico insuficiente antes de chamar ML;
- payload agregado e sem vazamento temporal;
- resposta publica com `deficitPrevisto`, `prediction`, `probability`,
  `risco`, `indicadores` e `schemaVersion`;
- tratamento de API ML indisponivel ou resposta incompativel.

## Comandos principais

Execute os comandos a partir do diretorio do modulo indicado.

### Backend

```powershell
cd backendnest
npm test -- --runInBand
npm run test:e2e
npm run build
```

Comandos complementares:

```powershell
npm run test:cov
npm run lint
```

Observacao: o script `npm run lint` do backend aplica `--fix`. Use com atencao
quando a intencao for apenas inspecionar problemas.

### Frontend

```powershell
cd frontend
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

Para executar uma suite especifica, passe o caminho do arquivo para o Jest:

```powershell
npm test -- --runInBand src/modules/previsao-deficit/__tests__/previsaoService.test.ts
```

### Machine Learning

```powershell
cd ml-finance-tcc
python -m pytest
```

Quando a mudanca envolver pipeline, treinamento ou artefatos:

```powershell
python main.py train
```

Quando a mudanca envolver API FastAPI e validacao manual:

```powershell
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

### Verificacao integrada local

O backend documenta o script de verificacao geral do monorepo:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1 -SkipLocalhost
```

Com servicos locais ativos, o mesmo script pode ser executado sem
`-SkipLocalhost` para incluir verificacoes contra localhost.

## Relacao com documentos existentes

- [backendnest/README.md](../../backendnest/README.md): comandos, scripts e
  verificacoes operacionais do backend.
- [frontend/README.md](../../frontend/README.md): comandos principais e
  organizacao local do frontend.
- [ml-finance-tcc/README.md](../../ml-finance-tcc/README.md): contrato
  temporal V2, treino manual e execucao da API ML.
- [TESTES_FRONTEND.md](TESTES_FRONTEND.md): matriz detalhada de rotas, telas,
  services, riscos e testes automatizados do frontend.
- [BACKEND.md](../arquitetura/BACKEND.md): arquitetura, fluxos sensiveis e
  integracao ML no backend.
- [FRONTEND.md](../arquitetura/FRONTEND.md): arquitetura do frontend, API
  client, navegacao e estrategia de testes por camada.
- [MACHINE_LEARNING.md](../arquitetura/MACHINE_LEARNING.md): arquitetura do
  modulo ML, contrato V2 e prevencao de vazamento temporal.

## Antes de commit ou push

Antes de commit ou push, escolha a validacao pelo escopo da mudanca:

- documentacao apenas: revisar links, caminhos e `git diff --stat`;
- backend: rodar unitarios afetados, E2E quando houver fluxo HTTP/persistencia
  e `npm run build`;
- frontend: rodar a suite afetada, `npm run lint` e `npx tsc --noEmit`;
- ML: rodar pytest e, para mudancas de pipeline/modelo, treinar novamente de
  forma consciente;
- contrato backend/ML: rodar testes dos dois modulos e conferir listas de
  features nos dois lados;
- mudancas transversais: rodar validacoes de todos os modulos tocados.

Tambem conferir:

```powershell
git status --short
git diff --stat
```

Nao incluir `.env`, caches locais, cobertura, builds ou artefatos regenerados
sem intencao explicita.

## Limitacoes atuais e proximos reforcos

Algumas limitacoes devem ser consideradas ao interpretar a cobertura:

- E2E do backend depende de ambiente de banco adequado e migrations coerentes;
- a matriz detalhada do frontend fica em `TESTES_FRONTEND.md` e precisa ser
  atualizada quando telas ou services mudarem;
- o modulo ML usa dataset sintetico e suas metricas atuais nao comprovam
  qualidade em producao;
- nao ha reentrenamento automatico do modelo com dados reais;
- comandos de lint, build e testes podem ter tempos e pre-requisitos diferentes
  por modulo.

Reforcos recomendados:

- manter testes de contrato automatizados sempre que `schema_version` ou
  features mudarem;
- ampliar E2E dos fluxos financeiros que alteram saldos e agregacoes;
- expandir testes de estados vazios, erros e `401` nas telas financeiras;
- manter builders/fixtures tipados alinhados aos DTOs reais;
- registrar no documento de testes frontend qualquer mudanca relevante de
  cobertura por rota.
