# Etapa 1: troca e recuperação de senha consistentes

**Status: escopo autorizado de desenvolvimento concluído e verificado em 2026-10-08; não liberado para produção.**
Núcleo U0/U1/U2 previamente verificado. U3/C8 concluído em desenvolvimento,
com outbox e simulação: **172/172 testes**, tipos de produção e revisão
independente dos 18 paths aprovados. Worker OFF por padrão; envio real bloqueado
e flag live rejeitado. Domínio, entrega real, privacidade/retenção e produção
continuam sem aprovação; simulação não comprova entrega de email.
Correção delimitada: acknowledgement adquire a linha antes do relógio e valida
token/lease persistidos; regressão PostgreSQL da espera pelo lock aprovada.
Migration `0015` aplicada somente ao banco isolado de testes; **não aplicada ao
banco da aplicação**. Exige processo autorizado antes de ativar código, mesmo
com worker OFF. Não houve commit ou deploy. Recuperação continua no webhook
existente; entrega pública do link de reset por Resend não foi implementada.
[Operação Resend em desenvolvimento](../operacao/RESEND_DESENVOLVIMENTO.md).
[Evidências e runbook](../validacao/SEGURANCA_CREDENCIAIS_ETAPA_1_RESULTADO.md).
As seções abaixo preservam o plano e a inspeção anteriores; o relatório registra
as provas atuais. Não reexecutamos baseline global nem frontend nesta conclusão.
Auditoria independente 1 e correção delimitada 1 registradas no relatório;
U4 concluiu revisão e provas delimitadas do núcleo; U3 teve revisão final própria.
Primeira prova PostgreSQL: 7 casos aprovados, 2 falhos, preservada como histórico.
Após remediação delimitada do harness: PostgreSQL 9/9 e regressão de reset 4/4,
backend 115 testes/14 suites, frontend 56 testes/5 suites; tipos backend de
produção e frontend delimitados aprovados. PostgreSQL 18.3 temporário isolado foi
encerrado, sem PID/listener. Migration 0014 aplicada somente nos testes, não em
produção. Os detalhes, comandos e hashes congelados estão no relatório acima.
Objetivo: após uma mudança de senha confirmada, nenhuma sessão ou link de
recuperação anterior deve recuperar acesso. Preservar NestJS, PostgreSQL e JWT
vinculado à sessão. Não migrar para Auth0/Firebase nesta etapa.

## Leitura rápida

1. Revisar escopo, invariantes e contrato HTTP abaixo.
2. Executar unidades pequenas com teste que falha antes da correção.
3. Demonstrar concorrência e rollback em PostgreSQL descartável.
4. Publicar evidência e runbook; não confundir planejamento com testes aprovados.

Este documento usa português, conforme o corpus de arquitetura/testes existente.
Identificadores de contratos e nomes de testes continuam técnicos; textos de UI
seguem o português já presente no produto, sem voz/persona de conversa.

## 1. Estado atual verificado

Referências são do worktree inspecionado, incluindo alterações não commitadas;
linhas podem mudar. Não assumir que resultados antigos representam estes bytes.

| Evidência | Consequência |
|---|---|
| `backendnest/src/auth/auth.service.ts:125-166`: bcrypt compara a senha antes de criar sessão | Login pode verificar o hash antigo e criar uma sessão após a troca |
| `backendnest/src/auth/repositories/auth-session.repository.ts:28-59`: trava `usuario` com `FOR UPDATE` para limitar sessões | Já existe coordenação por usuário; reaproveitar, sem framework genérico de locks |
| `backendnest/src/auth/auth.service.ts:258-271`; `dto/reset-password.dto.ts:4-9` | Troca autenticada recebe somente `novaSenha`; atualização e revogação são separadas |
| `backendnest/src/auth/repositories/password-reset-token.repository.ts:31-64` | Recuperação já consome um token, troca senha e revoga sessões na mesma transação, mas não invalida tokens irmãos |
| `backendnest/src/auth/auth.service.ts:367` | Há revogação redundante após o commit da recuperação; pode revogar login legítimo iniciado depois dele |
| `backendnest/src/auth/auth.service.ts:307-328` | Token aleatório de 32 bytes, SHA-256 persistido; criação sem coordenação com troca e entrega assíncrona best-effort |
| `backendnest/src/auth/entities/password-reset-token.entity.ts:11-21` | Schema tem `tokenHash`, `expiresAt`, `usedAt`, `createdAt`; não tem estado nem `invalidatedAt` |
| `backendnest/src/auth/repositories/auth-session.repository.ts:86-104` | Refresh usa UPDATE condicional por hash, expiração e ausência de revogação |
| `backendnest/src/auth/strategies/jwt.strategy.ts:49-66` | Access JWT depende de sessão ativa consultada no banco |
| `backendnest/src/auth/password-reset-delivery.service.ts:17-55` | Há webhook de recuperação, timeout e log sanitizado; não há contrato de notificação de senha alterada nem fila durável nessa implementação |
| `frontend/src/modules/auth/screens/ResetPasswordScreen.tsx:50-65` | Formulário só envia nova senha; limpa sessão ao sucesso e trata qualquer 401 como expiração |
| `frontend/storage/authStorage.ts:10-33,115-119`; `frontend/src/shared/services/api.ts:91-119` | SecureStore no móvel/localStorage web; refresh em voo pode regravar credenciais após limpeza |
| `backendnest/test/auth-password-reset.e2e-spec.ts:104-148` | Já existe teste PostgreSQL de consumo paralelo do mesmo token; Promise.all não controla qual interleaving ocorreu |

