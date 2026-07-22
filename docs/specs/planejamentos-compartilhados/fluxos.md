# Planejamentos Compartilhados - Fluxos

> Nota de status:
> Este documento contem especificacoes conceituais e itens de roadmap. O
> contrato atual implementado deve ser conferido no Swagger oficial
> (`backendnest/swagger.yaml`) e na validacao documental disponivel em
> `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`.

## Fluxo de criacao de planejamento

1. Usuario autenticado envia nome, tipo, descricao opcional e mes de referencia
   opcional.
2. Backend valida JWT e identifica `usuarioId`.
3. Backend valida tipo de planejamento.
4. Backend cria planejamento com status `ABERTO`.
5. Backend registra auditoria de criacao.
6. Backend retorna dados basicos do planejamento criado.

Resultado esperado:

- planejamento pertence ao usuario criador;
- nenhum participante, gasto ou acerto e criado automaticamente;
- planejamento fica disponivel na listagem do usuario.

## Fluxo de adicao de participantes

1. Usuario autenticado informa nome do participante e dados opcionais.
2. Backend valida se o planejamento pertence ao usuario autenticado.
3. Backend valida se o planejamento aceita alteracoes.
4. Backend cria participante manual com status `ATIVO`.
5. Backend atribui ordem estavel ao participante.
6. Backend registra auditoria.
7. Backend retorna participante criado.

Resultado esperado:

- participante fica disponivel para novos gastos;
- participante nao precisa ter conta no sistema;
- participante removido futuramente nao apaga historico.

## Fluxo de registro de gasto

1. Usuario autenticado envia descricao, valor em centavos, data, pagador,
   comportamento financeiro, participantes da divisao e comprovante opcional.
2. Backend valida se o planejamento pertence ao usuario autenticado.
3. Backend valida se o planejamento esta apto a receber gastos.
4. Backend valida se o pagador pertence ao planejamento.
5. Backend valida se todos os participantes da divisao pertencem ao
   planejamento.
6. Backend valida valor maior que zero.
7. Backend cria o gasto com status `ATIVO`, salvo regra de revisao.
8. Backend calcula divisoes igualitarias em centavos.
9. Backend persiste ou prepara as linhas de divisao.
10. Backend recalcula resumo e acertos pendentes quando necessario.
11. Backend registra auditoria.
12. Backend retorna gasto com divisoes calculadas.

Resultado esperado:

- soma das divisoes fecha exatamente com o valor do gasto;
- gasto entra nos totais do planejamento;
- nao ha criacao automatica de transacao pessoal.

## Fluxo de calculo de divisao

Entrada:

- `valorCentavos`;
- lista ordenada de participantes da divisao.

Passos:

1. Validar que `valorCentavos > 0`.
2. Validar que ha pelo menos um participante.
3. Calcular `base = floor(valorCentavos / quantidadeParticipantes)`.
4. Calcular `sobra = valorCentavos % quantidadeParticipantes`.
5. Para cada participante, atribuir `base`.
6. Para os primeiros `sobra` participantes na ordem deterministica, adicionar
   `1` centavo.
7. Validar que a soma final e igual a `valorCentavos`.
8. Retornar divisoes com `participanteId`, `valorCentavos` e ordem usada.

Exemplo:

```text
Valor: 10000 centavos
Participantes: Ana, Bruno, Carla
Base: 3333
Sobra: 1

Ana: 3334
Bruno: 3333
Carla: 3333
Total: 10000
```

## Fluxo de calculo de acertos

Este fluxo deve ser executado por operacoes de escrita apos alteracoes
financeiras relevantes. Consultas `GET` devem apenas ler os acertos oficiais ja
materializados.

1. Buscar gastos ativos e revisados do planejamento.
2. Somar total pago por participante.
3. Somar total devido por participante com base nas divisoes dos gastos ativos.
4. Calcular saldo bruto: `totalPagoCentavos - totalDevidoCentavos`.
5. Aplicar acertos `PAGO` para obter a pendencia restante.
6. Substituir acertos `PENDENTE` antigos pelos novos acertos calculados.
7. Separar participantes com saldo restante negativo como devedores.
8. Separar participantes com saldo restante positivo como recebedores.
9. Ordenar devedores e recebedores de forma deterministica.
10. Parear devedor e recebedor usando o menor valor entre divida restante e
   credito restante.
