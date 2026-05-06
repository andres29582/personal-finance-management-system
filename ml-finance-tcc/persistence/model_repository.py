"""Persistência do modelo, pré-processador (scaler) e lista de features."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib


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

    def save(self, model: Any, preprocessor: Any, feature_names: list[str]) -> None:
        model_path, scaler_path, feat_path = self.paths()
        joblib.dump(model, model_path)
        joblib.dump(preprocessor, scaler_path)
        feat_path.write_text(json.dumps({"features": feature_names}, indent=2), encoding="utf-8")

    def load(self) -> tuple[Any, Any, list[str]]:
        model_path, scaler_path, feat_path = self.paths()
        if not model_path.is_file() or not scaler_path.is_file() or not feat_path.is_file():
            raise FileNotFoundError(
                "Artefatos não encontrados. Execute `python main.py train` a partir de ml-finance-tcc/."
            )
        model = joblib.load(model_path)
        preprocessor = joblib.load(scaler_path)
        meta = json.loads(feat_path.read_text(encoding="utf-8"))
        features = list(meta["features"])
        return model, preprocessor, features
