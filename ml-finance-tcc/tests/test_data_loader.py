from pathlib import Path

import pandas as pd
import pytest

from domain.data_loader import DataLoader, generate_synthetic_monthly_finance
from tests.helpers import make_test_dir


def test_generate_load_profile_and_validate_temporal_panel():
    csv_path = make_test_dir("data-loader-valid") / "finance.csv"
    panel = generate_synthetic_monthly_finance(
        n_users=2, n_months=6, random_state=123
    )
    panel.to_csv(csv_path, index=False)

    loader = DataLoader(csv_path)
    loaded = loader.load()
    profile = loader.profile(loaded, "deficit_mes")

    assert loaded.shape == (12, 8)
    assert profile.n_rows == 12
    assert loader.validate(loaded, "deficit_mes") == []
    assert loaded.equals(
        loaded.sort_values(["mes_referencia", "usuario_id"], ignore_index=True)
    )


def test_generation_is_reproducible():
    first = generate_synthetic_monthly_finance(2, 6, random_state=10)
    second = generate_synthetic_monthly_finance(2, 6, random_state=10)

    pd.testing.assert_frame_equal(first, second)


def test_load_raises_when_csv_does_not_exist():
    loader = DataLoader(make_test_dir("data-loader-missing") / "missing.csv")
    with pytest.raises(FileNotFoundError):
        loader.load()


def test_validate_rejects_missing_columns_duplicates_and_invalid_months():
    loader = DataLoader(Path("unused.csv"))
    assert "Colunas obrigatorias ausentes" in loader.validate(
        pd.DataFrame(), "deficit_mes"
    )[1]

    invalid = generate_synthetic_monthly_finance(1, 4)
    invalid.loc[0, "mes_referencia"] = "01-2024"
    invalid = pd.concat([invalid, invalid.iloc[[1]]], ignore_index=True)
    issues = loader.validate(invalid, "deficit_mes")

    assert "mes_referencia deve usar o formato YYYY-MM." in issues
    assert "Cada usuario deve possuir no maximo uma linha por mes." in issues
