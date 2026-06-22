import importlib

import numpy as np
from fastapi.testclient import TestClient

from ml.feature_engineering import FEATURE_COLUMNS
from tests.test_api import payload


class DummyPreprocessor:
    def transform(self, value):
        return value


class DummyModel:
    def predict(self, value):
        return [1]

    def predict_proba(self, value):
        return np.array([[0.2, 0.8]])


class DummyRepository:
    def __init__(self, models_dir):
        self.models_dir = models_dir

    def load(self):
        return (
            DummyModel(),
            DummyPreprocessor(),
            {"schema_version": 2, "features": FEATURE_COLUMNS},
        )


def test_health_and_predict_endpoints_use_contract_v2(monkeypatch):
    api_module = importlib.import_module("api.app")
    monkeypatch.setattr(api_module, "ModelRepository", DummyRepository)

    with TestClient(api_module.app) as client:
        health = client.get("/health")
        prediction = client.post("/predict", json=payload())

    assert health.json() == {"status": "ok", "schema_version": 2}
    assert prediction.status_code == 200
    assert prediction.json() == {
        "schema_version": 2,
        "prediction": 1,
        "probability": 0.8,
    }


def test_predict_endpoint_rejects_old_and_extra_fields(monkeypatch):
    api_module = importlib.import_module("api.app")
    monkeypatch.setattr(api_module, "ModelRepository", DummyRepository)
    invalid = payload()
    invalid["features"]["receita_mes"] = 3000

    with TestClient(api_module.app) as client:
        response = client.post("/predict", json=invalid)

    assert response.status_code == 422
