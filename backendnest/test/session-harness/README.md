# Current session proof harness

## P4: preparado localmente; prova remota pendente — 2026-10-14

**P4 IMPLEMENTED_LOCAL / PURE_PASS; REMOTE_NOT_TESTED / OPEN. U6/etapa 2 OPEN;
produção BLOCKED.** Workflow manual dedicado, adapter negativo PG16 restrito e
prova fechada/readback preparados; P4 puro 17/17, U6 puro 39/39 e tipos completos
sem emissão passaram localmente. Sem PostgreSQL/CI/upload/commit/push nesta unidade.
[Escopo, prova final, rollback e aprovações de publicação](../../../docs/validacao/SEGURANCA_SESSOES_ETAPA_2_P4_CI.md).

P3 LOCAL_PASS_BOUNDED permanece inalterado: sete provas históricas/23 assertions
+ U5D atual/10; não é novo lote 8/8. As seções abaixo preservam o histórico.

## P3: aceite local delimitado encerrado — 2026-10-14

**P3 LOCAL_PASS_BOUNDED / CLOSED somente no aceite local; P4 OPEN;
U6/etapa 2 OPEN; produção BLOCKED.** Oito casos coordenados qualificados em
execuções aprovadas de candidatos diferentes: sete históricos/23 assertions +
U5D atual/10, total 33; não é novo lote 8/8 do candidato atual nem receipt.
Qualificação independente delimitou as mudanças a U5D e à extração byte idêntica
do confinamento compartilhado; nenhuma mudança concreta exige rerun dos sete.
[Resultado atual e limites](../../../docs/validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p3-aceite-local-delimitado-encerrado--2026-10-14).
Não autoriza CI/deploy/produção. Esta nota é posterior à tentativa, sem reteste;
as seções anteriores no tempo abaixo, inclusive falhas, permanecem históricas.

## P3: correção delimitada do contrato de paths — 2026-10-13

**Aceite nativo P3 OPEN; tentativa C6 falhou antes do owner.** O candidato
anterior `a613f4a385b7b60f86c10faa894e702806ddcee4443032d47d857d16957cca1b`
foi autorizado, mas o coordenador terminou com exit 1 antes do lançamento:
owner 0, casos nativos executados 0, sete seletores restantes NOT_TESTED.
A allowlist de `candidateHash` rejeitava os assets mantidos
`react-logo@2x.png` e `react-logo@3x.png`. A correção acrescenta somente
`@` aos caracteres aceitos; paths absolutos, traversal, segmentos vazios/ponto,
dotenv privado, duplicatas, SHA inválido e campos desconhecidos seguem rejeitados.

Regressão RED reproduziu a rejeição; GREEN direcionado passou 9/9. O teste novo
vincula os inventários completos atuais dos oito seletores, inclusive os assets,
ao snapshot do coordenador e ao IPC fechado com adapter sintético; não executa
PG/Nest/Expo/browser nem concede PASS nativo. O primeiro GREEN foi interrompido
por falta de `arm` no adapter do teste; o teste foi corrigido, sem mudar o runtime.
Suite pura afetada: 39/39 PASS (exit 0) com owner/descendente Node sintético.
A primeira execução sandbox teve 37/39 e dois EPERM de spawn; a mesma suite
passou sob escalonamento revisado, sem runtime nativo dos casos.
Prova corretiva, inventários, logs, hashes, readback, manifesto offline atual e
backup exato dos 850 paths anteriores: `.tmp/p3-path-contract-20261013/`.
O `proof.json` dessa pasta identifica o candidato final após estes documentos
e os resultados reais dos checks; não reutiliza aprovação do candidato anterior.

A prova histórica `.tmp/p3-native-acceptance-20261013/final-report.json`
permanece imutável (SHA256
`38f4475194c28f9029b6f1b6cefb7312a87ca59681d6df6568986d8631f4bcba`).
Uma nova execução nativa exige nova aprovação explícita do candidato/casos/caps;
nenhuma tentativa/retry nativo foi autorizado por esta correção.
Rollback: restaurar somente estes quatro documentos e `u6-runtime.cjs`/
`u6-runtime.spec.cjs` dos backups dessa pasta, nunca HEAD ou WIP alheio.
P3/P4/U6/etapa 2 continuam OPEN; produção BLOCKED; sem fechamento global.



