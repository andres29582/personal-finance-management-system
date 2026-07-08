# Planejamentos Compartilhados - Regras de negocio

> Nota de status:
> Este documento contem especificacoes conceituais e itens de roadmap. O
> contrato atual implementado deve ser conferido no Swagger oficial
> (`backendnest/swagger.yaml`) e na validacao documental disponivel em
> `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`.

## Principios gerais

- O planejamento compartilhado pertence ao usuario criador.
- No MVP, apenas o criador autenticado acessa e administra o planejamento.
- Participantes sao entidades do planejamento, nao usuarios obrigatorios do
  sistema.
- Valores monetarios devem ser armazenados e calculados em centavos.
- Gastos cancelados permanecem no historico, mas nao entram em calculos.
- Acertos podem ser marcados como pagos sem gerar transacoes pessoais.
- A integridade financeira do planejamento deve ser deterministica e auditavel.

## Regras de criacao de planejamento

| ID | Regra |
| --- | --- |
| RN-PLAN-01 | Todo planejamento deve ter um usuario criador autenticado. |
| RN-PLAN-02 | O planejamento deve ter nome obrigatorio. |
| RN-PLAN-03 | O tipo deve pertencer aos tipos permitidos: `CASA`, `FESTA`, `VIAGEM`, `EVENTO`, `GRUPO` ou `OUTRO`. |
| RN-PLAN-04 | O status inicial deve ser `ABERTO`, salvo regra futura explicita. |
| RN-PLAN-05 | A descricao e opcional. |
| RN-PLAN-06 | O mes de referencia e opcional para planejamentos gerais e recomendado para planejamentos mensais de casa compartilhada. |
| RN-PLAN-07 | Planejamentos `CANCELADO` ou `ARQUIVADO` nao devem aceitar novos gastos no MVP. |
| RN-PLAN-08 | Planejamentos fechados devem bloquear novas alteracoes financeiras, salvo reabertura futura explicitamente definida. |
| RN-PLAN-09 | Fechamento deve ser feito por endpoint explicito, como `PATCH /planejamentos/:id/fechar`. |
| RN-PLAN-10 | Arquivamento deve ser feito por endpoint explicito, como `PATCH /planejamentos/:id/arquivar`. |
| RN-PLAN-11 | Cancelamento deve ser feito por endpoint explicito, como `PATCH /planejamentos/:id/cancelar`; se `DELETE /planejamentos/:id` for mantido, deve representar cancelamento logico. |
| RN-PLAN-12 | Planejamento com gasto `PENDENTE_REVISAO` nao pode ser fechado. |

## Regras de participantes

| ID | Regra |
| --- | --- |
| RN-PART-01 | O participante deve pertencer a um planejamento existente do usuario autenticado. |
| RN-PART-02 | No MVP, participantes sao criados com tipo `MANUAL`. |
| RN-PART-03 | Participante manual deve ter nome obrigatorio. |
| RN-PART-04 | Email, telefone e observacao do participante sao opcionais no MVP. |
| RN-PART-05 | O status inicial do participante deve ser `ATIVO`. |
| RN-PART-06 | Participante removido deve receber status `REMOVIDO` ou marcador equivalente de remocao logica. |
| RN-PART-07 | Participante removido nao deve ser selecionavel em novos gastos. |
| RN-PART-08 | Participante removido deve continuar aparecendo no historico de gastos, divisoes e acertos ja existentes. |
| RN-PART-09 | Nao deve haver exclusao fisica de participante com vinculo historico. |
| RN-PART-10 | O MVP nao exige que participante tenha conta no sistema. |
| RN-PART-11 | Participante removido com pendencia financeira deve continuar aparecendo no resumo e nos acertos ate quitacao ou compensacao. |

## Regras de convidados futuros

| ID | Regra |
| --- | --- |
| RN-CONV-01 | Convidados ficam fora do MVP. |
| RN-CONV-02 | Em fase futura, convite deve usar token seguro, preferencialmente persistido como hash. |
| RN-CONV-03 | Em fase futura, convite deve ter expiracao, status e escopo de permissao. |
| RN-CONV-04 | Em fase futura, convidado deve ter acesso limitado ao planejamento ao qual foi convidado. |
| RN-CONV-05 | Em fase futura, conta completa deve ser opcional para convidados. |
| RN-CONV-06 | Em fase futura, participante vinculado a usuario real pode registrar seus proprios gastos conforme permissao. |

