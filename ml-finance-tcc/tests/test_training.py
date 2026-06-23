from domain.data_loader import generate_synthetic_monthly_finance
from ml.feature_engineering import FEATURE_COLUMNS, build_temporal_features
from ml.training import train_classifier_temporal


def test_temporal_split_has_no_overlapping_months_and_builds_baselines():
    dataset = build_temporal_features(
        generate_synthetic_monthly_finance(4, 12, random_state=7)
    )
    result = train_classifier_temporal(
        dataset, "deficit_mes", FEATURE_COLUMNS, n_estimators=10
    )

    assert set(result.train_months).isdisjoint(result.test_months)
    assert max(result.train_months) < min(result.test_months)
    assert len(result.majority_baseline) == len(result.y_test)
    assert len(result.persistence_baseline) == len(result.y_test)
