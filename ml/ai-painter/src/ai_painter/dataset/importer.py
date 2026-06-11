from __future__ import annotations

import json
from pathlib import Path
import shutil

from PIL import Image, ImageOps

from ai_painter.blueprint.masks import render_blueprint_masks

from .hashing import sha256_file
from .layout import DatasetLayout
from .validator import validate_staged_sample


def import_sample(dataset_root: Path, sample_id: str) -> dict[str, object]:
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    source_dir = layout.incoming / sample_id
    result = validate_staged_sample(source_dir)
    if not result.ok or result.sample is None:
        report = {"sampleId": sample_id, "status": "rejected", "errors": list(result.errors)}
        _write_json(layout.rejected / f"{sample_id}.json", report)
        return report

    sample = result.sample
    image_path = layout.accepted / "images" / f"{sample_id}.png"
    blueprint_path = layout.accepted / "blueprints" / f"{sample_id}.json"
    masks_dir = layout.accepted / "masks" / sample_id
    metadata_path = layout.accepted / "metadata" / f"{sample_id}.json"

    existing_paths = (image_path, blueprint_path, masks_dir, metadata_path)
    if any(path.exists() for path in existing_paths):
        report = {
            "sampleId": sample_id,
            "status": "rejected",
            "errors": ["accepted sample already exists; sample IDs are immutable"],
        }
        _write_json(layout.rejected / f"{sample_id}.json", report)
        return report

    with Image.open(sample.image_path) as image:
        normalized = ImageOps.fit(
            image.convert("RGB"),
            (sample.blueprint.width, sample.blueprint.height),
            method=Image.Resampling.NEAREST,
        )
        normalized.save(image_path, format="PNG", optimize=True)
    shutil.copy2(sample.blueprint_path, blueprint_path)
    mask_paths = render_blueprint_masks(sample.blueprint, masks_dir)

    files = {
        "targetImage": _file_record(image_path, dataset_root),
        "blueprint": _file_record(blueprint_path, dataset_root),
        "masks": {
            name: _file_record(path, dataset_root)
            for name, path in sorted(mask_paths.items())
        },
    }
    manifest = {
        "schemaVersion": "accepted-training-sample-v0",
        "sampleId": sample_id,
        "datasetVersion": sample.metadata.dataset_version,
        "styleId": sample.blueprint.style_id,
        "seed": sample.blueprint.seed,
        "source": {
            "kind": sample.metadata.source.kind,
            "toolName": sample.metadata.source.tool_name,
            "createdAt": sample.metadata.source.created_at,
            "licenseBasis": sample.metadata.source.license_basis,
            "humanApproved": True,
            "directCopyProhibited": True,
        },
        "review": {
            "reviewer": sample.metadata.review.reviewer,
            "reviewedAt": sample.metadata.review.reviewed_at,
            "rightsApproved": True,
            "blueprintApproved": True,
            "visualQualityApproved": True,
        },
        "files": files,
        "status": "accepted",
        "notes": sample.metadata.notes,
    }
    _write_json(metadata_path, manifest)
    return manifest


def _file_record(path: Path, root: Path) -> dict[str, object]:
    return {
        "path": path.relative_to(root).as_posix(),
        "sha256": sha256_file(path),
        "byteLength": path.stat().st_size,
    }


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
