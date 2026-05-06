"""API REST: POST /predict — contrato alinhado à especificação acadêmica."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from persistence.model_repository import ModelRepository

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"

_model = None
_preprocessor = None
_feature_names: list[str] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model, _preprocessor, _feature_names
    repo = ModelRepository(MODELS_DIR)
    _model, _preprocessor, _feature_names = repo.load()
    yield
    _model, _preprocessor, _feature_names = None, None, []


app = FastAPI(
    title="ML Finance TCC",
    description="Classificação binária: déficit mensal (1) vs equilíbrio/superávit (0).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictResponse(BaseModel):
    prediction: int = Field(..., description="Classe prevista (0 ou 1)")
    probability: float = Field(..., description="Probabilidade estimada da classe positiva (déficit)")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: dict) -> PredictResponse:
    if _model is None or _preprocessor is None:
        raise HTTPException(status_code=503, detail="Modelo não carregado.")
    missing = [f for f in _feature_names if f not in payload]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Campos ausentes: {missing}. Esperados: {_feature_names}",
        )
    row = {k: payload[k] for k in _feature_names}
    X = pd.DataFrame([row])
    X_t = _preprocessor.transform(X)
    pred = int(_model.predict(X_t)[0])
    proba = float(_model.predict_proba(X_t)[0, 1])
    return PredictResponse(prediction=pred, probability=proba)
