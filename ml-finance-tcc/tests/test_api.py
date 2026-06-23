import importlib

import numpy as np
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from ml.feature_engineering import FEATURE_COLUMNS


class DummyPreprocessor:
    def transform(self, value):
        assert list(value.columns) == FEATURE_COLUMNS
        return value


class DummyModel:
    def predict(self, value):
        return [1]

    def predict_proba(self, value):
        return np.array([[0.2, 0.8]])


def payload():
    return {
        "schema_version": 2,
        "features": {
            "receita_lag_1": 1000,
            "despesa_lag_1": 900,
            "media_receita_3m": 1000,
            "media_despesa_3m": 850,
            "tendencia_receita_3m": 50,
            "tendencia_despesa_3m": -25,
            "volatilidade_despesa_3m": 100,
            "media_transacoes_receita_3m": 2,
            "media_transacoes_despesa_3m": 10,
            "taxa_deficit_3m": 0.3333,
            "saldo_inicial_mes": 500,
            "mes_do_ano": 7,
        },
    }


@pytest.fixture()
def api_module(monkeypatch):
    module = importlib.import_module("api.app")
    monkeypatch.setattr(module, "_model", DummyModel())
    monkeypatch.setattr(module, "_preprocessor", DummyPreprocessor())
    monkeypatch.setattr(
        module,
        "_manifest",
        {"schema_version": 2, "features": FEATURE_COLUMNS},
    )
    return module


def test_predict_returns_v2_model_prediction(api_module):
    request = api_module.PredictRequestV2.model_validate(payload())
    response = api_module.predict(request)

    assert response.schema_version == 2
    assert response.prediction == 1
    assert response.probability == 0.8


def test_request_rejects_v1_extra_fields_and_non_finite_values(api_module):
    with pytest.raises(ValidationError):
        api_module.PredictRequestV2.model_validate(
            {**payload(), "schema_version": 1}
        )
    with pytest.raises(ValidationError):
        api_module.PredictRequestV2.model_validate(
            {
                **payload(),
                "features": {**payload()["features"], "receita_mes": 999},
            }
        )
    with pytest.raises(ValidationError):
        api_module.PredictRequestV2.model_validate(
            {
                **payload(),
                "features": {
                    **payload()["features"],
                    "receita_lag_1": float("inf"),
                },
            }
        )


def test_predict_returns_503_when_model_is_not_loaded(api_module, monkeypatch):
    monkeypatch.setattr(api_module, "_model", None)
    with pytest.raises(HTTPException) as error:
        api_module.predict(api_module.PredictRequestV2.model_validate(payload()))
    assert error.value.status_code == 503
