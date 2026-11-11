# Sessões: coordenação entre contextos — etapa 2 / U3

**Estado em 2026-10-09: U3 implementada e verificada no escopo local, mas NÃO encerrada. Após uma correção delimitada U3-R1, a validação independente passou 151/151 testes em 15 suites, exit 0; TypeScript global exit 0, zero diagnósticos, com 38 hashes estáveis. A política de reautenticação para refresh desconhecido foi aprovada. Browser CORE pelo pipeline oficial Expo verificado independentemente: 5/5, exit 0. Matriz integral de browser, PostgreSQL, dispositivo native, startup autoritativo e rollout continuam gates.**

O cliente conserva a rotação estrita do servidor. Uma tentativa durável de refresh
sem conclusão nunca autoriza reenviar o token antigo. O custo aceito é pedir
login novamente, inclusive se o contexto morrer depois de marcar e antes de
enviar. Não há grace genérico, idempotência de backend, novo endpoint ou alteração
de regras financeiras. Resend continua adiado; U4–U6 não foram implementadas.

## Browser CORE verificado independentemente

O [relatório independente](../../.tmp/stage2-u3-expo-browser/independent-verification.json)
confirma `npm run test:session-browser`: **5/5 casos, exit 0**, uma worker,
retries 0; TypeScript global **exit 0, zero diagnósticos**. Preservou **41/41
hashes do manifesto e 31/31 hashes de produto** antes/depois. Cleanup confirmou
ausência do listener 4177, processos Node próprios e Edge Playwright, sem terminar
processos de usuário. A evidência local anterior independente **151/151 em 15
suites, exit 0**, continua preservada; este fechamento não executou testes novamente.

| Prova real CORE | Resultado e alcance |
|---|---|
| Três páginas no mesmo BrowserContext/origem | Uma rotação coordenada, três respostas válidas, lock liberado. São **401 concorrentes**, não um caso separado de 401 explicitamente atrasado. |
| Publicações antigas de perfil/login e B | `saveUser` lança `stale`, instalação antiga retorna falso e usuário B permanece. Não prova backend/telas completos. |
| Logout/resposta ordinária A versus B | Logout antigo não captura bearer B nem apaga B; resposta de A é retida como `stale`. |
| Perda de corpo após HTTP200 iniciado | Primeiro retorno `unknown`, efeito sintético 1, token nulo após reload, request seguinte `stale`, contador permanece 1 e lock liberado. Não é commit PostgreSQL. |
| Marcador órfão e reload | Storage real recupera sem token e sem HTTP refresh; marcador inicial foi instalado sinteticamente. |

**Limite explícito:** `observeSessionLifecycle` está exposto pela harness, mas
**não foi chamado** nesses testes. A presença de BroadcastChannel e APIs reais
foi verificada; não houve prova direta de entrega de notificações BroadcastChannel,
storage events, pageshow/visibilidade, BFCache ou lifecycle. Reload da página
não equivale a validação autoritativa de startup nem a encerramento real de processo.
Não é E2E da UI financeira, prova native ou matriz completa de suporte web.

### Pipeline reproduzível e histórico preservado

`cd frontend; npm run test:session-browser` usa fixture isolada em
`tests/browser/expo`, `main: ../session-entry.ts`, config web `single` e
`getDefaultConfig` público. A entrada registra UI mínima por `registerRootComponent`
e importa storage/API de produção; a raiz real continua `expo-router/entry`.
Expo CLI instalado **57.0.25**, Expo **57.0.23**, Node **24.14.0** e Playwright
**1.64.0**: export oficial web com uma worker, 226 módulos/bundle 404 KB.
O servidor local executa o CLI instalado, `export --platform web --max-workers 1`,
com cwd da fixture e saída ignorada; dotenv desativado, offline, sem instalação,
conta Expo, backend, banco ou configuração privada. Bind somente **127.0.0.1:4177**,
health com nonce/PID, sem reutilizar serviço existente; Edge headless com perfil
novo por caso e páginas do mesmo caso compartilhando contexto. Prazo global
210 s/export 120 s. Não há filtro InitializeCore, bridge patch ou mock de APIs web.