## P3 coordenado — 2026-10-13

**IMPLEMENTED / PURE_PASS / NATIVE_NOT_TESTED.** Bridge real de U6 para oito seletores,
IPC v2 fechado, fontes por hash, importadores por caso, Job Object Windows antes
do go, cleanup cooperativo e caps agregados implementados. Batch final 37/37,
incluindo owner/descendente Node sintético real; não é prova PG/Nest/browser.
OFFLINE_CHECKS permanece default; TARGET_VALIDATION BLOCKED. Runtime exige caso,
hash e caps exatos explicitamente aprovados; sem aprovação, zero launches.
P3 depende ainda do aceite nativo qualificado de todos os oito casos, uma tentativa
por caso, parar na primeira falha, zero retry. P4/U6/etapa 2 OPEN; produção BLOCKED.
[Ficha atual e comandos futuros NÃO autorizados](../../../docs/validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p3-implementação-coordenada--2026-10-13).

One maintained runner executes **C6, A8 or combined C7C8** against a new private PostgreSQL 18.3 cluster, restricted disposable database owner, and actual Nest/AppModule. Historical `.tmp` runners and reports are read-only history, not implementation templates. The commands below are explicit independent attempts, not an automatic retest sequence.

## Quick path

### U6 offline preparation

`node backendnest/test/session-harness/u6.cjs` runs six finite installed checks
only (new pure U6 checks, five selected config suites, maintained deployment and
polling checks). It creates a closed-schema manifest/checksum in a new
`.tmp/u6-<nonce>/portable` directory; raw logs stay in `private` and must not be
uploaded. `PARTIAL_PASS` is not production readiness. Unapproved runtime and all target modes
remain blocked and launch no services. See the [current result and limits](../../../docs/validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md).

From the repository root, with dependencies already installed:

```powershell
node backendnest/node_modules/jest/bin/jest.js --config backendnest/test/jest-e2e.json --testRegex contract.spec.ts$ --runInBand
node backendnest/test/session-harness/runner.cjs C6
# Run A8 only after reading a successful C6 result and cleanup.
node backendnest/test/session-harness/runner.cjs A8
# Independent C7/C8: no C6 dump, browser or Expo export.
node backendnest/test/session-harness/runner.cjs C7C8
# Independent U5 actual SessionsScreen browser proof; no older case reruns.
node backendnest/test/session-harness/runner.cjs U5B
# Target only offline/reconfirmation/post-commit case; do not rerun old U5B pass.
node backendnest/test/session-harness/runner.cjs U5R
```

These runtime commands create a nonce-specific `.tmp/session-harness-<case>-<nonce>/` directory. They do not read private dotenv, connect to the application database, install packages, alter Windows services, or retry failed cases. PostgreSQL bin defaults to the installed Windows `ProgramFiles/PostgreSQL/18/bin`; set `SESSION_HARNESS_PG_BIN` explicitly for a different installation. Windows external-service readback is required; installed Edge is required only for A8. Ports 55434, 4318 and 4178 must be free; port 5432 is observed read-only before/after and never connected to or modified.

## What is checked

### C6 native SQL-error case (bounded local proof completed)

Current P2 local proof: pure 16/16, native SQL-error case 2/2, and one new normal
C6 4/4; separate units, not combined with historical passes. Negative runner exit
0/33,325ms; positive exit 0/60,233ms. PG/clients 18.3 and Node v24.14.0.
See the [current P2 technical record and private hashes](../../../docs/validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p2-prova-local-delimitada--2026-10-12).
The commands below are maintained entrypoints, not authorization to repeat either
completed attempt. P3/P4/U6 remain open; production remains blocked.

After independent safety inspection and explicit runtime approval, run **one**
selected attempt from the repository root:

