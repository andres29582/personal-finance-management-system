# U6: plano para quatro pendências delimitadas

## P4: preparado localmente; prova remota pendente — 2026-10-14

**P4 IMPLEMENTED_LOCAL / PURE_PASS; REMOTE_NOT_TESTED / OPEN. U6/etapa 2 OPEN;
produção BLOCKED.** Workflow manual dedicado, adapter negativo PG16 restrito e
prova fechada/readback preparados; P4 puro 17/17, U6 puro 39/39 e tipos completos
sem emissão passaram localmente. Sem PostgreSQL/CI/upload/commit/push nesta unidade.
[Escopo, prova final, rollback e aprovações de publicação](../validacao/SEGURANCA_SESSOES_ETAPA_2_P4_CI.md).

P3 LOCAL_PASS_BOUNDED permanece inalterado: sete provas históricas/23 assertions
+ U5D atual/10; não é novo lote 8/8. As seções abaixo preservam o histórico.

## P3: aceite local delimitado encerrado — 2026-10-14

**P3 LOCAL_PASS_BOUNDED / CLOSED somente no aceite local; P4 OPEN;
U6/etapa 2 OPEN; produção BLOCKED.** Os oito casos coordenados estão
qualificados em execuções aprovadas de candidatos diferentes: sete históricos
(23 assertions) + uma tentativa U5D atual (10/10, 199,04 s, sem retry), total 33.
Não é novo lote 8/8 do candidato atual, receipt ou aceite produtivo.

O readback independente do inventário completo de 850 paths confirmou apenas
sete diferenças entre candidatos: extração byte idêntica do confinamento,
marker/env exclusivos U5D e guard U5D, sem mudar lógica após import pg; demais
diferenças em testes/README/dois documentos. Nenhuma mudança concreta de
comportamento compartilhado exige rerun das sete provas históricas.
[Resultado atual, hashes, evidências e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p3-aceite-local-delimitado-encerrado--2026-10-14).

**Próximo passo: P4**, ainda pendente e sem autorização implícita de CI/deploy.
Este fechamento é documental, posterior à tentativa; não renova testes nem
conserva o hash executado após mudar documentos. Backups/readback em
`.tmp/p3-local-closure-20261014-6eaf/`. As seções abaixo preservam o histórico
integral, inclusive falhas e solicitações anteriores já superadas neste recorte.

## P3: guard U5D corrigido; aceite continua OPEN — 2026-10-14

Correção de root coordenado e regressão pura autorizadas e implementadas;
**nenhuma nova execução nativa**. Deployment puro 8/8; U6 puro 39/39 (exit 0),
com escalonamento revisado somente para filhos Node sintéticos após EPERM.
O [resultado atual](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md)
registra confinamento/binding/marker, impacto compartilhado e prova offline.
As sete provas/23 assertions do lote abaixo são do candidato histórico, não
retestes do novo candidato. P3/P4/U6/etapa 2 OPEN; produção BLOCKED.

Pendente: aprovação explícita de uma única tentativa U5D coordenada vinculada
ao hash final de `.tmp/u5d-root-correction-20261013/utf8-20261014/proof.json`, sem retry;
run 780000 ms + cancel/cleanup 332000 ms + guardian até 20 s. Nenhum outro
seletor, CI ou produção autorizado. Rollback somente pelos sete backups WIP
em `baseline.json` dessa pasta; preservar todo histórico.
Reparo documental UTF-8 em 2026-10-14: executáveis idênticos, sem repetir testes;
os resultados puros acima permanecem evidência do candidato anterior.


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



**P3 — 2026-10-13: IMPLEMENTED / PURE_PASS / NATIVE_NOT_TESTED.** Bridge/IPC fechado,
importadores dos oito seletores, Job Object Windows antes do go e caps agregados
implementados; batch pura/sintética final 37/37. Sem aprovação de caso/hash/caps:
BLOCKED, zero launches. Aceite nativo dos oito casos continua OPEN, não fechamento P3.
[Ficha atual, provas e forecast não autorizado](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p3-implementação-coordenada--2026-10-13).
P4/U6/etapa 2 OPEN; produção BLOCKED. Registros anteriores abaixo são históricos.