## Regras de gastos

| ID | Regra |
| --- | --- |
| RN-GASTO-01 | Gasto deve pertencer a um planejamento do usuario autenticado. |
| RN-GASTO-02 | Gasto deve ter descricao obrigatoria. |
| RN-GASTO-03 | Gasto deve ter valor em centavos maior que zero. |
| RN-GASTO-04 | Gasto deve informar obrigatoriamente quem pagou. |
| RN-GASTO-05 | O pagador deve ser participante do mesmo planejamento. |
| RN-GASTO-06 | O criador pode registrar gasto pago por qualquer participante. |
| RN-GASTO-07 | Gasto deve ter pelo menos um participante na divisao. |
| RN-GASTO-08 | Todos os participantes da divisao devem pertencer ao mesmo planejamento. |
| RN-GASTO-09 | O pagador nao precisa necessariamente estar entre os participantes da divisao, embora isso seja comum. |
| RN-GASTO-10 | O status inicial de um gasto novo deve ser `ATIVO`, exceto gastos replicados pendentes de revisao. |
| RN-GASTO-11 | Gastos cancelados nao entram em totais, saldos ou acertos. |
| RN-GASTO-12 | Gastos cancelados permanecem consultaveis no historico. |
| RN-GASTO-13 | Alterar valor, pagador ou participantes da divisao exige recalculo das divisoes. |
| RN-GASTO-14 | Alteracoes financeiras devem invalidar ou recalcular saldos e acertos pendentes. |
| RN-GASTO-15 | Gasto com status `PENDENTE_REVISAO` deve aparecer como alerta para o criador antes de fechamento ou confirmacao mensal. |
| RN-GASTO-16 | Gasto com status `PENDENTE_REVISAO` nao deve gerar acertos oficiais ate ser revisado e confirmado. |

## Regras de comprovante opcional

| ID | Regra |
| --- | --- |
| RN-COMP-01 | Comprovante e opcional no MVP. |
| RN-COMP-02 | Upload real de arquivo fica fora do MVP. |
| RN-COMP-03 | O MVP pode prever campos conceituais para referencia externa, observacao ou URL futura de comprovante. |
| RN-COMP-04 | Ausencia de comprovante nao impede criacao, edicao, divisao ou acerto de gasto. |
| RN-COMP-05 | Em fase futura, comprovantes devem respeitar controle de acesso do planejamento. |

## Regras de divisao

| ID | Regra |
| --- | --- |
| RN-DIV-01 | A divisao do MVP e sempre igualitaria entre os participantes selecionados. |
| RN-DIV-02 | Deve existir uma linha de divisao para cada participante selecionado. |
| RN-DIV-03 | A soma das linhas de divisao deve ser exatamente igual ao valor total do gasto. |
| RN-DIV-04 | O sistema deve persistir ou retornar o valor devido por participante em centavos. |
| RN-DIV-05 | Participantes removidos podem permanecer em divisoes historicas existentes. |
| RN-DIV-06 | Editar participantes da divisao deve substituir o conjunto anterior de divisoes do gasto. |
| RN-DIV-07 | Divisao por porcentagem ou valor manual fica fora do MVP. |
| RN-DIV-08 | No MVP, nao deve ser permitida divisao quando `valorCentavos` for menor que a quantidade de participantes selecionados. |

## Regras de centavos e arredondamento

| ID | Regra |
| --- | --- |
| RN-CENT-01 | Nenhum calculo monetario deve depender de ponto flutuante. |
| RN-CENT-02 | O valor base de cada participante deve ser `Math.floor(valorCentavos / quantidadeParticipantes)` ou equivalente inteiro. |
| RN-CENT-03 | A sobra deve ser `valorCentavos % quantidadeParticipantes`. |
| RN-CENT-04 | Os centavos restantes devem ser distribuidos um a um para os primeiros participantes da divisao. |
| RN-CENT-05 | A ordem de distribuicao deve ser deterministica. |
| RN-CENT-06 | A ordem recomendada e a ordem enviada no payload, persistida na divisao, ou uma ordenacao estavel por data de inclusao e identificador. |
| RN-CENT-07 | O mesmo gasto com os mesmos participantes e mesma ordem deve gerar sempre a mesma divisao. |
| RN-CENT-08 | Cada participante selecionado deve receber pelo menos 1 centavo de responsabilidade no MVP. |

