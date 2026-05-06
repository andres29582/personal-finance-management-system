"""Pré-processamento: imputação (mediana), padronização e preparação de features."""

from __future__ import annotations

from typing import Sequence

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def build_numeric_preprocessor(feature_columns: Sequence[str]) -> ColumnTransformer:
    """
    Para variáveis numéricas: imputação pela mediana (robusta a outliers)
    e padronização (média 0, desvio 1).
    """
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    return ColumnTransformer(
        transformers=[("num", numeric_pipeline, list(feature_columns))],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def dataframe_features(df: pd.DataFrame, feature_columns: Sequence[str]) -> pd.DataFrame:
    return df[list(feature_columns)].copy()