**Fechamento documental — 2026-10-13: P1 PASS local; P2 LOCAL_PASS delimitado; P3–P4 OPEN.**
Este plano organiza a correção de tipos, o negativo SQL real de C6, o dispatch
descartável de U6 e a prova remota com política de evidência. A proposta original
não autorizava execuções; P1 foi verificado após autorização específica. P2 tem
PURE_PASS 16/16, negativo SQL nativo 2/2 e um novo positivo C6 4/4 após
autorização/inspeção próprias. As contagens são separadas; não encerram U6.
Não autoriza PostgreSQL, CI, publicação ou deploy. O [resultado
atual](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md) permanece a fonte
das provas realizadas; a [pesquisa original](SEGURANCA_SESSOES_ETAPA_2_U6_PESQUISA.md)
e o [plano geral](SEGURANCA_SESSOES_ETAPA_2.md) preservam seu histórico.

## Caminho curto e estado atual

1. **P1 CONCLUÍDO:** corrigido somente o mock de `OrcamentoRepository`; tipos completos verificados.
2. **P2 LOCAL_PASS:** puro 16/16, negativo nativo 2/2 e novo positivo 4/4; limite adicional de observer negativo preservado.
3. **P3:** coordenar o runtime descartável com supervisão, prova por caso e cleanup.
4. **P4:** preparar CI Ubuntu/PG16 e exportação segura; publicar somente após aprovação.

| Item | Evidência atual delimitada | Estado / trabalho futuro |
|---|---|---|
| Tipos backend completos | PASS local posterior: TS2352 corrigido no spec; Jest focado 1/1, tsc completo/build noEmit exit 0. Coordenador ainda fixa BLOCKED (P3). | P1 CONCLUÍDO; [prova/limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p1-tipos-backend-completos-corrigidos--2026-10-12) |
| C6 positivo nativo | Novo PASS 4/4 em PG18.3, exit 0/60.233 ms, com três flags de restore e 17 migrations no banco privado. Histórico anterior permanece separado. | P2 LOCAL_PASS; não repetir automaticamente. |
| C6 negativo SQL real | PASS delimitado 2/2, runner exit 0/33.325 ms; cada restore exit 1/classe duplicate_table, SQLSTATE observado null, sentinelas/controle/cleanup qualificados. VM não é prova nativa. | P2 LOCAL_PASS; snapshot OS ao vivo adicional do negativo permanece NOT_TESTED. |
| Dispatch U6 descartável | BLOCKED; zero launches. Offline tem 119 testes selecionados e um check de polling históricos. | P3 PLANNED / OPEN |
| CI remota e política de evidência | NOT_TESTED; sem uploader, retenção ou acesso aprovados/verificados. | P4 PLANNED / OPEN |
| Destino real e etapa completa | Produção BLOCKED; U6/etapa 2 OPEN. | Fora deste fechamento. |

Dependências: P1 foi concluído isoladamente; P2 fornece a prova negativa consumida
por P3; P4 depende de P1/P2 e do contrato de evidência de P3. A preparação offline
de P4 não depende de hosting. Cada unidade leva seus testes/documentação e tem
reversão própria; nenhuma exige criar estado SDD ou reativar RDD.

## Limites comuns antes de implementar

- Aprovar a implementação e cada tentativa runtime com cenário, custo e limites
  explícitos. Antes de editar qualquer símbolo, executar GitNexus `impact` upstream,
  informar callers/processos/risco e alertar HIGH/CRITICAL. Índice ausente ou
  resposta vazia não significa LOW: registrar UNKNOWN e conferir callers manualmente.
- Inventariar o candidato atual e separar o WIP existente. Não usar `git add .`,
  push global, históricos `.tmp` como template nem evidência antiga como prova nova.
  Normalizadores que alteram fontes terminam antes da identidade e verificação.
