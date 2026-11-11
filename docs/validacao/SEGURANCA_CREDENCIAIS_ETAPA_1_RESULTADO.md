# Credenciais: implementação e limites da etapa 1

## Estado atual da aplicação local — 2026-10-08

**Processo 1 fechado no escopo de desenvolvimento local autorizado.** Somente
`0014` e `0015` foram aplicadas na aplicação local PostgreSQL 18.3, em uma única
transação; nenhum DML sobre usuários ou dados financeiros. Worker/envio real
continuam desligados; produção não foi liberada.

| Prova operacional | Resultado |
|---|---|
| Recuperação do trabalho interrompido | Pasta anterior vazia; sem operação ativa, cópia de restauração ou migrations aplicadas; leitura somente antes de continuar |
| Credencial nativa | PGPASSFILE UTF-8 sem BOM temporário e ACL restrita, sem PGPASSWORD; senha inalterada |
| Backup | Custom completo de 116442 bytes; catálogo do arquivo validado |
| Restauração real | Base isolada; 18 tabelas originais e contagens iguais, não apenas listagem do arquivo |
| Cópia migrada | 0014/0015 na mesma transação; colunas, constraints validadas e índices conferidos |
| Smoke na cópia | Repositories reais: troca autenticada e recuperação, sessões revogadas, links terminais/não reutilizáveis, um evento pendente por fluxo; worker OFF, zero rede |
| Respaldo protegido | DPAPI CurrentUser, 116662 bytes, roundtrip de hash aprovado e ACL efetiva restrita |
| Aplicação local | Catálogo igual à cópia; contagens das 18 tabelas preservadas; outbox vazia, invalidated_at nulo nos tokens existentes |
| Limpeza | Cópia removida após conferir nome/OID/comentário; dump em texto claro e arquivo de senha removidos |

Evidências sanitizadas: `.tmp/app-credential-closure-04bf38ea9a864ee3ab516b9ce0c1d952/evidence.json`
e `recovery.json`. Backup na mesma pasta: `application-before.dump.dpapi`.
DPAPI exige o mesmo usuário e ambiente Windows; não é backup externo independente.
Não apagar essa pasta sem preservar um respaldo aprovado, nem restaurar
cegamente estados antigos de credenciais.

As diferenças anteriores `0010`, `0011` e `0013` continuam intocadas e fora do
escopo. Não houve reset de senha, alteração de HBA/permissões/serviço,
instalação, commit, rollout da aplicação ou email real. A falha antiga de
autenticação permanece histórica; o transporte UTF-8 resolveu o bloqueio.
Os **172/172 testes** abaixo são prova anterior do candidato, não nova execução
nesta migração; frontend/baseline global não foram repetidos. Veja
[operação local](../operacao/RESEND_DESENVOLVIMENTO.md).

**Escopo autorizado de desenvolvimento concluído e verificado em 2026-10-08; não liberado para produção.**
O núcleo transacional e o contrato de senha atual estão implementados. U3/C8
agora possui outbox e simulação de desenvolvimento; envio real permanece
bloqueado. A prova final aprovou **172/172 testes**, tipos de produção e revisão
independente do candidato de 18 paths. A aprovação é somente de desenvolvimento;
o histórico do núcleo e a simulação não comprovam entrega real.
Veja [operação Resend em desenvolvimento](../operacao/RESEND_DESENVOLVIMENTO.md).
**U0/U1/U2 estão funcionalmente verificados**, inclusive concorrência e rollback
reais. U4 concluiu revisão delimitada, provas e documentação do núcleo; a etapa
completa ainda não está pronta para produção por domínio, entrega real e política
operacional/retencão não aprovados. Worker OFF por padrão; flag live rejeitado.

## Nova entrega U3/C8 — desenvolvimento, 2026-10-06

Escrita do evento na mesma transação da senha; migration aditiva `0015`; claim de
uma linha SKIP LOCKED, payload/sender congelados, leases com CAS e retry
finito. Worker OFF por padrão; habilitação local somente simula e registra
`simulated`, nunca `delivered`. Configuração de envio real é rejeitada e nenhuma
chave é lida. Adapter Resend HTTPS foi exercitado somente com fetch substituído;
webhook existente de recuperação não mudou.

