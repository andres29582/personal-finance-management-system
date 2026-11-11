# U3: proposta de rotação segura entre contextos

> Atualização de prova em 2026-10-09: pipeline oficial Expo/Edge real verificado
> independentemente no **CORE**, **5/5, exit 0**, TypeScript global exit 0;
> 41 hashes do manifesto/31 do produto estáveis. Mantida a prova independente
> local 151/151. [Relatório](../../.tmp/stage2-u3-expo-browser/independent-verification.json)
> e [cobertura/histórico](../validacao/SEGURANCA_SESSOES_ETAPA_2_U3_RESULTADO.md#browser-core-verificado-independentemente).
> `observeSessionLifecycle` exposto, mas não chamado; sem prova direta de
> notificações BroadcastChannel/lifecycle. Três páginas: 401 concorrentes, não
> 401 explicitamente atrasado. Históricos oficiais 3/5 e 4/5 preservados, sem
> causalidade atribuída aos dois efeitos pré-headers nem alegação de commit PG.
> **U3 permanece aberta:** PostgreSQL real, native, startup autoritativo,
> notificações/lifecycle, matriz ampliada e rollout. Pendências/falhas de carga
> posteriores nesta pesquisa pertencem ao histórico anterior, não à prova atual.

**Status atualizado em 2026-10-09: política de refresh desconhecido aprovada; cliente implementado e verificado localmente após uma correção U3-R1. Validação independente: 151/151 testes em 15 suites, exit 0; TypeScript global exit 0, zero diagnósticos, 38 hashes estáveis. U3 NÃO encerrada: browser, PostgreSQL, native, rollout e startup autoritativo continuam gates. Veja a [ficha e a cronologia](../validacao/SEGURANCA_SESSOES_ETAPA_2_U3_RESULTADO.md). O restante registra a proposta original, não aprovação de produção.**

Recomendação: preservar a rotação estrita no servidor, serializar os escritores
de sessão na web e exigir reautenticação quando o resultado do refresh for
desconhecido. Um lock de navegador, sozinho, não resolve resposta perdida nem
queda da aba depois do commit. A proposta abaixo acrescenta identidade durável
e marcador de tentativa antes do envio, sem criar tolerância genérica ao replay.

## 1. Decisão aprovada e limites

O usuário aprovou **reautenticação quando o servidor pode ter rotacionado, mas
o cliente não conhece o resultado**, e solicitou implementar U3. A política
conserva a detecção de reutilização. Idempotência de uma
operação exata é uma alternativa com maior escopo de backend e retenção segura;
não é uma autorização para reenviar qualquer token antigo por 30 segundos.

Este documento complementa o [plano da etapa 2](SEGURANCA_SESSOES_ETAPA_2.md).
U1/U2 permanecem encerradas apenas no alcance local aprovado. Os 138/138 testes
e typecheck sem diagnósticos do fechamento de U2 são **evidência histórica de
U1/U2, não prova de U3**. Na pesquisa original não foram executados testes, build,
exportação, navegador, app native, banco, migration ou email. Nenhum runtime,
dependência, configuração ou fonte de aplicação foi alterado pela pesquisa original.
A implementação posterior usa cápsula única versionada, SID/sub coerentes,
Web Locks em contexto seguro, fila local native e deadline técnico 5 s/espera
7 s, sem lease inseguro ou mudança de CAS/backend. A ficha registra a migração
conservadora, limite de aplicação native de 2 KiB, nova ferramenta dev-only e
falha da harness real, sem transformar esses gates em PASS.

Resend continua adiado. Limites de tempo U4, gestão de sessões U5, cookies/BFF,
Redis, fingerprints e substituição da autenticação customizada ficam fora da
primeira correção proposta. Este desenho não estabelece AAL nem conformidade
OAuth. Os achados são estáticos, não exploração observada.

## 2. Baseline verificável e lacunas P1

As referências abaixo descrevem o worktree atual; linhas podem mudar. O índice
GitNexus informado é de 2026-09-24: o código atual prevalece, e o índice não foi
atualizado nesta pesquisa.

| ID | Evidência atual | Lacuna a resolver |
|---|---|---|
| U3-P1 | `frontend/storage/authStorage.ts:8–17,68–90`; `frontend/src/shared/services/api.ts:75–77,136–141` | Fila, generation e listeners pertencem ao módulo/runtime. Abas compartilham chaves individuais, mas instalar B em outra aba não invalida o sucesso 200 nem a UI antiga de A. |
| U3-P2 | `frontend/src/shared/services/api.ts:86–114,118–122,159`; `backendnest/src/auth/auth.service.ts:183–235` | Snapshot N é capturado no request; um 401 tardio pode chegar depois que a promessa de N terminou e tentar refresh com N novamente. O perdedor de CAS pode revogar a sessão válida em `auth.service.ts:216–229`. |
| U3-P3 | `frontend/storage/authStorage.ts:38–46,181–227` | Comparação do refresh token protege contra B **já completamente persistida**. Não afirmar que generation sozinha sobrescreve esse caso. A lacuna é a intercalação entre leitura, awaits, verificação do tombstone e escritas separadas, sem fronteira atômica entre abas; rollback local também pode restaurar valores sobre B. |
| U3-P4 | `frontend/storage/authStorage.ts:256–290` | Logout de uma aba antiga oculta sua UI imediatamente, mas depois lê o access token compartilhado e remove chaves sem identidade durável. Pode capturar/revogar B e apagar sua sessão. |
| U3-P5 | `frontend/storage/authStorage.ts:7–12,23–24,237–249` | Tombstone booleano e generation reiniciada não distinguem encarnações. Novo login remove o marcador, enquanto o runtime antigo pode continuar marcado como signed out; faltam reconciliação e proteção contra ABA. |
| U3-P6 | `frontend/src/modules/usuario/screens/UsuarioScreen.tsx:87–89,167–177`; `frontend/storage/authStorage.ts:129–133` | Perfil antigo publica estado e chama `saveUser` sem owner/snapshot esperado; metadata de A pode substituir B. Proteger também caches e projeções já publicados. |
| U3-P7 | `frontend/src/navigation/RootLayout.tsx:26–48`; `frontend/src/modules/dashboard/screens/HomeScreen.tsx:12–23`; `frontend/src/modules/dashboard/hooks/useDashboardData.ts:42–55,68–77` | Notificações atuais são locais; startup confia no token. Evento perdido, BFCache e resume precisam reler estado e validar autoridade antes de liberar conteúdo protegido. |

Conservar o CAS e o lock de usuário do servidor, incluindo predicados de hash
depois do lock em `backendnest/src/auth/repositories/auth-session.repository.ts:118–134`.
ID de aba não prova legitimidade de quem apresenta um bearer token.

Todos os escritores entram no futuro inventário: instalação de login, refresh,
rollback, perfil, tombstone, migração e limpeza; também exports públicos de
`authStorage.ts` e `frontend/src/modules/auth/services/authService.ts`.
`refreshSession` é exportado e não teve consumidor de produção identificado no
escopo inspecionado: isso não autoriza deixá-lo como bypass do coordenador.
Register não instala tokens; redireciona ao login. Reexports legados precisam
preservar o contrato, não criar caminhos alternativos. Não foram identificados
escritores individuais de tokens em produção no escopo inspecionado.

### Ferramentas e compatibilidade

Inventário instalado fornecido pela auditoria: Expo 57.0.23, SecureStore 57.0.4,
React Native 0.86.3, Axios 1.13.6, Jest 29.7 e react-native-web 0.21.2.
`frontend/package.json` oferece `test`, `typecheck` e `export:web`; não oferece
harness E2E de browser na auditoria original. Na implementação posterior,
Playwright 1.64.0 foi autorizado/instalado somente como devDependency; o script
`test:session-browser` e a harness existem, mas os três cenários falharam na carga
dos módulos, sem PASS multiaba. Puppeteer/Cypress não foram adicionados.
`frontend/app.json:22–25` usa exportação web
estática. Matriz de browsers, domínio de produção e ambiente privado não foram
validados. Documentação `latest` não comprova compatibilidade com esses pacotes.

## 3. Fontes e consequências para o desenho

Fontes primárias consultadas em **2026-10-09**. As consequências são propostas
de aplicação ao sistema, não prova de comportamento já implementado.

| Fonte | Consequência e limite |
|---|---|
| [RFC 9700 §4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2) | Rotação detecta reutilização, mas não distingue atacante de cliente legítimo usando o token invalidado. Sender binding exige prova criptográfica; ID de operação, IP, User-Agent e ID de aba não a substituem. Referência de ameaça, não certificação OAuth. |
| [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) | Não repetir automaticamente operação não idempotente sem saber que não foi aplicada ou sem contrato idempotente. Timeout/abort do cliente não desfaz commit remoto. |
| [W3C — Web Locks](https://www.w3.org/TR/web-locks/) | Lock em contexto seguro, no mesmo storage bucket, mantido durante a promessa do callback. Destruição do contexto libera o lock; não transfere conhecimento do resultado HTTP ao próximo proprietário. |
| [WHATWG — Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html) | Não assumir lock em localStorage nem transformar read/write de lease em mutex seguro. Escritas podem falhar; várias chaves não compõem transação. |
| [MDN — BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API), [storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) | Comunicação depende de origem/partição. Evento é aviso para reler, não autoridade. Storage event não notifica o escritor. Não retransmitir `event.newValue` de envelope com segredos. |
| [Chrome — Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api), [MDN — pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event) | Freeze exige cuidado com locks/canais; termination não é observável de forma confiável. Retorno por BFCache/resume precisa reconciliar, mesmo sem evento recebido. |
| [React Native — AppState](https://reactnative.dev/docs/appstate), [Expo — SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) | AppState sinaliza lifecycle, não transação. Considerar active/background/inactive, blur Android e estado inicial null em arquitetura legada. SecureStore tem falhas de payload, diferenças de persistência ao desinstalar e perda de acesso com mudanças biométricas; compatibilidade/payload reais ficam pendentes. |
| [Playwright — Browser contexts](https://playwright.dev/docs/browser-contexts), [Network](https://playwright.dev/docs/network) | Abas compartilhadas são páginas de **um mesmo contexto**. Contextos distintos isolam storage e não comprovam coordenação multiaba. Perda de resposta precisa ocorrer após commit real demonstrado, não apenas abort antes do encaminhamento. |

## 4. Arquitetura mínima proposta

### 4.1 Identidade durável e publicação coerente

Propor envelope versionado com `schemaVersion`, `incarnation` imprevisível,
`revision`, `sessionId`, `status`, credenciais e usuário completos e validados
antes da publicação. Uma nova autenticação recebe nova `incarnation`, **mesmo
para a mesma conta**. `revision` ordena mudanças dentro dela. Metadata é fence
do cliente, não autorização do servidor nem prova de dispositivo confiável.

Na web, publicar um envelope coerente evita observar access/refresh/user de
escritas diferentes. O envelope só pode ser autoridade entre escritores que
respeitam o coordenador. Substituir o booleano por tombstone de encarnação;
logout antigo só afeta a identidade que originou a ação, nunca B instalada
depois. Login, rollback e perfil exigem identidade esperada e releitura antes
de gravar. Rollback não pode restaurar snapshot sobre uma instalação posterior.

States propostos incluem `valid`, `refreshInFlight`, `refreshOutcomeUnknown`,
`signedOut` e `storageDenied`; não existem ainda como contrato implementado.
Uma tentativa local de logout mantém o bloqueio imediato de U2. Uma nova
instalação legítima é adotada somente por reconciliação explícita de identidade,
não por remover cegamente um flag nem por reabrir tokens legados.

### 4.2 Um coordenador para todos os escritores web

Usar um Web Lock exclusivo por bucket/origem compatível, cobrindo esta sequência:

1. Adquirir com espera limitada; reler e validar o envelope mais recente.
2. Comparar identidade/revisão esperadas; cancelar ações antigas de A após B.
3. Para 401 tardio de N, adotar N+1 já persistida da mesma identidade, sem
   enviar N. Outra encarnação cancela o request antigo.
4. Antes de enviar refresh, persistir marcador de tentativa vinculado à
   identidade/revisão. Se a gravação falhar, **não enviar**.
5. Manter o lock durante o refresh limitado e a persistência do resultado;
   reler/validar antes de publicar o envelope completo e concluir a tentativa.
6. Notificar localmente e enviar apenas aviso mínimo não secreto de
   `incarnation`/`revision`; receptores relêem storage.

Reexecução de request protegido depende de contrato que prove rejeição anterior
à execução e segurança da repetição. Não usar este fluxo para replay cego de
POSTs financeiros. A validação de identidade alcança despacho, sucesso, erro,
perfil, UI e cache, não somente o interceptor.

**Tradeoff do lock longo:** login/logout compartilhados podem esperar o refresh
limitado. A UI da aba que pediu logout continua imediata por U2; o tombstone
compartilhado só é confirmado quando consegue gravar sob o lock. Não prometer
logout durável instantâneo em todas as abas. Se isso for requisito obrigatório,
um protocolo separado com locks curtos de mutação e refresh exige desenho e
prova adicionais; não é o default desta proposta. Deadline de espera e de rede
devem ser aprovados, sem inventar valores de produto nesta pesquisa.

### 4.3 Resultado desconhecido e morte do proprietário

Outro proprietário que encontra tentativa durável não concluída **não reenvia
N**: pode ter ocorrido commit remoto antes da queda ou perda da resposta.
Sem resultado novo verificável, bloquear dados/ações protegidos e pedir login
com explicação de confirmação indisponível, sem afirmar ataque. Também uma
queda depois de marcar e antes do envio deixa tentativa órfã: a escolha é
conservadora, aceita possível login extra, não inventa prova de não envio.

Liberar um Web Lock, cancelar Axios ou receber timeout não prova rollback no
servidor. Falha comprovadamente pré-envio é distinta de resultado desconhecido;
somente evidência confiável autoriza conservar o caminho recuperável sem login.
Preservar a rotação/CAS atuais e a rejeição de replay genuíno no backend.

### 4.4 Reconciliar mesmo sem notificações

BroadcastChannel e storage event são otimizações de despertar. Inicialização,
`visibilitychange`, `pageshow`/BFCache e retomada relêem a identidade durável e
revalidam autoridade antes de requests/conteúdo protegido. Limpar/cercar projeções
e caches antigos sem esperar que um evento esteja garantido. Nunca enviar tokens,
payload do usuário ou envelope em canal, logs ou evidência pública.

Web Locks indisponível/negado não admite lease inseguro de localStorage:
falhar fechado em estado de compatibilidade e indicar suporte não aprovado
para refresh compartilhado. Ausência de canal não remove o lock/releitura;
partições diferentes não recebem promessa de coordenação compartilhada.

### 4.5 Native e migração não são cópia da web

Native conserva fila local e SecureStore, com identidade durável reconciliada
no startup e AppState. Isso não prova exclusão entre processos nem usa APIs de
browser. Um envelope web com usuário completo pode exceder payload suportado:
testar tamanho, erros, publicação/migração coerentes e recuperação antes de
escolher layout SecureStore. Não assumir transação multichave ou payload ilimitado.

Migração deve respeitar `auth_signed_out`: marcador presente nunca permite
ressuscitar tokens legados. Dados parciais, malformados ou identidade desconhecida
exigem recuperação conservadora/reautenticação. Definir rollback sem reativar
sessão revogada. Clientes antigos que ignoram o envelope ainda podem escrever
chaves legadas; exigir gate de versão/rollout coordenado ou atualização forçada.
Não declarar migração segura enquanto esses escritores puderem coexistir.

## 5. Aprovações antes de implementar

| Gate | Recomendação proposta | Custo/alternativa e estado |
|---|---|---|
| Resultado ambíguo | Rotação estrita + login explicado | **Aprovado pelo usuário para U3 e implementado no cliente.** Login extra após resposta perdida; sem grace/idempotência de backend. Provas reais ainda pendentes. |
| Plataformas web | Contexto seguro e Web Locks obrigatórios, feature detection e falha fechada implementados | Matriz de browser real e suporte de produção **pendentes**; nenhum lease inseguro como fallback. |
| Ordenação compartilhada | Lock longo limitado; UI local imediata implementados | Espera técnica 7 s/refresh 5 s; outras mutações aguardam. Prova real e exigência de logout global instantâneo **não aprovadas integralmente**. |
| Compatibilidade | Envelope versionado e gate contra clientes antigos | Pode exigir atualização/login; migração e rollback precisam prova. **Pendente.** |
| Transporte e privacidade | Registrar risco residual de bearer/localStorage | Coordenação não mitiga XSS. Cookies/BFF exigem decisão separada de topologia, CSRF e native. **Pendente.** |
| Ferramenta de prova | Playwright 1.64.0 dev-only e Edge instalado, autorizados para harness sintética | Três falhas de carga, exit 1; nova tentativa pelo pipeline web oficial do Expo/build controlado exige decisão. Nenhum PostgreSQL/device iniciado; gates reais **pendentes**. |

## 6. Unidades futuras delimitadas e impacto

Estas unidades não são tarefas SDD iniciadas nem autorização de edição. Antes
de mudar qualquer símbolo, executar GitNexus impact upstream com índice vigente,
relatar callers/processos/risco e avisar HIGH/CRITICAL. A tabela identifica alvos
concretos, não inventa o blast radius.

| Unidade | Dependência e resultado | Alvos para impacto futuro |
|---|---|---|
| U3-A | Gates de compatibilidade/native; envelope, migração e todos os escritores | `getSessionSnapshot`, `installSession`, `applyRefreshIfCurrent`, `clearSessionIfCurrent`, `beginLocalLogout`, `saveUser`, `saveToken`, `saveRefreshToken`, `removeToken`, `removeRefreshToken`, `removeUser`, `clearSession` em `frontend/storage/authStorage.ts`; `loadProfile`/`handleSave` em `frontend/src/modules/usuario/screens/UsuarioScreen.tsx` |
| U3-B | U3-A + plataforma/ordenação; coordenador e releitura N→N+1 | `refreshAccessToken`/`attachBearerToken` em `frontend/src/shared/services/api.ts`; `refreshSession` em `frontend/src/modules/auth/services/authService.ts`; `logout` em `frontend/src/modules/auth/services/logoutCoordinator.ts` |
| U3-C | U3-B + política ambígua; marcador antes do envio e recovery sem replay | Mesmos escritores/refresh; preservar `refreshSession` em `backendnest/src/auth/auth.service.ts` e `rotateIfActiveWithMatchingToken` em `backendnest/src/auth/repositories/auth-session.repository.ts`, verificando impacto antes de qualquer edição futura |
| U3-D | U3-A–C; avisos mínimos, startup/resume, UI/cache cercados | `RootLayout` em `frontend/src/navigation/RootLayout.tsx`; `HomeScreen` em `frontend/src/modules/dashboard/screens/HomeScreen.tsx`; `useDashboardData` em `frontend/src/modules/dashboard/hooks/useDashboardData.ts`; consumidores públicos e perfil |
| U3-E | Unidades anteriores + autorização de tooling/runtime; prova reproduzível | Testes existentes em `frontend/__tests__/storage/authStorage.test.ts`, `frontend/__tests__/services/api.test.ts`, `frontend/__tests__/services/logout-consumers.test.tsx` e `frontend/__tests__/services/logout-tombstone.test.ts`; harness browser/native futuro ainda sem arquivo/script escolhido |

## 7. Matriz de prova requerida

Nenhuma linha está aprovada/executada por esta pesquisa. A matriz detalha
S2-02–S2-06 e S2-08 do plano, sem substituir S2-01–S2-12 nem fechar U4/U5/U6.

| ID | Cenário e resultado esperado | Prova necessária |
|---|---|---|
| U3-01 | 2–3 abas usam N: uma rotação, demais adotam N+1 | Páginas de um contexto compartilhado + servidor/DB real e contagem/barreiras |
| U3-02 | 401 tardio de N após promessa concluída: reler N+1, não reenviar N | Integração determinística + browser |
| U3-03 | Novo login da mesma conta muda `sessionId`/`incarnation`; antigo não publica | Storage/API/UI com barreiras |
| U3-04 | 200, 401 e perfil A chegam após B: não apagar nem exibir/cachear A | Consumidor real e browser, incluindo `saveUser` |
| U3-05 | Logout de A antiga não captura bearer B nem apaga B | Browser/storage + request remoto capturado sem expor token |
| U3-06 | Login A/rollback atrasado não restaura valores sobre B | Falha de persistência com intercalação controlada |
| U3-07 | Reload com tombstone e tokens antigos não autentica; novo login legítimo é reconciliado | Reload real + migração e ABA |
| U3-08 | Commit de rotação confirmado, resposta descartada, owner cai antes de persistir: próximo não reenvia N | Barreira de commit real + perda pós-commit + reload/queda |
| U3-09 | Owner cai depois de marcar e antes de enviar: recovery conservador sem retry | Barreira pré-envio + reload |
| U3-10 | BFCache/resume/evento perdido não mantém identidade/cache anterior | Browser real `pageshow`/visibilidade e ausência controlada de aviso |
| U3-11 | Canal ausente/particionado: mesma partição ainda relê sob lock; sem promessa entre partições | Browser com transporte de avisos desabilitado/partições explícitas |
| U3-12 | Lock ausente/negado ou espera excedida: bloqueio explicado, nenhum lease/replay | Feature detection e deadline determinísticos |
| U3-13 | Storage nega marcador/escrita ou legado é parcial: não enviar refresh nem publicar sessão mista | Injeção de falha e migração/rollback |
| U3-14 | Logout espera refresh limitado: UI da aba sai imediatamente; commit compartilhado só depois do lock | Consumidor real + relógio/barreira; não prometer saída instantânea global |
| U3-15 | Replay genuíno mantém rejeição/revogação prevista no CAS, sem grace genérico | Backend/HTTP + PostgreSQL real isolado |
| U3-16 | Native: payload grande/negado, perda de chave e resume não publicam credenciais parciais | Testes de adapter + dispositivos/emuladores disponíveis; indisponível permanece pendente |

Para U3-08, demonstrar que a rotação foi **commitada** antes de descartar a
resposta; abortar rota antes do servidor não demonstra isso. Um harness pode
encaminhar request e descartar retorno depois de uma barreira server-side
verificável, usando os recursos de [rede do Playwright](https://playwright.dev/docs/network).
Mocks Axios complementam, não substituem essa evidência.

Toda prova de banco usa identidade explícita e descartável `finance_e2e_`, com
guards de isolamento e reset apenas do schema de teste. **Nunca usar/resetar
`gestao_financeira`**. Sem autorização de runtime/DB, preservar testes como
planejados. Evidência registra versões, origem/partição, interleavings, contagem
de requests, commit/barreiras e resultados sanitizados; não tokens, credenciais,
PII, valores de ambiente ou dumps financeiros.

## 8. Encerramento futuro e próximo passo

- [ ] Política ambígua, suporte web, ordenação, rollout e tooling aprovados.
- [ ] Todos os escritores/exports cercados, sem bypass e sem retorno do tombstone legado.
- [ ] U3-01–U3-16 aplicáveis comprovados; plataforma indisponível não recebe PASS global.
- [ ] Regressões U1/U2 preservadas e reexecutadas; 138 históricos não substituem a execução futura.
- [ ] Migração/rollback, payload native, privacidade, secure context e suporte documentados.
- [ ] Revisão independente e evidências reais, sem alterar CAS para tolerar replay genérico.
- [ ] Autorizações de dependências/runtime/DB obtidas antes dessas ações; Resend segue adiado.

**Próximo passo:** decidir a correção da harness pelo pipeline web oficial do
Expo/build controlado, depois resolver gates de navegador, native,
backend/commit real, startup autoritativo e compatibilidade/rollout descritos na ficha.
A política ambígua já foi aprovada; a proposta original não é receipt de review,
prova de todos os cenários nem encerramento da etapa 2.
