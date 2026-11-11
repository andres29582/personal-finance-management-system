# Auditoria do estado atual do sistema — 2026-10-15

## Resultado e prioridade

**O sistema possui controles relevantes de autenticação e integridade, mas ainda não tem prova suficiente para publicação irrestrita nem para entrega de um aplicativo móvel de produção.** Antes de avançar P4, a prioridade de produto é corrigir três invariantes: interpretação de valores monetários, alteração do tipo de categoria e atomicidade do cadastro. A preparação P4 congelada é uma fonte separada; seus resultados não validam automaticamente o código canônico atual.

O repositório implementa gestão financeira pessoal: contas, transações, transferências, categorias, orçamentos, metas, dívidas, planejamentos e relatórios, com autenticação e integração de previsão por ML. A carga assumida é de **vários usuários em aplicativo móvel**, sem capacidade, latência ou SLO medidos nesta auditoria.

Ordem recomendada, sem autorização implícita para execução:

1. Corrigir A01–A03, com regressões dos contratos financeiros e de cadastro; depois A07 e A09.
2. Consolidar as identidades de fonte e a rota sanitizada de CI (A04–A06), preservando o WIP; só então executar a prova remota P4 autorizada.
3. Qualificar o aplicativo atual em Android e/ou iOS e definir a entrega instalável (A11–A12). Tratar escala (A08/A10), e-mail real, migrations e operação de produção como frentes explícitas, não como resultados já obtidos.

## Escopo e método

Auditoria estática consolidada de três inspeções somente leitura: backend/finanças, cliente móvel/sessão e entrega/CI/Git. Foram rastreados os fluxos de autenticação, escrita financeira, leitura de saldos, sessão do cliente, entrada monetária e os pontos operacionais de P4. Foram conferidos manifestos, configuração, testes como fonte e registros históricos de evidência.

**Não houve novos testes, builds, instalações, inicialização de serviços, acesso ao banco da aplicação, execução de CI, publicação, commit ou alteração remota.** A única alteração desta consolidação é documental. Casos abaixo são demonstrados pelo fluxo do código, não por novas reproduções executadas.

- GitNexus indisponível: grafo, impacto e frescor do índice permanecem **UNKNOWN**; não houve reindexação.
- Não é auditoria de todas as linhas, certificação de segurança, teste de invasão ou avaliação da precisão dos modelos ML.
- Ausência de configuração rastreada não prova ausência de infraestrutura externa. Nenhum segredo ou configuração privada foi necessário.
- Data de referência: 15/10/2026, conforme o contexto da sessão. Horários de outros ambientes não redefinem essa data.

## Inventário e arquitetura observada

| Camada | Estado observado | Limite da conclusão |
|---|---|---|
| API | `backendnest/`: NestJS 11, TypeORM, PostgreSQL; contrato em [swagger.yaml](../../backendnest/swagger.yaml) | Código e contrato não comprovam deploy atual |
| Persistência | 17 migrations SQL, `0001` a `0017`, em [migrations](../../backendnest/migrations/) | Arquivos presentes não provam aplicação em qualquer banco |
| Segurança backend | Autoridade de sessão SID no banco; revogação; locks ordenados usuário/sessão; tempo PostgreSQL após lock; consumo de reset, alteração de senha, invalidação de links, revogação e outbox atômicos | Controles inspecionados não equivalem a certificação ou nova prova de concorrência |
| Escritas financeiras | Seleção por proprietário e validações de recursos nas transações | A02 permanece um caminho independente que quebra a compatibilidade de tipos |
| Cliente | Expo Router e módulos por domínio; SecureStore nativo, localStorage web, envelope e geração de sessão, refresh único compartilhado, tombstones de logout e confirmação de autoridade ao retornar ao foreground | Testes web/mocks não comprovam lifecycle ou armazenamento em dispositivo real |
| ML | `ml-finance-tcc/`: FastAPI, inferência, treinamento e pytest; Docker Python 3.11; dependências em intervalos, sem lock equivalente ao npm | Precisão, drift, segurança completa e carga não avaliados |
| Operação | Docker backend Node 22 não-root; não identificados Compose, workflow de deploy ou destino de produção com rollback definido no escopo rastreado | Não demonstra inexistência de operação externa |
| Notificações | Worker/outbox de mudança de senha e adaptador Resend presentes | Caminho inspecionado é mock de desenvolvimento, rejeita modo live e usa `networkEnabled: false`; entrega real continua pendente |

Referências de contexto: [arquitetura backend](../arquitetura/BACKEND.md), [frontend](../arquitetura/FRONTEND.md), [ML](../arquitetura/MACHINE_LEARNING.md), [runbook](../operacao/RUNBOOK.md) e [controles U5 antes de deploy](../operacao/SESSOES_U5_DEPLOYMENT.md).

### Fontes que não podem ser confundidas

| Identidade | Estado no momento da inspeção |
|---|---|
| `main` público, conferido pela inspeção de entrega | `e9ee0db68bd318942a826cfee4fb0e36850a998a` |
| Branch local | `codex/frontend-architecture-incremental`, HEAD `c78636e0e65f8ea4bb5ccc917855685df0240a97` |
| Divergência Git | 35 commits somente em `main`; 29 somente no HEAD local. Não é uma fila linear pronta para push |
| Árvore local antes deste relatório | 919 arquivos rastreados; 128 modificados, 1 excluído; 146 arquivos não rastreados (89 entradas colapsadas); nenhum staged |
| Ignorados | 46 entradas colapsadas visíveis; **não é contagem de arquivos**. Total exato indisponível por diretórios sem acesso e caminhos longos |
| Cliente canônico atual | Expo `57.0.23`, React Native `0.86.3`, React `19.2.3`, conforme manifests/lock |
| Cliente congelado P4 | Expo `54.0.33`, React Native `0.81.5`, React `19.1.0`; não qualifica o upgrade atual |
| Runtimes locais registrados | Node `24.14.0`, npm `11.9`, Python `3.14.3`; CI usa Node 22/Python 3.11. Compatibilidade real não foi requalificada aqui |

Os números da árvore são o retrato **anterior** à criação deste documento. Não autorizam merge, rebase, reset ou publicação em massa. O P4 canônico em `.github/workflows/p4-proof.yml` e `backendnest/test/session-harness/` **não contém automaticamente** os ajustes exclusivos do candidato privado congelado.

### Identidade do candidato P4 privado

Diretório local: `.tmp/p4-isolated-preparation-final-20261015/snapshot`. A inspeção de entrega reconferiu os hashes dos documentos de prova; esta consolidação não recalculou individualmente os 1.001 arquivos.

| Registro | SHA-256 / contagem |
|---|---|
| Identidade das fontes (`candidateSourceSha256`) | `efe88b52e9fee8b67e2574dd7e6d1683cb985085fdea86af50402df215a555b9` |
| `publication-manifest.json` | `8e380dedf1cacddcff0126f93866ae61f4ed6ebca8075cf579d72a6698d19822` |
| `summary.json` | `39148a37dfd8a534e8487b908e50ad15ce8003e0037d900c2742997b640e5712` |
| `artifact-proof.json` | `54a5674f9022b58585fad3f0008e36ba92fd4f45b1d16a152b312cac80a689a5` |
| Manifesto completo | 1.001 arquivos: 143 alterados/adicionados e 858 reutilizados; 10 exclusões registradas separadamente |
| Inventário U6 | 791 entradas; não é o manifesto completo |

