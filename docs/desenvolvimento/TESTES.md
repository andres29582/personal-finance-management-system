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

O contrato transversal de erro e protegido por:

- `global-exception.filter.spec.ts`: classificacao, sanitizacao 5xx, 413, 429,
  requestId e logging best-effort;
- `logs.service.spec.ts`: causa interna ausente do `AuditLog` consultavel;
- `http-error-contract.e2e-spec.ts`: 400 de validacao, JSON malformado, 401,
  404 e 413 com `x-request-id` igual ao envelope;
- `planejamentos-audit.e2e-spec.ts`: 500 real sem vazamento da causa.

O 429 e unitario por desenho: o ambiente E2E eleva o limite global e uma
tempestade de requests testaria o throttler, nao a serializacao do contrato.

O E2E de previsao usa um cliente ML controlado para validar a montagem do
payload V2 sem depender de uma API FastAPI real durante o teste do backend.

## Frontend Expo/React Native

### Registro atômico e percursos reais de acesso

`backendnest/test/registration-atomicity.e2e-spec.ts` verifica o cadastro completo,
rollback após falha de categoria, reenvio e concorrência real de email/CPF em
PostgreSQL descartável. Usuário e catálogo inicial compartilham a transação;
o sucesso continua sem autologin.

O comando `npm run test:access-browser` em `backendnest/` exporta o frontend
atual e percorre telas reais com Nest/PostgreSQL e navegador. Configuração,
isolamento, limites e evidências estão no
[runbook de acesso web](../operacao/PRUEBAS_ACCESO_WEB.md). A CI possui um job
dedicado; sua configuração não equivale a uma execução remota aprovada.

`resolveApiError` classifica os erros sem limpar credenciais. A coordenação de
API/storage invalida somente o contexto proprietário; `RootLayout` oculta o
conteúdo até confirmar autoridade. Fixtures devem fornecer geração, snapshot,
autoridade e closures de cleanup coerentes com esse contrato.

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

## Credenciais e bancos descartaveis

O harness E2E exige configuracao `E2E_DB_*` explicita no ambiente do processo,
confirmacao exata e identidade/role/banco descartaveis verificadas. Nao usa
`DB_*` como fallback. Em `NODE_ENV=test`, o AppModule nao carrega `.env`;
o setup aplica o perfil E2E antes dos imports da aplicacao, remove CA TLS
herdada e desabilita os workers de notificacao. A preparacao apaga o esquema
`public`: somente alvo isolado autorizado, nunca o banco habitual.

### Execucao exclusiva do E2E

Use `npm run test:e2e -- <filtro-opcional>`. O launcher conserva uma conexao
PostgreSQL dedicada desde a admissao ate a saida confirmada do Jest e a
verificacao de que nao restaram conexoes no banco. `--runInBand` continua
ativo, mas nao substitui a exclusao entre processos.

Antes de qualquer DDL, inclusive do controle do harness, sao validados:
destino e confirmacao, usuario e banco efetivos, ownership, marcador
`finance-e2e-disposable`, ausencia de privilegios elevados, memberships e
outros bancos pertencentes ao role. Um advisory lock de sessao impede
execucoes concorrentes. Um claim unico em `e2e_harness.run_claim`, fora de
`public`, vincula token aleatorio, PID e inicio do backend proprietario.
Cada reset revalida esse vinculo e o lock na conexao que executara o SQL.

**Falha fecha o acesso:** perda do coordenador, execucao com erro, encerramento
nao confirmado ou erro de limpeza conservam o claim. Nao existe takeover por
tempo decorrido ou PID aparentemente livre. Descarte e reprovisione somente
o alvo descartavel autorizado; nao remova o claim para forcar uma nova
execucao. Nao ha ferramenta de recuperacao automatica nem privilegio
`CREATEDB` para o role de testes.

O Jest direto e os preparadores isolados rejeitam ausencia de lease. O P4
usa o mesmo launcher. O supervisor browser/sessoes conserva seu lease durante
preparacao, backend e cenarios, ate confirmar o encerramento dos participantes.
O supervisor continua criando seu proprio banco descartavel por execucao.
O supervisor somente autoriza apagar o claim quando os cenarios terminaram
com sucesso, nao houve cancelamento e todas as etapas anteriores de limpeza
tambem tiveram sucesso. A ausencia de processos participantes, sozinha, nao
transforma uma execucao falha em uma liberacao autorizada.

No C6, o backup da aplicacao exclui `e2e_harness` explicitamente. O restore
recria apenas `public`; o schema de controle e o claim vivo permanecem fora
do arquivo e das comparacoes de metadados da aplicacao.

