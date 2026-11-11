# U5: gestão de sessões próprias — implementação local e provas delimitadas

**2026-10-12: provas locais de browser e controles de deploy concluídas no recorte autorizado.**
HTTP/Nest/PostgreSQL **11/11 PASS** histórico; **dois casos browser PASS em
execuções separadas**, não uma matriz 2/2; ensaio privado U5D **10/10 PASS** e
quatro checks puros PASS. Readback independente das fontes e evidências atuais,
sem reexecução, não encontrou defeito concreto bloqueante nesse recorte.
**Deploy real permanece BLOQUEADO:** destino/configuração/rollback publicado não
definidos e CI remota PG16 NOT RUN. U3/U4/U5 e etapa 2 continuam abertas, sem
ativação ou aceite de produção; 0016/0017 não aplicadas ao banco da aplicação,
Resend adiado. Nenhum commit, push ou deploy foi feito.

As seções de 2026-10-11 abaixo preservam seu alcance histórico, inclusive
browser NOT RUN naquele momento. O estado mais recente está no fechamento de
2026-10-12; nenhuma falha anterior foi convertida retroativamente em PASS.

## Comportamento entregue

| Ação | Contrato implementado |
|---|---|
| `GET /auth/sessions` | Envelope 200 existente; `{ items, nextCursor, serverNow }`; default/max 20, owner-only, cursor UTC com precisão de microssegundos e SID; `Cache-Control: no-store`. Somente ativas; sem touch de atividade. |
| `POST /auth/sessions/:id/revoke` | `{ senhaAtual }`, senha revalidada e chamador ativo sob locks; 204 vazio. Alvo inexistente, estrangeiro ou já revogado: mesmo 204 após reautenticação. Selecionar a própria sessão também revoga sua autoridade; UI só oferece esta ação para remotas. |
| `POST /auth/sessions/revoke-all` | Mesmo JSON/204; inclui a atual. Global serializa com login pelo usuário; login ordenado depois pode criar nova sessão. Não há epoch permanente ou promessa de desfazer handlers já admitidos. |
| Sessão atual | `POST /auth/logout` mantém 200/message e logout local-first U2, sem senha. |
| UI | Link “Sessoes” no perfil e `/sessoes`; datas, “Sessao atual” e “Dispositivo nao identificado”, próxima página, confirmação de senha e inclusão da atual explícita. Sem IP, UA, fingerprint ou nova descrição coletada. |
| Global confirmado | Server-first; somente 204 autoriza cleanup local-only coordenado da geração capturada. Nenhum segundo POST logout; A não limpa/navega B. |
| Resultado desconhecido | Sem alegar sucesso/replay automático; suspende autoridade capturada e RootLayout oculta dados. Retry confirma sessão no servidor; saída somente local permanece disponível. Senha não é persistida e é limpa em envio/falha/cancelamento/troca de geração. |

Owner/SID vêm exclusivamente do request autenticado. Usuário primeiro, sessões
em ordem de SID, relógio PostgreSQL depois do último lock; falha terminal é
commitada antes do erro externo. Comparação bcrypt fica fora do lock; hash
esperado e chamador são revalidados no mesmo efeito. JWT ainda assinado deixa de
autorizar após revogação. GET e novas ações auth não renovam idle/deadlines.

### Orçamento e privacidade

- **5 tentativas reservadas/60 s por conta**, compartilhadas entre remota/global,
  incluindo senha certa ou errada. Reserva antes de bcrypt sob autoridade ativa;
  janela temporária, sem bloqueio permanente, sem afetar login/logout atual.
  **20/min por IP/handler** é uma camada adicional, não substituto do limite por
  conta. HTTP 429 usa `AUTH_REAUTHENTICATION_LIMIT`, não erro terminal 401.
- `0017_add_session_reauthentication_budget.sql`: uma linha FK/PK por usuário,
  exclusão em cascata e índice owner/authenticatedAt/SID. É segurança, não coleta
  de dispositivo. Numeração conferida; aplicada somente ao cluster descartável.
- DTO não entrega owner, email, hashes, tokens, motivos internos ou IP/UA.
  Persistência de auditoria parametriza somente a nova rota de alvo, cobrindo
  contexto normal e erro; testes negativos e leitura real do audit_log passaram.
