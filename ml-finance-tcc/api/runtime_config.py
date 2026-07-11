"""Runtime configuration for the internal ML API."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class MlRuntimeConfig:
    environment: str
    internal_api_key: str | None
    docs_enabled: bool


LOCAL_ENVIRONMENTS = {"development", "test"}
MIN_INTERNAL_KEY_LENGTH = 32
PLACEHOLDER_PREFIXES = ("troque_", "change_me", "replace_me")


def resolve_runtime_config(
    environ: Mapping[str, str] | None = None,
) -> MlRuntimeConfig:
    source = environ if environ is not None else os.environ
    environment = _normalize_environment(source.get("ML_ENV"))
    internal_api_key = _normalize_optional_secret(source.get("ML_INTERNAL_API_KEY"))
    docs_enabled = environment in LOCAL_ENVIRONMENTS

    if not docs_enabled:
        _validate_exposed_environment_key(internal_api_key)

    return MlRuntimeConfig(
        environment=environment,
        internal_api_key=internal_api_key,
        docs_enabled=docs_enabled,
    )


def _normalize_environment(environment: str | None) -> str:
    normalized = environment.strip().lower() if environment is not None else ""
    return normalized or "development"


def _normalize_optional_secret(secret: str | None) -> str | None:
    normalized = secret.strip() if secret is not None else ""
    return normalized or None


def _validate_exposed_environment_key(internal_api_key: str | None) -> None:
    if internal_api_key is None:
        raise ValueError("ML_INTERNAL_API_KEY is required outside development/test.")

    if len(internal_api_key) < MIN_INTERNAL_KEY_LENGTH:
        raise ValueError("ML_INTERNAL_API_KEY must have at least 32 characters.")

    if _is_predictable_placeholder(internal_api_key):
        raise ValueError(
            "ML_INTERNAL_API_KEY must not use a predictable placeholder value."
        )


def _is_predictable_placeholder(secret: str) -> bool:
    normalized = secret.strip().lower()
    return any(normalized.startswith(prefix) for prefix in PLACEHOLDER_PREFIXES)
