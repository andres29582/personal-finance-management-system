import pytest

from api.runtime_config import resolve_runtime_config


STRONG_KEY = "synthetic-ml-key-with-at-least-32-chars"


def test_defaults_to_development_with_docs_enabled_and_optional_key():
    config = resolve_runtime_config({})

    assert config.environment == "development"
    assert config.internal_api_key is None
    assert config.docs_enabled is True


def test_normalizes_environment_and_key():
    config = resolve_runtime_config(
        {
            "ML_ENV": " Test ",
            "ML_INTERNAL_API_KEY": f" {STRONG_KEY} ",
        }
    )

    assert config.environment == "test"
    assert config.internal_api_key == STRONG_KEY
    assert config.docs_enabled is True


@pytest.mark.parametrize("environment", ["production", "demo", "staging"])
def test_exposed_environments_require_internal_key(environment):
    with pytest.raises(ValueError) as error:
        resolve_runtime_config({"ML_ENV": environment})

    assert "ML_INTERNAL_API_KEY is required" in str(error.value)


def test_exposed_environment_rejects_blank_internal_key():
    with pytest.raises(ValueError):
        resolve_runtime_config({"ML_ENV": "production", "ML_INTERNAL_API_KEY": "   "})


def test_exposed_environment_rejects_short_internal_key():
    with pytest.raises(ValueError) as error:
        resolve_runtime_config(
            {"ML_ENV": "production", "ML_INTERNAL_API_KEY": "short"}
        )

    assert "at least 32 characters" in str(error.value)


@pytest.mark.parametrize("prefix", ["troque_", "change_me", "replace_me"])
def test_exposed_environment_rejects_predictable_placeholders(prefix):
    secret = f"{prefix}synthetic-secret-with-32-chars"

    with pytest.raises(ValueError) as error:
        resolve_runtime_config({"ML_ENV": "production", "ML_INTERNAL_API_KEY": secret})

    assert secret not in str(error.value)
    assert "predictable placeholder" in str(error.value)


def test_production_with_valid_key_disables_docs():
    config = resolve_runtime_config(
        {"ML_ENV": "production", "ML_INTERNAL_API_KEY": STRONG_KEY}
    )

    assert config.environment == "production"
    assert config.internal_api_key == STRONG_KEY
    assert config.docs_enabled is False