- Usar dependências instaladas e o runner mantido. Sem dotenv privado, dados reais,
  credenciais em chat, DB da aplicação/5432 local, migrations 0016/0017 na aplicação,
  Resend real, serviço Windows, alteração de ACL ou bypass administrativo.
- Uma seleção explícita, zero retry automático; parar na primeira falha, registrar
  os seguintes NOT_TESTED. Preflight/plataforma desconhecidos: BLOCKED, zero launches.
  Nova tentativa depende de decisão explícita, não de loop de correção.

## P1 — remover o TS2352 pela causa no spec

**Estado anterior (RED), preservado como histórico:**

**Arquivo:** `backendnest/src/orcamentos/repositories/orcamento.repository.spec.ts`. O construtor de produção em
`orcamento.repository.ts:11–17` exige `Repository<Transacao>` completo. O objeto
do spec, linhas 30–35, contém somente `createQueryBuilder`; faltam `manager`,
`target`, `metadata` e demais membros. No planejamento anterior, o diff contra HEAD deste spec estava vazio:
o bloqueio é preexistente, não regressão demonstrada de U6.

**Abordagem mínima executada e verificada em P1:** criar
`DataSource({ type: 'postgres' })` não inicializado, obter repositories reais pelo
manager e usar um `SelectQueryBuilder` real; aplicar `jest.spyOn` tipado aos
métodos fluentes e a `getRawMany`, fazendo `createQueryBuilder` devolver o builder.
Os spies devem impedir acesso a metadata/conexão durante o teste. Não chamar
`initialize`, não conectar, não carregar AppModule. Validar as assinaturas da
versão instalada: não copiar receita genérica de `jest.fn` às cegas.

Uma assertion não acrescenta membros nem valida o valor em runtime; trocar por
duplo cast apenas ocultaria a divergência. [TypeScript: type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions).
`satisfies` também não completa um fake incompatível; só verifica conformidade.
[TypeScript 4.9](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html).

### Tarefas e aceite

- [x] RED: capturar diagnóstico TS2352 e resultado inicial do spec no candidato identificado.
- [x] Substituir os fakes incompletos mantendo asserts de despesa, ajuste, exclusão e agrupamento.
- [x] GREEN: spec focado, tipos completos e tipos de build exit 0; zero diagnósticos restantes.
- [x] Confirmar zero conexão/serviço e ausência de `any`, duplo cast, suppressions,
  exclusão de teste, relaxamento global de tsconfig ou redesenho da dependência de produção.

**Comandos executados em P1; cwd `backendnest`, dependências instaladas, cap 120 s cada:**

```powershell
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/orcamentos/repositories/orcamento.repository.spec.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json
```

[Ficha técnica P1](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p1-tipos-backend-completos-corrigidos--2026-10-12) registra comandos/exits/contagens, versões, causa, hashes, logs privados, limites e cobertura GitNexus UNKNOWN dos callbacks. P1 não reexecutou C6 nem mudou produção; propagação do status em `u6.cjs` permanece P3.

Reversão: somente a alteração do spec/documentação dessa unidade. Se a proposta
exigir conexão ou mudar produção, parar e reavaliar; não liberar o gate com waiver.

## P2 — provar fail-fast em erro SQL nativo

**P2 LOCAL_PASS delimitado:** puro 16/16 + negativo nativo 2/2 + novo positivo
4/4, unidades separadas. [Ficha técnica atual, hashes e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p2-prova-local-delimitada--2026-10-12).
Uma tentativa por caso mantido, sem retry. SQL negativo/guardas/cleanup final
qualificam; observação OS independente ao vivo adicional do negativo permanece
NOT_TESTED. Relatório parcial original não foi editado nem sua lacuna reconstruída.

