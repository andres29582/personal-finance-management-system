"""Métricas de classificação binária e matriz de confusão."""

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
    accuracy: float
    precision: float
    recall: float
    f1: float
    roc_auc: float | None
    confusion_matrix: np.ndarray
    classification_report: str
    mutual_information: dict[str, float]
    feature_importance_rf: dict[str, float]


def evaluate_binary_classifier(
    model: Any,
    preprocessor: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    feature_columns: list[str],
    mutual_info_scores: dict[str, float],
    reports_dir: Path,
) -> EvaluationReport:
    X_t = preprocessor.transform(X_test)
    y_pred = model.predict(X_t)
    y_proba = model.predict_proba(X_t)[:, 1]

    acc = float(metrics.accuracy_score(y_test, y_pred))
    prec = float(metrics.precision_score(y_test, y_pred, zero_division=0))
    rec = float(metrics.recall_score(y_test, y_pred, zero_division=0))
    f1 = float(metrics.f1_score(y_test, y_pred, zero_division=0))
    try:
        roc = float(metrics.roc_auc_score(y_test, y_proba))
    except ValueError:
        roc = None

    cm = metrics.confusion_matrix(y_test, y_pred)
    report = metrics.classification_report(y_test, y_pred, digits=4)

    importances = dict(zip(feature_columns, model.feature_importances_.tolist()))

    reports_dir.mkdir(parents=True, exist_ok=True)
    disp = metrics.ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=[0, 1])
    fig, ax = plt.subplots(figsize=(4, 4))
    disp.plot(ax=ax, cmap="Blues", colorbar=False)
    ax.set_title("Matriz de confusão (teste)")
    fig.tight_layout()
    fig.savefig(reports_dir / "confusion_matrix.png", dpi=150)
    plt.close(fig)

    # Curva ROC (se AUC definido)
    if roc is not None:
        fpr, tpr, _ = metrics.roc_curve(y_test, y_proba)
        fig2, ax2 = plt.subplots(figsize=(4, 4))
        ax2.plot(fpr, tpr, label=f"AUC = {roc:.3f}")
        ax2.plot([0, 1], [0, 1], "k--", alpha=0.4)
        ax2.set_xlabel("Taxa de falsos positivos")
        ax2.set_ylabel("Taxa de verdadeiros positivos")
        ax2.set_title("Curva ROC (teste)")
        ax2.legend(loc="lower right")
        fig2.tight_layout()
        fig2.savefig(reports_dir / "roc_curve.png", dpi=150)
        plt.close(fig2)

        prec_c, rec_c, _ = metrics.precision_recall_curve(y_test, y_proba)
        fig3, ax3 = plt.subplots(figsize=(4, 4))
        ax3.plot(rec_c, prec_c)
        ax3.set_xlabel("Recall")
        ax3.set_ylabel("Precisão")
        ax3.set_title("Curva Precision–Recall (teste)")
        fig3.tight_layout()
        fig3.savefig(reports_dir / "precision_recall_curve.png", dpi=150)
        plt.close(fig3)

    return EvaluationReport(
        accuracy=acc,
        precision=prec,
        recall=rec,
        f1=f1,
        roc_auc=roc,
        confusion_matrix=cm,
        classification_report=report,
        mutual_information=mutual_info_scores,
        feature_importance_rf=importances,
    )
