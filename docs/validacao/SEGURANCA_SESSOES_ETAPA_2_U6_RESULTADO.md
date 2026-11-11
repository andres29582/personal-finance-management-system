# U6: preparação local P4 concluída; aceite remoto aberto — 2026-10-15

**LOCAL_PREPARATION_COMPLETE / PURE_PASS; P4 REMOTE_NOT_TESTED / OPEN;
U6/etapa 2 OPEN; produção BLOCKED.** P3 permanece LOCAL_PASS_BOUNDED / CLOSED
somente para o aceite local já delimitado; nenhuma prova histórica foi renovada.

O candidato privado `efe88b52e9fee8b67e2574dd7e6d1683cb985085fdea86af50402df215a555b9`
concluiu os seis checks offline padrão (153.728 ms), com U6 em 20.031 ms dentro
do cap original de 60.000 ms. U6 separado: 40/40, sem skips Windows; P4 17/17,
configuração 107/107, deployment 8/8, tipos, poll, dependências/lock 1.64.0 e
guard de plataforma passaram. A otimização é somente de testes, sem mudar
runtime, caps ou Windows Job. Linux real, instalação limpa, PG16 e E2E seguem
**NOT_TESTED**. O readback independente conferiu o manifesto completo de 1.001
arquivos e seus vínculos de hashes; não houve defeito nos nomes UTF-8/DOCX.

[Estado atual, hashes, evidências locais privadas e limites de publicação](SEGURANCA_SESSOES_ETAPA_2_P4_CI.md).
A política de artefato público por sete dias, logs por 90 dias e custódia pelo
usuário foi aprovada, mas publicação exata, bootstrap main/default branch,
CI automática incidental e execução manual de 45 minutos continuam sem aprovação.
A revisão de privacidade foi delimitada, não certificação global de segredos
nem auditoria backend completa. Nenhum commit, push ou publicação nesta unidade.

Estas duas atualizações documentais são posteriores ao readback: alteram a
identidade canônica, não o snapshot privado congelado. Nenhum teste ou execução
nativa foi iniciado para este registro. As seções abaixo são históricas e foram
preservadas integralmente, inclusive contagens e pendências então válidas.

---

# U6: preparação local implementada e provas parciais

## P4: preparado localmente; prova remota pendente — 2026-10-14

**P4 IMPLEMENTED_LOCAL / PURE_PASS; REMOTE_NOT_TESTED / OPEN. U6/etapa 2 OPEN;
produção BLOCKED.** Workflow manual dedicado, adapter negativo PG16 restrito e
prova fechada/readback preparados; P4 puro 17/17, U6 puro 39/39 e tipos completos
sem emissão passaram localmente. Sem PostgreSQL/CI/upload/commit/push nesta unidade.
[Escopo, prova final, rollback e aprovações de publicação](SEGURANCA_SESSOES_ETAPA_2_P4_CI.md).

P3 LOCAL_PASS_BOUNDED permanece inalterado: sete provas históricas/23 assertions
+ U5D atual/10; não é novo lote 8/8. As seções abaixo preservam o histórico.

## P3: aceite local delimitado encerrado — 2026-10-14

**P3 LOCAL_PASS_BOUNDED / CLOSED somente para aceite local; P4 OPEN;
U6/etapa 2 OPEN; produção BLOCKED.** Oito casos coordenados qualificados em
execuções aprovadas de **candidatos diferentes**, totalizando 33 assertions:
sete provas históricas/23 assertions + U5D atual/10. Não é uma nova execução
8/8 do candidato atual, receipt, aceite produtivo ou autorização de CI/deploy.

| Prova qualificada | Resultado e identidade |
| --- | --- |
| Lote histórico, sem rerun | C6 4/4, C6_SQL_ERROR 2/2, A8 1/1, C7C8 2/2, U5 11/11, U5B 2/2, U5R 1/1; candidato `ef48f8f11565b101a834adec3af2977b78acc20057846ecd8ad064ce27fad569` |
| Única tentativa atual U5D coordenada, sem retry | LOCAL_PASS 10/10, 199,04 s; candidato `9816c7b27de48caab289e73a049ac87cd4d8fc18cbd33ee2d52518858d2359be`; 850 paths inalterados durante a tentativa |

[Relatório histórico](../../.tmp/p3-corrected-native-acceptance-20261013/final-report.json),
SHA256 `63bb13ee63b5d9ad6bfe4c451d238594fb0e800f04ff14f6641857cd1c8df722`;
[relatório U5D atual](../../.tmp/u5d-final-native-20261014/final-report.json),
SHA256 `4521747d065316482b3dbbfcb43ffe5ce37d14e083cd18f31a73b7de92e5cee1`;
[manifesto atual](../../.tmp/u6-zvw7tO/portable/manifest.json), SHA256
`485881425f26faeb0d563fd02f7f90d4eb5189e64facee34f14862fa11b32180`.
Root próprio: `.tmp/u6-runtime-8586d90a-98fd-46b0-ab64-209672baf281`.

**Aplicabilidade verificada independentemente, por leitura:** inventário completo
de 850 paths, exatamente sete alterados entre candidatos, nenhum removido.
O corpo extraído de confinamento é byte a byte idêntico (`runner.cjs:193–195`
encaminha para `u6-owned.cjs:7–22`); marker/env novos limitam-se ao ramo U5D
(`runner.cjs:656–673`). Guard de deployment em `u5-deployment.cjs:35–74`,
sem alteração da lógica após o primeiro import pg; demais diferenças são testes,
README e dois documentos. Não foi encontrada mudança concreta de comportamento
compartilhado que exija repetir as sete provas; elas continuam históricas,
não renovadas. Qualificação independente registrada também no Engram #1617.

**U5D real e limites:** raw/import/runtime concordam em 10/10; nove operações
nativas e dump/restore têm exit 0. Preflight de contrato registra 11 rejeições,
limites idle aceitos e igualdade de tipos/microssegundos UTC e America/Sao_Paulo;
não são assertions extras. PostgreSQL próprio PID 6564 teve criação/path/root e
listener `127.0.0.1:55434` observados 25 vezes, depois ausente; cleanup final sem
processos próprios nem portas reservadas ocupadas. PostgreSQL externo/5432
manteve criação/serviço e demais campos observáveis, sem conexão a 5432;
`ExecutablePath`/`CommandLine` externos são null, não identidade completa.

Exit do coordenador observado pelo observer é **null, não 0**; wrapper exit 0.
A admissão nativa fechada de LOCAL_PASS exige owner exit 0, IPC owned/complete,
import válido e Job Object vazio após saída, validados no caminho mantido.
Transcrição IPC bruta do guardian não foi persistida: não há prova independente
adicional desse canal. `backendExited=false` é coerente: U5D não inicia Nest,
apesar do texto genérico de scope no runtime-proof. Não houve reteste de outros
casos, CI, banco da aplicação, ativação ou produção.

Este fechamento muda apenas documentos **após** a tentativa qualificada;
não reivindica que o inventário pós-documentos conserve o hash do candidato
executado. [Readback estrutural e backups exatos](../../.tmp/p3-local-closure-20261014-6eaf/readback.json).
Sem novos testes/runtime neste fechamento. Todas as seções abaixo são históricas,
inclusive falhas e pendências então válidas; nenhum relatório original foi alterado.
**Próximo passo: P4 permanece pendente**, sem autorização implícita de execução.

## P3: guard U5D corrigido; novo aceite nativo pendente — 2026-10-14

