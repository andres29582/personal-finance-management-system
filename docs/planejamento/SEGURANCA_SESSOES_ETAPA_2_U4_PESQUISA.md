# U4: expiração autoritativa de sessões — pesquisa e plano

> **Estado atual em 2026-10-11:** bloqueador JWT corrigido e validado com JwtService
> real configurado: backend **223/223, 22 suites, exit 0**. Integração Edge/Nest/PG:
> **6 PASS / 0 FAIL / 1 SKIP**, exit 0, oito logins HTTP 200; readback independente,
> não reexecução. Visibilidade/resume headless unsupported continua pendente.
> Política 900/43200 segundos, versão 1, preservada; fixtures SQL backdated,
> não espera literal. Frontend 166/166 e SQL 30/30 são histórico delimitado retido.
> BFCache/native/abas compartilhadas diretas, carga, legado populado/timezone,
> mixed-version/rollback e backup/restauração pendentes. **U4 não ativada/encerrada.**
> [Resultado atual e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md#retomada-integrada-em-2026-10-11-pass-qualificado).

> **Histórico da decisão e execução em 2026-10-10:** o usuário aprovou 15 min idle / 12 h
> absoluto, atividade por requests interativos elegíveis do servidor e novo login
> para legado. Refresh/polling/startup ficam sem touch; leitura/digitação sem
> request pode expirar. U4-A/B/C possui candidato local verificado independentemente;
> [resultado U4](../validacao/SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md).
> Migration 0016 executada somente em PostgreSQL privado descartável,
> **não aplicada ao banco da aplicação**. U4-R1 fecha o ramo nullable do CHECK;
> o caso negativo SQL foi executado e passou. Backend 220/220 e types de produção exit 0 reconfirmados;
> frontend 166/166 e types exit 0 mantidos sobre bytes inalterados, sem rerun.
> PostgreSQL real: **30/30 em 3 suites, exit 0**, validado independentemente por
> readback, sem reexecução. Os 16 SQLs completos passaram em três schemas limpos;
> não comprovam legado populado/timezone histórico ou equivalência com produção.
> Cleanup confirmado. Browser/native, carga, mixed-version, rollback de implantação
> e backup/restauração continuam pendentes. **U4 não ativada/encerrada.**
> As propostas abaixo são histórico anterior à aprovação; não fecham U3.

**Registro histórico em 2026-10-09: pesquisa e proposta, NÃO implementação nem política aprovada.**
Recomendação inicial para discussão: **15 minutos sem atividade elegível e 12 horas
de duração absoluta**, iguais para web/native, sem modo “lembrar de mim” nesta
unidade. A combinação anterior continua sem aprovação. O valor é uma escolha
conservadora para dados financeiros, não um padrão universal nem comprovação NIST.
Somente dois documentos foram alterados; nenhum teste, migration, DB, servidor,
instalação, commit, envio Resend ou deploy foi executado nesta pesquisa.

## Leitura rápida

1. Aprovar duração, significado de atividade e tratamento das sessões legadas.
2. Implementar a autoridade no PostgreSQL: usuário → sessão → relógio → check/touch.
3. Integrar login/refresh/guard/credenciais sem estender o limite absoluto.
4. Demonstrar limites e concorrência com PostgreSQL isolado e conexões distintas.
5. Não confundir U4 pronta com U3 encerrada, gestão U5 ou operação U6 comprovada.

Plano pai: [Etapa 2](SEGURANCA_SESSOES_ETAPA_2.md).
Dependências atuais: [pesquisa U3](SEGURANCA_SESSOES_ETAPA_2_U3_PESQUISA.md) e
[resultado U3](../validacao/SEGURANCA_SESSOES_ETAPA_2_U3_RESULTADO.md).

## 1. O que as fontes realmente estabelecem

### Princípios, sem copiar defaults de provedores

OWASP orienta limites de inatividade e duração absoluta impostos pelo servidor,
além de logout e aviso cliente. Atividade contínua pode manter uma sessão roubada;
o absoluto limita esse caso. Renovar identificadores não equivale a reautenticar.
[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-expiration).

OWASP também recomenda credenciais atuais/reautenticação para ações sensíveis e
eventos de risco. Um refresh com segredo já existente não demonstra novamente a
presença do titular. A confirmação de senha atual da etapa 1 deve permanecer.
[OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#require-re-authentication-for-sensitive-features).

**NIST SP 800-63B-4 não exige 15 min/12 h para todo sistema financeiro.**
Valores e força normativa dependem do nível:

| Nível | Limite geral de reautenticação | Inatividade |
|---|---|---|
| AAL1 | Definido obrigatoriamente; SHOULD não superar 30 dias | MAY; não obrigatório |
| AAL2 | Definido obrigatoriamente; SHOULD não superar 24 horas | SHOULD não superar 1 hora |
| AAL3 | SHALL não superar 12 horas | SHOULD não superar 15 minutos |

SHALL é requisito; SHOULD é recomendação normativa, não sinônimo de SHALL.
AAL2/AAL3 exigem autenticadores e controles adicionais; escolher esses tempos não
classifica este app. NIST distingue sessão, access/refresh tokens e presença humana;
reautenticação bem-sucedida pode reiniciar os dois timers, atividade apenas idle.
[NIST B-4, §§2.1.3–2.3.3 e 5](https://pages.nist.gov/800-63-4/sp800-63b.html).

### Exemplos maduros e diferenças relevantes

| Sistema/documentação oficial | Comportamento documentado | Lição para este projeto |
|---|---|---|
| [Auth0: lifecycle](https://auth0.com/docs/manage-users/sessions/session-lifecycle) | Idle/absolute separados, por persistência; SSO, silent authentication e `/authorize` resetam idle Auth0 | Sessão do IdP não é necessariamente atividade humana na aplicação; não copiar o reset silencioso |
| [Keycloak: timeouts](https://www.keycloak.org/docs/latest/server_admin/index.html#_timeouts) | SSO/client idle/max separados; refresh pode resetar idle; offline possui regras próprias | Definir semântica explicitamente; não conceder offline token ou janela de tolerância como efeito colateral |
| [Microsoft Entra: session lifetime](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-session-lifetime) | Frequência de login e persistência são controles distintos; em certos fluxos browser/confidential, enforcement de background é adiado até interação | É decisão da plataforma, não garantia de revogação imediata de cada request nem modelo a transplantar |

Não há evidência de um único “melhor timeout”. Produtos maduros separam controles,
documentam atividade/reauth e aplicam políticas ao contexto. Este app customizado
não precisa substituir NestJS/JWT por esses provedores para adotar os princípios.

## 2. Baseline verificada no worktree

GitNexus `query` para sessão/refresh e `context` de `AuthSessionRepository` e
`refreshSession` localizaram relações controller → service → repository. O índice
é de **2026-09-24, commit 99752c5**; está desatualizado em relação ao WIP. Resultados
foram tratados como navegação, não verdade dos bytes atuais: arquivos abaixo foram
lidos diretamente. Não houve reindexação. Nenhum símbolo foi editado; impact será
obrigatório antes de uma futura alteração de código.

| Caminho existente | Observação atual / consequência U4 |
|---|---|
| `backendnest/src/auth/entities/auth-session.entity.ts` | `expiresAt`, `lastUsedAt`, `createdAt`, `revokedAt`: `timestamp` sem timezone; sem idle/absolute |
| `backendnest/src/auth/repositories/auth-session.repository.ts` | `findActiveById` verifica revogação; `touchIfActive` separado e sem resultado de autorização; rotação CAS atualiza expiração e atividade |
| `backendnest/src/auth/repositories/credential-lock.ts` | Transação, lock usuário com timeout 5 s e `credentialTime`/`clock_timestamp`; reutilizar, sem expor parâmetros de credenciais |
| `backendnest/src/auth/strategies/jwt.strategy.ts` | Assinatura/issuer/type/sid e owner são verificados; leitura, `Date.now()` e touch separados: touch afetando zero linhas não impede sucesso do guard |
| `backendnest/src/auth/auth-sessions.service.ts` | Hash SHA-256 do refresh; passa relógio de processo em touch/revogações |
| `backendnest/src/auth/auth.service.ts` | Refresh lê/valida antes da transação, gera novo refresh, CAS renova `expiresAt`; perdedor revoga sessão; login verifica hash esperado sob lock |
| `backendnest/src/auth/repositories/password-reset-token.repository.ts` | Troca autenticada usa lock usuário, revalida sessão/expiração, altera senha+links+sessões+outbox na mesma transação; incluir idle/absolute nessa revalidação |
| `backendnest/src/auth/auth.controller.ts` | Login/refresh/logout/reset-password existentes; nenhum endpoint de estado/gestão de sessões implementado aqui |
| `backendnest/src/users/users.controller.ts` | `GET/PATCH /users/me` protegidos; distinguir fetch inicial/polling de uso interativo |
| `backendnest/src/auth/config/auth-token.config.ts` | Defaults de código access 15m, refresh 30d, máximo 5; não são valores privados efetivos |
| `backendnest/migrations/0004_add_auth_session.sql` | Índices separados owner/expires/revoked; migration histórica a preservar |
| `backendnest/migrations/0014_invalidate_password_reset_tokens.sql`, `0015_password_changed_outbox.sql` | Núcleo etapa 1 existente no WIP; não alterar/reordenar |
| `backendnest/src/auth/repositories/auth-session.repository.spec.ts`, `strategies/jwt.strategy.spec.ts` | Testes mock atuais; não provam locks reais |
| `backendnest/test/credential-boundaries.e2e-spec.ts`, `test/e2e-database.ts` | Infraestrutura de conexões/barreiras e proteção de destino descartável existente; estender, não conectar ao DB do usuário |
| `frontend/storage/authStorage.ts`, `frontend/src/shared/services/api.ts` | Cápsula v3, incarnation/revision/generation, Web Locks, refresh desconhecido sem replay; interceptor tenta refresh para 401 atual |
| `frontend/src/navigation/RootLayout.tsx` | Lifecycle local instalado e presença de token usada para status; não prova sessão válida no servidor após startup/resume |

Lockfile: Nest core **11.1.17**, TypeORM **0.3.28**, pg **8.20.0**. A versão do
servidor PostgreSQL não foi consultada. As referências PostgreSQL “current” abertas
eram v18; relógio/locks também foram conferidos em v14. Antes de migration futura,
verificar a versão real autorizada; não usar sintaxe exclusiva v18 por suposição.
Para TypeORM, operações da transação devem usar seu `EntityManager`, não repository
global. [Fonte oficial TypeORM 0.3.28](https://github.com/typeorm/typeorm/blob/0.3.28/src/entity-manager/EntityManager.ts).

## 3. Política inicial proposta — precisa de decisão humana

**Recomendar 15 min idle / 12 h absoluto**, sem estender absoluto por refresh,
restart, resume, troca de token ou atividade. O prazo curto reduz exposição de
tela financeira abandonada; 12 h comporta uma jornada, mas limita sessão roubada.
Custos: reentrada mais frequente e expiração durante leitura/edição longa sem
request elegível. Não há dado de uso que demonstre esses números como ótimos.
Uma política mais longa melhora continuidade e amplia a janela de exposição;
uma mais curta reduz essa janela e aumenta atrito. Medir abandonos/reauth sem
coletar comportamento individual invasivo, após autorização de produto.

Manter TTL de access/refresh como controles separados nesta primeira unidade,
sem ampliar seus valores. Mesmo refresh de 30 dias não autoriza sessão além de
12 h: deadline persistida manda. Se posteriormente capar `exp` ao absoluto,
decidir emissão/rounding e preservar compatibilidade; não é requisito para
autoridade online com check no DB em todo request protegido.

Na expiração, exigir login completo e novo `sid`; não ressuscitar a linha antiga.
Reautenticação dentro da sessão, remember-me, autenticação adaptativa e MFA são
extensões fora de U4, não novos timers ou serviços automáticos.

### Atividade: autoridade sem falsa prova de presença

Proposta: atividade elegível é request autorizado de operação interativa de
negócio definida pelo servidor, não simplesmente tráfego autenticado.

| Evento | Check autoritativo | Estende idle? |
|---|---|---|
| Login completo | Cria nova sessão sob lock | Inicializa timers |
| Mutação interativa autorizada | Sim, sem efeito protegido antes da autorização | Sim, no ponto de autorização |
| Consulta interativa aprovada por rota | Sim | Sim, se não usada também por polling/background |
| Refresh automático/manual de token | Sim, inclusive CAS | Não |
| Consulta estado/startup/resume/polling/prefetch | Sim | Não |
| Logout/revogação/troca de credenciais | Sim, regras próprias | Não é mecanismo de prolongamento |
| Mouse/tecla/visibilidade/heartbeat/timestamp cliente | Sinal local de UX | Não é autoridade |
| Request negado, owner incorreto, sessão expirada | Rejeita | Nunca |

Lista de rotas elegíveis deve ser explícita; rota nova desconhecida faz check sem
touch. Um header `active=true` ou horário enviado pelo cliente não basta: usuário
com token roubado pode forjar. Rotas usadas simultaneamente por polling e ação
humana NÃO permitem inferir intenção apenas pelo HTTP; separar semântica ou
manter sem touch. Um atacante ainda pode repetir uma rota elegível — absoluto
continua indispensável. Não prometer detecção incontestável de presença.

Primeira fatia não inclui endpoint universal de heartbeat. Leitura estática e
edição sem enviar request poderão expirar: registrar esse efeito e aprovar antes
de implementação. Se produto exigir extensão durante digitação, isso muda a
política de confiança e exige análise própria, não gambiarra no interceptor.

## 4. Desenho da autoridade PostgreSQL

### Dados aditivos propostos

Adicionar, em nova migration numerada disponível (hoje seria `0016`, confirmar
novamente antes de criar), `authenticated_at`, `absolute_expires_at`,
`last_activity_at` como `timestamptz`, `idle_timeout_seconds` positivo e
`policy_version`. Nomes finais seguem as convenções TypeORM/SQL existentes.
`expires_at` continua representando expiração do refresh, não passa a significar
absoluto. `last_used_at` legado não é fonte confiável de interação humana, pois
refresh e todo guard o atualizam atualmente. Manter histórico sem reinterpretá-lo.

No login, definir timers com relógio DB depois dos locks; não usar default
`CURRENT_TIMESTAMP` como início autoritativo se a transação aguardou lock.
Absoluto inicial imutável; `last_activity_at` só avança em atividade elegível.
Critério: permitir somente se owner/sid válidos, não revogada e
`now < refresh_expires_at`, `now < absolute_expires_at`,
`now < last_activity_at + idle_timeout`. **Igualdade é expiração.**

Configuração versionada validada no startup: inteiro positivo, unidade explícita,
idle ≤ absoluto, valores seguros sem overflow, versão conhecida; inválida impede
startup. Persistir política evita comportamento diferente entre instâncias.
Mudança de configuração não amplia sessões existentes nem revive expiradas;
aplicar versão nova a novos logins. Redução emergencial requer operação autorizada
de cap/revogação; não recalcular criação como “agora”.

### Ordem e ponto de linearização

1. Validar JWT e obter `sub/sid` autenticados; lookup fora da transação é apenas hint.
2. Abrir transação com manager existente; adquirir lock de **usuário primeiro**.
3. Adquirir lock explícito de **sessão**, por sid + owner; reler estado atual.
4. **Só depois do último lock potencialmente bloqueante**, ler `clock_timestamp()`
   uma vez via helper; decidir todos os limites usando esse instante.
5. Se válida, check e eventual touch/rotação na mesma transação; exigir resultado
   efetivo, nunca ignorar zero linhas. Retornar autorização somente após commit.
6. Em lote, locks de sessões em ordem determinística (por ID); não inverter a
   ordem em login, refresh, logout, password reset ou futura gestão U5.

PostgreSQL mantém `now()`/`CURRENT_TIMESTAMP` no início da transação;
`clock_timestamp()` reflete a chamada. [Date/time](https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).
Ordem consistente reduz deadlocks. [Locking](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS).
**Ter clock_timestamp no SQL não prova que foi avaliado após esperar:** não assumir
ordem de avaliação de predicado de um UPDATE único. A rotação atual lê relógio
após usuário, mas antes do lock implícito da sessão no UPDATE. O plano exige lock
explícito e teste bloqueando a sessão, não apenas usuário.

Relógio DB é autoridade comum, não relógio monotônico invulnerável: alterações
administrativas/NTP podem deslocá-lo. Não fazer `last_activity_at` retroceder;
observar saúde/sincronização dos hosts DB/app, pois a verificação `exp` JWT ainda
usa relógio do verificador. Clock inválido falha fechado; expiração/revogação
terminal já registrada nunca é revertida por relógio voltar. Definir tolerância
de skew de JWT, se necessária, sem acrescentá-la aos deadlines de sessão. Não
prometer precisão submilissegundo: SQL, JavaScript Date e JWT em segundos têm
precisões diferentes; escolher arredondamento conservador e provar a fronteira.

Login serializa poda/criação e a senha previamente verificada; conta apenas sessões
válidas pela política nova. Preservar máximo configurado/default 5 e desempate
determinístico. Refresh revalida tudo sob os mesmos locks, compara hash, gira token
sem touch humano nem mudança do absoluto. Expiração normal NÃO deve ser reportada
como replay: substituir booleano ambíguo por resultado interno tipado (válida,
expirada, revogada, inexistente/owner incorreto, hash divergente), sem divulgar
existência de sessão alheia. Hash divergente mantém política anti-reuse existente;
não introduzir graça/retry N antigo e não desfazer a política estrita aprovada U3.

Logout é idempotente e não estende idle; logout remoto com access já expirado pode
ser negado, mas saída local U2 continua imediata. Não bypassar expiração para
autorizar outras operações. Revogação all lineariza com login: novo login depois
da revogação é sessão nova legítima. Reset autenticado precisa da mesma validação
idle/absolute na transação de senha; reset público conserva consumo único e
revogação de todas, sem depender de sessão antiga válida.

### Guard não é transação financeira

Guard autoriza um request num instante; revogação posterior pode ocorrer antes
do commit do handler. Não afirmar “nenhuma operação pode concluir após logout”
só porque guard é atômico. Nest executa guards antes do handler, não envolve
automaticamente sua persistência em transação. [Nest Guards](https://docs.nestjs.com/guards).

Para ações sensíveis (credenciais, futura revoke-all e ações financeiras cujo
produto exija essa garantia), recheck depois dos locks e antes do efeito na
**mesma transação de negócio**, preservando usuário→sessão→demais locks e relógio
após espera relevante. Não manter transação aberta por toda a rede HTTP. Uma ação
já admitida pode terminar após deadline; garantia de check no commit é outra
política e precisa de desenho específico. U4 não autoriza refatorar todos os
handlers financeiros: inventariar os sensíveis e documentar o limite das demais
requisições antes de afirmar cobertura. Touch no guard mede admissão de ação,
não confirmação do efeito ou status final 2xx.

## 5. Migration, legado e rollback sem reativação

`timestamp` legado não informa zona original. `timestamptz` armazena instantes em
UTC e conversões implícitas dependem de `TimeZone`.
[PostgreSQL datetime](https://www.postgresql.org/docs/current/datatype-datetime.html).
Não assumir UTC, America/Sao_Paulo ou timezone da máquina por proximidade geográfica.

**Recomendação conservadora:** reautenticar sessões legadas na ativação U4,
mantendo revogação terminal; não inventar última atividade humana. Se produto
preferir continuidade, exigir evidência da timezone histórica e política de cap
aprovada: absoluto ≤ criação convertida + limite e ≤ expiração antiga; atividade
não pode ser backfilled para “agora”. Campos sem proveniência ficam inválidos,
nunca recebem prazo fresco. Sessões já revogadas/expiradas permanecem assim.

Execução futura: backup/restauração autorizados → schema aditivo → backfill
documentado/validação → código compatível → cutover. Proposta inicial prefere
janela controlada com drenagem dos writers antigos, evitando coexistência onde
binário antigo ignora novos limites. Se mixed-version for requisito, primeira
versão compatível precisa bloquear legado inválido e todos os writers precisam
respeitar os campos; isso exige prova específica, não feature flag otimista.

Rollback só para binário que ainda imponha U4, ou suspensão dos endpoints protegidos
até correção. Não remover colunas, apagar revogação ou restaurar snapshot de sessão
para servir tráfego. Persistir expiração terminal ao observá-la é útil, mas não
protege sessões nunca observadas de um binário antigo: drenagem/bloqueio continua
obrigatório. Reverter policy para prazo maior também não ressuscita sessões.

DDL pode adquirir locks fortes. [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html).
Dimensionar volume/lock timeout antes de escolher backfill em lote ou constraints.
`CREATE INDEX CONCURRENTLY` não roda em transaction block e pode deixar índice
inválido após falha. [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html).
Reusar runner SQL existente apenas depois de validar suas fronteiras; não criar
framework de migrations nem alterar 0004/0014/0015.

## 6. Cliente, UX e falhas

Contrato mínimo U4 pode fornecer estado da sessão atual (`serverNow`, idle/absolute
deadlines e versão), sem touch, para startup/resume. Sua integração é gate conjunto
U3/U4; listagem/revogação de remotas e UI de gestão são U5. Resposta não expõe
tokens/hash, IP ou metadata excessiva. Deadline é informação de UX, não autorização
offline; relógio local pode mudar e timers podem parar no background.

Na inicialização/resume/BFCache, manter conteúdo protegido oculto até servidor
confirmar autoridade; reconcile local U3 sozinho não basta. Aba suspensa pode
descobrir expiração só ao retornar. Distinguir conta/incarnation/revision para não
aplicar deadline, resposta ou erro antigo da conta A em B; não transmitir segredos
via BroadcastChannel. Atividade elegível de uma aba estende a sessão compartilhada,
não sessões de outros dispositivos. Native segue deadline servidor e precisa de
prova real de AppState/SecureStore, não promessa baseada em mocks.

Proposta de contrato de erro: 401 com código terminal estável para idle/absolute,
revogada/inválida; não tentar refresh quando código comprova sessão terminal.
401 de access expirado pode usar rotação coordenada, que ainda valida sessão.
Atual interceptor trata 401 genericamente; a integração futura precisa ler o
envelope padronizado, mantendo fences. 403 de autorização não equivale a logout.
DB/rede/lock timeout indisponíveis: 5xx/erro transitório, bloquear acesso protegido,
não fabricar 401 nem destruir snapshot por indisponibilidade. Resultado de refresh
que pode ter cometido continua “unknown” e exige reautenticação U3, sem retry cego.

Proposta de aviso: 60 s antes do idle, acessível, countdown informativo e sem
refresh automático; sessão absoluta exige login, não botão que apenas renova
token. Drafts financeiros: preferir memória enquanto a tela permanece ativa,
ocultar ao expirar, não persistir dados/credenciais automaticamente em localStorage.
Preservação após login requer mesma conta e aprovação de privacidade; troca de
conta descarta/isolaria draft. Não reenviar mutação financeira após login/timeout
sem decisão explícita. Browser close não é garantia de logout servidor.

## 7. Custo, observabilidade e limpeza

Começar com check online em toda requisição e touch exato apenas elegível. Lock de
usuário serializa tráfego por conta e pode limitar concorrência; medir p95/p99,
espera de lock, pool e updates/WAL sob carga antes de otimizar. Não adicionar Redis,
cache de autorização, fingerprint ou serviço novo nesta unidade.

PK sid atende validação pontual; avaliar índice owner+created/id para poda/lista e
deadline para limpeza somente por EXPLAIN em DB isolado/volume representativo.
Não colocar `now()` em predicado de índice parcial; preferir estado estático
`revoked_at IS NULL` quando útil. Não indexar cada timestamp indiscriminadamente:
touch aumenta custo de atualização de índices. Poda de máximo 5 não limpa histórico.

Throttle de touch tem tradeoff real: guardar apenas a cada intervalo pode expirar
cedo; adicionar tolerância pode prolongar a janela. Nenhuma aproximação sem erro
quantificado/aprovado e prova de limite. Primeira implementação exata não tem
essa otimização. Limpeza em lote remove registros terminais após retention, mas
**não é mecanismo de segurança**: query deve negar expiradas mesmo com job parado.

Eventos sem tokens: criação, expiry idle/absolute, revogação, resultado CAS e falha
de autoridade; correlation ID opaco e versão política, não request body, hash,
JWT, senha ou fingerprint. Não registrar cada touch por usuário. Proposta inicial
de retention para decisão: metadata terminal 30 dias, eventos de segurança 90
dias, acesso restrito e exclusão por finalidade; não é prazo legal verificado nem
job aprovado. Retention/backups e privacidade precisam de aprovação própria U6.

## 8. Implementação futura em unidades verificáveis

| Unidade proposta | Conteúdo inseparável | Prova / limite de rollback |
|---|---|---|
| U4-A — política e dados | Config validada/versionada, entity, nova migration, legado invalidado/cap aprovado, testes | Schema/backfill em DB descartável; rollback mantém schema e não amplia prazo |
| U4-B — autoridade | Check/touch/rotation sob locks; login/poda, logout, senha e guard integrados; testes | Barreiras reais e boundary; remover só com endpoints bloqueados ou versão compatível |
| U4-C — contrato cliente | Códigos terminais/estado no-touch, startup/resume e aviso mínimo com fences U3 | HTTP+browser CORE e cenários atrasados; gestão de remotas continua U5 |

Não separar migration/serviço/testes em commits que deixam intermediário inseguro.
Se limites de revisão exigirem dividir B, manter fatias não ativadas até consumers
serem consistentes. Não criar commits/PRs nesta pesquisa nem SDD implícito.

### RED → GREEN → REFACTOR e matriz de aceite

Em execução autorizada: escrever regressão falhando pela ausência do comportamento,
obter GREEN mínimo e refatorar preservando resultado. Mocks servem para parsing,
contratos e ordem esperada; **não comprovam atomicidade PostgreSQL**.

| Caso | Evidência necessária |
|---|---|
| Idle e absoluto antes/igual/depois | Unit determinístico + DB com instantes SQL; igualdade nega, sem arredondamento permissivo |
| Clock após lock usuário **e sessão** | ≥2 conexões/QueryRunner, blocker conhecido e `pg_blocking_pids`; bloquear cada recurso separadamente, expirar durante espera, liberar e observar negação |
| Transação antiga vs relógio real | Iniciar antes do deadline, segurar lock até depois; implementação com `now()` deve falhar teste; não usar apenas sleep como barreira |
| Touch vs expiração/revogação | Executar ambas as ordens de lock; nenhuma autorização por touch zero linhas; não atualizar last_activity de sessão terminal |
| Refresh vs idle/absoluto | Rotação antes/depois; refresh e polling não mudam last_activity/absoluto; N+1 não estende absoluto e N antigo não recupera sessão |
| Refresh vs logout/password reset | Ambas as ordens, conexão real e leitura posterior; reset preserva senha+links+revogação+outbox atômicos; resposta antiga não devolve autoridade |
| Login vs reset/revoke-all/poda | Hash esperado revalidado; máximo 5 sessões válidas sob concorrência; login linearizado depois cria sessão nova |
| Owner/sid/profile errados | HTTP real com JWT válido de A e sid de B; `GET/PATCH /users/me`, estado e futura gestão não tocam nem revelam B |
| Falha/rollback | Falha injetada antes commit não deixa token/touch/senha parcial; expiry terminal que precisa persistir não é desfeito por lançar exceção dentro da transação; erro lançado depois da decisão commit |
| Migration UTC/legado/política | Timezones distintas, nulls, sessões antigas/revogadas e datas futuras inválidas; nenhuma renovação “agora”, mixed-version/rollback não reativa |
| HTTPguard vs efeito sensível | Barreira depois guard; revogar antes do recheck transacional impede efeito quando garantia contratada; documentar handlers com apenas admissão |
| DB/rede/lock indisponível | Sem acesso protegido, sem falso logout/refresh-reuse; erro sanitizado; cleanup de todas as conexões/processos próprios |
| Cliente/races | Startup/resume sem autoridade, background no-touch, multiaba, 401 terminal atrasado de A após B, warning/cancel, unknown refresh e POST não reaplicado |

Reusar `backendnest/test/e2e-database.ts`: exige nome/role descartáveis, confirmação
explícita e validação de confinamento; recria schema. Nunca executar em DB padrão
ou presumir que ambiente existente é seguro. Conexões/barreiras com timeout
delimitado, IDs observados, liberação em finally e drenagem de tarefas. Verificar
estado por terceira conexão após commit/rollback. Nenhuma dessas provas foi rodada
nesta pesquisa. Comandos futuros devem ser focados por suite; `test:e2e` amplo
recria schema e requer autorização/forecast próprio.

## 9. Gates abertos e próxima decisão

U3 tem **151/151, 15 suites, exit 0**, types global sem diagnósticos e **browser
CORE Expo/Edge 5/5, exit 0 verificado independentemente**; não regredir para
“nenhum Playwright instalado”. Manifesto `.tmp/stage2-u3-expo-browser/final.json`
declara 31 arquivos de produto preservados; relatório independente confirma
escopo. Esta pesquisa preserva seus bytes, não executa novamente as provas.

| Gate acompanhado | Relação com U4 |
|---|---|
| Chamada direta lifecycle/notificações BroadcastChannel | CORE não chamou `observeSessionLifecycle`; completar prova U3, não inferir da presença da API |
| 401 separadamente atrasado | Três páginas atuais exercitam 401 concorrentes; acrescentar atraso controlado com troca de conta/expiração |
| Commit/locks PostgreSQL reais | Obrigatório para aceitar autoridade U4 e fechamento backend U3 |
| Native/AppState/SecureStore | Gate de suporte, não bloqueio de pesquisa nem PASS por Jest |
| Startup autoritativo | Integração explícita U3/U4; presença de JWT não basta |
| Mixed-version, migração, rollback, operação | Gate U6 e pré-ativação segura U4 |
| Gestão próprias/remotas/todas | API/UI completas e reauth U5; U4 só fornece autoridade/contrato mínimo |
| Resend | Continua deliberadamente adiado; não ativar entrega real |

**Decisões pendentes antes de implementar:** aprovação dos tempos propostos;
aceitação de atividade por requests elegíveis (incluindo expiração durante leitura/
digitação sem request); reautenticação de legado vs continuidade comprovada;
escopo de ações sensíveis com recheck transacional; aviso/drafts e rollout controlado.
Retention operacional fica proposta para U6, sem job agora. Aprovar pesquisa não
aprova numericamente a política nem execução de migration/testes/deploy.

## Key Learnings:

1. Limites de token, inatividade e duração absoluta são autoridades diferentes;
   refresh silencioso não comprova presença humana.
2. Relógio correto lido antes do último lock ainda admite decisão temporal antiga;
   PostgreSQL real com barreira na sessão é indispensável.
3. Timezone desconhecida do legado e rollback para writer antigo podem ampliar
   autorização; falhar fechado é mais seguro que inventar continuidade.