Raw Metro anterior falhou na carga; a primeira execução oficial real teve **3/5,
exit 1**: expectativa incorreta do erro de perfil e dois efeitos POST na perda
de socket antes dos headers. Sua causa não foi atribuída ao browser ou produto.
Uma correção delimitada verificou `stale` e injetou corpo truncado **após headers**;
teve **4/5, exit 1**, porque esperava `signed-out` depois do reload. Após parada,
uma exceção mecânica autorizada alterou **somente** essa expectativa para `stale`,
verificado na união `SessionFailure`/interceptor real. A prova final e a independente
passaram **5/5**; os asserts de não reenvio/liberação de lock foram alcançados.
Isso não demonstra ausência de duplicação de transporte antes dos headers nem
atribui causalidade aos dois efeitos anteriores. Efeito stub não é commit SQL.

Históricos preservados em `.tmp/stage2-u3-expo-browser/`: `baseline.json` e
`original/`, `browser-run.log` (EPERM), `browser-run-reviewed.log` (argumento
Windows rejeitado), `browser-first-actual-report.json`/`browser-final-run.log`
(3/5), `browser-corrected-failed-report.json`/`browser-corrected-run.log` (4/5),
`second-failed-spec.ts`, `browser-contract-final-run.log`, `focused-tests.log`
(151/151), `types-contract-final.log`, `final.json` e relatório independente.
`expo-export.log`/`stub-effects.jsonl` registram build e somente identificadores
sintéticos/contagens; falhas raw Metro em `.tmp/stage2-u3/` permanecem.
Fechamento documental: `documentary-closure.json`, sem alteração de produto/harness.

**U3 continua aberta:** PostgreSQL real/replay/commit, native/capacidade SecureStore,
startup autoritativo, notificações/lifecycle, matriz browser e rollout de versões
antigas não foram concluídos. As referências a browser pendente/falhas de carga
no histórico abaixo não substituem este resultado atual delimitado.

## Ficha técnica e invariantes

