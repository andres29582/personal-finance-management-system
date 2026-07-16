# Planejamentos Compartilhados - Requisitos

> Nota de status:
> Este documento contem especificacoes conceituais e itens de roadmap. O
> contrato atual implementado deve ser conferido no Swagger oficial
> (`backendnest/swagger.yaml`) e na validacao documental disponivel em
> `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`.

## Objetivo

Especificar a funcionalidade de Planejamentos Compartilhados como um modulo
independente dentro do backend NestJS atual, mantendo a abordagem de monolito
modular.

O modulo deve permitir que um usuario autenticado crie planejamentos financeiros
compartilhados para eventos, festas, viagens, casa compartilhada ou grupos,
registre participantes manuais, informe gastos pagos por diferentes pessoas,
calcule divisoes igualitarias em centavos e acompanhe acertos pendentes ou
pagos.

Nesta fase a entrega e apenas documental. Nao devem ser criadas entidades,
migrations, controllers, services, telas ou alteracoes de banco de dados.

## Problema resolvido

O sistema financeiro pessoal controla hoje dados individuais do usuario, como
contas, transacoes, transferencias, dividas, metas, orcamentos, dashboard,
relatorios, auditoria e previsao financeira.

Planejamentos compartilhados resolvem um problema complementar: organizar gastos
que pertencem a um grupo, mas que nao devem ser automaticamente misturados com
as transacoes pessoais do usuario. Exemplos:

- festa em que uma pessoa compra decoracao e outra compra bebidas;
- viagem com despesas pagas por participantes diferentes;
- casa compartilhada com aluguel, internet, luz, agua e mercado;
- grupo eventual com rateio de custos.

A funcionalidade precisa responder quem participou, quem pagou, quanto cada um
deve, quem tem saldo a receber, quem tem saldo a pagar e quais acertos ainda
estao pendentes.

## Visao geral da funcionalidade

Um planejamento compartilhado pertence ao usuario criador. No MVP, somente esse
criador autenticado acessa e administra o planejamento.

Dentro de cada planejamento, o criador pode:

- cadastrar participantes manuais, que nao precisam ter conta no sistema;
- registrar gastos em nome de qualquer participante;
- indicar obrigatoriamente quem pagou cada gasto;
- selecionar quais participantes entram na divisao de cada gasto;
- dividir cada gasto de forma igualitaria entre os participantes selecionados;
- consultar totais pagos, totais devidos, saldo final e status financeiro por
  participante;
- consultar acertos minimos sugeridos entre devedores e recebedores;
- marcar um acerto como pago;
- cancelar ou reabrir acerto pago, mantendo historico e auditoria;
- cancelar gastos sem exclusao fisica;
- replicar planejamentos mensais com participantes e gastos;
- destacar gastos variaveis replicados que precisam de revisao mensal.

O modulo deve ser preparado para evoluir para convidados, participantes
vinculados a usuarios reais, comprovantes com upload, confirmacao de recebimento
e formas avancadas de divisao. Essas evolucoes nao fazem parte do MVP.

## Casos de uso

### UC-01 - Criar planejamento compartilhado

O usuario autenticado cria um planejamento informando nome, tipo, descricao
opcional e, quando aplicavel, mes de referencia.

### UC-02 - Administrar dados basicos do planejamento

O criador lista seus planejamentos, consulta detalhes, edita dados basicos,
arquiva ou cancela um planejamento.

### UC-03 - Cadastrar participantes manuais

O criador adiciona participantes ao planejamento usando dados manuais, como nome
e contato opcional. Os participantes nao precisam ter conta no sistema no MVP.

### UC-04 - Registrar gasto compartilhado

O criador registra um gasto, informa valor em centavos, descricao, data,
participante pagador, comportamento financeiro e participantes que entram na
divisao.

### UC-05 - Calcular divisao igualitaria

O sistema divide o valor total entre os participantes selecionados. A soma das
partes deve fechar exatamente com o valor total, incluindo distribuicao
deterministica de centavos restantes.

### UC-06 - Consultar resumo financeiro

O criador consulta total do planejamento, total pago por participante, total
devido por participante, saldo final e classificacao de cada participante como
devedor, recebedor ou quitado.

### UC-07 - Consultar e pagar acertos

