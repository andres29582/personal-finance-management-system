# ML Finance TCC (`ml-finance-tcc/`)

Projeto **autocontido** de Machine Learning em Python, alinhado à *Especificação do Sistema — Programação Avançada*: ingestão e validação de CSV, EDA, pré-processamento (imputação por **mediana** + **StandardScaler**), treino **80/20**, **RandomForest** para classificação binária, métricas (acurácia, precisão, recall, F1, ROC-AUC), matriz de confusão e curva ROC, importância por **Random Forest** e **informação mútua**, persistência com **joblib** (`modelo.pkl`, `scaler.pkl`) e lista de features em `features.json`, API **FastAPI** com **`POST /predict`**.

**Problema:** prever se o mês apresenta **déficit** (`deficit_mes = 1`) com base em agregados mensais fictícios (receita, despesa, saldo inicial, contagens de transações, volatilidade). O CSV é **sintético e reprodutível** (`random_state=42`), inspirado no contexto de finanças pessoais, **sem acoplamento** ao backend Nest/Expo do monorepo.

> **Powershap:** não está incluído (dependência e tempo extras). O relatório cobre **RF** + **mutual information**, conforme alternativas citadas na especificação.

- **Dicionário de dados (colunas ↔ entidades Nest):** [docs/DICIONARIO_DE_DADOS.md](docs/DICIONARIO_DE_DADOS.md)
- **Nota para a professora** (objetivo, estrutura, rastreio da especificação): [docs/README-para-a-professora.md](docs/README-para-a-professora.md)

## Estrutura

```
ml-finance-tcc/
├── main.py                 # Orquestração: train
├── requirements.txt
├── domain/data_loader.py   # CSV, validação, geração sintética
├── ml/
│   ├── preprocessing.py
│   ├── training.py
│   ├── evaluation.py
│   ├── eda.py
│   └── feature_stats.py    # Informação mútua
├── persistence/model_repository.py
├── api/app.py              # FastAPI + /predict
├── data/                   # monthly_finance_sample.csv (gerado no 1º train)
├── docs/                   # Dicionário de dados ↔ backendnest
├── models/                 # modelo.pkl, scaler.pkl, features.json (após train)
├── reports/                # PNGs de EDA + métricas.json
└── examples/predict_request.json
```

## Ambiente (Windows / macOS / Linux)

Na raiz do monorepo ou diretamente nesta pasta:

```bash
cd ml-finance-tcc
python -m venv .venv
```

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

**Linux / macOS:**

```bash
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Treinar (gera dados, EDA, métricas e artefatos)

```bash
cd ml-finance-tcc
python main.py train
```

Saídas principais:

- `data/monthly_finance_sample.csv` — dataset sintético (se ainda não existir).
- `reports/` — histogramas, boxplots, heatmap de correlação de Pearson, `confusion_matrix.png`, `roc_curve.png`, `precision_recall_curve.png`, `metrics.json`.
- `models/modelo.pkl`, `models/scaler.pkl`, `models/features.json`.

## Subir a API

Na mesma pasta, com o venv ativo e **após** o `train`:

```bash
cd ml-finance-tcc
python -m uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

Documentação interativa: `http://127.0.0.1:8000/docs`

## Teste rápido de `POST /predict`

Corpo JSON: todas as chaves listadas em `models/features.json` (ordem livre). Resposta: `prediction` (0 ou 1) e `probability` (probabilidade da classe **déficit**).

**Exemplo com `curl`** (Linux / macOS / Git Bash), usando o arquivo de exemplo:

```bash
cd ml-finance-tcc
curl -s -X POST http://127.0.0.1:8000/predict \
  -H "Content-Type: application/json" \
  -d @examples/predict_request.json
```

**Windows PowerShell** (evita problemas de escape do `curl`):

```powershell
cd ml-finance-tcc
Get-Content .\examples\predict_request.json -Raw | Invoke-RestMethod -Uri http://127.0.0.1:8000/predict -Method Post -ContentType "application/json"
```

Resposta esperada (valores aproximados):

```json
{"prediction":1,"probability":0.74}
```

## Integração futura com o app financeiro (opcional)

Este pacote **não altera** `backendnest/` nem `frontend/`. Para ligar depois:

1. Expor esta API em uma URL fixa (ex.: `http://localhost:8000`).
2. No cliente (outro projeto), chamar `POST /predict` com os mesmos nomes de campos ou gerar um CSV mensal compatível e treinar de novo com dados reais exportados por você.

CORS está liberado para `*` apenas para facilitar testes locais com qualquer origem.
