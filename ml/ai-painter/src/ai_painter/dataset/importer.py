from __future__ import annotations

import json
from pathlib import Path
import shutil

from PIL import Image, ImageOps

from ai_painter.blueprint.masks import render_blueprint_masks

from .hashing import sha256_file
from .layout import DatasetLayout
from .taxonomy import LAYER_IMAGE_SIZES
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
    category_dir = layout.accepted / sample.metadata.sample_layer / sample.metadata.domain
    sample_dir = category_dir / sample_id
    image_path = sample_dir / "target.png"
    structure_name = "blueprint.json" if sample.metadata.sample_layer == "scene" else "annotation.json"
    structure_path = sample_dir / structure_name
    masks_dir = sample_dir / "masks"
    metadata_path = sample_dir / "metadata.json"

    existing_paths = (image_path, structure_path, masks_dir, metadata_path)
    if any(path.exists() for path in existing_paths):
        report = {
            "sampleId": sample_id,
            "status": "rejected",
            "errors": ["accepted sample already exists; sample IDs are immutable"],
        }
        _write_json(layout.rejected / f"{sample_id}.json", report)
        return report

    sample_dir.mkdir(parents=True, exist_ok=True)
    target_size = LAYER_IMAGE_SIZES[sample.metadata.sample_layer]
    with Image.open(sample.image_path) as image:
        normalized = _normalize_image(image, target_size, sample.metadata.sample_layer)
        normalized.save(image_path, format="PNG", optimize=True)
    shutil.copy2(sample.structure_path, structure_path)
    mask_paths = (
        render_blueprint_masks(sample.blueprint, masks_dir)
        if sample.blueprint is not None
        else {}
    )

    files = {
        "targetImage": _file_record(image_path, dataset_root),
        "structure": _file_record(structure_path, dataset_root),
        "masks": {
            name: _file_record(path, dataset_root)
            for name, path in sorted(mask_paths.items())
        },
    }
    manifest = {
        "schemaVersion": "accepted-training-sample-v0",
        "sampleId": sample_id,
        "datasetVersion": sample.metadata.dataset_version,
        "sampleLayer": sample.metadata.sample_layer,
        "domain": sample.metadata.domain,
        "subtype": sample.metadata.subtype,
        "tags": list(sample.metadata.tags),
        "components": list(sample.metadata.components),
        "componentMaterials": [
            {"component": item.component, "material": item.material}
            for item in sample.metadata.component_materials
        ],
        "viewpoint": sample.metadata.viewpoint,
        "styleId": sample.blueprint.style_id if sample.blueprint else "asset-pixel-v0",
        "seed": sample.blueprint.seed if sample.blueprint else None,
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


def _normalize_image(image: Image.Image, size: tuple[int, int], layer: str) -> Image.Image:
    if layer == "scene":
        return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.NEAREST)
    source = image.convert("RGBA")
    contained = ImageOps.contain(source, size, method=Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    offset = ((size[0] - contained.width) // 2, (size[1] - contained.height) // 2)
    canvas.alpha_composite(contained, offset)
    return canvas


def _file_record(path: Path, root: Path) -> dict[str, object]:
    return {
        "path": path.relative_to(root).as_posix(),
        "sha256": sha256_file(path),
        "byteLength": path.stat().st_size,
    }


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
