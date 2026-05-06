# Nota para a professora — módulo de Machine Learning (`ml-finance-tcc`)

**Prezada professora,**

Este ficheiro resume, de forma objetiva, o trabalho desenvolvido na pasta **`ml-finance-tcc/`** do repositório *meu-sistema-financeiro*: o que foi feito, **porquê** está assim estruturado, como se relaciona com o meu **sistema de gestão de contas pessoais** (NestJS + frontend) e de que modo o conteúdo **cumpre os requisitos** do documento **«Especificação do Sistema — Programação Avançada (1)»**.

O sistema financeiro principal **não foi alterado**; o ML foi concentrado nesta pasta para manter responsabilidades separadas e facilitar a avaliação do pipeline académico.

---

## 1. Porquê um projeto ML à parte?

- A especificação pede um **ciclo completo de ML em Python** (dados → preparação → modelagem → métricas → persistência → **API REST** com predição).
- O meu TCC de gestão patrimonial já tem **backend NestJS** e **aplicação cliente**; misturar treino de modelos na mesma base de código tornaria o trabalho mais difícil de avaliar e de reproduzir.
- Assim, **`ml-finance-tcc/`** é o **artefato que demonstra** o cumprimento da especificação de Programação Avançada, com **ligação conceptual** ao domínio financeiro (dicionário de dados e problema de **déficit mensal**).

---

## 2. O que foi implementado (resumo)

| Área | Conteúdo |
|------|-----------|
| **Dados** | CSV mensal sintético **reprodutível** (`random_state` fixo), alinhado a agregados de “receitas/despesas por mês”. Documentação de mapeamento para o modelo real em `docs/DICIONARIO_DE_DADOS.md`. |
| **Validação** | Verificação de colunas, tipos e alvo binário antes do treino (`domain/data_loader.py`). |
| **EDA** | Histogramas, boxplots e **heatmap de correlação de Pearson** (`ml/eda.py`, gráficos em `reports/`). |
| **Pré-processamento** | **Imputação pela mediana** + **padronização** (`StandardScaler`) para variáveis numéricas (`ml/preprocessing.py`). |
| **Modelagem** | Classificação binária (`deficit_mes`), **Random Forest**, divisão **80/20** (`ml/training.py`). |
| **Avaliação** | Acurácia, precisão, recall, F1, **ROC-AUC**, matriz de confusão, curvas **ROC** e **Precision–Recall**; importância por **Random Forest** e **informação mútua** (`ml/evaluation.py`, `ml/feature_stats.py`, `reports/metrics.json`). |
| **Persistência** | `joblib`: `models/modelo.pkl`, `models/scaler.pkl` (pipeline de pré-processamento) e `models/features.json` com a ordem dos atributos (`persistence/model_repository.py`). |
| **API** | **FastAPI**, `POST /predict` com resposta no formato pedido na especificação (`prediction`, `probability`), mais `GET /health` (`api/app.py`). |

**Notas honestas para avaliação:** não integrei **Powershap** (dependência e tempo adicionais); usei **RF + informação mútua** como abordagens de importância de variáveis, conforme alternativas citadas na especificação. **Embeddings de texto** não se aplicam ao dataset tabular atual; no relatório oral posso justificar essa exclusão.

---

## 3. Estrutura de pastas (alinhada à especificação)

A especificação sugere uma organização por responsabilidades; a implementação segue essa ideia:

| Pasta / ficheiro | Função |
|------------------|--------|
| `domain/data_loader.py` | Ingestão e validação do CSV; geração do conjunto sintético. |
| `ml/preprocessing.py`, `training.py`, `evaluation.py`, `eda.py`, `feature_stats.py` | Pipeline de preparação, treino, avaliação e EDA. |
| `persistence/model_repository.py` | Gravação e leitura dos artefactos `joblib` + lista de features. |
| `api/app.py` | Serviço HTTP e endpoint de predição. |
| `models/` | `modelo.pkl`, `scaler.pkl`, `features.json` (após `python main.py train`). |
| `data/` | Dataset de exemplo; `reports/` | figuras e métricas; `docs/` | dicionário de dados e esta nota. |
| `main.py` | Orquestra o comando `train`. |

---

## 4. Rastreio: especificação ↔ entrega

| Requisito (resumo do documento *Programação Avançada*) | Onde / como está coberto |
|--------------------------------------------------------|---------------------------|
| Ingestão de dados tabulares (CSV) | `DataLoader`, `data/monthly_finance_sample.csv`. |
| Validação e integridade do dataset | `DataLoader.validate` + perfil no `main.py`. |
| Tratamento de valores em falta (mediana em numéricas) | `SimpleImputer(strategy='median')` no pipeline numérico. |
| Normalização / padronização | `StandardScaler` após imputação. |
| Encoding categórico / texto | Não aplicável ao conjunto atual (só numéricas); justificável na defesa. |
| EDA (histogramas, boxplots, correlação) | `ml/eda.py` → `reports/`. |
| Importância de variáveis | `feature_importances_` da RF + `mutual_info_classif`. |
| Pipeline treino/teste, `fit` / `predict` | `train_test_split` 80/20 + `RandomForestClassifier`. |
| Métricas e matriz de confusão (e curvas quando faz sentido) | `ml/evaluation.py` + ficheiros em `reports/`. |
| `joblib` do modelo e do escalador | `modelo.pkl`, `scaler.pkl`. |
| Lista de features persistida | `features.json`. |
| API REST, `POST /predict`, JSON de entrada/saída | `api/app.py`, contrato documentado no `README.md` da pasta. |
| Orientação a objetos / separação de responsabilidades | Módulos por pasta conforme tabela acima. |

---

## 5. Ligação ao sistema de gestão de contas pessoais

O backend Nest expõe **transações** (`transacao`: `valor`, `data`, `tipo` receita/despesa), **contas** (`saldo_inicial`, saldo atual calculado com transferências) e agregados no **dashboard**. O ficheiro **`docs/DICIONARIO_DE_DADOS.md`** explica, coluna a coluna, como as features do CSV de ML correspondem a essas entidades e fórmulas — incluindo a definição contratual de **`saldo_inicial_mes`** (património consolidado no **último dia do mês anterior**, recomputável a partir da BD, sem tabela de histórico mensal).

Assim, o trabalho cumpre a especificação de ML **e** mantém **rastreabilidade** para o domínio do meu sistema financeiro, sem obrigar alterações no código principal.

---

## 6. Como reproduzir

Na pasta `ml-finance-tcc/` (com ambiente virtual e dependências instaladas — ver `README.md` na raiz desta pasta):

```bash
python main.py train
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

Documentação interativa da API: `http://127.0.0.1:8000/docs`.

---

**Com os melhores cumprimentos,**
*Estudante*
