import json

import pytest

from ml.feature_engineering import FEATURE_COLUMNS
from persistence.model_repository import ModelRepository
from tests.helpers import make_test_dir


def test_model_repository_saves_and_loads_v2_manifest():
    repo = ModelRepository(make_test_dir("model-repository-save-load"))
    repo.save({"kind": "model"}, {"kind": "preprocessor"})

    model, preprocessor, manifest = repo.load()

    assert model == {"kind": "model"}
    assert preprocessor == {"kind": "preprocessor"}
    assert manifest["schema_version"] == 2
    assert manifest["features"] == FEATURE_COLUMNS
    assert manifest["minimum_history_months"] == 3


def test_model_repository_rejects_incompatible_manifest():
    repo = ModelRepository(make_test_dir("model-repository-invalid"))
    repo.save({"kind": "model"}, {"kind": "preprocessor"})
    _, _, manifest_path = repo.paths()
    manifest_path.write_text(
        json.dumps({"schema_version": 1, "features": []}), encoding="utf-8"
    )

    with pytest.raises(ValueError, match="incompativeis"):
        repo.load()


def test_model_repository_load_raises_when_artifacts_are_missing():
    repo = ModelRepository(make_test_dir("model-repository-missing"))
    with pytest.raises(FileNotFoundError):
        repo.load()
