"""Ingestao, validacao e geracao de um painel financeiro mensal temporal."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

RAW_COLUMNS = [
    "usuario_id",
    "mes_referencia",
    "receita_mes",
    "despesa_mes",
    "saldo_inicial_mes",
    "num_transacoes_despesa",
    "num_transacoes_receita",
    "deficit_mes",
]


@dataclass
class DatasetProfile:
    n_rows: int
    n_columns: int
    columns: list[str]
    dtypes: dict[str, str]
    null_counts: dict[str, int]
    numeric_columns: list[str]
    categorical_columns: list[str]


class DataLoader:
    def __init__(self, csv_path: Path) -> None:
        self.csv_path = Path(csv_path)

    def load(self) -> pd.DataFrame:
        if not self.csv_path.is_file():
            raise FileNotFoundError(f"Arquivo nao encontrado: {self.csv_path}")
        return pd.read_csv(self.csv_path)

    def profile(self, df: pd.DataFrame, target_column: str) -> DatasetProfile:
        if target_column not in df.columns:
            raise ValueError(f"Coluna alvo '{target_column}' ausente no dataset.")
        feature_cols = [column for column in df.columns if column != target_column]
        numeric = [
            column
            for column in feature_cols
            if pd.api.types.is_numeric_dtype(df[column])
        ]
        categorical = [column for column in feature_cols if column not in numeric]
        return DatasetProfile(
            n_rows=len(df),
            n_columns=len(df.columns),
            columns=list(df.columns),
            dtypes={column: str(df[column].dtype) for column in df.columns},
            null_counts={column: int(df[column].isna().sum()) for column in df.columns},
            numeric_columns=numeric,
            categorical_columns=categorical,
        )

    def validate(self, df: pd.DataFrame, target_column: str) -> list[str]:
        issues: list[str] = []
        if df.empty:
            issues.append("Dataset vazio.")

        missing_columns = [column for column in RAW_COLUMNS if column not in df.columns]
        if missing_columns:
            issues.append(f"Colunas obrigatorias ausentes: {missing_columns}.")
            return issues

        if target_column not in df.columns:
            issues.append(f"Coluna alvo '{target_column}' ausente.")
            return issues

        if df[RAW_COLUMNS].isna().any().any():
            issues.append("Valores nulos nao sao permitidos no painel mensal.")

        target_values = set(df[target_column].dropna().unique())
        if not target_values.issubset({0, 1, 0.0, 1.0}):
            issues.append("Alvo deve ser binario (0/1) para este pipeline.")

        parsed_months = pd.to_datetime(
            df["mes_referencia"], format="%Y-%m", errors="coerce"
        )
        if parsed_months.isna().any():
            issues.append("mes_referencia deve usar o formato YYYY-MM.")

        if df.duplicated(["usuario_id", "mes_referencia"]).any():
            issues.append("Cada usuario deve possuir no maximo uma linha por mes.")

        for user_id, group in df.assign(_month=parsed_months).groupby("usuario_id"):
            if group["_month"].isna().any():
                continue
            if not group["_month"].is_monotonic_increasing:
                issues.append(f"Meses do usuario '{user_id}' devem estar ordenados.")

        return issues


def generate_synthetic_monthly_finance(
    n_users: int = 30,
    n_months: int = 24,
    random_state: int = 42,
    start_month: str = "2024-01",
) -> pd.DataFrame:
    """Gera series mensais coerentes para treino e backtesting temporal."""
    if n_users < 1 or n_months < 4:
        raise ValueError("Informe ao menos um usuario e quatro meses.")

    rng = np.random.default_rng(random_state)
    months = pd.period_range(start=start_month, periods=n_months, freq="M")
    rows: list[dict[str, object]] = []

    for user_index in range(n_users):
        user_id = f"synthetic-user-{user_index + 1:03d}"
        base_income = rng.uniform(2500, 11000)
        expense_ratio = rng.uniform(0.72, 1.08)
        balance = rng.normal(2500, 2200)
        income_trend = rng.normal(15, 35)
        expense_trend = rng.normal(20, 45)

        for month_index, month in enumerate(months):
            seasonal_income = 1.12 if month.month == 12 else 1.0
            seasonal_expense = 1.15 if month.month in {1, 12} else 1.0
            income = max(
                0,
                (base_income + income_trend * month_index) * seasonal_income
                + rng.normal(0, 500),
            )
            expense = max(
                0,
                (
                    base_income * expense_ratio
                    + expense_trend * month_index
                    + rng.normal(0, 800)
                )
                * seasonal_expense,
            )
            income_count = max(0, int(rng.poisson(max(income / 1800, 1))))
            expense_count = max(0, int(rng.poisson(max(expense / 180, 2))))
            opening_balance = balance
            deficit = int(expense > income)

            rows.append(
                {
                    "usuario_id": user_id,
                    "mes_referencia": str(month),
                    "receita_mes": round(income, 2),
                    "despesa_mes": round(expense, 2),
                    "saldo_inicial_mes": round(opening_balance, 2),
                    "num_transacoes_despesa": expense_count,
                    "num_transacoes_receita": income_count,
                    "deficit_mes": deficit,
                }
            )
            balance = opening_balance + income - expense

    return pd.DataFrame(rows, columns=RAW_COLUMNS).sort_values(
        ["mes_referencia", "usuario_id"], ignore_index=True
    )


def write_sample_csv(
    path: Path,
    n_users: int = 30,
    n_months: int = 24,
    random_state: int = 42,
) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    generate_synthetic_monthly_finance(
        n_users=n_users,
        n_months=n_months,
        random_state=random_state,
    ).to_csv(path, index=False)
