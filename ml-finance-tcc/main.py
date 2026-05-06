"""
Orquestração do pipeline: geração de dados sintéticos, EDA, treino, avaliação e persistência.

Uso (a partir da pasta `ml-finance-tcc/`):
    python main.py train
"""

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
from ml.feature_stats import mutual_information_scores
from ml.training import train_classifier
from persistence.model_repository import ModelRepository


TARGET = "deficit_mes"
DATA_CSV = ROOT / "data" / "monthly_finance_sample.csv"
REPORTS_DIR = ROOT / "reports"
MODELS_DIR = ROOT / "models"


def cmd_train() -> None:
    if not DATA_CSV.is_file():
        print(f"Gerando dataset sintético em {DATA_CSV} ...")
        write_sample_csv(DATA_CSV, n_rows=400, random_state=42)

    loader = DataLoader(DATA_CSV)
    df = loader.load()
    profile = loader.profile(df, TARGET)
    issues = loader.validate(df, TARGET)
    if issues:
        raise SystemExit("Validação falhou:\n- " + "\n- ".join(issues))

    print("Perfil do dataset:")
    print(f"  Linhas: {profile.n_rows} | Colunas: {profile.n_columns}")
    print(f"  Features numéricas: {profile.numeric_columns}")
    print(f"  Nulos: {profile.null_counts}")

    print("Executando EDA (gráficos em reports/) ...")
    run_eda(df, TARGET, REPORTS_DIR)

    print("Treinando modelo (80% treino / 20% teste) ...")
    result = train_classifier(df, target_column=TARGET, test_size=0.2, random_state=42)

    print("Informação mútua (treino, com imputação mediana auxiliar) ...")
    mi_scores = mutual_information_scores(result.X_train, result.y_train)

    print("Avaliação no conjunto de teste ...")
    ev = evaluate_binary_classifier(
        result.model,
        result.preprocessor,
        result.X_test,
        result.y_test,
        result.feature_columns,
        mi_scores,
        REPORTS_DIR,
    )

    print("\n=== Métricas (teste) ===")
    print(f"Acurácia:  {ev.accuracy:.4f}")
    print(f"Precisão:  {ev.precision:.4f}")
    print(f"Recall:    {ev.recall:.4f}")
    print(f"F1-score:  {ev.f1:.4f}")
    print(f"ROC AUC:   {ev.roc_auc}")
    print("\nMatriz de confusão:\n", ev.confusion_matrix)
    print("\nRelatório de classificação:\n", ev.classification_report)
    print("\nImportância Random Forest:", json.dumps(ev.feature_importance_rf, indent=2))
    print("\nInformação mútua:", json.dumps(ev.mutual_information, indent=2))

    metrics_path = REPORTS_DIR / "metrics.json"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(
        json.dumps(
            {
                "accuracy": ev.accuracy,
                "precision": ev.precision,
                "recall": ev.recall,
                "f1": ev.f1,
                "roc_auc": ev.roc_auc,
                "confusion_matrix": ev.confusion_matrix.tolist(),
                "feature_importance_rf": ev.feature_importance_rf,
                "mutual_information": ev.mutual_information,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nMétricas salvas em {metrics_path}")

    repo = ModelRepository(MODELS_DIR)
    repo.save(result.model, result.preprocessor, result.feature_columns)
    print(f"Artefatos: {MODELS_DIR}/modelo.pkl, scaler.pkl, features.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pipeline ML — déficit mensal")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("train", help="Gera dados (se faltar), EDA, treina e persiste artefatos")
    args = parser.parse_args()
    if args.command == "train":
        cmd_train()


if __name__ == "__main__":
    main()
