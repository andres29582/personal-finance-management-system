# Dicionário de dados — previsão temporal V2

Uma linha de inferência representa um usuário e um mês objetivo `M`. Todas as
features usam exclusivamente os três meses completos anteriores.

| Feature | Definição |
|---|---|
| `receita_lag_1` | Receita total de `M-1`. |
| `despesa_lag_1` | Despesa total de `M-1`. |
| `media_receita_3m` | Média de receitas de `M-3..M-1`. |
| `media_despesa_3m` | Média de despesas de `M-3..M-1`. |
| `tendencia_receita_3m` | `(receita_M-1 - receita_M-3) / 2`. |
| `tendencia_despesa_3m` | `(despesa_M-1 - despesa_M-3) / 2`. |
| `volatilidade_despesa_3m` | Desvio padrão amostral dos três totais mensais de despesa. |
| `media_transacoes_receita_3m` | Média das contagens mensais de receitas. |
| `media_transacoes_despesa_3m` | Média das contagens mensais de despesas. |
| `taxa_deficit_3m` | Fração dos três meses em que despesa > receita. |
| `saldo_inicial_mes` | Saldo consolidado com contas criadas e movimentos datados antes de `inicio_de_M`. |
| `mes_do_ano` | Número de 1 a 12 conhecido antes de começar `M`. |

O alvo `deficit_mes` vale `1` quando as despesas observadas em `M` superam as
receitas observadas em `M`. O alvo nunca compõe o payload de inferência.

## Meses completos sem movimento

Quando o usuário já existia no início do mês e o mês terminou, a ausência de
transações representa receitas, despesas e contagens iguais a zero. Um mês no
qual o usuário foi cadastrado depois do início não é considerado completo.

## Cutoff

As consultas usam intervalo semiaberto:

```text
inicio_de_M-3 <= data < inicio_de_M
```

Não são usados timestamps de `23:59:59`, evitando ambiguidades de timezone e
precisão.

## Uso de dados para treinamento

O modelo é treinado de forma manual e controlada com dataset sintético. O
sistema não realiza reentrenamento automático com dados reais dos usuários em
produção. Qualquer uso futuro de dados reais exigiria política específica de
privacidade, anonimização, base legal e validação de qualidade.