11. Materializar acerto `PENDENTE` com devedor, recebedor e valor.
12. Reduzir divida e credito restantes.
13. Repetir ate todos os saldos ficarem zerados.
14. Ignorar acertos com valor zero.

Resultado esperado:

- menor quantidade pratica de pagamentos entre participantes;
- soma dos acertos pendentes a pagar equivale aos saldos negativos restantes;
- soma dos acertos pendentes a receber equivale aos saldos positivos restantes;
- resultado deterministico entre chamadas.

## Fluxo de marcacao de acerto como pago

1. Usuario autenticado solicita pagamento de acerto.
2. Backend valida se o planejamento pertence ao usuario autenticado.
3. Backend valida se o acerto pertence ao planejamento.
4. Backend valida se o acerto esta `PENDENTE`.
5. Backend altera status para `PAGO`.
6. No contrato atual, que nao recebe DTO de data, backend grava em
   `dataPagamento` o instante retornado por `new Date()` quando o acerto e
   marcado como pago.
7. Backend registra auditoria.
8. Backend retorna acerto atualizado.

Resultado esperado:

- acerto fica marcado como pago;
- nenhuma transacao pessoal e criada automaticamente;
- historico e auditoria preservam a acao.

O fluxo e permitido em planejamento `ABERTO` ou `FECHADO`. O pagamento em
planejamento `FECHADO` liquida obrigacao consolidada e nao reabre o planejamento,
nao altera o periodo original, nao cria gasto e nao modifica divisoes.

Como regra de dominio, a data efetiva do pagamento deve ser registrada quando
informada. Aceitar essa data em DTO e evolucao futura fora desta branch.

## Fluxo de cancelamento ou reabertura de acerto

1. Usuario autenticado solicita reabertura ou cancelamento.
2. Backend valida se o planejamento pertence ao usuario autenticado.
3. Backend valida se o acerto pertence ao planejamento.
4. Backend valida status atual do acerto.
5. Para reabertura, acerto `PAGO` volta para `PENDENTE`.
6. Para cancelamento, acerto recebe status `CANCELADO` quando esse fluxo for
   usado.
7. Backend remove o efeito financeiro daquele pagamento.
8. Backend recalcula os acertos pendentes.
9. Backend registra data/hora da acao.
10. Backend registra auditoria.
11. Backend retorna acerto atualizado.

No contrato atual, a reabertura nao aceita acerto `CANCELADO`. O backend projeta
o acerto pago como pendente para retirar seu efeito financeiro, calcula a
reconciliacao e exige que a obrigacao resultante preserve exatamente o mesmo
devedor, recebedor, valor e `acertoId`. Pendencias equivalentes duplicadas sao
canceladas dentro da mesma transacao antes da persistencia do acerto reaberto.
A auditoria `ACERTO_PLANEJAMENTO_REABERTO` usa o mesmo `EntityManager`; sua falha
reverte todas as alteracoes.

Resultado esperado:

- acao e reversivel ou rastreavel;
- pagamentos historicos nao desaparecem silenciosamente;
- resumo financeiro pode ser recalculado considerando o novo estado.

## Fluxo de fechamento do planejamento

1. Usuario autenticado proprietario solicita o fechamento.
2. Backend bloqueia e serializa o agregado do planejamento em transacao.
3. Backend valida que o planejamento esta `ABERTO`.
4. Backend valida que nao ha gasto `PENDENTE_REVISAO`.
5. Backend executa a reconciliacao final dos acertos.
6. Backend preserva todos os acertos pendentes validos.
7. Backend altera o estado operacional para `FECHADO` e registra auditoria.

Acertos pendentes nao impedem o fechamento. Depois dele, participantes, gastos,
pagador e divisoes ficam congelados, mas os acertos existentes ainda podem ser
pagos ou corrigidos, e podem ser sincronizados para consistencia operacional sem
alterar a origem das obrigacoes.

## Fluxo de arquivamento do planejamento

