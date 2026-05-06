"""Análise exploratória: histogramas, boxplots e heatmap de correlação (Pearson)."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns


def run_eda(df: pd.DataFrame, target_column: str, reports_dir: Path) -> None:
    reports_dir.mkdir(parents=True, exist_ok=True)
    feature_cols = [c for c in df.columns if c != target_column]

    for col in feature_cols:
        fig, ax = plt.subplots(figsize=(5, 3))
        sns.histplot(df[col].dropna(), kde=True, ax=ax)
        ax.set_title(f"Histograma — {col}")
        fig.tight_layout()
        fig.savefig(reports_dir / f"hist_{col}.png", dpi=120)
        plt.close(fig)

    n = len(feature_cols)
    fig, axes = plt.subplots(1, n, figsize=(3 * n, 4), squeeze=False)
    for i, col in enumerate(feature_cols):
        sns.boxplot(y=df[col], ax=axes[0][i])
        axes[0][i].set_title(col)
    fig.suptitle("Boxplots das features")
    fig.tight_layout()
    fig.savefig(reports_dir / "boxplots_features.png", dpi=130)
    plt.close(fig)

    plt.figure(figsize=(7, 6))
    corr = df[feature_cols + [target_column]].corr(method="pearson")
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", center=0)
    plt.title("Correlação de Pearson")
    plt.tight_layout()
    plt.savefig(reports_dir / "heatmap_correlacao.png", dpi=130)
    plt.close()