Exemplo: gasto de `10000` centavos dividido entre 3 participantes:

- base: `3333`;
- sobra: `1`;
- participante 1: `3334`;
- participante 2: `3333`;
- participante 3: `3333`;
- soma final: `10000`.

## Regras de calculo de saldo por participante

| ID | Regra |
| --- | --- |
| RN-SALDO-01 | Total pago por participante e a soma dos gastos ativos em que ele aparece como pagador. |
| RN-SALDO-02 | Total devido por participante e a soma das divisoes de gastos ativos em que ele aparece como participante de divisao. |
| RN-SALDO-03 | Saldo bruto deve ser `totalPagoCentavos - totalDevidoCentavos`. |
| RN-SALDO-04 | Saldo positivo indica valor a receber. |
| RN-SALDO-05 | Saldo negativo indica valor a pagar. |
| RN-SALDO-06 | Saldo zero indica participante quitado. |
| RN-SALDO-07 | A soma dos saldos finais de todos os participantes deve ser zero. |
| RN-SALDO-08 | Gastos cancelados devem ser ignorados em total pago, total devido e saldo. |
| RN-SALDO-09 | O resumo financeiro oficial deve considerar gastos ativos, divisoes ativas e acertos pagos. |
| RN-SALDO-10 | Acertos pendentes devem ser calculados sobre a pendencia restante apos considerar acertos pagos. |
| RN-SALDO-11 | Gastos `PENDENTE_REVISAO` podem aparecer em totais provisorios separados, mas nao entram em acertos oficiais. |

## Regras de acertos minimos

| ID | Regra |
| --- | --- |
| RN-ACERTO-01 | Acertos devem ser calculados a partir dos saldos finais dos participantes. |
| RN-ACERTO-02 | Participantes com saldo negativo sao devedores. |
| RN-ACERTO-03 | Participantes com saldo positivo sao recebedores. |
| RN-ACERTO-04 | O algoritmo deve reduzir a quantidade de pagamentos necessarios. |
| RN-ACERTO-05 | O algoritmo deve parear devedores e recebedores ate zerar saldos pendentes. |
| RN-ACERTO-06 | O valor de cada acerto deve ser o menor valor absoluto entre a divida do devedor e o credito do recebedor. |
| RN-ACERTO-07 | A soma dos acertos de um devedor deve ser igual ao valor que ele deve pagar, descontados acertos ja pagos quando aplicavel. |
| RN-ACERTO-08 | A soma dos acertos de um recebedor deve ser igual ao valor que ele deve receber, descontados acertos ja pagos quando aplicavel. |
| RN-ACERTO-09 | A ordem de pareamento deve ser deterministica para evitar resultados instaveis entre chamadas. |
| RN-ACERTO-10 | Acertos com valor zero nao devem ser criados ou exibidos. |
| RN-ACERTO-11 | Acertos oficiais devem ser materializados e persistidos apos cada alteracao financeira relevante. |
| RN-ACERTO-12 | Acertos `PENDENTE` podem ser recalculados e substituidos. |
| RN-ACERTO-13 | Acertos `PAGO` nao devem ser apagados automaticamente. |
| RN-ACERTO-14 | Consultas `GET` de resumo ou acertos nao devem alterar o banco de dados. |

## Regras para marcar acerto como pago

| ID | Regra |
| --- | --- |
| RN-PAGAR-01 | Apenas o criador autenticado pode marcar acerto como pago no MVP. |
| RN-PAGAR-02 | O acerto deve pertencer a planejamento do usuario autenticado. |
| RN-PAGAR-03 | Somente acerto `PENDENTE` pode ser marcado como `PAGO`. |
| RN-PAGAR-04 | Marcar como pago deve registrar data/hora da acao. |
| RN-PAGAR-05 | Marcar como pago deve registrar auditoria. |
| RN-PAGAR-06 | Marcar como pago nao deve criar transacao financeira pessoal automaticamente. |
| RN-PAGAR-07 | Confirmacao pelo recebedor fica fora do MVP. |

