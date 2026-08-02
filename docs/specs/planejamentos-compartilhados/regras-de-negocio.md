# Planejamentos Compartilhados - Regras de negocio

## Status

Estas regras descrevem o modulo implementado. Itens futuros aparecem apenas na
secao de roadmap. O contrato HTTP oficial permanece em
`backendnest/swagger.yaml`.

## Autenticacao, acesso e propriedade

Todas as rotas exigem usuario autenticado.

### Proprietario

O proprietario e identificado por `planejamento.usuarioCriadorId` igual ao ID
do usuario autenticado. Ele nao depende de uma linha de participante para ter
acesso. Conforme estado e regras financeiras, pode administrar participantes,
gastos, acertos e lifecycle.

### Participante vinculado ativo

O acesso compartilhado exige que uma unica linha de
`ParticipantePlanejamento` atenda simultaneamente:

```text
usuarioId correspondente + tipo VINCULADO + status ATIVO
```

Esse ator pode ler o agregado completo, criar gasto em `ABERTO`, sincronizar
acertos em `ABERTO` ou `FECHADO` e pagar seu proprio acerto quando representa o
devedor. Nao pode administrar participantes, editar ou cancelar gastos,
cancelar ou reabrir acertos nem executar lifecycle.

`MANUAL`, `CONVIDADO`, `PENDENTE` e `REMOVIDO` nao concedem capacidade
autenticada. A autorizacao e fail-closed: planejamento ou identidade ausente,
ou linha inconsistente `MANUAL`/`CONVIDADO` com `usuarioId`, resulta em ausencia
de acesso. Recursos inacessiveis retornam `404 PLANEJAMENTO_NOT_FOUND`.

## Criacao do agregado

- nome e tipo do planejamento sao obrigatorios;
- descricao, data inicial e data final sao opcionais;
- o periodo deve ser valido quando as duas datas forem informadas;
- o status inicial e `ABERTO`;
- o participante proprietario e criado ou reutilizado com `usuarioId` do
  criador, tipo `VINCULADO` e status `ATIVO`;
- planejamento, participante e `PLANEJAMENTO_CRIADO` compartilham a mesma
  transacao;
- falha da auditoria provoca rollback integral.

## Participantes

- adicionar e remover participante e exclusivo do proprietario e permitido
  somente em planejamento `ABERTO`;
- nome e obrigatorio; email e `usuarioId` sao opcionais no DTO atual;
- participante com `usuarioId` e criado como `VINCULADO`; sem `usuarioId`, como
  `MANUAL`;
- `CONVIDADO` existe no enum, mas nao existe fluxo de convite por token;
- o status inicial de uma nova inclusao e `ATIVO`;
- duplicidades ativas por usuario, email ou nome manual sao rejeitadas;
- remover altera `ATIVO` para `REMOVIDO`, sem exclusao fisica;
- o participante que representa o proprietario nao pode ser removido;
- participantes removidos deixam de ser selecionaveis em novas operacoes, mas
  permanecem em gastos, divisoes, acertos e resumo historicos.

Nao existem atualmente endpoint dedicado de listagem nem edicao de
participante. A colecao e lida pelo detalhe do planejamento.

## Gastos e divisoes

- criar gasto e permitido ao proprietario ou participante vinculado ativo,
  somente em `ABERTO`;
- editar e cancelar gasto e exclusivo do proprietario, somente em `ABERTO` e
  para gasto `ATIVO`;
- descricao, valor positivo em centavos, data, comportamento, pagador e lista
  de participantes sao obrigatorios na criacao;
- categoria, observacao e mes de referencia sao opcionais;
- o pagador e todos os participantes da divisao pertencem ao mesmo
  planejamento;
- o pagador nao precisa estar na divisao;
- valor menor que a quantidade de participantes e rejeitado;
- a divisao e igualitaria, inteira e deterministica;
- a soma das linhas de divisao equivale exatamente ao valor do gasto;
- alteracao textual salva apenas o gasto; alteracao de pagador reconcilia
  acertos; alteracao de valor ou participantes cancela as divisoes ativas,
  cria novas divisoes e reconcilia;
- update semanticamente equivalente e no-op: nao salva, nao reconcilia e nao
  audita;
- cancelamento e logico, cancela as divisoes ativas, preserva o historico e
  reconcilia acertos;
- nenhuma dessas operacoes cria transacao financeira pessoal.