**Arquivos previstos:** `backendnest/test/session-harness/{c6.cjs,runner.cjs,contract.cjs,u6.spec.cjs,README.md}`;
helper puro `c6-negative.cjs` ao lado. O seletor finito `C6_SQL_ERROR` foi
implementado pela fronteira C6 existente, sem outro provisioner de DB.
**Histórico da implementação — IMPLEMENTED / NATIVE_NOT_TESTED, não PASS:** primeiro check puro final 14/16,
exit 1; após uma correção delimitada autorizada, recheck 15/16, exit 1.
O importador VM rejeita objetos de realms distintos em deepStrictEqual.
Falhas preservadas em `.tmp/p2-source-Cjd139`. Após autorização explícita,
somente `JSON` do host foi injetado no contexto VM; uma nova batch pura
PASS 16/16, exit 0, sem enfraquecer validator/assertions nem alterar runtime.
Logs/backup/hashes puros em `.tmp/p2-realm-Qd7hhZ`; naquela etapa runtime NOTLAUNCHED.
Fonte, fail-fast e controle usam schemas `public` recém-criados em fases distintas
do mesmo DB privado marcado, com a única role owner restrita e guards inalterados.

### Fixture implementada e prova nativa local delimitada

1. Em fonte privada nova, criar três tabelas simples independentes, sintéticas:
   `before`, `error`, `after`. Gerar archive nativo schema-only `-Fc`; conferir
   `pg_restore --list` e selecionar/reordenar somente as três entradas TABLE com
   `--use-list`. Validar nomes, tipos, quantidade e ordem antes de conectar ao alvo.
2. Em alvo privado novo, pré-criar `error` com marcador distinto, para provocar
   duplicate-table real (42P07) no segundo CREATE. Sem `--clean`, corrupção de
   archive, dependências extras ou erro de binário/rede usado como negativo SQL.
3. Executar a fronteira mantida com `--exit-on-error`, `--no-owner` e
   `--no-privileges`. Exigir exit nativo não zero, diagnóstico do erro intencional,
   `before` existente, `error`/marcador preservados e `after` ausente. Configurar
   diagnóstico suficiente para conferir a classe SQL esperada, sem publicá-lo bruto.
4. Fazer controle contrafactual isolado em outro alvo fresco com a mesma colisão,
   sem a flag: erro ainda ocorre, mas `after` fica alcançável. Não retirar a flag
   da implementação mantida para obter o controle; as duas invocações são fases
   previamente aprovadas do caso, não retries.

`--exit-on-error` para no erro; o padrão continua. `--use-list` controla ordem.
Isso não é atomicidade: **não acrescentar `--single-transaction`**, pois mudaria
o contrato observado. [PostgreSQL 16: pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).

### Tarefas e aceite

- [x] Fixture/TOC determinísticos, guardas de identidade e nomes de logs por fase.
  `command` mantém logs `wx`, agora com labels finitos distintos por fase,
  sem overwrite ou colisão. TOC observado: oito entradas totais no cabeçalho,
  três TABLE selecionadas e validadas before/error/after.
- [x] Testes unitários cobrem seleção, ordem, diagnóstico inesperado, ausência de
  continuação HTTP/autoridade, contagens e cleanup; VM negativo atual é preservado.
- [x] Uma tentativa nativa autorizada comprova erro esperado **e todas** as assertions
  SQL/controle/cleanup. Só então o teste externo pode PASS apesar do subprocesso falhar.
- [x] Falha por timeout, conexão, binário, archive inválido, permissão inesperada
  ou cleanup incompleto não satisfaz o negativo. Falha não inicia a continuação C6 normal.
- [x] Se C6 positivo mudou, realizar uma tentativa positiva própria 4/4 e cleanup;
  preservar a prova histórica PG18.3, sem somar execuções nem reclassificá-la.

O negativo preservou before/error/marcador e não criou after com a flag; o
controle fresco criou after, ambos com native exit 1/sem signal/SQLSTATE null.
Continuação HTTP/autoridade 0/0. O positivo novo confirmou ativo 200/no-touch,
três 401 com motivos exatos/sem renovação, igualdade bruta/microsegundos/schema.
Cleanup de ambos preservou fontes/external 5432 e deixou processos próprios e
portas reservadas ausentes. O positivo teve PG/Nest PID/criação/listener ao vivo;
essa observação não preenche a lacuna do negativo. ExecutablePath externo null
não foi convertido em verificação. Todos os artefatos brutos continuam privados.