Esses artefatos são privados e locais, não entregáveis públicos deste relatório. Hash identifica bytes; não certifica segurança nem execução remota.

## Achados priorizados

Severidade mede consequência; confiança mede força da evidência. **Alta** indica fluxo/condição diretamente verificável; não significa reprodução nova. A11 e A12 são gates de entrega, não defeitos nativos confirmados. Os IDs A01–A12 não são as etapas históricas P1–P4.

### Correções necessárias

#### A01 — Alta · confiança alta — Agrupamento monetário pode reduzir o valor enviado

- **Caso e evidência:** `1.234.560` é aceito pela expressão de entrada, mas o último ponto vira separador decimal; o resultado é `1234.56`, não `1234560`. Ver [number-input.ts:4–7,24–61](../../frontend/utils/number-input.ts), [TransacaoFormScreen.tsx:174–224](../../frontend/src/modules/transacoes/screens/TransacaoFormScreen.tsx) e [transacaoService.ts:21–25](../../frontend/src/modules/transacoes/services/transacaoService.ts). O valor continua positivo, finito e com duas casas, atendendo ao [DTO:26–29](../../backendnest/src/transacoes/dto/create-transacao.dto.ts).
- **Correção mínima e tradeoff:** reconhecer agrupamentos completos antes de interpretar decimais; testar o parser compartilhado e o payload do formulário. Uma política explícita de formatos pode rejeitar entradas ambíguas, em vez de adivinhá-las. O helper também alcança contas, transferências, orçamentos, metas, dívidas e planejamentos.
- **Se adiar:** uma entrada válida visualmente pode criar uma operação com montante incorreto. Não foi alegada ocorrência em dados reais.

#### A02 — Alta · confiança alta — Alterar o tipo da categoria invalida referências históricas

- **Caso e evidência:** uma categoria usada em despesa pode virar receita. [UpdateCategoriaDto:9–11](../../backendnest/src/categorias/dto/update-categoria.dto.ts), [CategoriasService:90–97](../../backendnest/src/categorias/categorias.service.ts) e [repositório:45–50](../../backendnest/src/categorias/repositories/categoria.repository.ts) não impedem isso. A transação anterior fica incompatível com a categoria e até uma edição apenas de descrição encontra a validação de tipo em [TransacoesService:137–146,236–244](../../backendnest/src/transacoes/transacoes.service.ts).
- **Correção mínima e tradeoff:** tornar o tipo imutável após criação é mais simples, mas remove a edição de categorias ainda sem uso. Preservar essa edição exige checagem de referências e sincronização de locks para não abrir corrida com novas escritas.
- **Se adiar:** operações históricas podem deixar de ser editáveis e a classificação perde coerência; isso não demonstra corrupção observada do ledger.

#### A03 — Alta · confiança alta — Falha no seed pode deixar cadastro parcialmente criado

- **Caso e evidência:** [AuthService:149–164](../../backendnest/src/auth/auth.service.ts) salva o usuário antes de criar categorias. [UsersService:32–33](../../backendnest/src/users/users.service.ts) e [BaseRepository:41–42](../../backendnest/src/common/abstract/base.repository.ts) persistem sem a mesma transação do [seed:134–150](../../backendnest/src/categorias/categorias.service.ts). Se o seed falhar, a resposta é erro, mas a repetição encontra e-mail já cadastrado (`AuthService:131–137`).
- **Correção mínima e tradeoff:** compartilhar uma transação/EntityManager para usuário e categorias e provar rollback. A unidade transacional fica maior, mas elimina recuperação manual de um cadastro incompleto.
- **Se adiar:** o usuário recebe falha de cadastro e não consegue repetir normalmente; não se afirma que essa falha já ocorreu em produção.

#### A04 — Alta · confiança alta — O P4 canônico não está preparado para a execução Linux proposta

- **Caso e evidência:** [u6-owned.spec.cjs:40–42](../../backendnest/test/session-harness/u6-owned.spec.cjs) exige `win32` incondicionalmente, enquanto [p4-ci.cjs:165–170](../../backendnest/test/session-harness/p4-ci.cjs) inclui essa seleção no Ubuntu. Além disso, [workflow:65–84](../../.github/workflows/p4-proof.yml) instala apenas backend, mas [u5-poll.spec.cjs:5](../../backendnest/test/session-harness/u5-poll.spec.cjs), chamado por [u6.cjs:80–83](../../backendnest/test/session-harness/u6.cjs), exige Playwright do frontend.
- **Correção mínima e tradeoff:** convergir para um candidato exato revisado, com ferramentas bloqueadas e aplicabilidade por plataforma explícita. O congelado possui instalação dedicada Playwright `1.64`, namespace e dois casos Windows não aplicáveis; não copiar todo o frontend antigo para recuperar esses ajustes.
- **Se adiar:** a instalação limpa/seleção proposta não dispõe das precondições necessárias. É diagnóstico estático do canônico, não registro de uma execução remota FAIL do congelado.

#### A05 — Alta · confiança alta — Publicar pode disparar CI fora do contrato fechado P4

- **Caso e evidência:** [ci.yml:10–11](../../.github/workflows/ci.yml) reage a todo push/PR e possui quatro jobs: frontend, backend, E2E e ML. O E2E explicita 15 minutos (`:127`); os demais não têm cap próprio do repositório. Seus logs ordinários não seguem a allowlist sanitizada de P4.
- **Correção mínima e tradeoff:** revisar e aprovar uma rota automática de CI sanitizada e com orçamento explícito antes da publicação. Isso exige trabalho de configuração, mas evita expor logs/custo incidental; não é recomendação de desligar, pular ou contornar checks.
- **Se adiar:** um push pode iniciar outros jobs antes da execução manual pretendida. Falta de cap próprio não significa duração infinita; não foi constatado vazamento real de dados.

### Melhorias necessárias e gates condicionais

#### A06 — Média · confiança alta — O servidor não exige os controles de integração

- **Caso e evidência:** a inspeção somente leitura do GitHub encontrou `main` com `protected: false` e lista de rulesets vazia. Portanto, a política local não impede por si só push direto sem CI aprovada.
- **Correção mínima e tradeoff:** com aprovação explícita do proprietário, definir proteção/ruleset, PR e checks obrigatórios compatíveis com a rota de CI. Isso reduz liberdade de push e exige administrar exceções; nada foi alterado pela auditoria.
- **Se adiar:** o fluxo depende da disciplina de quem possui permissão. A ausência de issue P4 encontrada não foi convertida em requisito técnico de enforcement.

#### A07 — Média · confiança alta — Somas de leitura usam ponto flutuante binário