### Distribuicao de centavos

Para um gasto dividido entre `quantidadeParticipantes`:

```text
base = floor(valorCentavos / quantidadeParticipantes)
resto = valorCentavos % quantidadeParticipantes
```

Cada participante recebe inicialmente `base`. Os primeiros `resto`
participantes recebem mais um centavo. Na criacao do gasto, a sobra acompanha a
ordem de `participantesIds` recebida. Na atualizacao financeira, o service
ordena canonicamente os IDs antes de recalcular as divisoes. Apenas inverter a
ordem do mesmo conjunto de participantes nao modifica a distribuicao
persistida. A soma das divisoes deve ser exatamente igual ao valor do gasto. A
operacao rejeita valores menores que a quantidade de participantes, pois
nenhuma divisao pode receber zero centavos.

`PENDENTE_REVISAO` existe e bloqueia fechamento, mas o fluxo de replicacao que
criaria gastos nesse estado ainda e roadmap. Gastos `PENDENTE_REVISAO` nao
integram o resumo financeiro oficial.

## Calculos financeiros

- valores monetarios sao inteiros em centavos;
- total pago considera gastos `ATIVO` pelo pagador;
- total devido considera divisoes `ATIVA` de gastos `ATIVO`;
- acertos `PAGO` e `CONFIRMADO` reduzem o saldo aberto;
- acertos `PENDENTE` e `CANCELADO` nao sao pagamento efetivo;
- a situacao e `QUITADO` somente quando todos os saldos abertos sao zero;
- consultas `GET` de detalhe, gastos, resumo e acertos sao puras e nao
  materializam reconciliacao.

Para cada participante:

```text
saldoBrutoCentavos =
  totalPagoCentavos - totalDevidoCentavos

saldoAbertoCentavos =
  saldoBrutoCentavos
  + totalPagoEmAcertosCentavos
  - totalRecebidoEmAcertosCentavos
```

A situacao financeira e a obrigacao residual sao derivadas de
`saldoAbertoCentavos`. A soma dos saldos abertos de todos os participantes deve
ser zero. Saldo aberto positivo representa credito, saldo aberto negativo
representa obrigacao e saldo aberto zero representa participante quitado. A
obrigacao residual do planejamento soma somente o lado credor dos saldos
abertos, evitando dupla contagem entre devedores e recebedores.

## Acertos

Acertos oficiais sao persistidos e reconciliados depois de mutacoes financeiras
ou pela sincronizacao explicita. O plano distingue acertos pendentes
preservados, obsoletos cancelados e novos acertos.

### Acertos minimos

O calculo separa devedores e recebedores. Os dois grupos ficam ordenados pela
ordem deterministica dos participantes fornecida a funcao, sem reordenacao por
valor. Cada acerto usa o menor valor entre a divida restante e o credito
restante; os dois saldos sao reduzidos ate zerar. Valores zero nao sao
materializados. A mesma entrada ordenada produz os mesmos acertos na mesma
ordem. Acertos `PAGO` permanecem como fatos historicos, e a reconciliacao altera
somente as pendencias restantes.

### Sincronizacao

- proprietario e participante vinculado ativo podem sincronizar em `ABERTO` ou
  `FECHADO`;
- a operacao usa lock pessimista do planejamento;
- plano sem novos ou obsoletos e no-op, sem save e sem audit log;
- concorrencia serializada produz apenas um evento para a escrita vencedora.

### Pagamento

- somente acerto `PENDENTE` pode passar para `PAGO`;
- o proprietario pode pagar qualquer acerto do planejamento;
- participante vinculado ativo pode pagar apenas quando seu participante e o
  `deParticipanteId` do acerto;
- o endpoint nao recebe body; `dataPagamento` recebe o instante da operacao;
- o pagamento e permitido em planejamento `ABERTO` ou `FECHADO`;
- a operacao reconcilia as obrigacoes sem alterar gastos ou divisoes.

### Cancelamento

- e exclusivo do proprietario;
- aceita origem `PENDENTE` ou `PAGO`;
- altera o status para `CANCELADO`;
- quando a origem e `PAGO`, limpa `dataPagamento` e remove o efeito financeiro
  do pagamento antes da reconciliacao;
- permanece permitido em `ABERTO` ou `FECHADO`.

### Reabertura

