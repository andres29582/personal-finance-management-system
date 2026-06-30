# Arquitetura do modulo de Machine Learning

Este documento descreve a arquitetura do modulo de Machine Learning em
`ml-finance-tcc/`, responsavel pela previsao temporal de deficit financeiro.
Ele complementa o README operacional do modulo ML e a documentacao do backend,
sem substituir os detalhes de execucao local, dicionario de dados ou nota
tecnica academica.

O foco aqui e explicar o papel arquitetural do servico FastAPI, o contrato V2
de previsao, a construcao temporal das features, a integracao com o backend
NestJS e os pontos sensiveis de manutencao.

O documento descreve o que existe no estado atual do projeto. Ele nao assume
uso de dados reais para treinamento, retreinamento automatico, chamada direta
pelo frontend ou garantia contabil do resultado previsto.

## Visao geral

O modulo de Machine Learning fica em `ml-finance-tcc/` e e composto por:

- uma API FastAPI em `api/app.py`;
- um pipeline Python de geracao de dados sinteticos, feature engineering,
  treinamento e avaliacao;
- artefatos persistidos em `models/`;
- relatorios e metricas em `reports/`;
- testes pytest para API, pre-processamento, feature engineering, treinamento,
  avaliacao e persistencia de modelo.

Na arquitetura geral, o frontend nao chama a API ML diretamente. O fluxo passa
pelo backend NestJS:

1. O frontend solicita `GET /previsoes/deficit?mes=YYYY-MM`.
2. O backend autentica o usuario e reconstrui as features com dados financeiros
   persistidos no PostgreSQL.
3. O backend envia `POST /predict` para a API FastAPI.
4. A API ML devolve a classificacao V2.
5. O backend valida a resposta, traduz o resultado para o DTO publico e aplica
   mensagens e nivel de risco.

Essa separacao mantem dados financeiros e autenticacao concentrados no backend,
enquanto o servico Python permanece focado em inferencia e compatibilidade do
modelo.

No estado atual, o treinamento parte de um painel sintetico gerado dentro de
`ml-finance-tcc/`. Dados financeiros reais persistidos no PostgreSQL sao usados
pelo backend apenas para montar o vetor de inferencia do usuario autenticado.

## Objetivo da previsao

A previsao de deficit estima se um mes objetivo `M` deve terminar com despesas
maiores que receitas.

O resultado nao e uma verdade contabil nem uma promessa de saldo futuro. Ele e
um sinal probabilistico calculado a partir do historico recente e deve apoiar a
experiencia de planejamento financeiro do usuario.

A previsao tambem nao altera o modelo em producao. Novas transacoes podem mudar
as features calculadas para uma consulta futura, mas nao disparam treinamento
ou atualizacao automatica dos artefatos.

No backend, esse resultado e exposto como:

- `deficitPrevisto`: boolean derivado de `prediction`;
- `prediction`: classe numerica bruta retornada pelo modelo;
- `probability`: probabilidade da classe de deficit;
- `risco`: classificacao de apresentacao calculada pelo backend;
- `indicadores`: resumo dos agregados usados para explicar a previsao.

## Tipo de problema

O problema e tratado como classificacao binaria mensal.

Uma amostra representa um usuario e um mes objetivo `M`. O alvo de treinamento
e `deficit_mes`, igual a `1` quando as despesas observadas em `M` superam as
receitas observadas em `M`; caso contrario, vale `0`.

Na inferencia, o alvo nao existe no payload. O modelo recebe apenas informacoes
conhecidas antes do inicio de `M`, calculadas a partir dos tres meses completos
anteriores.

## Contrato V2 da API FastAPI

A API FastAPI esta em `ml-finance-tcc/api/app.py`.

Endpoints principais:

- `GET /health`: retorna o status da API e `schema_version`.
- `POST /predict`: recebe o contrato V2 estrito e devolve uma previsao.

O payload de inferencia tem a forma:

```json
{
  "schema_version": 2,
  "features": {
    "receita_lag_1": 3200,
    "despesa_lag_1": 2800,
    "media_receita_3m": 3100,
    "media_despesa_3m": 2750,
    "tendencia_receita_3m": 150,
    "tendencia_despesa_3m": -50,
    "volatilidade_despesa_3m": 225.4625,
    "media_transacoes_receita_3m": 3.3333,
    "media_transacoes_despesa_3m": 18.6667,
    "taxa_deficit_3m": 0.3333,
    "saldo_inicial_mes": 4200,
    "mes_do_ano": 7
  }
}
```

Regras importantes do contrato:

- `schema_version` deve ser exatamente `2`;
- campos extras sao rejeitados;
- campos ausentes sao rejeitados;
- valores infinitos ou nao numericos sao rejeitados;
- `taxa_deficit_3m` deve ficar entre `0` e `1`;
- `mes_do_ano` deve ficar entre `1` e `12`;
- a ordem canonica de features precisa bater com `FEATURE_COLUMNS`.

A resposta V2 e:

