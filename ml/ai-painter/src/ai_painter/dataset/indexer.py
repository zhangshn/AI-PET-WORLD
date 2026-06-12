import json
from hashlib import sha256
from pathlib import Path

from .layout import DatasetLayout


def build_dataset_indexes(dataset_root: Path, validation_ratio: float = 0.1) -> dict[str, int]:
    if not 0 < validation_ratio < 1:
        raise ValueError("validation_ratio must be between 0 and 1")
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    manifests = sorted(layout.accepted.glob("*/*/*/metadata.json"))
    train: list[str] = []
    validation: list[str] = []
    threshold = round(validation_ratio * 10_000)

    for path in manifests:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("sampleLayer") != "scene":
            continue
        sample_id = data["sampleId"]
        bucket = int(sha256(sample_id.encode("utf-8")).hexdigest()[:8], 16) % 10_000
        (validation if bucket < threshold else train).append(sample_id)

    _write_index(layout.indexes / "train.json", "train", train)
    _write_index(layout.indexes / "validation.json", "validation", validation)
    summary = {
        "accepted": len(manifests),
        "primaryScenes": len(train) + len(validation),
        "train": len(train),
        "validation": len(validation),
    }
    (layout.manifests / "dataset-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    return summary


def _write_index(path: Path, split: str, sample_ids: list[str]) -> None:
    value = {
        "schemaVersion": "dataset-index-v0",
        "split": split,
        "sampleIds": sample_ids,
        "count": len(sample_ids),
    }
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
