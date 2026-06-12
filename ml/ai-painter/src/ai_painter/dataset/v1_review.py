from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
from typing import Any

from PIL import Image

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.blueprint.v1_validator import validate_v1_blueprint_data

REVIEW_RECORD_SCHEMA_VERSION = "blueprint-v1-review-record-v1"
REVIEWED_STATUS = "reviewed_for_experiment"
DECISIONS = {"approved", "rejected", "needs_correction"}


def confirm_v1_sample(dataset_root: Path, sample_id: str, submission: dict[str, Any]) -> dict[str, object]:
    sample_dir = dataset_root.resolve() / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    blueprint_path = sample_dir / "blueprint.v1.json"
    target_path = sample_dir / "target.png"
    _validate_sample_id(sample_id)
    if not blueprint_path.is_file() or not target_path.is_file():
        raise ValueError("blueprint.v1.json and target.png are required")
    blueprint = _read_json(blueprint_path)
    errors = validate_v1_blueprint_data(blueprint)
    if errors:
        raise ValueError("; ".join(errors))
    required = _manual_review_structures(blueprint)
    _validate_submission(submission, sample_id, blueprint, blueprint_path, target_path, required)
    reviewed = _mark_reviewed(blueprint, required)
    with TemporaryDirectory() as temporary:
        work_blueprint = Path(temporary) / "blueprint.v1.json"
        work_masks = Path(temporary) / "masks_v1"
        work_blueprint.write_text(_json(reviewed), encoding="utf-8")
        rendered = render_v1_masks_from_file(work_blueprint, work_masks)
        mask_errors = _validate_rendered_masks(work_blueprint, work_masks, rendered)
        if mask_errors:
            raise ValueError("; ".join(mask_errors))
    blueprint_path.write_text(_json(reviewed), encoding="utf-8")
    mask_dir = sample_dir / "masks_v1"
    if mask_dir.exists():
        shutil.rmtree(mask_dir)
    rendered = render_v1_masks_from_file(blueprint_path, mask_dir)
    mask_errors = _validate_rendered_masks(blueprint_path, mask_dir, rendered)
    if mask_errors:
        raise ValueError("; ".join(mask_errors))
    record = _review_record(sample_id, submission, blueprint_path, target_path, rendered, required)
    (sample_dir / "blueprint.v1.review.json").write_text(_json(record), encoding="utf-8")
    return record


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


def _validate_submission(submission: dict[str, Any], sample_id: str, blueprint: dict[str, Any], blueprint_path: Path, target_path: Path, required: list[dict[str, Any]]) -> None:
    if not isinstance(submission, dict) or not submission:
        raise ValueError("review submission is required")
    errors: list[str] = []
    if submission.get("sampleId") != sample_id:
        errors.append("review submission sampleId does not match route sampleId")
    reviewer = submission.get("reviewer")
    if not isinstance(reviewer, str) or not reviewer.strip():
        errors.append("reviewer is required")
    if submission.get("overallDecision") != "approved" or submission.get("overallConfirmation") is not True:
        errors.append("overall review confirmation must be approved")
    if submission.get("blueprintHash") != _sha256_file(blueprint_path):
        errors.append("blueprint hash mismatch")
    if submission.get("targetImageHash") != _sha256_file(target_path):
        errors.append("target.png hash mismatch")
    decisions = submission.get("decisions")
    if not isinstance(decisions, list) or not decisions:
        errors.append("decisions array is required")
        raise ValueError("; ".join(errors))
    structures = {item.get("id"): item for item in blueprint.get("structures", []) if isinstance(item, dict)}
    required_ids = {item.get("id") for item in required}
    seen: set[str] = set()
    for item in decisions:
        if not isinstance(item, dict):
            errors.append("review decision must be an object")
            continue
        structure_id = item.get("structureId")
        if not isinstance(structure_id, str) or not structure_id:
            errors.append("review decision structureId is required")
            continue
        if structure_id in seen:
            errors.append(f"duplicate review decision: {structure_id}")
        seen.add(structure_id)
        structure = structures.get(structure_id)
        if structure is None:
            errors.append(f"review decision references unknown structure: {structure_id}")
            continue
        if structure_id not in required_ids:
            errors.append(f"structure does not require manual review: {structure_id}")
        if item.get("type") != structure.get("type"):
            errors.append(f"review decision type mismatch: {structure_id}")
        if item.get("decision") not in DECISIONS:
            errors.append(f"review decision is invalid: {structure_id}")
        elif item.get("decision") != "approved":
            errors.append(f"review decision blocks training: {structure_id}")
        if "reviewerNote" in item and not isinstance(item.get("reviewerNote"), str):
            errors.append(f"reviewerNote must be text: {structure_id}")
    missing = sorted(value for value in required_ids - seen if isinstance(value, str))
    for structure_id in missing:
        errors.append(f"missing review decision: {structure_id}")
    if not required_ids:
        errors.append("no structures require manual review")
    if errors:
        raise ValueError("; ".join(errors))


