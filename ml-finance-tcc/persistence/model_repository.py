"""Persistencia de modelo, pre-processador e manifesto versionado."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib

from ml.feature_engineering import (
    FEATURE_COLUMNS,
    MIN_HISTORY_MONTHS,
    SCHEMA_VERSION,
    TARGET_COLUMN,
)

MODEL_FILENAME = "modelo.pkl"
SCALER_FILENAME = "scaler.pkl"
FEATURES_FILENAME = "features.json"


class ModelRepository:
    def __init__(self, models_dir: Path) -> None:
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def paths(self) -> tuple[Path, Path, Path]:
        return (
            self.models_dir / MODEL_FILENAME,
            self.models_dir / SCALER_FILENAME,
            self.models_dir / FEATURES_FILENAME,
        )

    def save(self, model: Any, preprocessor: Any) -> None:
        model_path, scaler_path, manifest_path = self.paths()
        joblib.dump(model, model_path)
        joblib.dump(preprocessor, scaler_path)
        manifest_path.write_text(
            json.dumps(
                {
                    "schema_version": SCHEMA_VERSION,
                    "features": FEATURE_COLUMNS,
                    "target": TARGET_COLUMN,
                    "minimum_history_months": MIN_HISTORY_MONTHS,
                    "temporal_policy": "features use only complete months before target",
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    def load(self) -> tuple[Any, Any, dict[str, Any]]:
        model_path, scaler_path, manifest_path = self.paths()
        if (
            not model_path.is_file()
            or not scaler_path.is_file()
            or not manifest_path.is_file()
        ):
            raise FileNotFoundError(
                "Artefatos nao encontrados. Execute `python main.py train`."
            )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (
            manifest.get("schema_version") != SCHEMA_VERSION
            or manifest.get("features") != FEATURE_COLUMNS
        ):
            raise ValueError("Artefatos incompativeis com o contrato ML V2.")
        return joblib.load(model_path), joblib.load(scaler_path), manifest
