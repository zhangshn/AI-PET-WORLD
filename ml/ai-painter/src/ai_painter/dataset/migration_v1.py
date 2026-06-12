from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path

from ai_painter.blueprint.v0_to_v1 import convert_v0_file_to_v1
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file

from .layout import DatasetLayout


def migrate_dataset_v1(dataset_root: Path) -> dict[str, object]:
    layout = DatasetLayout(dataset_root)
    scene_root = layout.accepted / "scene" / "world"
    migrated: list[str] = []
    errors: list[str] = []
    if not scene_root.exists():
        return {"status": "completed", "migrated": 0, "sampleIds": [], "errors": []}
    for sample_dir in sorted(path for path in scene_root.iterdir() if path.is_dir()):
        try:
            _migrate_sample(sample_dir, dataset_root)
            migrated.append(sample_dir.name)
        except (OSError, ValueError, json.JSONDecodeError) as error:
            errors.append(f"{sample_dir.name}: {error}")
    return {"status": "failed" if errors else "completed", "migrated": len(migrated), "sampleIds": migrated, "errors": errors}


def _migrate_sample(sample_dir: Path, dataset_root: Path) -> None:
    blueprint_v0 = sample_dir / "blueprint.json"
    target = sample_dir / "target.png"
    if not blueprint_v0.is_file() or not target.is_file():
        raise ValueError("blueprint.json and target.png are required")
    v0_hash_before = sha256(blueprint_v0.read_bytes()).hexdigest()
    target_hash_before = sha256(target.read_bytes()).hexdigest()
    v1_data = convert_v0_file_to_v1(blueprint_v0)
    v1_path = sample_dir / "blueprint.v1.json"
    v1_path.write_text(json.dumps(v1_data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    mask_paths = render_v1_masks_from_file(v1_path, sample_dir / "masks_v1")
    if sha256(blueprint_v0.read_bytes()).hexdigest() != v0_hash_before:
        raise ValueError("v0 blueprint hash changed during migration")
    if sha256(target.read_bytes()).hexdigest() != target_hash_before:
        raise ValueError("target image hash changed during migration")
    migration = {
        "schemaVersion": "blueprint-v1-migration-record-v0",
        "sampleId": sample_dir.name,
        "sourceBlueprintVersion": "world-blueprint-v0",
        "sourceBlueprintHash": v0_hash_before,
        "targetImageHash": target_hash_before,
        "v1Blueprint": "blueprint.v1.json",
        "v1Masks": sorted(mask_paths),
        "requiresManualReview": True,
        "manualReviewReasons": v1_data.get("manualReviewReasons", []),
    }
    (sample_dir / "migration.v1.json").write_text(json.dumps(migration, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
