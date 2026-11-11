# Notificação de senha alterada: desenvolvimento seguro

## Fechamento da aplicação local — 2026-10-08

**Processo 1 concluído no escopo local autorizado: `0014` e `0015` aplicadas
atomicamente. Envio real continua bloqueado.** O transporte nativo Windows foi
corrigido usando `PGPASSFILE` temporário UTF-8 sem BOM, com ACL restrita e escape
de dois-pontos/barra invertida. Senha, permissões, HBA e serviço não mudaram.

Antes do DDL, o backup custom completo foi restaurado em uma base isolada: as
18 tabelas originais e suas contagens coincidiram. Essa cópia recebeu as duas
migrations e smoke tests dos repositories reais para troca autenticada e
recuperação, revogação, invalidação e evento atômico. Worker OFF, zero rede.
A cópia foi removida após conferir nome, OID e comentário exclusivos.

Backup retido na pasta protegida
`.tmp/app-credential-closure-04bf38ea9a864ee3ab516b9ce0c1d952/`:
`application-before.dump.dpapi`, cifrado com DPAPI CurrentUser e roundtrip de
hash aprovado. A recuperação depende do mesmo usuário e ambiente Windows;
não é cópia externa independente. Dump em texto claro e arquivo de senha
removidos. Não apagar essa pasta sem preservar um respaldo aprovado, nem
restaurar cegamente estados antigos de credenciais.

Catálogo da aplicação igual ao da cópia validada; contagens originais
preservadas, outbox vazia e coluna nova nula nos tokens existentes. Evidência
sanitizada: `evidence.json` na mesma pasta. As diferenças `0010`, `0011` e `0013`
continuam intocadas e fora do escopo. Os **172/172 testes** abaixo são a prova
anterior de desenvolvimento, não nova execução global. Consulte o
[resultado](../validacao/SEGURANCA_CREDENCIAIS_ETAPA_1_RESULTADO.md).

**Desenvolvimento concluído e verificado em 2026-10-08; envio real bloqueado.** A outbox grava
`PASSWORD_CHANGED` junto da troca/recuperação de senha. O worker começa desligado;
quando habilitado em development/test, termina em `simulated`, não `delivered`.
O adaptador HTTPS foi implementado para testes com fetch substituído; o runtime
não lê chave Resend e rejeita qualquer solicitação de habilitar envio real.
Prova final: **172/172 testes**, tipos backend de produção e revisão dos 18 paths
aprovados. Isso não aprova domínio, envio, privacidade/retenção ou produção.
`0014` e `0015` também foram aplicadas na aplicação local pelo fechamento acima;
não reaplicar. Nenhum commit, rollout de servidor ou deploy em produção foi feito.

## Caminho rápido

1. Na aplicação local confirmada, `0014` e `0015` já estão aplicadas: não
   reaplicar. Em outro destino, exigir aprovação, backup/restauração e schema
   compatível antes de ativar o código. Worker OFF não elimina a escrita do evento.
2. Manter `PASSWORD_CHANGED_WORKER_ENABLED=false` e
   `PASSWORD_CHANGED_RESEND_LIVE_ENABLED=false`. Não colocar chave no chat,
   frontend, repositório, outbox ou evidências.
3. Para simulação local deliberada: NODE_ENV development/test e worker true;
   live permanece false. Não existe endpoint público de drain/retry.
4. Rodar os testes abaixo somente com ambiente E2E explicitamente descartável.
   Nenhum teste pode acessar Resend; fetch é sempre substituído.

| Configuração | Comportamento |
|---|---|
| Ambos flags false (default) | Sem timer, claim, dispatch, purge ou leitura de API key |
| Worker true; live false; development/test | Claim durável e simulação local; não envia email |
| Live true ou valor inválido | Inicialização rejeitada; nenhuma leitura de API key ou rede |
| Worker true em production | Inicialização rejeitada |
| Sender | `onboarding@resend.dev` por padrão, apenas para payload simulado; sender+corpo congelados no primeiro claim |

Não há domínio verificado nesta etapa. Resend limita o domínio de testes ao
email da própria conta; **não redirecionar notificações dos usuários para o
proprietário da conta**. Ativação real exige outra autorização, domínio/recipient
permitido, chave backend revogada/rotacionada conforme política e prova de entrega.
Esse procedimento futuro não está habilitado por este código.

## Garantias e limites

- Senha, invalidacão de links, revogação e inserção da outbox usam o mesmo
  EntityManager. Se o evento não puder ser persistido, tudo reverte.
- Evento contém somente UUID, destinatário e instante; não senha, hash, token,
  JWT, nome ou dados financeiros. Outbox guarda email, portanto continua sendo
  dado pessoal e deve ter acesso restrito.
- Claim trava **uma linha** com `FOR UPDATE SKIP LOCKED`, grava payload exato,
  primeiro instante, tentativa e token de lease; confirma antes de qualquer I/O.
- Lease de 60 segundos; timeout HTTPS de 5 segundos; sem polls sobrepostos.
  Shutdown remove timer e aguarda o trabalho ativo. Crash permite reclaim, mas
  acknowledgement antigo exige token e lease ainda válidos.
