"""Orquestracao do pipeline temporal de previsao de deficit."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from domain.data_loader import DataLoader, write_sample_csv
from ml.eda import run_eda
from ml.evaluation import evaluate_binary_classifier
from ml.feature_engineering import FEATURE_COLUMNS, TARGET_COLUMN, build_temporal_features
from ml.feature_stats import mutual_information_scores
from ml.training import train_classifier_temporal
from persistence.model_repository import ModelRepository

DATA_CSV = ROOT / "data" / "monthly_finance_sample.csv"
REPORTS_DIR = ROOT / "reports"
MODELS_DIR = ROOT / "models"


def cmd_train() -> None:
    write_sample_csv(DATA_CSV, n_users=30, n_months=24, random_state=42)
    loader = DataLoader(DATA_CSV)
    monthly_panel = loader.load()
    issues = loader.validate(monthly_panel, TARGET_COLUMN)
    if issues:
        raise SystemExit("Validacao falhou:\n- " + "\n- ".join(issues))

    dataset = build_temporal_features(monthly_panel)
    run_eda(dataset[FEATURE_COLUMNS + [TARGET_COLUMN]], TARGET_COLUMN, REPORTS_DIR)
    result = train_classifier_temporal(
        dataset,
        target_column=TARGET_COLUMN,
        feature_columns=FEATURE_COLUMNS,
    )
    mutual_information = mutual_information_scores(result.X_train, result.y_train)
    evaluation = evaluate_binary_classifier(
        result.model,
        result.preprocessor,
        result.X_test,
        result.y_test,
        result.feature_columns,
        mutual_information,
        result.majority_baseline,
        result.persistence_baseline,
        REPORTS_DIR,
    )

    metrics = {
        "schema_version": 2,
        "split": {
            "strategy": "temporal_unique_months_80_20",
            "train_months": result.train_months,
            "test_months": result.test_months,
        },
        "model": evaluation.model_metrics,
        "baselines": evaluation.baselines,
        "feature_importance_rf": evaluation.feature_importance_rf,
        "mutual_information": evaluation.mutual_information,
        "dataset": {
            "kind": "synthetic",
            "rows": len(dataset),
            "users": int(dataset["usuario_id"].nunique()),
        },
    }
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )
    ModelRepository(MODELS_DIR).save(result.model, result.preprocessor)
    print(json.dumps(metrics, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Pipeline ML temporal V2")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("train")
    args = parser.parse_args()
    if args.command == "train":
        cmd_train()


if __name__ == "__main__":
    main()
