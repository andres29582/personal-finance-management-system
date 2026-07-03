# Planejamentos Compartilhados - Fluxos

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

1. Buscar gastos ativos do planejamento.
2. Somar total pago por participante.
3. Somar total devido por participante com base nas divisoes dos gastos ativos.
4. Calcular saldo final: `totalPagoCentavos - totalDevidoCentavos`.
5. Separar participantes com saldo negativo como devedores.
6. Separar participantes com saldo positivo como recebedores.
7. Ordenar devedores e recebedores de forma deterministica.
8. Parear devedor e recebedor usando o menor valor entre divida restante e
   credito restante.
9. Criar acerto conceitual com devedor, recebedor e valor.
10. Reduzir divida e credito restantes.
11. Repetir ate todos os saldos ficarem zerados.
12. Ignorar acertos com valor zero.

Resultado esperado:

- menor quantidade pratica de pagamentos entre participantes;
- soma dos acertos a pagar equivale aos saldos negativos;
- soma dos acertos a receber equivale aos saldos positivos;
- resultado deterministico entre chamadas.

## Fluxo de marcacao de acerto como pago

1. Usuario autenticado solicita pagamento de acerto.
2. Backend valida se o planejamento pertence ao usuario autenticado.
3. Backend valida se o acerto pertence ao planejamento.
4. Backend valida se o acerto esta `PENDENTE`.
5. Backend altera status para `PAGO`.
6. Backend grava `pagoEm`.
7. Backend registra auditoria.
8. Backend retorna acerto atualizado.

Resultado esperado:

- acerto fica marcado como pago;
- nenhuma transacao pessoal e criada automaticamente;
- historico e auditoria preservam a acao.

## Fluxo de cancelamento ou reabertura de acerto

1. Usuario autenticado solicita reabertura ou cancelamento.
2. Backend valida se o planejamento pertence ao usuario autenticado.
3. Backend valida se o acerto pertence ao planejamento.
4. Backend valida status atual do acerto.
5. Para reabertura, acerto `PAGO` volta para `PENDENTE`.
6. Para cancelamento, acerto recebe status `CANCELADO` quando esse fluxo for
   usado.
7. Backend registra data/hora da acao.
8. Backend registra auditoria.
9. Backend retorna acerto atualizado.

Resultado esperado:

- acao e reversivel ou rastreavel;
- pagamentos historicos nao desaparecem silenciosamente;
- resumo financeiro pode ser recalculado considerando o novo estado.

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
- resumo e acertos usam valores revisados ou exibem alerta claro quando ainda
  houver pendencia.

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