**Correção autorizada + regressão pura; P3/P4/U6/etapa 2 OPEN; produção BLOCKED.**
Não houve novo PG/Nest/Expo/browser ou execução nativa U5D nesta unidade.
O root legado agora exige forma canônica exata `.tmp/session-harness-u5d-<32hex>`;
o coordenado exige `.tmp/u6-runtime-<UUID>`, binding fechado com case U5D e
marker exclusivo `u5d-owner.json` igual ao binding recebido do runner já validado
por IPC. O runner encaminha esse binding somente ao child U5D. Não há OR de
prefixos permissivo nem novo provisionador. DB/roles/markers, confirmações,
três identidades restritas e gates SQL existentes permanecem inalterados.

O confinamento mantido do runner foi movido, sem mudar seu corpo, para
`u6-owned.cjs` e reutilizado: ancestrais sem symlink/redirecionamento realpath;
U5D também exige diretório real, pai exato repo/.tmp, root absoluto canônico,
case/root/owner coincidentes, UUID/SHA válidos e nenhum campo extra. Testes VM
executam a entrada real até antes do primeiro import pg; não simulam PASS SQL.
RED sobre backup exato rejeitou o coordenado (exit 1); GREEN: **8/8** (exit 0),
incluindo legado/coordenado válidos e rejeições de owner/case/root, bindings
malformados, siblings/traversal/paths arbitrários, symlinks e redirecionamentos.
U6 pura: **39/39**, exit 0, com filhos Node sintéticos. A primeira execução na
sandbox teve **37/39**, exit 1, por dois spawn EPERM; a repetição pura com
escalonamento revisado passou, sem serviços DB ou execução nativa de casos.

**Aplicabilidade das sete provas anteriores:** as 23 assertions continuam
qualificadas no candidato histórico do lote abaixo. O wrapper compartilhado
`runner.cjs` e seu helper mudaram de bytes para os oito seletores, mas o corpo
de confinamento e os caminhos não U5D foram preservados; somente U5D recebe
novo marker/env/guard. As regressões puras delimitam esse impacto; não renovam
as sete provas nativas nem concedem PASS nativo ao novo candidato.

Backups exatos do WIP, RED/GREEN, logs, inventário após documentos,
checks offline e readback estão em `.tmp/u5d-root-correction-20261013/`.
O `proof.json` original e seus testes pertencem ao candidato anterior, preservado.
Em 2026-10-14, foram reparados somente os acentos desta nota e do plano:
o pipe PowerShell→Node havia substituído caracteres por `?` literal (U+003F).
Os executáveis permanecem byte a byte iguais; testes não foram repetidos.
`utf8-20261014/proof.json` registra o novo inventário, readback UTF-8 e manifesto
compiler offline atual. Isso não transforma testes anteriores em novo reteste.
Os relatórios antigos não foram alterados. Rollback: restaurar somente os sete paths registrados em
`baseline.json`, a partir de `baseline/`, nunca HEAD ou WIP alheio.

**Próximo passo exige nova aprovação:** somente U5D coordenado no candidato
final, uma tentativa sem retry; run cap **780000 ms**, cancel/cleanup grace
**332000 ms**, mais até **20 s** de readback do guardian. Pode criar apenas
cluster/roles/DBs descartáveis próprios e conservar seus artefatos; cleanup
verifica processos/portas/fonte e identidade externa. Não autoriza rerun das
sete provas, CI, produção ou fechamento P3.


## P3: lote nativo aprovado — 2026-10-13

**Sete casos LOCAL_PASS; U5D bloqueado. Aceite P3/P4/U6/etapa 2 OPEN; produção BLOCKED.**
Foram oito invocações únicas, na ordem aprovada, uma por seletor, sem retry:
C6 4/4, C6_SQL_ERROR 2/2, A8 1/1, C7C8 2/2, U5 11/11, U5B 2/2 e U5R 1/1
somam 23 assertions aprovadas e sete importações qualificadas. U5D não comprovou
suas dez assertions: `u5-deployment.cjs:42–46` aceita somente o prefixo legado
`.tmp/session-harness-u5d-`, rejeitando o root coordenado `.tmp/u6-runtimeUUID`;
stderr confirma essa falha (deployment exit 1; coordenador exit 2).

[Relatório do lote](../../.tmp/p3-corrected-native-acceptance-20261013/final-report.json),
SHA256 `63bb13ee63b5d9ad6bfe4c451d238594fb0e800f04ff14f6641857cd1c8df722`:
readback independente confirmou os oito checksums de manifestos e os 38 hashes
de artefatos relatados. Os 850 paths do candidato
`ef48f8f11565b101a834adec3af2977b78acc20057846ecd8ad064ce27fad569`
ficaram inalterados durante o lote; esta atualização documental posterior muda
os bytes e não reivindica identidade com esse hash.

O cleanup persistido não registra processos próprios nem portas reservadas
remanescentes; PostgreSQL externo na porta 5432, PID 7220, manteve criação/serviço
inalterados (`executablePath: null`). Não há transcrição IPC bruta do guardian:
não se declara prova adicional desse canal. O relatório da tentativa anterior,
SHA256 `38f4475194c28f9029b6f1b6cefb7312a87ca59681d6df6568986d8631f4bcba`,
permanece preservado. As seções abaixo são históricas, não o estado atual do lote.

**Próximo passo pendente de aprovação:** correção direcionada do guard de root U5D
com regressão, preservando o confinamento; não remover o guard. Nenhuma correção,
nova execução nativa, CI ou produção está autorizada por esta nota.


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



**P3 — 2026-10-13: IMPLEMENTED / PURE_PASS / NATIVE_NOT_TESTED.**
Código coordenado dos oito seletores implementado; aceite nativo continua OPEN,
zero execuções PG/Nest/Expo/browser nesta unidade. P4/U6/etapa 2 OPEN; produção BLOCKED.
Registros parciais anteriores abaixo são históricos, não o estado atual do código.

## P3: implementação coordenada — 2026-10-13

Bridge real em `u6.cjs` delega ao runner mantido: C6, C6_SQL_ERROR, A8, C7C8,
U5, U5B, U5R e U5D. OFFLINE_CHECKS permanece default; TARGET_VALIDATION BLOCKED.
Sem aprovação explícita de caso/candidato/caps ou preflight válido: BLOCKED,
zero launches. Uma invocação seleciona somente um caso, sem retry; os demais
permanecem NOT_TESTED. Schema fechado v2 não reinterpreta manifestos históricos v1.

IPC fechado owned/go/cancel/complete vincula caso, token, root, candidato U6 e
snapshot do runner; fontes comuns são comparadas por path/hash. O guardian
Windows atribui Job Object sem breakaway ANTES do go. Job vazio após saída do
owner é obrigatório: descendente remanescente produz falha e cleanup do job,
nunca PASS. No timeout, cancelamento cooperativo permite finally; ao esgotar
a grace, abandonar o guardian fecha somente o job próprio, sem kill por PID amplo.
Importadores por caso exigem provas privadas/assertions e cleanup, não apenas exit 0.
Caps agregados são aplicados a comandos por fase e registrados/validados em
`aggregateCaps`; watchdog de execução e grace permanecem limites separados.

### Prova atual e último comando recuperado

Não havia teste/compiler/guardian anterior ativo na inspeção scoped. O último
normalizador interrompido não deixou log/exit final: seu resultado NÃO foi inferido.
Normalização scoped foi concluída novamente antes de congelar/verificar os bytes.
Primeira batch atual no sandbox: 34/36, exit 1, dois EPERM de spawn sintético;
não é falha nativa nem foi apagada. Escalada revisada pura: 36/36, exit 0.
Após correção delimitada de encerramento do guardian e registro dos caps,
a batch final atual passou **37/37, exit 0, 2.271 ms**. Inclui all-eight dispatch
com doubles + oito importadores e três checks owned (dois usam Node/descendente
sintético real no Windows). Doubles não qualificam nenhum caso PG/Nest/browser.

