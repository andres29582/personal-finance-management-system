# P4: preparação local concluída; aceite remoto aberto — 2026-10-15

**LOCAL_PREPARATION_COMPLETE / PURE_PASS; P4 REMOTE_NOT_TESTED / OPEN;
U6/etapa 2 OPEN; produção BLOCKED.** P3 segue LOCAL_PASS_BOUNDED / CLOSED
somente no aceite local já delimitado. Esta atualização é apenas documental;
não executa testes, instalação, CI, SQL, commit, push, upload ou publicação.

## Resultado atual e identidade privada

Preparação isolada em [resumo local](../../.tmp/p4-isolated-preparation-final-20261015/summary.json),
[manifesto completo](../../.tmp/p4-isolated-preparation-final-20261015/publication-manifest.json)
e [prova de artefatos](../../.tmp/p4-isolated-preparation-final-20261015/artifact-proof.json).
São evidências privadas em `.tmp/` ignorado, não artefatos publicados ou compartilháveis.

| Identidade SHA256 | Valor |
|---|---|
| Candidato isolado | `efe88b52e9fee8b67e2574dd7e6d1683cb985085fdea86af50402df215a555b9` |
| Manifesto completo | `8e380dedf1cacddcff0126f93866ae61f4ed6ebca8075cf579d72a6698d19822` |
| Resumo | `39148a37dfd8a534e8487b908e50ad15ce8003e0037d900c2742997b640e5712` |
| Prova de artefatos | `54a5674f9022b58585fad3f0008e36ba92fd4f45b1d16a152b312cac80a689a5` |

O manifesto cobre 1.001 arquivos: 143 alterados/adicionados, dez removidos e
858 reutilizados da base; o inventário U6 cobre 791 entradas e não inclui
`tools/p4`, coberto pelo manifesto completo. Readback independente posterior
conferiu os 1.001 arquivos, os 37 vínculos do resumo e os 38 da prova, incluindo
nomes UTF-8 e blobs DOCX da base. A suspeita anterior de mojibake era somente
exibição: não houve correção de nome. As 856 fontes canônicas, HEAD e índice
permaneceram inalterados durante a preparação privada. Estes dois documentos
mudam a identidade canônica depois do readback, não o candidato isolado congelado.

## Provas locais concluídas e limites

- Seis checks offline padrão passaram, sem ampliar caps: 153.728 ms no total;
  U6 no gate passou em 20.031 ms, abaixo de 60.000 ms. U6 separado passou
  40/40, sem skips Windows, em 15.680 ms; inventário: 10.333 ms contra 50.722 ms.
- P4 puro 17/17, configuração 107/107, deployment 8/8, tipos completos/build,
  `expect.poll`, cadeia exata instalada/lock 1.64.0 e guard de plataforma passaram.
  Não houve upgrade major frontend nem prova de instalação limpa.
- Otimização somente de testes: 16 varreduras amplas substituídas por leitura
  reutilizada restrita à chamada; oito seletores confrontados com três formas
  de inventário fresco e rejeição de mutação sintética de asset mantida.
  Sem mudança de runtime, aumento de cap ou retirada de Windows Job.
- Leitura CIM final bem-sucedida: zero processos sintéticos próprios encontrados.
  Linux real, instalação limpa, PG16 e E2E permanecem **NOT_TESTED**.

## Publicação continua bloqueada por autorização específica

A política de evidência pública foi aprovada: artefato por sete dias, logs por
90 dias e custódia pelo usuário. Isso **não** aprova publicação/commit exatos,
bootstrap no default branch/main, CI automática incidental existente nem uma
execução manual de 45 minutos vinculada ao commit exato. A revisão independente
de publicação continua um gate explícito; não houve publicação nesta unidade.

A revisão delimitada do fechamento selecionado examinou 55 registros novos e
103 da base, incluindo fixtures/defaults de desenvolvimento; não confirmou
novo segredo ativo. Não certifica ausência global de segredos nem constitui
auditoria de segurança backend de todos os 143 paths.

---

O conteúdo abaixo é histórico e foi preservado integralmente, inclusive
pendências e contagens válidas à época; não substitui o estado atual acima.

# P4: preparação local; aceite remoto ainda aberto

