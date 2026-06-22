"""Avaliacao do modelo e de baselines temporais."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn import metrics


@dataclass
class EvaluationReport:
    model_metrics: dict[str, object]
    baselines: dict[str, dict[str, object]]
    mutual_information: dict[str, float]
    feature_importance_rf: dict[str, float]


def classification_metrics(
    y_true: pd.Series | np.ndarray,
    y_pred: np.ndarray,
    y_probability: np.ndarray | None = None,
) -> dict[str, object]:
    result: dict[str, object] = {
        "accuracy": float(metrics.accuracy_score(y_true, y_pred)),
        "precision": float(metrics.precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(metrics.recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(metrics.f1_score(y_true, y_pred, zero_division=0)),
        "confusion_matrix": metrics.confusion_matrix(y_true, y_pred).tolist(),
    }
    if y_probability is not None:
        try:
            result["roc_auc"] = float(metrics.roc_auc_score(y_true, y_probability))
        except ValueError:
            result["roc_auc"] = None
    return result


def evaluate_binary_classifier(
    model: Any,
    preprocessor: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    feature_columns: list[str],
    mutual_info_scores: dict[str, float],
    majority_baseline: np.ndarray,
    persistence_baseline: np.ndarray,
    reports_dir: Path,
) -> EvaluationReport:
    X_t = preprocessor.transform(X_test)
    y_pred = model.predict(X_t)
    y_proba = model.predict_proba(X_t)[:, 1]
    model_metrics = classification_metrics(y_test, y_pred, y_proba)
    baselines = {
        "majority": classification_metrics(y_test, majority_baseline),
        "persistence": classification_metrics(y_test, persistence_baseline),
    }
    importances = dict(zip(feature_columns, model.feature_importances_.tolist()))

    reports_dir.mkdir(parents=True, exist_ok=True)
    confusion_matrix = np.asarray(model_metrics["confusion_matrix"])
    display = metrics.ConfusionMatrixDisplay(
        confusion_matrix=confusion_matrix, display_labels=[0, 1]
    )
    fig, ax = plt.subplots(figsize=(4, 4))
    display.plot(ax=ax, cmap="Blues", colorbar=False)
    ax.set_title("Matriz de confusao temporal")
    fig.tight_layout()
    fig.savefig(reports_dir / "confusion_matrix.png", dpi=150)
    plt.close(fig)

    if model_metrics.get("roc_auc") is not None:
        fpr, tpr, _ = metrics.roc_curve(y_test, y_proba)
        fig2, ax2 = plt.subplots(figsize=(4, 4))
        ax2.plot(fpr, tpr, label=f"AUC = {model_metrics['roc_auc']:.3f}")
        ax2.plot([0, 1], [0, 1], "k--", alpha=0.4)
        ax2.set_xlabel("Taxa de falsos positivos")
        ax2.set_ylabel("Taxa de verdadeiros positivos")
        ax2.set_title("Curva ROC temporal")
        ax2.legend(loc="lower right")
        fig2.tight_layout()
        fig2.savefig(reports_dir / "roc_curve.png", dpi=150)
        plt.close(fig2)

    return EvaluationReport(
        model_metrics=model_metrics,
        baselines=baselines,
        mutual_information=mutual_info_scores,
        feature_importance_rf=importances,
    )
