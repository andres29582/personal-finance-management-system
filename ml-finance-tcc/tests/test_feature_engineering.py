import pandas as pd

from ml.feature_engineering import FEATURE_COLUMNS, build_temporal_features


def make_panel() -> pd.DataFrame:
    return pd.DataFrame(
        [
            ["u1", "2026-01", 1000, 700, 100, 7, 2, 0],
            ["u1", "2026-02", 1200, 900, 400, 9, 3, 0],
            ["u1", "2026-03", 1400, 1500, 700, 15, 4, 1],
            ["u1", "2026-04", 99999, 99999, 600, 99, 99, 0],
        ],
        columns=[
            "usuario_id",
            "mes_referencia",
            "receita_mes",
            "despesa_mes",
            "saldo_inicial_mes",
            "num_transacoes_despesa",
            "num_transacoes_receita",
            "deficit_mes",
        ],
    )


def test_builds_v2_features_only_from_three_previous_months():
    result = build_temporal_features(make_panel())
    row = result.iloc[0]

    assert row["mes_referencia"] == "2026-04"
    assert row["receita_lag_1"] == 1400
    assert row["despesa_lag_1"] == 1500
    assert row["media_receita_3m"] == 1200
    assert row["media_despesa_3m"] == 1033.3333
    assert row["tendencia_receita_3m"] == 200
    assert row["tendencia_despesa_3m"] == 400
    assert row["volatilidade_despesa_3m"] == 416.3332
    assert row["media_transacoes_receita_3m"] == 3
    assert row["media_transacoes_despesa_3m"] == 10.3333
    assert row["taxa_deficit_3m"] == 0.3333
    assert row["saldo_inicial_mes"] == 600
    assert row["mes_do_ano"] == 4
    assert "receita_mes" not in FEATURE_COLUMNS
    assert "despesa_mes" not in FEATURE_COLUMNS
    assert 99999 not in row[FEATURE_COLUMNS].values


def test_skips_target_when_previous_months_are_not_consecutive():
    panel = make_panel().query("mes_referencia != '2026-02'")
    assert build_temporal_features(panel).empty
