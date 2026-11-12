"""Read-only integrity checks shared by training and annotation review."""
from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from PIL import Image

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS

REVIEW_RECORD_SCHEMA_VERSION = "blueprint-v1-review-record-v1"
REVIEWED_STATUS = "reviewed_for_experiment"


def validate_v1_review_record(sample_dir: Path) -> list[str]:
    blueprint_path = sample_dir / "blueprint.v1.json"
    target_path = sample_dir / "target.png"
    record_path = sample_dir / "blueprint.v1.review.json"
    try:
        blueprint = _read_json(blueprint_path)
        record = _read_json(record_path)
    except (OSError, json.JSONDecodeError) as error:
        return [f"v1 review record is missing or invalid: {error}"]
    errors: list[str] = []
    if record.get("schemaVersion") != REVIEW_RECORD_SCHEMA_VERSION:
        errors.append("v1 review record schemaVersion is invalid")
    if record.get("sampleId") != sample_dir.name:
        errors.append("v1 review record sampleId does not match directory")
    if record.get("status") != REVIEWED_STATUS:
        errors.append("v1 review status is not confirmed")
    if not isinstance(record.get("reviewer"), str) or not record.get("reviewer", "").strip():
        errors.append("v1 review reviewer is required")
    errors.extend(_unresolved_review_errors(blueprint))
    if record.get("blueprintHash") != _sha256_file(blueprint_path):
        errors.append("v1 review blueprint hash mismatch")
    if not target_path.is_file():
        errors.append("target.png is missing")
    elif record.get("targetImageHash") != _sha256_file(target_path):
        errors.append("target.png hash mismatch")
    errors.extend(_validate_recorded_masks(sample_dir, blueprint, record))
    errors.extend(_validate_confirmed_structures(blueprint, record))
    return errors


def _validate_recorded_masks(sample_dir: Path, blueprint: dict[str, Any], record: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    mask_dir = sample_dir / "masks_v1"
    if not mask_dir.is_dir():
        return ["masks_v1 directory is missing"]
    actual = {path.name for path in mask_dir.glob("*.png")}
    expected = {f"{name}.png" for name in V1_CONDITION_CHANNELS}
    for name in sorted(expected - actual):
        errors.append(f"missing mask file: masks_v1/{name}")
    for name in sorted(actual - expected):
        errors.append(f"unknown mask file: masks_v1/{name}")
    masks = record.get("masks")
    if not isinstance(masks, dict) or set(masks) != set(V1_CONDITION_CHANNELS):
        errors.append("v1 review masks must contain the fixed 14 channels")
        return errors
    if record.get("maskCount") != len(V1_CONDITION_CHANNELS):
        errors.append("v1 review mask count must be 14")
    for name in V1_CONDITION_CHANNELS:
        path = mask_dir / f"{name}.png"
        item = masks.get(name)
        if not path.is_file() or not isinstance(item, dict):
            continue
        if item.get("sha256") != _sha256_file(path):
            errors.append(f"mask hash mismatch: {name}")
        errors.extend(_validate_mask_image(path, blueprint, name))
    return errors


def _validate_mask_image(path: Path, blueprint: dict[str, Any], name: str) -> list[str]:
    try:
        with Image.open(path) as image:
            width = int(blueprint.get("width", CANVAS_WIDTH))
            height = int(blueprint.get("height", CANVAS_HEIGHT))
            if image.mode != "L":
                return [f"mask mode must be grayscale: {name}"]
            if image.size != (width, height):
                return [f"mask size mismatch: {name}"]
    except OSError as error:
        return [f"mask file is invalid: {name}: {error}"]
    return []


def _validate_confirmed_structures(blueprint: dict[str, Any], record: dict[str, Any]) -> list[str]:
    structures = {item.get("id") for item in blueprint.get("structures", []) if isinstance(item, dict)}
    values = record.get("confirmedStructureIds")
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        return ["confirmedStructureIds must be an array of strings"]
    return [f"confirmed structure no longer exists: {value}" for value in values if value not in structures]


def _unresolved_review_errors(blueprint: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if blueprint.get("requiresManualReview"):
        errors.append("v1 blueprint still requires manual review")
    for item in blueprint.get("structures", []):
        if isinstance(item, dict) and item.get("requiresManualReview"):
            errors.append(f"v1 structure still requires manual review: {item.get('id')}")
    return errors


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()