- e exclusiva do proprietario;
- somente `PAGO` pode voltar para `PENDENTE`;
- preserva o mesmo ID e exige que a obrigacao continue valida;
- limpa a data de pagamento, reconcilia e valida o plano resultante;
- acerto `CANCELADO` nao pode ser reaberto;
- permanece permitida em `ABERTO` ou `FECHADO`.

## Lifecycle operacional

O enum persistido e:

```text
ABERTO | FECHADO | ARQUIVADO | CANCELADO
```

A situacao financeira e derivada:

```text
PENDENTE | QUITADO
```

Nao existe `PlanejamentoStatus.QUITADO`.

| Operacao | ABERTO | FECHADO | ARQUIVADO | CANCELADO |
| --- | --- | --- | --- | --- |
| Consultar | permitido | permitido | permitido | permitido |
| Adicionar/remover participante | proprietario | bloqueado | bloqueado | bloqueado |
| Criar gasto | proprietario ou vinculado ativo | bloqueado | bloqueado | bloqueado |
| Editar/cancelar gasto | proprietario | bloqueado | bloqueado | bloqueado |
| Sincronizar acertos | proprietario ou vinculado ativo | proprietario ou vinculado ativo | bloqueado | bloqueado |
| Pagar acerto | proprietario ou devedor vinculado | proprietario ou devedor vinculado | bloqueado | bloqueado |
| Cancelar/reabrir acerto | proprietario | proprietario | bloqueado | bloqueado |
| Fechar | proprietario, conforme regras | bloqueado | bloqueado | bloqueado |
| Arquivar | bloqueado | proprietario, se `QUITADO` | bloqueado | bloqueado |
| Cancelar planejamento | proprietario, se `QUITADO` | bloqueado | bloqueado | bloqueado |

Fechar reconcilia acertos, rejeita gastos `PENDENTE_REVISAO` e nao exige
quitacao. Arquivar exige `FECHADO + QUITADO`. Cancelar exige
`ABERTO + QUITADO`; gasto `PENDENTE_REVISAO` nao bloqueia isoladamente o
cancelamento. `ARQUIVADO` e `CANCELADO` sao terminais e somente leitura.

## Concorrencia e atomicidade

- operacoes que alteram agregados existentes e dependem de consistencia
  concorrente usam transacao, lock pessimista e revalidacao quando previstos
  pelo fluxo;
- a criacao do planejamento usa transacao, mas nao bloqueia um agregado ainda
  inexistente;
- nem toda operacao simples deve ser descrita genericamente como possuidora de
  lock;
- revalidacoes de autorizacao e estado ocorrem dentro da transacao;
- gasto, divisoes, acertos derivados e auditoria fazem parte do mesmo commit;
- falha da auditoria reverte todas as escritas da operacao;
- operacoes concorrentes nao devem duplicar participante, acerto ou evento da
  mesma transicao;
- releituras posteriores ao commit nao ocorrem quando a transacao falha.

## Auditoria transacional

Eventos confirmados no service:

```text
PLANEJAMENTO_CRIADO
PLANEJAMENTO_FECHADO
PLANEJAMENTO_ARQUIVADO
PLANEJAMENTO_CANCELADO
PLANEJAMENTO_PARTICIPANTE_ADICIONADO
PLANEJAMENTO_PARTICIPANTE_REMOVIDO
PLANEJAMENTO_GASTO_CRIADO
PLANEJAMENTO_GASTO_ATUALIZADO
PLANEJAMENTO_GASTO_CANCELADO
PLANEJAMENTO_ACERTOS_SINCRONIZADOS
PLANEJAMENTO_ACERTO_PAGO
PLANEJAMENTO_ACERTO_CANCELADO
ACERTO_PLANEJAMENTO_REABERTO
```

O nome legado `ACERTO_PLANEJAMENTO_REABERTO` e preservado. Todos usam
`logEntityEventTransactional` com o mesmo `EntityManager` da mutacao e sao a
ultima escrita logica. Payloads usam IDs, status e dados operacionais minimos;
nao registram nomes, emails, observacoes, DTOs ou entidades completas.

## Roadmap / futuro

- edicao de dados basicos do planejamento;
- listagem dedicada e edicao de participante;
- convites por token;
- replicacao mensal;
- upload real de comprovante;
- confirmacao pelo recebedor;
- divisao percentual ou manual avancada;
- integracao automatica com transacoes pessoais.