```powershell
node backendnest/test/session-harness/runner.cjs C6_SQL_ERROR
```

This is not U6 runtime dispatch (P3), CI PG16 (P4), or production approval.
The existing runner provisions a fresh PG18.3 cluster and one restricted sole-owner
marked `finance_e2e_*` database. Source, fail-fast destination and counterfactual
destination are isolated by fresh `public` schemas in that same private database;
each schema reset follows the unchanged identity guard. No historical cluster or
dump is reused, no role privilege/membership changes, and no Nest/browser starts
for this negative selector. All reserved ports must still be free.

Three independent schema-only custom-archive TABLEs are checked against the actual
native `pg_restore --list`: only `before`, `error`, `after`, exactly three selected
TABLE entries (actual archive header has eight total metadata entries),
then a fixed validated `--use-list` orders them. A pre-existing `error` table has
one distinct destination marker. The maintained C6 command boundary runs restore
with `--exit-on-error --no-owner --no-privileges`; a second, fresh destination
explicitly omits only `--exit-on-error` as the fixed counterfactual phase. These
are two planned phases, not retries. Neither `--clean` nor `--single-transaction`
is admitted: fail-fast does not claim transactional atomicity.

Both native restores must exit 1 with only the intended `duplicate_table` diagnostic
and synthetic CREATE statement. `observedSqlState` is `42P07` only if native stderr
actually exposes it, otherwise `null`; the error class is not a fabricated numeric
observation. Missing binary, timeout/signal, connectivity, reparse guard rejection,
invalid archive, unexpected permission error or extra diagnostics FAIL the case.
The first destination must retain `before` and the original `error` marker while
`after` is absent; the counterfactual must retain the marker and contain `after`.
No normal C6 HTTP/authority continuation may run. The existing mock/VM test remains
pure partial evidence, not native PostgreSQL evidence.

Read back `c6-sql-error-proof.json` with `validateNegative` from
`c6-negative.cjs`, then `runtime-proof.json` with `validateCleanup`. The former has
only `case/status/intendedNegative/toc/failFast/control/normalContinuation/counts`;
each phase contains a closed safe native result and four sentinel booleans. The
runner requires this evidence and counts 2/2, not child exit zero alone. Cleanup
must confirm owned command exit, no backend started, PG stop, free ports, unchanged
frozen sources and external 5432 service identity. Raw logs, DSNs, passwords,
tokens, dumps, TOC lists and absolute paths must not be uploaded. Preserve private
artifacts; cleanup stops only the PID/data-path/loopback-verified owned cluster.

Current actual caps: runner commands/preparation 60s each, C6 goals 180s, each native
dump/list/restore 45s (up to 2s exit-confirmation grace), positive Nest startup 120s;
owned `pg_ctl stop` uses `-t 30` inside its 60s command cap. There is no aggregate
60s preflight / 30s cleanup / 390s total ceiling. Confirm the attempt forecast
before launch; never raise caps after a timeout. Sandbox-native spawn may need
reviewed escalation; no admin, ACL, service or sandbox bypass. The required separate
normal C6 4/4 attempt passed on these implementation bytes; old positive proof is history.

Actual negative readback confirms both native restores exit 1 with the intended
duplicate-table diagnostic, no signal, and `observedSqlState: null`; numeric 42P07
was not exposed. With the flag, `before`/original `error` marker survive and `after`
is absent; the fresh-schema counterfactual reaches `after`. HTTP/authority
continuation is 0/0. Guarded runner and final cleanup qualify bounded P2.
The original independent negative report keeps its incomplete live-OS observation
status: PID/creation/listener was not captured during that case. A negative
standalone PID/port field is not a TCP listener or a proven initdb-specific cause.
Actual positive PG PID/startup/listener and Nest PID/creation/listener were captured
live; owned descendants/ports were absent after cleanup. External 5432 identities
were unchanged, but its executable path was null and remains unverified.
The positive observation does not repair the missing negative snapshot.

Rollback this unit only: remove `C6_SQL_ERROR` branches/helper/new pure tests and
these P2 notes; retain normal C6 fail-fast flags and all unrelated WIP/history.

