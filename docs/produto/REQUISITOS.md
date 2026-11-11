# Requisitos, casos de uso e rastreabilidade do sistema financeiro

Este documento é o índice central do comportamento funcional, das qualidades esperadas e das fontes de verificação do sistema. Consolida informações existentes e registra propostas separadamente, sem substituir contratos e especificações detalhadas.

**Revisão documental inicial: 2026-10-20; acompanhamento local: 2026-10-21.** A revisão inicial foi estática. O [acompanhamento de correções e testes locais](../validacao/AUDITORIA_ESTADO_ATUAL_SISTEMA_2026-10-15.md#acompanhamento-local-2026-10-21) distingue implementação, prova focalizada e verificações não executadas. Código local não significa aprovação de produto, aceite ou prontidão produtiva.

## Consulta rápida

1. Entenda [escopo e atores](#contexto) e [estados do catálogo](#estados).
2. Localize o comportamento nos [requisitos funcionais](#funcionais) e nos [casos de uso](#casos).
3. Consulte [requisitos não funcionais](#nao-funcionais), [decisões pendentes](#decisoes) e [fontes e testes](#fontes).
4. Separe [resultados históricos](#historico) de provas que ainda precisam ser produzidas.

<a id="contexto"></a>
## Contexto, escopo e atores

O sistema apoia gestão financeira pessoal: acesso/perfil, contas, categorias, movimentações, dívidas, pagamentos, orçamentos, metas, alertas, consultas e previsão experimental de déficit. Planejamentos compartilhados organiza gastos de grupos sem executar pagamentos reais nem criar automaticamente movimentações pessoais.

| Ator | Papel e limite |
| --- | --- |
| Visitante | Consulta privacidade, solicita cadastro, login ou recuperação; não acessa dados financeiros protegidos. |
| Usuário autenticado | Opera dados e sessões próprios. A autorização vem do servidor, não de IDs ou controles visuais do cliente. |
| Proprietário de planejamento | Administra seu planejamento conforme estado e situação financeira. |
| Participante vinculado ativo | Executa somente operações permitidas ao seu papel. Participante manual, convidado, pendente ou removido não recebe esse acesso. |
| Serviço ML e canal de recuperação | Integrações de apoio. ML é chamado pelo backend; solicitação de recuperação não comprova entrega de e-mail. |

Fora do contrato atual: pagamentos bancários reais, Open Finance, convite de planejamento por token, upload real de comprovantes, treinamento automático com dados reais, garantia de resultado financeiro e publicação em lojas. O [roadmap de Planejamentos](../specs/planejamentos-compartilhados/requisitos.md) e o [README](../../README.md) detalham limites.

<a id="estados"></a>
## Estados e convenções

| Estado | Significado |
| --- | --- |
| DOCUMENTADO | Comportamento encontrado em contrato/documentação vigente; critério a verificar, sem afirmar execução ou aceite atual. |
| ESTÁTICO / PENDENTE | Observado no código local, com lacuna contratual/decisória. Implementação não o transforma em compromisso aprovado. |
| PROPOSTO / PENDENTE | Melhoria para discussão; precisa de aprovação e, quando indicado, parâmetros antes de permitir aceite. |
| FUTURO | Fora do contrato atual, mesmo que existam campos, enums ou protótipos de apoio. |

- Saldos de contas, agregados de dashboard/relatorios e orcamentos usam centavos inteiros internos. O JSON continua numerico; projecao que perder centavos falha com 500 sanitizado. O limite por entrada DTO nao limita artificialmente agregados; filtros temporais e inclusao de ajustes nao mudam.
- IDs `RF-<domínio>-NN`, `CU-<domínio>-NN` e `RNF-<tema>-NN` permanecem estáveis. Não reutilizar ID removido para outro significado.
- Cada RF aponta a CU e fonte. CUs agrupam jornadas próximas, mas os critérios de RF permanecem verificáveis separadamente. Campos, formatos e status HTTP ficam no [Swagger oficial](../../backendnest/swagger.yaml), sem cópia integral.
- Arquivo de teste é pista de verificação, não PASS. Para declarar atendimento, registrar cenário, versão/candidato, ambiente, data, comando/observação e resultado no documento de [validação](../README.md#validação) pertinente.
- Erro não implica rollback em qualquer endpoint: atomicidade vale somente onde especificada. Após possível envio, o resultado de uma escrita pode ser desconhecido.
- Estes IDs organizam a documentação; não constituem baseline aprovada por stakeholders. Propostas, divergências e objetivos sem parâmetros continuam pendentes.

<a id="funcionais"></a>
## Requisitos funcionais

Cada linha define um resultado mínimo verificável. Todos os itens são DOCUMENTADOS, salvo estado pendente explícito. Fontes de domínio remetem à matriz de contrato/regras/testes ao final.

### Acesso, credenciais e sessões

Fonte: [Auth e sessões](#fonte-auth). As invariantes C1 a C10 e S2-01 a S2-12 têm limites próprios de implementação, implantação e prova; não estão globalmente encerradas por este catálogo.

| ID | Comportamento e condição observável | Caso de uso |
| --- | --- | --- |
| RF-AUTH-01 | Cadastrar usuário com dados válidos e aceite de privacidade; recusar aceite ausente e e-mail duplicado sem segundo cadastro. | CU-ACESSO-01 |
| RF-AUTH-02 | Autenticar e-mail/senha válidos e retornar credenciais de sessão; credencial inválida não concede acesso financeiro. | CU-ACESSO-02 |
| RF-AUTH-03 | Renovar credenciais por refresh válido com rotação; reutilização terminal não restaura sessão revogada. Verificar concorrência conforme S2, não só HTTP mockado. | CU-ACESSO-02 |
| RF-AUTH-04 | Encerrar localmente a sessão atual no logout e solicitar revogação remota; falha de rede não pode ser apresentada como revogação confirmada. | CU-ACESSO-06 |
| RF-AUTH-05 | Receber pedido de recuperação com resposta pública genérica, sem revelar existência do e-mail ou token de reset. Entrega real do link é verificação separada. | CU-ACESSO-03 |
| RF-AUTH-06 | Redefinir senha com token válido; token expirado/usado/invalidado não autoriza mudança. Após confirmação, links e sessões anteriores não recuperam acesso. | CU-ACESSO-03 |
| RF-AUTH-07 | Alterar senha autenticada exigindo senha atual e sessão válida; invalidar links/sessões anteriores atomicamente e exigir novo login, sem autologin. | CU-ACESSO-04 |
| RF-AUTH-08 | Listar somente sessões próprias com paginação e indicação da atual; consulta não renova atividade nem afirma dispositivo conectado agora. | CU-ACESSO-05 |
| RF-AUTH-09 | Encerrar sessão própria escolhida após senha atual, sem distinguir alvo alheio/inexistente/já revogado no sucesso; timeout não autoriza repetição automática. | CU-ACESSO-05 |
| RF-AUTH-10 | Encerrar todas as sessões existentes no ponto serializado, inclusive a atual, após reautenticação; novo login posterior permanece possível. | CU-ACESSO-05 |
| RF-AUTH-11 | Consultar autoridade da sessão no startup/resume antes de liberar dados/ações. `GET /auth/session` está documentado no Swagger local; validação de ciclo de vida nativo e aceite permanecem delimitados pelas provas de sessão. | CU-ACESSO-02 |

### Perfil e privacidade

Fonte: [Perfil, CEP e privacidade](#fonte-perfil).

| ID | Comportamento e condição observável | Caso de uso |
| --- | --- | --- |
| RF-PERFIL-01 | Consultar perfil próprio sem senha/hash/token e atualizar somente campos permitidos, sem alterar outro usuário. | CU-PERFIL-01 |
| RF-PERFIL-02 | Consultar CEP válido no cadastro/perfil; formato inválido, inexistência ou indisponibilidade não podem produzir endereço inventado. | CU-PERFIL-01 |
| RF-PERFIL-03 | Exibir política acessível no cadastro e registrar consentimento exigido; isso não comprova conformidade legal integral. | CU-ACESSO-01 |

### Contas e categorias

Fontes: [Contas](#fonte-contas) e [Categorias](#fonte-categorias).

| ID | Comportamento e condição observável | Caso de uso |
| --- | --- | --- |
| RF-CONTA-01 | Criar e editar conta própria com tipo/campos válidos; alteração de conta alheia não é autorizada. | CU-CONTA-01 |
| RF-CONTA-02 | Listar contas ativas e consultar saldo derivado do inicial e movimentos válidos; transferência debita origem com comissão e credita destino sem virar receita/despesa analítica. | CU-CONTA-02 |
| RF-CONTA-03 | Desativar conta sem apagá-la fisicamente; retirar da lista ativa e recusar novas operações que exijam conta ativa. | CU-CONTA-01 |
| RF-CAT-01 | Criar, consultar e editar categorias proprias de receita/despesa e filtrar por tipo; natureza imutavel apos criacao e transacao exige categoria compativel. PATCH aceita eco do mesmo tipo sem regrava-lo; mudanca retorna CATEGORIA_TYPE_IMMUTABLE. | CU-CAT-01 |
| RF-CAT-02 | Desativar categoria preservando registro; retirar das opções ativas e recusar novo movimento que exija categoria ativa. | CU-CAT-01 |

### Transações e transferências

Fontes: [Transações](#fonte-transacoes) e [Transferências](#fonte-transferencias).

| ID | Comportamento e condição observável | Caso de uso |
| --- | --- | --- |
| RF-TRANS-01 | Registrar receita/despesa positiva com conta e categoria próprias ativas/compatíveis; recusar referência alheia ou inválida. | CU-TRANS-01 |
| RF-TRANS-02 | Listar e consultar transações próprias não excluídas em páginas limitadas e ordem estável, com filtros válidos do contrato; filtro inválido não é silenciosamente ignorado. | CU-TRANS-02 |
| RF-TRANS-03 | Atualizar transação própria revalidando valor, conta, tipo e categoria; recusar alteração direta de despesa vinculada a pagamento de dívida ativo. | CU-TRANS-02 |
| RF-TRANS-04 | Excluir logicamente transação própria e retirá-la de saldo/agregações; despesa de pagamento ativo exige fluxo próprio, não exclusão direta. | CU-TRANS-02 |
| RF-TRF-01 | Registrar transferência positiva entre contas próprias ativas distintas, com comissão não negativa; refletir valor/comissão nos saldos corretos. Na criação, aceitar chave opcional de intenção com replay/conflito conforme CU-TRF-01 e Swagger; sem chave, não há deduplicação. | CU-TRF-01 |
| RF-TRF-02 | Listar e consultar transferências próprias não excluídas em páginas limitadas e ordem estável, identificando origem, destino, valor e comissão. | CU-TRF-02 |
| RF-TRF-03 | Editar valor, comissão, data e descrição de transferência própria, revalidando referências/valores permitidos; contas e intenção original não mudam no PATCH. Saldos consultados refletem alteração. | CU-TRF-02 |
| RF-TRF-04 | Excluir logicamente transferência própria, desconsiderando efeito nos saldos e preservando registro histórico. | CU-TRF-02 |

### Dívidas e pagamentos

Fontes: [Dívidas](#fonte-dividas) e [Pagamentos](#fonte-pagamentos).

| ID | Comportamento e condição observável | Caso de uso |
| --- | --- | --- |
| RF-DIV-01 | Registrar dívida com valores, periodicidade e datas válidos; conta vinculada, quando informada, pertence ao usuário. | CU-DIV-01 |
| RF-DIV-02 | Consultar e editar dívida própria nos campos permitidos; conta, valor total e data de início definidos na criação permanecem imutáveis na edição. | CU-DIV-01 |
| RF-DIV-03 | Desativar dívida sem exclusão física; dívida inativa não aceita novos pagamentos. | CU-DIV-01 |
| RF-PAG-01 | Registrar pagamento positivo de dívida ativa com conta ativa e categoria de despesa próprias; pagamento e transação DESPESA associada confirmam juntos ou sofrem rollback. | CU-PAG-01 |
| RF-PAG-02 | Consultar pagamentos de dívida própria e vínculo com transação, sem expor pagamentos de outro usuário. | CU-PAG-02 |
| RF-PAG-03 | Excluir logicamente pagamento e despesa associada na mesma transação, retirando efeito financeiro e preservando histórico. | CU-PAG-02 |

### Orçamentos, metas e alertas

Fontes: [Orçamentos](#fonte-orcamentos), [Metas](#fonte-metas) e [Alertas](#fonte-alertas).

| ID | Comportamento e condição observável | Caso de uso |
| --- | --- | --- |
| RF-ORC-01 | Criar orçamento mensal positivo e único por usuário/mês; recusar duplicidade, inclusive sob concorrência prevista nas fontes. Unicidade não é por mês/categoria. | CU-ORC-01 |
| RF-ORC-02 | Consultar orcamento proprio com filtro anual, gasto atual, restante, percentual utilizado e estados normal/80%/100% decididos pelos centavos exatos, antes do arredondamento visual; despesas excluidas nao compoem progresso. | CU-ORC-01 |
| RF-ORC-03 | ESTÁTICO / PENDENTE: alterar valor sem mudar mês; serviço local recusa edição de mês passado e redução abaixo das alocações. Reconciliar contrato e aceite antes de assumir baseline. | CU-ORC-01 |
| RF-ORC-04 | Manter alocacoes por categoria de despesa propria/ativa, sem duplicidade nem soma exata acima do total; igualdade ao total e permitida. Criacao, alteracao e exclusao estao documentadas no Swagger local; isso nao comprova execucao em banco nem interface de alocacoes. | CU-ORC-02 |
| RF-META-01 | Criar meta com objetivo positivo, vínculos próprios válidos e data válida; tipo e vínculos definidos na criação não mudam na edição. | CU-META-01 |
| RF-META-02 | Consultar/editar meta própria, aceitando valor atual zero e recusando valor atual negativo. | CU-META-01 |
| RF-META-03 | Desativar meta sem exclusão física, retirando-a da listagem ativa. | CU-META-01 |
| RF-ALERTA-01 | Criar alerta para meta, dívida ou orçamento existente, do tipo correspondente e do usuário; recusar referência alheia. | CU-ALERTA-01 |
| RF-ALERTA-02 | Consultar/editar campos permitidos do alerta próprio com tipo/referência imutáveis; referência histórica indisponível não impede demais edições permitidas. | CU-ALERTA-01 |
| RF-ALERTA-03 | Desativar alerta próprio ou marcá-lo como notificado; essa marcação não comprova envio externo de push/e-mail. | CU-ALERTA-01 |

### Consultas, previsão e auditoria

Fontes: [Dashboard](#fonte-dashboard), [Relatórios](#fonte-relatorios), [ML](#fonte-ml) e [Auditoria](#fonte-auditoria).

| ID | Comportamento e condição observável | Caso de uso |
| --- | --- | --- |
| RF-DASH-01 | Exibir resumo mensal próprio com saldos, receitas, despesas e transações recentes, sem registros logicamente excluídos ou dados de terceiros. | CU-DASH-01 |
| RF-REL-01 | Gerar relatório próprio por período/filtros válidos, com totais e agregações coerentes com transações consideradas. | CU-REL-01 |
| RF-REL-02 | Excluir transferências dos totais de receita/despesa e transações soft-deleted das agregações de dashboard/relatórios. | CU-REL-01 |
| RF-ML-01 | Solicitar previsão mensal pelo backend autenticado, usando features dos três meses completos anteriores ao mês objetivo e validando contrato ML V2. | CU-ML-01 |
| RF-ML-02 | Apresentar classificação, probabilidade, risco e indicadores como previsão experimental, não garantia; ML indisponível/incompatível produz falha sanitizada, não resultado fabricado. | CU-ML-01 |
| RF-AUD-01 | Consultar logs próprios com paginação limitada, sem retornar senha, hash ou tokens. | CU-AUD-01 |
| RF-AUD-02 | Registrar eventos das mutações previstas nas fontes com ator/entidade; nos fluxos explicitamente transacionais, falha de auditoria reverte operação, sem generalizar a garantia a todo módulo. | CU-AUD-01 |

### Índice de Planejamentos compartilhados

Fonte: [Especificação detalhada](#fonte-planejamentos). Permanecem na fonte os IDs locais `REQ-IMP-01` a `REQ-IMP-12`, `REQ-NF-01` a `REQ-NF-08` e `REQ-ROAD-01` a `REQ-ROAD-10`, sem renumeração ou cópia integral.

| ID global | Resultado e vínculo com a especificação local | Caso de uso |
| --- | --- | --- |
| RF-PLAN-01 | Criar ABERTO com proprietário vinculado/ativo e controlar acesso por ator; indexa REQ-IMP-01 a REQ-IMP-05 e REQ-IMP-12. | CU-PLAN-01 |
| RF-PLAN-02 | Registrar/corrigir gastos com divisão igualitária inteira/exata, histórico e resumo puro; indexa REQ-IMP-06, REQ-IMP-07 e REQ-IMP-11. | CU-PLAN-02 |
| RF-PLAN-03 | Sincronizar/pagar/corrigir acertos e executar lifecycle por ator/estado com auditoria transacional; indexa REQ-IMP-08 a REQ-IMP-10. Não executa pagamento bancário. | CU-PLAN-03 |

<a id="casos"></a>
## Casos de uso

**Pré-condição comum:** salvo fluxos públicos explicitados, usuário autenticado, sessão validada e recursos acessíveis ao ator. Rejeição de acesso não libera dados de terceiros. As referências CU dos RF ligam requisito → jornada; fontes por domínio indicam contrato/testes. Variantes próximas compartilham jornada, mas não dispensam verificação individual dos RF.

### Retomada e descarte nos formulários

Comportamento local observado nos CUs de criação/edição de contas, categorias, transações, transferências, dívidas, pagamentos, orçamentos, metas, alertas e planejamentos (criação, participante e gasto). Não inclui interface de alocações. A qualidade e os limites de prova continuam em RNF-MOB-04, RNF-SEG-03 e RNF-REDE-02, sem novo requisito duplicado ou aprovação da política D-RASCUNHO.

- Ao retomar, revalidar a sessão e recarregar permissões/listas; restaurar somente campos editáveis do mesmo usuário/sessão/geração. Consulta tardia não substitui rascunho restaurado ou edição atual.
- Sucesso confirmado e cancelamento explícito descartam o rascunho; apenas sair da montagem do componente ou suspender a autoridade não significa cancelar. Exceção: CU-TRF-01 conserva a intenção pendente até confirmação ou início explícito de outra tentativa após conferência do histórico.
- Logout/revogação/troca de identidade ou geração invalidam o rascunho; renovação de token não o descarta. A memória é só do processo: reinício perde os dados, sem promessa de armazenamento durável ou duração mínima.

Fontes: [armazenamento em memória](../../frontend/storage/financialDrafts.ts), [hook de formulário](../../frontend/src/shared/hooks/useFinancialDraft.ts) e [prova/limites já registrados](#rnf-acompanhamento-local). Não substituem aceite de produto nem teste nativo.

### Acesso e perfil

| ID e objetivo | Ator e pré-condição específica | Gatilho | Fluxo principal | Resultado e alternativa importante |
| --- | --- | --- | --- | --- |
| CU-ACESSO-01 — cadastrar-se | Visitante; e-mail não cadastrado. | Enviar cadastro. | 1. Consultar política. 2. Preencher e aceitar. 3. Validar e registrar. | Cadastro permite login; falta de aceite, dado inválido ou duplicidade apresenta erro sem segundo cadastro. |
| CU-ACESSO-02 — entrar/manter acesso | Visitante cadastrado ou usuário retornando com snapshot local. | Login, renovação ou startup/resume. | 1. Autenticar/validar autoridade. 2. Persistir snapshot coerente. 3. Liberar acesso. 4. Rotacionar quando necessário. | Rede indisponível não prova revogação; resposta antiga não autoriza outra sessão. Contrato de startup documentado em RF-AUTH-11; aceite e prova nativa permanecem separados. |
| CU-ACESSO-03 — recuperar acesso | Visitante; canal de recuperação disponível e token válido para concluir. | Solicitar recuperação/enviar nova senha. | 1. Resposta genérica. 2. Obter link pelo canal configurado. 3. Validar token/trocar senha. 4. Novo login. | Senha alterada e vínculos antigos invalidados; token inválido bloqueia. Resposta genérica não demonstra entrega do link. |
| CU-ACESSO-04 — alterar senha | Usuário; conhece senha atual. | Confirmar alteração. | 1. Validar senha/sessão. 2. Alterar e invalidar vínculos na transação. 3. Encerrar acesso/orientar login. | Sem autologin; senha errada recusa. Resultado desconhecido não deve ser reenviado cegamente. |
| CU-ACESSO-05 — gerir sessões | Usuário; reautenticação para revogar. | Abrir sessões/escolher alvo ou todas. | 1. Listar próprias. 2. Confirmar alcance/senha. 3. Revogar. 4. Atualizar ou sair se atual incluída. | Sucesso confirma alcance; senha inválida/limite recusa, timeout mantém resultado desconhecido sem replay automático. |
| CU-ACESSO-06 — sair | Usuário; snapshot capturado. | Acionar sair. | 1. Encerrar UI/credenciais locais da sessão. 2. Solicitar revogação limitada. 3. Informar resultado. | Offline permite saída local, não comprova revogação remota nem autoriza apagar outra conta autenticada depois. |
| CU-PERFIL-01 — manter perfil | Usuário; CEP também público no cadastro. | Abrir perfil/consultar CEP/salvar. | 1. Carregar perfil. 2. Validar campos/consulta opcional. 3. Salvar permitidos. 4. Reconsultar. | Perfil próprio atualizado; CEP indisponível não inventa endereço e validação falha não aparece como sucesso. |

### Operações financeiras

| ID e objetivo | Ator e pré-condição específica | Gatilho | Fluxo principal | Resultado e alternativa importante |
| --- | --- | --- | --- | --- |
| CU-CONTA-01 — manter conta | Usuário; conta própria para alterar. | Criar/editar/desativar. | 1. Informar/selecionar conta. 2. Validar campos/acesso. 3. Persistir. 4. Atualizar lista. | Conta criada/alterada ou inativa fora da lista; acesso alheio recusado e histórico preservado. |
| CU-CONTA-02 — conferir saldo | Usuário; movimentos próprios. | Abrir contas/detalhe. | 1. Consultar contas. 2. Derivar saldo de movimentos válidos. 3. Exibir identificação/saldo. | Comissão afeta origem; exclusões lógicas desconsideradas. Distinguir consulta vazia de erro. |
| CU-CAT-01 — organizar categorias | Usuário; categoria própria para alterar. | Criar/filtrar/editar/desativar. | 1. Selecionar natureza. 2. Informar/consultar. 3. Validar/persistir. 4. Atualizar opções. | Natureza compatível; categoria inativa não autoriza novo movimento que exija atividade. |
| CU-TRANS-01 — registrar movimento | Usuário; conta/categoria próprias ativas. | Enviar receita/despesa. | 1. Informar tipo, referências, valor/data. 2. Validar. 3. Salvar. 4. Descartar rascunho confirmado e reconsultar lista/saldo. | Movimento positivo altera saldo; referência inválida/incompatível recusa sem descartar edição. Retomada segue RNF-MOB-04; resposta perdida difere de rejeição e não recebe deduplicação de transferência por herança. |
| CU-TRANS-02 — revisar movimentos | Usuário; transação própria. | Filtrar/paginar/consultar/corrigir/excluir. | 1. Aplicar mês/tipo e iniciar na primeira página. 2. Navegar páginas de 50 em ordem estável. 3. Selecionar e validar correção/exclusão. 4. Reconsultar lista/totais. | Filtro alterado reinicia página; página posterior vazia permite recuo. Resposta obsoleta não substitui consulta atual. Totais refletem alteração/exclusão; despesa de pagamento ativo exige CU-PAG-02. |
| CU-TRF-01 — transferir entre contas | Usuário; contas próprias ativas distintas para nova criação. | Enviar transferência ou confirmar a mesma tentativa. | 1. Informar origem/destino/valor/comissão. 2. Validar e gerar chave de intenção na criação pelo cliente. 3. Enviar. 4. No sucesso, limpar rascunho/intenção e consultar saldos. | Origem perde valor/comissão e destino recebe valor; mesma conta/valor inválido recusa. Resultado desconhecido conserva intenção, inclusive ao voltar, conforme a [variante de confirmação](#confirmacao-transferencia). API sem chave não deduplica. |
| CU-TRF-02 — revisar transferência | Usuário; transferência própria. | Paginar/consultar/editar/excluir. | 1. Navegar páginas de 50 em ordem estável e selecionar. 2. Consultar/validar mutação. 3. Persistir. 4. Reconsultar lista/saldos. | Saldos refletem estado válido; página posterior vazia permite recuo e resposta obsoleta não substitui consulta atual. PATCH não muda contas/intenção original; exclusão é lógica e acesso alheio é recusado. |
| CU-DIV-01 — acompanhar dívida | Usuário; vínculo próprio se informado. | Criar/consultar/editar/desativar. | 1. Informar obrigação/datas. 2. Validar. 3. Salvar permitidos. 4. Consultar. | Dívida registrada/atualizada/inativa; vínculo imutável não muda e dívida inativa não recebe novo pagamento. |
| CU-PAG-01 — registrar pagamento | Usuário; dívida/conta ativas e categoria de despesa própria. | Confirmar registro de pagamento. | 1. Informar valor/referências. 2. Revalidar. 3. Salvar pagamento/despesa juntos. 4. Reconsultar histórico e limpar valor/descrição, mantendo data/seleções visíveis. | Ambos persistem ou revertem; sucesso descarta rascunho e Voltar cancela explicitamente. Erro mantém edição; retomada segue RNF-MOB-04. Não executa pagamento bancário nem herda idempotência de transferência. |
| CU-PAG-02 — revisar pagamentos | Usuário; dívida/pagamento próprio. | Consultar/excluir. | 1. Listar por dívida. 2. Selecionar. 3. Excluir logicamente pagamento/despesa juntos se solicitado. 4. Reconsultar. | Histórico/saldo coerentes; acesso alheio recusa e rollback não deixa só uma metade excluída. |

<a id="confirmacao-transferencia"></a>
#### Variante de confirmação de transferência — CU-TRF-01

- Mesma chave do usuário e mesmos dados originais retornam a mesma identidade, mesmo após edição ou desativação das contas. Dados diferentes ou original excluído geram 409, sem ressurreição; a comparação usa a criação original, não campos alterados no PATCH.
- Timeout, falha de transporte ou 5xx mantêm resultado desconhecido: conservar chave/payload, conferir histórico e, se necessário, confirmar a mesma tentativa sem replay automático. Alteração não gera nova chave automaticamente; outra intenção exige ação explícita após conferência.
- A chave é opcional e restrita à criação de transferência; sem chave, cada POST válido pode criar nova operação. Implantação depende da migração 0018, ainda NOT_APPLIED; concorrência SQL e provas nativas continuam NOT_RUN conforme a [evidência existente](#rnf-acompanhamento-local).

### Planejamento pessoal e consultas

| ID e objetivo | Ator e pré-condição específica | Gatilho | Fluxo principal | Resultado e alternativa importante |
| --- | --- | --- | --- | --- |
| CU-ORC-01 — planejar mês | Usuário; mês válido próprio. | Criar/consultar/ajustar orçamento. | 1. Informar mês/valor. 2. Validar unicidade/edição. 3. Salvar. 4. Consultar progresso. | Total/faixa de consumo apresentados; duplicidade recusa. Edição de mês passado tem pendência RF-ORC-03. |
| CU-ORC-02 — distribuir orçamento | Usuário; orçamento mutável, categoria de despesa ativa. | Manter alocação. | 1. Selecionar categoria. 2. Validar valor/duplicidade/soma. 3. Criar/editar/remover. 4. Reconsultar. | Contrato de alocações documentado no Swagger local; soma não excede orçamento. Aceite e execução integrada permanecem pendentes. |
| CU-META-01 — acompanhar objetivo | Usuário; vínculos próprios na criação. | Criar/consultar/atualizar/desativar. | 1. Definir objetivo/prazo/vínculo. 2. Validar. 3. Salvar progresso/permitidos. 4. Consultar ativas. | Valor atual zero aceito, negativo recusado; vínculo não troca na edição. |
| CU-ALERTA-01 — acompanhar aviso | Usuário; referência própria compatível. | Criar/editar/desativar/marcar notificado. | 1. Escolher tipo/referência. 2. Validar. 3. Salvar ação permitida. 4. Consultar. | Vínculo imutável; marcação não prova envio externo e referência histórica indisponível não bloqueia demais edições. |
| CU-DASH-01 — conferir visão mensal | Usuário; mês válido. | Abrir/trocar mês. | 1. Consultar agregados. 2. Apresentar saldos/entradas/saídas/recentes. 3. Distinguir vazio/erro/sucesso. | Totais próprios sem excluídos; erro não vira total zero fabricado. |
| CU-REL-01 — analisar período | Usuário; período/filtros válidos. | Solicitar relatório. | 1. Selecionar parâmetros. 2. Validar. 3. Agregar válidas. 4. Apresentar resultado. | Sem transferências como receitas/despesas; intervalo inválido recusa. |
| CU-ML-01 — consultar risco experimental | Usuário; integração configurada. | Solicitar mês objetivo. | 1. Autenticar. 2. Montar histórico anterior. 3. Chamar/validar V2. 4. Apresentar risco/indicadores. | Não treina nem modifica movimentos; ML indisponível/incompatível gera falha, não previsão inventada. |
| CU-AUD-01 — consultar ações | Usuário; eventos próprios. | Abrir auditoria/paginar. | 1. Validar paginação. 2. Buscar próprios. 3. Exibir sanitizado. | Segredos ausentes; paginação inválida recusa. Atomicidade de escrita segue RF-AUD-02 e fontes específicas. |

### Planejamentos compartilhados

| ID e objetivo | Ator e pré-condição específica | Gatilho | Fluxo principal | Resultado e alternativa importante |
| --- | --- | --- | --- | --- |
| CU-PLAN-01 — organizar grupo | Proprietário; vinculado ativo nas leituras permitidas. | Criar/consultar/manter participantes. | 1. Criar ABERTO com proprietário participante. 2. Consultar acessível. 3. Administrar conforme papel/estado. | Histórico preservado; inacessível ocultado, participante manual não ganha acesso autenticado. |
| CU-PLAN-02 — compartilhar gasto | Proprietário/vinculado ativo cria; só proprietário edita/cancela. ABERTO. | Registrar/corrigir gasto. | 1. Validar papel/pagador/divisão. 2. Persistir centavos/divisões. 3. Reconciliar/auditar juntos. 4. Consultar resumo puro. | Divisões somam gasto; papel/estado inválido recusa. Alternativas detalhadas ficam nos fluxos locais. |
| CU-PLAN-03 — acertar/encerrar | Proprietário; vinculado ativo sincroniza/paga como devedor nos estados permitidos. | Acerto ou lifecycle. | 1. Validar ator/estado. 2. Reconciliar. 3. Persistir acerto/transição/auditoria. 4. Consultar situação. | Fechar não exige quitação; arquivar exige FECHADO + QUITADO, cancelar ABERTO + QUITADO. Sem pagamento real/transação pessoal automática. |

<a id="nao-funcionais"></a>
## Requisitos não funcionais

### Exigências já registradas nas fontes

DOCUMENTADO significa exigência localizada, não conformidade demonstrada. Verificação requer cenário próprio e ambiente autorizado. Não generalizar ao sistema garantia provada somente em um módulo.

| ID | Exigência e condição de verificação | Fonte e alcance |
| --- | --- | --- |
| RNF-SEG-01 | Rotas protegidas exigem identidade/sessão válida; token ausente/inválido/expirado e sessão revogada não concedem acesso. | [Auth](#fonte-auth), [Swagger](../../backendnest/swagger.yaml); S2 tem implantação/provas delimitadas. |
| RNF-SEG-02 | Isolar dados/mutações por usuário ou papel compartilhado explícito; verificar A/B, referência forjada e vínculo inconsistente. | [Matriz](#fontes), REQ-IMP-12/REQ-NF-02 de [Planejamentos](../specs/planejamentos-compartilhados/requisitos.md). |
| RNF-SEG-03 | Preservar invariantes C1 a C10 de credenciais; S2 exige que resposta tardia/rede ambígua não restaure autoridade ou contamine outra conta. | [Credenciais](../planejamento/SEGURANCA_CREDENCIAIS_ETAPA_1.md), [Sessões](../planejamento/SEGURANCA_SESSOES_ETAPA_2.md); verificar por caso, sem declarar etapa encerrada. |
| RNF-INT-01 | Respeitar positividade/não negatividade e precisão contratada; recusar entrada inválida e testar limites/arredondamento. Divisão inteira/determinística é garantia específica de Planejamentos. | [DTOs/serviços](#fontes), REQ-NF-05 de [Planejamentos](../specs/planejamentos-compartilhados/requisitos.md); não descreve toda persistência financeira. |
| RNF-INT-02 | Preservar atomicidade e invariantes concorrentes onde explicitamente transacional; induzir falha/concorrência em banco isolado e verificar estado final. | [Pagamentos](#fonte-pagamentos), [Orçamentos](#fonte-orcamentos), [Planejamentos](#fonte-planejamentos); idempotência não é garantia geral de POST financeiro. |
| RNF-PRIV-01 | Não retornar senha em texto claro ou hash; tokens só podem constar nas respostas autorizadas de autenticação/refresh ao cliente destinatário, sem vazamento em outras respostas, erros ou logs. Registrar consentimento no cadastro e verificar sucesso/falha. | [Auth](#fonte-auth), [Perfil](#fonte-perfil), [Auditoria](#fonte-auditoria). Retenção/base legal completa em D-PRIV. |
| RNF-AUD-01 | Preservar histórico nos fluxos de exclusão lógica; mutação com auditoria transacional não confirma sem seu evento. | [Transações](#fonte-transacoes), [Pagamentos](#fonte-pagamentos), REQ-NF-08 de [Planejamentos](../specs/planejamentos-compartilhados/requisitos.md). |
| RNF-CONTRATO-01 | Manter Swagger como contrato oficial e coerência cliente/servidor em payload/status. Divergência é pendência, não contrato implícito novo. | [Governança](../README.md#governança-documental), [Swagger](../../backendnest/swagger.yaml); D-CONTRATO. |
| RNF-TESTE-01 | Rastrear regras/jornadas a verificações pertinentes; mock de delegação não prova transação, browser, dispositivo ou deploy. | [Estratégia geral](../desenvolvimento/TESTES.md), [Frontend](../desenvolvimento/TESTES_FRONTEND.md), REQ-NF-07 de [Planejamentos](../specs/planejamentos-compartilhados/requisitos.md). |

### Propostas de qualidade móvel e operacional

Os itens abaixo permanecem **PROPOSTOS / PENDENTES de baseline e aceite**, motivados pelas lacunas da [arquitetura frontend](../arquitetura/FRONTEND.md). Existem implementações locais parciais registradas a seguir; elas não aprovam a proposta nem certificam atendimento integral. Sem parâmetros das decisões associadas, critérios quantitativos ainda não estão prontos para aceite.

| ID | Proposta e resultado a observar | Verificação prevista e decisão |
| --- | --- | --- |
| RNF-MOB-01 | Nome/papel/estado acessível nos controles, erros associados a campos e tarefas essenciais operáveis por leitor de tela sem depender só de cor. | Executar CUs essenciais com TalkBack/VoiceOver; D-MOB define critérios/alcance. WCAG2ICT é orientação informativa, não certificação. |
| RNF-MOB-02 | Campos, mensagens e ações alcançáveis com teclado aberto, safe areas e texto ampliado nas telas suportadas, sem perder conteúdo necessário à tarefa. | Testar formulário/modal em telas/orientações/escalas aprovadas; D-MOB define matriz e tamanhos, sem inventar OS/dispositivo mínimo. |
| RNF-MOB-03 | Voltar e foco consistentes: fechar sobreposição antes de sair, isolar conteúdo bloqueado do leitor de tela e devolver foco à origem. | Verificar menus/diálogos/edição no Android/iOS suportado; D-MOB. |
| RNF-MOB-04 | Preservar rascunho ao alternar aplicativos/retomar sessão sem revelar dados antes da revalidação nem transferi-los a outra conta. | Background/resume/expiração/troca de conta; D-RASCUNHO define armazenamento/duração/descarte, não persistência indefinida presumida. |
| RNF-REDE-01 | Distinguir carregamento, vazio, rejeição, indisponibilidade e resultado desconhecido; falha transitória não destrói sessão/rascunho arbitrariamente. | Perda de rede/timeout em CU-ACESSO-02, CU-TRANS-01 e CU-TRF-01; D-REDE define tempos/UX. |
| RNF-REDE-02 | Evitar duplicação financeira no reenvio de escrita com resultado desconhecido, preservando intenção até confirmação/conciliação. | Simular commit com resposta perdida e reenvio; D-REDE define política/contrato. Botão desabilitado não prova deduplicação no servidor. |
| RNF-DESEMP-01 | Carregar/navegar históricos e agregações com limites adequados ao volume esperado. | Medir latência/percentis, memória, listas e concorrência; D-DESEMP define dataset/hardware/rede/metas. Nenhum limiar/SLO está aprovado aqui. |
| RNF-OPER-01 | Definir disponibilidade e recuperar dados/serviço após falha sem reativar sessões revogadas. | Ensaio autorizado de backup/restauração/rollback; D-OPER define ambiente/janelas/RPO/RTO/retenção. Ensaio local não prova produção. |
| RNF-COMPAT-01 | Executar jornadas essenciais em plataformas/versões explicitamente suportadas, inclusive ciclo de vida nativo. | Matriz com dispositivos reais e recursos assistivos; D-MOB define versões, responsáveis e abrangência. |

<a id="rnf-acompanhamento-local"></a>
### Acompanhamento local dos 18 RNFs — 2026-10-21

Prova focalizada, não declaração de conformidade. Comandos, resultados, falhas e escopo estão no [acompanhamento da auditoria](../validacao/AUDITORIA_ESTADO_ATUAL_SISTEMA_2026-10-15.md#acompanhamento-local-2026-10-21). As decisões de baseline continuam pendentes.

| RNF | Implementação ou evidência local | Limite ainda aberto |
| --- | --- | --- |
| RNF-SEG-01 | Autoridade/fail-closed existentes preservados; rascunho só é restaurado para proprietário reconfirmado. | Não requalifica toda autenticação nem revogação em dispositivo. |
| RNF-SEG-02 | Cache segregado por identidade/sessão/geração; permissões e listas compartilhadas são recarregadas, não armazenadas. | Mocks de formulário não substituem isolamento A/B e concorrência em banco. |
| RNF-SEG-03 | Respostas obsoletas não alteram formulário remontado; logout/geração/identidade invalidam cache. | Não encerra invariantes C1–C10/S2 nem prova lifecycle nativo. |
| RNF-INT-01 | Agrupamentos monetários, comissão inválida, precisão e limites de 17 DTOs/24 campos têm regressões locais. | Esquema implantado desconhecido; somas em ponto flutuante não foram reescritas. |
| RNF-INT-02 | Criação de transferência com chave usa unicidade por usuário e impressão original imutável; repetição/exclusão lógica têm testes unitários. | Migração 0018 NOT_APPLIED; concorrência real NOT_RUN; sem garantia geral de POST. |
| RNF-PRIV-01 | Rascunho contém somente campos editáveis e três identificadores opacos; projeção pública de transferência exclui metadados internos. | Não certifica logs, retenção, base legal ou todos os endpoints. |
| RNF-AUD-01 | Replay de transferência não duplica evento de criação; chave de registro excluído não ressuscita entidade, em testes unitários. | Auditoria transacional integral em banco não executada. |
| RNF-CONTRATO-01 | Swagger local inclui sessão, alocações, limites, paginação de transferências e chave opcional/409. | Leitura/YAML não comprovam integração HTTP completa nem aceite. |
| RNF-TESTE-01 | Registros distinguem RED/GREEN, tipos, falhas existentes e execuções parciais. | Não há PASS global, de CI ou de dispositivo por herança. |
| RNF-MOB-01 | Pagamento tem nomes, dicas e erros contextuais/alerta; regressão de componente. | TalkBack/VoiceOver e tarefas completas NOT_RUN. |
| RNF-MOB-02 | Confirmação de sessões tem safe area, ajuste de teclado e rolagem próprios; teste de estrutura. | Teclado, orientação, texto ampliado e dispositivos reais NOT_RUN. |
| RNF-MOB-03 | Menu usa Modal transparente, Voltar/escape e foco versionado; iOS espera onDismiss e Android pós-commit. | Testes usam mocks; foco e leitor de tela nativos NOT_RUN. |
| RNF-MOB-04 | Transferência/transação e 11 outros formulários existentes usam rascunhos em memória, hidratação protegida e descarte explícito; intenção de transferência pendente segue a exceção de CU-TRF-01. | Prova de campos representativos; reinício perde rascunho; política de produto não aprovada. |
| RNF-REDE-01 | Prazo padrão finito de 15 s preserva prazos curtos explícitos; transferência distingue resultado desconhecido. | Não é SLO nem nova repetição automática de mutação; cenários reais de rede NOT_RUN. |
| RNF-REDE-02 | Chave/payload original permanecem após resultado desconhecido; mudança não gera automaticamente nova intenção. | Só criação de transferência com chave; implantação depende de 0018 e prova concorrente. |
| RNF-DESEMP-01 | Históricos solicitam páginas de 50; transferência limita API a 100 e ordena por data/criação/ID. | Latência, carga, agregações e metas quantitativas NOT_RUN. |
| RNF-OPER-01 | Nenhuma mudança operacional ou aplicação de migração nesta correção. | Backup/restauração/rollback/disponibilidade NOT_RUN. |
| RNF-COMPAT-01 | Tipos e testes locais de componentes passam nos escopos registrados, sem afirmar matriz de plataforma. | Android/iOS, tecnologias assistivas e ciclo de vida reais NOT_RUN. |

<a id="decisoes"></a>
## Decisões pendentes e limites de aceite

Não preencher lacunas com números ou escolhas presumidas. Cada decisão requer aprovação humana identificável antes de virar baseline; o responsável ainda precisa ser definido, não foi inferido do código.

| ID | O que decidir ou reconciliar | Como fechar |
| --- | --- | --- |
| D-BASELINE | Comportamentos aprovados, jornadas essenciais, prioridades e autoridade de aceite. | Revisar RF/CU com produto e registrar data/escopo de aprovação; implementação local não basta. |
| D-CONTRATO | Manter coerência e governança do contrato público. As omissões locais de sessão e alocações foram reconciliadas no Swagger em 2026-10-21. | Revisar alterações futuras contra controller/DTO/service e validar integração/aceite; reconciliação estática não certifica toda a API. |
| D-MOB | Plataformas/versões/dispositivos, telas/orientações, escalas, acessibilidade e jornadas obrigatórias. | Aprovar matriz pequena representativa e critérios observáveis, depois executar verificações. Sem alegação de conformidade WCAG. |
| D-RASCUNHO | Aprovar política de conteúdo, duração e descarte; implementação local usa somente memória do processo e campos editáveis, sem durabilidade prometida. | Validar isolamento/retomada e política de privacidade; encerramento do processo perde o rascunho por projeto. |
| D-REDE | Aprovar tempos/UX e conciliação por operação. O padrão técnico local de 15 s não é SLO; intenção idempotente é opcional e restrita à criação de transferência. | Validar falhas antes do envio e após commit, inclusive banco concorrente após migração autorizada; não generalizar para todo POST. |
| D-DESEMP | Volume, concorrência, hardware/rede e objetivos de latência/memória. | Aprovar metas e dataset antes de medir; objetivo sem número/contexto não permite aceite quantitativo. |
| D-OPER | Implantação, disponibilidade, backup, RPO/RTO, retenção e responsabilidade operacional. | Aprovar objetivos e ensaiar restauração/rollback autorizado; P3 local não equivale a liberação P4/produção. |
| D-PRIV | Finalidades/bases, retenção/direitos e uso de dados reais em ML/canais de e-mail. | Revisão de produto/privacidade com evidência aplicável; tela LGPD/consentimento não encerram decisões. |

<a id="fontes"></a>
## Matriz de fontes e verificações existentes

Caminho: **RF → CU → domínio/fonte abaixo → contrato, regras e testes**. O [Swagger](../../backendnest/swagger.yaml) define endpoints/DTOs/status; [manual](MANUAL_DO_USUARIO.md), [arquitetura](../arquitetura/ARQUITETURA.md) e [matriz frontend](../desenvolvimento/TESTES_FRONTEND.md) complementam comportamento. Código não substitui decisão de produto; registrar divergência em vez de ocultá-la.

As 14 áreas anteriores foram preservadas e ampliadas com perfil/sessões e Planejamentos. Arquivos abaixo localizados por leitura estática em 2026-10-20, **sem execução naquela revisão**. Os testes focalizados posteriores estão separados no acompanhamento de 2026-10-21; presença da suíte não prova cobertura integral de critérios.

| Domínio / fonte | Testes de serviço/regra | Controller / DTO | Integração, complemento e lacuna |
| --- | --- | --- | --- |
| <a id="fonte-auth"></a>Auth/sessões — [controller](../../backendnest/src/auth/auth.controller.ts), [C1–C10](../planejamento/SEGURANCA_CREDENCIAIS_ETAPA_1.md), [S2-01–S2-12](../planejamento/SEGURANCA_SESSOES_ETAPA_2.md) | [Auth](../../backendnest/src/auth/auth.service.spec.ts), [JWT](../../backendnest/src/auth/strategies/jwt.strategy.spec.ts) | [Controller](../../backendnest/src/auth/auth.controller.spec.ts) | [Fluxo financeiro](../../backendnest/test/app.e2e-spec.ts), [Credenciais](../../backendnest/test/credential-boundaries.e2e-spec.ts), [Sessões](../../backendnest/test/session-boundaries.e2e-spec.ts). [Resultado credenciais](../validacao/SEGURANCA_CREDENCIAIS_ETAPA_1_RESULTADO.md) e [Resultado U6](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md) têm limites próprios, não provam deploy. |
| <a id="fonte-perfil"></a>Perfil/CEP/privacidade — [manual](MANUAL_DO_USUARIO.md), [cadastro](../../backendnest/src/auth/dto/register.dto.ts), [privacidade](../../frontend/src/modules/auth/screens/PrivacidadeScreen.tsx) | [Users](../../backendnest/src/users/users.service.spec.ts), [CEP](../../backendnest/src/cep/cep.service.spec.ts) | [Users controller](../../backendnest/src/users/users.controller.spec.ts) | [Privacidade frontend](../../frontend/src/modules/auth/__tests__/privacidade-screen.test.tsx); demais lacunas na matriz frontend. |
| <a id="fonte-contas"></a>Contas/saldo — [service](../../backendnest/src/contas/contas.service.ts) | [Contas](../../backendnest/src/contas/contas.service.spec.ts) | [Controller](../../backendnest/src/contas/contas.controller.spec.ts), [DTO](../../backendnest/src/contas/dto/conta.dto.spec.ts) | [Fluxo financeiro](../../backendnest/test/app.e2e-spec.ts), [Conta ativa/concorrência](../../backendnest/test/financial-active-account-concurrency.e2e-spec.ts). |
| <a id="fonte-categorias"></a>Categorias — [manual](MANUAL_DO_USUARIO.md) | [Categorias](../../backendnest/src/categorias/categorias.service.spec.ts) | Dedicado não identificado na matriz herdada; reavaliar antes de afirmar ausência atual. | [Fluxo financeiro](../../backendnest/test/app.e2e-spec.ts), [Categoria ativa/concorrência](../../backendnest/test/financial-active-category-concurrency.e2e-spec.ts). |
| <a id="fonte-transacoes"></a>Transações — [service](../../backendnest/src/transacoes/transacoes.service.ts) | [Transações](../../backendnest/src/transacoes/transacoes.service.spec.ts) | [Controller](../../backendnest/src/transacoes/transacoes.controller.spec.ts), [DTO](../../backendnest/src/transacoes/dto/transacao.dto.spec.ts) | [Fluxo financeiro](../../backendnest/test/app.e2e-spec.ts), [Auditoria](../../backendnest/test/transacoes-audit.e2e-spec.ts). |
| <a id="fonte-transferencias"></a>Transferências — [service](../../backendnest/src/transferencias/transferencias.service.ts) | [Transferências](../../backendnest/src/transferencias/transferencias.service.spec.ts), [Saldo](../../backendnest/src/contas/contas.service.spec.ts) | [Controller](../../backendnest/src/transferencias/transferencias.controller.spec.ts), [DTO](../../backendnest/src/transferencias/dto/transferencia.dto.spec.ts) | [Intenção de transferência](../../backendnest/src/transferencias/transfer-intent.spec.ts), [histórico](../../backendnest/src/transferencias/history-pagination.spec.ts), [concorrência preparada](../../backendnest/test/transfer-intent-concurrency.e2e-spec.ts) (NOT_RUN). Deduplicação é opcional por chave na criação, não garantia geral de POST. |
| <a id="fonte-dividas"></a>Dívidas — [manual](MANUAL_DO_USUARIO.md) | [Dívidas](../../backendnest/src/dividas/dividas.service.spec.ts) | [Controller](../../backendnest/src/dividas/dividas.controller.spec.ts), [DTO](../../backendnest/src/dividas/dto/divida.dto.spec.ts) | [Fluxo financeiro](../../backendnest/test/app.e2e-spec.ts), [Dívida ativa/concorrência](../../backendnest/test/financial-active-debt-concurrency.e2e-spec.ts). |
| <a id="fonte-pagamentos"></a>Pagamentos — [service](../../backendnest/src/pagos-divida/pagos-divida.service.ts) | [Pagamentos](../../backendnest/src/pagos-divida/pagos-divida.service.spec.ts) | [Controller](../../backendnest/src/pagos-divida/pagos-divida.controller.spec.ts), [DTO](../../backendnest/src/pagos-divida/dto/pago-divida.dto.spec.ts) | [Fluxo financeiro](../../backendnest/test/app.e2e-spec.ts); verificar rollback real pertinente, não inferir do teste unitário. |
| <a id="fonte-orcamentos"></a>Orçamentos — [service](../../backendnest/src/orcamentos/orcamentos.service.ts), [controller](../../backendnest/src/orcamentos/orcamentos.controller.ts) | [Orçamentos](../../backendnest/src/orcamentos/orcamentos.service.spec.ts) | DTOs de orçamento/alocação incluem limites em [monetary-bounds](../../backendnest/src/common/monetary-bounds.spec.ts); controller dedicado não identificado nesta revisão. Contrato de alocações documentado no Swagger local. | [Unicidade mensal](../../backendnest/test/orcamento-month-constraint.e2e-spec.ts), [Progresso](../../backendnest/test/orcamento-progress.e2e-spec.ts), [Categorias](../../backendnest/test/orcamento-categorias.e2e-spec.ts), [Auditoria](../../backendnest/test/orcamentos-audit.e2e-spec.ts). Corrige “E2E dedicado pendente” pela existência de arquivos, sem novo PASS. |
| <a id="fonte-metas"></a>Metas — [manual](MANUAL_DO_USUARIO.md) | [Metas](../../backendnest/src/metas/metas.service.spec.ts) | Dedicado não identificado na matriz herdada. | [Integridade metas/alertas](../../backendnest/test/metas-alertas-integrity.e2e-spec.ts); valor atual zero/vínculos. |
| <a id="fonte-alertas"></a>Alertas — [manual](MANUAL_DO_USUARIO.md) | [Alertas](../../backendnest/src/alertas/alertas.service.spec.ts) | Dedicado não identificado na matriz herdada. | [Integridade metas/alertas](../../backendnest/test/metas-alertas-integrity.e2e-spec.ts); marcação não comprova entrega. |
| <a id="fonte-dashboard"></a>Dashboard — [arquitetura](../arquitetura/ARQUITETURA.md) | [Dashboard](../../backendnest/src/dashboard/dashboard.service.spec.ts) | [Controller](../../backendnest/src/dashboard/dashboard.controller.spec.ts), [DTO](../../backendnest/src/dashboard/dto/dashboard.dto.spec.ts) | [Dashboard E2E](../../backendnest/test/dashboard.e2e-spec.ts), separado de relatórios. |
| <a id="fonte-relatorios"></a>Relatórios — [manual](MANUAL_DO_USUARIO.md) | [Relatórios](../../backendnest/src/relatorios/relatorios.service.spec.ts) | [Controller](../../backendnest/src/relatorios/relatorios.controller.spec.ts), [DTO](../../backendnest/src/relatorios/dto/relatorio.dto.spec.ts) | [Relatórios E2E](../../backendnest/test/relatorios.e2e-spec.ts); substitui referência conjunta inexistente. |
| <a id="fonte-ml"></a>Previsão — [arquitetura ML](../arquitetura/MACHINE_LEARNING.md), [README ML](../../ml-finance-tcc/README.md) | [Previsões](../../backendnest/src/previsoes/previsoes.service.spec.ts), [Features](../../backendnest/src/previsoes/services/deficit-features.service.spec.ts) | [Controller](../../backendnest/src/previsoes/previsoes.controller.spec.ts), [DTO](../../backendnest/src/previsoes/dto/previsao.dto.spec.ts) | [Previsões E2E](../../backendnest/test/previsoes.e2e-spec.ts), [Testes ML](../../ml-finance-tcc/tests). Treinamento sintético não prova qualidade produtiva. |
| <a id="fonte-auditoria"></a>Audit logs — [estratégia](../desenvolvimento/TESTES.md) | [Segurança de logs](../../backendnest/src/security/logs.service.security.spec.ts) | [Controller](../../backendnest/src/logs/audit-logs.controller.spec.ts), [DTO](../../backendnest/src/logs/dto/audit-logs.dto.spec.ts) | [Audit logs E2E](../../backendnest/test/audit-logs.e2e-spec.ts); paginação/sanitização/isolamento exigem cenários próprios. |
| <a id="fonte-planejamentos"></a>Planejamentos — [requisitos](../specs/planejamentos-compartilhados/requisitos.md), [regras](../specs/planejamentos-compartilhados/regras-de-negocio.md), [fluxos](../specs/planejamentos-compartilhados/fluxos.md), [API](../specs/planejamentos-compartilhados/api.md) | [Service](../../backendnest/src/planejamentos/planejamentos.service.spec.ts) | [Estratégia detalhada](../specs/planejamentos-compartilhados/testes.md) preserva paths/alcance por camada. | [Auditoria E2E](../../backendnest/test/planejamentos-audit.e2e-spec.ts), [Frontend](../../frontend/src/modules/planejamentos/__tests__). Não duplicar catálogo local inteiro. |

### Lacunas da rastreabilidade

- Etiquetas antigas “Coberto”/“Parcial” eram inventário por área, não aceite de cada RF/RNF. Nenhum requisito novo recebe PASS por herança.
- A [matriz frontend](../desenvolvimento/TESTES_FRONTEND.md) detalha tela/service/risco, mas números/resultados são históricos até prova vinculada a candidato; não garantem dispositivo real/acessibilidade.
- Etapas de segurança preservam provas locais e pendências de native/lifecycle, CI e implantação; consultar relatórios atuais antes de afirmar conclusão.
- O [texto acadêmico](../academico/RESULTADOS/SECAO_5_RESULTADOS_DISCUSSAO.md) menciona User Stories; catálogo correspondente não foi localizado nesta revisão. CUs aqui registrados não comprovam retroativamente aquele artefato.
- `.specify` contém modelos não preenchidos e não é baseline. Materiais didáticos na raiz e `docs/arquivo/` não substituem requisitos vigentes.

<a id="historico"></a>
## Histórico técnico preservado

Registros herdados da versão anterior, **sem data/candidato explícitos**, mantidos como histórico documental. Não foram reexecutados nem validados como resultado atual em 2026-10-20.

- Fase 0 registrou alinhamento do E2E ao contrato global: `ValidationPipe`, `ResponseInterceptor` e filtro por `APP_FILTER`.
- Fase 1 registrou [helpers](../../backendnest/test/helpers) e [factories](../../backendnest/test/factories) E2E.
- Fase 2 registrou controller/DTO tests de contas, transações, transferências, dívidas, pagamentos, dashboard, relatórios, previsões e audit logs.
- Fase 3 foi descrita como E2E dedicado de dashboard, relatórios, audit logs e previsão com ML controlado. Localizar arquivos não renova a validade da prova antiga.
- Fluxo financeiro integrado foi descrito como cadastro/login A/B, contas, categorias, receita/despesa, saldo, isolamento, exclusão lógica, transferência e pagamento com despesa associada.

| Registro herdado | Resultado relatado à época | Limite |
| --- | --- | --- |
| `backendnest`: Jest com `test/metas-alertas-integrity.e2e-spec.ts` | 1 suíte / 1 teste passando | Focalizado; data/candidato não registrados aqui. |
| `backendnest`: `npm test -- --runInBand` | 42 suítes / 198 testes passando | Posterior à Fase 2, não baseline atual. |
| `backendnest`: `npm run test:e2e` | 4 suítes / 6 testes passando | Não representa todas as suítes existentes hoje. |
| `frontend`: suíte crítica financeira, analítica e auditoria | 18 suítes / 77 testes passando | Não comprova comportamento em dispositivo real. |
| `ml-finance-tcc`: `pytest tests -p no:cacheprovider` | 15 testes passando | Suíte inicial de loader, preprocessamento, persistência/API; não qualidade produtiva. |

A recomendação anterior de ampliar telas de categorias, metas, orçamentos, alertas e usuário fica como contexto histórico. Prioridades atuais dependem de D-BASELINE e matrizes específicas, não da contagem antiga.

## Manutenção proporcional e referências

Manter este índice no documento existente evita espalhar RF/CU/RNF em novas suítes de arquivos. Uma linha por resultado verificável e links para detalhes reduzem duplicação; separar critérios independentes sem transformar cada campo/endpoint em requisito novo.

Ao mudar comportamento: preservar ID, atualizar RF/CU e fonte afetados, explicitar estado/decisão e anexar prova no documento de validação existente. Proposta só muda de estado após decisão humana registrada. Não criar ferramentas/frameworks/rituais para manter estas tabelas.

Referências consultadas em **2026-10-20**, adaptadas proporcionalmente, sem alegação de conformidade com normas ou adoção de processo aeroespacial:

- [NASA — How to Write a Good Requirement](https://www.nasa.gov/reference/appendix-c-how-to-write-a-good-requirement/): clareza, singularidade e verificação; evitar qualidade vaga e solução técnica desnecessariamente prescrita.
- [NASA — Systems Engineering Handbook, apêndice D](https://www.nasa.gov/reference/system-engineering-handbook-appendix/): identificação e ligação requisito/fonte/verificação, sem importar estrutura completa do manual.
- [IREB — RE for Testers](https://re-magazine.ireb.org/articles/requirements-engineering-for-testers): critérios observáveis e atributos suficientes para testar/manter sem excesso de metadados.
- [W3C — WCAG2ICT Overview](https://www.w3.org/WAI/standards-guidelines/wcag/non-web-ict/): orientação informativa para acessibilidade de software não web, inclusive móvel; não é certificação nem substitui critérios/testes aprovados do produto.
