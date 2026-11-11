# U4: candidato local de expiração autoritativa

**Atualização mais recente C6/A8 — 2026-10-11: C6 PASS 4/4 fixtures e A8 PASS 1/1 caso browser, com revisão independente das fontes/provas e sem reexecução.** Implementação das cinco correções já concluída; verificação funcional agora concluída somente nesses casos. C7/C8 PASS local preservado. U3/U4, U5/U6 e etapa 2 seguem abertas, sem ativação ou aceite de produção. [Prova atual C6/A8 e limites](#c6a8--prova-funcional-delimitada-em-2026-10-11).

Os estados PENDENTE/ADIADA/FAILED e os orçamentos de startup abaixo preservam a cronologia anterior; não descrevem o resultado mais recente nem foram alterados retroativamente.

**Atualização C7/C8 — 2026-10-11: ambos PASS delimitado em uma única execução local, com revisão independente das fontes/provas, sem reexecução.** C6/A8 continuam com verificação funcional PENDENTE/ADIADA; implementação das cinco correções encerrada por aceite, não PASS. Capacidade produtiva e ativação U4/etapa 2 não aprovadas. [Prova atual e limites](#c7c8--prova-local-delimitada-em-2026-10-11). Os estados anteriores abaixo são registros históricos, preservados no alcance original.

**Correções da harness — 2026-10-11: implementação das cinco correções CONCLUÍDA, encerramento aceito pelo usuário; verificação funcional PENDENTE/ADIADA.** Não é PASS C6/A8 nem encerramento U4/etapa 2. [Aceitação e limites](#encerramento-aceito-da-implementação-da-harness--2026-10-11).

> **Status atual — 2026-10-11: JWT corrigido; integração com PASS qualificado.**
> Backend **223/223 em 22 suites, exit 0**, verificado independentemente;
> Edge real/Nest/PostgreSQL **6 PASS / 0 FAIL / 1 SKIP**, exit 0, oito logins HTTP 200.
> Readback independente do navegador, sem reexecução. Visibilidade/resume headless
> unsupported não passou. A tentativa headed posterior também não observou hidden;
> a sondagem de minimização real falhou no gate de visibilidade, sem novo caso integrado.
> Caso 6 continua pendente, causa desconhecida; não há bug de produto demonstrado.
> Política 900/43200 segundos, versão 1, preservada;
> fronteiras exercitadas por fixtures SQL backdated, não espera literal de 15 min/12 h.
> Frontend 166/166 e SQL 30/30 são provas históricas delimitadas, não reexecutadas.
> Lifecycle/BFCache/native, abas compartilhadas diretas, carga, legado populado/timezone,
> mixed-version/rollback e backup/restauração pendentes. **U4 não ativada/encerrada;
> U3, U5/U6 e etapa 2 abertas.**

**2026-10-10: implementado e verificado independentemente no alcance local;
não ativado nem encerrado.** Política aprovada: **15 minutos idle
/ 12 horas absolutas**, legado exige novo login. Backend 220/220 e frontend
166/166, exit 0. Correção única U4-R1 validada por inspeção e prova backend;
frontend conserva prova independente em bytes inalterados, sem nova execução.
PostgreSQL privado 18.3: **30/30 testes reais em 3 suites, exit 0**, com validação
independente por leitura das evidências, sem reexecução. Prova limitada a schemas
limpos; não demonstra migration de legado populado nem equivalência com produção.

Plano: [etapa 2](../planejamento/SEGURANCA_SESSOES_ETAPA_2.md).
Contexto: [pesquisa U4](../planejamento/SEGURANCA_SESSOES_ETAPA_2_U4_PESQUISA.md).

## Comportamento entregue

| Fronteira | Implementação / limite |
|---|---|
| Dados | Migration aditiva `0016_add_session_policy.sql`: instantes `timestamptz` de autenticação, absoluto, atividade e refresh; timeout/version e motivo terminal. Timestamp legado permanece histórico, não autoridade. Legado não recebe timers novos; revogação exige reentrada. Executada somente em schema limpo privado; não aplicada ao banco da aplicação. |
| Política | Defaults aprovados 900/43200 segundos, versão 1; configuração positiva, inteira, limitada, idle ≤ absoluto e versão conhecida. Política persistida no login; configuração não amplia sessão existente. Valores privados efetivos não inspecionados. |
| Autoridade | Usuário → sessão(s) explicitamente bloqueada(s) → relógio DB → decisão/check/touch/rotação na mesma transação. Igualdade nega. Touch zero linhas não autentica; expiração terminal persiste antes da exceção HTTP. Falhas de DB/lock são 5xx sanitizadas, não 401 fabricado. |
| Login | Hash esperado revalidado sob lock; poda conta somente sessões válidas, ordenadas por autenticação/ID. Limite configurado mantido, default 5; emissão dentro da transação, publicação após commit. |
| Refresh | Hash divergente válido revoga atomicamente e registra reuse; expiração normal não acusa replay. Não altera atividade/absoluto nem amplia deadline de refresh. JWT usa `iat` do DB e `exp` conservador, nunca maior que deadline absoluto/refresh aplicável. |
| Credenciais | Troca autenticada revalida idle/absolute depois de locks de sessões e links, antes de senha/links/revogação/outbox, no mesmo manager. Recuperação pública mantém consumo único e efeitos atômicos. Guard financeiro é admissão, não transação do handler inteiro. |
| HTTP | `GET /auth/session` fornece relógio/deadlines/version, owner/sid do JWT, sem touch e `Cache-Control: no-store`. Header não secreto `X-Session-State` atualiza UX; CORS expõe esse header sem ampliar origens. |
| Cliente | Startup/resume/BFCache oculta Stack protegido até confirmação do servidor. Indisponibilidade conserva cápsula e oferece retry explícito. Aviso de até 60 s é informativo, sem heartbeat; timer apenas oculta/revalida, nunca autoriza offline nem apaga credenciais sem prova terminal. |
| Replay/fences | Códigos terminais não provocam refresh e afetam somente snapshot atual. Mutação com 401 genérico não é reaplicada. Só `AUTH_ACCESS_TOKEN_EXPIRED`, emitido pelo Passport antes do handler, permite retry coordenado; resposta A não autoriza/apaga B. Política U3 de refresh desconhecido sem retry cego preservada. |

### Atividade elegível: lista conservadora do servidor

Todas as consultas GET, inclusive consultas financeiras interativas, são **no-touch**:
a mesma rota pode servir polling/prefetch. Não se promete distinguir intenção humana
de tráfego. Nenhum header de intenção ou timestamp cliente é aceito.

A allowlist em `backendnest/src/auth/session-activity.ts` aceita POST de criação de
categorias/contas/dívidas/metas/orçamentos/pagos/transações/transferências/planejamentos/
alertas; alocações de orçamento e participantes/gastos/sincronização de planejamento;
PATCH de edição/desativação suportadas, perfil próprio e estados/acertos/gastos de
planejamento; DELETE de transações/transferências/pagos/alocações/participantes.
Rota desconhecida, auth/refresh/logout/credenciais e notificação automática não renovam.
Touch mede admissão autenticada, não garantia do efeito/2xx final. Ler ou digitar sem
operação elegível pode expirar, conforme aprovado.

## Provas locais e histórico preservado

Evidências em `.tmp/stage2-u4/`; comandos completos no início dos logs.

| Comando / evidência | Resultado histórico anterior à correção JWT |
|---|---|
| Backend RED: policy/repository/JWT, `backend-red.log` | Exit 1: módulo policy ausente; 1 suite falha, 2 passam, 8 testes existentes passam. |
| Frontend RED: `session-authority.test.ts`, `frontend-red.log` | Exit 1: módulo de autoridade ausente; 1 suite falha. |
| Backend `npm test -- --runInBand --testPathPatterns='(auth/\|config/http-runtime.config.spec.ts)'`, `backend-final-epoch.log` | **220/220, 22 suites, exit 0.** Credenciais/outbox, JWT real, Passport/HTTP real sem DB e classifier. |
| Frontend 15 suites U3 + `session-authority.test.ts` e `session-authority-root.test.tsx`, `frontend-final-epoch.log` | **166/166, 17 suites, exit 0.** RootLayout realmente renderizado; startup, indisponibilidade, resume, aviso, A atrasada, 401 terminal separado e replay. Avisos React `act` de consumidores existentes preservados. |
| Frontend `npm run typecheck`, `frontend-types-final-epoch.log` | Exit 0, sem diagnóstico. |
| Backend `tsc --noEmit --project tsconfig.build.json`, `backend-source-types-final-epoch.log` | Exit 0; produção compila sem emitir/build/DB. |
| Backend `tsc --noEmit`, `backend-types-final-epoch.log` | Exit histórico 1; último writer da correção JWT exit **2**, somente TS2352 preexistente em `src/orcamentos/repositories/orcamento.repository.spec.ts:35`. Hash inicial/atual `e51b53d6832ac565ceca83d53c317ec8d944fb28bed06f729841852fa4249dc3`; não editado. Não é PASS global. |
| Normalização/readback | Prettier convergente no escopo próprio antes dos checks consolidados. Nessa etapa local anterior, SQL/Markdown foram conferidos estruturalmente; a execução SQL privada posterior está registrada abaixo. |

Iterações intermediárias permanecem nos logs. Spy anterior ao bootstrap Nest perdeu
metadata e causou 404 da harness; metadata preservada no teste antes do GREEN.
Fixture temporal foi corrigida por atividade anterior à autenticação; a race de
mutação agora modela expiração explícita pré-handler, pois 401 genérico não permite replay.

### Validação independente e correção única U4-R1

[Revisão inicial](../../.tmp/stage2-u4/independent-verification.json) confirmou
220/220 backend, 166/166 frontend e types locais sobre os 36 hashes congelados.
Identificou uma lacuna de shape do CHECK: `policy_version = 1` com versão NULL
podia produzir UNKNOWN, aceito pelo PostgreSQL. O guard já rejeitava NULL;
**não foi demonstrado bypass de autenticação**.

U4-R1 adiciona `policy_version IS NOT NULL` ao ramo ativo da migration 0016 e um
caso negativo na suite PostgreSQL existente: linha ativa válida e completa tenta
UPDATE para versão NULL, deve receber constraint `23514` e permanecer inalterada.
Só dois arquivos mudaram, 25 linhas; os outros 34 hashes ficaram iguais.
Na validação inicial de U4-R1 o caso SQL ainda não havia sido executado; Jest
unitário não o substitui. O caso passou posteriormente na matriz real descrita abaixo.

[Validação delimitada da correção](../../.tmp/stage2-u4/correction-independent-verification.json)
confirmou o ramo corrigido por inspeção, 220/220 em 22 suites backend e types de
produção, exit 0. Frontend 166/166 em 17 suites e types exit 0 são evidência
independente retida sobre bytes inalterados; não houve rerun frontend para U4-R1.
Não restam achados delimitados nessa validação; isso não resolve os gates reais.
Manifestos original/corrigido e relatórios foram preservados, sem reescrever provas.

### Tentativa PostgreSQL isolada: bloqueio e cleanup (histórico)

[Evidência de runtime](../../.tmp/stage2-u4-pg/runtime-proof.json): tentativa inicial
retornou `EPERM` antes de criar filho. Na tentativa revisada, `initdb` terminou
com exit 0 e PostgreSQL **18.3** iniciou na porta própria **55434**. A captura de
`pg_ctl` retornou `ETIMEDOUT` após 60 segundos. Essa observação não estabelece
a causa do timeout nem comprova migrations ou a autoridade de sessões.

A execução parou antes de identidade/confinamento do banco, bootstrap, SQL,
migrations, Jest e barreiras. Cleanup incondicional: stop exit 0, PID próprio
**22380**, pidfile e listener ausentes confirmados. Não houve nova tentativa
neste fechamento documental. Banco da aplicação `gestao_financeira` não foi
tocado; nenhum envio Resend, instalação, commit ou deploy foi realizado.


### U4: startup isolado comprovado em 2026-10-10 (histórico)

**Subgate de startup resolvido; U4, U3 e etapa 2 permanecem abertas.** Uma única
execução autorizada teve `initdb` exit 0; `pg_ctl start` exit 0/erro nulo em
**338 ms**, stdout/stderr em arquivos, stdin ignorado e `-w -t 30`. SELECT de
identidade exit 0 confirmou PostgreSQL **18.3**, diretório privado novo
`C:\dev\meu-sistema-financeiro\.tmp\stage2-u4-pg-startup-20261010-bounded1\data`,
`127.0.0.1:55434`, banco `postgres` e usuário `finance_e2e_bootstrap`. Stop
incondicional exit 0; PID próprio **7320**, pidfile e listener ausentes.

Ver [prova delimitada](../../.tmp/stage2-u4-pg-startup-20261010-bounded1/runtime-proof.json),
[readback independente estrutural/de segurança, sem rerun](../../.tmp/stage2-u4-pg-startup-20261010-bounded1/independent-readback.json)
e [harness nova ignorada](../../.tmp/stage2-u4-pg-startup-20261010-bounded1/startup-probe.cjs).
O readback confirmou hashes da harness/prova, 33 arquivos de produto, 3 documentos
do fechamento anterior e artefatos protegidos. Logs/dados e provas históricas
foram preservados.

A captura em arquivos funcionou neste experimento; **pipes herdados continuam
hipótese não comprovada como causa**. EPERM e ETIMEDOUT anteriores são histórico,
não resultado atual. Bootstrap da aplicação, migrations, suites reais SQL/Jest e
barreiras de concorrência não foram executados nessa etapa. A execução posterior
autorizada está registrada abaixo.
Produção e banco atual da aplicação não foram tocados; sem Resend, commit ou
deploy. O fechamento atual é apenas documental, sem runtime ou normalizadores.

### PostgreSQL real: matriz delimitada concluída em 2026-10-10

**30/30 testes, 3/3 suites, exit 0**, sem skips/pending/todo: sessões U4 **7/7**,
credenciais **9/9** e outbox **14/14**. Ver
[prova de runtime](../../.tmp/stage2-u4-pg-sql-20261010-bounded2/runtime-proof.json)
e [validação independente das evidências](../../.tmp/stage2-u4-pg-sql-20261010-bounded2/independent-verification.json).
A validação foi somente readback; **não reexecutou PostgreSQL nem Jest**.

Initdb, start, identidade, bootstrap, confinamento, E2E, readback de schema e stop:
oito operações com exit 0 e erro nulo. Os **16 SQLs completos** foram observados
três vezes, após reset de schema por suite. O readback confirmou sete condições:
pgcrypto, tabelas, constraint validada, exclusão de versão NULL, timestamps de
política `timestamptz`, deadlines válidos e UTC. Isso prova **schema limpo privado**,
não backfill/invalidação de legado previamente populado com timezone desconhecido,
compatibilidade de writers antigos ou configuração equivalente à produção.

A execução anterior **28/30, exit 1** permanece preservada com sua
[diagnose independente](../../.tmp/stage2-u4-pg-sql-20261010-bounded1/assertion-diagnosis.json).
Apenas duas expectativas de testes foram alinhadas, seis linhas: sessão revogada
retorna `AUTH_SESSION_REVOKED`; a ordem exata registra três pares de locks antes
do relógio. O stale hash continua `AUTH_INVALID_SESSION`. A nova execução também
comprovou os pós-estados estritos: nenhum outbox para a sessão revogada e senha
inalterada após expiração do link durante a espera pelo lock.

PostgreSQL **18.3** privado na porta própria **55434**; UTC foi confirmado somente
nesse ambiente. Stop exit 0; PID próprio **15216**, pidfile e listener ausentes
registrados no cleanup. EPERM/timeout anteriores são histórico, não bloqueio atual.
O banco `gestao_financeira` não foi tocado; sem Resend, instalação, commit ou deploy.
Os 33 arquivos não documentais congelados permanecem inalterados neste fechamento.

## Integração real de navegador em 2026-10-11: falha histórica no login

**Resultado histórico: bloqueador confirmado no login; nenhuma aprovação comportamental nessa tentativa.** A correção e a retomada autorizadas posteriores estão registradas abaixo; não apagam o 0/7. Nessa etapa não houve reparo de produto, nova tentativa, migration no banco da aplicação, Resend, instalação, commit ou deploy.

| Evidência histórica | Resultado e limite |
| --- | --- |
| Execução de navegador | Uma invocação real Edge: **0/7 aprovados, 7/7 falhos**, sem skips ou flaky, **82,285 s**, workers=1, retries=0. Todos os casos pararam na expectativa de conteúdo protegido após login. |
| Fluxo real | PostgreSQL 18.3 privado, role confinada, 16 migrations e oito usuários sintéticos com bcrypt; Nest/AppModule e configuração JWT reais, sem override de provider. Proxy registrou sete POSTs de login. |
| Interface | Expo Router, RootLayout e LoginScreen de produção; dashboard de teste somente com marcador protegido. Não é prova de toda a interface financeira. |
| Bootstrap | Configuração equivalente ao main de produção: bodyParser=false, parsers, helmet, CORS, ValidationPipe e ResponseInterceptor. Entrada exclusiva de teste acrescenta binding 127.0.0.1, prontidão e desligamento próprios; não executa literalmente main.ts. |
| Política | Defaults 900 s / 43200 s / versão 1 preservados. As asserções desses limites, lifecycle, BroadcastChannel, A/B atrasado e não replay **não foram alcançadas**; o plano de backdating não se tornou prova. |
| Compilação | Backend de produção e frontend no-emit com exit 0; export Expo oficial offline com dotenv desativado e exit 0. Artefatos da primeira preparação foram reutilizados somente para leitura na execução revisada, sem repetir build/typecheck. |
| SQL anterior | **30/30 permanece PASS no alcance delimitado** de repositórios/credenciais/outbox em schema privado limpo. Não equivale ao fluxo integrado de emissão/login, nem elimina o bloqueador atual. |

### Causa confirmada e evidência HTTP

Em backendnest/src/auth/auth.service.ts:476–490, signCappedToken assina inicialmente o refresh de 30 dias, limita seu exp ao absoluto de 12 horas e remove expiresIn das opções da segunda assinatura. O JwtModule de produção mantém signOptions.expiresIn=15m. O merge das opções no JwtService instalado repõe esse default quando a chave é omitida; jsonwebtoken rejeita o payload com exp explícito e a opção expiresIn simultânea:

> Bad "options.expiresIn" option the payload already has an "exp" property.

Uma única reprodução em memória, após cleanup, com as versões instaladas confirmou esse erro. A tentativa explícita expiresIn: undefined também falhou na validação da biblioteca, portanto **não é correção válida**. O erro é encapsulado por credentialTransaction como InternalServerAppException; os sete registros do backend e o mapeamento real de exceção/filter corroboram HTTP 500. **O status bruto individual das respostas HTTP não foi retido no relatório do navegador**: o relatório registra as falhas da expectativa de renderização, não uma captura de wire status por requisição.

Referências: [reprodução instalada e hashes](../../.tmp/stage2-u4-browser-20261011-bounded2/jwt-capping-reproduction.json), [validação independente somente de leitura](../../.tmp/stage2-u4-browser-20261011-bounded2/independent-verification.json), [relatório completo do navegador](../../.tmp/stage2-u4-browser-20261011-bounded2/browser-report.json), [runtime e contagem do proxy](../../.tmp/stage2-u4-browser-20261011-bounded2/runtime-proof.json) e [exceções do backend](../../.tmp/stage2-u4-browser-20261011-bounded2/backend.stderr.log).

### Histórico, integridade e encerramento

A primeira tentativa, no sandbox padrão, teve initdb exit 0 e pg_ctl exit 1 por token restrito, código 87; nenhum navegador foi executado nessa tentativa. Seu [runtime](../../.tmp/stage2-u4-browser-20261011-bounded1/runtime-proof.json), logs e diretório de dados foram preservados. A recuperação autorizada usou diretório novo bounded2 e execução revisada fora do sandbox, sem alterar ACLs, serviços ou credenciais da aplicação. As únicas diferenças dos clones ignorados foram roteamento do diretório da tentativa/configuração de relatórios e leitura do dist já exportado; ver [prova de roteamento](../../.tmp/stage2-u4-browser-20261011-bounded2/routing-proof.json).

Antes da execução, uma expansão de baseline PowerShell serializou os 61 registros originais em um wrapper value/Count. A recuperação exclusivamente de artefato preservou os bytes malformados e explicitou o mapeamento para 209 registros válidos; não transformou retroativamente o pós-check falho em PASS nem repetiu builds. Ver [mapeamento da recuperação](../../.tmp/stage2-u4-browser-20261011-bounded1/baseline-recovery.json) e [readback dos builds reutilizados](../../.tmp/stage2-u4-browser-20261011-bounded2/build-proof.json).

A execução/validação preservou 2209 hashes protegidos, incluindo o histórico de 209 registros, todos os arquivos existentes da primeira tentativa e os 13 novos arquivos congelados. Os 33 arquivos não documentais U4 e os três documentos do fechamento anterior estavam intactos antes desta atualização. Este fechamento muda somente o plano e este resultado; a pesquisa permanece inalterada. O [manifesto de fechamento documental](../../.tmp/stage2-u4-browser-20261011-bounded2/documentary-closure.json) registra UTF-8 estrito, hashes antes/depois e readback estrutural, sem runtime adicional.

O afterAll da spec congelada escreveu case-evidence.json novamente quando o Playwright substituiu workers após as falhas. Esse artefato contém somente o confinamento do último worker e **não é evidência agregada dos sete casos**. O relatório completo, a contagem do proxy e os logs do backend são as fontes autoritativas; workers 0–6 foram sequenciais, com retries=0.

Backend, servidor web e PostgreSQL próprios foram encerrados; nove PIDs conhecidos foram observados ausentes e as portas 4178/4318/55434 livres no encerramento. **Não houve captura individual dos PIDs Edge**, nem prova de ausência individual desses subprocessos. O readback independente confirmou registros e fontes salvas, sem iniciar serviços ou repetir testes. Os gates de navegador comportamental, lifecycle/native, legado, rollout e carga continuam abertos.

## Retomada integrada em 2026-10-11: PASS qualificado

**Bloqueador de login corrigido; 6 PASS / 0 FAIL / 1 SKIP, exit 0.** Uma invocação
Edge real, worker 1, retries 0, **13,659 s**. O
[readback independente final](../../.tmp/stage2-u4-browser-20261011-bounded4/independent-verification.json)
confirmou as evidências salvas; **não reexecutou navegador, Nest ou PostgreSQL**.
Ver [runtime](../../.tmp/stage2-u4-browser-20261011-bounded4/runtime-proof.json) e
[relatório do navegador](../../.tmp/stage2-u4-browser-20261011-bounded4/browser-report.json).

### Correção específica JWT e provas locais atuais

O helper compartilhado re-assina o payload original sem `exp` explícito, com
`expiresIn` numérico igual ao cap menos o `iat` derivado do relógio DB. Mantém
opções, secrets, claims, configuração e checks de deadline; não altera defaults
do módulo nem usa `undefined` ou API privada. Só service e spec de JWT mudaram.
O JwtService real configurado com default 15m reproduziu o RED anterior:
**3 falhos / 4 aprovados / 7 testes, exit 1**, pelo conflito confirmado.
Depois da correção, prova independente **223/223 em 22 suites, exit 0** e types
de produção exit 0; [validação JWT](../../.tmp/stage2-u4-jwt-cap-20261011/independent-verification.json).
Frontend 166/166 é histórico em bytes de produção inalterados, sem rerun unitário;
types da harness frontend atual exit 0. Backend global conserva TS2352 preexistente
em `orcamento.repository.spec.ts:35`; último writer exit 2, **não é global clean**.

### O que a matriz real demonstrou

| Caso | Resultado / alcance real |
| --- | --- |
| 1 | PASS: GET/polling e refresh HTTP 200 não alteram atividade SQL; absoluto imutável. |
| 2 | PASS: PATCH próprio HTTP 200 persiste nome, avança atividade e mantém absoluto; metadata cliente corresponde. |
| 3 | PASS: fronteira idle backdated, HTTP 401 `AUTH_SESSION_IDLE_EXPIRED`, SQL revogado/terminal, conteúdo protegido oculto e URL de login assertada. |
| 4 | PASS: absoluto backdated com atividade recente, HTTP 401 `AUTH_SESSION_ABSOLUTE_EXPIRED`, SQL revogado/terminal e protegido oculto. Não há asserção explícita de URL nesse caso. |
| 5 | PASS: 401 real de A retido até login B; resposta atrasada não revoga B nem oculta seu conteúdo protegido. |
| 6 | UNSUPPORTED/SKIP: troca real de aba headless manteve `document.hidden=false`; nenhum evento sintético substitui a prova de suspend/resume. |
| 7 | PASS com falha cliente injetada: backend PATCH 200 com commit único; somente resposta ao cliente substituída por 401 genérico. Delta de requests 1, refresh 0, cliente indisponível e protegido oculto. Não é 401 genérico originado pelo backend. |

Foram capturados **oito logins HTTP 200**, três 401 terminais de sessão, dois PATCHs
200 e um refresh 200. O JWT ainda futuro foi assertado contra `Date.now()` do
navegador, **não diretamente contra o relógio servidor**; códigos exatos do servidor
e estados SQL corroboram a rejeição autoritativa da sessão, não expiração do JWT.

Fixtures temporais usam um único anchor DB MATERIALIZED por UPDATE; mantêm
`refresh <= absolute`, `activity < absolute`, span absoluto de 12 h, idle 900 e
versão 1. Não houve encurtamento de política, relógio falso ou mudança da lógica
de produção. Isso exercita fronteiras por backdating, **não espera natural de
15 minutos/12 horas**. A preparação executou as 16 migrations no banco privado
limpo; a matriz SQL 30/30 anterior não foi reexecutada. Nenhuma prova de legado
populado/timezone histórico, backup/restauração ou rollout decorre desse preparo.

Expo Router/RootLayout/LoginScreen são reais, com dashboard mínimo de teste,
não toda a UI financeira. Nest usa AppModule e providers JWT configurados reais,
sem overrides; bootstrap de teste preserva parsers/helmet/CORS/pipe/interceptor,
acrescentando somente loopback e shutdown próprios. Dist do export Expo oficial
anterior foi reutilizado com integridade verificada, não exportado novamente.
O proxy same-origin não prova CORS de browser entre origens diferentes.

### Histórico preservado, integridade e cleanup

O 0/7 anterior e o [parcial 4 PASS / 2 FAIL / 1 SKIP](../../.tmp/stage2-u4-browser-20261011-bounded3/browser-report.json)
por fixtures inválidas permanecem históricos, não resultado atual. A retomada
ajustou somente os dois UPDATEs de fixtures e o diretório de evidência, mantendo
assertions/awaits/fault semantics; [sanity delimitada](../../.tmp/stage2-u4-browser-20261011-bounded4/harness-sanity.json).
A recuperação do wrapper JSON e a sobrescrita histórica do afterAll documentadas
acima não foram convertidas retroativamente em PASS. O manifesto JWT também
registra que o lookup específico da spec ocorreu após sua edição inicial; impactos
do símbolo de produção precederam a edição. A caveat de ordem permanece explícita.

O congelamento atual fixa **49 arquivos**, incluindo os dois hashes JWT corrigidos
e a spec browser de fixtures legais, além de dois clones ignorados. Foram
preservados **6041 hashes protegidos** na execução/readback. Este fechamento altera
somente três documentos; fontes, testes, 16 SQLs, clones e provas permanecem intactos.
Ver [source freeze](../../.tmp/stage2-u4-browser-20261011-bounded4/source-freeze.json)
e [fechamento documental](../../.tmp/stage2-u4-browser-20261011-bounded4/documentary-closure.json).

Cleanup: PG stop exit 0, nove PIDs conhecidos ausentes, portas 4178/4318/55434
livres registrados. **Não há prova individual de PIDs Edge**. Nenhuma migration
no banco da aplicação, Resend, instalação, commit ou deploy. Não houve runtime,
normalizador ou nova tentativa neste fechamento documental.

## Caso 6 visível: capacidade não demonstrada, gate pendente

Uma única execução **headed real** do caso 6 teve **0 PASS / 0 FAIL / 1 SKIP**,
**13,642 s**. CLI/config estavam headed, mas `document.hidden` permaneceu false
após `bringToFront`, com eventos passivos vazios; as asserções de confirmação/
renderização após resume não foram alcançadas. O texto herdado do motivo do skip
usava “Headless”: **é enganoso para essa execução**, não sua configuração real.
Ver [handoff visible1](../../.tmp/stage2-u4-browser-20261011-visible1/final-handoff.json).
Os 49 arquivos e 7475 hashes protegidos ficaram estáveis. Nest/web/PG próprios
foram encerrados: nove PIDs conhecidos ausentes, portas livres e PG stop 0,
sem prova individual de ausência dos PIDs Edge.

A sondagem seguinte foi **somente Edge headed novo com duas páginas em branco**,
sem PostgreSQL ou Nest. CDP retornou o mesmo window ID próprio **954111052** para
ambas; bounds iniciais normal e posteriores minimized foram medidos. A minimização
genuína não satisfez `document.hidden && document.visibilityState === 'hidden'`
em **10 s**; duração total **11,303 s**, exit **1**. Nenhum par trusted hidden/visible
foi comprovado. Ver [capability proof](../../.tmp/stage2-u4-browser-20261011-visible2/capability-proof.json)
e [readback independente](../../.tmp/stage2-u4-browser-20261011-visible2/independent-verification.json),
sem reexecução. **Estado minimized da janela não é evidência de visibilidade DOM.**

O comando de retorno a normal foi aceito e o fechamento do contexto/browser
próprios resolveu. Não foram retidos snapshots DOM/eventos após minimizar nem
readback de bounds normal: **não se afirma restauração normal verificada** ou
ausência individual de PIDs Edge. A causa permanece **UNKNOWN**; indisponibilidade
dessa capacidade não diagnostica defeito de produto nem impossibilidade universal
de lifecycle. Não houve eventos sintéticos, override de visibilidade/Emulation,
mudança de flags, retry ou uso de perfil/browser do usuário.

O gate falhou e a continuação parou: **zero execuções integradas do caso 6 após
a sondagem**. Readback confirmou 49 arquivos atuais, 8905 hashes protegidos e
cinco hashes declarados de prova; fontes JWT corrigidas, clones e histórico intactos.
Este fechamento modifica somente plano e resultado;
[manifesto documental](../../.tmp/stage2-u4-browser-20261011-visible2/documentary-closure.json).

Os seis PASS anteriores continuam prova separada, **não 7/7 nem ativação/encerramento
global U4**. Caso 6, BFCache/native/abas compartilhadas diretas, carga, legado
populado/timezone, rollout mixed-version/rollback e backup/restauração permanecem
pendentes. Próxima prova prática requer ambiente interativo/manual ou dispositivo
capaz de transições genuínas, preparado e autorizado separadamente; nunca o banco
atual da aplicação. Não se promete que flags resolverão a limitação. Nenhum novo
runtime, guia manual, normalizador, mudança de produto, instalação, Resend,
commit ou deploy foi feito neste fechamento.

## Escopo e rollback

Baseline em `.tmp/stage2-u4/baseline.json`: hashes de 978 arquivos acessíveis não
secretos e cópias dos existentes no escopo, não de HEAD. 31 hashes históricos de
produto U3 conferidos antes da escrita. U4 altera explicitamente API/RootLayout e
testes API/races; os outros 27 permanecem no baseline. `final.json` registra hashes
finais e drift. Duas pastas não relacionadas negaram enumeração; a prova não cobre
seu interior. `.env`/segredos não foram inspecionados.

Rollback local usa os bytes dessa baseline, preservando WIP anterior. Não voltar
produção para writer que ignore U4: manter schema/revogações, usar versão compatível
ou suspender endpoints. Drenar writers antigos antes de migration/código; constraint
não torna guard antigo compatível. Nenhuma migration foi aplicada ao banco da
aplicação nem sessão de produção invalidada. As migrations foram executadas apenas
nos schemas limpos do PostgreSQL privado descartável.

## Gates ainda abertos

- **Legado e operação:** a matriz PostgreSQL real passou nos casos delimitados de
  barreiras, relógio após espera, rotação/no-touch, terminalidade, poda, credenciais
  e outbox. Schema limpo não prova migration de legado populado com timezone
  histórico ambíguo, rollback de implantação ou restauração de backup.
- Execução futura exige DB/role `finance_e2e_*`, confirmação explícita,
  identidade/marker/confinamento e forecast. Helper recria schema: **nunca usar
  `gestao_financeira` ou credenciais do app**.
- Validação independente local e U4-R1 realizadas; PostgreSQL real 30/30 com
  readback independente concluído no alcance delimitado, sem aprovação de ativação.
- Browser U4 integrado passou seis casos delimitados; visibilidade/resume real
  não demonstrado também na tentativa headed e na sondagem de janela minimizada.
  BFCache, native físico e BroadcastChannel entre abas
  compartilhadas diretas permanecem pendentes. U3 CORE 5/5 é histórico, não novo PASS U4.
- Mixed-version, backup/restauração, migration/rollout e custo de lock/update em
  carga exigem prova/autorização. Check online serializa tráfego por conta; sem
  cache, Redis ou tolerância de touch.
- U5, U6 e etapa 2 abertas. Resend real adiado; sem cookie/Argon2/MFA, heartbeat,
  persistência automática de drafts, dependências novas, commit ou deploy.

## Key Learnings:

1. Clock depois do usuário ainda é cedo se sessão/links podem bloquear; recheck de
   credenciais espera todos os locks relevantes.
2. JWT capado/metadata não substituem DB online; absoluto imutável e refresh sem
   atividade humana são autoridades distintas.
3. 401 genérico de mutação não prova rejeição antes do efeito; replay exige contrato
   explícito pré-handler e snapshot atual.

### Readback dos lotes pendentes em 2026-10-11 — fechamento documental parcial

**B: 5 PASS / 0 FAIL; A: 1 PASS / 1 falha de harness / 7 NOT RUN; C: NOT RUN. U3, U4, U5/U6 e etapa 2 permanecem abertas.** Registro das provas existentes, sem reexecução ou encerramento global.

- **B (B1–B5):** b1-runtime-proof.json registra browser exit 0 e cleanup completo; b1-browser-report.json confirma 5 esperados, zero inesperados/skipped/flaky. case-evidence.json cobre fallback sem BroadcastChannel, ausência de Web Locks, lock real de aba irmã (7011 ms), falha explícita do marcador e owner fechado após commit SQL com refreshOutcomeUnknown. Não é aprovação de toda a matriz.
- **A (resume2):** browser exit 1; A1 comprovou logout remoto confirmado, marcador durável e revogação SQL. O caso seguinte falhou na harness por SELECT user_id FROM auth_session; a coluna real é usuario_id (backendnest/src/auth/entities/auth-session.entity.ts). Sete casos restantes não rodaram. Não é bug de produto demonstrado.
- **C:** somente preparação em batch-c, sem prova de runtime.
- **Integridade:** 76 registros de batch-b/baseline.json e seis arquivos congelados em b1-runtime-proof.json conferidos sem divergência antes desta escrita. Listeners 4318, 4178 e 55434 ausentes no readback; runtime B também registra backend/web encerrados e PostgreSQL parado.
- **Limites:** RootLayout/LoginScreen reais com tela protegida de fixture, não UI financeira; fronteiras SQL backdated, não espera literal de 15 min/12 h; bootstrap de teste com paridade, não main de produção literal; 401 pós-commit injetado no transporte. BFCache, lifecycle/visibilidade genuínos, native físico, carga, legado/timezone, mixed-version/rollback e backup/restauração sem nova aprovação.

Evidências: [runtime B](../../.tmp/stage2-pending-20261011/batch-b/b1-runtime-proof.json), [browser B](../../.tmp/stage2-pending-20261011/batch-b/b1-browser-report.json), [casos B](../../.tmp/stage2-pending-20261011/batch-b/case-evidence.json), [runtime A](../../.tmp/stage2-pending-20261011/batch-a/resume2-runtime-proof.json), [browser A](../../.tmp/stage2-pending-20261011/batch-a/resume2-browser-report.json) e [caso A1](../../.tmp/stage2-pending-20261011/batch-a/resume2-case-evidence.json).

**Próximo passo:** corrigir a coluna somente na harness A e executar pendências A/C com autorização e orçamento próprios; gates reais restantes continuam separados. Fechamento somente documental, sem fonte/dependência alterada, runtime, banco atual, override de visibilidade, Resend, commit ou deploy. Provas históricas/WIP preservados.
### Prova adicional A/C em 2026-10-11 — fechamento documental delimitado

**A1–A9 possuem PASS delimitado em execuções separadas; B1–B5: 5 PASS; C: 4 PASS / 1 FAIL / 3 NOT RUN. U3, U4, U5/U6 e etapa 2 permanecem abertas, sem autorização de ativação.** O histórico acima é preservado; a antiga falha de coluna da harness A não é a pendência atual.

- **A:** A1 já possuía prova; A2 posterior passou com reload pela raiz. A3–A9 passaram uma vez: 7 PASS / 0 FAIL / 0 skipped/flaky, browser exit 0, 147,609 s no relatório. Não são nove casos da mesma execução. A6 com JWT expirado recebeu logout 401, remoto não confirmado e SQL `revoked=false`: PASS somente de saída local compartilhada durável/sem ressurreição, NÃO de revogação no servidor. A8 comprovou B após reconexão na mesma página, não contenção remota simultânea em contexto separado. Não houve typecheck global no lote A.
- **C1/C2 PASS:** legado sintético populado em UTC e America/Sao_Paulo; cinco linhas por caso, histórico preservado, quatro sessões legadas invalidadas e inserção nula verificada. Não comprova timezone histórico da produção.
- **C3/C4 PASS:** HTTP real 401 para JWT legado assinado válido; writer legado rejeitado com SQLSTATE 23514. Isso não prova rollback de binários publicados mixed-version.
- **C5 FAIL:** dump/restauração PG18 concluíram sem erro de comando, mas o hash canônico divergiu (antes b27c103c…; depois 01f85299…). Contagens de linhas e 35 FKs coincidem; equivalência de conteúdo/schema NÃO foi comprovada. C6 (deadlines restaurados), C7/C8 (carga/latências) NÃO RODARAM após essa falha; não há capacidade produtiva aceita.
- **Diagnóstico C5:** confiança alta no mismatch, causa UNKNOWN. A harness ordena tabelas/linhas/constraints/índices e fixa UTC na sessão; inclui schema, defaults e JSON das linhas na assinatura. Não retém os componentes canônicos antes/depois, somente hash/contagens na comparação de erro. Ordem de atributos reconstruídos, representação/metadados e timezone de outras conexões são hipóteses não comprovadas, não defeito de produto atribuído. Readback offline não justifica rerun, reparo ou restauração nova.
- **Integridade/cleanup:** readback independente conferiu 3649 registros protegidos (incluindo duplicatas de baselines), hashes declarados das provas e 21 entradas congeladas A/C sem divergência antes da escrita; fontes preservadas após ela. A registra backend/web encerrados, PG parado e portas livres; C registra backend encerrado, PG parado e portas livres. Snapshots externos C antes/depois têm hashes idênticos; serviço externo/5432 preservados na prova. Nenhum novo runtime foi executado neste fechamento.

Evidências: [readback A](../../.tmp/stage2-pending-20261011/remaining-a/readback.json), [runtime A](../../.tmp/stage2-pending-20261011/remaining-a/remaining-runtime-proof.json), [casos A](../../.tmp/stage2-pending-20261011/remaining-a/remaining-case-evidence.json), [resultado C](../../.tmp/stage2-pending-20261011/batch-c-ready/result.json), [migration C](../../.tmp/stage2-pending-20261011/batch-c-ready/migration-proof.json), [goals C](../../.tmp/stage2-pending-20261011/batch-c-ready/goals-proof.json) e [readback documental independente](../../.tmp/stage2-pending-20261011/remaining-independent-readback/final.json).

**Pendências reais:** investigar C5 preservando componentes completos com autorização separada; só depois executar C6–C8 com orçamento próprio. Visibilidade/lifecycle genuínos, BFCache e native físico continuam DEFERRED, não PASS. Backup/restauração de produção, timezone legado real, mixed deployment/rollback e U5 continuam abertos. Nenhum banco atual, serviço externo, fonte, dependência, Resend, commit ou deploy foi alterado; provas históricas/WIP preservados.
### C5 em 2026-10-11 - prova delimitada mais recente

**C1-C5: PASS delimitado em provas separadas. C6-C8: NOT RUN. U4 e etapa 2 abertas, sem autorização de ativação.** Falhas anteriores preservadas, nunca convertidas retroativamente em PASS.

- **C5 PASS:** dump/restauro PostgreSQL 18.3 privado descartável; 20 tabelas, 30 linhas, 35 FKs. Diff bruto: uma diferença, somente a forma textual do CHECK `public.password_changed_outbox.password_changed_state`. Componentes normalizados iguais, hash `d2986ae42abeb8519124fa3f101164e08284d854a838910c2487f0517ca1ea2a`. Linhas, schema, defaults, índices e demais constraints seguem sob igualdade estrita.
- **Gate fechado:** apenas duas formas exatas, identidade/validação/não deferrabilidade verificadas; metadata real antes/depois: `state varchar(24) NOT NULL`, cast builtin varchar para text, operador builtin `texteq`, mesma collation `pg_catalog.default` e banco C/C. Forma/contexto desconhecido falha. Não comprova equivalência de SQL arbitrário.
- **Provas existentes:** 13 comparações de verdade reais, incluindo NULL; INSERT e UPDATE, cada um: 12 aceitos/14 rejeitados. NULL preserva SQLSTATE 23502; tamanho acima de 24 preserva 22001, quatro rejeições de cada. Testes puros: 3 positivos/31 negativos. Sete checks de sintaxe e typecheck dos imports reais: exit 0. Nenhum reteste neste fechamento.
- **Histórico:** mismatch inicial sem componentes completos continua com causa UNKNOWN. Tentativa intermediária falhou na harness por `inconsistent types deduced for parameter $3`; a posterior tipada passou. A diferença atual não demonstra causalidade histórica.
- **Integridade/cleanup:** 164 arquivos protegidos e 13 entradas congeladas conferidos antes da escrita; backups dos bytes atuais/WIP. Runtime registra backend encerrado, PostgreSQL privado parado e portas livres; identidade PostgreSQL externo/5432 antes/depois igual. Este fechamento altera apenas os dois documentos e manifesto ignorado; sem runtime, fonte, dependência, serviço, banco atual, Resend, commit ou deploy.

Evidências: [runtime](../../.tmp/stage2-pending-20261011/c5-equivalence-typed/c1-runtime-proof.json), [semântica](../../.tmp/stage2-pending-20261011/c5-equivalence-typed/semantic-proof.json), [testes puros](../../.tmp/stage2-pending-20261011/c5-equivalence-typed/pure-test-proof.json), [C5](../../.tmp/stage2-pending-20261011/c5-equivalence-typed/goals-proof.json), [diff bruto](../../.tmp/stage2-pending-20261011/c5-equivalence-typed/canonical-diff.json), [readback independente](../../.tmp/stage2-pending-20261011/c5-equivalence-typed/independent-readback/final.json).

**Pendências:** C6 (deadlines restaurados como caso separado) e C7/C8 (carga/latências) exigem autorização e orçamento próprios; nenhum perfil de carga executado. Visibilidade/lifecycle genuínos, BFCache e native físico: DEFERRED. Capacidade produtiva, backup produtivo, timezone histórico real e mixed-version/rollback não comprovados. U5/U6 e gates de ativação continuam abertos.
### Correções da harness em 2026-10-11 — implementação e prova parcial

**Cinco correções implementadas; C6 funcional ainda sem prova, A8/exportação oficial NOT RUN. U3/U4, U5/U6 e etapa 2 continuam abertas, sem autorização de ativação.** A revisão independente do código e das provas existentes não encontrou defeito severo confirmado: UTC precede fixtures, comparação temporal usa SQL/microssegundos mantendo igualdade bruta no restore, preflight valida contrato real numa conexão QueryRunner própria, runner C6/A8 é mantido e A8 registra somente recuperação sequencial com identidade verificada.

Readback: 21/21 testes locais PASS; tipos produtivos backend, harness e frontend PASS. Typecheck completo backend tem somente TS2352 preexistente em `orcamento.repository.spec.ts:35`. Preflight real no PostgreSQL privado confirmou schema, UTC, configuração 900/43200/v1 e throttle 60/60000, com 11 rejeições SQL. Esses checks NÃO são PASS de C6/A8.

A tentativa C6 atual falhou no readiness de 60 s **antes dos goals**. Primeiro log Nest ocorreu aproximadamente aos 65 s e startup aos 68 s; stderr vazio. `register.cjs` já usa `transpileOnly: true`: typecheck ts-node não é causa sustentada. Confiança alta no excedente do orçamento; causa da demora pré-Nest permanece UNKNOWN. HTTP/dump/restore C6 não executados nessa tentativa; não houve retry ou novo runtime na revisão. Cleanup registra backend encerrado, PG parado, portas livres e identidade externa igual. Readback conferiu 704 entradas congeladas sem divergência; antes da escrita documental, 672 registros protegidos divergiam somente no bridge de teste previamente autorizado.

Evidências e limites: [auditoria e fechamento atual](../validacao/AUDITORIA_HARNESS_SESSOES.md#revisão-independente-das-cinco-correções--fechamento-parcial), [handoff](../../.tmp/harness-corrections-e2f310e0fd4e4ed79140ef8f0c3d0d74/handoff.json), [runtime C6](../../.tmp/session-harness-c6-23efb995fb8d453a81788c53a7022986/runtime-proof.json), [preflight](../../.tmp/session-harness-c6-23efb995fb8d453a81788c53a7022986/contract-proof.json) e [readback independente com backups documentais](../../.tmp/harness-review-20261011-independent/readback.json).

**Próximo passo delimitado:** obter autorização para diagnosticar startup da harness com tempos por fase e orçamento finito, preservando tipos offline e sem retry. Só depois retomar C6 isolado e, após C6/cleanup comprovados, A8. Sem mudança de produto, banco atual, serviço externo, dependência, Resend, commit, deploy ou gates de ativação. Históricos anteriores permanecem válidos apenas no seu alcance.

### Encerramento aceito da implementação da harness — 2026-10-11

**Cinco correções: implementação CONCLUÍDA; verificação funcional PENDENTE/ADIADA.** O usuário aceitou encerrar a implementação sem nova execução agora. A tentativa C6 FAILED no readiness de 60 s, primeiro log aproximadamente aos 65 s e startup aos 68 s permanecem históricos, com causa UNKNOWN e sem defeito de produto demonstrado. Goals/HTTP/dump/restauração C6 e A8/exportação oficial não ganham PASS; C7/C8 e lifecycle/BFCache/native continuam pendentes ou adiados. U3/U4, U5/U6 e etapa 2 seguem abertos, sem ativação.

O próximo diagnóstico/teste descrito acima fica adiado; só será retomado se o usuário solicitar, com autorização e orçamento próprios. Atualização somente documental, sem runtime, testes, fontes, configuração, banco, commit ou deploy. [Registro da aceitação](AUDITORIA_HARNESS_SESSOES.md#encerramento-aceito-da-implementação--2026-10-11); [backup dos bytes anteriores](../../.tmp/harness-implementation-close-20261011/baseline.json).

### C7/C8 — prova local delimitada em 2026-10-11

**C7 PASS / C8 PASS local, em uma única execução combinada.** Revisão independente do código e das evidências existentes, sem novo runtime, teste ou build, não encontrou defeito causal severo confirmado nesse alcance. Nest/AppModule real, PostgreSQL privado 18.3, seis contas ativas e três sessões terminais adicionais; não C6/restauro, A8/browser ou capacidade produtiva. Os estados NOT RUN anteriores são históricos e permanecem intactos.

| Perfil | HTTP observado | p50 / p95 / p99 | Amostra |
|---|---|---|---|
| C7, mesma conta, autorizado | 20 × 200 | 25 / 89 / 100 ms | 20; 10 por nível de concorrência 2/5 |
| C7, terminal | 6 × 401, dois por motivo idle/absoluto/revogado | Não misturados aos percentis autorizados | 6 |
| C8, contas distintas | 20 × 200 | 8 / 26 / 29 ms | 20; 10 por nível de concorrência 2/5 |

Nove logins reais HTTP 200; zero 429, 500, outros status ou erros de rede. Throttle efetivo permaneceu 60/60000; login tem bucket separado 10/min. Total combinado: 46 GETs. Os percentis nearest-rank são descritivos dessa amostra pequena, não SLO/capacidade aceita; C7 incluindo terminais tem p50/p95/p99 27/89/100 ms, separado da tabela acima.

**Espera e progresso reais:** conexão física SQL independente segura a linha de usuário ou sessão. Onze admissões retidas mostram waits em `pg_stat_activity`/`pg_locks`, blocker próprio via `pg_blocking_pids` e request-alvo ainda pendente, não mero sleep. C7 observa 2/5 waits agregados; C8 observa alvo bloqueado e 1/4 contas não relacionadas com respostas saudáveis completas **antes** do rollback do lock. Todos liberados em 20–64 ms, abaixo do cap de 3 s e lock timeout produtivo de 5 s. São observações agregadas do banco privado, não tracing individual de cada backend PostgreSQL.

**Identidade e integridade de sessão:** SID/sub vêm de JWT HS256 com issuer/assinatura verificados e join à linha SQL própria. Deadlines distintos de fixtures legais devem coincidir no body real e `X-Session-State`, ambos com política v1/no-store e `serverNow` anterior aos deadlines. O contrato de resposta não contém SID/usuário; o harness não cria headers de identidade nem extrai tais campos da resposta. A fonte valida esses bodies/headers em memória; o arquivo retém status/latência/identidade do request e resultados das assertions, não cópias brutas de todos os bodies/headers. UTC precede fixtures; SQL tipado/microssegundos valida sua forma legal. Linhas ativas brutas, deadlines e atividade iguais após ambos os perfis. Idle/absoluto/revogado exigem motivo 401 preciso, terminalidade SQL e ausência de renovação/ressurreição.

**Orçamento:** startup do processo até health HTTP em 26,133 s, com milestones de registro/import/listening; orçamento de 120 s declarado somente para C7C8, sem atribuir causa à demora histórica de C6. C6/A8 mantêm startup de 60 s. Goals combinados 1,849 s; caps 120 s total/60 s por perfil/12 s por HTTP. Sem retry, alteração do throttle ou `statement_timeout` produtivo global.

**Checks locais informados pelo executor:** 21 existentes + 9 novos = 30 PASS e tipos focados sem erros; não reexecutados por esta revisão. Não há log desses checks no diretório de runtime, portanto não são uma execução independente atribuída a este readback. O TS2352 preexistente em `orcamento.repository.spec.ts:35` continua limitação conhecida do typecheck backend completo, não corrigida nem reavaliada aqui.

**Readback e cleanup:** 706 entradas congeladas conferidas sem drift; SHA-256 do manifesto `a11f0d2aa6e548bfd207d6fe65577715819002926657b776db5a0f3fba17e3a6`, igual nas provas load/runtime. Dos 2173 registros pré-edição, somente runner/register/README autorizados divergiam antes desta escrita; dois novos arquivos load completam a implementação. Provas/fontes históricas preservadas. Runtime registra filhos/Nest encerrados, PostgreSQL privado parado, portas livres e identidade externa antes/depois igual. Readback OS atual confirma dez PIDs registrados ausentes, nenhum listener 4178/4318/55434 e listener TCP externo 5432/PID 7124. CIM de processo/serviço foi negado: **identidade externa completa atual indisponível**, sem inventar igualdade atual; nenhum acesso SQL ao 5432.

Evidências: [load](../../.tmp/session-harness-c7c8-480736e2b49749bda95bad8f34ddfdd4/load-proof.json), [runtime](../../.tmp/session-harness-c7c8-480736e2b49749bda95bad8f34ddfdd4/runtime-proof.json), [preflight real, não PASS de cenário](../../.tmp/session-harness-c7c8-480736e2b49749bda95bad8f34ddfdd4/contract-proof.json), [candidato](../../.tmp/session-harness-c7c8-480736e2b49749bda95bad8f34ddfdd4/candidate.json), [readback OS](../../.tmp/c7-c8-independent-readback-20261011/os-readback.json), [backups documentais](../../.tmp/c7-c8-independent-readback-20261011/baseline.json) e [manifesto independente](../../.tmp/c7-c8-independent-readback-20261011/final.json).

**Limites e próximo estado:** C7/C8 não comprovam poda max-five por login concorrente, múltiplas instâncias, capacidade de produção, fronteiras por espera natural, dump/restauração C6 ou A8. As cinco correções seguem com implementação encerrada por aceite, mas C6 funcional/A8/exportação oficial PENDENTE/ADIADA. Visibilidade/lifecycle/BFCache/native, contexto offline simultâneo, backup produtivo, timezone histórico real, mixed-version/rollback, U5/U6 e ativação permanecem separados e abertos. U3/U4/etapa 2 não encerradas nem ativadas. Este fechamento só modifica estes dois documentos e artefatos ignorados; sem nova execução, fonte de produto, dependência, configuração produtiva, banco atual, serviço externo, Resend, commit ou deploy.

### C6/A8 — prova funcional delimitada em 2026-10-11

**C6 PASS 4/4 fixtures; A8 PASS 1/1 caso browser.** Uma invocação real por perfil, PostgreSQL privado 18.3 e Nest/AppModule; zero retries. Revisão independente somente de fontes/evidências existentes, sem novos testes, types, export, browser ou DB. Não foi encontrado defeito bloqueante confirmado nesse escopo. Cinco correções já implementadas agora têm verificação funcional dos casos específicos; U4/etapa 2 não encerradas nem ativadas.

| Caso | Prova real e limite |
|---|---|
| C6 | Quatro logins HTTP reais e JWT HS256/issuer verificados antes de backdate UTC. Dump custom/restauração preservaram quatro linhas brutas, instantes tipados em microssegundos e metadata de colunas/defaults/constraints. Sessão ativa: 200/no-store, deadlines corretos e linha intacta. Idle/absoluta/revogada: três 401 com `AUTH_SESSION_IDLE_EXPIRED`, `AUTH_SESSION_ABSOLUTE_EXPIRED`, `AUTH_SESSION_REVOKED`; terminalidade persistida, sem renovação/ressurreição. Não é backup produtivo ou espera natural. |
| A8 | Expo oficial instalado 57.0.23, 41 arquivos exportados/hash verificado, Edge real e RootLayout/LoginScreen/API/storage/logout reais. Offline: remoto `unconfirmed`, limpeza local durável completa; credenciais/usuário/keys legadas removidos e tombstone signedOut conserva SID. Reload após reconexão não ressuscitou A nem enviou replay de logout. B foi criada **depois** da reconexão, com SID/usuário diferentes e SID/sub JWT, usuário durável e linha SQL coerentes, inclusive após novo reload. Não é corrida simultânea em contexto separado. |

**Medições e checks locais duráveis:** startup finito de 120 s agora comum a C6/A8/C7C8. C6: startup 21,492 s, goals 1,866 s, comando total 58,879 s. A8: startup 4,191 s, export 50,645 s, teste browser 4,4 s, comando browser 8,848 s, total 85,700 s. Playwright: 1 esperado, zero skipped/unexpected/flaky. RED: 1 falha/30 PASS; GREEN: 31/31 PASS em duas suites. Sintaxe e formatting check: exit 0. Tipos focados: seis roots/1727 arquivos/zero diagnósticos; frontend completo: exit 0. Backend completo: somente TS2352 preexistente em `orcamento.repository.spec.ts:35`, fonte inalterada. Artefatos incluem comandos, stdout/stderr e exits; checks não substituem o resultado funcional. As 24 posições estáticas de `expect` em A8 não são contagem de assertions executadas.

**Integridade e cleanup:** manifestos de 706 fontes por execução: C6 `dad1de59f5d00622b0b6b0e8698f48a2761ae75e1d0a7ac35a5b32028d8b6abe`; A8 `9e20a37cafea2d8b7b433ec6813ae53f83333d1a6ea5c8d3b833a039a74d6f2f`. Fontes ficaram intactas no encerramento de cada runtime; no readback posterior C6 difere somente no spec A8 autorizado, A8 coincide integralmente. Baseline C7/C8 difere somente nos quatro arquivos autorizados desta rodada: runner, contract spec, A8 spec e README; seu PASS anterior não foi reescrito. Runtime confirma filhos/Nest/PG privados encerrados, servidor web A8 fechado e portas livres; consulta OS preservada registra zero processos com os roots próprios e nenhum listener 4178/4318/55434. Observações TCP/serviço/PID/criação externos antes/depois iguais, mas `ExecutablePath` do processo é indisponível: identidade executável OS completa não comprovada. Nenhuma conexão SQL ao 5432.

Evidências C6: [cenário](../../.tmp/session-harness-c6-84f722f17c9c400296443fd3a87d8c17/c6-proof.json), [runtime](../../.tmp/session-harness-c6-84f722f17c9c400296443fd3a87d8c17/runtime-proof.json), [autoridade antes](../../.tmp/session-harness-c6-84f722f17c9c400296443fd3a87d8c17/authority-before.json)/[depois](../../.tmp/session-harness-c6-84f722f17c9c400296443fd3a87d8c17/authority-after.json). A8: [cenário](../../.tmp/session-harness-a8-23df2d063e7b494c87effe1d3f709b05/a8-proof.json), [runtime](../../.tmp/session-harness-a8-23df2d063e7b494c87effe1d3f709b05/runtime-proof.json), [browser](../../.tmp/session-harness-a8-23df2d063e7b494c87effe1d3f709b05/browser-report.json), [export](../../.tmp/session-harness-a8-23df2d063e7b494c87effe1d3f709b05/export-manifest.json). [Checks locais](../../.tmp/c6-a8-verification-f3bf1ccc1c2d417c812ff2ee1c18a8b2/local-summary.json), [checks A8](../../.tmp/c6-a8-verification-f3bf1ccc1c2d417c812ff2ee1c18a8b2/a8-local-summary.json), [consulta OS](../../.tmp/c6-a8-verification-f3bf1ccc1c2d417c812ff2ee1c18a8b2/owned-process-readback.json), [backups anteriores à escrita](../../.tmp/c6-a8-independent-readback-20261011/baseline.json) e [readback independente](../../.tmp/c6-a8-independent-readback-20261011/final.json).

**Limites mantidos:** marcador privado ausente foi assertado **depois da conclusão do logout**; ocultação síncrona independente não foi cronometrada. Remoto não confirmado não significa revogação provada. Contexto offline simultâneo, corrida de revogação com access válido, visibilidade genuína/BFCache/native, capacidade/backup produtivos, timezone histórico real e mixed deployment/rollback continuam sem prova. A falha histórica de startup mantém causa UNKNOWN; aumentar orçamento não demonstra causalidade. U3/U4, U5/U6 e etapa 2 permanecem abertas, sem ativação. Fechamento documental altera só os três documentos autorizados e suporte ignorado; sem produto, dependência, banco atual, serviço externo, Resend, commit ou deploy.
