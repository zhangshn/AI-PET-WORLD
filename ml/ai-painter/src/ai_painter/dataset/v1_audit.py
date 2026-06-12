from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.dataset.v1_review import validate_v1_review_record


def audit_v1_dataset(dataset_root: Path) -> dict[str, Any]:
    scene_root = dataset_root.resolve() / "accepted" / "dataset_v0" / "scene" / "world"
    summary = _empty_summary()
    if not scene_root.exists():
        return summary
    for sample_dir in sorted(path for path in scene_root.iterdir() if path.is_dir()):
        item = audit_v1_sample(sample_dir)
        summary["samples"].append(item)
        summary["totalScenes"] += 1
        summary["v1Drafts"] += 1 if item["hasV1Blueprint"] else 0
        summary["reviewedV1"] += 1 if item["hasReviewRecord"] else 0
        summary["trainableV1"] += 1 if item["trainable"] else 0
        summary["blockedV1"] += 1 if item["blockingReasons"] else 0
    return summary


def audit_v1_sample(sample_dir: Path) -> dict[str, Any]:
    blueprint_path = sample_dir / "blueprint.v1.json"
    review_path = sample_dir / "blueprint.v1.review.json"
    reasons: list[str] = []
    if not (sample_dir / "blueprint.json").is_file():
        reasons.append("missing v0 blueprint.json")
    if not (sample_dir / "target.png").is_file():
        reasons.append("missing target.png")
    if not blueprint_path.is_file():
        reasons.append("missing blueprint.v1.json")
    else:
        reasons.extend(_validate_blueprint_review_flag(blueprint_path))
        reasons.extend(_validate_v1_masks(sample_dir))
    if review_path.is_file():
        reasons.extend(validate_v1_review_record(sample_dir))
    else:
        reasons.append("missing blueprint.v1.review.json")
    return {
        "sampleId": sample_dir.name,
        "hasV1Blueprint": blueprint_path.is_file(),
        "hasReviewRecord": review_path.is_file(),
        "trainable": len(reasons) == 0,
        "blockingReasons": reasons,
    }


def _validate_blueprint_review_flag(blueprint_path: Path) -> list[str]:
    try:
        data = json.loads(blueprint_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"invalid blueprint.v1.json: {error}"]
    if data.get("requiresManualReview"):
        return ["blueprint.v1.json still requires manual review"]
    return []


def _validate_v1_masks(sample_dir: Path) -> list[str]:
    errors: list[str] = []
    mask_root = sample_dir / "masks_v1"
    if not mask_root.is_dir():
        return ["missing masks_v1 directory"]
    for name in V1_CONDITION_CHANNELS:
        path = mask_root / f"{name}.png"
        if not path.is_file():
            errors.append(f"missing masks_v1/{name}.png")
            continue
        try:
            with Image.open(path) as image:
                if image.mode != "L" or image.size != (CANVAS_WIDTH, CANVAS_HEIGHT):
                    errors.append(f"invalid masks_v1/{name}.png")
        except OSError as error:
            errors.append(f"invalid masks_v1/{name}.png: {error}")
    return errors


def _empty_summary() -> dict[str, Any]:
    return {
        "schemaVersion": "blueprint-v1-audit-report-v0",
        "totalScenes": 0,
        "v1Drafts": 0,
        "reviewedV1": 0,
        "trainableV1": 0,
        "blockedV1": 0,
        "samples": [],
    }