O sistema calcula acertos minimos entre participantes devedores e recebedores. O
criador pode marcar um acerto como pago sem gerar transacao financeira pessoal
automaticamente.

### UC-08 - Reabrir ou cancelar acerto pago

O criador pode reabrir ou cancelar um acerto marcado como pago. A acao deve ser
auditada e preservar historico.

### UC-09 - Editar ou cancelar gasto

O criador pode editar valor, pagador, participantes da divisao e dados basicos
de um gasto. Alteracoes financeiras devem recalcular divisoes, saldos e acertos.
Gastos cancelados permanecem no historico e saem dos calculos.

### UC-10 - Replicar planejamento mensal

O criador replica participantes e gastos de um planejamento mensal anterior para
um novo mes. Gastos variaveis ou configurados como exigindo revisao devem nascer
com status `PENDENTE_REVISAO`.

### UC-11 - Fechar sem exigir quitacao e liquidar posteriormente

O proprietario fecha um planejamento `ABERTO` depois de consolidar os gastos e
reconciliar os acertos. Acertos pendentes sao preservados e podem ser pagos,
cancelados ou reabertos posteriormente sem reabrir o planejamento nem alterar o
periodo original.

### UC-12 - Arquivar historico quitado

O proprietario arquiva somente planejamento `FECHADO` sem obrigacao financeira
residual valida. O planejamento `ARQUIVADO` passa a ser somente leitura.

## Escopo do MVP

- Criar planejamento compartilhado.
- Listar planejamentos do usuario autenticado.
- Visualizar detalhes do planejamento.
- Editar dados basicos do planejamento.
- Arquivar ou cancelar planejamento.
- Adicionar participantes manuais.
- Listar participantes.
- Remover participante sem apagar historico.
- Registrar gasto compartilhado.
- Informar obrigatoriamente quem pagou.
- Selecionar participantes da divisao.
- Dividir gasto igualmente entre selecionados.
- Calcular divisao em centavos.
- Permitir referencia opcional a comprovante, sem upload real obrigatorio.
- Editar gasto compartilhado.
- Cancelar gasto compartilhado sem exclusao fisica.
- Calcular total do planejamento.
- Calcular total pago por participante.
- Calcular total devido por participante.
- Calcular saldo final por participante.
- Calcular quem deve pagar e quem deve receber.
- Listar acertos pendentes.
- Marcar acerto como pago.
- Cancelar ou reabrir acerto pago mantendo auditoria.
- Exibir historico de gastos.
- Exibir historico de acertos.
- Replicar planejamento mensal com participantes e gastos.
- Marcar gastos variaveis replicados como pendentes de revisao.
- Informar mes de referencia ou ultima alteracao do valor replicado.
- Registrar auditoria das acoes principais.
- Impedir vazamento de dados entre usuarios.

## Fora de escopo

- Microservico separado.
- Convites reais por email.
- Acesso real por token seguro.
- Participantes obrigatoriamente vinculados a usuarios reais.
- Upload real de comprovantes.
- Confirmacao de recebimento pelo participante recebedor.
- Divisao por porcentagem.
- Divisao manual avancada.
- Notificacoes.
- Integracao automatica com transacoes pessoais.
- Integracao com Open Finance.
- Dashboard global com planejamentos.
- Relatorios avancados.
- Pagamentos reais ou integracao com gateway de pagamento.
- Criacao automatica de transacoes financeiras ao marcar acerto como pago.

## Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O sistema deve permitir que o usuario autenticado crie um planejamento compartilhado. |
| RF-02 | O sistema deve listar apenas planejamentos pertencentes ao usuario autenticado. |
| RF-03 | O sistema deve permitir consulta de detalhes de um planejamento do usuario autenticado. |
| RF-04 | O sistema deve permitir edicao de dados basicos do planejamento. |
| RF-05 | O sistema deve permitir arquivar, cancelar ou fechar planejamento conforme status permitido. |
| RF-06 | O sistema deve permitir adicionar participantes manuais ao planejamento. |
| RF-07 | O sistema deve permitir listar participantes do planejamento. |
| RF-08 | O sistema deve permitir remover participante sem apagar historico. |
| RF-09 | O sistema deve permitir registrar gasto compartilhado com valor, descricao, data, pagador e participantes da divisao. |
| RF-10 | O sistema deve exigir que todo gasto tenha um participante pagador ativo ou historicamente valido no planejamento. |
| RF-11 | O sistema deve permitir dividir gasto entre participantes selecionados. |
| RF-12 | O sistema deve calcular divisao igualitaria em centavos. |
| RF-13 | O sistema deve garantir que a soma das divisoes de um gasto seja igual ao valor total do gasto. |
| RF-14 | O sistema deve distribuir centavos restantes de forma deterministica entre os primeiros participantes da divisao. |
| RF-15 | O sistema deve permitir informar comprovante opcional sem upload real no MVP. |
| RF-16 | O sistema deve permitir editar gasto e recalcular divisoes, saldos e acertos. |
| RF-17 | O sistema deve permitir cancelar gasto sem exclusao fisica. |
| RF-18 | O sistema deve excluir gastos cancelados dos calculos financeiros. |
| RF-19 | O sistema deve calcular total pago por participante. |
| RF-20 | O sistema deve calcular total devido por participante. |
| RF-21 | O sistema deve calcular saldo final por participante. |
| RF-22 | O sistema deve classificar participantes como devedores, recebedores ou quitados. |
| RF-23 | O sistema deve calcular acertos minimos entre devedores e recebedores. |
| RF-24 | O sistema deve permitir listar acertos pendentes. |
| RF-25 | O sistema deve permitir marcar acerto como pago. |
| RF-26 | O sistema deve permitir cancelar ou reabrir acerto pago. |
| RF-27 | O sistema deve preservar historico de gastos, cancelamentos e acertos. |
| RF-28 | O sistema deve permitir replicar planejamento mensal com participantes e gastos. |
| RF-29 | O sistema deve criar gastos variaveis replicados com status `PENDENTE_REVISAO`. |
| RF-30 | O sistema deve registrar mes de referencia e ultima alteracao de valor de gastos replicados. |
| RF-31 | O sistema deve registrar auditoria nas acoes principais. |
| RF-32 | O sistema nao deve criar transacoes pessoais automaticamente a partir de gastos ou acertos do planejamento no MVP. |
| RF-33 | O sistema deve tratar o status do planejamento como ciclo operacional e derivar separadamente sua situacao financeira como `PENDENTE` ou `QUITADO`. |
| RF-34 | O sistema deve permitir fechar planejamento com acertos pendentes, desde que as demais pre-condicoes sejam satisfeitas. |
| RF-35 | O sistema deve manter entidades e historico visiveis em planejamento `FECHADO`, bloqueando a adicao, remocao ou edicao de participantes, a criacao, edicao ou cancelamento de gastos e alteracoes de pagador ou divisoes. |
| RF-36 | O sistema deve permitir pagar e corrigir acertos existentes de planejamento `FECHADO`; a data efetiva deve ser registrada quando informada. |
| RF-37 | O sistema deve permitir arquivar somente planejamento `FECHADO` e financeiramente `QUITADO`. |
| RF-38 | O sistema deve manter planejamento `ARQUIVADO` em somente leitura. |
| RF-39 | O sistema nao deve adicionar `QUITADO` ao enum operacional `PlanejamentoStatus`. |

## Requisitos nao funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | O modulo deve seguir a arquitetura NestJS modular existente. |
| RNF-02 | O modulo deve permanecer dentro do backend atual, sem microservico nesta fase. |
| RNF-03 | O modulo deve usar JWT e guards existentes para autenticar rotas protegidas. |
| RNF-04 | Todas as consultas devem aplicar isolamento por usuario criador. |
| RNF-05 | Valores monetarios devem ser armazenados e calculados em centavos usando inteiros. |
| RNF-06 | Regras financeiras devem ser deterministicas e testaveis em testes unitarios. |
| RNF-07 | Operacoes que alteram gastos, divisoes ou acertos devem ser transacionais quando persistidas. |
| RNF-08 | O contrato HTTP deve ser documentado em Swagger/OpenAPI quando implementado. |
| RNF-09 | A documentacao, commits e PRs relacionados devem ser mantidos em portugues. |
| RNF-10 | O modulo deve ser preparado para evoluir sem impor complexidade de convidados, upload ou integracoes no MVP. |
| RNF-11 | Acertos marcados como pagos devem manter rastreabilidade por historico e auditoria. |
| RNF-12 | Testes E2E devem validar autenticacao e isolamento de dados entre usuarios. |