Runtime local: cluster nonce novo, loopback, owner restrito e DBs `finance_e2e_*`
marcados, cada role proprietária de somente seu DB, confirmação exata de reset.
Não reutilizar cluster/dump histórico. Portas reservadas locais: PG 55434, Nest
4318, proxy 4178; observar 5432 sem conectar. Proposta de caps: preflight 60 s,
startup 120 s, goals 180 s, cleanup 30 s, total 390 s; cada dump/restore 45 s,
dentro de goals. Confirmar viabilidade antes da tentativa, sem aumentar após timeout.
Sandbox pode exigir escalada revisada para spawn PG; não contornar restrições.
Caps reais preservados: comandos do runner/preparação/pg-stop 60 s cada,
startup Nest positivo 120 s, goals C6 180 s, dump/list/restore 45 s + até 2 s
para confirmar saída após kill; pg_ctl usa `-t 30`. Não há teto agregado de
preflight 60 s, cleanup 30 s ou total 390 s. O negativo não inicia Nest.
Confirmar orçamento/supervisão antes de runtime; não declarar caps propostos
como implementados nem aumentar limites após falha.

Reversão: remover apenas seletor/fixture/testes novos, preservando a flag fail-fast,
o C6 normal e evidências. Cleanup valida PID/data path/porta próprios antes de parar;
preservar artefatos privados, sem exclusão de históricos.

## P3 — habilitar dispatch descartável sem produzir falso verde

**Arquivos previstos:** `backendnest/test/session-harness/{u6.cjs,u6.spec.cjs,runner.cjs,contract.cjs,README.md}`.
Hoje `runChecks` em `u6.cjs:348–349` retorna sem execução fora de offline, e o
teste em `u6.spec.cjs:136–151` exige zero launches nos dois modos bloqueados.
As allowlists atuais são C6/A8/C7C8/U5/U5B/U5R/U5D, um caso por invocação.

### Tarefas e aceite

- [ ] Manter OFFLINE_CHECKS como default sem DB/HTTP/browser; comandos arbitrários
  continuam rejeitados. TARGET_VALIDATION permanece BLOCKED sem destino/autoridade.
- [ ] DISPOSABLE_RUNTIME exige seleção, aprovação e preflight; delega ao runner
  mantido, nunca reimplementa provisioning. Primeiro recorte de aceite: C6 e
  `C6_SQL_ERROR`. Demais seletores só lançam após suporte/importador próprios;
  os não habilitados continuam BLOCKED, sem rodar a lista inteira.
- [ ] Depois do primeiro recorte, habilitar em fatias A8/C7C8/U5/U5B/U5R/U5D:
  cada seletor precisa de schema fechado, importador, testes de dispatch/prova,
  cancelamento e cleanup, além de prova atual qualificada de seu caso. Manter
  matriz individual NOT_TESTED até a execução, uma seleção autorizada por invocação.
  C6/C6_SQL_ERROR isolados não encerram P3 enquanto os demais forem anunciados
  como suportados. Aceite completo exige todos os casos runtime anunciados
  coordenados e verificados; redução de escopo exige decisão humana explícita
  e registra P3 parcial, não fechamento integral. TARGET_VALIDATION continua
  intencionalmente BLOCKED e fora deste escopo.
- [ ] Usar supervisão assíncrona e cancelamento cooperativo que permita ao owner
  concluir seu `finally`; conferir encerramento PG/Nest/filhos e portas no final.
  O `spawnSync` offline com timeout não garante cleanup de netos/orphans do runner.
  Terminar somente processos comprovadamente próprios; sem confirmação: BLOCKED.
- [ ] Registrar orçamento por fase/caso, incluindo startup, goals e cleanup;
  parar no primeiro erro, deixar os seguintes NOT_TESTED e impedir retries.
- [ ] Importar a prova do caso, além de exit 0. O ramo C6 em `runner.cjs:617–624`
  só espera o subprocesso; conferir `c6-proof.json` (4/4/status), contrato/runtime,
  hashes/identidade de fontes, schema e cleanup. Negativo exige sua prova esperada.
  Arquivo ausente, schema desconhecido, hash divergente ou candidato diferente falham fechado.
