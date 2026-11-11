# U5: gestão segura de sessões próprias — pesquisa e plano

**Atualização 2026-10-11 — primeiro recorte recomendado aprovado e implementado localmente.**
Lista própria, revogação escolhida/todas incluindo atual, confirmação por senha,
datas sem nova identificação de dispositivo e cleanup global local-only foram
implementados. Orçamento compartilhado: **5 tentativas reservadas/60 s por conta**;
camada adicional IP/rota: **20/min**. A migration `0017` cria somente o contador
de segurança e índice de paginação, não metadados de dispositivo; foi aplicada
apenas ao PostgreSQL privado de teste. [Resultado, provas e limites](../validacao/SEGURANCA_SESSOES_ETAPA_2_U5_RESULTADO.md).

O corpo abaixo preserva a pesquisa anterior ao aceite, inclusive linguagem de
proposta e comandos não executados naquela fase; não é o status atual de entrega.
U3/U4/U5 e etapa 2 continuam abertas, sem ativação, migration no banco da
aplicação ou aceite de produção. A sessão atual mantém o logout U2 sem senha.

Nenhum runtime, teste, banco, migration, dependência, email, commit ou deploy foi
executado nesta pesquisa. U3/U4 permanecem abertas; U4 não está ativada e a
migration `0016_add_session_policy.sql` não foi aplicada ao banco da aplicação.
Resend/entrega real continuam adiados. O estado anterior está no
[resultado U4](../validacao/SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md), inclusive
C6 4/4 e A8 1/1 locais: essas provas **não comprovam U5 nem produção**.

## Leitura rápida