- UUID/cursor/propriedades extras inválidos: 400. Cursor ano 0000 foi um defeito
  encontrado: JavaScript aceita, PostgreSQL não; RED reproduziu e decoder passou
  a rejeitar antes do SQL. Calendário normalizado também é rejeitado.

## Provas e artefatos

Baseline dos **672 arquivos atuais**, inclusive WIP/intended-untracked, foi
copiada antes de editar, não reconstruída de HEAD:
[baseline](../../.tmp/u5-implementation-20261011/baseline.json).
**Limitação do baseline:** não incluía `frontend/__tests__`, README documental
ou plano geral. O teste RootLayout preexistente foi lido e suas regressões
passaram, mas seus bytes anteriores não foram copiados; não certificar igualdade
byte a byte desse arquivo. Os status/links documentais foram alterados somente
no trecho U5. Swagger tem snapshot suplementar antes de sua primeira escrita.
O freeze runtime posterior cobre **778 arquivos**, inclusive esses testes
frontend, e permanece inalterado; não substitui um snapshot anterior ausente.
Comandos, stdout/stderr, PIDs, exit e duração ficam no diretório
`.tmp/u5-implementation-20261011/` com nomes abaixo; limites de comandos 180 s.

| Prova | Resultado | Evidência |
|---|---|---|
| RED repositório U5 | 8 falhas por métodos ausentes | `backend-red.json`, `backend-red.txt` |
| RED cursor ano zero | 1 falha / 14 PASS | `cursor-correction-red.json`, `.stderr.log` |
| Backend focado + regressões U4/guards/atividade/logs | 9 suites / **91 PASS** | `correction-backend-unit.json`, `.stderr.log` |
| Credenciais etapa 1 | 1 suite / **8 PASS** | `credential-regression.json`, `.stderr.log` |
| Frontend U5 + U2/authority/RootLayout/races | 7 suites / **57 PASS** | `frontend-frozen-unit.json`, `.stderr.log` |
| API/erros/consumidores/tombstone | 4 suites / **36 PASS** | `api-regression.json`, `.stderr.log` |
| Perfil | 1 suite / **4 PASS** | `profile-regression.json`, `.stderr.log` |
| Tipos produtivos backend check-only | PASS | `correction-production-build.json` |
| Tipos frontend | PASS | `frontend-frozen-types.json` |
| Tipos completos backend | FAIL somente TS2352 preexistente em `orcamento.repository.spec.ts:35`; bytes iguais ao baseline | `correction-backend-types.json`, `.stdout.log` |

A primeira execução da tela teve 1 timeout de teste/56 PASS; artefato
`frontend-u5-regression` preservado. Uma correção delimitada da suite nova fixou
timeout explícito de 15 s, sem remover asserções; batch final passou. Isso não é
prova de foco visual, teclado real ou contraste.

### PostgreSQL e HTTP reais

Comando mantido: `node backendnest/test/session-harness/runner.cjs U5`.
Um cluster PG **18.3 novo**, owner restrito e banco marcado; loopback **55434**,
Nest/AppModule real **4318**, defaults 900/43200/v1 e HTTP 60/60000 preservados.
Cinco logins reais; sem alteração de throttle para contornar o teste. Startup
limitado a 120 s, goals 180 s e cada HTTP 12 s. Não conecta ao banco atual 5432.

- [Tentativa inicial](../../.tmp/session-harness-u5-95208ac7b961489a9e14cae1b5e58ddb/u5-proof.json):
  **9 PASS / 1 FAIL**, caso final global/login NOT RUN. Observer exigia dois
  blockers diretos do holder; sem grafo original capturado, causa daquela
  observação é qualificada, não presumida. Destroy com promises ainda pendentes
  gerou rejeição 500 secundária. Falha e stderr preservados, nunca convertidos.
- [Tentativa após UMA correção delimitada](../../.tmp/session-harness-u5-13110c4d034242959b11bf7993f02cb1/u5-proof.json):
  **11/11 PASS**, exit 0. Grafo real registra segundo waiter → primeiro waiter →
  holder próprio; contagem transitiva com limite/ciclo, sem SQL/params. Corridas
  refresh/revoke e global/login completaram; todas promises assentadas antes de
  fechar pool. Goals registrados: 6521 ms, amostra local, não SLO/capacidade.