**P4 IMPLEMENTED_LOCAL / PURE_PASS; REMOTE_NOT_TESTED / OPEN. U6/etapa 2 OPEN;
produção BLOCKED.** Nenhum commit, push, upload, dispatch, PostgreSQL ou E2E
nativo foi executado nesta preparação. P3 permanece LOCAL_PASS_BOUNDED: sete
provas históricas/23 assertions + U5D atual/10, sem novo lote 8/8.

## O que está preparado

| Unidade | Limite |
|---|---|
| `.github/workflows/p4-proof.yml` | Somente manual, Ubuntu 24.04/Node 22/serviço PG16, job de 45 minutos, sem retry/cache/secrets; `contents: read`. A CI existente não foi alterada. |
| `p4-ci.cjs` | Tipos completos e de build sem emissão; chamadas explícitas U6 puro/offline; negativo PG16 e a mesma seleção Jest E2E existente, na mesma execução. Para na primeira falha. |
| `p4-pg16.cjs` | Apenas negativo SQL sintético Linux: archive PG16 novo, TOC de três tabelas, fail-fast e controle. Reusa `orderedToc`, `classifyRestore` e `validateNegative` sem alterá-los. Não porta os oito casos Windows. |
| `p4-proof.cjs` | Schema fechado, vínculo commit/run/attempt e hash do inventário; checksum obrigatório, JSON canônico, somente dois arquivos; download rejeitado em divergência. |
| `p4-proof.spec.cjs` | 17 testes puros: privacidade em todos os slots, origem/checksum/schema, falhas/timeout/descendentes sintéticos, adapter PG simulado, contrato YAML e parser Jest instalado. Não constituem prova PG16 nativa. |

Os quatro CJS ficam em `backendnest/test/session-harness/`. O adapter cria bancos
e roles exclusivos por run/attempt; o superuser serve apenas ao bootstrap e
descarte do serviço novo. Antes de DDL das tabelas verifica owner único, marker,
ausência de privilégios elevados e memberships. E2E conserva o guard original
de `test/e2e-database.ts`. Após fechar clientes, remove somente recursos criados
nesta invocação e verifica ausência; limpeza inconclusiva impede exportação.
O serviço pertence ao job e só termina no teardown do GitHub, não antes do upload.

Os comandos têm captura privada e grupos de processo Linux próprios, com caps e
rejeição de descendente sobrevivente. O log público recebe apenas códigos fixos;
o serviço usa `--log-driver=none`. Falhas não enviam diagnósticos, dumps ou logs.
Os dados privados transitórios do runner não entram na allowlist de upload.
Cancelamento forçado/teardown sem readback não produz PASS de cleanup.

## Prova local e reversão

Prova, inventário/hash atual, resultados efetivos, logs locais, manifesto de
paths e backups estão em `.tmp/p4-local-preparation-20261014/`; `proof.json`
é a referência final. A regressão iniciou RED por módulo ausente; uma fixture VM
precisou normalizar protótipos entre realms antes do GREEN, sem mudar C6.
P4 puro passou 17/17. U6 puro passou 39/39 em escalonamento revisado após
EPERM de dois filhos sintéticos na sandbox; a tentativa falha foi preservada.
Tipos backend completos passaram sem emissão. Verificações finais adicionais e
identidades exatas constam da prova, não são presumidas pelo status deste texto.
Node local é 24.14.0; Node 22/Ubuntu/PG16 continuam NOT_TESTED.

GitNexus não encontrou os novos símbolos (`UNKNOWN`); callers manuais:
workflow → driver → adapter/contrato; contrato → testes/readback. Nenhum caller
de produção foi alterado. `.github/workflows/ci.yml`, scripts npm e módulos U6/C6
existentes permanecem byte idênticos ao baseline desta preparação.

Rollback local: remover somente os cinco arquivos novos de código/workflow e
este documento, e restaurar os três documentos prefixados a partir de
`backup-0` (README da harness), `backup-1` (plano de pendências) e `backup-2`
(resultado U6). Nunca restaurar HEAD nem remover WIP/provas históricas.

## Publicação: autorização ainda necessária

O repositório remoto verificado é **público**. A proposta não muda visibilidade,
colaboradores nem os 90 dias atuais de retenção de logs do repositório.
O proprietário deve aprovar explicitamente:

1. O commit/branch e manifesto de fontes isolados, após readback independente
   de privacidade. Publicar fontes em repo público não é confidencial.