## Decisoes de MVP

1. O modulo sera implementado como monolito modular.
2. Somente o criador autenticado acessa e administra o planejamento no MVP.
3. Participantes sao manuais no MVP e nao precisam ter conta no sistema.
4. O criador pode registrar gastos em nome de qualquer participante.
5. Cada gasto deve informar obrigatoriamente quem pagou.
6. Cada gasto pode ser dividido entre participantes selecionados.
7. A divisao do MVP e igualitaria entre os participantes selecionados.
8. Valores monetarios devem ser armazenados e calculados em centavos.
9. A distribuicao de centavos deve fechar exatamente com o valor total do gasto.
10. Quando houver sobra de centavos, o sistema deve distribuir os centavos
    restantes de forma deterministica entre os primeiros participantes da
    divisao.
11. Comprovante e opcional.
12. Upload real de comprovante fica fora do MVP.
13. O sistema deve calcular total pago, total devido, saldo final e status
    financeiro por participante.
14. O sistema deve calcular acertos minimos entre devedores e recebedores.
15. No MVP, o criador pode marcar um acerto como `PAGO`.
16. O criador pode cancelar ou reabrir um acerto `PAGO`, mantendo historico e
    auditoria.
17. Confirmacao de recebimento pelo participante recebedor fica para fase
    futura.
18. Gastos cancelados nao sao apagados fisicamente; eles saem dos calculos, mas
    permanecem no historico e na auditoria.
19. Alteracoes em valor, pagador ou participantes da divisao devem recalcular
    divisoes, saldos e acertos.
20. Casa compartilhada mensal pode ser representada por planejamentos mensais
    replicados.
21. O sistema deve permitir replicar participantes e gastos de um planejamento
    mensal anterior para um novo mes.
22. Gastos replicados que exigem revisao mensal devem nascer com status
    `PENDENTE_REVISAO`.
23. O sistema deve informar mes de referencia ou ultima alteracao do valor
    replicado.
24. Gastos variaveis, como luz, agua e mercado, devem exibir alerta de revisao.
25. Integracao automatica com transacoes pessoais fica fora do MVP.
26. Planejamentos nao devem gerar transacoes pessoais automaticas para evitar
    duplicidade futura com Open Finance.
27. O sistema deve permitir marcar acerto como pago sem criar transacao
    financeira automatica.
28. Auditoria e obrigatoria nas acoes principais.
29. Testes E2E devem validar autenticacao e isolamento de dados entre usuarios.
30. O estado do planejamento e operacional; a situacao financeira e derivada e
    nao persistida nesta fase.
31. Fechamento consolida a origem das obrigacoes, mas nao exige quitacao.
32. Pagamentos e correcoes posteriores de acertos existentes continuam
    permitidos em planejamento `FECHADO`. Como regra de dominio, a data efetiva
    do pagamento deve ser registrada quando informada; no contrato atual, que nao
    recebe essa data, registra-se o instante da marcacao como pago.
33. Pagamento tardio nao reabre o planejamento, nao altera o periodo original,
    nao cria gasto e nao modifica divisoes.
34. Arquivamento exige ausencia de obrigacao financeira residual valida e torna
    o planejamento somente leitura.
35. O efeito do cancelamento sobre obrigacoes existentes deve ser decidido antes
    da implementacao do endpoint.
36. `QUITADO` nao deve ser incluido em `PlanejamentoStatus`.

## Decisoes futuras

1. Participantes poderao acessar planejamentos como convidados via web usando
   convite com token seguro e acesso limitado.
2. Conta completa sera opcional para convidados. Caso o convidado queira usar
   todas as funcionalidades, podera ser direcionado para criar conta propria no
   aplicativo.
3. Participantes vinculados a usuarios reais poderao registrar seus proprios
   gastos.
4. Participantes vinculados poderao editar apenas gastos criados por eles.
5. O criador continuara podendo administrar todos os gastos do planejamento.
6. Confirmacao de recebimento pelo recebedor podera ser implementada em fase
   futura.
7. Upload real de comprovantes podera ser implementado em fase futura.
8. Divisao por porcentagem e divisao manual avancada ficam fora do MVP.
9. Recorrencia mensal automatica avancada fica fora do MVP.
10. Integracao com transacoes pessoais, dashboard global e relatorios avancados
    ficam para fases futuras.