- [Cleanup/identidade/freeze](../../.tmp/session-harness-u5-13110c4d034242959b11bf7993f02cb1/runtime-proof.json):
  child/Nest/PG encerrados, portas próprias livres e fonte congelada inalterada.
  Listener/processo/serviço externo 5432 iguais nos campos legíveis; caminho do
  executável do processo era indisponível/null. Não é observação de conteúdo ou
  integridade do banco externo.

Os 11 casos cobrem migration/índice; lista own/current/no-touch e 400; senha
errada sem logout, remota/repetida/foreign/inexistente 204 e quota compartilhada;
global e JWT/refresh revogados; auditoria; 26 linhas em páginas 20+6 com cursor
microsecond; 7 reservas concorrentes limitadas a 5 e renovação de janela; fences
de chamador/hash; expiry depois do lock com commit; refresh/revoke; login
ordenado depois de global. Fixtures de repositório com limite 30 não alteram o
default HTTP/login 5; não comprovam capacidade para cardinalidade arbitrária.

## Arquivos e rollback

Produção backend: controller/service/sessions-service/repository auth, novo DTO,
migration 0017 e redação estritamente U5 em `logs.service.ts`. Produção frontend:
`sessionManagement.ts`, `SessionsScreen.tsx`, `app/sessoes.tsx`, link no perfil,
novos exports local-only no coordenador e botão local no RootLayout indisponível.
Política, login/refresh/credenciais/logout existentes não foram modificados.
Harness mantida ganhou seletor U5 e `u5.ts`; branches C6/A8/C7C8 preservados.

Rollback remove endpoint/UI/new exports como uma unidade e só a transformação
de rota U5; tabela/índice 0017 podem permanecer aditivos durante rollback. Não
ressuscitar sessões nem remover enforcement U4/0016. Não usar binário antigo
que ignore autoridade U4. Não foi executado rollback/deploy/migration produtiva.

**Fora da prova:** browser U5/visual/foco real, native físico, visibility/BFCache,
contexto offline simultâneo, produção/capacidade/backup/mixed-version/rollout,
entrega real Resend. O contrato oficial `backendnest/swagger.yaml` foi atualizado
somente com as três rotas U5 implementadas, schemas e exceção 204 sem envelope;
isso não publica Swagger remoto. Seus bytes anteriores estão em
`swagger-before.yaml`/`swagger-before.json` no diretório de evidências local.
Gates de plataforma e ativação continuam necessários; o readback abaixo não os substitui.

## Readback independente — 2026-10-11

Inspeção das fontes atuais, diffs contra os bytes preservados, testes e provas
duráveis existentes: **nenhum defeito concreto bloqueante encontrado** no recorte
aprovado. Não houve nova execução de Nest/PostgreSQL, testes, build ou navegador;
nenhuma fonte de produto, dependência, configuração ou banco foi alterado nesta revisão.

- Os **778 hashes runtime** permanecem iguais ao manifesto da tentativa corrigida;
  os **28 hashes de entrega** conferiram antes desta escrita documental. Swagger
  não pertence ao freeze runtime: tem baseline suplementar anterior à escrita e
  readback estrutural próprio, com três rotas novas, 20 referências resolvidas e
  paths/components anteriores preservados.
- Dos **672 arquivos do baseline original**, nenhum falta e somente os 11 caminhos
  esperados diferem. Arquivos financeiros e enforcement/credenciais adjacentes
  preservados; isso não certifica bytes anteriores ausentes do teste RootLayout,
  README documental ou plano geral. O índice GitNexus não inclui o estado U5 atual;
  a análise usou fontes/diffs reais, sem reindexação.
- Resultados focados, sem somar execuções repetidas: **99 backend (91 + 8)** e
  **97 frontend (57 + 36 + 4)**. HTTP/PostgreSQL **11/11**; tipos de produção backend
  e frontend completos com exit 0. Backend completo conserva somente o TS2352
  preexistente informado acima; não é PASS global.
- Falha inicial, correção única do observer, grafo transitivo capturado, cleanup
  e igualdade dos campos externos legíveis foram preservados no alcance descrito.
  Não houve retry adicional. Browser U5/foco/acessibilidade visual, native/BFCache,
  saturação IP, rollout/backup produtivos e Resend continuam sem prova.