1. Usuario autenticado proprietario solicita o arquivamento.
2. Backend valida que o planejamento esta `FECHADO`.
3. Backend reconcilia e deriva a situacao financeira atual.
4. Backend valida ausencia de obrigacao financeira residual valida, considerando
   gastos validos, divisoes ativas, acertos pagos, cancelados ou obsoletos e a
   reconciliacao atual.
5. Backend altera o estado para `ARQUIVADO` e registra auditoria.

Planejamento `ARQUIVADO` e somente leitura. A inexistencia fisica de linhas
`PENDENTE`, isoladamente, nao prova quitacao.

## Fluxo de cancelamento do planejamento

1. Usuario autenticado solicita `PATCH /planejamentos/:id/cancelar`, sem body.
2. Backend inicia uma transacao e valida acesso e propriedade antes do lock.
3. Backend adquire lock pessimista de escrita no planejamento.
4. Backend recarrega o agregado e revalida acesso, propriedade e estado `ABERTO`.
5. Backend reconcilia os acertos pendentes.
6. Backend recarrega o agregado reconciliado e calcula o resumo financeiro oficial.
7. Backend valida que todos os saldos abertos sao zero, caracterizando `QUITADO`.
8. Backend altera somente o status do planejamento para `CANCELADO`.
9. Backend retorna o planejamento cancelado.

Gasto `PENDENTE_REVISAO` nao bloqueia o cancelamento por si so e permanece
preservado, pois nao integra a obrigacao financeira valida atual. Participantes,
gastos, divisoes, pagamentos e historico nao sao removidos, revertidos ou
cancelados em massa. Apenas acertos `PENDENTE` obsoletos podem ser ajustados pela
reconciliacao oficial. Se a reconciliacao, a validacao financeira ou a
persistencia falhar, toda a transacao sofre rollback.

`CANCELADO` representa interrupcao ou abandono antes do fechamento normal e
torna o agregado terminal e somente leitura. As consultas de listagem, detalhe,
gastos, acertos e resumo permanecem disponiveis.

## Fluxo de cancelamento de gasto

1. Usuario autenticado solicita cancelamento de gasto.
2. Backend valida se o planejamento pertence ao usuario autenticado.
3. Backend valida se o gasto pertence ao planejamento.
4. Backend altera status do gasto para `CANCELADO`.
5. Backend grava `canceladoEm`.
6. Backend mantem divisoes historicas associadas ao gasto.
7. Backend recalcula resumo e acertos ignorando o gasto cancelado.
8. Backend registra auditoria.
9. Backend retorna gasto cancelado ou resposta de sucesso.

Resultado esperado:

- gasto nao entra mais nos calculos;
- gasto continua visivel no historico;
- acertos pendentes refletem a nova composicao financeira.

## Fluxo de replicacao mensal

1. Usuario autenticado escolhe planejamento de origem e informa novo mes de
   referencia.
2. Backend valida se o planejamento de origem pertence ao usuario autenticado.
3. Backend cria novo planejamento com dados basicos copiados e novo
   `mesReferencia`.
4. Backend replica participantes ativos.
5. Backend monta mapa entre participantes antigos e novos.
6. Backend replica gastos fixos e variaveis conforme regras do MVP.
7. Backend nao replica acertos do planejamento anterior.
8. Gastos `FIXO` podem nascer `ATIVO` quando nao exigirem revisao.
9. Gastos `VARIAVEL` devem nascer `PENDENTE_REVISAO`.
10. Gastos `EVENTUAL` nao devem ser replicados por padrao.
11. Backend preserva referencias de origem quando o modelo permitir.
12. Backend registra auditoria.
13. Backend retorna novo planejamento.

Resultado esperado:

- novo mes nasce com estrutura pronta para revisao;
- valores variaveis ficam destacados;
- pendencias e acertos do mes anterior nao contaminam o novo planejamento.

## Fluxo de revisao de gastos variaveis

1. Usuario acessa planejamento mensal replicado.
2. Sistema lista gastos com status `PENDENTE_REVISAO`.
3. Usuario revisa valor, data, pagador e participantes da divisao.
4. Backend recalcula divisoes quando houver alteracao financeira.
5. Usuario confirma revisao.
6. Backend altera status do gasto para `ATIVO`.
7. Backend atualiza `valorAlteradoEm` quando o valor mudar.
8. Backend registra auditoria.