- **Caso e evidência:** [ContasService:212–244](../../backendnest/src/contas/contas.service.ts) e [DashboardService:74,112–115,134–139](../../backendnest/src/dashboard/dashboard.service.ts) somam `number`; o [transformer da transação:31–34](../../backendnest/src/transacoes/entities/transacao.entity.ts) converte decimal em número. A soma de `0.10` e `0.20` pode retornar `0.30000000000000004` na resposta.
- **Correção mínima e tradeoff:** somar centavos inteiros com limites de segurança verificados e regressões da resposta. Exige conversão disciplinada nas fronteiras; arredondar apenas na UI mascara o contrato, não o corrige.
- **Se adiar:** totais expostos podem conter resíduos numéricos. O PostgreSQL decimal não foi demonstrado corrompido.

#### A08 — Média · confiança alta — Saldo carrega o histórico e repete varreduras por conta

- **Caso e evidência:** [ContaRepository:73–85](../../backendnest/src/contas/repositories/conta.repository.ts) materializa transações e transferências; [ContasService:206–245](../../backendnest/src/contas/contas.service.ts) filtra/reduz por conta. O custo é `O(A × (T + R))`, para A contas, T transações e R transferências. A leitura individual também busca transferências do usuário; [DashboardService:26–27](../../backendnest/src/dashboard/dashboard.service.ts) reutiliza o caminho.
- **Correção mínima e tradeoff:** agregar no SQL, agrupando por conta e proprietário e incluindo comissões. Reduz tráfego/memória, mas exige provar equivalência dos sinais, exclusões e taxas.
- **Se adiar:** custo aumenta com o histórico mesmo para uma tela resumida. Não há medição que permita declarar latência, limite de usuários ou falha de capacidade atual.

#### A09 — Média · confiança alta — Requisições comuns não têm prazo finito da aplicação

- **Caso e evidência:** [api.ts:25–42](../../frontend/src/shared/services/api.ts) cria o cliente comum sem timeout. Login e escrita financeira usam esse cliente ([authService.ts:10–12](../../frontend/src/modules/auth/services/authService.ts), [transacaoService.ts:21–32](../../frontend/src/modules/transacoes/services/transacaoService.ts)); o formulário mantém estado de salvamento ([TransacaoFormScreen:203–238](../../frontend/src/modules/transacoes/screens/TransacaoFormScreen.tsx)). Os caminhos limitados de refresh/logout/autoridade não limitam essas operações.
- **Correção mínima e tradeoff:** prazo compartilhado finito e UX de resultado indeterminado para escrita. Uma interrupção não comprova rollback; não adicionar retry automático que possa duplicar transações.
- **Se adiar:** conectividade degradada pode manter login ou salvamento aguardando sem deadline da aplicação.

#### A10 — Média, condicional · confiança alta — Limite HTTP não é compartilhado entre instâncias

- **Caso e evidência:** [AppModule:97–107](../../backendnest/src/app.module.ts) usa o armazenamento padrão do throttler, baseado em Map de processo. [AuthController:92–103](../../backendnest/src/auth/auth.controller.ts) define login 10/min e recuperação 5/min; com duas instâncias há dois orçamentos, e reinício perde o estado.
- **Correção mínima e tradeoff:** antes de escala horizontal, compartilhar o limite no ingresso ou armazenamento adequado. Traz dependência operacional, mas não exige obrigatoriamente Redis no backend. A reautenticação U5 já tem orçamento no banco ([AuthSessionRepository:147–188](../../backendnest/src/auth/repositories/auth-session.repository.ts)).
- **Se adiar:** a proteção HTTP muda conforme a topologia. Não é alegação de que todos os controles de sessão sejam locais nem de que já exista produção multi-instância.

#### A11 — Gate de entrega · confiança alta — A prova atual não qualifica o aplicativo nativo atual

- **Caso e evidência:** [authStorage.test.ts:5,54–94](../../frontend/__tests__/storage/authStorage.test.ts) usa mocks nativos; [configuração browser U4](../../frontend/playwright.u4.config.ts) e [dashboard de fixture:3–5](../../frontend/tests/browser/u4/app/dashboard.tsx) não representam a UI financeira nativa completa. [U3:94,214–218](SEGURANCA_SESSOES_ETAPA_2_U3_RESULTADO.md) e [U4:390,408,464,481](SEGURANCA_SESSOES_ETAPA_2_U4_RESULTADO.md) registram pendências de lifecycle/native.
- **Correção mínima e tradeoff:** validar o build atual nas plataformas escolhidas: SecureStore, relançamento, foreground/background, deep links, conectividade e resultado de escrita financeira. Dispositivo/emulador e roteiro reproduzível têm custo, mas web PASS não substitui essa prova. Maestro/Detox não são impostos.
- **Se adiar:** bugs específicos do produto móvel podem alcançar a entrega sem detecção. A lacuna de prova não é um bug nativo confirmado; validações manuais antigas de cadastro não qualificam a versão atual inteira.

#### A12 — Gate de entrega · confiança alta — Identidade e distribuição instalável não estão definidas na fonte auditada

- **Caso e evidência:** [app.json:3–24](../../frontend/app.json) usa nome/slug/scheme `frontend`, sem Android package ou iOS bundle identifier. [package.json:5–18](../../frontend/package.json) oferece scripts de desenvolvimento; não foram encontrados configuração de release rastreada, `eas.json` ou projetos nativos rastreados no escopo.
- **Correção mínima e tradeoff:** definir plataformas, identificadores, endpoint HTTPS, build e distribuição reproduzíveis. A escolha pode ser local ou serviço de build; EAS e pastas nativas commitadas não são requisitos universais.
- **Se adiar:** executar no Expo/desenvolvimento não produz, por si só, uma entrega instalável identificada e distribuível.

## Matriz de provas e pendências

| Frente | Evidência disponível | Estado que não pode ser inferido |
|---|---|---|
| P3 local | Registros históricos delimitados de 7/23 casos; provas U5/U5D 10/10 separadas | Não é nova execução atual de 8/8, nem encerramento de todo P3 |
| Congelado P4 local | Histórico: seis seleções offline PASS, U6 40, P4 17, configuração 107, deployment 8, tipos e polling | Não transfere PASS ao canônico nem ao frontend atualizado |
| P4 remoto | Preparação/documentação em [P4 CI](SEGURANCA_SESSOES_ETAPA_2_P4_CI.md) | Linux, instalação limpa, PostgreSQL 16 e E2E remotos **NOT_TESTED** |
| U3/U4/U5/U6 | Implementações e provas locais delimitadas; ver [U5](SEGURANCA_SESSOES_ETAPA_2_U5_RESULTADO.md) e [U6](SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md) | Não encerram etapa 2, lifecycle/BFCache/native, carga ou produção |
| Testes backend em fonte | 93 arquivos spec em `src`, 34 E2E na raiz de `test`, 4 spec TS e 7 spec CJS na harness | São contagens de arquivos, **não testes aprovados**, cobertura ou execução nova |
| E-mail real | Outbox/worker e mock de desenvolvimento documentados em [Resend](../operacao/RESEND_DESENVOLVIMENTO.md) | Integração live, envio e recebimento não comprovados |
| Migrations e produção | SQL e precheck manual presentes; [gate U5](../operacao/U5_PREDEPLOY_CHECK.sql) | Nenhuma aplicação de migration, readiness automática, hospedagem, TLS ou rollback de produção comprovado |