- [ ] Evoluir schema fechado + testes: `u6.cjs:250–255,292–305` fixa tipos BLOCKED,
  restore/CI NOT_TESTED e modos não offline bloqueados. Nenhum PASS por default,
  campo extra livre ou mera presença de arquivo. Estados históricos são imutáveis;
  tipos completos só PASS com P1 realmente executado no candidato correspondente.
- [ ] Testes puros cobrem preflight recusado/zero launches, alvo bloqueado,
  timeout/cancelamento/cleanup, prova inválida e sucesso qualificado. Depois, uma
  invocação autorizada por caso selecionado, com readback final independente.

**Comandos existentes para futura regressão offline — NÃO executados neste plano; cwd `backendnest`:**

```powershell
npm run u6:test
npm run u6:check
```

Não executar hoje o modo runtime supondo suporte. Depois de implementar, documentar
o comando e parâmetros exatos aprovados; não inventar flag de autorização agora.
Reversão: retornar somente o dispatch novo a BLOCKED/zero launches e preservar
offline/schema compatível. Isso não é rollback de produção.

## P4 — prova remota PG16 e política de evidência

**Arquivos previstos:** `.github/workflows/ci.yml`, testes/contrato U6 e documentação;
adaptador mínimo CI junto à harness, se necessário. CI atual usa push/PR, Node 22,
Ubuntu e E2E PG16; não tem `workflow_dispatch`, uploader ou política de retenção.
Seu gate backend usa `tsconfig.build.json`, que exclui specs/test, portanto não
substitui o `tsconfig.json` completo. Jest `src/**/*.spec.ts` não seleciona CJS U6.

### Execução remota mínima proposta

- [ ] Preservar o E2E PG16 atual; acrescentar tipos backend completos e chamadas
  explícitas `u6:test`/`u6:check`, com caps de job/passos e parada na falha.
- [ ] Criar adaptação **restrita ao negativo SQL sintético PG16** para Linux CI.
  O runner atual exige readback Windows (`runner.cjs:259–264`), PG18.3
  (`519–527`) e 55434 fixo no contrato; não funciona em Ubuntu por trocar PATH.
  Não portar toda a harness nem fingir execução do C6 Windows em Linux.
- [ ] Usar serviço PG16 descartável e clients dump/restore compatíveis, registrar
  versões realmente observadas e regenerar archive PG16. Não assumir restore
  retrocompatível de dump PG18 em PG16. [pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html)
  e [serviços PostgreSQL no Actions](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).
- [ ] Reusar guardas de owner restrito, DB único marcado e confirmação de reset;
  não executar testes com o superuser de bootstrap. Bootstrap fica limitado ao
  serviço novo do job. Concluir/registrar cleanup sem tocar infraestrutura externa.