| Check real | Resultado |
|---|---|
| `node backendnest/test/session-harness/u6.spec.cjs` | 37/37; exit 0; cap interno dos cenários owned 60 s |
| Configuração, cinco suites selecionadas pelo coordenador | 107/107; exit 0; cap 180 s |
| Deployment puro | 4/4; exit 0; cap 60 s |
| Polling puro | PASS; exit 0; cap 60 s; sem browser |
| Tipos completos/build noEmit, sem incremental | exit 0/0; cap 120 s cada |

Comando offline inicial atual: `node backendnest/test/session-harness/u6.cjs --checks=types-full,types-build,config-unit,deployment-unit,poll-unit`,
exit 0 em 47.585 ms. Manifesto privado/portable local
`.tmp/u6-K0XXwi/portable/manifest.json`, SHA256
`ff26b762cd635ccb8ef53485c48d6a476e4487f609d54661e49c4758e4fb5d13`.
Esse manifesto precede o pequeno ajuste final de caps/dispatch-test/documentação;
não é o candidato final nem aprovação nativa. A verificação final de compiladores
após documentação e o inventário final ficam em
`.tmp/p3-complete-20261013/final-offline.log` e `final-source.json`.
`globalTypes` só PASS com ambos os compiladores atuais e hash de fonte correspondente;
sem ambos, permanece BLOCKED. Manifesto runtime não herda PASS de compilador antigo.
Logs/status atuais e `verified-code.json` preservam os bytes de código verificados;
backup exato anterior à continuação está em `.tmp/p3-complete-20261013`.

### Forecast nativo futuro — NÃO autorizado nem executado

Máximo oito invocações independentes, uma por seletor, sequenciais na ordem abaixo;
parar na primeira falha e registrar restantes NOT_TESTED, zero retry. Aprovação
precisa nomear candidato final, casos, custos e caps. Usar instalação existente
PG18.3/Windows e Edge somente nos três casos browser; cluster novo por invocação,
owner restrito, loopback 55434/4318/4178, observar 5432 sem conectar. Sem dotenv
privado/appDB/Resend/CI/deploy/instalação/serviço Windows. Escalada, se necessária,
será revisada antes do launch; não contornar restrições.

| Caso | Setup | Nest | Export | Goals | Cleanup | run-ms | cleanup-ms (grace adicional) |
|---|---:|---:|---:|---:|---:|---:|---:|
| C6 | 420 s | 120 s | 0 | 180 s | 150 s | 900000 | 332000 |
| C6_SQL_ERROR | 420 s | 0 | 0 | 180 s | 150 s | 780000 | 332000 |
| A8 | 420 s | 120 s | 180 s | 130 s | 150 s | 1030000 | 332000 |
| C7C8 | 420 s | 120 s | 0 | 120 s | 150 s | 840000 | 332000 |
| U5 | 420 s | 120 s | 0 | 180 s | 150 s | 900000 | 332000 |
| U5B | 420 s | 120 s | 180 s | 130 s | 150 s | 1030000 | 332000 |
| U5R | 420 s | 120 s | 180 s | 130 s | 150 s | 1030000 | 332000 |
| U5D | 420 s | 0 | 0 | 180 s | 150 s | 780000 | 332000 |

run-ms inclui 30 s de margem além das fases; soma dos oito watchdogs = 7.290 s
(121,5 min), NÃO duração esperada nem teto wall-clock de toda a batch.
Grace adicional de 332 s só no caso cancelado; guardian readback/saída tem até
20 s adicionais. Preflight/inventário e importação local síncrona não têm teto
wall-clock global; não anunciar 390 s ou batch global limitada inexistente.
Os caps foram exercitados com doubles/sintéticos, não calibrados com os oito
casos nativos; preflight/plataforma/ownership sem confirmação bloqueiam execução.

Comando exato por linha, somente DEPOIS da aprovação do hash obtido de
`final-source.json` (substituir HASH_FINAL pelos 64 caracteres aprovados):

```powershell
node backendnest/test/session-harness/u6.cjs --mode=DISPOSABLE_RUNTIME --case=C6 --approve-case=C6 --approve-candidate=HASH_FINAL --run-ms=900000 --cleanup-ms=332000
node backendnest/test/session-harness/u6.cjs --mode=DISPOSABLE_RUNTIME --case=C6_SQL_ERROR --approve-case=C6_SQL_ERROR --approve-candidate=HASH_FINAL --run-ms=780000 --cleanup-ms=332000
node backendnest/test/session-harness/u6.cjs --mode=DISPOSABLE_RUNTIME --case=A8 --approve-case=A8 --approve-candidate=HASH_FINAL --run-ms=1030000 --cleanup-ms=332000
node backendnest/test/session-harness/u6.cjs --mode=DISPOSABLE_RUNTIME --case=C7C8 --approve-case=C7C8 --approve-candidate=HASH_FINAL --run-ms=840000 --cleanup-ms=332000
node backendnest/test/session-harness/u6.cjs --mode=DISPOSABLE_RUNTIME --case=U5 --approve-case=U5 --approve-candidate=HASH_FINAL --run-ms=900000 --cleanup-ms=332000
node backendnest/test/session-harness/u6.cjs --mode=DISPOSABLE_RUNTIME --case=U5B --approve-case=U5B --approve-candidate=HASH_FINAL --run-ms=1030000 --cleanup-ms=332000
node backendnest/test/session-harness/u6.cjs --mode=DISPOSABLE_RUNTIME --case=U5R --approve-case=U5R --approve-candidate=HASH_FINAL --run-ms=1030000 --cleanup-ms=332000
node backendnest/test/session-harness/u6.cjs --mode=DISPOSABLE_RUNTIME --case=U5D --approve-case=U5D --approve-candidate=HASH_FINAL --run-ms=780000 --cleanup-ms=332000
```

O hash é calculado por `candidateHash(inventory())`, não pelo SHA256 dos bytes
pretty-printed de final-source.json. Qualquer alteração invalida essa aprovação.
Falta aceite nativo atual qualificado dos oito casos com cleanup/readback final;
P3 não está fechado. P4 e produção permanecem fora do alcance.
GitNexus upstream dos helpers/runner: UNKNOWN (não indexados), nunca LOW;
callers manuais limitados a runner, coordenador e testes, afetando oito casos.
Reversão: somente arquivos desta unidade a partir do backup exato, nunca HEAD,
sem apagar provas históricas ou WIP alheio. Nenhum commit/push foi criado.

## Histórico preservado da fundação parcial

## P3: fundação pura parcial — 2026-10-13

`u6-runtime.cjs` oferece seleção finita, aprovação vinculada a caso/hash/limites,
preflight, supervisor assíncrono injetável de uma tentativa e protocolo novo v2
com root/caso/token/candidato. Valida projeção fechada C6 ou negativo SQL,
identidade esperada do snapshot do runner e hashes sobre fontes comuns; não exige
igualdade de arrays dos dois inventários diferentes. Casos não selecionados são
NOT_TESTED. Schema v1 de U6 não foi reinterpretado.

**Não há adapter nativo em `u6.cjs`.** Doubles puros não provam handshake nativo
nem importadores completos dos artefatos privados. A8/C7C8/U5/U5B/U5R/U5D são
recusados na fundação; C6/C6_SQL_ERROR também não estão liberados para dispatch
nativo coordenado. Falta binding real runner/coordenador, importação fechada dos
oito casos, ownership/readback dos descendentes Expo/Playwright e caps agregados.
Aceite completo de P3 não foi reduzido. TARGET_VALIDATION permanece BLOCKED.