RED→GREEN: ausência de evento atômico produziu dois erros antes da inserção;
alerta de reconciliação e limite de uma linha por claim também tiveram regressão
failing-first. A ausência de claim token também teve regressão failing-first.
Após normalização: **140 testes em 16 suites aprovados**; lint delimitado sem
diagnósticos e typecheck de produção aprovado. O comando combinado terminou
com exit code 0 na entrega anterior. Suite real atual de **14 casos** cobre eventos dos
dois fluxos/rollback, pré-commit, concorrência, lease/ack antigo, retries, restart,
janela, simulação e purge; **14/14 aprovados pelo verificador em PostgreSQL isolado**.

### Correção delimitada do acknowledgement — 2026-10-08

A revisão encontrou relógio lido antes do lock do UPDATE: uma espera poderia
aceitar acknowledgement após o lease expirar. `settle` agora trava a linha no
mesmo EntityManager antes de consultar o relógio e confere estado/token/lease;
retry usa tentativas e primeiro instante persistidos. O CAS permanece.
Regressão unitária RED: uma falha por lock ausente no código anterior; GREEN:
**12/12 testes focados**. Novo caso PostgreSQL observa `pg_blocking_pids`, expira
o lease mantendo o token e verifica lock→clock, linha inalterada e reclaim,
sem sleeps. **A regressão PostgreSQL e a revisão final foram aprovadas.**
Snapshot anterior, hashes e prova histórica de 140 testes foram preservados
em `.tmp/resend-finish-correction/`; isso não transforma revisão interrompida
ou teste ainda não executado em PASS. Nenhum segredo/rede real foi usado.
Após normalização da correção: **145/145 testes em 16 suites**, lint dos três
arquivos TypeScript alterados e typecheck de produção aprovados. Typecheck geral
continua com somente o erro preexistente `orcamento.repository.spec.ts:35 TS2352`.

### Prova final independente — 2026-10-08

Evidência: `.tmp/resend-development-final-verification/evidence.json`;
`functionalOutcome: passed`, **172/172**, todos os comandos abaixo com exit code
0. Diretório `backendnest/`; `guard.cjs` foi resolvido pelo harness do verificador
para impedir rede real e autoload de `.env` privado. As invocações registradas:

| Prova | Resultado | Comando |
|---|---|---|
| Autenticação | 145/145; 16 suites | `node --require guard.cjs node_modules/jest/bin/jest.js --runInBand src/auth --silent --setupFiles C:\dev\meu-sistema-financeiro\.tmp\resend-development-final-verification\guard.cjs` |
| Outbox PostgreSQL | 14/14 | `node --require guard.cjs node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/password-changed-outbox.e2e-spec.ts --setupFiles C:\dev\meu-sistema-financeiro\.tmp\resend-development-final-verification\guard.cjs` |
| Fronteiras PostgreSQL | 9/9 | `node --require guard.cjs node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/credential-boundaries.e2e-spec.ts --setupFiles C:\dev\meu-sistema-financeiro\.tmp\resend-development-final-verification\guard.cjs` |
| Reset PostgreSQL | 4/4 | `node --require guard.cjs node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/auth-password-reset.e2e-spec.ts --setupFiles C:\dev\meu-sistema-financeiro\.tmp\resend-development-final-verification\guard.cjs` |
| Tipos backend de produção | Aprovado | `node --require guard.cjs node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json` |

Preflight confirmou identidade, role e destino descartável antes de cada suite
PostgreSQL. A primeira inspeção de identidade do processo foi restringida pelo
sandbox antes do E2E; inspeção/cleanup/restart da fixture exata foram autorizados
e concluídos. Nenhum check funcional bem-sucedido foi repetido.
Cobertura nova: eventos nos dois fluxos; rollback de senha/links/sessões em falha
de outbox; invisibilidade antes do commit; SKIP LOCKED e workers concorrentes;
reclaim, ack obsoleto e lease expirando durante espera; payload estável após
aceitação simulada/falha de ack; restart, retry/backoff/budgets; worker OFF,
simulação e purge seletivo. As suites do núcleo reforçam concorrência e revogação.

Revisão independente fresca inspecionou **18/18 paths**, comparando baseline e
hashes atuais: nenhum MustFix/ShouldFix causado pelo candidato após a correção.
Revisão interrompida anterior permanece histórica, não conta como aprovação.
Hashes **18/18 iguais antes/depois** dos testes/cleanup; snapshot funcional
preservado em `functional-snapshot-before-doc-closure.json` no diretório da
verificação. O fechamento altera somente três documentos, não os 15 paths
restantes. Baseline global, frontend e lint global **não reexecutados**;
o TS2352 preexistente segue fora do escopo. Não é aprovação de produção.