2. Leitores públicos e custódia pelo proprietário do repositório; conteúdo
   limitado a commit/run/attempt, hash, versões numéricas, checks, assertions
   negativas sintéticas, contagens E2E e cleanup. Sem dados pessoais, paths,
   ambientes, credenciais, logs, dumps, screenshots ou traces no artefato.
3. **Sete dias para este artefato**, aceitando separadamente os logs públicos
   de 90 dias. `retention-days: 7` está apenas no arquivo local, não aplicado.
4. Uma única execução manual: job até 45 minutos; instalação até 5 minutos;
   driver até 2.200 s + 20 s de término; tipos 120 s cada, U6 puro 60 s,
   U6 offline 660 s, negativo 180 s, E2E 900 s. Sem retry automático.
5. Registro de run/artifact ID, `expires_at` e hash após sucesso; proprietário
   verifica expiração ou exclui o artefato autorizado e confirma sua ausência.
   Remover um artefato não remove os logs nem cópias previamente baixadas.

### Duas precondições que impedem publicação automática

`workflow_dispatch` exige que o workflow esteja no default branch; sua inclusão
ali precisa de autorização e política de revisão próprias. Um arquivo só no
branch de candidato não resolve esse requisito. Além disso, `ci.yml` existente
executa em **todo push/PR**: publicar o candidato pode iniciar outros jobs com
logs não sanitizados. Antes do push, o proprietário deve aprovar uma rota que
não execute essa CI incidental. O mecanismo documentado `[skip ci]` só se aplica
a push/PR e pode deixar checks obrigatórios pendentes; não autoriza bypass de
branch protection. Nenhum desses caminhos foi aplicado nesta preparação.

O manifesto local lista exatamente nove paths desta unidade. Isso **não** é a
dependência completa de publicação: U6 inventaria backend/frontend/docs. A
estimativa inicial tinha 855 paths e 265 divergências/untracked frente ao remoto
`99752c55d4bc709d7dd36d44979ccfc8b65bc8f6`; o manifesto final atualiza a contagem.
Não publicar todo esse WIP nem tratá-lo como aprovado. Reconstruir e verificar
um candidato isolado pode exigir uma unidade posterior de dependências.

### Inputs exatos, somente depois das aprovações

No workflow **P4 bounded PG16 proof**, selecionar o ref do commit revisado:

```text
approved_commit = <SHA completo de 40 caracteres do ref selecionado>
evidence_policy = P4_PUBLIC_7D_OWNER_CUSTODY
```

O segundo input confirma a política proposta, não substitui o consentimento
humano nem a revisão de privacidade. SHA divergente interrompe o job antes dos
checks. Após upload, download pelo artifact ID da própria execução e readback
conferem dois arquivos, checksum/schema, commit/run/attempt, hash do inventário,
versões e assertions/cleanup. `passedAssertionResults` conta registros de casos
Jest aprovados, **não** chamadas individuais de `expect`.
O campo histórico U6 `remoteCI: NOT_TESTED` não foi reescrito; a prova P4 é separada.

## Referências oficiais verificadas na preparação

- [Execução manual e requisito de default branch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
  [permissões e timeouts](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
  [skip de push/PR e checks pendentes](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).
- [PG16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html),
  [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html),
  [serviço PostgreSQL no Actions](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).
- SHAs conferidos nas releases oficiais e links de commit:
  [checkout v4.2.2](https://github.com/actions/checkout/releases/tag/v4.2.2),
  [setup-node v4.4.0](https://github.com/actions/setup-node/releases/tag/v4.4.0),
  [upload-artifact v4.6.2](https://github.com/actions/upload-artifact/releases/tag/v4.6.2),
  [download-artifact v4.3.0](https://github.com/actions/download-artifact/releases/tag/v4.3.0).
- [Upload: hidden files e retenção](https://github.com/actions/upload-artifact),
  [download/acesso](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts),
  [remoção e expires_at](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts),
  [Docker logging driver none](https://docs.docker.com/engine/logging/configure/).

P4 só fecha após execução remota autorizada, readback independente do download e
verificação da política efetivamente aplicada. Preparação local não fecha P4,
U6/etapa 2, lifecycle/BFCache/native, carga/SLO ou produção.