Runner verifica cancelamento antes/depois de comandos e antes de startup/fim de
caso. IPC privado do parent pede parar a próxima operação; a corrente termina no
cap existente e o owner conclui `finally`, sem ser morto pelo supervisor. O IPC
legado do runner ainda não implementa binding fechado v2: não ligar bridge
permissivo. Cleanup tenta separadamente comandos, Nest, web, PG e portas, mesmo
quando uma fronteira falha. Readbacks finais de fontes/external também são
tentados; erro agregado continua falha, nunca PASS. Comportamento nativo novo
permanece NATIVE_NOT_TESTED.

### Checks atuais, uma batch pura

RED inicial: `node backendnest/test/session-harness/u6-runtime.spec.cjs`, raiz,
exit 1, MODULE_NOT_FOUND antes de implementar o módulo. Primeiro launcher final
foi bloqueado por EPERM no spawn Node em 3 ms, exit -1; **nenhum teste executado**.
Evidência preservada `.tmp/p3-coordination-20261013/pure-proof.json`, SHA256
`933509077829f3e6ea27d2f7be246b8203028e972c89fe1d7946c28e46fbff88`.
Escalada revisada restrita a pure/noEmit executou a mesma fonte, sem correção
intermediária, serviços, rede ou retry nativo.

| Comando real | Cwd / cap | Resultado / duração do processo |
|---|---|---|
| `node backendnest/test/session-harness/u6-runtime.spec.cjs` | raiz / 60 s | exit 0; 6/6; 246 ms |
| `node backendnest/test/session-harness/u6.spec.cjs` | raiz / 60 s | exit 0; 16/16; 328 ms |
| `node backendnest/test/session-harness/u5-deployment.spec.cjs` | raiz / 60 s | exit 0; 4/4; 179 ms |
| `node backendnest/test/session-harness/u5-poll.spec.cjs` | raiz / 60 s | exit 0; polling PASS; 5.393 ms; sem browser |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json` | backendnest / 120 s | exit 0; 13.764 ms |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json` | backendnest / 120 s | exit 0; 6.644 ms |

P1 tem tipos completos/build novamente PASS neste candidato, não por hashes
antigos. `globalTypes` do manifesto U6 v1 continua BLOCKED: falta propagação com
prova atual fechada. São 26 testes Node mais polling, não a antiga batch de 119.

Prova privada `.tmp/p3-coordination-20261013/authorized-pure/pure-proof.json`,
SHA256 `027aafc373c900f790e6db95d5e2d623f4526818e4471263f796e116b2df4f99`.
`compiler-candidate.json` SHA256
`e5058701ab412e1f253aaab35293a8ba39c57ab116aa3dfd880624886b90ce8e`;
readback backend inalterado após a batch. `candidate.json` completo da batch:
SHA256 `052ef6765ed94526ca51141128c82fbaeb771e0cd2838f5ba70bad7efbd67512`.
Documentação foi atualizada depois; seus bytes novos não pertencem àquele freeze.
Logs/backup/bloqueio de permissão são preservados, sem publicação.

### Forecast futuro: proposta, não aprovação nem caps implementados

| Caso | Setup/preflight | Nest | Export | Goals | Cleanup | Total proposto |
|---|---:|---:|---:|---:|---:|---:|
| C6 | 420 s | 120 s | — | 180 s | 150 s | 870 s |
| C6_SQL_ERROR | 420 s | — | — | 180 s | 150 s | 750 s |
| A8 | 420 s | 120 s | 180 s | 130 s | 150 s | 1.000 s |
| C7C8 | 420 s | 120 s | — | 120 s | 150 s | 810 s |
| U5 | 420 s | 120 s | — | 180 s | 150 s | 870 s |
| U5B / U5R | 420 s | 120 s | 180 s | 130 s | 150 s | 1.000 s cada |
| U5D | 420 s | — | — | 180 s | 150 s | 750 s |

Setup reserva seis comandos de até 60 s, confirmações de saída e margem para
preflight/portas. Cleanup precisa de PG-stop 60 s + external-after 60 s + Nest
12 s + filhos 5 s + margem finita para web/portas. Grace de cancelamento proposto:
**332 s**, corrente até 180 s + confirmação 2 s + cleanup 150 s. Web/ports ainda
precisam de caps, e ownership precisa de prova; viabilidade final BLOCKED. Não há
teto histórico inventado de 390 s. Futura execução requer seleção/candidato e
limites explicitamente aprovados, uma tentativa, sem retries; aprovação desta
implementação não autoriza nenhuma dessas execuções.

### Alcance e reversão

GitNexus qualified upstream de command/cleanup/backendStart/main/helper novo:
target-not-found/UNKNOWN, não LOW. Alcance manual do runner: os oito casos.
Nenhum commit/push/RDD/CI/produção/migration/Resend ocorreu. Código novo:
`u6-runtime.cjs`, `u6-runtime.spec.cjs`; runner alterado somente nesta fronteira.
Restaurar runner do backup exato
`.tmp/p3-coordination-20261013/backendnest/test/session-harness/runner.cjs`
(SHA256 `7efb04599084747ca9971f31502b4b47aab29f06c931489e6892960d81fe82a6`),
remover somente módulos novos e parágrafos P3 novos. Não usar HEAD, não remover
WIP alheio/provas. Backups ignorados preservam bytes originais; UTF-8 sem BOM.