Manifestos/evidência locais: `.tmp/resend-development-baseline/` (`manifest.json`,
`owned.json`, `final-hashes.json`, `evidence.json`). Comandos históricos do writer em `backendnest/`:
`node node_modules/jest/bin/jest.js --runInBand src/auth --silent` e
`node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json`.
Não se certificou lint global nem typecheck geral; o erro preexistente
`orcamento.repository.spec.ts:35 TS2352` permanece fora do escopo.

Na prova independente acima, `0015` foi aplicada pelo harness somente no
PostgreSQL isolado. O fechamento operacional posterior também aplicou `0014` e
`0015` na aplicação local, conforme estado atual no início. Schema deve preceder
o código mesmo com worker OFF; eventos independem do timer.
Não há instalação de SDK/broker, mudança frontend, envio real ou chave em arquivo.

O verificador provisionou PostgreSQL **18.3 temporário e isolado** em `.tmp`,
distinto dos bancos da aplicação. O harness aplicou migrations, incluindo
`0014` e `0015`, **somente nesse destino descartável**. Não houve migration em produção,
mudança em bancos existentes, envio real de email ou commit. Ao terminar, o
cluster foi confirmado parado, sem arquivo PID e sem listener, inclusive na
prova final atual. Nenhum `.env` privado/chave foi lido e nenhuma requisição
Resend ou mensagem real foi enviada. Webhook de reset existente não mudou;
entrega pública do link de reset por Resend não foi implementada.

## Histórico do núcleo anterior verificado — 2026-10-06

Evidência histórica do núcleo: `.tmp/credential-stage1-verification-final/evidence.json`, com
todos os checks em `exitCode: 0`, `functionalOutcome: passed` e
`postHashesMatch: true`. A falha inicial **7/9 aprovadas, 2/9 falhas** permanece
preservada separadamente, sem apagar o histórico.

