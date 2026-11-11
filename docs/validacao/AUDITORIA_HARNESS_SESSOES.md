# Auditoria da harness de sessões: alinhar a prova ao contrato real

**Resultado mais recente — 2026-10-11: C6 PASS 4/4 fixtures; A8 PASS 1/1 caso browser, revisados independentemente sem reexecução.** As cinco correções já estavam implementadas; a verificação funcional dos casos delimitados agora foi concluída. Nenhum defeito bloqueante confirmado no escopo revisado. C7/C8 PASS local preservado; U3/U4, U5/U6 e etapa 2 não encerradas nem ativadas. [Fechamento funcional e limites](#c6a8--fechamento-funcional-delimitado-em-2026-10-11).

A auditoria original, o encerramento aceito e os estados PENDENTE/ADIADA/FAILED abaixo são históricos anteriores à prova mais recente; falhas não foram transformadas retroativamente em PASS.

**Resultado atual: implementação das cinco correções CONCLUÍDA, com encerramento aceito pelo usuário; verificação funcional PENDENTE/ADIADA.** A revisão independente do código e das provas existentes não encontrou defeito severo confirmado nas correções. Os 21 testes locais e o preflight PostgreSQL passaram no seu alcance; a tentativa atual C6 falhou no readiness do backend antes dos goals. Dump/restauração e HTTP C6 continuam sem prova; A8/exportação oficial não rodaram. U3/U4, U5/U6 e etapa 2 seguem abertos, sem autorização de ativação. A auditoria original abaixo é histórico anterior às correções; consulte a [aceitação do encerramento da implementação](#encerramento-aceito-da-implementação--2026-10-11) e a [prova parcial preservada](#revisão-independente-das-cinco-correções--fechamento-parcial).

Data: 2026-10-11. Carga considerada: execução local serial de provas delimitadas, um worker browser, sem retries; não capacidade de produção. Referência: bytes atuais do workspace, incluindo WIP, não apenas HEAD. [Plano de sessões](../planejamento/SEGURANCA_SESSOES_ETAPA_2.md) e [resultado U4](SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md) mantêm o histórico e os gates de ativação.

## Escopo e método

Comparação estática entre runners atuais `remaining-a`, `c5-equivalence-typed` e `c6-deadlines`, seus artefatos existentes e os contratos atuais de auth, schema, bootstrap e fronteira frontend. Foram lidos main/AppModule, configuração JWT/throttle/policy, guard/strategy, repositório/locks/relógio, migrations 0004/0015/0016, helpers E2E, RootLayout, API, storage, logout e bridge/exportação Expo. Não é auditoria de toda a aplicação financeira.

GitNexus query/context confirmaram os símbolos de auth. As relações dos scripts ignorados não estão comprovadas pelo índice: risco **UNKNOWN**, não zero callers. O fluxo manual atual é launcher → preparação/bootstrap → goals ou browser; goals → semântica/canonicalização/dump/restore. Nenhum símbolo foi editado, portanto não houve impacto de implementação nem gate de commit.

## Achados originais — defeitos ativos antes das correções

### 1. UTC é aplicado depois da escrita das fixtures C6

- **O que é:** preparação de quatro sessões reais por login HTTP, seguida de backdate SQL em banco privado descartável.
- **Problema:** `goals.cjs:22–32` conecta, lê `clock_timestamp()::text` e escreve campos `timestamp`/`timestamptz` antes de `authority()` aplicar UTC em `:14`. A prova retém anchor `2026-10-11 13:45:27.141838-03`. A conversão para campos sem fuso já ocorreu quando o readback muda a sessão para UTC; a harness mistura representações temporais no próprio preparo.
- **Correção mínima proposta:** verificar identidade, tipos e `SHOW TIME ZONE`, fixar UTC e confirmar o relógio antes do primeiro login/anchor/backdate. Manter o caso de migration legado America/Sao_Paulo separado; ele não define o fuso de novas fixtures de autoridade. Não alterar migrations produtivas para acomodar a harness.
- **Se não corrigir:** preparação dependente do fuso volta a interromper o teste ou produz uma fronteira diferente da pretendida.
- **Confiança:** alta, fluxo atual e anchor real. Evidências: `.tmp/stage2-pending-20261011/c6-deadlines/goals.cjs:14–35`, `prepare-database.ts:4`, `goals-proof.json:13–14`; `backendnest/migrations/0004_add_auth_session.sql:5–9` e `0016_add_session_policy.sql:3–6`.

### 2. C6 exige igualdade textual entre tipos temporais diferentes

- **O que é:** invariant de prazo refresh antes do dump.
- **Problema:** `authority()` retorna `expires_at::text` e `refresh_expires_at::text`; `:35` exige strings idênticas. O primeiro é `timestamp` sem fuso; o segundo é `timestamptz`. O erro real compara `2026-10-12 01:25:27.141838` a `2026-10-12 04:25:27.141838+00`. Mesmo aplicando UTC antes, permanece a diferença de formato sem/com offset. Os demais `Date.parse` de texto sem offset também não explicitam o fuso da fixture.
- **Correção mínima proposta:** comparar instantes tipados em SQL ou epoch com fuso explícito e precisão definida para as fixtures conhecidas; usar o relógio DB como produção faz. Preservar igualdade bruta antes/depois para demonstrar conservação dos campos legados no restore. Não adicionar `Z` indiscriminadamente ao legado de proveniência desconhecida.
- **Se não corrigir:** apenas mover UTC não desbloqueia C6; a prova continuará falhando antes de avaliar restauração ou HTTP.
- **Confiança:** alta. Evidências: `c6-deadlines/goals.cjs:15,18,35,44,51–56`, `goals-proof.json:11–14`; contrato real: `backendnest/src/auth/repositories/credential-lock.ts:31–38`, `auth-session.repository.ts:127–145`, `session-policy.ts:85–97`.

## Achados originais — prevenção e limites de prova

### 3. O preflight aprova presença de código, não o contrato das fixtures

- **O que é:** checks offline anteriores ao lançamento caro da prova.
- **Problema:** `c6-deadlines/check.cjs:7` procura strings como `assert.deepEqual(persisted,b)` e `cache-control`; o typecheck em `:6` cobre imports TS, não o SQL e o cálculo de `goals.cjs`. Assim, `checks-passed` coexistiu com o erro determinístico de preparação. Na A, `check-candidate.cjs:7–15` faz somente transpilation e declara contagens no JSON; não comprova tipos completos nem o contrato SQL.
- **Correção mínima proposta:** pequeno preflight compartilhado para schema real — nomes, tipos, nullability, constraints relevantes —, configuração resolvida, relógio/fuso e invariants de uma fixture legal antes do restante dos casos. Cobrir comparações temporais com casos puros UTC/Sao_Paulo e parâmetros SQL com casts explícitos onde um placeholder participa de tipos diferentes. Registrar checks estruturais separadamente de prova funcional; não chamá-los de PASS do cenário.
- **Se não corrigir:** erros de contrato continuam sendo descobertos depois de iniciar PG/Nest/browser e de gastar o orçamento do caso.
- **Confiança:** alta para a lacuna. A falha histórica `user_id` e a inferência histórica de `$3` foram corrigidas nos runners atuais; são exemplos de recorrência, não bugs ativos adicionais.

### 4. O runner atual depende de clones e substituições textuais

- **O que é:** construção de nova tentativa copiando uma pasta anterior.
- **Problema:** `remaining-a/prepare-candidate.cjs:8–26` copia bootstrap/helpers e reescreve launcher/spec/config por `replace`/`replaceAll`. C5 e C6 têm novas cópias de bootstrap, configuração e semântica. Uma alteração futura em main ou contrato não propaga automaticamente: registrar o hash de main não verifica paridade funcional. Hoje o bootstrap lido tem paridade com main; não foi encontrado drift ativo de middleware.
- **Correção mínima proposta:** após reparar C6, manter um runner atual e um conjunto pequeno de helpers versionados, com seleção explícita de caso/perfil e artefatos por tentativa. Reutilizar configuração/bootstrap/fixtures existentes quando compatíveis. Remover do runner atual blocos não usados, não apagar pastas de provas históricas. Não criar framework genérico nem abstrações para todos os futuros testes.
- **Se não corrigir:** cada novo lote continua carregando cópias e expectativas antigas, exigindo auditoria manual do mesmo contrato.
- **Confiança:** alta. Evidências: `remaining-a/prepare-candidate.cjs:8–27`, `remaining-a/execute.cjs:11–18,30–39`, `c6-deadlines/execute.cjs:10–17,25–38`, `c6-deadlines/bootstrap.ts:10–25`; `backendnest/src/main.ts:14–35` e `test/u4-browser-bootstrap.ts:10–25`.

### 5. A8 grava uma conclusão mais ampla que o cenário executado

- **O que é:** evidência do logout offline, ausência de replay e login após reconexão.
- **Problema:** `integrated-corrected.spec.ts:38` registra `bSurvived:true`, mas cria B depois de reconectar, na mesma página; não existe B em outro contexto durante a tentativa offline. O readback/documentação já qualificam isso corretamente. O campo bruto, isolado, permite interpretação de PASS de contenção concorrente que o teste não realizou.
- **Correção mínima proposta:** nomear a evidência conforme o que ocorreu e assertar identidade da nova sessão após reconexão; manter contenção simultânea em contexto separado como pendência própria, não ampliar silenciosamente o PASS atual.
- **Se não corrigir:** consumidores do JSON podem transformar recuperação sequencial em prova de uma corrida não exercitada.
- **Confiança:** alta. Evidências: `remaining-a/integrated-corrected.spec.ts:38`, `remaining-case-evidence.json` caso A8, `readback.json:32–36`; isolamento de identidade real em `frontend/storage/authStorage.ts:238–252` e `frontend/src/modules/auth/services/sessionAuthority.ts:95–109`.

## Contratos que já estão alinhados

| Contrato | Evidência atual e limite |
|---|---|
| Auth real | A/C usam AppModule e login HTTP. Secret/issuer/HS256 da fixture expirada A correspondem à configuração descartável (`remaining-a/integrated-corrected.spec.ts:28`, `execute.cjs:14`). O guard distingue expiração real (`jwt-auth.guard.ts:13–17`); não é um 401 falso de header. TTL configurado é respeitado pelo signer atual (`auth.service.ts:476–490`). |
| Policy v1 | Defaults 900/43200/version 1 (`session-policy.ts:36–41`); login A verifica policy e duração (`spec:24`). Lock usuário/sessão e relógio após ambos estão no repositório (`auth-session.repository.ts:161–185,209–219`); tests E2E têm barreiras/PIDs distintos (`session-boundaries.e2e-spec.ts:87–149,238–282`). Isso não mede capacidade em carga. |
| Bootstrap/middleware | Bootstrap atual importa AppModule, parsers/CORS reais, helmet, pipe e interceptor na mesma ordem de main. AppModule aplica RequestId/RequestContext e guard global (`app.module.ts:130–154`). Diferenças declaradas: loopback e shutdown IPC. Não é execução literal do main. |
| Throttle | Runners atuais A/C usam 60/60000, igual ao default real (`throttler.config.ts:14–26`). Helper E2E geral configura 1000 (`test/e2e-database.ts:31`); é perfil distinto, não prova do throttle de produção. A usa pacing 15 s (`spec:17`), sem autorização de capacidade. |
| Confinamento | Env filho por allowlist, cwd limpo, sem consulta a dotenv privado; DB/role próprios, confirmação, marker, owner e ausência de privilégios/memberships antes do reset (`test/e2e-database.ts:40–85,125–140`). C6 verifica identidade por operação e identidade externa antes/depois (`goals.cjs:2`, `execute.cjs:31–39`). Preservar essas barreiras. |
| Browser/exportação | Exporter oficial Expo (`batch-a/export.cjs:1`), RootLayout/LoginScreen reais, dashboard apenas marcador, bridge chama API/storage/logout reais (`batch-a/fixture/entry.ts:1–39`). Source/dist ficam congelados na baseline A. Não comprova toda a UI financeira. Static path A atual aceita raiz e limita traversal (`remaining-a/static-path.cjs:2–7`); a falha histórica da raiz não é achado ativo. |
| Proxy de falhas | A3/A4 verificam upstream real 401/200; A5 truncamento ocorre após receber resposta real e há mudança do hash SQL (`spec:34–35`, `execute.cjs:31`). Falha de transporte não deve ser confundida com rejeição pré-handler. A2 histórico exercitou três páginas reais; A8 não é esse tipo de concorrência. |
| C5 | Canonicalizer admite somente duas formas exatas do CHECK identificado, com metadata/validação/deferrability e contexto builtin exatos (`c5-equivalence-typed/canonicalizer.cjs:2–4`). Semântica tipada roda antes do normalize (`semantic.cjs:2–4`). Igualdade estrita permanece nas demais linhas/schema/defaults/constraints/índices. Não é equivalência de SQL genérico. |

## Inventário anterior às correções: histórico preservado

| Prova | Estado verificado por leitura dos artefatos existentes |
|---|---|
| A1/A2 | PASS histórico separado; não fazem parte da execução A3–A9. |
| A3–A9 `remaining-a` | 7 esperados, 0 unexpected/skipped/flaky, 147608,87 ms; readback existente confirma 7 PASS. A6 é saída local durável: logout remoto não confirmado, `revoked=false`; não prova revogação no servidor nessa corrida. |
| B1–B5 `batch-b` | Relatório existente: 5 esperados, 0 unexpected/skipped/flaky. Não é PASS de toda a matriz/plataforma. |
| C1–C4 | PASS históricos delimitados: legado sintético UTC/Sao_Paulo, JWT legado válido rejeitado por HTTP e writer antigo rejeitado por constraint. Não reproduzem dados/ambiente produtivos nem rollout de binários publicados. |
| C5 `c5-equivalence-typed` | PASS atual delimitado: 20 tabelas/30 linhas/35 FKs, uma diferença textual admitida; hash normalizado `d2986ae42abeb8519124fa3f101164e08284d854a838910c2487f0517ca1ea2a`. 13 truth comparisons; INSERT/UPDATE, cada um 12 aceitos/14 rejeitados. Falhas C5 anteriores permanecem históricas, não substituídas retroativamente. |
| C6 `c6-deadlines` | Tentativa atual FAILED no preparo, `cases=[]`. Não chegou ao dump/restore nem aos quatro checks HTTP pós-restore. Cleanup existente registra backend encerrado, PG parado, portas livres e estado externo igual. Não há PASS C6. |
| C7/C8 | NOT RUN: nenhum perfil de carga/latência medido ou capacidade produtiva aceita. |
| Visibility/resume, BFCache, native físico | DEFERRED/sem prova genuína; skip/capability failure não vira PASS nem bug do produto. |
| Produção | Banco/dados atuais, timezone histórico real, backup produtivo e mixed-version/rollback não auditados nem autorizados por este relatório. U3/U4, U5/U6 e etapa 2 continuam com seus gates abertos. |

## Ordem mínima originalmente recomendada — histórico

1. Reparar somente C6: UTC antes das fixtures, leitura/comparação temporal tipada, preflight dos tipos/constraints/relógio. Criar fixtures via serviços reais e backdate apenas linhas sintéticas próprias, preservando invariants e casts explícitos.
2. Sob autorização separada, executar uma prova C6 delimitada, com forecast/orçamento e stop-on-failure. Conservar artefatos antes/depois e evidência HTTP/SQL; não iniciar C7/C8 junto.
3. Consolidar apenas o runner/helper atual e corrigir a nomenclatura A8. Documentar perfis 60 versus 1000, limites do bridge/proxy, caso esperado e formato de resultados; tornar contagens/assertions de escopo verificáveis. Preservar todo histórico.
4. Tratar carga, corrida de revogação remota com acesso ainda válido, contenção offline em contexto separado e lifecycle/native como provas próprias. Nenhuma ampliação de produto decorre automaticamente da auditoria.

Tradeoff: reparar C6 primeiro reduz o bloqueio com mudança pequena; consolidar antes aumenta o escopo e obriga rever provas já delimitadas. Adiar a consolidação indefinidamente mantém o custo de drift. Não há estimativa comprovada de linhas/dependências removíveis, nem promessa de que nunca haverá falhas.

## Verificação desta auditoria

- Baseline atual antes da escrita: [269 hashes](../../.tmp/harness-audit-20261011/baseline.json), incluindo contratos lidos, runners/provas atuais e dist Expo. [Estado Git anterior](../../.tmp/harness-audit-20261011/git-status-before.txt) preserva WIP.
- Readback de baselines históricas, sem execução: A, 2181 registros permitidos conferidos/1390 excluídos (dotenv/data/dump); C5, 162/2 excluídos; ambas divergem somente nos dois documentos atualizados em fechamentos posteriores. C6, 177/2 excluídos, zero divergências. Não afirmar integridade de arquivos excluídos. Esses deltas documentais não são drift de produto.
- Somente este relatório e suporte ignorado foram criados. [Readback estrutural e integridade](../../.tmp/harness-audit-20261011/readback.json) registra a conferência posterior, sem novo PASS funcional.
- **Não executado:** testes, typecheck, build/export, browser, DB/migrations/restauração, serviços, Resend, normalização, commits, deploy ou gates de ativação. Artefatos existentes são evidência histórica, não retestes desta auditoria.

## Key Learnings:

1. UTC precisa preceder a escrita da fixture; igualdade de strings não compara corretamente `timestamp` e `timestamptz`.
2. Checks de sintaxe/presença não provam o contrato SQL; o preflight deve ler tipos, constraints e relógio reais.
3. PASS de saída local, recuperação sequencial ou transporte injetado não comprova revogação remota, corrida simultânea ou capacidade produtiva.
## Revisão independente das cinco correções — fechamento parcial

Data: 2026-10-11. Revisão somente de código/provas existentes e atualização documental; nenhum teste, typecheck, export, browser, banco ou serviço reexecutado. Carga considerada: uma prova local serial delimitada, não produção.

| Achado | Implementação revisada | Prova e limite atual |
|---|---|---|
| 1. UTC antes das fixtures | `contract.cjs:69–76` verifica destino, aplica/confirma UTC e lê relógio DB antes dos logins/backdate em `c6.cjs:137–221`. Role descartável também recebe UTC antes das migrations. | Preflight real confirmou UTC. Logins/backdate C6 não alcançados; não é PASS funcional. |
| 2. Comparação temporal tipada | SQL calcula epoch em microssegundos e `BigInt` compara instantes; somente timestamps sintéticos próprios recebem interpretação UTC. Restore ainda exige igualdade bruta integral (`c6.cjs:274–275`). | Testes locais cobrem precisão/tipos; preflight real confirma UTC/Sao_Paulo. Dump/restore e quatro respostas HTTP continuam NOT RUN. |
| 3. Preflight do contrato real | Schema/nullability, PK/FK/CHECK, configuração resolvida, UTC/relógio e escritas legais/rejeitadas são lidos no PG privado. `prepare.ts:24–31` mantém QueryRunner próprio para uma conexão física, incluindo savepoints/rollback. | 15 colunas, 9 constraints, 11 rejeições SQLSTATE 23514 e limites idle 1/31536000 confirmados. Defaults 900/43200/v1; throttle 60/60000. Prova explicitamente `live-contract-preflight-not-scenario-pass`. |
| 4. Runner mantido | Nove arquivos mantidos em `backendnest/test/session-harness/`, seletor fechado C6/A8 e artefatos novos por nonce; reutiliza preparação E2E e bootstrap real, sem clonar/substituir fontes históricas. | Fonte/sintaxe/tipos revisados. Uma tentativa C6 chegou ao preflight, mas falhou antes dos goals. Não é aprovação de todos os runners históricos nem de perfis futuros. |
| 5. A8 com escopo verdadeiro | `a8.spec.ts:68–100` exige nova identidade SID/usuário em SQL e após reload, registra recuperação **sequencial** e contenção em contexto separado NOT RUN. Bridge usa logout/storage reais sem UI extra. | Implementado e typechecked, mas A8/exportação oficial NOT RUN. Nenhum novo PASS browser ou contenção concorrente. |

### Evidência local e execução atual

- [Handoff](../../.tmp/harness-corrections-e2f310e0fd4e4ed79140ef8f0c3d0d74/handoff.json) e [21 testes locais, 21 PASS](../../.tmp/harness-corrections-e2f310e0fd4e4ed79140ef8f0c3d0d74/local-tests-final.json): readback do resultado existente, sem reteste. Tipos de backend produtivo, harness e frontend passaram; typecheck completo backend continua limitado ao erro preexistente TS2352 em `orcamento.repository.spec.ts:35`, não alterado.
- [Runtime C6 atual](../../.tmp/session-harness-c6-23efb995fb8d453a81788c53a7022986/runtime-proof.json): FAILED `Backend readiness timeout` em 60 s; não existe execução dos goals C6 nessa tentativa. [Preflight real](../../.tmp/session-harness-c6-23efb995fb8d453a81788c53a7022986/contract-proof.json) não substitui prova de HTTP/dump/restauração.
- [Log Nest](../../.tmp/session-harness-c6-23efb995fb8d453a81788c53a7022986/backend.stdout.log): primeiro log cerca de 65 s após criação do arquivo; aplicação iniciou cerca de 68 s. Stderr vazio. `register.cjs:13` **já tinha `transpileOnly: true`** no candidato congelado: typecheck global por ts-node não explica essa demora. Confiança alta no excedente do orçamento e na localização pré-primeiro-log; causa da demora de carregamento/transpilação/importação **UNKNOWN**, sem atribuição a um módulo, ao banco ou ao produto.
- Listener IPC é instalado imediatamente após spawn no runner; não há evidência de uma corrida óbvia que explique a falha. Cleanup começa após o timeout, envia shutdown ao filho próprio e permite 10 s antes de kill. A prova registra backend encerrado, PG privado parado e portas livres, com fonte congelada e identidade externa/5432 iguais. Startup tardio durante cleanup não vira readiness aprovado retroativamente.
- Readback independente conferiu **704 entradas do candidato de runtime sem divergência** e, antes da escrita documental, **672 registros protegidos**, com única mudança previamente autorizada em `frontend/tests/browser/u4/entry.ts`. As três atualizações documentais preservam backups dos bytes atuais/WIP em [readback independente](../../.tmp/harness-review-20261011-independent/readback.json); não alteram fontes, dependências ou provas históricas.

**Próximo escopo recomendado, ainda não executado:** diagnóstico de startup somente da harness, com timestamps de processo/registro/importação/Nest/readiness e uma tentativa explícita sem retry. Manter tipos offline e o `transpileOnly` já existente; decidir orçamento finito de startup com a medição, sem tornar o timeout infinito. Depois, somente com autorização, repetir C6 isolado; A8 apenas após C6 e cleanup comprovados. C7/C8, contexto offline simultâneo, lifecycle/BFCache/native, produção, Resend e gates U5/U6 permanecem separados.

## Key Learnings:

1. Implementação e preflight aprovados não são prova funcional de dump/restauração ou HTTP.
2. `transpileOnly` já estava ativo; a demora pré-Nest exige diagnóstico, não um reparo presumido de typecheck.
3. Resultado sequencial de A8 não comprova contenção offline simultânea.

## Encerramento aceito da implementação — 2026-10-11

**Cinco correções: implementação CONCLUÍDA. Verificação funcional: PENDENTE/ADIADA.** O usuário aceitou encerrar o trabalho de implementação sem exigir nova execução agora. Isso não converte a tentativa C6 FAILED em PASS: readiness de 60 s, primeiro log aproximadamente aos 65 s e startup aos 68 s permanecem registrados; a causa da demora continua UNKNOWN, sem defeito de produto demonstrado.

Goals/HTTP/dump/restauração C6 e A8/exportação oficial continuam sem nova prova; C7/C8 e lifecycle/BFCache/native permanecem pendentes ou adiados. U3/U4, U5/U6 e etapa 2 não foram encerrados nem ativados. O diagnóstico/teste recomendado acima fica adiado e só será retomado se o usuário solicitar, com autorização e orçamento próprios. Este encerramento é somente documental, sem runtime, testes, fontes, configuração, banco, commit ou deploy; preserva o histórico e os bytes anteriores em [backup documental](../../.tmp/harness-implementation-close-20261011/baseline.json).

## C6/A8 — fechamento funcional delimitado em 2026-10-11

**Cinco correções: implementação já CONCLUÍDA; C6 PASS 4/4 e A8 PASS 1/1 verificados independentemente.** Revisão das fontes atuais e provas duráveis, sem executar runtime, testes, typecheck, export, browser ou banco. Carga considerada: duas provas locais delimitadas, uma invocação por perfil, um worker browser e zero retries, não produção.

| Correção auditada | Prova atual e limite |
|---|---|
| UTC antes de escrever | Role/connection UTC antes de migrations/logins/backdate; preflight real e quatro logins legais C6. Não interpreta timezone desconhecido da produção. |
| Instantes tipados e restore bruto | Igualdade independente dos arquivos antes/depois: quatro linhas brutas, microssegundos e metadata do schema. HTTP ativo sem touch; três motivos terminais 401 exatos sem extensão. C5 textual permanece prova histórica distinta. |
| Preflight real | Schema/nullability/PK/FK/CHECK, política 900/43200/v1, throttle 60/60000, clock e rejeições legais conferidos nos artefatos. Continua sendo preflight, não PASS por si só. |
| Runner mantido | Seletor fechado C6/A8/C7C8, artefatos por nonce, startup finito 120 s para todos os perfis, observado em 21,492 s C6/4,191 s A8. Não há clone textual de runner histórico ou mudança de produto. |
| A8 com escopo verdadeiro | Root/Login/API/storage/logout reais; credentials/user/legacy removidos duravelmente offline, tombstone conserva SID, remoto não confirmado/sem replay. Nova conta sequencial após reconexão possui SID/sub/usuário durável/SQL coerentes após reload. Contexto concorrente separado NOT RUN. |

Readback independente: 706 hashes por candidato e 41 arquivos Expo 57.0.23 exportados conferidos. C6 atual diverge somente no posterior spec A8 autorizado; A8 atual coincide integralmente. Baseline anterior e C7/C8 divergem somente em runner/contract spec/A8 spec/README autorizados. RED 1 falha/30 PASS seguido de GREEN 31/31 e tipos focados/frontend completos sem erros possuem logs/exits duráveis; backend completo mantém TS2352 preexistente. Runtime/consulta OS registram cleanup dos filhos/Nest/web/PG privados, portas livres e zero commandlines com roots próprios. Identificadores externos observáveis iguais antes/depois, mas executable path OS indisponível; sem conexão SQL ao 5432.

[Prova detalhada e todos os limites](SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md#c6a8--prova-funcional-delimitada-em-2026-10-11), [baseline com backups dos bytes atuais](../../.tmp/c6-a8-independent-readback-20261011/baseline.json) e [manifesto independente](../../.tmp/c6-a8-independent-readback-20261011/final.json). Fonte revisada não mostrou defeito bloqueante confirmado no escopo causal dos dois casos. Não transforma failures/pending anteriores em PASS; C7/C8 PASS local preservado.

**Não comprovado:** ocultação síncrona independente (marcador verificado após logout completo), revogação remota/corrida com access válido, contenção offline simultânea, visibilidade genuína/BFCache/native, capacidade/backup de produção, timezone legado real e mixed-version/rollback. As 24 posições estáticas de `expect` não são contagem runtime. U3/U4, U5/U6 e etapa 2 abertas, sem ativação. Esta atualização só altera os três documentos autorizados e artefatos ignorados; sem reexecução, fonte de produto, dependência, banco atual, serviço externo, Resend, commit ou deploy.