**Fechamento documental — 2026-10-13: P1 PASS local; P2 LOCAL_PASS delimitado: puro 16/16,
negativo SQL nativo 2/2 e novo C6 positivo 4/4, em unidades separadas.
P3/P4 OPEN; produção BLOCKED; U6/etapa 2 OPEN.**
[Ficha P2 e limitações](#p2-prova-local-delimitada--2026-10-12).
Os estados anteriores abaixo são históricos, não foram reclassificados.

**2026-10-12 — recorte local implementado; verificação parcial PASS e restore C6
real PASS 4/4 após a flag fail-fast. Produção BLOQUEADA; U6/etapa 2 ABERTAS.**
O coordenador offline não instala dependências,
não lê dotenv privado e não inicia DB, HTTP, browser, email ou deploy. Não existe
aceite de prontidão global nem autorização para aplicar 0016/0017 na aplicação.

**Atualização P1 — 2026-10-12:** TS2352 corrigido somente no spec; Jest focado 1/1 e tipos backend completos/build noEmit PASS local. [Ficha técnica e limites](#p1-tipos-backend-completos-corrigidos--2026-10-12). [Plano das quatro pendências](../planejamento/SEGURANCA_SESSOES_ETAPA_2_U6_PENDENCIAS_PLANO.md): P1 concluído; P2–P4 OPEN. Provas históricas abaixo preservadas, sem aprovação global.

## P2: prova local delimitada — 2026-10-12

**P2 LOCAL_PASS, não prontidão global.** Uma tentativa mantida `C6_SQL_ERROR`
e uma tentativa nova `C6` foram executadas em clusters privados novos, após
inspeção independente. PG/clients observados 18.3; Node v24.14.0; sem retry.
Datas de logs em UTC são 2026-10-13; data local desta ficha é 2026-10-12.

### Comandos e contagens independentes

Cwd: raiz do repositório, dependências previamente instaladas.
Estas são tentativas realizadas, não instrução de reexecução automática:

```powershell
node --test --test-timeout=120000 backendnest/test/session-harness/u6.spec.cjs
node backendnest/test/session-harness/runner.cjs C6_SQL_ERROR
node backendnest/test/session-harness/runner.cjs C6
```

| Unidade | Resultado observado |
|---|---|
| Puro P2 | 16/16, exit 0, 141,9025 ms. Falhas anteriores 14/16 e 15/16 e RED permanecem em seu alcance histórico. |
| Negativo mantido | Runner exit 0, sem signal, 33.325 ms; duas fases nativas esperadas, 2/2, cada `pg_restore` exit 1/sem signal/classe `duplicate_table`. |
| Novo C6 positivo | Runner exit 0, sem signal, 60.233 ms; 4/4 fixtures, uma aceita e três negadas. Startup Nest 26.813 ms; goals 3.722 ms. Não somar ao C6 histórico. |

### Negativo: SQL, controle e qualificação atual

Archive schema-only `-Fc` gerado no cluster novo. O cabeçalho declara oito
entradas totais de metadados; `pg_restore --list` seleciona exatamente três
entradas TABLE, reordenadas e validadas como `before/error/after` via `--use-list`.
Fonte/fail-fast/controle usam schemas `public` recém-criados no mesmo DB privado
marcado `finance_e2e_*`, owner único restrito e guards/membership inalterados.

Com `--exit-on-error --no-owner --no-privileges`: `before` existe, `error` e seu
marcador original são preservados, `after` não existe. O controle em schema
destino fresco, sem apenas `--exit-on-error`, recebe o mesmo erro e cria `after`.
São duas fases fixas, não retries; sem `--clean` ou `--single-transaction`.
Continuação C6 normal HTTP/autoridade: **0/0**. Timeout, sinal, erro de conexão,
binário, archive inválido, permissão inesperada ou diagnóstico extra não qualificam.
`observedSqlState` é **null em ambas**: a classe esperada é `duplicate_table`
(código conhecido 42P07), mas o código numérico não foi observado no stderr.

**Qualificação atual separada:** SQL 2/2, guardas do runner e cleanup final
qualificam o aceite local delimitado de P2. O relatório original conserva
`NATIVE_NEGATIVE_PASS_INDEPENDENT_QUALIFICATION_INCOMPLETE`; ele não foi editado.
A observação independente adicional de PID/criação/listener **durante** o
negativo continua NOT_TESTED, sem reconstruir fase/timestamp ausentes.
O observer capturou PID -16212, campo porta 5432 e listen address vazio, não um
listener TCP. [PostgreSQL 18.3, miscinit.c](https://github.com/postgres/postgres/blob/REL_18_3/src/backend/utils/init/miscinit.c#L1352-L1363)
codifica PID negativo para backend standalone, positivo para postmaster e deixa
listen address vazio no standalone. Isso não prova a causa específica `initdb`.

Separadamente, os logs/opções reais ancoram PG PID positivo 20604 em
127.0.0.1:55434, startup 01:55:16.245 UTC e shutdown 01:55:33.766 UTC.
Cleanup confirma pidfile ausente, processos próprios/listeners reservados
ausentes e snapshots OS PostgreSQL/external antes/depois idênticos. Não houve
query à aplicação/5432. ExecutablePath externo foi null, portanto não verificado.
Não houve retry do negativo nem promoção da observação adicional a PASS.

### Positivo novo: HTTP, restore e observação ao vivo

Nest/AppModule real, 17 migrations no DB descartável, dump/restore nativo exit 0
com `--exit-on-error --no-owner --no-privileges`. Autoridade bruta, microsegundos
tipados e metadados de schema preservados exatamente. `active`: 200/no-touch;
`idle-expired`, `absolute-expired`, `revoked`: 401 com respectivamente
`AUTH_SESSION_IDLE_EXPIRED`, `AUTH_SESSION_ABSOLUTE_EXPIRED`,
`AUTH_SESSION_REVOKED`, sem renovar autoridade/deadlines.

Nesta tentativa, observação OS ao vivo confirma PG PID 31584/criação/listener
127.0.0.1:55434, ancorados no startup; Nest PID 29116/criação/listener 4318,
parent runner 28868. Cleanup: PG/Nest/descendentes próprios ausentes, portas
4178/4318/55434 livres, shutdown/pidfile confirmados, external 5432 inalterado.
ExecutablePath externo null continua limitação; não é verificação de executável.
Essa observação positiva não preenche a observação negativa ausente.

### Evidência privada e identidade dos bytes executados

Links são locais privados para readback; não são autorização de upload.

| Evidência | SHA256 |
|---|---|
| [Puro: proof.json](../../.tmp/p2-realm-Qd7hhZ/proof.json) | `7dd8f3db6595efc7db2209c61fde536943bbac91df9a5961ffd5428772d1aeff` |
| [Negativo: SQL](../../.tmp/session-harness-c6_sql_error-a0067e9dbdc94d79ba4f5407aef0c60f/c6-sql-error-proof.json) | `d4bb1e16d59389b8b68580518a5c1d08cd7cb89d0aae4bebce9558eabd21b5f0` |
| [Negativo: runtime](../../.tmp/session-harness-c6_sql_error-a0067e9dbdc94d79ba4f5407aef0c60f/runtime-proof.json) | `d4c1929bff689b082a36147fd11f4635be8300a15545d7d3ba0d71480aaf9b4f` |
| [Negativo: relatório original, qualificação parcial preservada](../../.tmp/p2-native-6264871e374f4c29b9dd60cf93429f3e/final-report.json) | `badb5d17bde69cc5706aebfea40cefde305d713411f71bd0025013d06cb83cee` |
| [Novo positivo: C6](../../.tmp/session-harness-c6-9be346fb53bb4d06bf684bbe1533b569/c6-proof.json) | `1e2ac8f104a0f88bba7e2b2664102735998bfdfd067134c2676a3750ee362e85` |
| [Novo positivo: runtime](../../.tmp/session-harness-c6-9be346fb53bb4d06bf684bbe1533b569/runtime-proof.json) | `39e749ef91856365f26ac8bba385b47184f24efbfceda354e0618afb00c6d1c8` |
| [Novo positivo: contrato/preflight, não scenario PASS](../../.tmp/session-harness-c6-9be346fb53bb4d06bf684bbe1533b569/contract-proof.json) | `0bbd448191f7af0926d580cec40ef2d6510f419fbb58dcb7e477e205777263d0` |
| [Novo positivo: relatório independente](../../.tmp/p2-positive-c9fc996bd04d42108af0afffd779c88e/report.json) | `32d6a59790fbc7170f028d3a24f8e0f36e53b3b1cf641d8493c3741c563cc845` |

Ambas as tentativas mantiveram os 841 registros de fonte com identidade
`acb8621566567365e672e8130ac02d422d2d7da75987e8b6057f71992fa9bcf4`.
Cada `candidate.json` do runner tem 727 registros e digest
`37f2d46fdacc130b187c575f19b69a013f3b4cb5b02d7d4db8a3f0d69b786eef`;
43 caminhos estão fora do inventário U6 e foram conferidos diretamente por hash,
sem assumir equivalência entre os inventários. Readback independente conferiu
os 33 hashes de artefatos negativos e os hashes/contagens/cleanup positivos.

Essa identidade é retrospectiva, anterior ao fechamento documental. A atualização
de seis documentos muda seus hashes, não o código executado: dos 841 registros,
835 fora desses documentos permanecem byte a byte iguais. Backups anteriores estão
em `.tmp/p2-doc-close-t6T06h`; backups da retomada e readback final estão em
`.tmp/p2-doc-finish-ce31140adcfa`.
Não atribuir o digest anterior ao inventário documental posterior.

### Caps reais, privacidade e reversão

Comandos/preparação 60 s cada, startup Nest 120 s, goals 180 s,
dump/list/restore 45 s + até 2 s de confirmação de saída; pg-stop `-t 30`
dentro de 60 s. Não há agregado 390 s nem force-kill agregado implementado;
caps não foram elevados após falha. Nenhum serviço Windows/ACL foi alterado.
Dados/logs/TOC/dumps permanecem privados e preservados; sem upload automático,
DSN/senha/token/corpo/arquivo privado em evidência portátil. Política de conteúdo,
acesso e retenção ainda depende de P4.

Reversão desta unidade: somente branches P2 em `c6.cjs`/`runner.cjs`, helper
`c6-negative.cjs`, testes novos em `u6.spec.cjs` e notas P2; manter a flag
fail-fast normal, contrato de identidade, P1, WIP e todas as evidências.
Produção não foi alterada. Não houve nova suíte completa/typecheck backend
(P1 é prova separada), aplicação de 0016/0017 ao DB da aplicação, Resend,
CI PG16 ou deploy. `u6.cjs` continua com dispatch/tipos bloqueados (P3).
**P1/P2 PASS local delimitado; P3/P4 OPEN; U6/etapa 2 OPEN; produção BLOCKED.**

## Histórico P2: implementado; prova nativa pendente — 2026-10-12

**IMPLEMENTED / NATIVE_NOT_TESTED, não PASS.** O runner mantido admite
`C6_SQL_ERROR` e importa sua prova fechada: três TABLEs em ordem before/error/after,
diagnóstico privado classificado, sentinelas, controle contrafactual, contagens
2/2 e zero continuação HTTP/autoridade. Owner único e guards não mudaram;
cada fase recria somente o schema privado. Logs/dump/lista permanecem privados.

Testes puros: RED por seletor ausente (exit 1, 1 teste falhou), após tentativa
sandbox EPERM que não executou assertions. Primeiro check final 14/16, exit 1,
com dois erros de extração de fonte. Uma correção delimitada autorizada corrigiu
somente essas extrações; recheck 15/16, exit 1: deepStrictEqual no importador VM
rejeita objetos de realms distintos. **PURE_FAILED; parar sem novo retry.**
Logs, baselines e hashes: `.tmp/p2-source-Cjd139`; não são evidência PostgreSQL.
O VM fail-fast histórico passa no recheck, mas continua sendo VM, não teste nativo.

**Atualização posterior autorizada — PURE_PASS 16/16, exit 0:** injetado somente
`JSON` do host no contexto VM do teste de importação. `JSON.parse` agora cria
objetos compatíveis com o validator do host; deepStrictEqual e todo código de
runtime permanecem inalterados. Formatação restrita ao spec (exit 0), uma única
nova batch pura; falhas anteriores preservadas. Comando:
`node --test --test-timeout=120000 backendnest/test/session-harness/u6.spec.cjs`.
Backup do spec, logs/hashes/inventário em `.tmp/p2-realm-Qd7hhZ`.
**NATIVE_NOT_TESTED / runtime NOTLAUNCHED:** PASS puro não prova PostgreSQL.

Antes de qualquer runtime, realizar inspeção independente. Depois, uma tentativa negativa e uma positiva
C6 dos bytes atuais, com readback de cleanup/source/external. Não executar pelo
dispatch U6 bloqueado (P3), nem iniciar CI PG16 (P4). P1 PASS local preservado;
P2 nativo OPEN; P3–P4 OPEN; produção BLOCKED; U6 OPEN.

## Execução curta

Na raiz, com dependências já instaladas:

```powershell
node backendnest/test/session-harness/u6.cjs
# Somente um recorte, quando necessário:
node backendnest/test/session-harness/u6.cjs --checks=u6-unit
```

Com cwd `backendnest`, `npm run u6:check` e `npm run u6:test` são os atalhos.
O modo padrão seleciona quatro checks finitos, informa os caps antes de executar,
para no primeiro erro e deixa os seguintes `NOT_TESTED`. Uma invocação não faz
retry. Caps: U6 puro 60 s, config Jest 180 s, deployment puro 60 s, polling 60 s.
Sem build/export, instalação, suíte completa ou conexão SQL implícita.

| Modo | Implementação e consequência |
|---|---|
| `OFFLINE_CHECKS` | Executa apenas a allowlist de checks instalados; exit 0 significa `PARTIAL_PASS`, não prontidão completa. |
| `DISPOSABLE_RUNTIME` | Exige um `--case` mantido, mas permanece `BLOCKED`, exit 2, sem lançar comandos. O gate de autorização/runtime está implementado; execução coordenada não está. |
| `TARGET_VALIDATION` | `BLOCKED`, exit 2, sem comandos: destino e autorização inexistentes. Não aceita URL, credencial ou comando arbitrário. |

Runtime separado usa o [runner mantido](../../backendnest/test/session-harness/README.md)
somente após escopo/aprovação próprios; a prova C6 abaixo não passou pelo dispatch
U6 bloqueado. Não foi criado segundo runner de DB.

## Provas parciais deste recorte

| Check | Resultado delimitado |
|---|---|
| U6 puro, `u6.spec.cjs` | 8/8: CLI finito, separação local/destino, allowlist negativa, integridade/checksum, exclusões de inventário, zero launches nos modos bloqueados, stop na primeira falha e C6 mock negativo. |
| Config Jest, cinco arquivos explícitos | 107/107: 103 regressões existentes e quatro testes novos dos perfis. JWT fraco/igual/ausente, CORS/TLS/DB/reset são verificados pelos resolvers atuais com fixtures. |
| Deployment puro mantido | 4/4: gate SQL read-only estrutural, confinamento CI documentado, quota por relógio DB e canonicalização limitada. Não executa SQL nem CI. |
| Polling mantido | Um check PASS: stale → stale → matching, com snapshot exato; sem browser. |

Os quatro checks têm exit 0 no candidato final. São **119 testes automatizados
mais um check de polling**, não reexecução dos históricos U5/C6/HTTP/browser.
Dos 119, 12 são novos neste recorte. Não somar tentativas repetidas como cobertura
adicional. RED inicial (módulo ainda ausente) e falha intermediária de dois testes
de template foram preservados; não foram reclassificados como PASS histórico.

Os perfis são lidos apenas dos `.example`. Perfil exposto fica intencionalmente
inválido até receber valores privados; usa `NODE_ENV=production`, inclusive em
staging público, sem ampliar a política JWT de produto. O perfil E2E usa
`finance_e2e_local`/owner dedicado, senha vazia e confirmação exata de reset. Não
cria banco, role, marker, memberships ou permissão; a identidade SQL real continua
obrigatória no helper existente. Defaults normais de desenvolvimento não foram
alterados. Hosts `.invalid` e senhas fictícias dos testes não são provisionamento.

### C6 e limite da prova

Foi acrescentado somente `--exit-on-error` ao restore C6. GitNexus qualificado
por arquivo não encontrou `main`: risco **UNKNOWN**, não LOW. Verificação manual
limitou callers à invocação terminal de C6 e ao dispatch do runner.
O teste VM usa a função `command` e o trecho de restore atuais, com spawn mock
retornando exit 1: promessa rejeita e continuação pós-restore não executa.
**Na prova offline inicial, restore PostgreSQL real NOT_TESTED.** Quatro fixtures
históricas C6 não validavam automaticamente os bytes novos. A execução posterior
abaixo comprova o caminho positivo atual, sem mudar aquele resultado histórico.
U5D já tinha a flag e não mudou.

### Restore C6 real posterior — 2026-10-12

**PASS 4/4 em uma única invocação C6 do runner mantido, zero retries**, com
PostgreSQL privado descartável 18.3 e Nest/AppModule reais. Dump custom `-Fc` e
restore nativos concluíram com exit 0; o comando atual usa `--exit-on-error`,
`--no-owner` e `--no-privileges`, e só continua após sucesso. O helper manteve
as 17 migrations configuradas no banco descartável; **0016/0017 não foram
aplicadas ao banco da aplicação**. Âncora SQL observada:
`2026-10-12 23:51:34.231904+00` (UTC).

| Fixture restaurada | Prova HTTP/SQL |
|---|---|
| Ativa | HTTP 200, `no-store`, deadlines exatos e linha SQL sem touch. |
| Idle expirada | HTTP 401, `AUTH_SESSION_IDLE_EXPIRED`, terminal SQL correspondente, sem renovação. |
| Absoluta expirada | HTTP 401, `AUTH_SESSION_ABSOLUTE_EXPIRED`, terminal SQL correspondente, sem renovação. |
| Revogada | HTTP 401, `AUTH_SESSION_REVOKED`, linha SQL inteiramente preservada. |

Quatro logins reais verificaram access de 900 s e refresh limitado pelo absoluto.
Antes/depois do restore: quatro linhas brutas e instantes SQL em microssegundos
iguais; arquivos de autoridade byte-idênticos. Schema metadata também igual
(nomes/tipos/nullabilidade/defaults e metadata de constraints), não comparação
genérica de SQL normalizado. Dados de quota não são objetivo C6; a prova U5D
continua separada. Fronteiras são fixtures UTC backdated, não esperas naturais.

Readback independente, **sem reexecução**, conferiu 837/837 fontes atuais antes
deste fechamento, digest compacto
`d88bf1b82f7d81c22fa09699543792a79b17d95f9c7b6a2f0bc3b16632259665`, e nove
hashes de artefatos. O freeze próprio do runner tem 724 entradas; não é o
inventário completo de 837. Runtime SHA-256
`8adb05a89a6a1d7e854ac2f4c21aebe4d1e90582921d62f0ef36de704b7a2061`;
C6 SHA-256 `2c6f15f511f3949bba3db87eb8a280de10a2ed2ddb0d8578f15c7cda85edf1d4`.
Somente os dois documentos deste fechamento diferem depois; 835 fontes restantes
permanecem iguais. Os manifestos originais não foram reescritos.

Cleanup registra filhos/Nest encerrados, PostgreSQL próprio parado e portas
livres; observação OS posterior registra zero processos próprios e listeners
reservados. Serviço/listeners/IDs observáveis do PostgreSQL externo/5432 ficaram
iguais; `ExecutablePath` nulo impede afirmar identidade completa do executável.
Nenhum runtime adicional foi lançado no readback.

Evidências: [runtime](../../.tmp/session-harness-c6-bde3ca07bf2d418988d4a3adc796698f/runtime-proof.json),
[C6](../../.tmp/session-harness-c6-bde3ca07bf2d418988d4a3adc796698f/c6-proof.json),
[contrato real](../../.tmp/session-harness-c6-bde3ca07bf2d418988d4a3adc796698f/contract-proof.json),
[readback da execução](../../.tmp/c6-real-finish-BUJ9pE/readback.json),
[cleanup OS](../../.tmp/c6-real-finish-BUJ9pE/os-after.json) e
[fechamento independente/backups](../../.tmp/c6-final-restore-readback20261012/readback.json).
Dumps e logs brutos permanecem privados/ignorados; estes links locais não são
exportação portable nem evidência publicada de CI.

**Limite:** não houve injeção real de erro SQL no restore. O negativo fail-fast
VM/mock inicial permanece prova parcial separada, não negativo PostgreSQL real.
Esta execução não retesta os 119 testes offline, browser, tipos globais, PG16/CI
ou backup/rollback produtivo; não concede prontidão global ou ativação.

## P1: tipos backend completos corrigidos — 2026-10-12

**P1 CONCLUÍDO / PASS local no candidato identificado; P2–P4 OPEN.** O único
fonte alterado é `orcamento.repository.spec.ts`; nenhum byte de produção mudou.
O objeto parcial com apenas `createQueryBuilder` não satisfazia
`Repository<Transacao>`: RED confirmou um único TS2352 na linha 35 (exit 2),
enquanto o Jest focado já passava 1/1. Não era regressão demonstrada de U6.

A correção remove ambos os casts de repositories completos. Usa objetos reais
TypeORM de um `DataSource({ type: 'postgres' })` não inicializado, repositories
pelo manager e `SelectQueryBuilder<Transacao>`, com spies tipados nos métodos
fluentes, `getRawMany` e `createQueryBuilder`. Mantém resultado, filtros de
despesa/não ajuste/não excluída e agrupamentos mês/categoria; acrescenta asserts
de alias, usuário, seleção dos meses e ausência de initialize/connect. Os spies
destes dois últimos rejeitam qualquer chamada; `isInitialized` permanece false.
Construtores/assinaturas instalados foram conferidos antes da mudança; não houve
metadata/conexão, AppModule, SQL, serviço, browser ou Resend. Sem `any`, duplo
cast, suppressions, exclusões de teste, alteração de tsconfig ou dependências.

### Ficha técnica e limites

Todos os comandos abaixo foram executados com cwd `backendnest`, dependências
já instaladas, cap **120 s por comando**, uma captura RED e uma batch GREEN sem
retry. Prettier alterou somente o spec antes do snapshot GREEN; a checagem final
foi read-only. Ambiente filho limitado a variáveis OS, sem dotenv privado.
Um preflight Node spawn recebeu EPERM antes de compiler/Jest; a execução local
subsequente usou escalada revisada, sem bypass de serviços ou permissões de DB.

| Comando exato | RED | GREEN |
|---|---|---|
| `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json` | exit 2, 1 TS2352; 12,035 s | exit 0, zero diagnósticos; 19,524 s |
| `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/orcamentos/repositories/orcamento.repository.spec.ts` | exit 0, 1 suite/1 teste; 39,575 s | exit 0, 1 suite/1 teste; 8,440 s |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json` | NOT_TESTED | exit 0, zero diagnósticos; 13,165 s |
| `node node_modules/prettier/bin/prettier.cjs --write src/orcamentos/repositories/orcamento.repository.spec.ts` | após RED | exit 0, antes do freeze |
| `node node_modules/prettier/bin/prettier.cjs --check src/orcamentos/repositories/orcamento.repository.spec.ts` | NOT_TESTED | exit 0; 0,851 s |

Versões observadas: Node 24.14.0, TypeScript 5.9.3, TypeORM 0.3.28, Jest 30.3.0,
`@types/jest` 30.0.0 e Prettier 3.8.1. **Não é prova de toda a suíte backend**:
executou somente um spec; tipos build noEmit não são build emitido.

GitNexus encontrou apenas o nó File, não os callbacks do spec. Impact upstream
qualificado por UID retornou LOW/zero relações e processos **no índice**;
cobertura dos callbacks permanece UNKNOWN, não blast radius comprovadamente zero.
Busca manual em src/test encontrou somente a declaração do teste; Jest o
seleciona pelo contrato existente. Nenhum método de produção foi editado.

Inventário local backend: **1295 arquivos**, excluindo vendor/outputs/Git/.tmp,
`.aws`, `.env*` e tsbuildinfo; inclui fontes/configurações/testes e WIP atual.
Os bytes permaneceram estáveis durante RED e GREEN; somente o spec difere entre
os snapshots. Não substitui inventário/identidade da release de todo o projeto.
SHA-256:

- Backend antes: `04b6d5a30a0cea285bb1a1275e8a8653db4e3a0e88e734d3e9fe375086194ed4`.
- Backend depois: `a0450859529cd66be68acb7b3c3149810319b602b7c2f003e9bef6422f41b55e`.
- Spec antes: `e51b53d6832ac565ceca83d53c317ec8d944fb28bed06f729841852fa4249dc3`.
- Spec depois: `acdd37dfa2f2ea7bb2ef0f414795c4c836b837b567f0acd283db7b3886efc17a`.
- Produção, 207 fontes, antes = depois: `0492ebaa945830d14e2e5891f60845c02f5e46a648546fc339a39f5eaef72f2e`.
- Repository de produção, antes = depois: `6945ba58d3869567a505d2d21065c1487e9802f7cd15948d1faba7b251dc84ef`.

[RED/logs/backup](../../.tmp/p1-ts2352-3ae1671e800f475687de81380d3a8abe/baseline-results.json),
[GREEN/logs](../../.tmp/p1-ts2352-3ae1671e800f475687de81380d3a8abe/green-results.json),
[fontes antes](../../.tmp/p1-ts2352-3ae1671e800f475687de81380d3a8abe/baseline-sources.json) e
[fontes depois](../../.tmp/p1-ts2352-3ae1671e800f475687de81380d3a8abe/green-sources.json).
Hashes individuais dos configs/lockfile constam dos snapshots; backups e stdout/
stderr completos permanecem locais, privados/ignorados, sem exportação/CI.

`u6.cjs` permanece byte-idêntico e ainda fixa o estado global de tipos em BLOCKED.
Propagar a prova qualificada no schema/coordenador pertence a **P3**; não confundir
esse estado estático com o compilador executado aqui. C6 positivo 4/4 preservado,
não reexecutado; negativo SQL real, dispatch runtime e CI permanecem pendentes.
U6/etapa 2 OPEN; produção BLOCKED. Sem commit/push, SDD/RDD ou waiver.
Reversão P1: somente o diff deste spec e as notas P1 dos cinco documentos;
restaurar apenas os bytes desta unidade, nunca todo o WIP nem apagar históricos.

## Evidência e integridade

Cada invocação cria diretório novo `.tmp/u6-<nonce>` sem output arbitrário,
overwrite ou exclusão recursiva. `private/` guarda stdout/stderr brutos por check;
é privado, pode conter dados sensíveis em falhas e **não integra exportação**.
`portable/` contém exclusivamente `manifest.json` e `manifest.sha256`.

O manifesto tem schema fechado: enums, UTC, versão Node observada, caps/tempo/exit,
estados por check e caminhos relativos/SHA-256 de fontes atuais, incluindo WIP e
intended-untracked. Inclui lockfiles, SQL e os controles mantidos; não exporta seus
conteúdos. Dotenv privado, node_modules, Git, outputs gerados, dumps e screenshots
não entram. Symlink encontrado no inventário falha fechado. Fonte muda durante o
check: falha, sem conceder estado verde ao candidato diferente.

`verifyArtifact(bytes, checksum)` verifica o arquivo lido de volta, o checksum e
o schema; campos inesperados, campos obrigatórios ausentes, origem sem controles
obrigatórios ou digest divergente falham. Testes negativos incluem senha fictícia,
DSN, token, stack e newline em campos não permitidos. Isso **não** demonstra
redação universal do logger de produto. Hash identifica bytes; não sanitiza um
dump e não fornece assinatura, proveniência de CI ou recibo de review.

Na execução offline inicial, somente Node foi observado como versão de ferramenta
pelo coordenador. Npm, PostgreSQL, Expo e browser não foram sondados por ele;
a prova posterior C6 registra PG18.3 separadamente. Não há versão
remota presumida. Os logs e manifesto da tentativa final são entregues pelo
readback da execução, não por cópia de uma prova histórica.

## Readback independente offline inicial — 2026-10-12

**LOCAL_PARTIAL_PASS no recorte implementado; nenhum defeito concreto bloqueante
encontrado por leitura independente de fontes e artefatos.** Sem reexecutar testes,
DB, HTTP, browser, build, tipos globais ou CI. [Registro e backups documentais](../../.tmp/u6-independent-20261012/readback.json).

Antes desta atualização documental, foram conferidos **837/837 hashes** do
[manifesto final](../../.tmp/u6-KhPUsm/portable/manifest.json), SHA-256
`a6ea5c15a4be771d87962ad084ad61f5623b0e60afa2b234f1d6911dbf1a7a71`.
O readback confirmou 8 + 107 + 4 = **119 testes**, além de um check de polling,
e os quatro exits 0. Os manifestos de
[destino](../../.tmp/u6-pO9ZvA/portable/manifest.json) e
[runtime C6](../../.tmp/u6-Fm0WzT/portable/manifest.json) registram `BLOCKED` e zero
checks; exit 2 não concede prontidão. A revisão da única linha C6 confirmou que
retirar `--exit-on-error` restaura o hash anterior; a prova VM continua parcial.

Este fechamento muda **somente este resultado e a nota atual do plano geral**.
Seus dois hashes documentais diferem do manifesto testado; os 835 restantes,
incluindo código, testes, configurações e demais documentos, permanecem iguais.
O manifesto original não foi alterado nem apresentado como prova de reteste
dos documentos posteriores. A pesquisa original continua histórica e já aponta
para este resultado. Produção BLOQUEADA; U6/etapa 2 ABERTAS; tipos globais
BLOCKED/NOT_RETESTED, sem waiver.

## Oito unidades: estado real

| Unidade do plano | Estado local / pendência |
|---|---|
| 1 Inventário/status | IMPLEMENTADO: hashes dos bytes atuais e separação de gates. |
| 2 Perfis/config | IMPLEMENTADO + provas parciais: templates e resolvers, sem ambiente real. |
| 3 Coordenador | IMPLEMENTADO offline e gates bloqueados; dispatch runtime/target adiado. |
| 4 Manifesto/CI | Manifesto/integridade IMPLEMENTADOS; upload, acesso e retenção não implementados/aprovados. |
| 5 Regressões | PASS nos checks offline selecionados e C6 real posterior 4/4; demais matrizes runtime/plataforma não retestadas. |
| 6 Schema/recuperação | Gate existente preservado; correção C6/mock PASS e restore positivo real atual PASS 4/4; negativo SQL real e recuperação produtiva não comprovados. |
| 7 Cleanup/telemetria | Offline fechou FDs sem serviços; C6 posterior encerrou seus serviços próprios. Telemetria negativa só no exporter; lifecycle/telemetria de produto pendentes. |
| 8 Readback/handover | Readback independente LOCAL_PARTIAL_PASS concluído no recorte; integridade documentada. Aprovação completa/global não concedida. |

No fechamento offline original, tipos backend completos estavam **BLOCKED** pelo
TS2352 preexistente em `src/orcamentos/repositories/orcamento.repository.spec.ts:35`.
A prova P1 posterior acima corrigiu e verificou esse gate local, sem alterar o
estado histórico ou o schema estático do coordenador (P3). Build/export/tipos frontend completos,
Demais matrizes DB/HTTP, browser/native, PG16/CI remota, duas instâncias/capacidade/SLO,
BFCache/visibilidade genuína, backup/RPO/RTO/rollback publicados, TLS/proxy,
shutdown do host e destino real continuam NOT_TESTED/PENDING. Resend adiado.

## Próximo passo e rollback local

[Guia operacional existente](../operacao/SESSOES_U5_DEPLOYMENT.md) conserva o gate
manual antes de tráfego; `/health` estático não comprova schema. O restore positivo
C6 atual está comprovado; aprovar o próximo escopo delimitado ou definir o destino
antes de ampliar as provas.
CI futura deve decidir acesso/retenção; sete dias não são política aprovada.

Rollback deste recorte: retirar `u6.cjs`, `u6.spec.cjs`, `u6-profiles.spec.ts`,
scripts `u6:*`, template exposto e atualização E2E, além dos links/documentação;
reverter separadamente a única flag C6 se necessário. Não envolve migrations,
sessões/dados de aplicação ou código auth. Provas históricas/WIP prévio preservados.
