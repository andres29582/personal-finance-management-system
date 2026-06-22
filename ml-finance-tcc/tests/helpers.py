from pathlib import Path
from uuid import uuid4


def make_test_dir(name: str) -> Path:
    path = Path(__file__).parent / ".tmp" / f"{name}-{uuid4().hex}"
    path.mkdir(parents=True, exist_ok=True)
    return path
