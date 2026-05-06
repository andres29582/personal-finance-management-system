"""Ingestão e validação de datasets tabulares (CSV)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


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
    """Carrega CSV, infere tipos básicos e valida integridade mínima."""

    def __init__(self, csv_path: Path) -> None:
        self.csv_path = Path(csv_path)

    def load(self) -> pd.DataFrame:
        if not self.csv_path.is_file():
            raise FileNotFoundError(f"Arquivo não encontrado: {self.csv_path}")
        df = pd.read_csv(self.csv_path)
        return df

    def profile(self, df: pd.DataFrame, target_column: str) -> DatasetProfile:
        if target_column not in df.columns:
            raise ValueError(f"Coluna alvo '{target_column}' ausente no dataset.")
        feature_cols = [c for c in df.columns if c != target_column]
        numeric = [c for c in feature_cols if pd.api.types.is_numeric_dtype(df[c])]
        categorical = [c for c in feature_cols if c not in numeric]
        return DatasetProfile(
            n_rows=len(df),
            n_columns=len(df.columns),
            columns=list(df.columns),
            dtypes={c: str(df[c].dtype) for c in df.columns},
            null_counts={c: int(df[c].isna().sum()) for c in df.columns},
            numeric_columns=numeric,
            categorical_columns=categorical,
        )

    def validate(self, df: pd.DataFrame, target_column: str) -> list[str]:
        """Retorna lista de avisos/erros de validação (vazia se OK)."""
        issues: list[str] = []
        if df.empty:
            issues.append("Dataset vazio.")
        if target_column not in df.columns:
            issues.append(f"Coluna alvo '{target_column}' ausente.")
            return issues
        y = df[target_column]
        if y.isna().any():
            issues.append("Valores nulos na coluna alvo não são permitidos.")
        unique = y.dropna().unique()
        if not set(unique).issubset({0, 1, 0.0, 1.0}):
            issues.append("Alvo deve ser binário (0/1) para este pipeline.")
        for col in df.columns:
            if col == target_column:
                continue
            if df[col].dtype == object:
                try:
                    pd.to_numeric(df[col], errors="raise")
                except Exception:
                    issues.append(f"Coluna '{col}' não numérica; use pré-processamento categórico.")
        return issues


def generate_synthetic_monthly_finance(
    n_rows: int = 400,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    Gera dados mensais agregados fictícios, reprodutíveis.
    Target `deficit_mes`: 1 se despesa efetiva supera receita (déficit), 0 caso contrário.
    """
    rng = np.random.default_rng(random_state)
    receita = rng.uniform(2000, 12000, n_rows)
    # Despesa correlacionada com receita + ruído (cenário realista)
    ratio = rng.normal(0.92, 0.18, n_rows)
    despesa = np.clip(receita * ratio + rng.normal(0, 800, n_rows), 500, 15000)
    saldo_inicial = rng.normal(1500, 4000, n_rows)
    n_tx_despesa = rng.integers(5, 80, n_rows)
    n_tx_receita = rng.integers(2, 35, n_rows)
    volatilidade = np.abs(rng.normal(0, 1, n_rows))

    deficit = (despesa > receita).astype(int)

    return pd.DataFrame(
        {
            "receita_mes": np.round(receita, 2),
            "despesa_mes": np.round(despesa, 2),
            "saldo_inicial_mes": np.round(saldo_inicial, 2),
            "num_transacoes_despesa": n_tx_despesa,
            "num_transacoes_receita": n_tx_receita,
            "volatilidade_despesa": np.round(volatilidade, 4),
            "deficit_mes": deficit,
        }
    )


def write_sample_csv(path: Path, n_rows: int = 400, random_state: int = 42) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df = generate_synthetic_monthly_finance(n_rows=n_rows, random_state=random_state)
    df.to_csv(path, index=False)