def _review_record(sample_id: str, submission: dict[str, Any], blueprint_path: Path, target_path: Path, masks: dict[str, Path], required: list[dict[str, Any]]) -> dict[str, object]:
    confirmed_ids = [str(item["id"]) for item in required]
    return {
        "schemaVersion": REVIEW_RECORD_SCHEMA_VERSION,
        "sampleId": sample_id,
        "status": REVIEWED_STATUS,
        "reviewer": str(submission["reviewer"]).strip(),
        "reviewedAt": datetime.now(timezone.utc).isoformat(),
        "blueprintHash": _sha256_file(blueprint_path),
        "targetImageHash": _sha256_file(target_path),
        "maskCount": len(V1_CONDITION_CHANNELS),
        "masks": {name: {"path": f"masks_v1/{name}.png", "sha256": _sha256_file(masks[name])} for name in V1_CONDITION_CHANNELS},
        "confirmedStructureIds": confirmed_ids,
        "reviewSubmissionHash": _hash_json(_submission_snapshot(submission, confirmed_ids)),
    }


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


def _validate_rendered_masks(blueprint_path: Path, mask_dir: Path, masks: dict[str, Path]) -> list[str]:
    blueprint = _read_json(blueprint_path)
    errors: list[str] = []
    if set(masks) != set(V1_CONDITION_CHANNELS):
        errors.append("rendered mask channels are incomplete")
    actual = {path.name for path in mask_dir.glob("*.png")}
    expected = {f"{name}.png" for name in V1_CONDITION_CHANNELS}
    if actual != expected:
        errors.append("rendered mask file set is not exactly 14 channels")
    for name in V1_CONDITION_CHANNELS:
        path = mask_dir / f"{name}.png"
        if not path.is_file():
            errors.append(f"missing rendered mask: {name}")
        else:
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


def _manual_review_structures(blueprint: dict[str, Any]) -> list[dict[str, Any]]:
    return [item for item in blueprint.get("structures", []) if isinstance(item, dict) and item.get("requiresManualReview")]


def _mark_reviewed(blueprint: dict[str, Any], required: list[dict[str, Any]]) -> dict[str, Any]:
    reviewed = json.loads(json.dumps(blueprint, ensure_ascii=False))
    required_ids = {item.get("id") for item in required}
    for item in reviewed.get("structures", []):
        if isinstance(item, dict) and item.get("id") in required_ids:
            item["requiresManualReview"] = False
            item["manualReviewReasons"] = []
    unresolved = _manual_review_structures(reviewed)
    reviewed["requiresManualReview"] = bool(unresolved)
    reviewed["manualReviewReasons"] = ["仍存在未复核结构"] if unresolved else []
    return reviewed


def _submission_snapshot(submission: dict[str, Any], confirmed_ids: list[str]) -> dict[str, Any]:
    return {
        "sampleId": submission.get("sampleId"),
        "reviewer": submission.get("reviewer"),
        "blueprintHash": submission.get("blueprintHash"),
        "targetImageHash": submission.get("targetImageHash"),
        "overallDecision": submission.get("overallDecision"),
        "overallConfirmation": submission.get("overallConfirmation"),
        "confirmedStructureIds": confirmed_ids,
        "decisions": sorted(submission.get("decisions", []), key=lambda item: item.get("structureId", "") if isinstance(item, dict) else ""),
    }


def _validate_sample_id(sample_id: str) -> None:
    if not sample_id or ".." in sample_id or "/" in sample_id or "\\" in sample_id:
        raise ValueError("sample ID is invalid")


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _hash_json(data: dict[str, Any]) -> str:
    return sha256(_json(data).encode("utf-8")).hexdigest()


def _sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()
