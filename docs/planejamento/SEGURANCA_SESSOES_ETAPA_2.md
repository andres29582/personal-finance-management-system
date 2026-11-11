# Etapa 2: sessões completas e confiáveis

## P3: aceite local delimitado encerrado — 2026-10-14

**P3 LOCAL_PASS_BOUNDED / CLOSED somente no aceite local; P4 OPEN;
U6/etapa 2 OPEN; produção BLOCKED.** Oito casos coordenados qualificados em
execuções aprovadas de candidatos diferentes: sete históricos/23 assertions e
uma tentativa U5D atual/10, total 33. Não é novo lote 8/8 do candidato atual,
receipt, fechamento global ou prontidão produtiva. A qualificação independente
de fontes/evidências não encontrou mudança concreta de comportamento compartilhado
que exija repetir as sete provas; elas não foram reexecutadas nem reclassificadas
como atuais. [Resultado atual, identidades, cleanup e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p3-aceite-local-delimitado-encerrado--2026-10-14).
P4 segue pendente, sem autorização de CI/deploy; este fechamento só acrescenta
documentação posterior à tentativa, sem novos testes/runtime. O histórico abaixo,
inclusive falhas e estados parciais, permanece integral e não descreve o estado
atual deste aceite local P3.

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

**Fechamento documental P2 — 2026-10-13:** P1 PASS local; P2 LOCAL_PASS delimitado: puro 16/16, negativo SQL nativo 2/2 e novo C6 positivo 4/4, em unidades separadas executadas em 2026-10-12 local. [Ficha atual e limitações](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p2-prova-local-delimitada--2026-10-12). A observação OS ao vivo adicional do negativo permanece NOT_TESTED. P3/P4 OPEN; U6/etapa 2 OPEN; produção BLOCKED. Os registros anteriores abaixo permanecem históricos; não houve nova execução neste fechamento.

**Plano delimitado — 2026-10-12:** [quatro pendências U6](SEGURANCA_SESSOES_ETAPA_2_U6_PENDENCIAS_PLANO.md): tipos completos, negativo SQL real C6, dispatch descartável e CI/política de evidência. P1 concluído com spec focado 1/1 e tipos backend completos/build noEmit PASS local; P2–P4 PLANNED/OPEN. Preserva o C6 positivo atual 4/4 e U6/etapa 2 abertas.

**U6 — 2026-10-12: recorte de preparação local implementado, provas parciais PASS e restore C6 real atual PASS 4/4; produção BLOQUEADA.** [Resultado atual](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md): coordenador offline finito, perfis incompletos seguros, manifesto allowlist/integridade e negativo C6 com mock. A prova offline inicial tem 119 testes selecionados mais um check de polling, sem DB/restore real. Depois, uma única execução separada do runner C6 manteve `--exit-on-error` e concluiu dump/restore PG18.3 e quatro fixtures HTTP/SQL reais, sem retry. Não houve negativo SQL real, reteste amplo, CI remota ou deploy. P1 posterior corrigiu TS2352 somente no spec: tipos backend completos/build noEmit exit 0 e Jest focado 1/1; [prova/limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p1-tipos-backend-completos-corrigidos--2026-10-12). O coordenador ainda fixa BLOCKED (P3), sem waiver. [Plano original](SEGURANCA_SESSOES_ETAPA_2_U6_PESQUISA.md). Hospedagem indefinida; U6/etapa 2 abertas, sem ativação ou prontidão completa; 0016/0017 não aplicadas ao banco da aplicação.

