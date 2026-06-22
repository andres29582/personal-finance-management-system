import numpy as np

from ml.evaluation import classification_metrics


def test_classification_metrics_supports_baselines_without_probability():
    metrics = classification_metrics(
        np.array([0, 1, 1]), np.array([0, 0, 1])
    )

    assert metrics["accuracy"] == 2 / 3
    assert "roc_auc" not in metrics
    assert metrics["confusion_matrix"] == [[1, 0], [1, 1]]