[Manifesto independente e limites](../../.tmp/u5-independent-review-20261011/readback.json),
[backup documental anterior](../../.tmp/u5-independent-review-20261011/documentation-before.json).
Próximo passo: obter autorização e orçamento próprios para as provas de plataforma
e rollout ainda abertas; não aplicar 0016/0017 ao banco da aplicação por este registro.
Este readback não é receipt nativo, aceite de produção ou encerramento de U5/etapa 2.

## Browser e controles de deploy — fechamento local em 2026-10-12

| Prova atual | Resultado e evidência |
|---|---|
| Browser: senha, remota e global | **1 caso PASS** na [execução U5B](../../.tmp/session-harness-u5b-cf73082966b24bdea4a23480ca180d2e/u5-browser-proof.json); o segundo caso dessa execução continua FAIL. |
| Browser: offline e resposta perdida após commit | **1 caso PASS**, somente ele selecionado, zero retries, 14,718 s; [prova U5R](../../.tmp/session-harness-u5r-d9d39a16d40a497aae5941118c6e5c7e/u5-browser-proof.json) e [runtime](../../.tmp/session-harness-u5r-d9d39a16d40a497aae5941118c6e5c7e/runtime-proof.json). |
| Polling aguardado da observação própria | RED real exit 1 / GREEN exit 0; tipos frontend/spec exit 0 e descoberta de um caso. [Readback e hashes](../../.tmp/u5-awaited-poll-20261012/readback.json). O bloqueio EPERM anterior fica preservado, não conta como RED funcional. |
| Backup/restauração e gate privados U5D | **10/10 PASS**, uma invocação, dump/restauro reais; [prova](../../.tmp/session-harness-u5d-2a418cf519f441518c3ebc42493847c4/u5d-proof.json) e [runtime](../../.tmp/session-harness-u5d-2a418cf519f441518c3ebc42493847c4/runtime-proof.json). |
| Checks puros dos controles | **4/4 PASS**, exit 0; [stdout atual](../../.tmp/u5-finish-deployment-20261012/pure.stdout.log). Os antigos arquivos chamados `green` com exit 1 continuam falhas. |

### Alcance real do browser

U5B comprovou senha incorreta 400 sem perder autoridade, remota 204 com SQL
revogado e JWT rejeitado por 401, global 204 exatamente uma vez e zero POST
logout adicional. Senha foi limpa após rejeição/cancelamento/sucesso; credenciais
e usuário permaneceram ausentes após reload. Teclado/foco e bounds dos controles
críticos foram verificados em 360 × 800; overflow documental não foi tratado
como oráculo de clipping. Screenshots de transição não aprovam contraste,
layout completo ou acessibilidade visual.

U5R usou Edge 155.0.4283.45 headless, exportação **oficial Expo instalada**
(160,350 s), Nest real (startup 64,841 s) e PG18.3 descartável. Total 349,958 s;
um caso, dentro dos limites declarados, sem retry. Offline antes do envio:
zero commits globais, autoridade privada oculta, senha limpa, credenciais
retidas e chamador/remota ainda ativos. Reconexão fez GET real 200 e recuperou
o mesmo SID com autoridade própria/conteúdo protegido; navegação explícita para
`/sessoes` fez nova confirmação 200 e lista própria atual, sem presumir retenção
de rota pelo remount.

Depois, `route.fetch()` recebeu o **204 real** e SQL confirmou chamador e remota
revogados; só a resposta ao browser foi abortada. Não houve JSON fabricado:
resultado desconhecido ocultou dados/limpou senha, sem replay e sem POST logout.
Retry somente leitura recebeu 401 `AUTH_SESSION_REVOKED`, limpou credenciais e
usuário e manteve tombstone, sem ressuscitar autoridade. Contagens U5R: dois
logins 200; sete GET `/auth/session` (seis 200, um 401); duas listas 200; um
global 204; zero logout/revogação selecionada.

As tentativas U5R anteriores `74824e…` e `67b332…` continuam FAIL. A alegação
anterior de causa definitivamente TOCTOU não se sustenta: na biblioteca
instalada Playwright-core **1.64.0**, `waitForFunction` testa a truthiness da
Promise retornada pelo predicado assíncrono antes de aguardá-la, podendo concluir
com `false`. A correção de teste usa `expect.poll` aguardado e retorna a exata
amostra correspondente (SID/epoch/autoridade/rota/DOM), não uma leitura posterior.
O gatilho lifecycle específico das falhas permanece desconhecido; nenhum bug
de produto foi demonstrado. Não houve mudança de produto auth/UI nesse recorte.