```json
{
  "schema_version": 2,
  "prediction": 0,
  "probability": 0.2431
}
```

A API retorna `503` quando o modelo, o pre-processador ou o manifesto nao estao
carregados ou quando os artefatos sao incompativeis com o contrato atual.

## Entrada, saida e significado dos campos

`prediction` e a classe binaria estimada pelo modelo:

- `0`: o modelo nao classificou o mes como deficit;
- `1`: o modelo classificou o mes como deficit.

`probability` e a probabilidade estimada para a classe `1`, isto e, para
deficit. Ela deve ser interpretada como score de risco do modelo, nao como
garantia de ocorrencia.

No backend, `PrevisoesService` arredonda `probability` para quatro casas e
calcula `risco` com as faixas atuais:

- abaixo de `0.4`: `baixo`;
- a partir de `0.4`: `moderado`;
- a partir de `0.7`: `alto`.

Essas faixas pertencem a camada de apresentacao do backend. O contrato ML
continua limitado a `prediction` e `probability`.

## Prevencao de vazamento temporal

O contrato V2 foi desenhado para evitar vazamento temporal de dados.

Para prever `M`, as features usam apenas `M-3`, `M-2` e `M-1`. O cutoff de
inferencia e:

```text
data < inicio_de_M
```

Isso significa que receitas e despesas do proprio mes objetivo nao entram no
payload. No treinamento, `receita_mes` e `despesa_mes` existem no painel mensal
apenas para construir o alvo `deficit_mes`; elas nao fazem parte de
`FEATURE_COLUMNS`.

Em termos praticos, a classificacao de um mes objetivo e calculada como se o
sistema estivesse posicionado no inicio desse mes: todo agregado financeiro vem
do historico anterior, e o resultado observado de `M` fica disponivel apenas
para avaliacao ou treinamento manual posterior.

O backend replica essa regra consultando transacoes e transferencias antes do
inicio de `M`, usando intervalo historico semiaberto. O pipeline Python tambem
descarta amostras quando os tres meses anteriores nao sao consecutivos.

## Historico minimo

A previsao exige tres meses completos de historico.

No backend, `DeficitFeaturesService` verifica se o usuario ja existia no inicio
dos tres meses anteriores ao mes objetivo. Quando esse requisito nao e atendido,
o backend rejeita a previsao antes de chamar o servico ML.

Meses completos sem movimentacao podem representar receitas, despesas e
contagens iguais a zero. Meses anteriores ao cadastro do usuario nao sao
tratados como historico completo.

## Features principais

As features canonicas do contrato V2 sao:

| Feature | Significado |
| --- | --- |
| `receita_lag_1` | Receita total de `M-1`. |
| `despesa_lag_1` | Despesa total de `M-1`. |
| `media_receita_3m` | Media de receitas de `M-3` a `M-1`. |
| `media_despesa_3m` | Media de despesas de `M-3` a `M-1`. |
| `tendencia_receita_3m` | Variacao media entre `M-3` e `M-1` para receitas. |
| `tendencia_despesa_3m` | Variacao media entre `M-3` e `M-1` para despesas. |
| `volatilidade_despesa_3m` | Desvio padrao amostral das despesas nos tres meses. |
| `media_transacoes_receita_3m` | Media de contagens mensais de receitas. |
| `media_transacoes_despesa_3m` | Media de contagens mensais de despesas. |
| `taxa_deficit_3m` | Fracao dos tres meses anteriores com despesa maior que receita. |
| `saldo_inicial_mes` | Saldo consolidado conhecido no inicio de `M`. |
| `mes_do_ano` | Numero do mes objetivo, de `1` a `12`. |

O backend calcula essas features a partir de contas, transacoes e
transferencias persistidas. O pipeline Python calcula as mesmas features a
partir do painel mensal sintetico.

## Treinamento e artefatos do modelo

O treinamento atual e manual e controlado pelo comando `python main.py train`
dentro de `ml-finance-tcc/`.

A aplicacao em execucao nao invoca esse comando automaticamente. A API FastAPI
carrega os artefatos ja persistidos e executa somente inferencia no endpoint
`POST /predict`.

Esse fluxo:

1. gera `data/monthly_finance_sample.csv` com dados sinteticos;
2. valida o painel mensal;
3. monta features temporais V2;
4. separa treino e teste por meses unicos em ordem cronologica;
5. treina um `RandomForestClassifier`;
6. compara o modelo com baseline majoritario e baseline de persistencia;
7. grava metricas e graficos em `reports/`;
8. persiste `models/modelo.pkl`, `models/scaler.pkl` e `models/features.json`.

O arquivo `models/features.json` funciona como manifesto do contrato. Ele
registra:

- `schema_version`;
- lista canonica de features;
- target;
- historico minimo;
- politica temporal.

Na inicializacao, a API FastAPI carrega o modelo, o pre-processador e o
manifesto. Se o manifesto nao corresponder ao contrato esperado pelo codigo, o
servico nao deve aceitar inferencia.