## Regras para cancelar ou reabrir acerto pago

| ID | Regra |
| --- | --- |
| RN-REABRIR-01 | Apenas o criador autenticado pode cancelar ou reabrir acerto pago no MVP. |
| RN-REABRIR-02 | O acerto deve pertencer a planejamento do usuario autenticado. |
| RN-REABRIR-03 | Somente acerto `PAGO` pode ser reaberto para `PENDENTE` no fluxo principal do MVP. |
| RN-REABRIR-04 | Cancelamento de acerto deve preservar historico e auditoria. |
| RN-REABRIR-05 | Reabertura de acerto deve preservar historico e auditoria. |
| RN-REABRIR-06 | A operacao deve registrar quem executou a acao e quando. |
| RN-REABRIR-07 | Se gastos forem editados apos um acerto pago, a implementacao deve preservar o acerto historico e recalcular pendencias restantes de forma explicita. |
| RN-REABRIR-08 | Cancelar ou reabrir acerto pago deve remover o efeito financeiro daquele pagamento. |
| RN-REABRIR-09 | Apos cancelar ou reabrir acerto pago, o sistema deve recalcular os acertos pendentes. |

## Regras de edicao e cancelamento de gastos

| ID | Regra |
| --- | --- |
| RN-EDIT-01 | Apenas o criador autenticado pode editar ou cancelar gastos no MVP. |
| RN-EDIT-02 | Edicao de valor deve recalcular divisoes e saldos. |
| RN-EDIT-03 | Edicao de pagador deve recalcular total pago e saldos. |
| RN-EDIT-04 | Edicao de participantes da divisao deve recalcular total devido e saldos. |
| RN-EDIT-05 | Edicoes devem registrar auditoria com os campos alterados quando possivel. |
| RN-EDIT-06 | Cancelar gasto deve alterar status para `CANCELADO` ou marcador equivalente. |
| RN-EDIT-07 | Cancelar gasto nao deve apagar suas divisoes historicas. |
| RN-EDIT-08 | Gasto cancelado deve sair de resumo, saldos e acertos. |
| RN-EDIT-09 | Gasto cancelado deve continuar visivel no historico do planejamento. |
| RN-EDIT-10 | Acertos pagos devem permanecer como historico financeiro apos edicao ou cancelamento de gasto. |
| RN-EDIT-11 | Se a edicao ou cancelamento gerar nova pendencia, novos acertos `PENDENTE` devem ser criados para compensacao. |

## Regras de replicacao mensal

| ID | Regra |
| --- | --- |
| RN-REPL-01 | Replicacao mensal deve criar um novo planejamento a partir de um planejamento de origem. |
| RN-REPL-02 | O novo planejamento deve pertencer ao mesmo usuario criador. |
| RN-REPL-03 | Participantes ativos devem ser replicados para o novo planejamento. |
| RN-REPL-04 | Participantes removidos nao devem ser replicados como ativos, salvo decisao explicita futura. |
| RN-REPL-05 | Gastos replicaveis devem ser copiados com novo identificador. |
| RN-REPL-06 | O gasto replicado deve guardar referencia ao gasto de origem quando o modelo permitir. |
| RN-REPL-07 | O novo planejamento deve registrar o mes de referencia informado. |
| RN-REPL-08 | Gasto fixo pode nascer como `ATIVO` quando nao exigir revisao. |
| RN-REPL-09 | Gasto variavel deve nascer como `PENDENTE_REVISAO`. |
| RN-REPL-10 | Gasto eventual nao deve ser replicado por padrao, salvo escolha explicita do criador. |
| RN-REPL-11 | Replicacao nao deve copiar acertos pagos ou pendentes como acertos do novo planejamento. |
| RN-REPL-12 | Replicacao deve registrar auditoria no planejamento de origem e no planejamento criado, quando aplicavel. |

