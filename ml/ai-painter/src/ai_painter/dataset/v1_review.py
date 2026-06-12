from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.blueprint.v1_validator import validate_v1_blueprint_data


def confirm_v1_sample(dataset_root: Path, sample_id: str, reviewer: str = "project-owner") -> dict[str, object]:
    sample_dir = dataset_root.resolve() / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    blueprint_path = sample_dir / "blueprint.v1.json"
    target_path = sample_dir / "target.png"
    if ".." in sample_id or "/" in sample_id or "\\" in sample_id:
        raise ValueError("sample ID is invalid")
    if not blueprint_path.is_file() or not target_path.is_file():
        raise ValueError("blueprint.v1.json and target.png are required")
    data = json.loads(blueprint_path.read_text(encoding="utf-8"))
    errors = validate_v1_blueprint_data(data)
    if errors:
        raise ValueError("; ".join(errors))
    data["requiresManualReview"] = False
    data["manualReviewReasons"] = []
    for item in data.get("structures", []):
        if isinstance(item, dict):
            item["requiresManualReview"] = False
            item["manualReviewReasons"] = []
    blueprint_path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    masks = render_v1_masks_from_file(blueprint_path, sample_dir / "masks_v1")
    record = {
        "schemaVersion": "blueprint-v1-review-record-v0",
        "sampleId": sample_id,
        "status": "reviewed_for_experiment",
        "reviewer": reviewer,
        "v1BlueprintHash": _sha256_file(blueprint_path),
        "targetImageHash": _sha256_file(target_path),
        "maskCount": len(masks),
        "masks": {name: _sha256_file(path) for name, path in masks.items()},
    }
    (sample_dir / "blueprint.v1.review.json").write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return record


def validate_v1_review_record(sample_dir: Path) -> list[str]:
    blueprint_path = sample_dir / "blueprint.v1.json"
    try:
        blueprint = json.loads(blueprint_path.read_text(encoding="utf-8"))
        record = json.loads((sample_dir / "blueprint.v1.review.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"v1 review record is missing or invalid: {error}"]
    errors: list[str] = []
    if blueprint.get("requiresManualReview"):
        errors.append("v1 blueprint still requires manual review")
    if record.get("status") != "reviewed_for_experiment":
        errors.append("v1 review status is not confirmed")
    if record.get("v1BlueprintHash") != _sha256_file(blueprint_path):
        errors.append("v1 review blueprint hash mismatch")
    masks = record.get("masks")
    if not isinstance(masks, dict) or tuple(masks) != V1_CONDITION_CHANNELS:
        errors.append("v1 review masks must match the fixed 14 channel order")
    return errors


def _sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()
