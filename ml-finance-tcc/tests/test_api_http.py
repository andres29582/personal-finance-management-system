import importlib

import numpy as np
import pytest
from fastapi.testclient import TestClient

from api.runtime_config import resolve_runtime_config
from ml.feature_engineering import FEATURE_COLUMNS
from tests.test_api import payload

STRONG_KEY = "synthetic-ml-key-with-at-least-32-chars"


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


@pytest.fixture()
def api_module(monkeypatch):
    api_module = importlib.import_module("api.app")
    monkeypatch.setattr(api_module, "ModelRepository", DummyRepository)
    return api_module


def make_client(api_module, environ):
    app = api_module.create_app(resolve_runtime_config(environ))
    return TestClient(app)


def test_development_without_key_allows_predict(api_module):
    with make_client(api_module, {"ML_ENV": "development"}) as client:
        prediction = client.post("/predict", json=payload())

    assert prediction.status_code == 200


def test_test_without_key_allows_predict(api_module):
    with make_client(api_module, {"ML_ENV": "test"}) as client:
        prediction = client.post("/predict", json=payload())

    assert prediction.status_code == 200


def test_development_with_key_requires_header(api_module):
    with make_client(
        api_module,
        {"ML_ENV": "development", "ML_INTERNAL_API_KEY": STRONG_KEY},
    ) as client:
        response = client.post("/predict", json=payload())

    assert response.status_code == 401
    assert response.json() == {"detail": "Nao autorizado."}


def test_valid_key_allows_prediction(api_module):
    with make_client(
        api_module,
        {"ML_ENV": "development", "ML_INTERNAL_API_KEY": STRONG_KEY},
    ) as client:
        response = client.post(
            "/predict",
            json=payload(),
            headers={"X-ML-Internal-Key": STRONG_KEY},
        )

    assert response.status_code == 200
    assert response.json() == {
        "schema_version": 2,
        "prediction": 1,
        "probability": 0.8,
    }


def test_missing_key_returns_generic_401(api_module):
    with make_client(
        api_module,
        {"ML_ENV": "development", "ML_INTERNAL_API_KEY": STRONG_KEY},
    ) as client:
        response = client.post("/predict", json=payload())

    assert response.status_code == 401
    assert response.text == '{"detail":"Nao autorizado."}'
    assert STRONG_KEY not in response.text


def test_wrong_key_returns_generic_401(api_module):
    with make_client(
        api_module,
        {"ML_ENV": "development", "ML_INTERNAL_API_KEY": STRONG_KEY},
    ) as client:
        response = client.post(
            "/predict",
            json=payload(),
            headers={"X-ML-Internal-Key": "wrong-key"},
        )

    assert response.status_code == 401
    assert response.text == '{"detail":"Nao autorizado."}'
    assert STRONG_KEY not in response.text


@pytest.mark.parametrize("environment", ["production", "demo", "staging"])
def test_exposed_environment_without_key_fails_app_creation(api_module, environment):
    with pytest.raises(ValueError):
        api_module.create_app(resolve_runtime_config({"ML_ENV": environment}))


def test_exposed_environment_rejects_short_key(api_module):
    with pytest.raises(ValueError):
        api_module.create_app(
            resolve_runtime_config(
                {"ML_ENV": "production", "ML_INTERNAL_API_KEY": "short"}
            )
        )


def test_exposed_environment_rejects_placeholder(api_module):
    with pytest.raises(ValueError):
        api_module.create_app(
            resolve_runtime_config(
                {
                    "ML_ENV": "production",
                    "ML_INTERNAL_API_KEY": "change_me_synthetic_secret_32_chars",
                }
            )
        )


def test_production_with_valid_key_starts(api_module):
    with make_client(
        api_module,
        {"ML_ENV": "production", "ML_INTERNAL_API_KEY": STRONG_KEY},
    ) as client:
        health = client.get("/health")

    assert health.status_code == 200


def test_health_remains_public_and_minimal(api_module):
    with make_client(
        api_module,
        {"ML_ENV": "production", "ML_INTERNAL_API_KEY": STRONG_KEY},
    ) as client:
        health = client.get("/health")

    assert health.json() == {"status": "ok", "schema_version": 2}
    assert set(health.json()) == {"status", "schema_version"}


def test_docs_exist_in_development(api_module):
    with make_client(api_module, {"ML_ENV": "development"}) as client:
        response = client.get("/docs")

    assert response.status_code == 200


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_docs_are_disabled_in_production(api_module, path):
    with make_client(
        api_module,
        {"ML_ENV": "production", "ML_INTERNAL_API_KEY": STRONG_KEY},
    ) as client:
        response = client.get(path)

    assert response.status_code == 404


def test_predict_endpoint_uses_contract_v2(api_module):
    with make_client(api_module, {"ML_ENV": "development"}) as client:
        response = client.post("/predict", json=payload())

    assert response.status_code == 200
    assert response.json() == {
        "schema_version": 2,
        "prediction": 1,
        "probability": 0.8,
    }


def test_predict_endpoint_rejects_old_and_extra_fields(api_module):
    invalid = payload()
    invalid["features"]["receita_mes"] = 3000

    with make_client(api_module, {"ML_ENV": "development"}) as client:
        response = client.post("/predict", json=invalid)

    assert response.status_code == 422


def test_origin_request_does_not_receive_cors_header(api_module):
    with make_client(api_module, {"ML_ENV": "development"}) as client:
        response = client.post(
            "/predict",
            json=payload(),
            headers={"Origin": "http://localhost:8081"},
        )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