## Integracao com backend NestJS

No backend, a integracao fica no modulo `previsoes`.

Principais responsabilidades:

- `PrevisoesController`: expoe `GET /previsoes/deficit` protegido por JWT.
- `PrevisoesService`: coordena features, chamada ML, mensagem e risco.
- `DeficitFeaturesService`: monta o payload V2 a partir do historico do
  usuario.
- `PrevisaoRepository`: consulta usuario, contas, transacoes e transferencias.
- `MlPredictClientService`: envia `POST /predict` para a API FastAPI e valida
  a resposta.
- `ml-prediction-contract.ts`: centraliza `schema_version`, historico minimo e
  lista de features esperada pelo backend.

O backend le a URL da API ML por configuracao e usa fallback local para
desenvolvimento. A chamada possui timeout e converte indisponibilidade,
contrato invalido ou erro HTTP do servico ML em erro de indisponibilidade.

Como o backend reconstrui as features localmente, a API ML nao recebe tokens,
identidade do usuario nem dados transacionais brutos. Ela recebe apenas o vetor
numerico ja agregado.

## Limitacoes atuais

As limitacoes conhecidas sao parte do contrato arquitetural atual:

- o dataset de treinamento e sintetico;
- as metricas atuais nao demonstram qualidade em producao;
- nao ha reentrenamento automatico com dados reais dos usuarios;
- a inferencia depende da disponibilidade da API FastAPI;
- alteracoes retroativas em movimentos financeiros podem mudar o historico
  reconstruido, pois nao ha snapshot mensal dedicado nesta fase;
- uso futuro de dados reais exigiria privacidade, anonimizacao, base legal e
  validacao de qualidade.

Essas limitacoes devem ser visiveis em qualquer evolucao academica, tecnica ou
de produto envolvendo a previsao de deficit.

## Pontos sensiveis de manutencao

### Contrato V2

`schema_version`, lista de features, validacoes de payload e formato da resposta
precisam evoluir juntos em Python, backend e testes.

Qualquer mudanca em `FEATURE_COLUMNS`, `ML_PREDICTION_FEATURES` ou
`features.json` deve ser tratada como mudanca multi-modulo.

### Feature engineering

Feature engineering e o ponto mais sensivel do modelo. Alteracoes devem
preservar:

- uso exclusivo de meses anteriores ao mes objetivo;
- tres meses completos e consecutivos;
- ausencia de `receita_mes` e `despesa_mes` do mes objetivo no input;
- igualdade semantica entre calculo Python e calculo no backend;
- arredondamento e tipos numericos compativeis.

### Compatibilidade backend e ML

O backend valida as features antes de chamar a API e valida a resposta recebida.
Mesmo assim, uma divergencia entre o contrato do backend e o contrato FastAPI
pode derrubar a previsao sem afetar outras rotas financeiras.

Ao mudar a API ML, revisar tambem:

- `MlPredictClientService`;
- `DeficitFeaturesService`;
- DTO publico de previsao;
- testes E2E de `previsoes`;
- testes pytest da API FastAPI.

### Versionamento de artefatos

Os artefatos `modelo.pkl`, `scaler.pkl` e `features.json` precisam representar
o mesmo contrato. O manifesto e a barreira principal contra carregar modelo
antigo com codigo novo.

Mudancas de modelo devem registrar claramente:

- versao do schema;
- lista de features;
- periodo/estrategia de treino;
- tipo de dataset usado;
- metricas e baselines comparados.

### Testes

O modulo depende de testes em duas camadas:

- pytest no `ml-finance-tcc`, cobrindo feature engineering, API, treinamento,
  avaliacao e repositorio de modelo;
- testes do backend, incluindo E2E de `GET /previsoes/deficit` com cliente ML
  controlado.

Novos cenarios devem priorizar contrato V2, rejeicao de payload antigo,
historico insuficiente, mes invalido, indisponibilidade da API ML e isolamento
por usuario.

## Relacao com documentos existentes

- [ml-finance-tcc/README.md](../../ml-finance-tcc/README.md): guia operacional
  do modulo ML, regra temporal, comandos de treino e API.
- [DICIONARIO_DE_DADOS.md](../../ml-finance-tcc/docs/DICIONARIO_DE_DADOS.md):
  definicao detalhada das features e do alvo.
- [NOTA_TECNICA_MACHINE_LEARNING.md](../academico/TCC/NOTA_TECNICA_MACHINE_LEARNING.md):
  resumo tecnico-academico do contrato temporal V2.
- [BACKEND.md](BACKEND.md): arquitetura do backend e integracao do modulo
  `previsoes`.
- [REQUISITOS.md](../produto/REQUISITOS.md): rastreabilidade dos requisitos,
  testes e riscos cobertos pela previsao de deficit.

Este documento deve permanecer como visao arquitetural. Passos operacionais,
evidencias pontuais de execucao, metricas detalhadas e discussoes academicas
devem ficar nos documentos especializados.
