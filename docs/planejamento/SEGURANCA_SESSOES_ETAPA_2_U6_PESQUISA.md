# U6: preparação operacional local — pesquisa e plano

**Fechamento documental — 2026-10-13 (provas locais de 2026-10-12):** recorte local implementado com provas
parciais; [resultado atual e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md).
Coordenador offline disponível, dispatch U6/destino bloqueados, CI/upload não
implementados. U6/etapa 2 abertas. O restante deste documento registra a pesquisa
anterior à implementação; seus estados e comandos “propostos” são históricos,
não o estado atual. [Plano atual das quatro pendências](SEGURANCA_SESSOES_ETAPA_2_U6_PENDENCIAS_PLANO.md): P1 corrigiu o spec TS2352 e verificou Jest focado 1/1 + tipos backend completos/build noEmit exit 0; [ficha P1](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p1-tipos-backend-completos-corrigidos--2026-10-12). P2 concluiu somente aceite local delimitado: puro 16/16, negativo SQL nativo 2/2 e novo positivo C6 4/4 em tentativas separadas PG18.3; [ficha P2/limitações](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md#p2-prova-local-delimitada--2026-10-12). A observação OS ao vivo adicional do negativo continua NOT_TESTED, sem alterar relatório parcial original. P3/P4 OPEN; produção BLOCKED; U6/etapa 2 OPEN. O bloqueio de tipos descrito abaixo é histórico; o coordenador ainda fixa BLOCKED (P3).

**2026-10-12 — pesquisa concluída; implementação U6 não iniciada.** A recomendação
é preparar um pacote local verificável e independente de hosting, reutilizando
configurações, testes, harness e guia operacional existentes. Isso não autoriza
deploy, migrations no banco da aplicação nem fechamento de U6/etapa 2.

O destino de hospedagem permanece indefinido. Não foram executados nesta pesquisa
testes, builds, navegador, instalação, serviços, conexão com banco, migrations,
email, CI remota ou deploy. Nenhuma configuração ou fonte de produto foi alterada.
0016/0017 continuam não aplicadas ao banco da aplicação; Resend permanece adiado.

## Leitura rápida

1. Conferir a [base atual](#1-base-atual-e-limites-das-provas).
2. Implementar, somente após autorização, as [oito unidades locais](#5-sequência-proposta-de-implementação).
3. Revisar evidências do candidato exato, sem converter pendências em PASS.
4. Completar depois os [gates do destino](#7-handover-para-o-destino-ainda-indefinido).

**Como ler:** “atual” é observação de fonte/prova existente; “proposto” é plano
não aprovado nem implementado; “obrigatório para fechar” é critério preservado do
[plano geral](SEGURANCA_SESSOES_ETAPA_2.md). Fontes primárias consultadas em
2026-10-12. A pesquisa não declara conformidade integral com padrão de segurança.

## 1. Base atual e limites das provas

Referências de fonte correspondem ao worktree atual, incluindo WIP e arquivos
intended-untracked, não somente HEAD ou índice GitNexus. Antes da escrita foram
preservados os bytes dos documentos existentes e hashes de 745 arquivos de
fontes/testes/configurações/documentos. Este snapshot documental não é um freeze
funcional completo de U6 nem substitui o futuro inventário de release.

| Base existente | Reutilização / limite para U6 |
|---|---|
| [Resultado U5](../validacao/SEGURANCA_SESSOES_ETAPA_2_U5_RESULTADO.md) | 99 testes backend e 97 frontend focados históricos; HTTP/Nest/PG 11/11; dois casos browser PASS em execuções separadas, não uma execução 2/2; U5D 10/10 e quatro checks puros. São provas delimitadas, não retestes desta pesquisa. |
| Freeze U5R | Mapping/readback atual confirmou 783/783 hashes; não executou casos funcionais. Mudanças posteriores exigem identidade/evidência próprias. Não somar resultados históricos como uma nova suíte. |
| [Runner mantido](../../backendnest/test/session-harness/runner.cjs), linhas 13–16, e [README](../../backendnest/test/session-harness/README.md) | Seletores atuais C6, A8, C7C8, U5, U5B, U5R e U5D; um caso explícito por invocação, limites finitos, zero retry automático. Reutilizar helpers, fixtures e export oficial; não criar outra harness genérica ou clonar scripts de `.tmp`. |
| [Gate SQL](../operacao/U5_PREDEPLOY_CHECK.sql) e [guia operacional](../operacao/SESSOES_U5_DEPLOYMENT.md) | Transação somente leitura, `public`, statement 10 s/lock 2 s, catálogo exato 0016/0017. `/health` em [app.service.ts](../../backendnest/src/app.service.ts):9–15 é estático; startup sem synchronize não rejeita necessariamente tabelas ausentes. Nenhum dos dois prova readiness de schema. |
| [Database config](../../backendnest/src/config/database.config.ts):24–65,130–163; [HTTP config](../../backendnest/src/config/http-runtime.config.ts):28–46,80–127 | Validadores de DB/TLS/senha e HTTPS/CORS existentes. Testar funções atuais com fixtures sintéticas; não inventar uma validação de proxy que não existe. |
| [JWT config](../../backendnest/src/auth/config/auth-token.config.ts):153–155; [reset config](../../backendnest/src/auth/config/password-reset.config.ts):16–40 | JWT estrito cobre `production`/`demo`, não `staging`. Staging exposto deve usar `NODE_ENV=production` segundo o guia atual ou receber correção própria aprovada. Entrega reset/token-return é configuração separada; não ligar email para preparar U6. |
| [Guarda E2E](../../backendnest/test/e2e-database.ts):60–85,125–140 e [example](../../backendnest/.env.example):58–65 | Helper exige nome `finance_e2e_`, marker, owner restrito de um único DB, ausência de memberships e confirmação exata de reset. Example ainda tem defaults antigos não confinados; não é perfil E2E completo seguro. Helper falha fechado; alinhar template futuramente, sem copiar defaults fracos ou ler `.env` privado. |
| [CI atual](../../.github/workflows/ci.yml) | Node 22, lockfiles/npm ci, checks/build backend/export Expo, E2E PG16. Remota NOT RUN; não há deploy, upload de evidência ou retenção configurada. PG18 local não comprova PG16 remoto. |
| [Dockerfile existente](../../backendnest/Dockerfile):5–10,17–20 | Build com lockfile; runtime copia `dist`, não SQL de migrations. Vincular migrations/gate à identidade da release separadamente. Não exigir Docker instalado nem criar Kubernetes/Terraform. |
| [main.ts](../../backendnest/src/main.ts):14–37; [bootstrap privado](../../backendnest/test/u4-browser-bootstrap.ts) | Produção não chama `enableShutdownHooks`; harness encerra por IPC/`app.close()`. Cleanup local não prova SIGTERM, drenagem de tráfego ou hooks do host futuro. |
| [Logs](../../backendnest/src/logs/logs.service.ts):64–68,169–174,192–199,241–287; [request context](../../backendnest/src/logs/request-context.middleware.ts):25–32 | Chaves sensíveis/rota SID têm proteção existente, mas logger de exceção também recebe stack. Redação universal não provada. Primeiro XFF de auditoria não é endereço confiável; Express permanece sem trust proxy explícito. |

**Bloqueio de tipos conhecido:** o backend completo mantém TS2352 preexistente em
`backendnest/src/orcamentos/repositories/orcamento.repository.spec.ts:35`.
Tipos de produção backend e frontend tinham exit 0 no resultado anterior; nenhum
foi reexecutado aqui. Não declarar “tipos globais PASS”, excluir silenciosamente o
teste nem aprovar waiver. Se o gate completo for exigido para U6 local, permanece
BLOCKED até correção de causa raiz separadamente autorizada e verificada.

## 2. Resultado local não equivale a produção

Contrato de status **proposto**, para impedir um único “pronto” ambíguo:

| Dimensão | Estados e condição |
|---|---|
| Implementação local | `NAO_INICIADA` agora; futuramente `IMPLEMENTACAO_LOCAL_PRONTA` somente com unidades implementadas, inventário e revisão. Não significa testes PASS. |
| Verificação local | `VERIFICACAO_LOCAL_PENDENTE` agora; futuramente PASS somente para cada caso executado no candidato identificado. Guardar `NOT_TESTED`, `PENDING`, `FAILED`, `PASS` ou `BLOCKED` por requisito. |
| Destino | `PRODUCAO_PENDENTE` por destino indefinido e `PRODUCAO_BLOQUEADA` para admissão de tráfego até autorização/provas. Sem endpoint nem segredo real na pesquisa. |
| Fechamento geral | `U6/ETAPA2_ABERTA`. U3/U4/U5 também continuam abertas. Plataformas obrigatórias sem prova impedem fechamento completo. |

Uma dispensa de execução neste momento não transforma plataforma obrigatória em
N/A nem fecha etapa. BFCache, visibilidade/lifecycle genuínos, native físico,
contextos offline simultâneos, stale-global A/B, duas instâncias e capacidade/SLO
continuam exigindo evidência própria. Keyboard/layout browser delimitados não
provam acessibilidade completa, leitor de tela ou native.

## 3. Menor pacote local recomendado

Estender o runner/contratos e guia atuais, não substituir a arquitetura auth ou
criar subsistema de operação. Um único coordenador futuro deve selecionar uma
lista finita de checks e produzir status por requisito. Nome ilustrativo
**`npm run u6:check` é proposto e não existe hoje**; não executar nem publicar como
comando disponível. Não criar scripts/arquivos futuros nesta pesquisa.

| Modo proposto | Pode provar | Efeitos e restrições |
|---|---|---|
| `OFFLINE_CHECKS` | Inventário, configuração com fixtures, tipos/unitários focados, links e checks estáticos. Builds/export são checks adicionais explícitos. | Sem DB/HTTP/browser/email. Dependências já instaladas e binários locais; não usar fetch implícito. Declarar comandos/tempo/saídas antes de executar; normalizadores que alteram fonte devem terminar antes do freeze. Build/export geram arquivos e têm custo próprio. |
| `DISPOSABLE_RUNTIME` | Casos selecionados da harness atual, SQL/schema/restore sintéticos, HTTP real e browser oficial quando aprovado. | Requer aprovação da tentativa e preflight: cluster novo loopback, nonce/marker, owner e DB confinados, confirmação exata, portas/processos próprios. Não lê dotenv privado, instala serviço, acessa DB da aplicação ou executa todos os casos invisivelmente. |
| `TARGET_VALIDATION` | Configuração/URL real, TLS/CORS/proxy, secrets provisionados, versão publicada/rollback, lifecycle e capacidade do destino. | Bloqueado sem destino, responsáveis, autorização e limites. Credenciais são fornecidas por canal privado, nunca solicitadas em chat ou registradas no manifesto. Não há execução automática após checks locais. |

### Comandos existentes, apenas referência para futura execução autorizada

Na raiz, com dependências já presentes; **não executados nesta pesquisa**:

```powershell
# Dois checks puros mantidos, sem abrir browser ou banco.
node backendnest/test/session-harness/u5-poll.spec.cjs
node backendnest/test/session-harness/u5-deployment.spec.cjs
# Exemplos de uma tentativa runtime independente, não sequência automática.
node backendnest/test/session-harness/runner.cjs U5R
node backendnest/test/session-harness/runner.cjs U5D
# Somente gate manual futuro; conexão autorizada fora do comando/log.
psql -X -v ON_ERROR_STOP=1 -f docs/operacao/U5_PREDEPLOY_CHECK.sql
```

Scripts existentes, com cwd próprio: backend `npm test -- --runInBand` e
`npm run build`; frontend `npm run typecheck`, `npm test -- --runInBand` e
`npm run export:web` ([backend package](../../backendnest/package.json),
[frontend package](../../frontend/package.json)). Essa lista não é ordem para
rodar a suíte inteira. Selecionar escopo/fixtures e registrar custo antes do run.
`npm ci` só se necessário e autorizado, pois instala/executa lifecycle scripts e
pode usar rede; não integra automaticamente o modo offline.

**Orçamento recomendado:** uma tentativa explícita por candidato/caso, sem
retry até decisão nova. Herdar caps existentes, não aumentá-los silenciosamente:
startup 120 s, export 180 s, browser goals 120 s; U5D preparo 60 s/goals 180 s,
dump/restore 45 s cada/cleanup PG 30 s. Checks adicionais devem declarar cap antes
do lançamento. Timeout, ambiente indisponível ou cleanup inconclusivo não é PASS.

## 4. Evidência segura e portável

Links históricos em `.tmp` estão ignorados por [gitignore](../../.gitignore):47.
Preservá-los, mas não depender deles como única entrega auditável. Proposta: um
manifesto sanitizado mais provas selecionadas por allowlist; nenhum upload atual.

| Campo proposto | Conteúdo permitido |
|---|---|
| Identidade | Run ID opaco, timestamp UTC, referência Git auxiliar e hashes SHA-256 dos bytes atuais; caminhos relativos ordenados, incluindo WIP/intended-untracked relevantes. HEAD sozinho é insuficiente. |
| Ferramentas | Versões Node/npm/PostgreSQL cliente/servidor/browser/Expo e hashes de lockfiles. Não prometer build bit a bit idêntico só por usar lockfile. |
| Execução | Modo/caso, comando e argumentos sanitizados, cwd relativo, limites/tempo real, exit, status por requisito, não executados e motivo. Sem argv bruto/connection string ou caminho absoluto. |
| Prova | Resultados mínimos, contagens/invariantes, hash de arquivos permitidos, schema/versão e cleanup próprio. Não exportar conteúdo das fontes; hashes as identificam. |
| Decisão | Escopo aprovado, pendências e responsável pela próxima autorização, sem recibo de review inventado ou aprovação retroativa. |

Bloquear exportação de senha, token/JWT/reset, SID bruto, DSN, `.env`, headers,
body/capsule browser, PII, stack/erro bruto, screenshot não revisado, dump binário
e backup. Dados sintéticos não autorizam publicar material autenticador. Dumps
ficam privados/quarentenados; manifesto público registra somente resultado/hash
permitido. Hash não sanitiza o conteúdo de um arquivo que também será enviado.

Testes negativos futuros devem usar segredos **fictícios**, DSN/senha/token em
campos inesperados, exceções/stack e injeção de newline; verificar o resultado
persistido antes de exportar. Recomendações de exclusão/redação vêm de
[OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
Custódia, privilégio mínimo e rotação devem ter responsável; limpar referências
em JavaScript/GC é melhor esforço, não garantia de apagamento físico, conforme
[OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).

CI futura deve conservar permissão mínima, avaliar pin de actions por SHA completo
e publicar só allowlist inspecionada. Masking não garante ausência de vazamento:
[GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use).
Retenção de **7 dias é apenas exemplo proposto**, não política aprovada; decidir
acesso/retenção conforme limites do repositório. Download com digest divergente
gera warning, não o gate desejado: implementar verificação explícita e falhar
fechado se faltar artefato/hash ou houver mismatch, segundo
[GitHub artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data).
Não exigir serviço pago/attestation nem criar secrets/jobs nesta pesquisa.

## 5. Sequência proposta de implementação

Cada unidade mantém fontes/fixtures existentes e um escopo revisável. O plano
não cria estado SDD, tentativa de runtime ou orçamento de review.

| Ordem | Entrega futura | Aceite local necessário |
|---|---|---|
| 1 | Inventário e contrato de aceitação/status | Separar local/destino/fechamento; listar gates e responsáveis; preservar histórico FAILED/PENDING. Snapshot dos bytes atuais, não restaurar WIP de HEAD. |
| 2 | Alinhar templates e regressões de config | Perfis desenvolvimento, E2E descartável e exposto distintos; sem credencial real/default fraco. Fixtures positivas/negativas nos validadores existentes. Clarificar health separado do gate; não trocar política JWT global ou criar readiness silenciosamente. |
| 3 | Um coordenador finito sobre ferramentas atuais | Modos explícitos, caps antes do run, seleção de casos, stop/cleanup próprios e status individual. Nenhum auto-install/reset/migration/service/deploy; reutilizar runner, polling async correto e comparação SQL tipada. |
| 4 | Manifesto sanitizado e entrega CI proposta | Allowlist/testes negativos, identidade de fonte e locks, verificação fail-closed de hashes; acesso/retenção aprovados antes de upload. PG16 remoto e PG18 local registrados como execuções diferentes. |
| 5 | Regressões focadas no candidato aprovado | Matriz abaixo e casos runtime/browser explicitamente autorizados. Não rerodar todo histórico por hábito; mudança causal exige prova nova própria, com relógio/fixture conhecidos. |
| 6 | Gate schema, recuperação e stop conditions | Reutilizar U5D/read-only SQL e dados sintéticos. C6 ainda precisa correção de fail-fast/negativo antes de nova prova verde; checar autoridade, microssegundos/quota/schema. Operador aprova backup/janela/locks antes de qualquer alvo real. |
| 7 | Cleanup local e telemetria negativa | `app.close()`/recursos próprios e ausência de vazamento provados localmente; lifecycle do host continua pendente. Não ativar hooks em main/worker/email nesta unidade sem escopo próprio. |
| 8 | Revisão independente e handover | Readback da identidade/evidência exata, status por gate e decisão explícita de prontidão local. Sem PASS global com TS2352 não resolvido nem declaração de fechamento U6/etapa 2. |

Antes de qualquer futura edição de função/classe/método, usar GitNexus `impact`
upstream e verificar os callers atuais: índice pode estar stale e não prova o WIP.
Reportar blast radius e HIGH/CRITICAL antes de editar. Nenhum símbolo foi editado
nesta pesquisa; não há análise de impacto artificial de uma mudança documental.

## 6. Matriz mínima de regressão e recuperação

### Segurança que não pode regredir

| Recorte | Prova exigida no futuro candidato |
|---|---|
| Etapa 1 / U1 | Credenciais/reset, locks e sessão persistida; JWT assinado revogado não autoriza. Preservar transações centrais já implementadas; entrega Resend adiada não se torna concluída nem requisito de instalar novo provider. |
| U2 / U3 | Logout local-first sem senha, sem replay automático, ownership/generation contra resposta antiga; startup/reconfirmação real sem conceder autoridade offline. A sequencial após reconnect não comprova dois contextos offline simultâneos. |
| U4 | Policy padrão 900/43200/v1, igualdade no deadline nega, relógio DB após locks; GET/auth/refresh não inventam touch. Fixtures backdated não são espera natural de 15 min/12 h nem proveniência histórica real. |
| U5 | Owner-only, remota/global/current separados, senha/hash/chamador revalidados sob lock, resultados desconhecidos sem falso sucesso/replay; quotas compartilhadas 5/60 s e rota/IP 20/min, sem trocar limite DB por IP. Max-sessions padrão 5 não é teto configurável aprovado. |
| Datas / browser | Cursores/calendário UTC/microssegundos, no-store, limpeza de senha, navegação e keyboard/layout delimitados; comparar efeitos HTTP/SQL reais, não nomes de evento como prova de lifecycle. |
| Config negativa | Segredo JWT fraco/igual, DB senha/TLS, CORS hostname/query/origem indevida e reset token-return: derivar aceitação dos validadores atuais. Política de proxy futuro recebe testes próprios após topologia; não alegar rejeição atual inexistente. |
| Concorrência / carga | Preservar efeitos após espera de lock, credencial/sessão expirada e deadline não renovado. C7/C8 locais são observações descritivas; múltiplas instâncias, SLO e capacidade continuam pendentes. |

### Banco e rollback: ensaio local, não autorização operacional

U5D já usa `--exit-on-error` em
[u5-deployment.cjs](../../backendnest/test/session-harness/u5-deployment.cjs):393–398.
[C6](../../backendnest/test/session-harness/c6.cjs):253–258 ainda não usa essa flag.
**Correção futura necessária em C6:** incluir comportamento fail-fast e testar
erro SQL deliberado antes de emitir nova evidência verde. Não altera os resultados
históricos nem implica executá-lo agora. `pg_restore` continua após erros por
default; transação única é opção somente compatível/sem paralelismo, conforme
[PostgreSQL pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

O ensaio deve conferir antes/depois: 17 migrations, 21 tabelas/36 FKs esperadas
no fixture atual, metadados exatos e autoridade bruta, microssegundos, janela e
contador de reautenticação. Confirmar ativa sem touch e rejeição de
idle/absoluta/revogada sem ressurreição. Após quota 5, sexta nega enquanto a janela
real de 60 s vigora; se expirou, abre nova janela/contador 1. Não manipular relógio
ou deadlines para obter o resultado desejado. Contagens são do fixture, não
inventário validado de produção.

`pg_dump` produz export consistente de um DB, não inclui globals como roles e
tablespaces; em geral não é estratégia completa de backup produtivo periódico.
Conferir versão cliente/servidor e compatibilidade do destino; não prometer
restore de versão nova em antiga. Definir RPO/RTO/custódia/recuperação reais depois,
conforme [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html).

Antes de migration real: identidade/permissões, backup recuperável aprovado,
janela e drenagem de writers incompatíveis, proveniência UTC ou reautenticação de
legado, limites de lock/statement e stop conditions. Muitas alterações tomam
`ACCESS EXCLUSIVE`; ensaiar a alteração exata, não generalizar o custo do gate
read-only, conforme [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html).
Interromper em lock/timeout, schema/versão divergente, backup incompleto, writer
incompatível, autoridade/quota alterada ou cleanup inconclusivo. Nunca executar
`--clean` no banco da aplicação como atalho. Rollback preserva colunas/enforcement,
revogação/deadlines/quota; não retorna a writer que ignore U4. Restore sintético
não comprova rollback com release antiga publicada, ainda não identificada.

## 7. Handover para o destino ainda indefinido

São decisões/provas futuras, não perguntas bloqueantes desta pesquisa:

- Destino/URL/origens e plataformas obrigatórias; versão publicada compatível de
  rollback, responsáveis e autorização de DB/backup/migration/tráfego.
- TLS/DNS, topologia/hops/CIDRs e sobrescrita de headers pelo proxy; manter
  trust proxy não configurado até conhecer a fronteira. `true` genérico e hop
  count sem considerar rotas diferentes não são solução segura, conforme
  [Express proxies](https://expressjs.com/en/guide/behind-proxies/).
- Custódia/privilégios/rotação de segredos, acesso/retenção de evidência, RPO/RTO,
  proveniência de dados e SLO/capacidade com duas instâncias.
- Shutdown/drenagem/restart no host real: Nest opt-in hooks e sinais dependem da
  plataforma; Windows não suporta SIGTERM nesse contrato. `app.close()` privado
  não resolve a lacuna, conforme [Nest lifecycle](https://docs.nestjs.com/fundamentals/lifecycle-events).
- Release vinculando build/lockfiles/migrations/gate/config sem segredos. Reusar
  Docker existente se escolhido; multistage/npm ci favorecem previsibilidade, não
  exigem instalar plataforma nem garantem reproducibilidade binária, conforme
  [Docker Node guide](https://docs.docker.com/guides/nodejs/).

Referencial de checklist: [OWASP ASVS](https://owasp.org/projects/asvs) identifica
5.0.0 como estável; citar IDs versionados somente após ler o controle exato.
[NIST SSDF](https://csrc.nist.gov/projects/ssdf/publications) lista 1.1 final e 1.2
draft. Alinhamento de controles selecionados é recomendação, não certificação,
nível completo ASVS ou adoção de draft como padrão final.

## 8. Checklist de aceite desta pesquisa

- [x] Base atual e fontes primárias mapeadas; limitações históricas preservadas.
- [x] Plano local sem provider escolhido, código novo ou comando U6 fictício ativo.
- [x] Modos, identidade de evidência, segurança de exportação e handover separados.
- [x] Guia operacional existente reutilizado; nenhuma duplicação de runbook.
- [ ] Implementação autorizada e executada — **não realizada nesta pesquisa**.
- [ ] Verificação local do candidato novo — **não executada**.
- [ ] CI PG16/destino/plataformas/backup e rollback publicados — **pendentes**.
- [ ] Fechamento U6/etapa 2 — **aberto, sem ativação**.

**Próximo passo recomendado:** aprovar um primeiro recorte local das unidades 1–2,
com snapshot/impacto e regressões de configuração; não autorizar implicitamente
os modos runtime ou destino. Nenhuma escolha de hosting/plano, provider de email,
assinatura ou segredo é necessária para preparar esse recorte.