**Correção da investigação anterior:** não é correto dizer que todos os testes
de concorrência usam mocks. Existe E2E PostgreSQL; não foi executado nesta análise
e ainda não prova os cenários de tokens irmãos ou login contra troca de senha.

## 2. Fundamentos oficiais e escolha local

Referências consultadas em 2026-10-05; aplicar controles, não alegar certificação.

- [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature): troca autenticada exige sessão ativa e verificação da senha atual.
- [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): tokens seguros, uso único e expiração; notificação; login normal após recuperação. O guia contempla invalidar sessões e, na recuperação de conta comprometida, links/códigos pendentes. Invalidar todos os links após qualquer troca é a política proposta para este sistema, não uma exigência universal para todos os eventos.
- [OWASP ASVS](https://owasp.org/projects/asvs): estrutura de critérios verificáveis, sem inventar IDs de requisitos ou chamar o sistema de certificado.
- [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html): ordem consistente de aquisição reduz deadlocks. A documentação corrente não comprova a versão do servidor implantado.
- [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html): READ COMMITTED não protege sozinho invariantes entre operações; UPDATE reavalia condições após conflito. Usar lock e condições explícitas.
- [TypeORM transactions](https://typeorm.io/docs/advanced-topics/transactions/): todas as operações transacionais precisam do manager da transação. Verificado também no pacote local `typeorm` 0.3.28, `backendnest/node_modules/typeorm/entity-manager/EntityManager.js`, que passa `queryRunner.manager` e realiza commit/rollback. Não chamar repositories globais dentro do callback como se participassem dele.

## 3. Escopo e invariantes de aceitação

Inclui recuperação, troca autenticada, emissão concorrente de links/login,
revogação/refresh na fronteira da troca, adaptação mínima do cliente e notificação.
Não inclui MFA, passkeys, verificação/troca segura de email, migração de hashing,
cookies web, gestão de dispositivos, novas políticas de duração de sessão ou
reforma geral do refresh entre abas. A sessão não pode reaparecer localmente após
esta troca no runtime JavaScript coordenado; a correção mínima de resposta
obsoleta é dependência desta etapa. Outras abas podem conservar/gravar estado
obsoleto até a etapa 2, mas isso nunca restaura autoridade da sessão revogada no servidor.

| ID | Garantia verificável |
|---|---|
| C1 | Troca autenticada exige senha atual correta e sessão própria ainda ativa dentro da transação |
| C2 | Senha, consumo/invalidação de links e revogação de sessões confirmam juntos ou não mudam |
| C3 | Após commit, todos os links pendentes anteriores e sessões anteriores ficam inutilizáveis |
| C4 | Verificação bcrypt do hash antigo não autoriza criar sessão depois da troca |
| C5 | Dois tokens irmãos concorrentes permitem no máximo uma recuperação; consumo do mesmo token também |
| C6 | Refresh não remove revogação; tokens entregues tarde podem estar revogados, nunca restauram autoridade |
| C7 | Resultado não contém tokens novos nem autologin; usuário volta ao login normal |
| C8 | Falha de entrega não desfaz mudança confirmada; evento de notificação é recuperável e sem segredos |
| C9 | Erros, logs, evidências e evento `PASSWORD_CHANGED` não expõem senha, hash, reset token ou JWT; o webhook HTTPS autorizado de recuperação recebe somente o reset token necessário ao envio do link, conforme seu contrato |
| C10 | Mudança de A não altera senha, tokens ou sessões de B |

Estados de token **derivados**, não enum artificial: `CONSUMED` se `usedAt` existe;
`INVALIDATED` se `invalidatedAt` existe; `EXPIRED` se prazo venceu; caso contrário
`PENDING`. Propor coluna nullable `invalidated_at` em nova migration SQL. Não
reinterpretar invalidação como consumo nem alterar migrations já aplicadas.
Elegibilidade exige ambos timestamps nulos e prazo futuro. Não permitir estados
terminais voltarem a `PENDING`; testar precedência e eventual constraint para não
marcar um mesmo token consumido e invalidado. Sessões continuam `ACTIVE`,
`REVOKED` ou `EXPIRED` derivados dos campos já existentes.

## 4. Desenho transacional mínimo proposto

### Coordenação e ordem única

Reusar o lock de linha de `usuario`. Toda operação participante primeiro resolve
o usuário por leitura não bloqueante e depois, dentro da transação, trava
`usuario` por ID. Leituras preliminares são somente pistas: revalidar estado
depois do lock. Ordem: **usuário → token(s), quando aplicável → sessão(ões)**.
Nenhum caminho pode travar sessão/token e depois usuário. Se houver aquisição
individual de várias linhas, ordenar por ID. Operações de outro usuário não
devem bloquear entre si. Definir timeout de lock e erro sanitizado; não repetir
automaticamente mudanças de senha cujo commit teve resultado desconhecido.

| Operação | Passos sob o mesmo EntityManager |
|---|---|
| Login | Comparar bcrypt fora da transação; carregar hash verificado. Sob lock, reler usuário e exigir igualdade exata de `senhaHash`; se divergir rejeitar com `AUTH_INVALID_CREDENTIALS`, sem sessão. Aplicar limite e inserir sessão usando o mesmo manager |
| Solicitar recuperação | Snapshot prévio do usuário/hash; gerar token fora do lock. Sob lock reler usuário e comparar snapshot; se senha mudou, não inserir token baseado na leitura antiga e manter resposta pública genérica. Inserir token/TTL após revalidação. Não revogar sessões apenas por solicitação |
| Recuperar por token | Resolver hash→usuário sem consumir; preparar bcrypt da nova senha fora do lock. Trava usuário; verificar token próprio, pendente e ainda válido; UPDATE condicional e conferir uma linha afetada. Atualizar senha, invalidar irmãos pendentes, revogar sessões e persistir evento de notificação; commit único |
| Trocar autenticado | Snapshot do hash, bcrypt da senha atual e hash novo fora do lock; levar `sid` do request. Sob lock revalidar hash exato, usuário e sessão própria não revogada/expirada. Atualizar senha, invalidar todos os links pendentes, revogar todas as sessões inclusive atual e persistir evento; commit único |
| Refresh | Preparar assinatura fora do lock; transação trava usuário antes da sessão e executa CAS por hash, estado e expiração. Preservar detecção de reutilização; nunca gravar `revokedAt=null`. Remover revogação redundante da recuperação fora da transação |

A senha atual é uma prova vinculada ao hash verificado, não um booleano reutilizável.
Não aplicar a política de nova senha à senha atual de usuários legados; não
trimar senhas. Hashing custoso fora da transação reduz retenção de locks, mas
o resultado só pode ser aplicado depois da revalidação. Checar usuário
existente, sessão ativa e linhas afetadas; falha deve causar rollback, não sucesso
vazio. A entidade `User` atual não possui estado de ativação; não introduzir
ativação/desativação de conta nesta etapa.

Calcular o instante de validade **após adquirir lock**, preferencialmente por
relógio do banco (`clock_timestamp()`), para token expirado enquanto aguardava.
Validar conversão timestamp/UTC do schema atual. Não usar o começo da transação
como referência se passou muito tempo aguardando. Não exigir SERIALIZABLE ou
advisory lock adicional quando a linha de usuário já resolve a coordenação.

O commit é a fronteira de revogação. Login que confirmou antes é revogado pela
troca; login novo com senha nova depois pode criar sessão legítima. Um refresh
confirmado antes pode responder depois, mas sua sessão estará revogada. A
revogação não cancela requisição financeira que já passou pelo guard; proibir
efeitos de todas as requisições em voo exigiria outro desenho, fora do escopo.

### Notificação sem segredos ou entrega ilusória

O webhook atual só define recuperação. Não enviar payload novo sem validar
contrato/capacidade do receptor. Propor evento `PASSWORD_CHANGED` contendo
`eventId`, destinatário e instante, nunca senha/token/hash. Capturar destinatário
no estado travado; email ainda não verificado é uma limitação conhecida.

Proposta para C8: pequena outbox PostgreSQL gravada na mesma transação, com
claim concorrente/lease, estado de entrega, limite de tentativas, backoff,
timeout, métricas e retenção. Usar banco e fetch existentes; não instalar Redis,
broker ou framework de filas. Enviar exclusivamente depois do commit; receptor
deduplica por `eventId` (entrega pelo menos uma vez, não exatamente uma vez).
Falha permanente gera alerta seguro e procedimento de reenvio; falha de escrita
da outbox reverte a troca. Email enviado não é garantia de leitura pelo usuário.

Alternativa menor: webhook pós-commit best-effort. Evita migration/worker, mas
pode perder notificação em crash. Só adotar se essa perda for aceita explicitamente;
não declarar C8 atendido nessa variante. Entrega dos próprios links de recuperação
continua separada: não persistir token puro em outbox por conveniência.

## 5. API, OpenAPI e cliente

`backendnest/swagger.yaml` é a autoridade estática declarada em
`backendnest/README.md:12-17`; atualizar contrato junto do comportamento.

- Manter `POST /auth/reset-password`, acrescentando campo obrigatório proposto
  `senhaAtual` a `novaSenha`. Encaminhar `req.user.sid` para revalidação. Manter
  sucesso 201 atual (não há `@HttpCode(200)` nessa rota) nesta etapa.
- Recuperação mantém `POST /auth/reset-password-token`, `{token,novaSenha}`,
  200 e `AUTH_PASSWORD_RESET_TOKEN_INVALID`/400 para inválido, expirado ou usado.
- Ausência/null/tipo errado/campos extras: 400 do ValidationPipe, envelope atual.
  Propor senha atual incorreta como `AUTH_CURRENT_PASSWORD_INVALID`/400 com campo
  `senhaAtual`, não 401 que dispararia refresh/limpeza indevida. Sessão revogada:
  401 `AUTH_INVALID_SESSION`; concorrência de hash: reautenticação necessária
  sem alteração. Fechar código/status exato deste último antes de implementar.
- Preservar `{success,data,timestamp,requestId}` e envelope de erro
  `{success:false,error:{code,message,field?,details?},timestamp,requestId}`.
  São definidos em `backendnest/src/common/dto/api-response.dto.ts` e filtro
  global; frontend desembrulha sucesso no cliente compartilhado.
- Formulário pede senha atual, senha nova e confirmação local; nunca persiste
  esses valores. Adaptar DTO/service/tela/testes juntos. Erro de senha atual
  mantém sessão e permite corrigir; sucesso limpa dados e navega ao login.
- Adicionar geração/epoch local da sessão: refresh captura geração e só modifica
  estado se ela e a identidade da sessão continuam iguais. Gating cobre sucesso
  (`saveToken`/`saveRefreshToken`) e falha (`catch`/`clearSession`), para não apagar
  login novo por falha tardia de refresh antigo. Limpeza/troca de identidade
  invalida respostas antigas; testar check+mutação serializado, não simples check
  seguido de awaits vulneráveis. Garantia local limitada ao runtime JavaScript
  coordenado; correção entre abas fica para etapa 2. Qualquer token de sessão
  revogada permanece sem autoridade no servidor, independentemente do storage.
- Clientes antigos sem `senhaAtual` falharão fechado. Distribuir cliente antes
  da exigência coordenada no servidor; não manter fallback sem prova atual.

## 6. Blast radius e análise independente

GitNexus `query`, `context` e `impact(direction: upstream)` consultados por
símbolo + arquivo. Índice de 2026-09-24, um commit atrás e sem garantia sobre WIP;
não atualizado nesta tarefa. Risco calculado do grafo não mede risco de segurança.

| Alvo | Chamador direto / fluxo afetado | Retorno do grafo |
|---|---|---|
| `AuthService.resetPassword` | `AuthController.resetPassword` | LOW; 1 dependente; nenhum processo indexado |
| `PasswordResetTokenRepository.consumeAndResetPassword` | `AuthService.resetPasswordWithToken` → controller | LOW; 2 dependentes; nenhum processo indexado |
| `AuthSessionRepository.createSession` | `AuthSessionsService.create` → `createTokensForUser` → `signIn` | LOW; 3 dependentes; nenhum processo indexado |
| `AuthService.signIn` | `AuthController.signIn` | LOW; 1 dependente |
| `AuthService.requestPasswordReset` | `AuthController.forgotPassword` | LOW; 1 dependente |
| `AuthSessionRepository.rotateIfActiveWithMatchingToken` | serviço de sessões → refresh → controller | LOW; 3 dependentes |
| frontend `authService.resetPassword` | `handleResetPassword`; processos RemoveItem/NotifyAuthStateListeners | LOW; 1 chamador, 2 fluxos reportados |

**Risco semântico alto:** credenciais e acesso de todos os usuários. Repetir
impact antes de editar qualquer símbolo futuro, incluindo novos alvos de storage,
DTO e delivery. Grafo sem processos backend não significa ausência de consumidores;
confirmar fonte/testes. Antes de commit futuro executar `detect_changes()`.

## 7. Unidades de trabalho: código, testes e docs juntos

| Unidade | Entrega e dependência | Evidência / rollback |
|---|---|---|
| U0 | Preflight seguro do harness + fixtures/barreiras determinísticas | Recusar alvo ambíguo sem conexão destrutiva; docs de execução; rollback só harness |
| U1 | Coordenação por usuário + invalidatedAt + recuperação/irmãos/login/refresh; remover revogação pós-commit | C2-C6/C10; migration e testes reais na unidade; rollback de código reabre vulnerabilidade |
| U2 | Senha atual + sid + transação autenticada + DTO/OpenAPI/formulário/epoch mínimo | C1-C7/C9; teste HTTP e tela; rollout coordenado, sem fallback inseguro |
| U3 | Contrato de notificação + outbox/worker/reenvio + runbook | C8-C9; falha/rollback/crash/deduplicação; parar worker não reativará acessos |
| U4 | Regressão, revisão de segurança e relatório de evidências | Invariantes completas; docs arquitetura/README/TESTES/validação atualizadas |

Não separar testes e docs do comportamento correspondente. Estimativa de linhas
ainda não medida; schema, API e cliente provavelmente exigirão várias fatias
revisáveis. Medir diff ao implementar; manter foco aproximado de 400 linhas por
fatia sem separar correção atômica de segurança. Não decidir PRs/branches/publicação
nesta tarefa. Commits futuros convencionais, sem atribuição de IA.

## 8. Plano de testes e segurança do ambiente

RED → GREEN → REFACTOR em cada unidade: escrever regressão, executar e guardar
falha pelo motivo correto; corrigir minimamente; executar testes focados e
regressões. Mocks provam delegação/validação, não locks, atomicidade ou isolamento.

| Camada | Cenários mínimos / observação |
|---|---|
| Unidade/DTO | senha atual ausente/null/errada/legada; nova senha inválida; token terminal; hash mudou; nenhum segredo em erros/logs |
| HTTP | envelopes/status/requestId/OpenAPI; autenticado sem sid válido; sucesso não retorna tokens; A isolado de B |
| PostgreSQL | tokens A e B: A consumido, B invalidado; troca autenticada invalida A/B; expirado/invalidado não escreve; rollback após consumo, senha, invalidação, revogação e outbox restaura estado completo |
| Concorrência | mesmo token duas vezes; irmãos distintos; troca×troca; login antigo pausa depois do bcrypt e retoma após commit; inverso login confirma antes e é revogado; pedido de link snapshot antigo×troca; refresh antes/depois da revogação; logout/limite continuam corretos |
| Cliente | senha atual errada não limpa sessão/não renova; sucesso limpa credenciais e usuário; sucesso tardio de refresh não grava após logout; falha tardia de refresh antigo não limpa login novo; essas garantias locais valem no runtime coordenado; outra aba com storage obsoleto continua sem autoridade no servidor; storage falha sem navegar como se estivesse limpo; timeout após possível commit orienta novo login, não repete troca automaticamente |
| Delivery | rollback não envia; crash pós-commit recupera evento; webhook timeout/5xx; claim entre workers; deduplicação; tentativas esgotadas/alerta; ausência de segredos |

Concorrência determinística: conexões PostgreSQL distintas, QueryRunners e
barreiras explícitas de promessa/instrumentação de teste antes/depois do lock
e commit. Não usar sleeps para criar interleaving; timeout apenas detecta travamento.
Overriding para barreira é permitido, mas operações SQL reais continuam reais.
Consultar estado final independente, quantidade de mudanças/eventos e capacidade
real de acessar rota protegida/renovar com cada token, não somente status HTTP.
Usar falha controlada de banco ou interceptação no manager da conexão real para
provar rollback, sem substituir transação por mock.

### Preflight obrigatório antes de E2E

`backendnest/test/e2e-database.ts:122-126` executa **DROP SCHEMA public CASCADE**.
O filtro `/test/i` em 166-171 aceita nomes perigosos e host/credenciais podem
vir de DB_* ou `.env` em 48-78. Nunca executar com configuração implícita.

Antes de qualquer execução destrutiva: exigir E2E_DB_* explícitos, servidor
descartável identificado/allowlisted, nome exato reservado à execução, usuário
sem acesso a dados reais e comprovação de identidade do destino. Recusar
production/staging/DB_NAME da aplicação, fallback e host não autorizado; validar
versão PostgreSQL, schema/migrations e permissões. Credenciais não entram no
relatório. Não executar suítes paralelas compartilhando o mesmo banco; `runInBand`
não protege de outro processo. Manter as migrations SQL existentes, synchronize
desligado e destruição restrita ao alvo comprovado. Testar a própria recusa do
harness sem tocar em banco real.

Comandos existentes, para futura execução após preflight (cwd indicado):

```text
backendnest/: npm test -- --runInBand --testPathPatterns=auth
backendnest/: npm run test:e2e -- --runTestsByPath test/auth-password-reset.e2e-spec.ts
backendnest/: npm run lint
backendnest/: npm run build
frontend/: npm test -- --runInBand
frontend/: npm run typecheck
```

`test:e2e` já inclui `--runInBand` em package.json. Focar suite nova por
`--runTestsByPath` somente quando arquivo existir. Selecionar testes frontend
relevantes antes da suite completa; não usar caminho inventado de auth-flow.
Dependências, banco e receptor de teste são pré-requisitos; nenhum install,
build, teste runtime ou banco foi executado nesta tarefa.

## 9. Evidência, rollout e decisões pendentes

Relatório futuro registra revisão Git/worktree, paths efetivos, comando/cwd,
versões e alvo sanitizado, RED e GREEN com códigos de saída, cenários/barreiras,
estado SQL antes/depois e falhas de rollback. Mapear C1-C10 a testes concretos.
Baseline quebrado deve ser separado de regressão causada; indisponível não é PASS.
Revisar sanitização, contrato, ordenação de locks e migrations com contexto fresco.

Rollout: backup e ensaio em banco descartável; migration aditiva antes do código;
cliente compatível antes da exigência; deploy sem mistura prolongada de versões
que ignoram `invalidatedAt`/locks; drain versões antigas ou janela coordenada.
Observar falhas, lock wait, volume de reset, sessões e backlog de notificações
com identificadores opacos. Não remover schema aditivo nem restaurar `usedAt`,
`invalidatedAt`, senha ou sessões revogadas durante rollback.

Rollback de app antigo pode ignorar invalidação e aceitar troca sem senha atual:
é downgrade de segurança, não reversão neutra. Preferir fix-forward; se necessário
bloquear temporariamente endpoints de troca/recuperação e exigir novo login.
Não reativar credenciais antigas para preservar disponibilidade.

Antes da implementação, fechar: códigos exatos do conflito de credencial;
contrato/operador do webhook de notificação; outbox confiável versus aceitação
expressa de perda best-effort; retenção/backoff/alerta; compatibilidade de clientes
publicados; alvo PostgreSQL realmente descartável. Opções são propostas técnicas,
não aprovações já dadas pelo usuário. Mudança segura de email continua dívida
explícita: um atacante que já mudou o email pode afetar recuperação/notificação.

### Resultado histórico da tarefa de planejamento

Uma verificação fresca e focada do plano identificou ambiguidades de proteção
de segredos, escopo entre abas, mutações tardias em falha de refresh e suposto
estado ativo de usuário. Uma única correção documental delimitou a entrega
autorizada do reset token, restringiu a garantia local ao runtime coordenado,
incluiu gating de limpeza tardia e preservou o modelo atual de usuário.
Resultado estrutural/documental, sem execução funcional ou afirmação de PASS.

- [x] Código atual inspecionado e fontes oficiais relacionadas ao desenho.
- [x] Impacto, invariantes, contratos, unidades e plano de evidências documentados.
- [ ] Implementação e migrations futuras.
- [ ] RED/GREEN, PostgreSQL, cliente, revisão e rollout futuros.

**A tarefa histórica de planejamento não produziu implementação nem PASS.**
O escopo atual de desenvolvimento foi implementado e verificado conforme o
status inicial e o relatório vinculado; produção permanece fora dessa aprovação.