Conexoes do bootstrap usam limite de 5 s para conectar, 5 s para lock e 20 s
para statement, configurados antes da primeira consulta; o limite cliente
de 25 s nao substitui cancelamento no servidor. Os requests financeiros
concorrentes mantem handles abortaveis, e a limpeza tenta todas as etapas,
observa o fim das transacoes e descarta coordenadores nao saudaveis. Erros
primarios e de limpeza permanecem juntos. O launcher limita a execucao a
15 minutos e tenta encerrar somente seu processo filho.

### Verificacao sem banco real

Os contratos de admissao, ordem das guardas, perda de coordenador, claims
anteriores, rollback de liberacao e erros compostos tem testes com clientes
simulados. Os testes de limpeza usam QueryRunner e transporte simulados.
Essas provas **nao certificam locks, cancelamento ou isolamento em PostgreSQL
real**; a integracao requer uma execucao separada, explicitamente autorizada.

```sh
node --test --test-isolation=none test/e2e-runtime.spec.cjs test/e2e-runner.spec.cjs test/session-harness/e2e-lease-compat.spec.cjs
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/config/e2e-cleanup.spec.ts src/config/e2e-harness.spec.ts
```

Referencias: [advisory locks de sessao](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS),
[limites no servidor](https://www.postgresql.org/docs/current/runtime-config-client.html),
[opcoes do cliente pg](https://node-postgres.com/apis/client) e
[configuracao sem dotenv no Nest](https://docs.nestjs.com/techniques/configuration).

A suite `credential-boundaries.e2e-spec.ts` observa locks em conexoes separadas,
sem sleeps. [Preflight, comandos e provas ainda pendentes](../validacao/SEGURANCA_CREDENCIAIS_ETAPA_1_RESULTADO.md).

### Regressões financeiras focalizadas — 2026-10-23

As suites `test/financial-business-rules.e2e-spec.ts` e
`test/budget-allocation-concurrency.e2e-spec.ts` verificam os contratos HTTP e
PostgreSQL de natureza imutável de categoria, eco compatível, edição histórica,
centavos exatos, limite/delta de alocações, limiares de 80%/100% e serialização
entre alocações/redução do orçamento. As corridas usam barreiras e observam
bloqueios reais, não esperas temporizadas como prova de ordem.

Com uma base descartável explicitamente autorizada e configurada, use o launcher
mantido, a partir de `backendnest`:

```sh
npm run test:e2e -- --runTestsByPath test/financial-business-rules.e2e-spec.ts test/budget-allocation-concurrency.e2e-spec.ts
```

Há também um supervisor local focalizado, executado **somente com autorização
específica**, a partir da raiz:

```sh
node backendnest/test/financial-closure-runner.cjs
```

Ele exige PostgreSQL 18 instalado no caminho Windows indicado no arquivo, Edge e
dependências locais já instaladas. Cria cluster, rol restrito e banco marcados
novos sob `.tmp/financial-runtime-<nonce>/`, sem ler o destino de `.env`. Confere
portas loopback `55438`, `4328`, `4188`, sentinel, diretório e identidade do
servidor antes de operações administrativas. Executa as duas suites pelo launcher;
só após sucesso inicia Nest real, exportação da aplicação Expo completa e cenário
Playwright financeiro. Não executa o supervisor amplo de sessões nem certifica
Android/iOS. Segredos locais aleatórios não são impressos.

O limite da exportação Expo é 180 segundos. Falha, cancelamento ou limpeza
incerta conservam o claim; não reutilize o cluster nem remova o claim para forçar
outra execução. O encerramento de handles filhos conhecidos não comprova, sozinho,
o término de todos os descendentes Metro no Windows. O supervisor encerra apenas
o PostgreSQL do seu diretório confirmado e mantém dados/evidências para inspeção.

**Resultado atual:** seis testes HTTP/PostgreSQL passaram na execução final;
a exportação Expo excedeu o limite e foi encerrada antes do cenário browser.
A validação do cliente real continua **pendente**, sem screenshots nem PASS web.
Veja [a evidência e os limites desta unidade](../validacao/AUDITORIA_ESTADO_ATUAL_SISTEMA_2026-10-15.md#fechamento-focalizado--2026-10-23).

### Contrato de atualização de transações — 2026-10-25

`UpdateTransacaoRequestDto` exclui `ehAjuste`, como o PATCH da API; a criação
mantém o campo opcional e a atualização mantém `descricao` anulável. Não há novo
fluxo de ajuste nem mudança de comportamento no servidor ou no formulário.

A fixture `src/modules/transacoes/types/transacao.contract.typecheck.ts` contém
somente tipos e é incluída pelo `tsconfig.json`. Verifique com o compilador real,
a partir de `frontend`; a transformação isolada do Jest não prova esse contrato:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm test -- --runInBand --testTimeout=15000 --runTestsByPath src/modules/transacoes/__tests__/transacaoService.test.ts src/modules/transacoes/__tests__/transacoes-form.test.tsx
```

As invariantes verificam a ausência da chave no PATCH, a preservação da flag
opcional booleana na criação e a descrição anulável na atualização. Essa prova
de tipos não certifica execução HTTP, banco ou interface real.

### Evidência histórica de tipagem PostgreSQL — acompanhamento 2026-10-25

Em 24/10, foi instalada somente a dependência de desenvolvimento `@types/pg`
8.23.1; `pg` permaneceu em 8.20.0. A tipagem real revelou quatro wrappers
incompatíveis: o contrato `QueryableClient` passou a limitar linhas a objetos e
um adaptador genérico propaga o tipo para `Client.query<T>`, sem casts ou `any`.
O `tsc --noEmit --incremental false` completo do backend terminou com exit 0;
`migration-runner.spec.ts` passou com oito testes simulados. São resultados de
24/10, não uma nova execução em 25/10; a falha TS7016 de 23/10 continua registrada
como história. Nenhum entrypoint de migração foi importado ou executado.

Registros locais de atribuição e logs: `.tmp/pg-types-20261024/`; são temporários,
não documentação publicada automaticamente. O cliente real permanece adiado:
seis E2E HTTP/PostgreSQL passaram em 23/10, mas o supervisor terminou com exit 1
após o limite Expo de 180 s, antes do Edge. Não há screenshots/PASS web nem
certificação de encerramento de todos os descendentes Metro ou do estado atual
dos clusters históricos. Este acompanhamento não autoriza repetir o runtime.

### Entrega local verificada — 2026-10-25

Cinco commits locais foram criados, sem push; a evidência abaixo não significa
aceite global, deploy ou execução do cliente real.

| Commit | Escopo | Prova delimitada em candidato isolado |
| --- | --- | --- |
| `4ba12e0` | Mock tipado de repositório de orçamento, pré-requisito aprovado em 12/10 | HEAD + pré-requisito: um teste PASS, exit 0; hash atual igual ao aprovado. |
| `627bed8` | Contrato PATCH de transação sem `ehAjuste`, preservando POST e descrição anulável | Fixture de tipos: exit 0. |
| `6740cd6` | Natureza imutável de categoria e eco DTO sem escrita vazia | 15 testes focalizados PASS, exit 0. |
| `03889fb` | Centavos exatos, limite/delta de alocação e limiares de orçamento | 49 testes focalizados PASS, exit 0. |
| `ba41bed` | Saldos e agregados de conta/dashboard/relatório com centavos exatos | 19 testes focalizados PASS, exit 0. |

São **84 testes backend focalizados**, incluindo o pré-requisito. O candidato
cumulativo com os cinco conjuntos passou no backend completo:
`node node_modules/typescript/bin/tsc --noEmit --incremental false`, exit 0.
O candidato anterior sem o pré-requisito falhou; o PASS vale para a árvore
expandida, não para uma repetição de bytes inalterados. As dependências já
instaladas foram reutilizadas por junctions: não houve instalação nem prova de
instalação limpa pelo lockfile/CI.

**Limites frontend:** o tipo isolado passou, mas o compilador completo de HEAD +
contrato terminou com exit 2: 572 erros em 32 arquivos inalterados, classificados
como baseline/ambiente instalado, incluindo tipos Jest ausentes e tipos de
estilos. O `tsc` completo do WIP havia passado anteriormente; essa árvore é
diferente e não substitui a prova do candidato. No WIP, a única execução das
duas suites de transações teve 21 PASS/um timeout de 15000 ms no caso de criação
em `transacoes-form.test.tsx:80`; causa não diagnosticada. Não há GREEN global
frontend nem repetição desses testes nesta atualização documental.

Continuam fora desses commits os baselines de draft frontend, adaptadores de
sessão, launcher financeiro, CLI de migração e transferências. A validação do
cliente real e novas execuções com banco permanecem adiadas. A evidência de
tipagem PostgreSQL de 24/10 é histórica, não uma nova certificação desses
baselines. Registros privados locais de candidatos e resultados estão em
`.tmp/isolated-unit-verify-11c04ecd36b544d08af551be89feaaf0/`; não publicar logs
brutos nem tratar esse diretório temporário como artefato de equipe versionado.