1. Conferir a [base atual](#1-base-verificada-no-worktree), sem substituir seu WIP.
2. Aprovar as [decisões pendentes](#7-decisões-de-produto-ainda-não-aprovadas).
3. Autorizar depois uma implementação delimitada, com regressões primeiro e
   provas próprias. Planejar U5 agora não elimina dependências/gates U3/U4.

**Como ler:** “atual” é observação estática da fonte; “requisito” é proteção
derivada de segurança; “recomendação” é inferência de engenharia; “decisão
pendente” exige aceite de produto. Fontes primárias consultadas em **2026-10-11**.
O [plano geral](SEGURANCA_SESSOES_ETAPA_2.md) preserva propostas históricas;
as sugestões de rotas U5 abaixo são a recomendação mais recente, não Swagger vivo.

## 1. Base verificada no worktree

Referências são linhas do worktree em 2026-10-11, não do índice GitNexus nem de
produção. Nenhum valor privado de ambiente foi lido.

| Evidência atual | Consequência para U5 |
|---|---|
| `backendnest/src/auth/auth.controller.ts:26–89`; `backendnest/src/common/authenticated-request.ts:3–9` | Existem estado atual, logout e credenciais; não há rotas U5. Owner e SID vêm de `req.user`, nunca do body. Login recebe somente email/senha, sem dispositivo. Logout atual retorna HTTP 200 com mensagem. |
| `backendnest/src/auth/strategies/jwt.strategy.ts:48–63`; `backendnest/src/auth/repositories/auth-session.repository.ts:156–189` | Todo request protegido consulta a sessão persistida. A transação do guard termina antes do handler: U5 precisa revalidar o chamador dentro da própria transação, inclusive antes de divulgar a lista. |
| `backendnest/src/auth/repositories/credential-lock.ts:19–38`; `backendnest/src/auth/repositories/auth-session.repository.ts:31–44,80–88,293–306` | Ordem existente: usuário, sessões em ordem de ID, relógio DB após locks. `lock_timeout` local de 5 s. Login e revogação global compartilham o lock do usuário. |
| `backendnest/src/auth/session-policy.ts:43–83`; `backendnest/src/auth/repositories/auth-session.repository.ts:150–154` | `revokedAt === null`/`findActiveById` não autorizam. Validade também exige owner, versão, datas, idle, absoluto e refresh; igualdade no deadline nega. |
| `backendnest/src/auth/auth.service.ts:252–274`; `backendnest/src/auth/repositories/password-reset-token.repository.ts:100–131` | Senha é comparada fora do lock; hash esperado e sessão são revalidados sob lock. Reutilizar o padrão, NÃO chamar a troca de senha para revogar sessões. |
| `backendnest/src/auth/config/auth-token.config.ts:56–69`; `backendnest/src/auth/entities/auth-session.entity.ts:5–57` | Limite padrão 5, mas configuração aceita qualquer inteiro positivo seguro, sem teto de produto. Não há IP, User-Agent ou descrição de dispositivo na entidade. |
| `backendnest/src/auth/session-activity.ts:3–29`; `backendnest/src/auth/repositories/auth-session.repository.ts:253–266` | GET e rotas auth/desconhecidas não renovam atividade. Refresh troca hash/deadline/`updatedAt`, não `lastActivityAt`. Atividade é admissão HTTP elegível, não leitura física nem efeito final confirmado. |
| `backendnest/src/logs/request-context.middleware.ts:25–38`; `backendnest/src/main.ts:14–35` | Log usa primeiro `X-Forwarded-For`; bootstrap lido não estabelece fronteira confiável de proxy. Não reutilizar esse dado como IP confiável de dispositivo. |
| `frontend/src/modules/usuario/screens/UsuarioScreen.tsx:14–22,56–65,93–122,270–279` | Perfil já tem segurança, componentes compartilhados e isolamento por snapshot/generation. Integrar aqui, sem novo shell ou redesenho. |
| `frontend/src/shared/services/api.ts:45–61,138–165,249–274`; `frontend/src/navigation/RootLayout.tsx:69–93,206–225` | Envelope é desembrulhado; requests/respostas são cercados por geração. Startup confirma servidor antes de dados privados; offline não autoriza. 401 terminal difere de erro transitório. |
| `frontend/src/modules/auth/services/logoutCoordinator.ts:5–54` | Logout U2 é local-first, remoto isolado por 5 s, sem replay; distingue limpeza durável, cleanup e confirmação remota. Não aceita 204 como confirmação do logout atual. |
| `backendnest/src/logs/logs.service.ts:220–282`; `backendnest/src/main.ts:25–31` | Há sanitização recursiva de chaves sensíveis e rejeição de propriedades extras. Isso não prova que toda telemetria/intermediário futuro esteja protegido: testar negativamente o novo fluxo. |

## 2. Princípios extraídos das fontes

| Fonte primária | Requisito e limite da aplicação |
|---|---|
| [OWASP — Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Recomenda visibilidade de sessões ativas e término remoto. IP/UA ajudam contexto, não comprovam dispositivo físico. Histórico e alertas são recomendações amplas, não obrigação de implementá-los todos em U5. |
| [OWASP — Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) | Reautenticar ações sensíveis e controlar tentativas. Senha por ação remota/global é recomendação desta pesquisa; janela fixa de dez minutos não é regra universal. |
| [OWASP — Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) e [API1:2023 — BOLA](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) | Negar por padrão; autorização do objeto a cada operação. UUID imprevisível não substitui filtro por owner; SID de apresentação nunca concede acesso. |
| [OWASP — Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Excluir senhas, tokens e identificadores brutos de sessão dos logs; sanitizar entradas e registrar só eventos mínimos. Correlacionar por referência não reversível quando necessário. |
| [OWASP — CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Proteção depende do transporte real. Aqui JWT vem de Bearer explícito; preservar origens CORS e não aceitar sessão em query/body. Não afirmar imunidade a client-side CSRF/XSS; reavaliar CSRF se cookies autenticadores forem introduzidos. |
| [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) | 12 h/15 min aparecem no AAL3; senha isolada não estabelece esse nível. Os 900/43200 segundos aprovados em U4 são política do produto, não conformidade NIST nem novos parâmetros a aprovar em U5. |
| [PostgreSQL 18 — Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html) e [Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | Locks em ordem consistente e leitura do estado atualizado após espera evitam decisões sobre estado antigo. READ COMMITTED tem snapshots por statement: inferência local é revalidar autorização/efeito na mesma transação, não confiar no guard anterior. |
| [Supabase — Sessions](https://supabase.com/docs/guides/auth/sessions) e [Sign out](https://supabase.com/docs/guides/auth/signout) | Escopos local/global/others precisam ser explícitos. Sua revogação não invalida imediatamente JWT já emitido até expiração; NÃO copiar esse atraso: este projeto verifica autoridade DB em cada request protegido. Não migrar o provedor. |

## 3. Menor arquitetura completa recomendada

### Autoridade e concorrência

Manter Controller → AuthService/AuthSessionsService → AuthSessionRepository;
DTOs mínimos e helpers existentes. Sem subsistema genérico de provas de
reautenticação, Redis, fingerprint, nova biblioteca auth ou IdP.

**Listar:** capturar owner/SID autenticados; abrir transação; bloquear usuário e
sessão chamadora; obter relógio DB depois dos locks; aplicar `sessionFailure`;
consultar página parametrizada somente do owner, filtrando mesma política ativa;
montar DTO mínimo antes de liberar transação. Não carregar todas as sessões para
paginar em memória. Não renovar atividade/deadlines nem reescrever metadados.
Se chamador expirar, persistir sua falha terminal, COMMIT e só então lançar erro,
como `authorize`. “Consulta sem touch” não significa ausência absoluta de writes
físicos: `FOR UPDATE` pode escrever marcadores de lock, conforme
[PostgreSQL](https://www.postgresql.org/docs/18/explicit-locking.html).

**Revogar remota/todas:** verificar senha atual contra hash armazenado fora do
lock; conservar hash esperado só em memória. Abrir UMA transação; bloquear
usuário e sessões necessárias em ordem determinística de SID (incluindo
chamador); ler relógio DB após o último lock; revalidar usuário/hash e chamador
ativo; então revogar apenas alvos do owner. Se falha terminal do chamador,
persistir antes de retornar erro fora da transação. Não revogar alvo após
chamador invalidado, nem deixar comparação bcrypt antiga autorizar senha já
trocada. Falha de lock/DB continua 5xx sanitizada, não 401 fictício.

Chamador e alvo podem coincidir; bloquear cada linha uma vez. Não usar o helper
atual `revokeAllByUser` sozinho como nova autorização sensível: ele não recebe
SID chamador/hash esperado. Qualquer adaptação futura deve preservar seus usos
atuais nas credenciais e adicionar o check dentro do mesmo manager.

**Corridas:** se refresh vier antes, revogação encerra a sessão rotacionada; se
vier depois, refresh nega. Global serializa com login pelo usuário: encerra as
sessões existentes no ponto de serialização, mas login ordenado depois pode
criar nova sessão, inclusive login cuja senha foi comparada antes. Impedir esse
login exigiria política adicional de geração/epoch, fora do primeiro recorte.
Também não desfaz handlers financeiros já admitidos nem operações já commitadas.

### Metadados e privacidade

Recomendação inicial: datas autoritativas e “Sessão atual”; outras sessões sem
descrição aparecem como “Dispositivo não identificado”. Não deduzir dispositivo
por nome de conta, timestamp ou token. Não armazenar/exibir IP, geolocalização,
UA bruto ou fingerprint novos neste recorte.

Se produto exigir identificação aproximada desde a primeira entrega, adicionar
somente `clientDescription: string | null`, normalizada por allowlist de
famílias/plataformas, limite recomendado 80 caracteres e sem controles/markup.
UA/declaração nativa continuam hints adulteráveis, nunca fator de autorização.
Capturar na criação da sessão, não inferir legado nem substituir identidade em
refresh. Migration aditiva futura seria `0017` **somente se ainda for o próximo
número**; nenhum SQL é criado agora. Nullable permite escritores sem captura.
Retenção/eliminação precisam de política própria antes de ampliar coleta.

## 4. Contratos HTTP propostos — não disponíveis

Preferir ações POST com JSON para transportar `senhaAtual`, mantendo o nome
existente do DTO de credenciais. Evita depender de body DELETE; é uma escolha
de engenharia a aprovar, diferente da sugestão DELETE histórica do plano.
Não mudar `/auth/logout` nem tratar esta proposta como Swagger atualizado.

| Ação | Contrato recomendado |
|---|---|
| `GET /auth/sessions?limit=20&cursor=…` | HTTP 200 no envelope existente; `data: { items, nextCursor, serverNow }`. Autenticação/revalidação próprias; `Cache-Control: no-store`. |
| `POST /auth/sessions/:id/revoke` | JSON `{ senhaAtual }`; chamador válido e senha revalidada; HTTP 204 vazio após commit. UI usa somente para sessão remota no primeiro recorte. |
| `POST /auth/sessions/revoke-all` | JSON `{ senhaAtual }`; HTTP 204 vazio após revogar todas do owner, **incluindo chamador**. Sem `scope` variável no primeiro recorte. |
| Sessão atual | Reutilizar `POST /auth/logout`, HTTP 200/message e coordenador U2, sem exigir senha. Não redirecionar essa ação para logout global. |

DTO recomendado de item: `id`, `isCurrent`, `authenticatedAt`, `lastActivityAt`,
`idleExpiresAt`, `absoluteExpiresAt`, `clientDescription` nullable. Instantes ISO
UTC dos campos autoritativos U4; não divulgar owner, email, hashes, tokens, motivo
interno, UA bruto ou IP. `isCurrent` compara SID real do chamador, não “mais recente”.
Sem campo “online”: estar ativo na política não significa conectado agora.

Paginação: `limit` inteiro 1–20, default 20 proposto; ordenação estável
`authenticatedAt DESC, id DESC`, cursor limitado e tipado com esses dois valores,
não offset arbitrário/SQL; filtro owner em toda página. Cursor opaco não é
autorização e pode ser adulterado: validar tipos/tamanho, parametrizar e ignorar
qualquer owner embutido. O limite padrão de cinco não autoriza resposta ilimitada:
testar configuração maior que cinco e custo de consulta/índice antes de rollout.
Paginação limita resposta, não resolve sozinha o custo dos locks de login/global;
medir cardinalidade permitida e aprovar teto operacional se necessário.

Rotas estáticas e UUID devem ser resolvidos sem colisão; UUID malformado, cursor
inválido e propriedades extras são 400. Owner/SID nunca vêm da query/body.
Para alvo de outra conta, inexistente ou já revogado, mesma resposta externa
204/no-op, **depois** de validar chamador e reautenticação; sem precheck que revele
owner. Alvo expirado nunca reaparece ativo. Senha incorreta reutiliza
`AUTH_CURRENT_PASSWORD_INVALID` como erro de negócio, não 401 terminal.
Erros terminais preservam códigos U4; 429 indica limite, 5xx/timeout não provam
revogação. Após logout global, repetir com chamador já revogado recebe 401:
idempotência do alvo não dispensa autoridade do chamador.

HTTP 204 exige corpo realmente vazio e consumo explícito de sucesso sem
`response.data.message`. Testar interceptor global e cliente Axios reais; manter
envelopes das outras rotas. HTTPS/JSON, sem senha em header, query, log ou storage.

### Reautenticação e controle de tentativas

Senha por ação remota/global é proposta; não criar janela reutilizável de
“autenticação recente”. Logout local permanece sempre acessível. Limites atuais
de controller: login 10, refresh 20 e troca de senha 5 por minuto. Throttler
instalado usa `req.ip` e chave por classe/handler/nome/IP
(`backendnest/node_modules/@nestjs/throttler/dist/throttler.guard.js:141–150`),
não orçamento por conta. Default HTTP é 60/min; perfil E2E geral 1000/min é distinto.

U5 precisa propor orçamento compartilhado por conta autenticada para tentativas
de senha e limite por IP/rota como camada adicional. Valores, janela e mecanismo
multi-instância devem ser aprovados e verificados; não assumir que o throttle IP
existente cobre isso. Limite temporário, sem bloqueio permanente da conta ou
logout local: impedir abuso sem oferecer negação de serviço por tentativas de
terceiros. A [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
fundamenta essa necessidade; parâmetros específicos são escolha do produto.

## 5. Integração de UI e encerramento local

Adicionar “Sessões” à seção segurança de `/usuario`; recomendar rota
`/sessoes` em módulo auth, reutilizando `AppShell`, `FinanceAppHeader`,
`GlassPanel`, `GlassButton`, `GlassField`, `GlassTextInput`, `GlassStatusCard`.
Copy profissional em português, conforme UI existente. Lista com carregamento,
vazio, indisponibilidade e retry explícito; data legível, descrição aproximada,
marcador atual, ação remota e confirmação global “incluindo esta sessão”.
Foco/teclado/leitor de tela, contraste e operação em viewport estreito entram no
aceite. Sem polling/heartbeat para manter sessão viva.

Capturar snapshot/generation antes de cada leitura/ação; cercar resposta,
erro, `finally`, cache e navegação. Troca A→B, desmontagem ou logout apagam lista
e senha; resposta A nunca lista sessões nem encerra B. Senha vive só na memória
do formulário/request pelo tempo indispensável e é limpa em sucesso, falha e
cancelamento; nunca guardar em cápsula/storage/telemetria.

Contrato determinístico recomendado para global: confirmação/senha → chamada
server-first → 204 → invalidação **local-only** da geração capturada, cleanup
durável e navegação ao login. Essa integração local-only ainda precisa ser
implementada; o `logout()` atual faria SEGUNDA chamada remota e não deve ser
usado indiscriminadamente depois do commit global. Revogar remota mantém a atual
e refaz lista no mesmo snapshot. Logout atual conserva local-first U2.

Se timeout/queda após envio, outcome global é **desconhecido**, não “todas
encerradas”. Ocultar conteúdo privado e suspender autoridade daquele snapshot;
permitir confirmação explícita do estado atual ao reconectar ou saída local/nova
entrada, sem reenviar automaticamente senha/ação. Sessão atual ainda válida não
prova, sozinha, quais alvos remotos mudaram: reconciliar lista quando autorizado.
204 confirmado seguido de falha de cleanup também precisa informar limite local.

Preservar exceção estreita do interceptor: `AUTH_ACCESS_TOKEN_EXPIRED` emitido
antes do handler permite um refresh/retry coordenado; 401 genérico de mutação,
erro terminal, resposta perdida e timeout NÃO autorizam replay destrutivo.
Não ampliar a exceção nem reter senha para retries posteriores.
Eventos entre contextos são hints sem senha/token/owner e cercados por geração;
servidor continua autoridade. Native/BroadcastChannel/lifecycle só recebem PASS
quando observados em ambiente suportado, não por teste browser de outro caso.

## 6. Matriz de prova futura — nenhum PASS U5 nesta pesquisa

| Fronteira | Casos mínimos / resultado esperado |
|---|---|
| Ownership/entrada | Sessões próprias somente; SID estrangeiro, inexistente e já revogado indistinguíveis; owner forjado rejeitado; UUID/cursor/extra fields inválidos 400; nenhum dado da outra conta em erro/log. |
| Chamador | Revogado/idle/absoluto antes e DEPOIS do guard nega lista/efeito; expiry depois de espera por lock; versão/datas inválidas; terminal persistido após commit sem renovar deadline. |
| Senha | Incorreta não limpa sessão como 401; correta; senha trocada após bcrypt impede efeito; throttle account/IP e expiração do orçamento; sem lockout permanente nem impedimento de logout local. |
| Corridas PostgreSQL reais | Refresh vs individual/global em ambas ordens; global vs login serializado incluindo senha pré-verificada; locks SID estáveis, timeout e rollback; target=self; não resurrection nem efeito após chamador inválido. |
| Lista/política | GET não muda atividade/deadlines; expiradas/legado inválido excluídos; atual pelo SID; paginação com empates, cursor adulterado, configuração >5 e concorrência; tempo DB após lock. |
| Transporte | Envelope 200 e 204 vazio reais; senha ausente em logs/erros/query/storage; UA/control/markup tratado como texto limitado; sem token/hash/IP no DTO; `no-store`; CORS e Bearer preservados. |
| Cliente | Atual local-first; remota conserva atual; global confirmado limpa geração sem segundo logout; timeout pós-commit desconhecido, sem replay; cleanup falho informado; A→B e 401 atrasado não atingem B. |
| Contextos/UX/regressão | Revogação da própria sessão em voo; hints de abas e startup autoritativo; offline dados ocultos; foco/leitor/teclado/mobile; etapa 1, refresh U3 e política U4 preservados; Resend real desligado. |

Reutilizar suites existentes `auth.controller.spec.ts`,
`auth-sessions.service.spec.ts`, `auth-session.repository.spec.ts`,
`session-http.spec.ts`, `session-policy.spec.ts`, `session-activity.spec.ts` e
`backendnest/test/session-boundaries.e2e-spec.ts`; cliente
`frontend/__tests__/services/api.test.ts`, `logout-coordinator.test.ts`,
`session-contexts.test.ts`, `session-authority.test.ts` e
`frontend/src/modules/usuario/__tests__/usuario-screen.test.tsx`.
Adicionar casos U5 nesses locais ou suite focada, sem alegar cobertura já existente.

Comandos candidatos, **não executados aqui**: em `backendnest`,
`npm test -- --runInBand --runTestsByPath src/auth/auth.controller.spec.ts src/auth/repositories/auth-session.repository.spec.ts`;
em `frontend`, `npm test -- --runInBand --runTestsByPath __tests__/services/api.test.ts __tests__/services/logout-coordinator.test.ts`.
Demais suites entram conforme arquivos tocados. E2E demanda DB privado/identidade
e orçamento autorizados, não banco da aplicação. A
[harness mantida](../../backendnest/test/session-harness/README.md) hoje prova
C6/A8/C7C8, não endpoints U5: não adaptar runner histórico `.tmp` nem executar
essa sequência automaticamente. Tipos/check-only antes da prova; normalizadores
mutantes antes de congelar candidato. Falha preexistente global não vira PASS.

## 7. Decisões recomendadas na pesquisa — primeiro recorte posteriormente aprovado

| Decisão | Default recomendado e tradeoff |
|---|---|
| Escopos | Atual + remota escolhida + todas INCLUINDO atual. “Outras, menos esta” fica fora: acrescenta outro contrato e combinação de UX. |
| Reautenticação | Senha por ação remota/global, nunca por saída local. Mais fricção, menor alcance de sessão desbloqueada deixada com terceiro. |
| Tentativas | Orçamento temporário compartilhado por conta + IP/rota; parâmetros e operação multi-instância pendentes. Evitar força bruta sem bloquear permanentemente o titular. |
| Identificação | Primeiro recorte sem nova coleta: datas e desconhecido. Se identificação for indispensável, descrição aproximada nullable/80 caracteres; melhora reconhecimento mas exige captura/migration e privacidade. |
| Lista/retenção | Somente ativas; sem IP, geolocalização ou histórico. Página 20/max20 proposta. Retenção para coleta adicional deve ser explicitamente definida, sem inventar prazo. |
| HTTP/encerramento | POST JSON + 204 vazio para remota/global; global server-first e cleanup local-only. Contrato mais explícito, exige integração testada em vez de copiar logout U2. |
| Semântica global | Revoga no ponto serializado; login posterior continua possível. Bloquear logins em voo/futuros seria outra política, não promessa implícita de “todas”. |

As linhas registram a recomendação original. O usuário aprovou sua implementação
no primeiro recorte; o orçamento concretizado é 5 tentativas/60 s por conta e
20/min por IP/rota. Isso não ativa U4 nem autoriza migration no banco atual.

## 8. Ordem de trabalho sugerida para implementação posterior

Não é SDD nem estado de execução; cada unidade futura inclui testes e documento.
RED → GREEN → REFACTOR com caso que falha primeiro, quando implementação for autorizada.

| Ordem | Entrega e prova |
|---|---|
| 1 | Confirmar decisões acima, gates U3/U4, fontes/índice atualizados, ownership e cenário configuração >5. Delimitar custo/tempo e preservar baseline/WIP. |
| 2 | Transação de leitura owner-only e DTO/paginação bounded; RED de disclosure após guard, expiry após lock e no-touch, depois GREEN. |
| 3 | Revogação remota reautenticada na transação; hash esperado, chamador e alvo owner; HTTP IDOR/204/erros e ausência de segredo. |
| 4 | Global no mesmo lock de login; concorrência real e semântica de login posterior; controle de tentativas por conta aprovado e testes de abuso. |
| 5 | Captura/migration aditiva somente se opção de metadata aprovada; validar nulos/escritores/limites e rollback sem remoção de campos de autoridade. Sem essa opção, não criar migration. |
| 6 | Serviço/tela auth, link em perfil, confirmação e cleanup local-only; RED de A→B, outcome desconhecido, ausência de segundo logout e acessibilidade. |
| 7 | Provas HTTP/PostgreSQL/browser/native aplicáveis, regressões etapa 1/U2/U3/U4, Swagger somente das rotas realmente implementadas; readback independente e gates operacionais. |

Mapa de toque provável: `AuthController`, `AuthService`, `AuthSessionsService`,
`AuthSessionRepository` nos arquivos citados; DTOs auth, testes, Swagger;
`UsuarioScreen`, serviço/tela auth, router e integração storage/logout. Entidade/
migration apenas se metadata aprovada; política/atividade compartilhadas devem
ser reutilizadas, não alteradas silenciosamente. DTOs/tela/rotas novas são
artefatos previstos, ainda inexistentes.

**Blast radius ainda não confirmado:** mapeamento informa caminhos, não prova
impacto LOW. O índice histórico termina a repository antes dos métodos atuais
de 308 linhas; `authorize` não tinha resolução confiável na exploração.
Risco UNKNOWN até reindexação/leitura e `impact` upstream para cada símbolo antes
de editar. Comunicar callers/processos/risco e avisar HIGH/CRITICAL; antes de
eventual commit, `detect_changes`. Nada disso autoriza commit automático.

### Gates de rollout, migração e rollback

- [ ] Aceite das decisões U5 e autorização separada de implementação/provas.
- [ ] Dependências U3/U4 e 0016 prontas; backup/restauração, legado/timezone,
      mixed-version/rollback e plataformas obrigatórias demonstrados no alcance necessário.
- [ ] Migration futura de metadata, se houver, aditiva/nullable e aprovada; número
      reconfirmado. Nunca aplicar SQL no banco atual durante pesquisa.
- [ ] Capacidade de locks, cardinalidade/paginação e proteção de tentativas
      verificadas; amostra C7/C8 anterior não é SLO/aceite produtivo U5.
- [ ] Rollback remove endpoint/UI como unidade sem ressuscitar sessões nem
      remover política U4. Escritor sem metadata pode produzir null; binário
      antigo que ignora autoridade U4 NÃO é rollback seguro.
- [ ] Operação/documentos/Swagger refletem somente comportamento entregue;
      Resend segue adiado e etapa 2 não fecha com gate obrigatório aberto.

## Key Learnings:

1. Guard autoriza admissão; listagem sensível e revogação precisam revalidar
   chamador, relógio e hash dentro da própria transação.
2. “Sessão ativa” não identifica um dispositivo físico; metadados devem ser
   mínimos e logout global precisa declarar inclusão da sessão atual.
3. Timeout pode ocultar commit: não confirmar revogação global nem repetir senha
   automaticamente. Revogação confirmada e limpeza local são resultados distintos.

## Referências e limites

As 11 páginas oficiais estão vinculadas junto às conclusões na seção 2; consulta
em 2026-10-11, sem fontes secundárias e sem transcrição extensa. OWASP orienta
segurança, PostgreSQL explica concorrência, NIST delimita assurance e Supabase
serve como comparação de escopos — nenhum deles aprova escolhas deste produto.
Inspeção de fontes/readback documental não é prova funcional nem de produção.

Próximo passo atual: readback independente do primeiro recorte e provas browser/
plataformas aplicáveis, mantendo os gates operacionais do [resultado U5](../validacao/SEGURANCA_SESSOES_ETAPA_2_U5_RESULTADO.md).
Nenhum gate operacional foi dispensado pela pesquisa ou implementação local.