### Controles de deploy e limites

U5D exercitou todas as 17 migrations somente em bancos novos de três owners
restritos, sem memberships e com marker/identidade conferidos. Gate de schema
somente leitura negou 0016 sem 0017; origem, controle atualizado e destino
restaurado passaram. Dump custom/restauro real preservou **21 tabelas, 36 FKs,
quatro linhas de autoridade e uma quota preenchida com cinco tentativas**,
instantes/microssegundos, hashes das linhas e metadata. A sexta reserva restaurada
foi negada pelo relógio PostgreSQL real ainda dentro dos 60 s, com janela/contador
exatamente iguais e autoridade sem renovação. Sessões idle/absoluta/revogada não
reviveram; consulta da ativa não renovou atividade. Não prova release antigo.

CI conserva serviço **PostgreSQL 16** e somente checks: bootstrap SQL cria
owner sem privilégios administrativos, banco marcado e confirmação de reset
exata; o helper valida identidade, sole ownership e ausência de memberships
antes de recriar schema/aplicar migrations. Leitura estrutural e PG18 local não
equivalem a execução remota PG16. O [guia operacional](../operacao/SESSOES_U5_DEPLOYMENT.md)
e [gate manual](../operacao/U5_PREDEPLOY_CHECK.sql) estão preparados, não executados
no destino. `/health` estático/startup não são schema readiness automática.

**Falta para deploy:** destino de hosting e banco autorizados, backup/janela e
rollback publicado compatível; TLS, CORS real, provisionamento privado de segredos
JWT e topologia/CIDRs de proxy; execução CI PG16 e provas no destino. Validação
segura JWT atual é de `production`/`demo`, não `staging`: staging exposto exige
perfil production ou correção própria aprovada. Trust proxy e primeiro XFF de
auditoria não ganham confiabilidade por este ensaio. Capacidade produtiva,
multi-instância, native físico, lifecycle/visibility genuínos, BFCache e corrida
stale-global A/B continuam sem prova; nenhuma exigência foi dispensada.

### Integridade e encerramento proporcional

Readback atual conferiu **783/783 hashes** do freeze U5R, sem ausências ou drift.
O freeze U5D anterior tem 722 entradas e cinco diferenças posteriores somente
de harness/fixture; U5B tem 780 entradas e seis diferenças posteriores. Os
caminhos/hashes são registrados, **não** declarados iguais ao estado atual.
Baseline original de 672 arquivos continua sem ausências, agora com 13 diferenças
registradas; sua lacuna dos bytes pré-edição de RootLayout teste/docs não foi
reconstruída nem transformada em integridade fabricada. Esta revisão só alterou
documentos e manifesto ignorado; não executou testes, build, serviços ou browser.

Runtime U5R registra processos Node próprios encerrados, Nest/web fechados,
PG privado parado e portas próprias livres. U5D não lançou Nest (campo
`backendExited: false` não indica vazamento). Campos OS legíveis do externo 5432
permaneceram iguais; `ExecutablePath` indisponível não prova identidade completa
nem conteúdo do banco. PIDs individuais do Edge da harness não foram capturados:
o comando terminou e os dois sobreviventes na janela eram filhos de Edge
interativo antigo do Explorer, não da harness, e não foram encerrados. Não
afirmar ausência de todos os processos Edge.

[Manifesto independente](../../.tmp/u5-browser-deployment-final-20261012/readback.json),
[comparação dos freezes](../../.tmp/u5-browser-deployment-final-20261012/source-comparison.json)
e [bytes documentais anteriores](../../.tmp/u5-browser-deployment-final-20261012/documentation-before.json).
**Pode finalizar este recorte local de testes/controles; não pode ativar ou
encerrar globalmente U3/U4/U5/etapa 2.** Deploy real segue bloqueado pelos
requisitos acima. Nenhum receipt nativo, commit, push ou deploy foi emitido.

## Key Learnings:

1. Ações sensíveis precisam revalidar chamador/hash no mesmo efeito, depois dos locks.
2. Quota por conta precisa reservar antes de bcrypt e deve ser distinta de logout local.
3. Microsecond cursor, redaction de rota e queues transitivas precisam de provas próprias.