A aprovação de uma política de artefatos públicos — sete dias para artefato e logs de 90 dias sob custódia do proprietário — não equivale a autorizar este commit, publicação ou execução. O rótulo histórico `PUBLICATION_UNAPPROVED_REMOTE_NOT_TESTED` do snapshot não é uma autorização atual. Publicação, execução e leitura independente do artefato exigem seu próprio fechamento.

## Encaminhamento

**Veredito:** corrigir primeiro os invariantes A01–A03 e manter P4 remoto e entrega móvel como gates separados. As correções de produto podem ser preparadas independentemente da infraestrutura P4, mas nenhuma implementação foi autorizada ou realizada nesta auditoria.

Não se recomenda uma reescrita arquitetural, troca de stack ou framework adicional: os ajustes propostos atacam contratos e fronteiras existentes. Não há estimativa de linhas/dependências removíveis sustentada pela inspeção.

**Não verificado:** dados reais, migrations aplicadas, runtime atual completo, dispositivos nativos atuais, CI remota P4, produção, e-mail live, desempenho sob carga, precisão ML e todas as superfícies de vulnerabilidade. Este relatório não substitui o Swagger nem os registros de cada unidade de prova.


<a id="acompanhamento-local-2026-10-21"></a>
## Acompanhamento local — 2026-10-21

Este acompanhamento registra correções autorizadas posteriormente à auditoria estática de 15/10. O texto e as contagens anteriores são históricos; não foram substituídos por uma declaração de atendimento integral. A fonte permanece a árvore local com WIP, no HEAD `c78636e0e65f8ea4bb5ccc917855685df0240a97`, sem commit, staging ou publicação destas unidades. Não houve instalação, serviço da aplicação, acesso a banco real, execução de migração ou E2E destrutivo.

### Correções implementadas e alcance

- **A01 — correção local com regressões:** o parser reconhece agrupamentos completos repetidos antes do fallback decimal, preservando a política anterior para separador único. Comissão opcional só assume zero quando vazia; texto inválido/negativo é recusado. Limites compatíveis com o armazenamento canônico foram adicionados a 17 DTOs/24 campos, incluindo saldo inicial assinado. A entidade de transferência foi alinhada a numeric(14,2) da baseline; o esquema efetivamente implantado não foi consultado.
- **A09 — correção técnica parcial:** cliente comum com prazo padrão de 15 s, preservando deadlines explícitos mais curtos e cercas de autoridade. Não é SLO nem retry automático de escrita. Transferência com timeout/transporte/5xx informa resultado desconhecido e orienta conferir histórico.
- **Intenção de transferência:** UUID opcional apenas no POST; payload canônico original e chave retidos no cliente após incerteza. No servidor, unicidade por usuário/chave, inserção atômica por conflito e comparação com impressão original imutável; replay compatível retorna a mesma identidade sem novo evento de criação. Divergência ou registro excluído retorna 409, sem ressurreição. Replay é resolvido antes de exigir contas atualmente ativas. PATCH não altera a intenção original. Projeções públicas excluem chave/impressão internas, inclusive em entidades recém-criadas. POST legado sem chave conserva comportamento anterior, sem promessa global de exactly-once.
- **Rascunhos:** transferência/transação e outros 11 formulários existentes (pagamento por dívida, conta criar/editar, categoria, dívida, meta, orçamento, alerta, planejamento criar, participante e gasto). Somente campos editáveis; owner contém incarnation/sessionId/generation, não credenciais ou snapshot de sessão. Suspensão oculta e conserva memória até reconfirmação do mesmo owner; logout/revogação/mudança de geração ou identidade invalida. Refresh não descarta o rascunho. GET/defaults hidratam em grupo sem sobrescrever edição/restauração. Sucesso/cancelamento explícito limpa; unmount isolado não limpa. Respostas obsoletas não escrevem nem navegam em outra instância. Pagamento conserva seu reset visível anterior de valor/descrição, data e seleções. Encerramento do processo perde o rascunho por projeto; não existe promessa de armazenamento durável/TTL.
- **Históricos:** páginas reais de 50 por limit/offset em transações e transferências; API de transferências aceita limit de 1 a 100 (padrão 50), offset não negativo e ordem estável por data/createdAt/id. Filtros reiniciam página; exclusão que esvazia página posterior permite recuo. Guardas de requisição/foco/owner cobrem ramos assíncronos. Envelopes de array e projeção pública foram preservados.
- **Móvel:** campos de pagamento com nomes/dicas/erros contextuais e alerta; confirmação de sessões com SafeAreaView, KeyboardAvoidingView e ScrollView próprios, sem afrouxar senha/sessão. Quick actions usa Modal transparente, Voltar/escape, entrada de foco e retorno somente para origem válida: iOS aguarda onDismiss, Android usa pós-commit; callbacks antigos não retornam foco após reabrir/navegar/unmount. Mantida a contenção web existente, sem segunda implementação de trap.
- **Contrato:** Swagger local reconciliado com GET /auth/session, POST /orcamentos/{id}/categorias e PATCH/DELETE /orcamentos/{id}/categorias/{allocationId}, seis schemas associados, limites monetários, consulta paginada e chave opcional/409 de transferência. Isso corrige as antigas afirmações de ausência em RF-AUTH-11, RF-ORC-04, CU-ACESSO-02, CU-ORC-02, D-CONTRATO e fonte-orcamentos; não cria interface de alocações nem aceite de produto.

