from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .hashing import sha256_file
from .layout import DatasetLayout


def audit_dataset(dataset_root: Path) -> dict[str, object]:
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    errors: list[str] = []
    sample_ids: list[str] = []

    for metadata_path in sorted(layout.accepted.glob("*/*/*/metadata.json")):
        sample_id = metadata_path.parent.name
        sample_ids.append(sample_id)
        try:
            manifest = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"{sample_id}: invalid accepted metadata: {error}")
            continue
        errors.extend(_audit_manifest(dataset_root, sample_id, manifest))

    return {
        "status": "passed" if not errors else "failed",
        "acceptedSampleCount": len(sample_ids),
        "sampleIds": sample_ids,
        "errors": errors,
    }


def _audit_manifest(root: Path, sample_id: str, manifest: Any) -> list[str]:
    if not isinstance(manifest, dict):
        return [f"{sample_id}: accepted metadata must be an object"]
    errors: list[str] = []
    if manifest.get("sampleId") != sample_id:
        errors.append(f"{sample_id}: manifest sampleId mismatch")
    if manifest.get("status") != "accepted":
        errors.append(f"{sample_id}: manifest status must be accepted")

    files = manifest.get("files")
    if not isinstance(files, dict):
        return errors + [f"{sample_id}: files record is missing"]
    for name in ("targetImage", "structure"):
        errors.extend(_audit_file_record(root, sample_id, name, files.get(name)))

    masks = files.get("masks")
    requires_masks = manifest.get("sampleLayer") == "scene"
    if requires_masks and (not isinstance(masks, dict) or len(masks) != 8):
        errors.append(f"{sample_id}: exactly 8 condition masks are required")
    elif isinstance(masks, dict):
        for name, record in sorted(masks.items()):
            errors.extend(_audit_file_record(root, sample_id, f"mask:{name}", record))
    return errors


def _audit_file_record(
    root: Path, sample_id: str, label: str, record: Any
) -> list[str]:
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
