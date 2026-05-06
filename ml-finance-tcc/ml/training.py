"""Treino supervisionado: divisão 80/20 e RandomForestClassifier."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

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


def train_classifier(
    df: pd.DataFrame,
    target_column: str,
    test_size: float = 0.2,
    random_state: int = 42,
    n_estimators: int = 200,
    max_depth: int | None = 12,
) -> TrainResult:
    feature_columns = [c for c in df.columns if c != target_column]
    X = dataframe_features(df, feature_columns)
    y = df[target_column].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )

    preprocessor = build_numeric_preprocessor(feature_columns)
    X_train_t = preprocessor.fit_transform(X_train)
    X_test_t = preprocessor.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
        class_weight="balanced",
        n_jobs=-1,
    )
    model.fit(X_train_t, y_train)

    return TrainResult(
        model=model,
        preprocessor=preprocessor,
        X_train=X_train,
        X_test=X_test,
        y_train=y_train,
        y_test=y_test,
        feature_columns=list(feature_columns),
    )
