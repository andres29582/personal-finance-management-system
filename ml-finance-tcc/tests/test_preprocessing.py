import numpy as np
import pandas as pd

from ml.preprocessing import build_numeric_preprocessor, dataframe_features


def test_dataframe_features_returns_requested_columns_copy():
    df = pd.DataFrame(
        {
            "receita_lag_1": [1000],
            "media_despesa_3m": [800],
            "saldo_inicial_mes": [2500],
            "mes_do_ano": [7],
            "deficit_mes": [0],
        }
    )

    requested_columns = ["receita_lag_1", "media_despesa_3m", "mes_do_ano"]
    features = dataframe_features(df, requested_columns)
    features.loc[0, "receita_lag_1"] = 9999

    assert list(features.columns) == requested_columns
    assert df.loc[0, "receita_lag_1"] == 1000


def test_numeric_preprocessor_imputes_and_scales_values():
    df = pd.DataFrame(
        {
            "media_despesa_3m": [500.0, np.nan, 900.0],
            "saldo_inicial_mes": [1000.0, 2000.0, 3000.0],
        }
    )
    feature_columns = ["media_despesa_3m", "saldo_inicial_mes"]
    preprocessor = build_numeric_preprocessor(feature_columns)

    transformed = preprocessor.fit_transform(df)

    assert transformed.shape == (3, 2)
    assert not np.isnan(transformed).any()