U5B exports the same official versioned fixture with the actual `/sessoes` screen. Two serial Edge tests check selected/global revocation, wrong-password preservation, modal password clearing, 360px layout and keyboard focus/submit, local-only cleanup after a real 204, offline pre-send containment and actual post-commit response loss without replay. SQL is read-only after disposable preparation. Startup is capped at 120s, official export at 180s, browser goals at 120s with one worker and zero retries. No native, BFCache, financial dashboard or stale-global A/B claim.

U5R selects only the second maintained case. Recovery requires a fresh real
`GET /auth/session` 200, the same owned SID and confirmed authority before explicit
navigation back to `/sessoes`; Root remount does not guarantee prior-route retention.
The bounded Node-side `expect.poll` awaits each asynchronous `page.evaluate`
observation (5s, 100ms intervals); async `waitForFunction` predicates must not be
used because the installed poll checks Promise truthiness before its result.
`node backendnest/test/session-harness/u5-poll.spec.cjs` checks this wrapper against
the installed Playwright matcher without launching a browser. Successful polls
retain their own complete matching safe observation object; a separate live read
cannot turn an intentional subsequent authority suspension into an earlier failed
confirmation. Explicit navigation requires another real 200 and owned list-route
observation. Lifecycle event names/timestamps are diagnostic, not a native-lifecycle
or BFCache acceptance claim.
The committed-response-loss phase forwards the real POST, checks owned caller and
remote SQL revocation after 204, then aborts only its browser response. A read-only
401 retry must clear local credentials without any second POST. Safe phase/frame,
HTTP status/transport and aggregate proxy observations persist on failure too;
no tokens, passwords, bodies, headers or raw capsules are recorded. Old failed
attempts remain historical failures, not retroactive passes.

| Boundary       | Evidence and limit                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preflight      | Reuses `prepareE2eDatabase` identity/reset guard without its general environment configurator. Checks live column names/types/nullability, PK/FK/CHECK metadata and legal/rejected constraint writes, resolved production policy/token/throttle functions, connection UTC and DB clock. Contract checks are **not scenario PASS**.                                                  |
| Time           | UTC is fixed before migrations/users/logins/backdating. Only freshly owned synthetic legacy `timestamp` fields are interpreted explicitly as UTC. SQL microsecond epochs and `BigInt` compare instants; raw field strings remain exact across restore. No unknown historical timezone is guessed. The earlier America/Sao_Paulo migration proof remains a separate historical case. |
| C6             | Four real HTTP logins verify HS256 issuer/signature, DB signer clock, policy 900/43200/v1 and legal refresh bounds before backdating. Actual dump/restore must preserve all four raw authority rows and typed microseconds. Real `GET /auth/session` must accept active/no-touch and deny idle-expired, absolute-expired and revoked without extending deadlines.                   |
| Restore schema | Strict column/default and constraint metadata equality. Does not pretend textual CHECK rendering proves semantic equivalence: C5's historical typed canonicalization proof is separate and is not rerun here.                                                                                                                                                                       |
| A8             | Actual RootLayout/LoginScreen/API/storage/logout, offline local logout, no automatic remote logout replay, then a **sequential** replacement login after reconnect. Asserts different SID/user, live SQL identity and retained SID after reload. Evidence is `replacementLoginAfterReconnectConfirmed`, never `bSurvived`. A simultaneous second context is **NOT RUN**.            |
| Browser        | One installed official Expo web export from the versioned fixture, clean environment/no dotenv, one Edge worker, zero retries, protected marker rather than financial UI. No visibility, BFCache or native lifecycle claim.                                                                                                                                                         |
| Bootstrap      | Untouched `test/u4-browser-bootstrap.ts`: real AppModule, parsers/CORS, helmet, validation and response interceptor; only loopback and owned IPC shutdown differ from production main. Frozen source hashes do not replace this parity check.                                                                                                                                       |
| Profiles       | This harness uses resolved default throttle **60/60000**. General Jest E2E `configureE2eEnvironment` uses **1000/60000**, a distinct test profile, not production-throttle proof. C7/C8 below is local observation, not production capacity.                                                                                                                                        |