## Regras de gastos fixos, variaveis e eventuais

| ID | Regra |
| --- | --- |
| RN-TIPO-GASTO-01 | `FIXO` representa gasto recorrente com valor normalmente estavel, como aluguel ou internet. |
| RN-TIPO-GASTO-02 | `VARIAVEL` representa gasto recorrente com valor sujeito a mudanca mensal, como luz, agua ou mercado. |
| RN-TIPO-GASTO-03 | `EVENTUAL` representa gasto pontual, como decoracao de festa ou passeio de viagem. |
| RN-TIPO-GASTO-04 | Gastos `VARIAVEL` replicados devem exigir revisao mensal. |
| RN-TIPO-GASTO-05 | Gastos `EVENTUAL` devem ficar fora da replicacao automatica padrao. |
| RN-TIPO-GASTO-06 | O comportamento financeiro do gasto deve ser independente do tipo do planejamento. |

## Regras de revisao mensal

| ID | Regra |
| --- | --- |
| RN-REV-01 | Gasto com status `PENDENTE_REVISAO` deve aparecer em listas e detalhes com indicacao de revisao. |
| RN-REV-02 | Gasto variavel replicado deve nascer como `PENDENTE_REVISAO`. |
| RN-REV-03 | O sistema deve informar o mes de referencia do valor replicado. |
| RN-REV-04 | O sistema deve informar quando o valor do gasto foi alterado pela ultima vez, quando esse dado existir. |
| RN-REV-05 | Ao revisar e confirmar o valor mensal, o gasto pode passar para `ATIVO`. |
| RN-REV-06 | Enquanto estiver `PENDENTE_REVISAO`, o gasto nao deve entrar em acertos oficiais. |
| RN-REV-07 | Gastos `PENDENTE_REVISAO` podem aparecer em totais provisorios separados. |
| RN-REV-08 | A existencia de gasto `PENDENTE_REVISAO` deve bloquear fechamento do planejamento. |

## Regras de auditoria

| ID | Regra |
| --- | --- |
| RN-AUD-01 | Criacao, edicao, arquivamento e cancelamento de planejamento devem ser auditados. |
| RN-AUD-02 | Criacao, edicao e remocao de participante devem ser auditadas. |
| RN-AUD-03 | Criacao, edicao e cancelamento de gasto devem ser auditadas. |
| RN-AUD-04 | Marcacao, cancelamento e reabertura de acerto devem ser auditadas. |
| RN-AUD-05 | Replicacao mensal deve ser auditada. |
| RN-AUD-06 | Auditoria deve registrar usuario autenticado, entidade afetada, acao, data/hora e dados relevantes sanitizados. |
| RN-AUD-07 | Falha ao registrar auditoria nao deve expor dados sensiveis. |

## Regras de isolamento de dados

| ID | Regra |
| --- | --- |
| RN-ISO-01 | Todas as rotas do modulo devem exigir autenticacao no MVP. |
| RN-ISO-02 | Usuario autenticado so pode consultar planejamentos criados por ele. |
| RN-ISO-03 | Usuario autenticado so pode alterar planejamentos criados por ele. |
| RN-ISO-04 | Participantes, gastos, divisoes e acertos devem ser validados contra o planejamento do usuario autenticado. |
| RN-ISO-05 | Identificadores validos de outro usuario nao devem revelar existencia do recurso. |
| RN-ISO-06 | Testes E2E devem cobrir tentativa de acesso cruzado entre usuarios. |

## Regra de nao integracao automatica com transacoes pessoais no MVP

| ID | Regra |
| --- | --- |
| RN-TRANS-01 | Planejamentos compartilhados nao devem criar transacoes pessoais automaticamente no MVP. |
| RN-TRANS-02 | Gasto registrado no planejamento nao deve alterar saldo de conta pessoal. |
| RN-TRANS-03 | Acerto marcado como pago nao deve criar receita, despesa ou transferencia automaticamente. |
| RN-TRANS-04 | A ausencia de integracao automatica deve evitar duplicidade futura com Open Finance. |
| RN-TRANS-05 | Integracao manual ou assistida com transacoes pessoais deve ser tratada como fase futura. |