| Fronteira | Comportamento do candidato |
|---|---|
| Publicação coerente | Uma entrada `auth_session_v3` contém versão 3, encarnação UUID nova, revisão, SID, estado, par completo de credenciais, usuário e marcador de tentativa. Não publica pares de chaves de gerações diferentes. |
| Identidade | Access e refresh precisam conter `sid`/`sub` consistentes entre si e com o usuário. Claims decodificados são **metadata não confiável para fence local**, não autenticação/verificação criptográfica do cliente. O guard existente continua autoridade dos requests protegidos. |
| Login | Captura snapshot durável **antes** da rede; instalação relê identidade dentro da coordenação. Login antigo não substitui B, inclusive mesma conta com SID/encarnação novos. Assinatura numérica legada é conservada, mas retorna `false`; ela não prova ownership durável. |
| Escritores públicos | Instalação, migração, refresh, perfil, saída e limpeza entram no coordenador. `saveToken`/`saveRefreshToken` rejeitam publicação parcial; `applyRefreshIfCurrent` não é bypass e retorna `false`. Remoções legadas encerram o envelope completo. `saveUser` exige snapshot capturado antes do request de perfil. |
| Web | Contexto seguro e Web Locks são baseline obrigatório. Lock exclusivo no mesmo bucket cobre releitura, marcador, HTTP limitado e publicação completa. Não existe lease de localStorage como fallback. Lock ausente/negado produz falha fechada de compatibilidade/indisponibilidade. |
| Limites técnicos | Espera de aquisição: 7 s; refresh: deadline, abort e timeout Axios de 5 s. Não são políticas idle/absolute de U4. O lock longo limita a sequência HTTP, mas não promete deadline universal para um adapter native que nunca retorna do storage. |
| 401 tardio | Sob lock, N encontra N+1 da mesma identidade: adota o par publicado sem reenviar N. Outra encarnação cancela o request antigo. Single-flight do módulo é apenas otimização; não substitui releitura coordenada. |
| Resultado desconhecido | Marcador `refreshInFlight` é confirmado antes de HTTP. Timeout, perda de resposta e bare 503 depois de possível envio não provam ausência de commit: estado `refreshOutcomeUnknown`, sem credenciais, pede login explicado. Falha de escrita **antes** do envio não envia HTTP e informa indisponibilidade, sem afirmar invasão. |
| Saída local/compartilhada | UI e epoch local saem sincronamente. Tombstone compartilhado pode esperar refresh sob lock. Logout compara identidade capturada; A antiga não lê/enviará bearer B nem apaga B. Revogação continua uma tentativa de 5 s, sem refresh/retry. |
| Avisos tardios | Completion de logout relê somente identidade durável antes do aviso. Evento perdido não liga falha de A a B; leitura negada não prova ownership e suprime esse aviso. Resultado remoto continua `unconfirmed`, nunca aprovação inventada. |
| Requests e consumidores | Snapshot acompanha despacho, resposta 200 e erro. Perfil, password-change, Home/dashboard e routing mantêm fences/limpeza local. Mudança de senha continua encerrando somente a identidade que iniciou a ação; revisão de tokens da mesma encarnação não impede a saída legítima. |
| Notificações/lifecycle | Canal transmite apenas encarnação/revisão, nunca tokens/usuário; storage event apenas desperta releitura, sem encaminhar `newValue`. Startup, pageshow, visibility e AppState active reconciliam storage; canais são fechados no pagehide/cleanup. Não há garantia entre partições/processos native. |
| Autoridade no startup | Reconciliar envelope **não** valida revogação/expiração no servidor. Root ainda deriva auth local; nova validação autoritativa de startup/resume continua gate não concluído, sem alegação de cobertura integral de S2-08. |
| Native | Fila local e uma cápsula SecureStore, sem transação multichave presumida. Cap de aplicação: 2 KiB UTF-8; web: 16 KiB. Payload maior/falha bloqueia publicação. **Isso não comprova capacidade uniforme de SecureStore nem suporte de dispositivo real.** |
| Migração | Ausência/legado parcial, opaque JWT legado, tombstone ou record malformado exige login conservador. O envelope signed-out é confirmado antes de remover chaves legadas. Falhas de leitura/escrita/limpeza são indisponibilidade/quarentena, não autorização para ressuscitar A. |
| Dependências | Reutiliza `uuid.v4` público de expo-modules-core instalado; web usa UUID do browser, native delega ao SDK. Apenas devDependency pinada `@playwright/test@1.64.0` adicionada para prova; nenhum novo pacote de produção. |

## Unidades revisáveis, arquivos e rollback

| Unidade sem commit | Arquivos/limite de reversão |
|---|---|
| Cápsula e escritores | `frontend/storage/authStorage.ts`, fixtures e testes storage/contextos. Reverter como fronteira completa, não voltar a writers parciais isoladamente. |
| Transporte e saída | `frontend/src/shared/services/api.ts`, `authService.ts`, `logoutCoordinator.ts`, `utils/session-error.ts`, `utils/api-error.ts` e testes API/saída. Sem mudança HTTP/backend. |
| Consumers | `LoginScreen.tsx`, `UsuarioScreen.tsx`, `ResetPasswordScreen.tsx`, `RootLayout.tsx` e regressões reais; Home/dashboard existentes permanecem cercados por epoch/listeners. Não alterar regras financeiras. |
| Ferramenta de prova | `frontend/tests/browser/*`, `playwright.session.config.ts`, script `test:session-browser`, pin dev-only e 46 adições no lockfile contra baseline WIP. Removíveis juntos, sem dependência do produto. |

Baselines são bytes do **worktree anterior a U3**, não de HEAD:
`.tmp/stage2-u3/baseline.json` e `original/`, com 31 hashes originais verificados.
Uma agregação PowerShell havia encapsulado a lista em `value`; foi normalizada
após verificar os 31 snapshots, sem perder/restaurar fonte. Não há rollback SQL,
deploy ou commit criado.

