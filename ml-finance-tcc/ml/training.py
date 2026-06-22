"""Treino supervisionado com separacao temporal por meses unicos."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from ml.preprocessing import build_numeric_preprocessor, dataframe_features


@dataclass
class TrainResult:
    model: RandomForestClassifier
    preprocessor: Any
    X_train: pd.DataFrame
    X_test: pd.DataFrame
    y_train: pd.Series
    y_test: pd.Series
    feature_columns: list[str]
    train_months: list[str]
    test_months: list[str]
    majority_baseline: np.ndarray
    persistence_baseline: np.ndarray


def train_classifier_temporal(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: list[str],
    test_size: float = 0.2,
    random_state: int = 42,
    n_estimators: int = 200,
    max_depth: int | None = 12,
) -> TrainResult:
    months = sorted(df["mes_referencia"].unique().tolist())
    if len(months) < 2:
        raise ValueError("Sao necessarios ao menos dois meses para split temporal.")

    test_month_count = max(1, int(np.ceil(len(months) * test_size)))
    split_index = len(months) - test_month_count
    if split_index < 1:
        raise ValueError("O split temporal precisa manter meses no treino.")

    train_months = months[:split_index]
    test_months = months[split_index:]
    train = df[df["mes_referencia"].isin(train_months)].copy()
    test = df[df["mes_referencia"].isin(test_months)].copy()
    X_train = dataframe_features(train, feature_columns)
    X_test = dataframe_features(test, feature_columns)
    y_train = train[target_column].astype(int)
    y_test = test[target_column].astype(int)

    preprocessor = build_numeric_preprocessor(feature_columns)
    X_train_t = preprocessor.fit_transform(X_train)
    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
        class_weight="balanced",
        n_jobs=1,
    )
    model.fit(X_train_t, y_train)

    majority_class = int(y_train.value_counts().idxmax())
    return TrainResult(
        model=model,
        preprocessor=preprocessor,
        X_train=X_train,
        X_test=X_test,
        y_train=y_train,
        y_test=y_test,
        feature_columns=list(feature_columns),
        train_months=train_months,
        test_months=test_months,
        majority_baseline=np.full(len(test), majority_class, dtype=int),
        persistence_baseline=test["deficit_lag_1"].astype(int).to_numpy(),
    )
