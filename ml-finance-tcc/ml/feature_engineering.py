"""Features causais para prever o mes M usando apenas M-3, M-2 e M-1."""

from __future__ import annotations

import numpy as np
import pandas as pd

SCHEMA_VERSION = 2
MIN_HISTORY_MONTHS = 3
TARGET_COLUMN = "deficit_mes"
FEATURE_COLUMNS = [
    "receita_lag_1",
    "despesa_lag_1",
    "media_receita_3m",
    "media_despesa_3m",
    "tendencia_receita_3m",
    "tendencia_despesa_3m",
    "volatilidade_despesa_3m",
    "media_transacoes_receita_3m",
    "media_transacoes_despesa_3m",
    "taxa_deficit_3m",
    "saldo_inicial_mes",
    "mes_do_ano",
]


def build_temporal_features(monthly_panel: pd.DataFrame) -> pd.DataFrame:
    required = {
        "usuario_id",
        "mes_referencia",
        "receita_mes",
        "despesa_mes",
        "saldo_inicial_mes",
        "num_transacoes_despesa",
        "num_transacoes_receita",
        TARGET_COLUMN,
    }
    missing = sorted(required.difference(monthly_panel.columns))
    if missing:
        raise ValueError(f"Colunas ausentes para feature engineering: {missing}")

    panel = monthly_panel.copy()
    panel["_month"] = pd.to_datetime(
        panel["mes_referencia"], format="%Y-%m", errors="raise"
    )
    panel = panel.sort_values(["usuario_id", "_month"]).reset_index(drop=True)
    rows: list[dict[str, object]] = []

    for user_id, user_rows in panel.groupby("usuario_id", sort=False):
        user_rows = user_rows.reset_index(drop=True)
        for target_index in range(MIN_HISTORY_MONTHS, len(user_rows)):
            history = user_rows.iloc[
                target_index - MIN_HISTORY_MONTHS : target_index
            ]
            target = user_rows.iloc[target_index]
            expected_months = pd.date_range(
                end=target["_month"] - pd.offsets.MonthBegin(1),
                periods=MIN_HISTORY_MONTHS,
                freq="MS",
            )
            if list(history["_month"]) != list(expected_months):
                continue

            incomes = history["receita_mes"].astype(float).to_numpy()
            expenses = history["despesa_mes"].astype(float).to_numpy()
            income_counts = (
                history["num_transacoes_receita"].astype(float).to_numpy()
            )
            expense_counts = (
                history["num_transacoes_despesa"].astype(float).to_numpy()
            )
            deficits = history[TARGET_COLUMN].astype(float).to_numpy()

            rows.append(
                {
                    "usuario_id": user_id,
                    "mes_referencia": target["mes_referencia"],
                    "receita_lag_1": incomes[-1],
                    "despesa_lag_1": expenses[-1],
                    "media_receita_3m": incomes.mean(),
                    "media_despesa_3m": expenses.mean(),
                    "tendencia_receita_3m": (incomes[-1] - incomes[0]) / 2,
                    "tendencia_despesa_3m": (expenses[-1] - expenses[0]) / 2,
                    "volatilidade_despesa_3m": np.std(expenses, ddof=1),
                    "media_transacoes_receita_3m": income_counts.mean(),
                    "media_transacoes_despesa_3m": expense_counts.mean(),
                    "taxa_deficit_3m": deficits.mean(),
                    "saldo_inicial_mes": float(target["saldo_inicial_mes"]),
                    "mes_do_ano": int(target["_month"].month),
                    "deficit_lag_1": int(deficits[-1]),
                    TARGET_COLUMN: int(target[TARGET_COLUMN]),
                }
            )

    result = pd.DataFrame(rows)
    numeric_columns = FEATURE_COLUMNS + ["deficit_lag_1"]
    if not result.empty:
        result[numeric_columns] = result[numeric_columns].round(4)
    return result