**Rollback operacional não pode reativar credenciais antigas.** Clientes anteriores
ignoram a cápsula e podem escrever chaves legadas/reutilizar refresh fora do lock.
Publicação exige atualização coordenada/forçada e término de escritores antigos;
este candidato não implementa controle remoto de versão. Não apagar tombstones,
restaurar segredos de backup nem prometer convivência segura com versões antigas.

## Evidência e limites da execução

RED comportamental preservado: A antiga capturava bearer B no logout; 1 falha.
Durante a implementação, outro RED demonstrou aviso de A após instalação B com
notificação perdida; outro demonstrou bypass de instalação numérica/epoch-only.
As duas correções tiveram GREEN focado de 1/1, exit 0, antes da prova final.

Provas intermediárias, não substitutos da prova final: contextos compartilhando
fake storage/adapter Web Locks 14/14; primeira regressão 130/138 com 8 falhas de
fixtures/expectativas antigas, seguida de 32/32 nas quatro suites focadas;
consumidores reais perfil/password-change + Login/reset 20/20 em três suites;
matriz local delimitada 33/33 em duas suites; AppState adapter 1/1. Jest usa UUIDs
sintéticos de Node no mock SDK, não uma branch permissiva no código de produção.

### Histórico inicial do writer

Normalização de 27 fontes/testes/harness próprios pelo formatter sintático do
TypeScript instalado, com indentação de 2 espaços e UTF-8 sem BOM, antes da prova.
Comandos exatos e códigos separados: `tests-final.log`/`tests-final-result.json`
e `types-final.log`/`types-final-result.json` em `.tmp/stage2-u3/`.
**Prova ampla normalizada: 147/147 testes em 15 suites, exit 0, sem `forceExit`.**
Typecheck dessa execução: exit 2, seis diagnósticos de narrowing em um teste novo
e um módulo Skia ausente no prototype existente. Uma correção somente de teste
passou a usar o branch de rejeição explícito, sem `any`/cast para ocultar tipos;
após normalizar, prova focada de races: **13/13, exit 0**. Typecheck posterior:
**exit 2, somente um diagnóstico restante** de módulo Skia ausente. Nessa fase,
ainda não havia PASS global TypeScript. A prova atual do sucessor está no final.
Evidência: `test-types-corrected.log`, `types-corrected.log` e resultado JSON.

### Pré-requisito removido pelo tooling e restauração controlada

A instalação aprovada da ferramenta de browser adicionou três pacotes e removeu
nove extraneous. O log npm confirma remoção de Skia e transitivos usados pelo
prototype não pertencente a U3: `@shopify/react-native-skia`, `canvaskit-wasm`,
quatro pacotes native Skia, `react-reconciler`, seu `scheduler` e `@webgpu/types`.
O pacote não constava do package/lock WIP inicial. **A ausência nessa fase não
foi classificada como defeito preexistente**: a instalação de tooling causou a
remoção, embora o motivo da divergência anterior declaração/instalação não tenha
sido investigado fora do escopo.

A versão anterior 2.6.2 foi estabelecida por memória completa de instalação,
metadata do SDK e tarball oficial em cache. Duas restaurações exatas foram
explicitamente autorizadas, offline, `no-save`, `package-lock=false` e
`ignore-scripts`, sem escolher versão nova ou bypass de peers:

- Primeira: ERESOLVE; solver tentou renderer 19.3.0 contra React 19.2.3.
- Segunda: também restringiu React/renderer aos 19.2.3 previamente instalados;
  ENOTCACHED de metadata de `@expo/vector-icons`.

Ambas exit 1; package/lock e versões React/renderer/Playwright foram preservados.
Depois do congelamento da correção de fonte, uma **terceira restauração separada,
explicitamente autorizada, passou install 0/guard 0**, adicionando os nove pacotes
anteriores em 26 s. Usou resoluções do lock existente **habilitado**, `no-save`,
scripts desabilitados, cache preferencial e metadata do registro oficial, com
Skia 2.6.2 e pins exatos já instalados React/renderer 19.2.3 e vector-icons 15.1.1.
Não houve bypass de peers, versão nova, extração manual ou mudança de declaração.