- [ ] Testar policy/manifesto offline antes de publicar. CI remota exige candidato
  aprovado em commit/branch próprios e push explicitamente autorizado, sem todo WIP.
  Eventos push/PR existentes bastam; `workflow_dispatch` é opcional, separado,
  requer workflow no default branch e permissão de escrita para execução manual.
  [GitHub: execução manual](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
- [ ] Usar `contents: read` e actions pinadas em SHA completo **verificado na
  implementação**, não hashes inventados. Sem `actions: write` por conveniência,
  segredos privilegiados para forks ou `pull_request_target` executando código não confiável.
  [Permissões](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)
  e [segurança de Actions](https://docs.github.com/en/actions/reference/security/secure-use).

### Política PROPOSTA — exige aprovação, não está configurada

| Decisão | Recomendação e condição |
|---|---|
| Conteúdo exportável | Allowlist exata de manifesto portable/checksum, versões e assertions sanitizadas. Revisar também nomes de arquivos/fontes. Nunca globs `.tmp`, dumps, screenshots, cápsulas, logs brutos, `.env`, tokens, corpos ou caminhos absolutos. |
| Falhas | Só resumo seguro com campos fixos. Nenhuma exportação privada automática em `always()`; upload apenas após schema/checksum/privacidade aprovados. Saída de comandos deve ser controlada para não vazar no log do job. |
| Retenção de artefatos | Propor 7 dias: janela curta de investigação versus armazenamento/exposição. Aprovar e verificar limites reais da conta/repositório antes de configurar `retention-days`. Isso não muda a retenção dos logs do workflow. |
| Acesso | Responsável pelo repositório deve confirmar visibilidade e leitores autorizados. Artefato em repo público não é confidencial; leitores de repo privado podem baixar. `permissions` do job não restringe esses leitores. |
| Custódia e descarte | Nomear custodiante antes do primeiro upload; registrar run/artifact IDs e expiração. Excluir exportação ao expirar/revogar acesso pelo mecanismo autorizado, confirmando a remoção; não apagar provas locais históricas sem pedido. |
| Integridade e origem | Verificar explicitamente checksum/schema/hash e falhar em divergência. Associar commit efetivamente checkoutado, run ID/attempt e digest à fonte aprovada; em PR, registrar se é merge commit. Checksums não provam proveniência sozinhos. |

GitHub oferece retenção configurável, sujeita a limites da conta; logs e artefatos
têm política de retenção e `retention-days` customiza o artefato enviado.
[Retenção](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization).
O download depende do acesso ao repositório. [Acesso a artefatos](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).
A validação automática de digest pode emitir apenas warning: exigir verificação
própria fail-closed no consumo. [Armazenar/validar artefatos](https://docs.github.com/en/actions/tutorials/store-and-share-data).
Defaults de arquivos ocultos do uploader não substituem allowlist/privacy review.
[upload-artifact](https://github.com/actions/upload-artifact).

### Aceite e reversão

- [ ] Política de conteúdo/acesso/custodiante/retenção aprovada; testes negativos
  impedem upload de campos/paths sensíveis, checksum errado ou origem não vinculada.
- [ ] Uma execução remota identificada comprova tipos completos, offline U6 e
  negativo nativo PG16; o job E2E PG16 já existente também deve passar na mesma
  execução do candidato autorizado, não apenas os checks adicionados. Provas
  novas mantêm PG16 remoto separado do PG18.3 local.
- [ ] Readback do download confere checksum/schema/commit/run/attempt/versões e
  assertions/cleanup. Run verde, exit 0 ou aviso de digest sozinho não satisfaz o aceite.
- [ ] Expiração e procedimento autorizado de remoção estão documentados. Acesso
  não verificado/publicação não autorizada mantém P4 OPEN, mesmo com checks locais verdes.

Reversão: desativar somente passos/job/upload novos; preservar CI E2E PG16 existente.
Artefato sensível exige contenção e decisão do custodiante, não upload ampliado.

## Fechamento: o que atualizar depois da execução

P1 atualizou resultado U6 e ponteiros atuais de pesquisa/plano geral/índice; os
registros anteriores permanecem históricos. P2 concluiu somente seu aceite local
delimitado com puro 16/16, negativo nativo 2/2 e novo positivo 4/4; P3–P4 continuam abertos.
Atualizar esses documentos somente com provas reais
do candidato: comandos/cwd, contagens, exit/status, versões, hashes, limites,
cleanup e, quando existir, commit/run/artifact. Manter cada falha/NOT_TESTED
histórico no alcance original. Checkboxes P1 remetem à prova posterior; as de
P2 remetem à ficha posterior delimitada; as de P3–P4 continuam abertas.

P1 e P2 fecharam somente seus aceites locais delimitados; P3–P4 permanecem OPEN.
Isso **não encerra U6/etapa 2**, não aprova hosting, lifecycle/native/BFCache,
carga/SLO, recuperação produtiva, Resend ou migrations no banco da aplicação.
Estado atual: **P1 CONCLUÍDO / PASS local; P2 LOCAL_PASS delimitado; P3–P4 PLANNED / OPEN; destino BLOCKED; U6/etapa 2 OPEN.**
