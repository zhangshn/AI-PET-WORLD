import json
from hashlib import sha256
from pathlib import Path

from .layout import DatasetLayout


def build_dataset_indexes(dataset_root: Path, validation_ratio: float = 0.1) -> dict[str, int]:
    if not 0 < validation_ratio < 1:
        raise ValueError("validation_ratio must be between 0 and 1")
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    manifests = [
        path for path in sorted(layout.module_d_accepted.glob("scene/world/*/metadata.json"))
        if _is_eligible(path, layout)
    ]
    train: list[str] = []
    validation: list[str] = []
    threshold = round(validation_ratio * 10_000)
    for path in manifests:
        sample_id = json.loads(path.read_text(encoding="utf-8"))["sampleId"]
        bucket = int(sha256(sample_id.encode("utf-8")).hexdigest()[:8], 16) % 10_000
        (validation if bucket < threshold else train).append(sample_id)
    if len(train) + len(validation) >= 2 and not validation:
        validation.append(train.pop(_stable_validation_index(train)))
    if len(train) + len(validation) >= 2 and not train:
        train.append(validation.pop())
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


def _is_eligible(path: Path, layout: DatasetLayout) -> bool:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    sample_id = data.get("sampleId")
    return (
        data.get("schemaVersion") == "accepted-training-sample-v1"
        and data.get("status") == "accepted"
        and data.get("trainingEligible") is True
        and data.get("judge", {}).get("status") == "passed"
        and isinstance(sample_id, str)
        and not (layout.quarantine / sample_id).exists()
    )


def _stable_validation_index(sample_ids: list[str]) -> int:
    return min(
        range(len(sample_ids)),
        key=lambda index: sha256(sample_ids[index].encode("utf-8")).hexdigest(),
    )


def _write_index(path: Path, split: str, sample_ids: list[str]) -> None:
    value = {
        "schemaVersion": "dataset-index-v1",
        "split": split,
        "sampleIds": sample_ids,
        "count": len(sample_ids),
    }
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
