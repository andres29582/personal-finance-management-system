# ML Finance TCC — contrato temporal V2

Serviço FastAPI e pipeline de classificação para estimar se o mês objetivo
`M` terminará em déficit. O modelo usa apenas informação conhecida antes do
início de `M`; receitas e despesas observadas em `M` existem somente como alvo
de treinamento.

## Regra temporal

- Janela: `M-3`, `M-2` e `M-1`.
- Cutoff de inferência: `data < inicio_de_M`.
- Histórico mínimo: três meses completos.
- Split: primeiros 80% dos meses únicos para treino e últimos 20% para teste.
- Dados: painel sintético, reproduzível e sem dados pessoais reais.

As features V2 são:

`receita_lag_1`, `despesa_lag_1`, médias e tendências de receita/despesa em
três meses, volatilidade mensal de despesa, médias de contagens, taxa recente
de déficit, saldo no início de `M` e mês do ano.

`receita_mes` e `despesa_mes` do mês objetivo são proibidas no input.

## Treino e avaliação

```powershell
cd ml-finance-tcc
.\.venv\Scripts\Activate.ps1
python main.py train
```

O comando regenera:

- `data/monthly_finance_sample.csv`;
- `models/modelo.pkl`, `scaler.pkl` e manifesto `features.json`;
- gráficos e `reports/metrics.json`.

O relatório compara Random Forest com baseline majoritário e baseline de
persistência (`deficit_M-1`).

## API

```powershell
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

`POST /predict` exige o contrato estrito V2 mostrado em
`examples/predict_request.json`. Campos ausentes, extras, não numéricos,
infinitos ou uma versão diferente são rejeitados.

Resposta:

```json
{
  "schema_version": 2,
  "prediction": 0,
  "probability": 0.2431
}
```

## Limitações

As métricas medem comportamento em dados sintéticos. Elas não demonstram
qualidade em produção. Alterações retroativas de movimentos também modificam
o histórico reconstruído, pois esta fase não cria snapshots.

O modelo é treinado de forma manual e controlada com dataset sintético. O
sistema não realiza reentrenamento automático com dados reais dos usuários em
produção. Qualquer uso futuro de dados reais exigiria política específica de
privacidade, anonimização, base legal e validação de qualidade.