Readback independente U6 inicial: 837/837 hashes, 119 testes mais um check de polling confirmados por logs existentes, sem reexecução; [registro histórico e backups](../../.tmp/u6-independent-20261012/readback.json). Readback posterior C6: 837/837 fontes atuais e nove hashes de prova conferidos; autoridade bruta/microssegundos e schema metadata iguais antes/depois. [Resultado C6 atual e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#restore-c6-real-posterior--2026-10-12), [runtime](../../.tmp/session-harness-c6-bde3ca07bf2d418988d4a3adc796698f/runtime-proof.json), [fechamento independente/backups](../../.tmp/c6-final-restore-readback20261012/readback.json). Só estes dois documentos mudaram após a prova; 835 hashes restantes preservados. Cleanup próprio/portas livres confirmado; identidade externa/5432 apenas observável, com `ExecutablePath` nulo. Não equivale ao aceite das oito unidades: dispatch runtime U6/destino, upload/CI, negativo SQL real e recuperação produtiva continuam bloqueados ou não comprovados; tipos backend têm prova local P1 posterior separada. Históricos NOT_TESTED não foram convertidos retroativamente em PASS.

**U5 — 2026-10-12: recorte local de browser/controles de deploy concluído; deploy real BLOQUEADO.** HTTP/Nest/PG 11/11 histórico; dois casos browser PASS em execuções separadas (não matriz 2/2), ensaio privado PG18 U5D 10/10 e quatro checks puros PASS. [Resultado atual e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U5_RESULTADO.md#browser-e-controles-de-deploy--fechamento-local-em-2026-10-12). Readback independente sem reexecução confirmou 783 hashes do freeze U5R e não encontrou defeito concreto bloqueante nesse recorte; [manifesto](../../.tmp/u5-browser-deployment-final-20261012/readback.json). CI PG16 remota NOT RUN; destino/TLS/CORS/proxy/segredos e rollback publicado ainda não definidos/provados. [Procedimento manual futuro](../operacao/SESSOES_U5_DEPLOYMENT.md). Native/lifecycle genuíno/BFCache e capacidade continuam sem prova. U3/U4/U5/etapa 2 permanecem abertos, sem ativação; 0016/0017 não aplicadas ao banco da aplicação e Resend adiado. Falhas anteriores/históricos abaixo preservam seu alcance original, sem aprovação retroativa.

**Atualização mais recente C6/A8 — 2026-10-11: C6 PASS 4/4 fixtures; A8 PASS 1/1 caso browser, verificados independentemente por leitura de fontes e evidências, sem reexecução.** As cinco correções já estavam implementadas; agora há prova funcional dos casos delimitados. C7/C8 PASS local permanece preservado. U3/U4, U5/U6 e etapa 2 continuam abertas, sem ativação ou aceite de produção. [Resultado C6/A8 e limites](#c6a8--prova-funcional-delimitada-em-2026-10-11).

Os estados PENDENTE/ADIADA/FAILED e os orçamentos de startup abaixo são registros anteriores, válidos no momento de cada tentativa; não são o estado mais recente nem foram convertidos retroativamente em PASS.

**Atualização C7/C8 — 2026-10-11: ambos PASS delimitado em uma única execução local, com revisão independente das fontes/provas, sem reexecução.** C6/A8 continuam com verificação funcional PENDENTE/ADIADA; implementação das cinco correções encerrada por aceite, não PASS. Capacidade produtiva e ativação U4/etapa 2 não aprovadas. [Resultado atual C7/C8](#c7c8--observação-local-delimitada-em-2026-10-11). Os estados anteriores abaixo são registros históricos, preservados no alcance original.

**Correções da harness — 2026-10-11: implementação das cinco correções CONCLUÍDA, encerramento aceito pelo usuário; verificação funcional PENDENTE/ADIADA.** Não é PASS C6/A8 nem encerramento da etapa 2. [Aceitação e limites](#encerramento-aceito-da-implementação-da-harness--2026-10-11).

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

> **Caso 6 visível:** uma execução headed teve 0 PASS / 0 FAIL / 1 SKIP
> (13,642 s), hidden false/eventos vazios; texto de skip “Headless” era herdado,
> não a configuração real. Sondagem blank headed com minimização CDP genuína:
> timeout de hidden em 10 s, total 11,303 s, exit 1. Gate falhou; zero launches
> integrados depois. Comando de restore aceito não é bounds normal verificado.
> [Tentativa headed](../../.tmp/stage2-u4-browser-20261011-visible1/final-handoff.json),
> [sondagem](../../.tmp/stage2-u4-browser-20261011-visible2/capability-proof.json) e
> [readback independente, sem rerun](../../.tmp/stage2-u4-browser-20261011-visible2/independent-verification.json).
> Próxima prova precisa de ambiente interativo/dispositivo preparado e autorizado,
> nunca do banco da aplicação; nenhuma nova execução neste fechamento.

> **Histórico U4 em 2026-10-10:** política aprovada: 15 minutos de inatividade
> e 12 horas absolutas. Somente requests HTTP interativos elegíveis definidos pelo
> servidor renovam atividade; refresh, polling e startup/resume não renovam.
> Ler ou digitar sem request pode expirar; sessões legadas exigirão novo login.
> Candidato U4-A/B/C implementado e verificado independentemente no alcance local:
> backend 220/220 (22 suites), frontend 166/166 (17 suites), exit 0.
> Correção única U4-R1 do CHECK validada por inspeção e nova prova backend;
> frontend reaproveita prova independente sobre bytes inalterados, sem rerun.
> Types frontend e backend de produção exit 0; backend global mantém somente
> TS2352 preexistente em `orcamento.repository.spec.ts:35`, bytes intactos.
> [Resultado e limites U4](../validacao/SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md).
> PostgreSQL privado 18.3: **30/30 testes reais em 3 suites, exit 0**, com
> validação independente por leitura das evidências, sem reexecução. Os 16 SQLs
> completos foram aplicados três vezes em schemas limpos; isso não prova migration
> de legado populado com timezone histórico ambíguo nem equivalência com produção.
> Cleanup confirmado; nenhuma migration no banco da aplicação. Browser/native,
> carga, mixed-version, rollback de implantação e backup/restauração permanecem
> pendentes. **U4 não ativada/encerrada; U3, U5/U6 e etapa 2 abertas.**
> Registros anteriores abaixo são histórico, não substituem este estado atual.

> Atualização de prova em 2026-10-09: browser **CORE** com Expo oficial/Edge real
> verificado independentemente, **5/5, exit 0**, TypeScript global exit 0; 41
> hashes do manifesto/31 do produto estáveis. A prova local independente 151/151
> permanece. [Relatório](../../.tmp/stage2-u3-expo-browser/independent-verification.json)
> e [escopo/histórico](../validacao/SEGURANCA_SESSOES_ETAPA_2_U3_RESULTADO.md#browser-core-verificado-independentemente).
> `observeSessionLifecycle` não foi chamado: sem prova direta de notificações
> BroadcastChannel/lifecycle. O caso de três páginas usa 401 concorrentes, não
> 401 separadamente atrasado. Históricos 3/5 e 4/5 preservados. **U3 aberta**:
> PostgreSQL real, native, startup autoritativo, matriz ampliada e rollout pendentes.
> As falhas de carga/pedidos de reparação abaixo registram etapas anteriores.

**Status em 2026-10-09: U1 encerrada no escopo local aprovado, após verificação independente: typecheck global sem diagnósticos e 80/80 testes (9/9 da tela real), com 12 hashes estáveis. Bloqueio de GlassField resolvido; prova independente histórica de 71/71 preservada. U2 encerrada no escopo local aprovado após validação independente do sucessor: 138/138 testes em 12 suites, exit 0; typecheck global exit 0, zero diagnósticos e 16 hashes estáveis. U3 implementada e verificada localmente: após uma correção U3-R1, validação independente 151/151 em 15 suites, exit 0; TypeScript global exit 0, zero diagnósticos e 38 hashes estáveis. U3 NÃO encerrada; U4–U6 não implementadas; etapa 2 aberta.**

Veja a [ficha técnica e os limites de U1](../validacao/SEGURANCA_SESSOES_ETAPA_2_U1_RESULTADO.md).
Veja também a [ficha de logout U2](../validacao/SEGURANCA_SESSOES_ETAPA_2_U2_RESULTADO.md).
Veja a [pesquisa de U3](SEGURANCA_SESSOES_ETAPA_2_U3_PESQUISA.md) e a
[ficha do candidato implementado](../validacao/SEGURANCA_SESSOES_ETAPA_2_U3_RESULTADO.md).
A política de reautenticação para refresh desconhecido foi aprovada. Cápsula,
coordenação e fences cliente possuem prova local independente delimitada, em
`.tmp/stage2-u3/correction-independent-verification.json`; U3 permanece aberta:
browser CORE Expo/Edge passou 5/5 e foi verificado independentemente. As falhas
anteriores de carga são histórico, não o resultado atual. Backend/commit real,
lifecycle/notificações diretos, 401 separadamente atrasado, native, rollout e
startup autoritativo continuam gates, não aprovação de produção.
Veja a [pesquisa e o plano U4](SEGURANCA_SESSOES_ETAPA_2_U4_PESQUISA.md): somente
proposta documental; 15 min/12 h e semântica de atividade ainda não aprovados,
sem implementação, migration ou execução de runtime.

Objetivo: manter a sessão correta diante de refresh, logout, múltiplas abas,
troca de conta, indisponibilidade e expiração; permitir consultar e revogar
sessões próprias. Preservar a autenticação customizada NestJS/PostgreSQL/JWT e
as proteções de credenciais da etapa 1. Não substituir o provedor de identidade.

## Leitura rápida

1. Preservar o fechamento local aprovado de U1/U2; aprovar as decisões da seção 4 antes das unidades dependentes.
2. Implementar unidades U3–U6, com regressão antes da correção.
3. Demonstrar S2-01–S2-12 em testes, PostgreSQL isolado e navegador real.
4. Publicar evidências e operação; só então declarar a etapa encerrada.

**Limite da análise inicial (anterior a U1):** auditoria estática, pesquisa em fontes oficiais e
plano. Não foram executados testes, conexões, migrations, emails ou alterações
de runtime. Os **172 testes históricos da etapa 1 não comprovam a etapa 2**.
Referências de código são do worktree atual e podem mudar após implementação.
Valores privados de ambiente não foram inspecionados.

**Pendência deliberada:** integração real do Resend e entrega de notificações
da etapa 1 ficam adiadas a pedido do usuário. Não ativar worker/live nem
interpretar simulação como entrega. O núcleo local e as migrations 0014/0015
devem permanecer preservados; o estado operacional atual está no
[relatório da etapa 1](../validacao/SEGURANCA_CREDENCIAIS_ETAPA_1_RESULTADO.md),
não nos trechos históricos do plano anterior.

## 1. Escopo e critérios de segurança

| Dentro da etapa 2 | Fora desta etapa |
|---|---|
| Refresh/logout concorrentes, múltiplas abas e troca de conta | Email real/Resend, verificação ou alteração de email |
| Erros transitórios, resposta perdida, startup/resume | Política de senhas, Argon2id, MFA e migração de identidade |
| Sessão atual, listagem e revogação individual/todas | Alterações financeiras ou migrations antigas não relacionadas |
| Inatividade, duração absoluta e autoridade no servidor | Garantia de operação financeira offline ou replay automático |
| Armazenamento, privacidade, acessibilidade e operação | Classificação AAL ou certificação OAuth/NIST |

Invariantes de aceite:

- Sessão revogada não volta por refresh, resposta atrasada ou reinício do app.
- Erro da conta A não apaga nem preenche dados da conta B.
- Falha de rede não equivale a credencial inválida; autoridade desconhecida
  bloqueia dados e ações protegidos sem destruir automaticamente a sessão.
- Logout local é imediato; revogação remota só é confirmada após o servidor.
- Nenhum ID enviado pelo cliente permite consultar/revogar sessão de outro usuário.
- Tokens expiram, mas isso não substitui limites de sessão impostos pelo servidor.

## 2. Baseline e lacunas verificadas

### Proteções existentes a conservar

- `backendnest/src/auth/repositories/auth-session.repository.ts:24–80`:
  criação serializada pelo lock do usuário, validação do hash esperado e poda
  das sessões mais antigas. `:106–134`: rotação por CAS, lock e relógio do banco.
- `backendnest/src/auth/auth.service.ts:257–285`: comprovação da senha atual e
  uso da transação de credenciais existente. Não separar senha, invalidação de
  links e revogação de sessões.
- `backendnest/src/auth/strategies/jwt.strategy.ts:20–68`: validação da sessão
  persistida em requests protegidos. Não reduzir a validação à assinatura JWT.
- `frontend/src/shared/services/api.ts:97–149`: snapshot/generation e
  single-flight dentro de um runtime. Não remover essas proteções.
- `backendnest/src/auth/config/auth-token.config.ts:39–67`: defaults de código
  de access token 15 minutos, refresh 30 dias e máximo de 5 sessões. Não afirmar
  que sejam os valores efetivos da configuração privada.

### Achados priorizados

P1 significa corrigir antes de declarar a etapa 2 encerrada; não é uma
afirmação de exploração observada. Fontes abaixo demonstram o comportamento
estático; cenários de concorrência ainda precisam de prova executada.

| ID | Prioridade e achado | Evidência e resultado esperado |
|---|---|---|
| F1 | P1: resolução universal de 401 desfaz as proteções do interceptor | `frontend/utils/api-error.ts:25–47` chama `clearSession()` em qualquer 401. `frontend/src/shared/services/api.ts:118–122,174–180` preserva credenciais no refresh transitório, mas devolve o 401 original. O consumidor pode apagar a sessão mesmo assim; erro atrasado de A também pode apagar B. Centralizar a decisão com identidade/generation, não no helper de texto. |
| F2 | P1: múltiplas abas e resultado perdido da rotação | `backendnest/src/auth/auth.service.ts:183–236`, especialmente `:216–229`, revoga ao perder CAS. Duas abas com N podem invalidar o vencedor N+1. `frontend/src/shared/services/api.ts:102–132` coordena apenas o módulo atual; `frontend/storage/authStorage.ts:8–57` também. Serializar entre abas e tratar resultado ambíguo explicitamente. |
| F3 | P1: ausência de política de inatividade/duração total | `backendnest/src/auth/entities/auth-session.entity.ts:3–35` não define os limites; `backendnest/src/auth/strategies/jwt.strategy.ts:20–68` usa relógio de processo e touch separado. A autoridade deve validar e atualizar atomicamente, com relógio do banco. |
| F4 | P1: logout local depende de transporte sem limite explícito | `frontend/src/modules/dashboard/screens/HomeScreen.tsx:28–36` e `frontend/src/modules/dashboard/hooks/useDashboardData.ts:85–93` aguardam logout remoto antes de limpar. Invalidar localmente primeiro e limitar o request remoto. |
| F5 | P1: não há gestão completa de sessões | `backendnest/src/auth/auth.controller.ts:30–76` não oferece listagem/revogação remota/todas. `backendnest/src/auth/repositories/auth-session.repository.ts:137–165` tem update proprietário, mas revogação em lote sem lock de usuário. Antes de expor logout-all, serializar com criação/rotação e definir seu ponto de ordenação. |
| F6 | P1: sucesso atrasado, startup e publicação parcial | `frontend/src/shared/services/api.ts:155` apenas desembrulha sucesso; `frontend/src/modules/auth/screens/LoginScreen.tsx:50–63` grava itens separadamente. `frontend/src/navigation/RootLayout.tsx:6–54` confia na presença do token. Publicar snapshot completo e impedir dados/caches de A após B; validar startup/resume antes de liberar conteúdo. |

Outros pontos conectados: os timestamps existentes de sessão são sem timezone;
migração/backfill devem verificar a semântica histórica antes de converter.
SecureStore no native e localStorage na web têm fronteiras de segurança distintas
(`frontend/storage/authStorage.ts:67–90`). Testes atuais de interceptor não
cobrem todo o percurso até `resolveApiError` e a tela.

## 3. Pesquisa oficial: o que aplicar e o que não inferir

Fontes consultadas em **2026-10-08**. Recomendações externas não são prova de
que o sistema atual as implementa.

| Fonte primária | Aplicação ao plano |
|---|---|
| [OWASP — Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Limites de sessão no servidor, invalidação e monitoramento; token TTL sozinho não resolve sessão. |
| [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) | Orientação atual AAL2: 24h total/1h inatividade; AAL3: 12h/15min. O AAL deste produto não foi estabelecido. Propor política financeira mais conservadora não torna o sistema AAL3. |
| [RFC 9700 §4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14) | Rotação detecta reutilização, mas não identifica qual participante é legítimo. Usar como referência de ameaça, não declarar conformidade OAuth para auth customizada. |
| [RFC 7009](https://www.rfc-editor.org/rfc/rfc7009.html) | Falha de revogação não prova sucesso; autoridade persistida é necessária para impedir uso residual. Sem afirmar que os novos endpoints sejam OAuth. |
| [PostgreSQL — Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) | Ordem consistente de locks e transações; observar o tempo após adquirir lock e publicar tokens só após commit. |
| [MDN — Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API), [storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) | Lock por origem/contexto compatível, comunicação com restrições de partição; storage event não é lock e não notifica o próprio escritor. Feature detection obrigatória. |
| [OWASP — HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) | Tokens em localStorage são acessíveis por JavaScript e expostos a XSS. A coordenação entre abas não elimina esse risco. |
| [OWASP — CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [MDN — Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies) | Cookie HttpOnly exige decisão de topologia/origin, CSRF e compatibilidade native; SameSite é defesa adicional, não solução isolada. |
| [OWASP — IDOR](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html), [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) | Owner vindo do guard, logs mínimos sem tokens e reautenticação em ações de risco. ID opaco não substitui autorização. |

## 4. Proposta de política e decisões pendentes

Estas são **propostas**, não aprovações nem configuração já alterada.

| Decisão | Proposta inicial e tradeoff |
|---|---|
| Inatividade e duração absoluta | 15 minutos de inatividade e 12 horas totais; conservador para dados financeiros, com mais logins. Aprovação de produto necessária; não é alegação de AAL3. Manter TTL JWT separado e máximo atual de 5 sessões. |
| Atividade válida | Ação autenticada do usuário confirmada pelo servidor. Refresh automático, polling, telemetria e listagem de sessões não renovam presença. Não confiar em timestamp arbitrário enviado pelo cliente. |
| Resposta perdida de refresh | Manter rotação estrita: sem retry cego do token antigo após envio possivelmente confirmado. Se não houver snapshot novo verificável, solicitar reautenticação explicada, sem afirmar invasão. UX contínua exige decisão separada de idempotência limitada por operação exata. |
| Transporte web | Para primeira correção delimitada, reconhecer o risco residual do bearer/localStorage. Recomendar refresh em cookie HttpOnly somente após validar topologia, CSRF e native. Não fechar segurança de produção sem escolha explícita e mitigação documentada. |
| Plataformas sem Web Locks | Não usar storage event como mutex. Exigir fallback implementado e provado, ou declarar a plataforma não suportada para refresh compartilhado; bloquear a promessa de suporte até decisão. |
| Retenção e metadata | Labels aproximados de navegador/plataforma, não fingerprint estável nem IP completo exibido. Prazo de retenção/limpeza e finalidade de logs dependem de aprovação; não criar retenção automática arbitrária. |
| Logout-all | Incluir sessão atual, confirmação de intenção e reautenticação adequada ao risco. Ordenar com login/refresh pelo lock do usuário; uma autenticação nova linearizada depois da revogação é uma nova sessão legítima. |

U1 pode começar após aprovação de seu escopo: correções de defeitos já
demonstrados no código não dependem de decidir todos os parâmetros de produto.
Antes de cada unidade dependente, aprovar duração/atividade, perda de resposta,
transporte web/native, fallback suportado ou retenção aplicáveis. Não criar novos serviços
de identidade, Redis, fingerprints ou dependências sem necessidade demonstrada.

## 5. Arquitetura proposta

### Autoridade no servidor

Reutilizar transação/lock de usuário de credenciais. Ordem única para criação,
rotação e revogação em lote; limites de espera finitos. Validar proprietário,
revogação, idle/absolute e token esperado no mesmo contexto transacional.
Capturar relógio do PostgreSQL **depois** do lock; não usar `Date.now()` como
autoridade de política. A validação/touch deve devolver resultado efetivo e
não aceitar autenticação com update que afetou zero linhas.

Registrar `createdAt`, limite absoluto e última atividade válida sem renovar
o absoluto a cada refresh. Fazer atualização de atividade com predicado
atômico; otimização de escrita só após prova de que não aumenta o limite de
inatividade. Avaliar custo de locks/checks em requests financeiros; índices
por owner/estado/tempo e limpeza devem ser demonstrados, não pressupostos.

Logout impede novas autorizações após seu ponto de commit. Não prometer abortar
todo efeito de uma operação financeira já autorizada e em execução; operações
críticas precisam de sua própria fronteira transacional.

### Estado do cliente e coordenação

Estados explícitos: `validating`, `authenticated`, `temporarilyUnavailable`,
`reauthenticationRequired` e `signedOut`. Mensagens distinguem expiração,
revogação, falha transitória e resultado desconhecido. Resolver erros sem
efeitos colaterais globais; decisões de auth exigem sessionId/generation.

Publicar tokens/usuário como envelope versionado e coerente; migrar as chaves
atuais com rollback definido. Persistir generation/tombstone suficiente para
invalidar respostas anteriores entre abas e após reload. Invalidar caches,
promises e dados exibidos na troca de conta/logout; filtrar tanto erro quanto
sucesso atrasado. Falha de storage deve produzir estado seguro, não login parcial.

Na web compatível, adquirir Web Lock e **reler** o envelope antes de refresh;
outra aba pode já ter rotacionado. BroadcastChannel/storage notificam alterações,
mas a leitura e CAS sob coordenação são a autoridade local. Não publicar tokens
em mensagens ou logs. Native usa serialização local e SecureStore, com prova de
suspend/resume e falhas de storage; não supor APIs browser no native.

No startup/resume, validar sessão no servidor antes de expor dados protegidos.
Se a rede falhar, conservar snapshot local, ocultar dados financeiros protegidos
e bloquear mutações até recuperação. Não transformar cache em autorização.

### Transporte, refresh e logout

Separar falha comprovadamente anterior ao envio de resposta perdida após envio:
na segunda, a rotação pode ter sido commitada. Releitura pode encontrar o novo
snapshot de outra aba; se não encontrar, o padrão proposto pede reautenticação.
Não aceitar token antigo genericamente durante janela de graça. Uma alternativa
de idempotência por operation ID exato precisa de análise de replay, ligação à
sessão, retenção limitada e decisão prévia; não é parte automática deste plano.

Logout: capturar identidade/credencial da sessão a encerrar, aumentar generation,
limpar caches/storage e navegar imediatamente; depois request remoto com timeout
finito e snapshot antigo. Não usar token de uma conta recém-aberta. Se a confirmação
remota falhar, informar que o dispositivo saiu, mas a revogação remota não foi
confirmada. Não guardar credenciais secretamente para retry nem relogar para isso.

Sem replay automático de POST/PATCH/DELETE financeiros. Retry limitado de uma
requisição após 401 só quando o contrato prova rejeição antes do efeito e mantém
snapshot correto; resultado financeiro ambíguo exige reconciliação específica.

## 6. Contratos HTTP propostos

Preservar o envelope de resposta/erro existente e `/auth/logout`. Os endpoints
abaixo são **novos contratos propostos**, não rotas disponíveis hoje.

| Rota | Contrato de sucesso e proteção |
|---|---|
| `GET /auth/session` | Estado autoritativo da sessão atual: ID, limites e horário do servidor. Não conta como atividade. Owner/sid vindos do guard. |
| `GET /auth/sessions` | Lista paginada limitada de sessões próprias: ID, `isCurrent`, label aproximado, criação/última atividade/expiração/estado. Sem hashes, tokens, fingerprint ou IP completo. |
| `DELETE /auth/sessions/:id` | Revogação idempotente de sessão própria; mesma resposta para alvo inexistente ou de outro usuário para não enumerar identidade. Revogar atual implica saída local. |
| `POST /auth/sessions/revoke-all` | Revoga todas, inclusive atual, com confirmação/reautenticação definida; lineariza com criação/rotação. Não aceitar owner no body. |

Erros tipados propostos: `AUTH_SESSION_REVOKED`, `AUTH_SESSION_IDLE_EXPIRED`,
`AUTH_SESSION_ABSOLUTE_EXPIRED`, `AUTH_INVALID_REFRESH_TOKEN` são terminais
apenas para o snapshot correspondente. `AUTH_SESSION_UNAVAILABLE`/503 e timeout
não comprovam invalidez. `stale`/cancelamento de generation é resultado local,
não erro de segurança da conta atual. `AUTH_REFRESH_OUTCOME_UNKNOWN` representa
ambiguidade local, não prova de ataque. 403 por regra de negócio não faz logout.
Logar categoria, request ID e resultado mínimo; nunca senha, JWT, refresh token,
passfile ou payload financeiro. Respostas/listas devem usar `Cache-Control: no-store`.

## 7. Unidades de implementação e ordem

Um único writer por vez; cada unidade entrega comportamento, testes e documento
coerentes. Não criar commits automaticamente. Antes de editar cada símbolo,
executar GitNexus `impact` upstream e comunicar blast radius; índice obsoleto não
substitui leitura de fonte. Antes de eventual commit, `detect_changes` e revisão
do diff para preservar WIP não relacionado.

| Unidade | Dependência / entrega | Prova e rollback |
|---|---|---|
| U1 — erros e isolamento | F1/F6: classificar resultados; retirar clearing universal; cercar sucesso/erro/caches por snapshot, login coerente | RED no fluxo interceptor→resolver→tela; GREEN e regressão A→B. Reverter como unidade sem alterar política de servidor. |
| U2 — logout confiável | U1: logout local imediato, tombstone persistido e request remoto limitado | Barreira refresh/logout, falha de rede, reload e conta B; remover unidade sem enfraquecer etapa 1. |
| U3 — rotação entre contextos | Política estrita aprovada; cliente com cápsula coerente, Web Locks/releitura, fila native, marcador antes do envio e fences. Uma correção U3-R1 validada independentemente: 151/151, 15 suites, exit 0; types global 0/zero. [Resultados e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U3_RESULTADO.md) | Browser CORE Expo/Edge 5/5, exit 0, verificado independentemente; falha Edge 3/3 de carga é histórica. Lifecycle/notificações diretos, 401 separadamente atrasado, PostgreSQL/commit, replay real, dispositivo, BFCache/partições, rollout e startup autoritativo pendentes; U3 NÃO encerrada. |
| U4 — política autoritativa | [Pesquisa/plano](SEGURANCA_SESSOES_ETAPA_2_U4_PESQUISA.md) documentados, não implementados; decisões de duração/atividade pendentes: migration aditiva, legado UTC com proveniência ou reautenticação, check/touch e locks | PostgreSQL real com barreiras/relógio após lock usuário e sessão; rollback não reativa sessão revogada/expirada. Não remover colunas nem voltar a writer que ignore limites. |
| U5 — gestão de sessões | Primeiro recorte aprovado/implementado localmente: API owner-only + UI atual/remota/todas, sem nova coleta de dispositivo; reautenticação e orçamento por conta. Readback independente concluído, sem reexecução. [Resultado](../validacao/SEGURANCA_SESSOES_ETAPA_2_U5_RESULTADO.md) | HTTP/PostgreSQL 11/11; browser/acessibilidade visual, plataformas e rollout ainda sem prova. Endpoint/UI removíveis juntos, preservando autoridade U4. |
| U6 — fechamento operacional | [Pesquisa/plano local](SEGURANCA_SESSOES_ETAPA_2_U6_PESQUISA.md) concluído em 2026-10-12; implementação não iniciada, hosting indefinido. Contrato preservado: U1–U5, regressão etapa 1, navegador/native, operação, prova final independente | Evidências da matriz, backup/restauração antes de migration local futura e rollback ensaiado; não declarar fechamento com plataforma obrigatória não verificada. |

## 8. Matriz de verificação S2

Todo item deve registrar comando/cenário, versão, resultado exato e evidência
sanitizada. Mocks isolados não comprovam PostgreSQL nem coordenação browser.

| ID | Caso e resultado observável | Nível/evidência requerida |
|---|---|---|
| S2-01 | 401 protegido + falha de refresh comprovadamente pré-envio ou resposta transitória conhecida sem commit de rotação: conservar snapshot, indicar indisponibilidade, bloquear dado/ação protegida; recuperação válida libera sem logout arbitrário. Timeout após possível envio com commit desconhecido segue S2-04, não este caso | Integração API→resolver→tela, não só interceptor; navegador com falha controlada |
| S2-02 | Erro 401 e sucesso 200 de A chegam após login B: não limpar B nem mostrar dados/cache A | Integração storage/API/UI com barreiras + browser |
| S2-03 | Duas abas usam N: só uma rotação; segunda relê N+1, sem revogar vencedora | Browser real mesma origem/partição + PostgreSQL; feature detection/fallback |
| S2-04 | Resposta de refresh perdida depois do commit: sem retry cego; novo snapshot verificável ou reautenticação explicada. Falha pré-envio não vira prova de ataque | Transporte controlado + PostgreSQL real; não apenas rejeição Axios mock |
| S2-05 | Refresh e logout ordenados em ambos os sentidos: resposta atrasada não restaura storage nem autorizações pós-revogação | PostgreSQL/barreiras, browser/reload, generation persistida |
| S2-06 | Logout offline encerra UI imediatamente, limpa caches, informa revogação não confirmada; conta B não recebe request antigo | Integração UI/timeout + browser offline e posterior reconexão |
| S2-07 | Limites idle/absolute nos pontos antes/igual/depois: negados no servidor; polling/refresh/lista não estendem presença/absoluto | PostgreSQL com relógio controlável; timezone e espera após lock |
| S2-08 | Startup/reload/native resume com snapshot válido, revogado, expirado ou rede ausente: sem exposição anterior à validação | Browser real + native suportado; armazenamento parcial/falha |
| S2-09 | Listar/revogar sessão alheia, ID inexistente e payload owner forjado: zero acesso/cruzamento de tenant; repetição idempotente | HTTP com guard real + banco isolado; logs/response sanitizados |
| S2-10 | Logout-all versus login/refresh; máximo 5 e locks ordenados: sem sessão anterior escapando, sem deadlock não limitado; novo login posterior distinguível | PostgreSQL real, transações em barreiras e timeouts; múltiplas instâncias |
| S2-11 | Migration/backfill preserva timestamps/owners/revogações e configurações válidas; rollback de código não reativa sessões | Restore isolado, comparação de schema/contagens e UTC explícito; nenhum teste no banco da aplicação |
| S2-12 | Mudança/reset de senha mantém invalidar links/todas sessões, login antigo bloqueado; metadata/retention/logs sem segredos e UI acessível | Regressões etapa 1 + revisão independente; keyboard/screen reader e volume representativo de check/touch/lista |

**Gate adicional condicionado ao transporte escolhido:** se refresh em cookie
HttpOnly for adotado, comprovar CSRF e validação de origem, CORS com credentials
somente nas origens autorizadas, atributos seguros/escopo do cookie e compatibilidade
native. Testar resposta atrasada com `Set-Cookie` depois do logout: mesmo que o
browser aceite o cookie, ela não pode recuperar autorização nem ressuscitar a
sessão revogada. Essa prova é obrigatória para o transporte adotado; ausência de
harness/plataforma não autoriza encerrar segurança de produção. Se não for adotado,
registrar a escolha bearer e seu risco residual, sem alegar cobertura de cookies.

### Harness e comandos existentes

Scripts verificados em `backendnest/package.json` e `frontend/package.json`.
Comandos abaixo são **planejados**, não executados nesta análise:

```text
# cwd: backendnest
npm test -- --runInBand --testPathPatterns=auth
npm run test:e2e -- --runTestsByPath test/credential-boundaries.e2e-spec.ts test/auth-password-reset.e2e-spec.ts
npm run build

# cwd: frontend
npm test -- --runInBand --runTestsByPath __tests__/services/api.test.ts __tests__/services/credential-session-races.test.ts __tests__/storage/authStorage.test.ts __tests__/utils/api-error.test.ts __tests__/navigation/_layout.test.ts
npm run typecheck
npm run export:web
```

Adicionar testes da etapa 2 às unidades; esses paths existentes não cobrem
automaticamente a nova matriz. `backendnest/test/e2e-database.ts` exige banco
isolado com prefixo `finance_e2e_`, identidade/marker apropriados e reseta schema.
**Nunca apontar o harness para `gestao_financeira` nem copiar credenciais privadas.**
Erro TypeScript histórico não relacionado em `orcamento.repository.spec.ts:35`
(TS2352) permanece conhecido; não excluir testes silenciosamente para alegar
baseline global aprovado.

**Histórico da auditoria inicial:** ainda não havia harness de navegador E2E e
Playwright era uma opção pendente. **Estado atual:** harness CORE oficial Expo,
`@playwright/test@1.64.0`, script `test:session-browser` e config existentes;
5/5 no Edge, exit 0, verificados independentemente no escopo delimitado U3.
Prova manual repetível pode ser complementar, mas não substitui
concorrência determinística. Registrar plataforma não disponível como pendente,
nunca como PASS. Normalização de fontes, quando houver, vem antes da prova final.

## 9. Migração, operação e encerramento

- Migration aditiva versionada: validar timezone original; não converter
  `timestamp` usando timezone implícito. Backfill conservador explícito para
  sessões existentes, com política aprovada e sem aumentar limites silenciosamente.
- Antes de aplicar no banco local: autorização específica, backup protegido,
  restauração real isolada, migration/rollback ensaiados. Os testes usam outro banco.
- Compatibilidade: coordenar versões cliente/servidor e envelope legado; não
  habilitar política com clientes antigos que renovam presença de forma indevida.
- Observar erros terminais/transitórios, rotação ambígua, lock timeout e duração
  do check/touch sem registrar segredos. Dimensionar custo de update por request,
  índices e limpeza antes de alegar comportamento sob carga.
- Falha do serviço/DB preserva snapshot local, mas falha fechada para acesso
  protegido. Não liberar dados porque JWT ainda não expirou.

### Checklist de encerramento futuro

- [ ] Decisões de produto/transporte/plataformas/retention aprovadas e registradas.
- [ ] F1–F6 corrigidos com RED→GREEN→REFACTOR e testes na mesma unidade.
- [ ] S2-01–S2-12 possuem evidência concreta; integrações cobrem o fluxo completo.
- [ ] PostgreSQL, navegador multiaba e native suportado comprovados; indisponível não é PASS.
- [ ] Regressões da etapa 1 preservadas; nenhuma integração real Resend ativada.
- [ ] Privacidade, acessibilidade, custos de DB e migração/rollback revisados.
- [ ] Revisão independente sem bloqueadores e runbook atualizado.
- [ ] Mudança local aplicada somente com backup/restauração e autorização futura.
- [ ] Relatório final distingue desenvolvimento, aplicação local e produção.

**Próximo passo:** decidir a política de duração/atividade e legado a partir da
[pesquisa U4](SEGURANCA_SESSOES_ETAPA_2_U4_PESQUISA.md), mantendo os gates U3
explicitamente abertos. A correção da harness Expo CORE já possui prova 5/5;
lifecycle/notificações diretos, 401 separadamente atrasado, PostgreSQL, native,
startup autoritativo e rollout ainda precisam de evidência. Isso não fecha U3
nem etapa 2 e não autoriza implementação automática, migration, U5/U6, Resend
ou produção. A solicitação antiga de reparar a harness é histórico preservado
nos relatórios, não pendência atual desse CORE.

### Progresso de U2 em 2026-10-08

- Logout invalida generation, oculta auth e limpa dados Home/dashboard antes da rede; RootLayout reage sem aguardar storage.
- Tombstone não secreto `auth_signed_out` antecede a remoção dos segredos; leituras/refresh respeitam o marcador após reload. Apenas login completo atual o remove; escritores individuais não reabrem auth.
- Revogação: uma tentativa com JWT antigo capturado, Axios dedicado, deadline/abort de 5 segundos e nenhum refresh/retry. Aviso distingue saída local, confirmação remota e falha de persistência sem prometer reload.
- Histórico interrompido: logs reportaram 138/138 testes em 12 suites e nenhum diagnóstico TypeScript, mas os códigos de saída separados não foram preservados; não era prova independente naquele momento. Evidência de recuperação `.tmp/stage2-u2/evidence.json`. Prova atual independente do sucessor: 138/138 em 12 suites, exit 0; typecheck global exit 0, zero diagnósticos, incluindo U1 e consumidores reais HomeScreen/RootLayout/useDashboardData. Evidência `.tmp/stage2-u2/correction-independent-verification.json`.
- S2-05/S2-06 têm cobertura delimitada do cliente, não aprovação integral. PostgreSQL/barreiras, browser offline/reload real, multiaba e native real ficam em U3/U6. Resend continua adiado.

### Correção delimitada e fechamento local de U2 em 2026-10-09

Verificação independente inicial: 137/138 testes e typecheck exit 0; um timeout de consumidor, sem defeito de produto confirmado. Apenas sincronização/cleanup do teste Home ajustados; reprodução instrumentada confirmou o fluxo real, mas a causa temporal original permanece não comprovada. Nova execução local exata e validação independente final: 138/138 em 12 suites, exit 0, e typecheck global exit 0, zero diagnósticos. Candidato corrigido em `.tmp/stage2-u2/corrected-final.json`; evidência independente `.tmp/stage2-u2/correction-independent-verification.json`, com 16 hashes estáveis. Fechamento documental preserva 14 hashes de código/testes em `.tmp/stage2-u2/documentary-closure.json`. U2 encerrada no alcance local aprovado; U3–U6 e etapa 2 permanecem abertas. Resend continua adiado.

### U4: startup isolado comprovado em 2026-10-10

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
barreiras de concorrência não foram executados: dependem de nova autorização.
Produção e banco atual da aplicação não foram tocados; sem Resend, commit ou
deploy. Esta atualização é apenas documental, sem runtime ou normalizadores.

Detalhes no [resultado U4 atualizado](../validacao/SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md).

### U4: integração real bloqueada no login em 2026-10-11

**Bloqueador atual de produto: emissão do JWT no login. U4 não está aprovada para ativação; U5 não deve avançar antes da correção autorizada e de nova prova.** A matriz SQL anterior **30/30** permanece válida no seu alcance delimitado; ela não comprovava a assinatura pelo JwtService configurado no fluxo real de login.

Uma única execução integrada usou PostgreSQL descartável, Nest com AppModule real e Edge com Expo Router, RootLayout e LoginScreen de produção. Os sete casos falharam na expectativa de conteúdo protegido após login: **0 aprovados / 7 falhos**, em **82,285 segundos**, com um worker concorrente e retries=0. Houve sete POSTs de login; os índices de workers 0–6 representam substituições sequenciais após falhas, não novas tentativas dos casos. As asserções comportamentais de 900/43200 segundos, resposta atrasada, suspensão/retomada, BroadcastChannel e mutação ambígua **não foram alcançadas**.

A reprodução com as bibliotecas instaladas e o readback independente confirmaram que signCappedToken remove expiresIn para assinar exp explícito, mas JwtService repõe o default de 15m do JwtModule; jsonwebtoken rejeita exp e expiresIn juntos. A alternativa expiresIn: undefined também é inválida. Nenhum código de produto foi corrigido; a autorização desta etapa era de teste, não de reparo.

Ver [resultado integrado e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md#integração-real-de-navegador-em-2026-10-11-bloqueada-no-login), [relatório de navegador](../../.tmp/stage2-u4-browser-20261011-bounded2/browser-report.json), [reprodução instalada](../../.tmp/stage2-u4-browser-20261011-bounded2/jwt-capping-reproduction.json) e [validação independente sem reexecução](../../.tmp/stage2-u4-browser-20261011-bounded2/independent-verification.json).

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

O próximo diagnóstico/teste descrito acima fica adiado; só será retomado se o usuário solicitar, com autorização e orçamento próprios. Atualização somente documental, sem runtime, testes, fontes, configuração, banco, commit ou deploy. [Registro da aceitação](../validacao/AUDITORIA_HARNESS_SESSOES.md#encerramento-aceito-da-implementação--2026-10-11); [backup dos bytes anteriores](../../.tmp/harness-implementation-close-20261011/baseline.json).

### C7/C8 — observação local delimitada em 2026-10-11

**C7 PASS / C8 PASS local.** Uma única invocação combinada do runner mantido usou Nest/AppModule real e PostgreSQL privado 18.3; não repetiu C6/A8 nem exportou browser. Os antigos C7/C8 NOT RUN permanecem históricos; esta prova posterior não os altera retroativamente.

| Perfil | Respostas reais | Concorrência | p50 / p95 / p99 |
|---|---|---|---|
| C7, mesma conta | 20 autorizadas HTTP 200 + 6 terminais HTTP 401 com motivos exatos | 2 e 5; 10 autorizadas por nível | 25 / 89 / 100 ms, somente as 20 autorizadas |
| C8, contas distintas | 20 autorizadas HTTP 200 | 2 e 5; 10 autorizadas por nível | 8 / 26 / 29 ms |

Nove logins HTTP 200; zero 429, 500, outros status ou erros de rede. Throttle padrão 60/60000 e login 10/min preservados, com 46 GETs totais no bucket localhost. Onze admissões de lock físico foram observadas por polling finito de `pg_stat_activity`/`pg_locks`, com blocker próprio e request pendente; liberação em 20–64 ms. Em C8, 1/4 contas não relacionadas terminaram antes da liberação do alvo. Deadlines/atividade das linhas ativas ficaram iguais; pares idle/absoluto/revogado não renovaram nem ressuscitaram sessão.

Startup medido: 26,133 s do processo até health HTTP, dentro do orçamento declarado de 120 s exclusivo de C7C8; C6/A8 mantêm 60 s. Goals: 1,849 s, cap combinado 120 s/perfil 60 s. Percentis nearest-rank de amostra pequena são descritivos, **não SLO nem capacidade produtiva aceita**. Sem prova de poda por login concorrente, múltiplas instâncias, timeout global de statements ou expiração por espera natural.

Readback independente: 706 hashes congelados iguais; 2173 registros pré-edição divergiam apenas no runner/register/README autorizados. Cleanup runtime e observação OS delimitada confirmados; detalhes de identidade, checks locais informados e limites no [resultado U4](../validacao/SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md#c7c8--prova-local-delimitada-em-2026-10-11). Evidências: [load](../../.tmp/session-harness-c7c8-480736e2b49749bda95bad8f34ddfdd4/load-proof.json), [runtime](../../.tmp/session-harness-c7c8-480736e2b49749bda95bad8f34ddfdd4/runtime-proof.json), [contrato](../../.tmp/session-harness-c7c8-480736e2b49749bda95bad8f34ddfdd4/contract-proof.json), [manifesto independente](../../.tmp/c7-c8-independent-readback-20261011/final.json).

**Gates abertos:** C6 funcional/A8/exportação oficial continuam PENDENTE/ADIADA no fechamento aceito; visibilidade/lifecycle/BFCache/native, contexto offline simultâneo, capacidade/backup produtivos, timezone legado real, mixed-version/rollback e U5/U6 exigem provas próprias. U3/U4 e etapa 2 não ativadas/encerradas. Este readback altera somente plano/resultado e artefatos ignorados, sem runtime/testes adicionais, produto, dependências, banco atual, serviço externo, Resend, commit ou deploy.

### C6/A8 — prova funcional delimitada em 2026-10-11

**C6 PASS 4/4; A8 PASS 1/1, em uma invocação por perfil, zero retries.** C6 fez dump/restauração sintéticos PG18.3 com igualdade de quatro linhas brutas, instantes em microssegundos e metadata de schema. HTTP real aceitou a sessão ativa sem touch e rejeitou idle/absoluta/revogada com 401 e motivos exatos, sem estender deadlines. A8 usou exportação oficial Expo, RootLayout/Login/API/storage/logout reais: limpeza local durável offline, remoto não confirmado, sem replay automático e nova identidade sequencial coerente após reconexão/reload.

Startup agora é explicitamente 120 s para os três perfis; medido em 21,492 s para C6 e 4,191 s para A8. Isso não explica a causa UNKNOWN da falha anterior. Checks locais duráveis: RED 1 falha/30 PASS, GREEN 31/31, tipos focados e frontend completos sem erros; backend completo mantém apenas TS2352 preexistente. Revisão independente conferiu os dois manifestos de 706 fontes, 41 hashes exportados e backups documentais; nenhum runtime foi reexecutado.

[Prova detalhada e evidências](../validacao/SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md#c6a8--prova-funcional-delimitada-em-2026-10-11) e [readback independente](../../.tmp/c6-a8-independent-readback-20261011/final.json). C7/C8 PASS delimitado permanece histórico válido, não reteste. Revogação remota com access válido em corrida, contexto offline simultâneo, visibilidade genuína/BFCache/native, capacidade/backup produtivos, timezone histórico real e mixed-version/rollback continuam sem prova. U5/U6 não iniciadas; U3/U4/etapa 2 abertas e não ativadas.