## Bounded C7/C8 observations

- One combined invocation, one fresh backend, unchanged default guard. Six active users and three extra terminal sessions use nine real logins (separate 10/min bucket). GET /auth/session uses one shared localhost 60/min bucket: 20 authorized requests per profile, split equally across concurrency 2/5, plus six C7 terminal probes; total 46. Unexpected 401/429/500/network errors fail active coverage; terminal probes require the precise 401 reason.
- An independent physical SQL connection locks the target user or target session. Finite polling must observe real pg_stat_activity/pg_locks waits while requests are pending; C8 also requires unrelated accounts to complete before releasing the target. Locks release in finally, within 3 s, before the production 5 s lock timeout. No fixed sleep stands in for admission.
- Signed SID/sub joins the owned SQL row. Distinct fixture deadlines must match both response body and X-Session-State. The response contract contains no identity fields; no production headers are added. All active rows/deadlines/activity remain unchanged; idle/absolute/revoked pairs return 401 without renewal or revival.
- Goals cap 120 s; each profile cap 60 s; each HTTP request cap 12 s. p50/p95/p99 are nearest-rank descriptive values from small samples, not an SLO or capacity acceptance. No concurrent-login max-five pruning claim. C7 failure leaves C8 NOT RUN; no automatic fix/retry.

## Budgets and results

- Startup: explicitly 120 s for all three profiles, with IPC import/listening and HTTP health milestones. The earlier C6 attempt exhausted its 60 s readiness window before goals; its observed later startup does not identify a root cause. C6 goals: 180 s; each HTTP request: 12 s; dump/restore: 45 s each. A8 export: 180 s, browser global: 120 s (test: 90 s). One attempt, stop on failure.
- `candidate.json` freezes current source bytes; `runtime-proof.json` records operations and cleanup. `contract-proof.json` is preflight, `c6-proof.json` or `a8-proof.json` is scenario evidence. C7C8 writes `load-proof.json`, with independent case statuses, all request statuses/latencies and aggregate lock admission/progress samples. A8 also writes official export hashes and the actual Playwright report.
- Cleanup validates the owned postmaster PID/data path/loopback port before stopping that cluster, closes owned Nest/browser server, verifies ports free, frozen source unchanged and external service identity unchanged. Data/artifacts are preserved, never recursively deleted.
- A failed/unavailable runtime is not PASS. Do not edit and rerun a failed attempt automatically; inspect its evidence and decide a new bounded attempt explicitly.

Rollback boundary: remove `backendnest/test/session-harness/` and the two test-only `logout`/`capsule` methods plus import in `frontend/tests/browser/u4/entry.ts`. No production behavior is changed. Keep historical and new proof artifacts intact.

## Key Learnings:

## U5D: schema and synthetic restore controls

`node backendnest/test/session-harness/runner.cjs U5D` uses a fresh private PG18.3
cluster and three sole-owned marked databases. It exercises a manual read-only
0016/0017 gate, a 16-only negative control, all-17 source/destination schema/data
equality, populated shared quota preservation and actual repository authority.
No Nest/browser/old published release or live deployment is tested. See the
[operation guide](../../../docs/operacao/SESSOES_U5_DEPLOYMENT.md) for boundaries.
Focused checks: `node backendnest/test/session-harness/u5-deployment.spec.cjs`.
The coordinated U5D root requires the exact U5D binding and exclusive owner marker
from the handshaken runner; legacy roots remain strict, canonical and confined.
Pure entry-guard regressions stop before pg import. They do not renew historical
native evidence or close P3; a new native U5D attempt requires explicit approval.

## Key Learnings:

1. Type-aware SQL microsecond comparisons and raw restore equality answer different questions; both are necessary.
2. A preflight validates an actual contract, not presence of assertion text or a scenario result.
3. Sequential replacement-login evidence must not imply simultaneous offline containment.
