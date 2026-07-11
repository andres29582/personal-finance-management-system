"""API REST estrita para o contrato de previsao V2."""

from __future__ import annotations

import math
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from api.runtime_config import MlRuntimeConfig, resolve_runtime_config
from ml.feature_engineering import FEATURE_COLUMNS, SCHEMA_VERSION
from persistence.model_repository import ModelRepository

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
FiniteNumber = Annotated[float, Field(allow_inf_nan=False)]

_model = None
_preprocessor = None
_manifest: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model, _preprocessor, _manifest
    _model, _preprocessor, _manifest = ModelRepository(MODELS_DIR).load()
    if hasattr(_model, "n_jobs"):
        _model.n_jobs = 1
    yield
    _model, _preprocessor, _manifest = None, None, {}


class PredictionFeaturesV2(BaseModel):
    model_config = ConfigDict(extra="forbid")

    receita_lag_1: FiniteNumber
    despesa_lag_1: FiniteNumber
    media_receita_3m: FiniteNumber
    media_despesa_3m: FiniteNumber
    tendencia_receita_3m: FiniteNumber
    tendencia_despesa_3m: FiniteNumber
    volatilidade_despesa_3m: FiniteNumber
    media_transacoes_receita_3m: FiniteNumber
    media_transacoes_despesa_3m: FiniteNumber
    taxa_deficit_3m: FiniteNumber = Field(ge=0, le=1)
    saldo_inicial_mes: FiniteNumber
    mes_do_ano: int = Field(ge=1, le=12)

    @field_validator("*")
    @classmethod
    def require_finite_numbers(cls, value):
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("Todos os valores devem ser finitos.")
        return value


class PredictRequestV2(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[2]
    features: PredictionFeaturesV2


class PredictResponseV2(BaseModel):
    schema_version: Literal[2]
    prediction: int = Field(ge=0, le=1)
    probability: float = Field(ge=0, le=1)


def require_internal_key(config: MlRuntimeConfig):
    def dependency(
        x_ml_internal_key: str | None = Header(
            default=None,
            alias="X-ML-Internal-Key",
        ),
    ) -> None:
        if config.internal_api_key is None:
            return

        if x_ml_internal_key is None or not secrets.compare_digest(
            x_ml_internal_key,
            config.internal_api_key,
        ):
            raise HTTPException(status_code=401, detail="Nao autorizado.")

    return dependency


def health() -> dict[str, object]:
    return {"status": "ok", "schema_version": SCHEMA_VERSION}


def predict(payload: PredictRequestV2) -> PredictResponseV2:
    if _model is None or _preprocessor is None:
        raise HTTPException(status_code=503, detail="Modelo nao carregado.")
    if _manifest.get("schema_version") != SCHEMA_VERSION:
        raise HTTPException(status_code=503, detail="Contrato do modelo incompativel.")

    values = payload.features.model_dump()
    if list(values.keys()) != FEATURE_COLUMNS:
        raise HTTPException(status_code=422, detail="Ordem de features incompativel.")
    transformed = _preprocessor.transform(pd.DataFrame([values]))
    prediction = int(_model.predict(transformed)[0])
    probability = float(_model.predict_proba(transformed)[0, 1])
    return PredictResponseV2(
        schema_version=SCHEMA_VERSION,
        prediction=prediction,
        probability=probability,
    )


def create_app(config: MlRuntimeConfig | None = None) -> FastAPI:
    runtime_config = config or resolve_runtime_config()
    application = FastAPI(
        title="ML Finance TCC",
        description="Previsao temporal de deficit mensal sem fuga de informacao.",
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/docs" if runtime_config.docs_enabled else None,
        redoc_url="/redoc" if runtime_config.docs_enabled else None,
        openapi_url="/openapi.json" if runtime_config.docs_enabled else None,
    )
    application.get("/health")(health)
    application.post(
        "/predict",
        response_model=PredictResponseV2,
        dependencies=[Depends(require_internal_key(runtime_config))],
    )(predict)
    return application


app = create_app()
