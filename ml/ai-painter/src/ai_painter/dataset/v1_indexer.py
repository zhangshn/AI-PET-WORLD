from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path
from typing import Any

from ai_painter.dataset.migration_v1 import scan_v1_samples
from ai_painter.dataset.v1_readiness import build_v1_readiness_report

from .layout import DatasetLayout


def build_trainable_v1_indexes(dataset_root: Path, validation_ratio: float = 0.1) -> dict[str, Any]:
    if not 0 < validation_ratio < 1:
        raise ValueError("validation_ratio must be between 0 and 1")
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    trainable = sorted(item["sampleId"] for item in scan_v1_samples(dataset_root) if item["status"] == "trainable")
    train, validation = _split_trainable(trainable, validation_ratio)
    _write_index(layout.indexes / "train.json", "train", train)
    _write_index(layout.indexes / "validation.json", "validation", validation)
    readiness = build_v1_readiness_report(dataset_root)
    summary = {
        "schemaVersion": "blueprint-v1-index-update-report-v0",
        "trainable": len(trainable),
        "train": len(train),
        "validation": len(validation),
        "readinessStatus": readiness["readinessStatus"],
        "readyForFirstTraining": readiness["readyForFirstTraining"],
        "engineeringValidationReady": readiness["engineeringValidationReady"],
        "readinessReasons": readiness["readinessReasons"],
        "blockers": readiness["blockers"],
    }
    (layout.manifests / "dataset-v1-index-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return summary


def _split_trainable(sample_ids: list[str], validation_ratio: float) -> tuple[list[str], list[str]]:
    train: list[str] = []
    validation: list[str] = []
    threshold = round(validation_ratio * 10_000)
    for sample_id in sample_ids:
        bucket = int(sha256(sample_id.encode("utf-8")).hexdigest()[:8], 16) % 10_000
        (validation if bucket < threshold else train).append(sample_id)
    if len(sample_ids) >= 2 and not validation:
        validation.append(train.pop(_stable_validation_index(train)))
    if len(sample_ids) >= 2 and not train:
        train.append(validation.pop())
    return train, validation


def _stable_validation_index(sample_ids: list[str]) -> int:
    return min(range(len(sample_ids)), key=lambda index: sha256(sample_ids[index].encode("utf-8")).hexdigest())


def _write_index(path: Path, split: str, sample_ids: list[str]) -> None:
    value = {
        "schemaVersion": "dataset-index-v0",
        "split": split,
        "sampleIds": sample_ids,
        "count": len(sample_ids),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
