from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS

from .hashing import sha256_file
from .layout import DatasetLayout


def audit_dataset(dataset_root: Path) -> dict[str, object]:
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    errors: list[str] = []
    sample_ids: list[str] = []
    for metadata_path in sorted(layout.accepted.glob("scene/world/*/metadata.json")):
        sample_id = metadata_path.parent.name
        sample_ids.append(sample_id)
        try:
            manifest = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"{sample_id}: invalid accepted metadata: {error}")
            continue
        errors.extend(_audit_manifest(dataset_root, layout, sample_id, manifest))
    return {
        "status": "passed" if not errors else "failed",
        "acceptedSampleCount": len(sample_ids),
        "sampleIds": sample_ids,
        "errors": errors,
    }


def _audit_manifest(root: Path, layout: DatasetLayout, sample_id: str, manifest: Any) -> list[str]:
    if not isinstance(manifest, dict):
        return [f"{sample_id}: accepted metadata must be an object"]
    errors: list[str] = []
    required = {
        "schemaVersion": "accepted-training-sample-v1",
        "sampleId": sample_id,
        "status": "accepted",
        "trainingEligible": True,
    }
    for key, expected in required.items():
        if manifest.get(key) != expected:
            errors.append(f"{sample_id}: {key} must be {expected}")
    if (layout.quarantine / sample_id).exists():
        errors.append(f"{sample_id}: quarantined sample cannot be accepted")
    if not manifest.get("originalSha256"):
        errors.append(f"{sample_id}: original SHA-256 is required")
    source = manifest.get("source")
    if not isinstance(source, dict) or not source.get("source") or not source.get("license"):
        errors.append(f"{sample_id}: source and license are required")
    versions = manifest.get("versions")
    if not isinstance(versions, dict) or not all(versions.get(k) for k in ("annotator", "geometry", "judge")):
        errors.append(f"{sample_id}: automatic annotator, geometry and judge versions are required")
    judge = manifest.get("judge")
    if not isinstance(judge, dict) or judge.get("status") != "passed" or judge.get("errors"):
        errors.append(f"{sample_id}: Annotation Judge must pass")
    files = manifest.get("files")
    if not isinstance(files, dict):
        return errors + [f"{sample_id}: files record is missing"]
    for name in ("sourceOriginal", "blueprint"):
        errors.extend(_audit_file_record(root, sample_id, name, files.get(name)))
    masks = files.get("masks")
    if not isinstance(masks, dict) or tuple(masks.keys()) != V1_CONDITION_CHANNELS:
        errors.append(f"{sample_id}: exactly 14 fixed-order condition masks are required")
    elif isinstance(masks, dict):
        for name, record in masks.items():
            if record.get("originalSha256") != manifest.get("originalSha256"):
                errors.append(f"{sample_id}: mask {name} original SHA-256 mismatch")
            errors.extend(_audit_file_record(root, sample_id, f"mask:{name}", record))
    blueprint_record = files.get("blueprint") if isinstance(files.get("blueprint"), dict) else {}
    blueprint_path = root / blueprint_record.get("path", "")
    if blueprint_path.is_file():
        errors.extend(_audit_blueprint(sample_id, blueprint_path, manifest.get("originalSha256")))
    return errors


def _audit_blueprint(sample_id: str, path: Path, original_hash: Any) -> list[str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"{sample_id}: blueprint is invalid: {error}"]
    errors: list[str] = []
    if data.get("schemaVersion") != "world-blueprint-v1":
        errors.append(f"{sample_id}: Blueprint v1 is required")
    if data.get("sourceImage", {}).get("sha256") != original_hash:
        errors.append(f"{sample_id}: blueprint original SHA-256 mismatch")
    if not isinstance(data.get("structures"), list) or not data["structures"]:
        errors.append(f"{sample_id}: blueprint structures are required")
    return errors


def _audit_file_record(root: Path, sample_id: str, label: str, record: Any) -> list[str]:
    if not isinstance(record, dict):
        return [f"{sample_id}: {label} file record is missing"]
    relative_path = record.get("path")
    if not isinstance(relative_path, str) or not relative_path:
        return [f"{sample_id}: {label} path is missing"]
    path = (root / relative_path).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return [f"{sample_id}: {label} path escapes dataset root"]
    if not path.is_file():
        return [f"{sample_id}: {label} file is missing"]
    errors: list[str] = []
    if record.get("byteLength") != path.stat().st_size:
        errors.append(f"{sample_id}: {label} byte length mismatch")
    if record.get("sha256") != sha256_file(path):
        errors.append(f"{sample_id}: {label} SHA-256 mismatch")
    return errors