A02 (tipo de categoria), A03 (cadastro atômico), A04–A06 (identidades/CI), A07 (agregações em ponto flutuante), A08 (custo de saldo/carga), A10 (limite multi-instância), A11 e A12 **não são declarados corrigidos por estas unidades**. Paginação não mede carga nem encerra A08. As 18 qualidades têm [matriz individual de implementação/evidência/limite](../produto/REQUISITOS.md#rnf-acompanhamento-local); propostas e decisões de baseline continuam pendentes.

### Prova local executada

Todos os comandos abaixo são locais e focalizados. Contagens de execuções sobrepostas não devem ser somadas como cobertura única. Mocks não comprovam transação PostgreSQL, HTTP real, leitor de tela ou dispositivo. Tipos foram executados com noEmit/incremental false; não foi emitido buildcache.

| Registro | Diretório e comando exato | Resultado e alcance |
| --- | --- | --- |
| L01 — monetário | frontend: `npm test -- --runInBand --runTestsByPath __tests__/utils/number-input.test.ts __tests__/formatters.test.ts src/modules/transferencias/__tests__/transferencias-form.test.tsx` | Unidade monetária: exit 0, 3 suítes/37 testes; após normalização do bloco novo, formulário 12/12. RED anterior incluiu 7 falhas comportamentais e um timeout de carga fria separado. |
| L02 — limites/escala | backendnest: `npm test -- --runInBand --runTestsByPath src/common/monetary-bounds.spec.ts src/common/monetary-scale.validator.spec.ts` | Unidade monetária: exit 0, 2 suítes/83 testes. RED de limites: 26 falharam/57 passaram; máximos, máximo+1, saldo assinado, escala e não finitos. |
| L03 — transferência/histórico | backendnest: `npm test -- --runInBand --runTestsByPath src/transferencias/history-pagination.spec.ts src/transferencias/transfer-intent.spec.ts src/transferencias/transferencias.service.spec.ts src/transferencias/transferencias.controller.spec.ts` | Unidade de histórico: exit 0, 4 suítes/39 testes (11/10/13/5). Inclui DTO/query/projeção e replay/conflito/usuários/alteração/exclusão/conta inativa mockados; não executa concorrência SQL real. |
| L04 — cercas/intenção/rede | frontend: `npm test -- --runInBand --testTimeout=15000 --silent --runTestsByPath __tests__/services/financialDraftForms.test.tsx __tests__/services/financialDraftHook.test.ts __tests__/services/historyRequestFence.test.ts __tests__/utils/transferIntent.test.ts __tests__/services/api-deadline.test.ts src/modules/transferencias/__tests__/transferenciaService.test.ts` | Unidade de histórico: exit 0, 6 suítes/35 testes, 52,655 s. Inclui deferred400/remount, resposta de sucesso obsoleta, intenção estável, prazo explícito e ausência de replay automático. |
| L05 — cobertura final/Modal | frontend: `npm test -- --runInBand --testTimeout=15000 --silent --runTestsByPath __tests__/services/financialDraftCoverage.test.tsx __tests__/services/financialDraftForms.test.tsx __tests__/services/financialDraftHook.test.ts src/shared/ui/__tests__/QuickActionsMenu.test.tsx` | **Após a última correção de cancelamento:** exit 0, 4 suítes/36 testes, 39,545 s (21/6/2/7). Onze adapters com campos representativos, cinco exclusões readonly, toggles funcionais, invalidação de intenção sem registro, sucesso/cancelamento e foco Modal. |
| L06 — formulários existentes | frontend: `npm test -- --runInBand --testTimeout=15000 --silent --runTestsByPath src/modules/contas/__tests__/contas-form.test.tsx src/modules/categorias/__tests__/categoria-form.test.tsx src/modules/dividas/__tests__/dividas-form.test.tsx src/modules/metas/__tests__/metas-form.test.tsx src/modules/orcamentos/__tests__/orcamentos-form.test.tsx src/modules/alertas/__tests__/alertas-form.test.tsx src/modules/pagos-divida/__tests__/pagos-divida-screen.test.tsx src/modules/planejamentos/__tests__/planejamentos-form.test.tsx src/modules/planejamentos/__tests__/planejamentos-participante-form.test.tsx src/modules/planejamentos/__tests__/planejamentos-gasto-form.test.tsx` | **Exit 1**, 9 suítes passaram/1 falhou; 96 testes passaram/2 falharam, 135,406 s. Pagamento: primeiro render permaneceu em loading no waitFor; asserção antiga de clearSession em 401 também falhou. Sem enfraquecer asserções ou alterar o resolvedor global. Execução anterior ao único ajuste final de Voltar, coberto em L05. |
| L07 — diagnóstico isolado | frontend: `npm test -- --runInBand --testTimeout=15000 --silent --runTestsByPath src/modules/pagos-divida/__tests__/pagos-divida-screen.test.tsx --testNamePattern="renders payment form and existing payment history"` | Asserções inalteradas: exit 0, 1 passou/8 filtrados, 15,437 s. A falha de loading em L06 fica registrada como evidência transitória de timing, não como prova de causa nem PASS da suíte inteira. |
| L08 — tipos frontend | frontend: `npm run typecheck -- --incremental false` | Exit 0 após última correção/normalização de código. |
| L09 — tipos backend | backendnest: `node node_modules/typescript/bin/tsc --noEmit --incremental false --project tsconfig.localhost.json` | Exit 0 na unidade de histórico; nenhum backend foi alterado na unidade final de adapters. |

Outras provas focalizadas da unidade de histórico: transações (2 casos de páginas/foco), transferências (2 casos após corrigir somente fixture), confirmação de sessões (5 testes) e nomes/erros de pagamento (1 caso) passaram nos escopos executados. Isso não afirma PASS das suítes completas de histórico/pagamento. As asserções antigas de 401 também esperam clearSession em históricos, embora o resolveApiError preservado apenas mapeie a resposta; esse desacordo de teste continua explícito.

**RED preservado e correções de harness:** o antigo setter de formulário A sobrescrevia a edição 200 de B com 100 após resposta 400; a regressão falhou antes da correção. Native Modal falhou por ausência de escape/lifecycle iOS antes do ajuste desta unidade (2 falhas, 1 caso Android já passava); final L05 conserva as exigências. A extensão de clear sem registro falhou antes de invalidar a intenção. O cancelamento de pagamento falhou com valor 43 ainda retido, então recebeu somente clear antes de replace e passou em L05. O orçamento padrão de 5 s de um teste de intenção falhou; 15 s foi usado como orçamento de harness, sem alterar assertions ou o deadline de API de 15 s. Uma execução anterior de dez caminhos foi interrompida durante hang de fixture de foco nativo; refs nativas distintas corrigiram o fixture, não o comportamento esperado. Nenhuma dessas execuções incompletas foi contada como GREEN global.

### Identidade, análise estática e limites

Atribuição usa buffers exatos anteriores a cada unidade, não todo o diff contra HEAD: monetário 25 arquivos (+280/−9), core 21 arquivos e histórico/móvel 30 arquivos (+775/−172); a unidade final de adapters/docs tem manifesto próprio de hashes antes/depois. WIP preexistente e bytes fora das alterações autoradas não são atribuídos às correções. Não houve reversão integral de arquivos sujos.

GitNexus voltou a funcionar por reconstrução nativa index-only, sem embeddings/injeção em AGENTS/CLAUDE/skills. No índice usado para as últimas análises: 1.097 arquivos, 7.138 símbolos, 18.812 relações e 300 fluxos. Impactos upstream reais foram obtidos antes das edições e confrontados com os callers atuais; os novos adapters/helpers foram LOW. Riscos CRITICAL do parser, menu/navegação e resolvedor de erro, e HIGH de entidade/DTO/hook, foram comunicados antes do respectivo escopo. O resolvedor global não foi alterado. Hashes de AGENTS.md, CLAUDE.md e skill-registry permaneceram preservados; esse grafo não substitui teste runtime.

- **Migração 0018_transfer_create_intent.sql: NOT_APPLIED.** Inclui chave/impressão pareadas e unicidade por usuário inclusive após exclusão lógica. O rollout de backend depende da aplicação autorizada da migração e da verificação do esquema de destino. Não foi alterado banco da aplicação.
- **Concorrência de banco: NOT_RUN.** O spec preparado transfer-intent-concurrency.e2e-spec.ts está desabilitado explicitamente; unicidade/SQL e mocks não comprovam a corrida em PostgreSQL implantado.
- **Acessibilidade, teclado e plataformas reais: NOT_RUN.** TalkBack, VoiceOver, foco efetivo, teclado aberto, safe areas, texto ampliado, orientação, foreground/background, relançamento e deep links precisam de matriz aprovada e execução em dispositivos. Mocks de iOS/Android não recebem rótulo de PASS nativo.
- **Operação e escala: NOT_RUN.** Sem deploy, build instalável, CI remota, carga/percentis/SLO, backup/restauração, rollback ou entrega de e-mail real. Não houve revisão integral de privacidade/segurança.
- **Estado de entrega:** implementação local focalizada, com falhas e limites acima; sem aprovação de baseline/propostas, certificação, migração aplicada ou autorização de publicação.


## Correcoes focalizadas de regras de negocio ? 2026-10-22

**Escopo local:** natureza de categoria, aritmetica monetaria e limiares de orcamento. Preservados os IDs de requisitos, dados historicos, locks, filtros e semantica temporal/de ajustes. Nenhuma migracao, banco, servico, commit ou publicacao foi executado.

- **A02 ? corrigido nos escritores atuais da aplicacao:** PATCH rejeita mudanca de tipo com `400 CATEGORIA_TYPE_IMMUTABLE`/campo `tipo`; eco identico permanece aceito e nunca e regravado. Eco isolado e no-op. A interface seleciona tipo apenas na criacao e envia somente nome na edicao. Historico inconsistente anterior nao foi corrigido automaticamente; escritores SQL externos e instancias antigas precisam de governanca de implantacao.
- **A07 ? correcao focalizada de calculo:** novo helper compartilhado interpreta numeros DTO/strings decimais SQL em centavos `bigint`. Saldos com transferencias/comissoes, totais e categorias de dashboard/relatorios, economia/comparativo, alocacoes e progresso de orcamento somam/subtraem centavos antes da projecao. Fracoes de centavo nao sao arredondadas para esconder entrada invalida. Nao houve substituicao global de `toNumber` nem alteracao de ajustes, periodos, filtros ou pipeline ML.
- **Alocacoes:** igualdade ao total e aceita (`0.10 + 0.20 = 0.30`). Edicao calcula novo menos antigo depois de converter ambos a centavos; reducao do total e limite de um centavo continuam verificados sob o lock existente do orcamento.
- **Limiares:** gasto exato define estado global/por categoria antes do arredondamento percentual; `799.99/1000` permanece normal e `999.99/1000` permanece alerta_80. Restante pode ser negativo e preserva centavos.
- **Contrato numerico:** `bigint` fica interno e nunca e serializado. A projecao publica reconverte o numero a centavos e exige igualdade; uma contagem inteira segura de centavos, sozinha, nao basta. Total realmente nao representavel recebe 500 sanitizado pelo filtro existente. Agregados nao recebem o limite artificial de uma unica coluna NUMERIC(14,2).

### Evidencia executada nesta unidade

| Verificacao | Comando (cwd) | Resultado e limite |
| --- | --- | --- |
| RED backend | `npm test -- --runInBand --runTestsByPath src/common/money.util.spec.ts src/categorias/categorias.service.spec.ts src/orcamentos/orcamentos.service.spec.ts src/contas/contas.service.spec.ts src/dashboard/dashboard.service.spec.ts src/relatorios/relatorios.service.spec.ts` (`backendnest`) | Exit 1; 6 suites falharam, 10 testes falharam/45 passaram. Helper ainda ausente; regress?es observaram reclassificacao permitida, eco regravado, rejeicao 0.10+0.20, limiares antecipados e residuos nas somas. |
| GREEN backend | Mesmo comando RED apos implementacao/formatacao | Exit 0; 6 suites/82 testes PASS, 12.269 s. Inclui strings SQL, sinal, escala, maximo DTO, agregado acima do limite de fila e projecao de centavos que se perde mesmo com inteiro seguro. |
| Verificacao final e sanitizacao | Comando GREEN com `src/logs/global-exception.filter.spec.ts` adicional (`backendnest`) | Exit 0; 7 suites/95 testes PASS, 10.980 s, apos refinar o caso de delta para total existente 0.20 e troca de alocacao 0.10 para 0.20. Inclui sanitizacao existente de erros 500. |
| Regressao monetaria existente | `npm test -- --runInBand --runTestsByPath src/common/monetary-bounds.spec.ts src/common/monetary-scale.validator.spec.ts src/common/financial-validation.util.spec.ts src/orcamentos/repositories/orcamento.repository.spec.ts` (`backendnest`) | Exit 0; 4 suites/86 testes PASS, 31.096 s. |
| RED frontend | `npm test -- --runInBand --runTestsByPath src/modules/categorias/__tests__/categoria-form.test.tsx` (`frontend`) | Exit 1; selector de tipo ainda editavel; teste existente de criacao tambem excedeu limite de harness de 5 s. |
| GREEN frontend | `npm test -- --runInBand --testTimeout=15000 --runTestsByPath src/modules/categorias/__tests__/categoria-form.test.tsx src/modules/categorias/__tests__/categoriaService.test.ts` (`frontend`) | Exit 0; 2 suites/9 testes PASS, 12.660 s. Or?amento de harness 15 s, sem enfraquecer assertions ou alterar timeout da API. |
| Tipos backend | `.\node_modules\.bin\tsc.cmd --noEmit --incremental false` (`backendnest`) | Exit 1; quatro erros TS7022/TS7024 em `src/transferencias/transfer-intent.spec.ts:20,23,36,38`, mocks autorreferentes de WIP fora desta unidade, arquivo nao alterado. Nenhum erro apontado nos arquivos autorados. Nao e PASS global de tipos. |
| Tipos frontend | `.\node_modules\.bin\tsc.cmd --noEmit --incremental false` (`frontend`) | Exit 0. |

**Limites:** suites unitarias/mockadas nao provam concorrencia, rollback ou contrato em PostgreSQL real. E2E/banco, dispositivo/leitor de tela, carga, deploy, CI e baseline global de produto continuam nao verificados nesta unidade. Invariantes de atividade/propriedade e lock foram preservadas por leitura/regressoes de mocks; isso nao recebe rotulo de prova concorrente real. Impacts upstream HIGH de `calculateProgress`, `enrichBudgetWithProgress` e `attachCurrentBalances` foram comunicados antes da edicao; demais alvos desta unidade foram LOW/MEDIUM. O indice GitNexus inclui snapshots antigos e foi confrontado com o working tree, sem reindexacao.

Validacao estrutural adicional: `backendnest/swagger.yaml` foi carregado com `js-yaml` instalado e os contratos alterados (eco imutavel, erro e limiar) foram conferidos por assertions locais: PASS. Prettier check-only dos 14 arquivos TS/TSX autorados: PASS. Esses checks nao substituem HTTP ou cliente nativo real.

## Fechamento focalizado — 2026-10-23

**Resultado:** o comando completo do supervisor terminou com **exit 1**, não PASS
global. Contratos financeiros e duas corridas de orçamento passaram em PostgreSQL
real descartável; cliente web real permanece pendente por limite de exportação.
Não é aceite global, deploy ou certificação móvel. Os registros de
22/10 acima são históricos, não foram reclassificados como provas atuais.

### Correções delimitadas

- Mocks de `transfer-intent.spec.ts`: contratos explícitos dos dois builders
  removem a inferência circular TS7022/TS7024, sem suprimir erros, adicionar `any`
  ou enfraquecer o compilador.
- O primeiro E2E real revelou `500 UpdateValuesMissingError` no eco isolado do
  mesmo tipo. `plainToInstance(UpdateCategoriaDto, ...)` materializa campos
  opcionais próprios com `undefined`; contar chaves confundia ausência de valores
  com alteração persistível. A guarda de `CategoriasService.update` agora verifica
  valores definidos. Eco não grava nem audita; nome válido continua editável;
  tipo diferente continua rejeitado. A semântica de `null` não mudou. Impacto
  upstream LOW: um caller controlador, nenhum processo indexado.
- Regressões usam DTO realmente materializado, além dos testes HTTP reais.

### Provas desta unidade

| Verificação | Resultado e limite |
| --- | --- |
| Backend focalizado antes da correção DTO | Oito suites/105 testes PASS, exit 0, 101.756 s; inclui mocks de transferência e serviços monetários. Não somar com as execuções sobrepostas abaixo. |
| RED do DTO materializado | Uma falha/13 PASS: o eco tentou atualizar quatro campos `undefined`. |
| GREEN depois da correção DTO | Categoria + mocks de transferência: duas suites/25 testes PASS, exit 0, 6.984 s. Demais fontes dessas suites focalizadas permaneceram inalteradas. |
| Guardas puras do supervisor | Quatro testes PASS: paths/sentinel/identidade, retenção de claim e não herança do destino habitual. Não substituem prova de encerramento físico de descendentes. |
| Tipos frontend | `tsc --noEmit --incremental false`: exit 0; inclui config/cenário financeiro novos. |
| Tipos backend após correção | `tsc --noEmit --incremental false -p tsconfig.json`: exit 2, somente TS7016 preexistente em `src/scripts/migrate.ts:3`, declaração de `pg` ausente. Os quatro erros circulares desapareceram; nenhum erro nos arquivos autorados. Não é PASS global de tipos. |
| HTTP/PostgreSQL final | Launcher `npm run test:e2e -- --runTestsByPath test/financial-business-rules.e2e-spec.ts test/budget-allocation-concurrency.e2e-spec.ts`: duas suites/seis testes PASS, exit 0, 32.197 s. Categoria/eco/histórico, igualdade/delta/centavo excedente, quatro limiares globais e por categoria, números JSON exatos de saldo/dashboard/informe e duas corridas com bloqueio observado. |
| Cliente real | Nest iniciou, mas `expo export` não concluiu dentro de 180 s; encerrado com SIGTERM. Log não identifica erro funcional da aplicação. Edge/cenário financeiro não iniciaram; sem screenshots. Não há PASS de criação/edição/recarga no cliente. |

Logs locais dos checks e manifesto de atribuição: `.tmp/financial-closure-20261023/`.
O patch compara bytes anteriores à unidade, não todo o WIP contra HEAD. Nenhum
commit, staging, instalação, mudança de serviço do Windows ou banco habitual foi
executado. A nova pendência de tipos do script de migração não foi alterada.

### Execuções e custódia do destino

Três execuções delimitadas, com nonce e cluster próprios; não houve reutilização
de destino falho nem remoção de claim para repetir:

1. `.tmp/financial-runtime-63cb3daaee7d4bf6bd11d3aa40dec4c8/`: initdb passou;
   `pg_ctl` falhou ao criar token restrito (erro 87). Sem conexão administrativa,
   migrações, lease ou E2E. O diagnóstico não estabelece, sozinho, causa do sistema
   operacional.
2. Uma execução autorizada em contexto de permissão distinto,
   `.tmp/financial-runtime-2cc7a6d1e722483eb366e4dcd116220d/`, iniciou cluster próprio
   e revelou o defeito DTO acima: cinco PASS/uma falha. Claim retido; PostgreSQL
   próprio encerrado. Nenhum browser foi iniciado.
3. Após a correção delimitada e GREEN,
   `.tmp/financial-runtime-3ad4463fe9a1411592391bdbbeabd26e/`: seis E2E PASS; exportação
   Expo interrompida pelo limite. O `proof.json` registra `expo-export failed:
   SIGTERM` e retenção do claim. `pg-stop` passou, `postmaster.pid` está ausente e
   o arquivo temporário da senha de initdb foi removido. Handles filhos conhecidos
   terminaram; descendentes Metro não foram certificados. A consulta de inventário
   de processos não produziu evidência utilizável. Não declarar limpeza global
   apenas pelos campos `confirmed` de fases não iniciadas.

Cada destino usa loopback, rol restrito proprietário de banco marcado e identidade
confirmada antes de DDL. Dados/evidências dos clusters parados foram preservados;
nenhuma base da aplicação foi consultada ou migrada. Não houve tentativa adicional
após a falha final. Para fechar o último item, diagnosticar a exportação offline e
obter autorização para uma nova execução delimitada do cliente; não aumentar
limites nem iniciar repetição automaticamente. Os temas de produto anteriores
4–6, carga, CI, acessibilidade nativa e aceite global permanecem fora deste escopo.

## Acompanhamento delimitado e organização para revisão — 2026-10-25

O contrato frontend de PATCH agora exclui `ehAjuste`; POST mantém a flag opcional
e PATCH mantém `descricao` anulável. Não foi criado um fluxo de ajuste: não há
necessidade de produto aprovada para isso. Backend e Swagger já representavam o
contrato; nenhum comportamento de execução foi alterado nesta unidade.

### Evidência e limites

- RED real: o compilador frontend terminou com exit 2, somente TS2344 na fixture
  de contrato, porque a chave ainda era herdada. Após a omissão, o compilador
  completo terminou com exit 0. Uma cópia isolada do tipo de HEAD `c78636e`,
  acrescida somente da correção e da fixture, também compilou com exit 0;
  nenhuma paginação ou outra alteração WIP entrou nessa prova isolada.
- A fixture contém apenas tipos; Jest não substitui a prova de compilação.
  A prova isolada cobre o contrato, não certifica todos os candidatos abaixo.
- GitNexus foi invocado antes da edição: símbolo não encontrado, risco UNKNOWN,
  não LOW. O censo manual encontrou serviço de transações, seus testes e
  formulário; o formulário já não enviava a flag na edição.
- O fechamento de `pg` ocorreu em 24/10: `@types/pg` 8.23.1, runtime `pg` 8.20.0
  preservado, contrato de linhas-objeto e adaptador genérico; backend completo
  `tsc --noEmit --incremental false` exit 0 e oito mocks de migração PASS.
  Não foi reexecutado nesta unidade. Isso resolve a pendência TS7016 sem apagar
  o resultado histórico de 23/10 acima. Logs: `.tmp/pg-types-20261024/`.
- Cliente real continua adiado pelo usuário. O resultado histórico permanece
  seis E2E PASS, supervisor exit 1, exportação Expo interrompida em 180 s, sem
  Edge/screenshots. Encerramento global dos descendentes Metro e estado vivo
  dos claims históricos não foram certificados. Nenhum runtime foi repetido.

### Unidades candidatas, ainda sem staging ou commits

O índice permaneceu sem alterações nesta unidade. As fronteiras abaixo são
propostas revisáveis, não commits prontos nem provas novas. Manifestações de
bytes pré-unidade não substituem a comparação com HEAD e suas dependências.
O hunk de paginação preexistente em `transacao.ts` fica fora da correção.

| Unidade / mensagem proposta | Fronteira, dependência e reversão | Condição antes de commit |
| --- | --- | --- |
| `fix(transactions): align update payload with API` | Somente hunk `Omit`, fixture compilada e orientação correspondente em TESTES; reverter os três sem remover paginação. | Tipo isolado verificado; verificar a árvore candidata exata, não aceitar todo o WIP como prova. |
| `fix(categories): preserve category nature after creation` | `backendnest/src/categorias/categorias.service.ts` e `.spec.ts`, inclusive correção DTO materializado, mais hunk do manual. Reversão só dessa regra. | Snapshots anteriores equivalem a HEAD após comparação EOL e cadeia autorada confere; pronto para montagem/verificação isolada, ainda não realizada. |
| `fix(budgets): enforce exact allocation caps and alert thresholds` | `backendnest/src/common/money.util.ts`/`.spec.ts` e `src/orcamentos/orcamentos.service.ts`/`.spec.ts`; helper e orçamento formam unidade. Reverter consumidores antes de remover helper. | Baselines conferem; verificar candidato isolado com seus testes. Não depende do WIP `monetary-limits.ts`. |
| `fix(finance): preserve exact cents in financial summaries` | Pares service/spec de `src/contas`, `src/dashboard` e `src/relatorios`; depende do helper anterior. Reversão não remove orçamento/helper. | Baselines conferem; verificar os seis arquivos sobre o helper aprovado. |
| `test(e2e): retain ownership of disposable database runs` | Núcleo: `backendnest/test/e2e-runtime.cjs`, `.d.cts`, `.spec.cjs`, `e2e-environment.cjs`, `e2e-runner.cjs`, `.spec.cjs`; reversão desses seis sem absorver adaptadores. | Núcleo pode ser verificado isoladamente. Integração completa ainda exige baseline de `session-harness/runner.cjs`/`c6.cjs` e módulos auxiliares ausentes de HEAD. Não cortar invariantes de segurança para caber no commit. |
| `test(finance): verify business rules against PostgreSQL` | Suites financeiras/concorrência, supervisor e cenário web preparado; depende de regras e harness. Reversão só dos cenários e supervisor. | Aprovar pré-requisitos externos: supervisor usa `session-harness/register.cjs`; mock de transferência depende de código/DTO ainda fora de HEAD. Seis PASS históricos não provam esse candidato isolado; web não certificado. |
| `fix(tooling): type PostgreSQL migration queries` | Hunk devDependency/lock, contrato `migration-runner.ts` e adaptador em `migrate.ts`; reverter só tipagem após resolver baseline. | CLI, runner e teste inteiros são untracked e dependem de 18 SQL ausentes de HEAD; validar autoria e pré-requisitos antes de incluí-los. Não adicionar todo o CLI como se fosse apenas a correção de tipos. |

Os manifestos de origem são o conjunto financeiro original em
`finance-business-rules-2f7ff36543b3413299b167a871ed41f5` (Temp local),
`.tmp/e2e-harness-fix-20261022-11ef3c23/`,
`.tmp/financial-closure-20261023/` e `.tmp/pg-types-20261024/`.
Eles se sobrepõem; não somar contagens nem presumir commits independentes.

O formulário de categoria depende de `useFinancialDraft` ausente de HEAD;
separar sua aprovação da unidade backend. Este relatório inteiro é untracked,
e os baselines completos de requisitos/Swagger também precisam delimitação de
autoria antes de publicação; o baseline do manual confere. Isso não bloqueia
organizar ou verificar isoladamente os conjuntos backend acima.

Antes de cada commit futuro: reconstruir a árvore candidata sobre dependências
aprovadas em isolamento autorizado, executar checks aplicáveis nessa árvore,
conferir escopo com `detect_changes()` e aplicar somente hunks aprovados. Não usar
`git add -A`, stash/reset, nem reescrever o commit existente de navegação.
Nenhum commit, branch, staging, push, instalação, banco ou cliente foi executado
nesta unidade. Para publicação futura, medir linhas autoradas por unidade;
se uma PR superar 400 linhas, definir fatias funcionais ou exceção explícita.

### Resultado dos checks do contrato em 25/10

O compilador frontend completo passou com exit 0. Depois, a reconstrução
mecânica do arquivo a partir dos bytes pré-unidade preservou seus finais de linha
e paginação; somente a omissão autorizada permanece diferente. Não houve mudança
semântica após esse check. A prova isolada de tipos foi repetida sobre o candidato
final; não equivale a uma certificação completa da árvore de commits.

A única execução dos dois testes Jest terminou com **exit 1**: uma suite PASS,
uma FAIL; **21 testes PASS e um FAIL**, de 22, em 192.469 s. O caso
`renders form for creating new transaction with a working profile action`, em
`transacoes-form.test.tsx:80`, excedeu 15000 ms. O resultado não demonstra uma
falha de asserção do contrato; a causa do timeout não foi investigada nem
corrigida. Não houve repetição nem aumento de limites. Portanto, não declarar
GREEN global do frontend. Logs e patch próprio: `.tmp/transaction-contract-20261025/`.

## Estado de entrega local após verificação isolada — 2026-10-25

Este bloco atualiza o estado de entrega; a tabela de candidatos anterior
permanece como registro histórico, não como descrição do índice atual.

Foram criados, sem push: `4ba12e0` (mock tipado de repositório, pré-requisito
aprovado em 12/10), `627bed8` (contrato PATCH), `6740cd6` (categoria imutável),
`03889fb` (centavos/limites/limiares de orçamento) e `ba41bed` (saldos/agregados).
Na entrega desses cinco commits, o índice estava sem alterações; o WIP restante
foi preservado. Reverter consumidores de agregados antes de remover o helper
monetário; contrato e categoria têm fronteiras independentes.

Provas isoladas: pré-requisito um teste PASS (hash igual ao aprovado), categoria
15 PASS, helper/orçamento 49 PASS e agregados 19 PASS: **84 testes backend
focalizados**. O backend completo da árvore expandida HEAD + contrato +
pré-requisito + categoria + orçamento + agregados passou no `tsc --noEmit
--incremental false`, exit 0. Isso supera a falha anterior do candidato sem o
pré-requisito; não altera resultados históricos de outras árvores. Dependências
instaladas foram reutilizadas por junctions, sem instalação ou certificado de
lockfile/CI limpo.

A fixture isolada do contrato frontend passou. O compilador completo de HEAD +
contrato falhou com 572 erros em 32 arquivos inalterados (baseline/ambiente,
incluindo tipos Jest/estilos). O PASS anterior no WIP completo não prova essa
árvore. Permanecem o resultado WIP de 21/22 testes, timeout de 15000 ms na
criação em `transacoes-form.test.tsx:80`, e sua causa não diagnosticada.
Portanto, não declarar PASS global frontend.

Ainda não commitados: draft frontend, adaptadores de sessão, launcher financeiro,
CLI de migração e baselines de transferências. Este relatório inteiro segue
untracked e depende de aprovação de baseline antes de inclusão; somente a nova
seção autocontida de TESTES foi preparada como candidato documental separado.
Cliente real e novas execuções com banco continuam adiados; o histórico de
PostgreSQL de 24/10 não foi reexecutado. Nenhum teste, serviço ou banco foi
executado para esta atualização passiva. Evidência privada local:
`.tmp/isolated-unit-verify-11c04ecd36b544d08af551be89feaaf0/`; não publicar logs
brutos. O guia TESTES contém o mesmo resumo verificável sem depender deste
relatório não versionado.
