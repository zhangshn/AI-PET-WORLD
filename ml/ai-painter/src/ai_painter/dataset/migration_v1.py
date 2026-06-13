from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
import shutil
from pathlib import Path
from typing import Any

from ai_painter.blueprint.v0_to_v1 import convert_v0_file_to_v1
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.dataset.v1_review import validate_v1_review_record

from .layout import DatasetLayout


def scan_v1_samples(dataset_root: Path) -> list[dict[str, Any]]:
    scene_root = DatasetLayout(dataset_root).accepted / "scene" / "world"
    if not scene_root.exists():
        return []
    return [inspect_v1_sample(path) for path in sorted(item for item in scene_root.iterdir() if item.is_dir())]


def inspect_v1_sample(sample_dir: Path) -> dict[str, Any]:
    reasons: list[str] = []
    blueprint_v0 = sample_dir / "blueprint.json"
    blueprint_v1 = sample_dir / "blueprint.v1.json"
    review = sample_dir / "blueprint.v1.review.json"
    target = sample_dir / "target.png"
    masks = sample_dir / "masks_v1"
    if not blueprint_v0.is_file():
        reasons.append("missing blueprint.json")
    if not target.is_file():
        reasons.append("missing target.png")
    if reasons:
        return _status(sample_dir.name, "invalid", reasons)
    if not blueprint_v1.is_file():
        return _status(sample_dir.name, "v0_only", [])
    if review.is_file():
        review_errors = validate_v1_review_record(sample_dir)
        return _status(sample_dir.name, "trainable" if not review_errors else "blocked", review_errors)
    if not masks.is_dir():
        return _status(sample_dir.name, "v1_draft", ["missing masks_v1 directory"])
    try:
        data = json.loads(blueprint_v1.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return _status(sample_dir.name, "blocked", [f"invalid blueprint.v1.json: {error}"])
    if data.get("requiresManualReview"):
        pending = sum(1 for item in data.get("structures", []) if isinstance(item, dict) and item.get("requiresManualReview"))
        return _status(sample_dir.name, "review_pending", [], pending)
    return _status(sample_dir.name, "blocked", ["missing blueprint.v1.review.json"])


def migrate_dataset_v1(dataset_root: Path, sample_ids: list[str] | None = None, *, force: bool = False) -> dict[str, Any]:
    scene_root = DatasetLayout(dataset_root).accepted / "scene" / "world"
    items = sorted(path for path in scene_root.iterdir() if path.is_dir()) if scene_root.exists() else []
    if sample_ids is not None:
        wanted = set(sample_ids)
        items = [path for path in items if path.name in wanted]
        missing = sorted(wanted - {path.name for path in items})
    else:
        missing = []
    results = [_missing_result(sample_id) for sample_id in missing]
    for sample_dir in items:
        results.append(migrate_sample_v1(sample_dir, force=force))
    return _batch_result(results)


def migrate_sample_v1(sample_dir: Path, *, force: bool = False) -> dict[str, Any]:
    sample_id = sample_dir.name
    current = inspect_v1_sample(sample_dir)
    if current["status"] == "invalid":
        return {"sampleId": sample_id, "status": "failed", "reason": "; ".join(current["blockingReasons"])}
    if current["status"] != "v0_only" and not force:
        return {"sampleId": sample_id, "status": "skipped", "reason": f"current status is {current['status']}"}
    if (sample_dir / "blueprint.v1.review.json").exists():
        return {"sampleId": sample_id, "status": "failed", "reason": "review record exists; refusing to overwrite"}
    try:
        _assert_core_files(sample_dir)
        _clear_v1_outputs(sample_dir, force=force)
        record = _write_v1_outputs(sample_dir)
        return {"sampleId": sample_id, "status": "migrated", "maskCount": record["maskCount"], "reviewPending": True}
    except (OSError, ValueError, json.JSONDecodeError) as error:
        return {"sampleId": sample_id, "status": "failed", "reason": str(error)}


def _assert_core_files(sample_dir: Path) -> None:
    if not (sample_dir / "blueprint.json").is_file():
        raise ValueError("blueprint.json is required")
    if not (sample_dir / "target.png").is_file():
        raise ValueError("target.png is required")


def _clear_v1_outputs(sample_dir: Path, *, force: bool) -> None:
    v1_path = sample_dir / "blueprint.v1.json"
    masks = sample_dir / "masks_v1"
    if not force and (v1_path.exists() or masks.exists()):
        raise ValueError("v1 files already exist; use force only after manual confirmation")
    if force:
        if v1_path.exists():
            v1_path.unlink()
        if masks.exists():
            shutil.rmtree(masks)


def _write_v1_outputs(sample_dir: Path) -> dict[str, Any]:
    blueprint_v0 = sample_dir / "blueprint.json"
    target = sample_dir / "target.png"
    source_hash = _sha256_file(blueprint_v0)
    target_hash = _sha256_file(target)
    v1_data = convert_v0_file_to_v1(blueprint_v0)
    v1_path = sample_dir / "blueprint.v1.json"
    v1_path.write_text(json.dumps(v1_data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    mask_paths = render_v1_masks_from_file(v1_path, sample_dir / "masks_v1")
    if _sha256_file(blueprint_v0) != source_hash:
        raise ValueError("v0 blueprint hash changed during migration")
    if _sha256_file(target) != target_hash:
        raise ValueError("target image hash changed during migration")
    record = {
        "schemaVersion": "blueprint-v1-migration-record-v1",
        "sampleId": sample_dir.name,
        "sourceBlueprintVersion": "world-blueprint-v0",
        "sourceBlueprintHash": source_hash,
        "targetImageHash": target_hash,
        "migratedAt": datetime.now(timezone.utc).isoformat(),
        "migrationStatus": "draft_requires_manual_review",
        "v1Blueprint": "blueprint.v1.json",
        "v1Masks": sorted(path.name for path in mask_paths.values()),
        "maskCount": len(mask_paths),
        "requiresManualReview": True,
        "manualReviewReasons": v1_data.get("manualReviewReasons", []),
    }
    (sample_dir / "migration.v1.json").write_text(json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return record


def _batch_result(results: list[dict[str, Any]]) -> dict[str, Any]:
    migrated = sum(1 for item in results if item["status"] == "migrated")
    skipped = sum(1 for item in results if item["status"] == "skipped")
    failed = sum(1 for item in results if item["status"] == "failed")
    return {"status": "completed" if failed == 0 else "completed_with_failures", "total": len(results), "migrated": migrated, "skipped": skipped, "failed": failed, "results": results}


def _status(sample_id: str, status: str, reasons: list[str], pending_count: int = 0) -> dict[str, Any]:
    return {"sampleId": sample_id, "status": status, "pendingReviewStructures": pending_count, "blockingReasons": reasons}


def _missing_result(sample_id: str) -> dict[str, Any]:
    return {"sampleId": sample_id, "status": "failed", "reason": "accepted scene sample does not exist"}


def _sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()