- Acknowledgement trava a linha antes do relógio autoritativo; espera pelo lock
  não prolonga o lease. Estado/token/lease e limites de retry vêm da linha
  persistida, não do snapshot do worker; CAS rejeita acknowledgement obsoleto.
- Chave idempotente é `password-changed/{eventId}`; corpo, sender, subject,
  HTML/text e destinatário congelados não mudam entre retries/restarts.
- Resend retém chaves por **24 horas**; automação usa margem conservadora de
  **22 horas** desde a primeira tentativa reservada e no máximo **5 claims**.
  Crash pode consumir uma tentativa sem envio; preferimos limitar risco de
  repetição a prometer entrega sem evidência. Não existe garantia exactly-once.
- Backoff começa em 60 segundos e dobra. Retry-After numérico do endpoint fixo é
  limitado a uma hora; formato HTTP-date não é usado. 429 de rate-limit,
  5xx/network e conflito idempotente concorrente são temporários; quota,
  rejeição permanente ou corpo diferente com mesma chave exigem decisão.
- Após janela/budget/ambiguidade, estado `reconciliation` e alerta seguro. Não
  reenviar cegamente, alterar primeiro instante, gerar chave nova ou mudar
  payload. Falha de acknowledgement depois da aceitação conserva claim e chave.

Estados: `pending`, `claimed`, `simulated`, `delivered`, `failed`,
`reconciliation`. `delivered` significa aceitação pelo provedor, não leitura nem
entrega final na caixa. Runtime desta etapa produz somente `simulated`.

## Inspeção e retenção

Em conexão **local descartável autorizada**, consultar somente metadados seguros:

```sql
SELECT state, count(*) FROM password_changed_outbox GROUP BY state;
SELECT id, state, attempts, first_attempt_at, next_attempt_at,
       lease_until, last_safe_error, completed_at
FROM password_changed_outbox ORDER BY created_at LIMIT 50;
```

Não selecionar/exportar recipient/payload, chave ou corpo bruto do provedor para
logs/tickets. Alertas do worker são códigos fixos, sem dados pessoais.

Com worker ativo, somente `delivered/simulated` concluídos há mais de sete dias
são removidos automaticamente, depois da janela de idempotência. Pendentes,
falhados e reconciliação permanecem para decisão: **sem worker, não há purge e a
fila acumula**. Esta limitação é deliberada para desenvolvimento, não política
de retenção de produção. Em ambiente local descartável, a eliminação de dados
deve fazer parte do encerramento controlado do ambiente, sem apagar bases da
aplicação por conveniência. A política de produção ainda precisa ser aprovada.

Reconciliação é manual e privada: confirmar aceitação com o provedor quando
integração real existir; preservar evento e payload; registrar decisão antes de
qualquer nova tentativa. Nenhuma UI/API de retry ou reenvio automático fora da
janela foi criada. Não resetar leases de outros workers em produção.

## Recuperação por email continua separada

Este fluxo notifica **senha já alterada**, tanto troca autenticada como recuperação.
O envio do próprio link de recuperação continua usando o webhook existente
`PasswordResetDeliveryService`, sem alteração de contrato. Resend não passou a
enviar esses links. Token puro não foi colocado na outbox por conveniência.

## Provas e comandos

Backend (`backendnest/`):

```powershell
node node_modules/jest/bin/jest.js --runInBand src/auth --silent
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/password-changed-outbox.e2e-spec.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json
```

O segundo comando usa o preflight confirmado e destrói apenas o public da base
descartável específica. O writer não executou PostgreSQL nem criou/reiniciou
cluster nesta entrega; o verificador executou a prova em PostgreSQL isolado.
Mocks sozinhos não comprovam atomicidade: os **14/14 casos de outbox reais**
passaram, além de **9/9 fronteiras**, **4/4 reset** e **145/145 autenticação em
16 suites**. Tipos backend de produção aprovados; revisão independente dos
18 paths sem MustFix/ShouldFix causado pelo candidato.
Correção de 2026-10-08: regressão unitária lock→clock passou 12/12; o novo caso
de lease expirando durante espera pelo lock integra os 14 cenários PostgreSQL,
com prova real aprovada pelo verificador. A ordenação lock→clock e a rejeição
do mesmo token cujo lease expirou durante espera foram verificadas sem sleeps.

Comandos finais exatos e evidência sanitizada estão no
[relatório](../validacao/SEGURANCA_CREDENCIAIS_ETAPA_1_RESULTADO.md) e em
`.tmp/resend-development-final-verification/evidence.json`. Os 18 hashes foram
confirmados antes/depois das provas; snapshot funcional preservado antes deste
fechamento documental. Cluster encerrado, sem PID/listener; `.env` privado não
foi carregado, nenhuma chave lida, nenhuma requisição Resend/email real enviada.
Uma restrição inicial de inspeção do processo foi resolvida somente na fixture
autorizada, sem repetir checks funcionais aprovados. Baseline global e frontend
não reexecutados; TS2352 histórico de `orcamento.repository.spec.ts:35` permanece.
Próximo passo exige aprovação explícita de integração real; não é ativação automática.

Fontes oficiais consultadas em 2026-10-06:
[enviar email](https://resend.com/docs/api-reference/emails/send-email),
[idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys),
[classificação de erros](https://resend.com/docs/api-reference/errors).