Resultado esperado:

- gastos variaveis nao passam despercebidos;
- mes de referencia e ultima alteracao ficam rastreaveis;
- resumo oficial e acertos usam apenas valores revisados;
- gastos ainda pendentes de revisao aparecem em alerta ou totais provisorios.

## Exemplo pratico de festa

Cenario:

- Planejamento: Festa de aniversario.
- Participantes: Ana, Bruno, Carla e Diego.
- Gastos:
  - Ana pagou decoracao: `12000` centavos, dividido entre 4.
  - Bruno pagou bebidas: `8000` centavos, dividido entre 4.
  - Carla pagou salgados: `4500` centavos, dividido entre Ana, Bruno e Carla.

Divisoes:

| Gasto | Participantes | Valor por participante |
| --- | --- | --- |
| Decoracao | Ana, Bruno, Carla, Diego | `3000` |
| Bebidas | Ana, Bruno, Carla, Diego | `2000` |
| Salgados | Ana, Bruno, Carla | `1500` |

Resumo por participante:

| Participante | Total pago | Total devido | Saldo |
| --- | ---: | ---: | ---: |
| Ana | `12000` | `6500` | `+5500` |
| Bruno | `8000` | `6500` | `+1500` |
| Carla | `4500` | `6500` | `-2000` |
| Diego | `0` | `5000` | `-5000` |

Acertos minimos sugeridos:

| Devedor | Recebedor | Valor |
| --- | --- | ---: |
| Diego | Ana | `5000` |
| Carla | Ana | `500` |
| Carla | Bruno | `1500` |

Resultado:

- Ana recebe `5500`;
- Bruno recebe `1500`;
- Carla paga `2000`;
- Diego paga `5000`;
- todos os saldos fecham em zero apos os acertos.

## Exemplo pratico de casa compartilhada mensal

Cenario:

- Planejamento de origem: Casa compartilhada - Junho/2026.
- Novo planejamento: Casa compartilhada - Julho/2026.
- Participantes ativos: Ana, Bruno e Carla.
- Gastos de junho:
  - Aluguel: `300000` centavos, `FIXO`.
  - Internet: `12000` centavos, `FIXO`.
  - Luz: `18500` centavos, `VARIAVEL`.
  - Agua: `9200` centavos, `VARIAVEL`.
  - Mercado: `64000` centavos, `VARIAVEL`.
  - Panela nova: `15000` centavos, `EVENTUAL`.

Replicacao para julho:

| Gasto | Comportamento | Replica? | Status inicial |
| --- | --- | --- | --- |
| Aluguel | `FIXO` | Sim | `ATIVO` |
| Internet | `FIXO` | Sim | `ATIVO` |
| Luz | `VARIAVEL` | Sim | `PENDENTE_REVISAO` |
| Agua | `VARIAVEL` | Sim | `PENDENTE_REVISAO` |
| Mercado | `VARIAVEL` | Sim | `PENDENTE_REVISAO` |
| Panela nova | `EVENTUAL` | Nao, salvo escolha explicita | Nao aplicavel |

Resultado:

- julho nasce com participantes e gastos recorrentes;
- gastos variaveis exibem alerta de revisao;
- o sistema informa que os valores variaveis vieram de junho/2026;
- acertos de junho nao sao copiados para julho;
- nenhum gasto replicado cria transacao pessoal automaticamente.

## Exemplo temporal de pagamento depois do fechamento

```text
Planejamento: Casa compartilhada - Junho/2026
Fechado em: 30/06/2026
Acerto pendente: participante deve R$ 150
Pagamento realizado em: 05/07/2026
```

Resultado:

```text
planejamento.status = FECHADO
acerto.status = PAGO
acerto.dataPagamento = instante da marcacao como pago em 05/07/2026
```

O pagamento posterior nao reabre o planejamento, nao altera junho/2026, nao cria
novo gasto e nao modifica divisoes. Ele apenas liquida uma obrigacao previamente
consolidada. Em evolucao futura, uma data efetiva diferente do instante de
marcacao podera ser informada por DTO.