| Prova final | Resultado | Comando exato, no diretório indicado |
|---|---|---|
| PostgreSQL — fronteiras de credenciais | **9/9 aprovadas** | `backendnest/`: `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/credential-boundaries.e2e-spec.ts` |
| PostgreSQL — regressão de recuperação existente | **4/4 aprovadas** | `backendnest/`: `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/auth-password-reset.e2e-spec.ts` |
| Backend de autenticação | **115 testes, 14 suites aprovadas** | `backendnest/`: `node node_modules/jest/bin/jest.js --runInBand src/auth --silent` |
| Frontend de autenticação e API | **56 testes, 5 suites aprovadas** | `frontend/`: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/services/api.test.ts __tests__/services/credential-session-races.test.ts src/modules/auth/__tests__/authService.test.ts src/modules/auth/__tests__/auth-flow.test.ts src/modules/auth/__tests__/reset-password-screens.test.tsx --silent` |
| Tipos backend de produção | **Aprovado** | `backendnest/`: `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json` |
| Tipos frontend delimitados | **Aprovado** | `frontend/`: `node node_modules/typescript/bin/tsc --noEmit --incremental false -p ../.tmp/credential-stage1-baseline/frontend-typecheck.json` |

Os dois preflights destrutivos também terminaram com código 0. Isso não é
aprovação do sistema inteiro: frontend typecheck completo, lint global e UI
compartilhada não foram certificados por esses checks. O teste de formulário
continua usando primitives UI mockadas. U3/C8 ainda não estava implementado
nesse snapshot histórico; sua verificação própria foi concluída na entrega acima.

Os 36 hashes do candidato foram preservados antes/depois da execução. Snapshot
funcional congelado: `.tmp/credential-stage1-verification-final/functional-hashes.json`.
O fechamento documental daquele núcleo alterou somente este relatório e o plano;
nenhum byte de código/teste mudou naquela operação. A entrega U3/C8 atual adiciona
código/testes e não reutiliza essa aprovação. Os hashes documentais atualizados ficam no
manifesto final, sem sobrescrever o snapshot funcional.

## Comportamento implementado

| Área | Decisão |
|---|---|
| Troca autenticada | `POST /auth/reset-password`: `senhaAtual` e `novaSenha`; `sid` vem do JWT, nunca do body. Mantém 201 e resposta sem tokens. Senha atual errada: 400 `AUTH_CURRENT_PASSWORD_INVALID`, campo `senhaAtual`, sem revogar a sessão. Sessão/hash concorrente inválidos: 401 `AUTH_INVALID_SESSION` |
| Recuperação | Mantém 200 e erro genérico 400 `AUTH_PASSWORD_RESET_TOKEN_INVALID`. Token consumido recebe `usedAt`; irmãos recebem `invalidatedAt`, sem confundir os estados |
| Transação | Lock da linha `usuario` antes de alterar tokens/sessões; todas as escritas usam o EntityManager da transação. Senha, invalidação e revogação confirmam juntos |
| Login | Bcrypt permanece fora do lock. Antes de inserir sessão, compara exatamente o hash verificado com o hash atual sob lock; divergência: 401 `AUTH_INVALID_CREDENTIALS` |
| Emissão de link | Revalida snapshot da senha; snapshot obsoleto não emite token e mantém resposta pública genérica. TTL calculado após lock |
| Refresh | Lock do usuário antes do CAS da sessão. Verifica expiração com relógio do banco após lock; não remove revogação. Reutilização continua revogando a mesma sessão |
| Clock/erros | `clock_timestamp()` define validade após lock; `lock_timeout` de 5 segundos. Falhas transacionais desconhecidas são sanitizadas antes do logger, sem parâmetros de credenciais e sem retry automático |
| Frontend | Senha atual exata, nova senha e confirmação local; erro de senha atual conserva sessão. Sucesso limpa dados e solicita login normal. Geração e fila locais protegem sucesso/401 obsoletos do refresh. A geração original da requisição protegida permanece imutável no replay, é validada depois dos awaits e imediatamente antes do adapter; uma mutação de A não é reenviada como B. Falha de rede não comprova revogação |

Limites: a fila coordena um runtime JavaScript, **não outras abas**. Uma requisição
já admitida pelo guard pode terminar depois da revogação. Email ainda não é
verificado; nenhuma certificação OWASP é alegada.

## Auditoria 1 e correção 1 — 2026-10-06

Uma revisão independente encontrou dois defeitos no primeiro candidato. Foi
aplicada **uma correção delimitada**, sem ciclo adicional de revisão:

1. O replay Axios sobrescrevia a geração da requisição e podia enviar uma
   mutação financeira de A usando credenciais de um novo login B. Duas
   regressões determinísticas falharam com resultado `completed` antes da
   correção: pausa após refresh salvo/antes do replay e pausa durante `getToken`.
   Após preservar a geração e validar o dispatch, ambas rejeitam sem enviar a
   mutação como B. As suites API/races afetadas passaram: **19 testes**.
2. O teste que expirava a fixture em `Date(0)` não provava a ordem lock→clock.
   Agora a suite real observa a sequência do próprio QueryRunner:
   `lock-requested → lock-acquired → clock-queried`, sem substituir consultas
   reais. Expiração da fixture continua sendo evidência separada, **não prova de
   expiração natural pelo tempo decorrido**. Um teste unitário com barreira de
   lock matou um mutante plausível que lia `clock_timestamp()` antes do lock:
   **1 teste falhou, 5 passaram**. O repository de produção foi restaurado
   byte-a-byte; GREEN com código correto: **6 testes**.

Log do mutante: `.tmp/credential-stage1-correction/clock-before-lock-mutant.log`.
A suite PostgreSQL corrigida foi executada e passou **9/9** no destino
descartável confirmado. A correção de implementação 1 está coberta pela prova
final acima; os números da seção histórica abaixo pertencem ao primeiro candidato.

## Remediação delimitada do harness após PostgreSQL RED — 2026-10-06

A execução real em PostgreSQL 18.3 passou o preflight, executou nove casos e
falhou em dois: a primeira barreira de consumidores paralelos não foi observada;
o caso seguinte reportou erros transacionais sanitizados. A primeira evidência
permanece em `.tmp/credential-stage1-verification/evidence.json` e
`credential-boundaries.log`; o cluster foi parado e confirmado sem listener.

Inspeção do harness identificou dois problemas verificáveis, **sem alterar
produção**:

- A barreira aceitava somente bloqueador direto. PostgreSQL pode reportar um
  waiter anterior como bloqueador intermediário (*soft block*), conforme a
  [documentação de `pg_blocking_pids`](https://www.postgresql.org/docs/18/functions-info.html).
  Agora uma CTE percorre a cadeia com controle de visitados e limite de 16 níveis;
  só aceita alcance do PID raiz esperado, não qualquer processo bloqueado.
- Ao falhar a barreira, o teste deixava o `Promise.all` pendente e o `afterEach`
  revertia/liberava os QueryRunners sem esperar os consumidores. Agora os casos
  paralelos vinculam imediatamente `Promise.allSettled`, liberam o blocker em
  `finally` e aguardam ambos antes da liberação. O cleanup geral solta blockers,
  drena as transações registradas e só então devolve conexões ao pool. A
  expectativa permanece **nenhuma rejeição e exatamente um vencedor**; os três
  PIDs das conexões participantes devem ser distintos.

A topologia exata da fila não foi registrada no primeiro erro; sua relação com
essa falha é uma inferência, não uma prova histórica. A extração segura do log
do servidor encontrou somente a falha de sessão injetada intencionalmente, não
55P03/deadlock. Os erros sanitizados do segundo caso não estabelecem sozinhos uma
causa de produção nem comprovam a atribuição à limpeza anterior.

Esta remediação é exclusivamente do harness de verificação, distinta da
**auditoria 1/correção de implementação 1**. A única reexecução delimitada
terminou com **9/9 casos aprovados** e a regressão existente com **4/4**. Isso
confirma o candidato corrigido, sem reconstruir retrospectivamente a topologia
da falha original nem inventar causa de produção. Nenhuma conexão ou
reinicialização de banco foi realizada pelo executor da remediação; o verificador
foi o responsável pelo cluster isolado e por confirmar seu encerramento.

## Histórico — evidências do primeiro candidato e primeiro PostgreSQL RED

Comandos de backend abaixo executados a partir de `backendnest/`; frontend a
partir de `frontend/`. Os resultados referem-se ao worktree, não a HEAD.

| Verificação | Resultado |
|---|---|
| Baseline `jest --runInBand --runTestsByPath src/auth/auth.service.spec.ts src/auth/repositories/auth-session.repository.spec.ts src/auth/auth.controller.spec.ts` | 36 testes aprovados antes das mudanças |
| U0 RED → GREEN | 2 regressões inicialmente falharam: configuração herdada e nome contendo `test`; passaram após preflight explícito |
| U1/U2 RED → GREEN | Lock antes do consumo + invalidação de irmãos e 4 entradas inválidas de senha atual falharam antes da implementação; corrigidas |
| Cliente RED → GREEN | Resposta tardia restaurava credenciais e falha tardia apagava login novo; ambas reproduzidas e corrigidas com barreiras, sem sleeps |
| Formulário RED → GREEN | Falta de senha atual e confirmação divergente enviavam request; 2 regressões corrigidas |
| `node node_modules/jest/bin/jest.js --runInBand src/auth --silent` | 114 testes aprovados em 14 suites após normalização final |
| Frontend: API, races, authService, auth-flow e formulário | 54 testes aprovados em 5 suites após normalização final |
| HTTP isolado | 6 testes passaram: payloads inválidos/extras, 201, prova exata/sid e erro 400. Guard e serviço mockados; não é prova de PostgreSQL |
| Cliente API/storage | 5 testes passaram usando API real e SecureStore fake; barriers cobrem reads e writes em voo, sucesso/erro tardio e falha transitória |
| Formulário | 6 testes passaram com primitives UI mockadas para isolar comportamento; a implementação compartilhada WIP `GlassField.tsx` não foi validada |
| Backend `tsc --noEmit -p tsconfig.build.json` | Aprovado; fonte de produção. Compilação geral reportou TS2352 em `orcamento.repository.spec.ts:35`, fora do manifesto de autoria; arquivo não alterado pelo executor |
| Frontend typecheck completo | Reportou JSX/imports inválidos em `GlassField.tsx`, observado antes das alterações da tela e não alterado pelo executor. Não há snapshot inicial desse arquivo no baseline desta entrega: ausência no manifesto comprova somente não autoria, não quando/por quem o problema foi introduzido. O teste legado `authStorage.test.ts` truncado foi copiado no baseline e preservado |
| Frontend typecheck direcionado | Storage, API e tipos de autenticação aprovados com config isolada em `.tmp/credential-stage1-baseline/frontend-typecheck.json`; não inclui renderização completa |
| Lint direcionado | Backend sem erros/warnings. Frontend sem erros, 7 warnings (3 em testes legados e 4 imports require de fixtures); resolução de imports reportou o parse inválido de `GlassField.tsx` fora da autoria, logo não comprova lint global |
| Primeiro PostgreSQL real (histórico) | Writer não executou banco. Verificador executou PostgreSQL 18.3: preflight aprovado, 7 casos passaram e 2 falharam. Evidência original preservada; a reexecução posterior aprovada está na seção final acima |

## PostgreSQL: runbook de reprodução segura

O harness não lê `.env` nem herda `DB_*`. Exige todas as variáveis:
`E2E_DB_HOST`, `E2E_DB_PORT`, `E2E_DB_USERNAME`, `E2E_DB_PASSWORD`, `E2E_DB_NAME`
e `E2E_DB_RESET_CONFIRM` (valor exatamente igual ao nome). Banco e usuário devem
usar prefixo exato `finance_e2e_`. Não publicar valores ou credenciais em logs.

Um administrador deve criar **um banco realmente descartável**, de preferência
em container isolado, com role dedicada sem SUPERUSER/CREATEDB/CREATEROLE/
REPLICATION/BYPASSRLS, sem memberships e proprietária somente desse banco. O
comentário do banco deve ser exatamente `finance-e2e-disposable`. O harness
confere identidade/owner/comment/role conectados antes de cada DDL. Não cria
banco, não conecta a um banco administrativo e não concede esquema ao PUBLIC.

**A preparação destrói o esquema public do banco confirmado.** Não apontar para
produção, desenvolvimento, staging, banco compartilhado ou dados de valor.
O harness desativa entrega de recuperação para não disparar webhooks reais.

Executar sequencialmente, somente após confirmar o destino:

```powershell
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/credential-boundaries.e2e-spec.ts
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/auth-password-reset.e2e-spec.ts
```

A nova suite usa conexões reais separadas e observa `pg_blocking_pids` para
liberar a barreira; não usa sleeps para ordenar requests. Cenários: token igual
e irmãos concorrentes, snapshot obsoleto de login/emissão, refresh esperando
revogação, ordem real lock→clock e rejeição de fixture expirada sob lock, troca
autenticada, falha injetada com rollback e usuário não relacionado. Não roda
automaticamente nem ignora falta de configuração como PASS.

## Aceitação e pendências

| Critério do plano | Estado |
|---|---|
| C1 | Implementado; DTO/serviço/HTTP e troca autenticada com sessão própria verificados, incluindo suite PostgreSQL real |
| C2–C6/C10 | Implementados e verificados nos cenários transacionais reais: consumidores iguais/irmãos, login/emissão obsoletos, refresh/revogação, lock→clock, rollback e usuário não relacionado |
| C7 | Resposta sem autologin e limpeza cliente verificadas isoladamente |
| C8 | Desenvolvimento concluído: outbox atômica, leases, retries finitos e simulação verificados em PostgreSQL real e revisão independente. Entrega real/produção não aprovada; simulação não é email entregue |
| C9 | Núcleo e U3 de desenvolvimento verificados, incluindo limites/sanitização da notificação. Integração real, privacidade e retenção de produção ainda exigem aprovação própria |
| U4 | Revisão delimitada, correção, provas finais e documentação do escopo de desenvolvimento concluídas; produção depende de domínio/entrega/políticas e rollout autorizado |

## Deploy e rollback

1. U3 de desenvolvimento já foi verificado/revisado. Aprovar separadamente
   domínio, destinatário, privacidade/retenção e operação para futuro envio real;
   não habilitar produção automaticamente com esta aprovação.
2. Distribuir cliente compatível com `senhaAtual`. Cliente antigo falha fechado;
   não manter fallback sem prova da senha atual.
3. Na aplicação local confirmada, `0014` e `0015` já foram aplicadas atomicamente;
   não reaplicar. Para outro destino, aprovar backup/restauração e executar
   somente migrations ausentes pelo processo autorizado antes do servidor.
   Testes isolados não substituem autorização; worker OFF exige schema da outbox.
4. Verificar troca/recuperação, rejeição de JWT/refresh/links antigos e novo login.
5. Uma coluna aditiva pode permanecer ao reverter código, mas reverter a correção
   reabre vulnerabilidades. Não apagar `invalidated_at`: isso pode revalidar
   links. Em rollback de segurança, desabilitar fluxos afetados e preservar os
   estados revogados/invalidados; não restaurar credenciais antigas.

Rollback por unidade: U0 altera somente harness/preflight; U1 inclui repositories,
coordenação e migration; U2 inclui DTO/controller/serviço/contrato/formulário/
fila de sessão. Não reverter arquivos inteiros com WIP de outra tarefa.
Baseline por arquivo está em `.tmp/credential-stage1-baseline/manifest.json`,
com cópias originais e hashes; o manifesto de autoria distingue estas mudanças.

Referência: [plano da etapa 1](../planejamento/SEGURANCA_CREDENCIAIS_ETAPA_1.md).
