"""Importância por informação mútua (com imputação mediana nas features)."""

from __future__ import annotations

import pandas as pd
from sklearn.feature_selection import mutual_info_classif
from sklearn.impute import SimpleImputer


def mutual_information_scores(
    X: pd.DataFrame,
    y: pd.Series,
    random_state: int = 42,
) -> dict[str, float]:
    imputer = SimpleImputer(strategy="median")
    X_imp = imputer.fit_transform(X)
    mi = mutual_info_classif(X_imp, y, random_state=random_state)
    return {col: float(v) for col, v in zip(X.columns, mi)}