**Estado atual: Skia 2.6.2 restaurado; package/lock e todos os 39 manifests/versões
dos pacotes declarados permaneceram iguais, inclusive Playwright 1.64.0. Os 38
hashes congelados também ficaram iguais.** O typecheck independente posterior
passou, sem esconder o side effect anterior. Skia permanece **não declarado**:
instalações npm futuras podem removê-lo novamente; tratar essa divergência como
follow-up separado, não acrescentar dependência de produção implicitamente.
Histórico: `restore-prerequisite-*`, `restore-constrained-*`; sucesso controlado:
`environment-before.json`, `environment-after.json`, `environment-result.json`.

```text
# cwd: frontend
npm test -- --runInBand --runTestsByPath __tests__/services/api.test.ts __tests__/services/credential-session-races.test.ts __tests__/services/session-consumer.test.tsx __tests__/storage/authStorage.test.ts __tests__/utils/api-error.test.ts src/modules/auth/__tests__/login.test.tsx __tests__/services/logout-coordinator.test.ts __tests__/services/logout-tombstone.test.ts __tests__/services/logout-consumers.test.tsx src/modules/dashboard/__tests__/home.test.tsx src/modules/dashboard/__tests__/dashboard.test.tsx src/modules/auth/__tests__/authService.test.ts __tests__/services/session-contexts.test.ts src/modules/auth/__tests__/reset-password-screens.test.tsx src/modules/usuario/__tests__/usuario-screen.test.tsx
npm run typecheck
```

### Navegador: resultado NÃO aprovado

Runner pinado 1.64.0, Node 24.14.0, Edge instalado 154.0.4258.62. Nenhum browser foi
baixado. Servidor sintético somente `127.0.0.1:4177`, dotenv desabilitado,
produção authStorage/API importada por entry de teste e bundler Metro instalado.
Não executa aplicação/backend/banco reais, nem prova commit PostgreSQL.

Tentativas preservadas: sandbox `spawn EPERM`; build raw Metro sem watch root;
correção de watch root; erro native bridge no carregamento; alias RNweb; uma
última correção explicitamente autorizada filtrou apenas premodule native
InitializeCore. **Última execução: 3/3 cenários falharam na carga de módulos,
exit 1**, com `__fbBatchedBridgeConfig is not set`. Nenhum cenário multiaba
chegou a produzir PASS. Não houve novos ciclos de reparo/rerun após esse limite.
Logs: `browser-*.log`, resultado final
`browser-authorized-bootstrap-result.json`. A harness permanece ferramenta
incompleta, não prova E2E; precisa de decisão específica antes de nova tentativa.

## Matriz U3: o que permanece aberto

| Gate | Evidência atual / pendência |
|---|---|
| U3-01–07 | Integração determinística de storage/API/consumers cobre ordenação, SID/encarnação, A→B, no replay e tombstone. Browser real compartilhado **pendente**, não substituído por shim. |
| U3-08/09 | Recovery de marcador durável testado com module reload e barreiras sintéticas. Commit remoto real antes de perda da resposta/queda **não comprovado**; nenhum PostgreSQL foi iniciado. |
| U3-10/11 | pageshow/visibility/AppState callbacks e ausência de hints testados em adapter. BFCache real, partições/origens reais e freeze de owner **pendentes**. Não prometer coordenação entre buckets diferentes. |
| U3-12/13 | Lock ausente/negado, deadline 7 s, marcador negado, record inválido e legado conservador testados localmente; matriz de browsers e rollout real continuam gates. |
| U3-14 | UI imediata e durabilidade atrás do refresh limitado têm barreiras locais/consumers reais. Sem promessa de saída durável instantânea em outras abas. |
| U3-15 | CAS/revogação estritos existentes não alterados. Replay genuíno com backend/HTTP/PostgreSQL real **não reexecutado**; aprovação anterior não é prova U3. |
| U3-16 | Cap/erros/coerência/queue/AppState do adapter local testados. Emulador/dispositivo real e capacidade com payload representativo **pendentes**. |
| Revisão e segurança residual | Revisão inicial encontrou U3-R1; uma correção e uma validação direcionada do sucessor passaram, sem segundo ciclo de revisão completa. Bearer/localStorage não mitiga XSS; sem cookies/BFF/CSRF novos ou aprovação de segurança de produção. |

## Próximo passo

Decidir a reparação da harness pelo pipeline web oficial do Expo/build controlado,
sem execução automática nesta entrega. Depois, autorizar provas reais de browser,
PostgreSQL/native/rollout e startup autoritativo. **U3, etapa 2 e segurança de
produção permanecem abertas.**
Os 138 históricos de U1/U2 não são prova nova de U3; os relatórios históricos de
U1/U2 não foram reescritos. Resend e entrega real da etapa 1 continuam adiados.

## Correção única U3-R1 após revisão independente

A revisão independente preservou 38/38 hashes, confirmou 147/147 testes em 15
suites, exit 0, e encontrou uma falha necessária: no recovery pós-envio, a
persistência do envelope unknown antecedia a invalidação local. Se essa escrita
fosse negada, o record durável permanecia `refreshInFlight`, o runtime continuava
válido e um 200 protegido separado podia publicar dados de A. O relatório
original permanece em `.tmp/stage2-u3/independent-verification.json`.

Uma transação de correção delimitada foi autorizada. O RED novo reproduziu a
exposição de `privateA` em dois cenários: HTTP possivelmente enviado sem resultado
e resposta HTTP válida cuja publicação fosse negada; em ambos o marcador antes
do envio foi confirmado e somente a escrita unknown posterior foi negada.

Agora, identity fence invalida o owner local **sincronamente antes dos awaits de
recovery**, avança epoch e notifica consumidores. Estado unknown local não é
substituído por releitura de `refreshInFlight`/valid da mesma encarnação; sair da
quarentena exige encarnação nova verificável/instalação completa legítima. Falha
da escrita preserva o marcador e retorna `SessionRequestError('unknown')` com
`sessionDurability: 'unconfirmed'` — confirmação de durabilidade **local**, não
do resultado remoto. Não se converte em indisponibilidade pré-envio, não se
reenviará N e callback antigo não modifica uma cápsula B mais nova.

GREEN focado: 4/4, incluindo Root/Home reais, 200 pendente que não publica,
resume/getters/novo request sem retry e fence de B num boundary sintético de
owner-loss/notificação perdida. Esse último boundary não prova queda real de aba
ou coordenação entre processos native.

Após normalização somente dos quatro arquivos da correção, uma execução final
exata das mesmas 15 suites passou **151/151, exit 0**, sem `forceExit`. Antes da
restauração separada, o typecheck do writer teve **exit 2, somente Skia ausente**,
sem diagnóstico próprio da correção.
Nenhuma nova execução browser ou restauração de dependência foi feita durante
a correção de fonte. Evidências: `correction-red-data.log`,
`correction-green.log`, `correction-owner-ui.log`, `correction-tests.log`,
`correction-types.log`, `correction-run.json`, `correction-normalization.json` e
sucessor `corrected-final.json`. Baseline, manifesto e achado originais foram
preservados. Não houve outra correção de fonte ou loop de revisão completa.

### Resultado independente atual do sucessor

`.tmp/stage2-u3/correction-independent-verification.json` confirma:

- **151/151 testes, 15/15 suites, exit 0**, sem `forceExit`; avisos de `act` não ocultados.
- **TypeScript global exit 0, zero diagnósticos**, após a restauração de ambiente separada.
- **38/38 hashes estáveis**, cinco caminhos corrigidos e 33 preservados; 31/31
  snapshots originais iguais; diff check próprio exit 0.
- U3-R1 validada: quarentena local síncrona/sticky, 200 pendente bloqueado,
  durabilidade unknown não confirmada quando a escrita falha, B preservada.

Esta é validação direcionada da **única correção autorizada**, não segunda revisão
adversarial nem PASS da matriz real. A entrega documental posterior preserva os
35 hashes não documentais do sucessor em `documentary-closure.json`.
