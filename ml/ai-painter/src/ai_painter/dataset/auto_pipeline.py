from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS

from .annotation_judge import JUDGE_VERSION, judge_candidate
from .auto_annotator import ANNOTATOR_VERSION, build_base_structures, classify_image, load_canvas, now
from .geometry_deriver import GEOMETRY_VERSION, derive_geometry
from .hashing import sha256_file
from .layout import DatasetLayout
from .source_registry import SourceAsset, load_registered_asset, register_source_originals


def run_auto_annotation_pipeline(dataset_root: Path, sample_id: str, max_retries: int = 2) -> dict[str, Any]:
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    register_source_originals(dataset_root)
    asset = load_registered_asset(dataset_root, sample_id)
    attempts: list[dict[str, Any]] = []
    candidate: dict[str, Any] | None = None
    for attempt in range(max_retries + 1):
        candidate = build_candidate(asset, attempt)
        report = judge_candidate(candidate)
        attempts.append({"attempt": attempt, "status": report["status"], "errors": report["errors"]})
        if report["status"] == "passed":
            return write_accepted(layout, asset, candidate, report, attempts)
        if not _can_retry(report):
            break
    assert candidate is not None
    return write_quarantine(layout, asset, candidate, attempts)


def build_candidate(asset: SourceAsset, attempt: int = 0) -> dict[str, Any]:
    image = load_canvas(asset.path)
    base_masks = classify_image(image)
    structures = build_base_structures(base_masks, asset, attempt)
    derived_masks, derived = derive_geometry(base_masks, asset.sha256)
    masks = _empty_masks()
    for key, value in {**base_masks, **derived_masks}.items():
        if key in masks:
            masks[key] = value
    blueprint = {
        "schemaVersion": "world-blueprint-v1",
        "sourceImage": {
            "assetId": asset.asset_id,
            "sha256": asset.sha256,
            "width": asset.width,
            "height": asset.height,
            "format": asset.image_format,
        },
        "versions": {"annotator": ANNOTATOR_VERSION, "geometry": GEOMETRY_VERSION},
        "generatedAt": now(),
        "structures": structures + derived,
    }
    return {"asset": asset, "blueprint": blueprint, "masks": masks}


def write_accepted(
    layout: DatasetLayout,
    asset: SourceAsset,
    candidate: dict[str, Any],
    report: dict[str, Any],
    attempts: list[dict[str, Any]],
) -> dict[str, Any]:
    sample_dir = layout.module_d_accepted / "scene" / "world" / asset.asset_id
    masks_dir = sample_dir / "masks"
    sample_dir.mkdir(parents=True, exist_ok=True)
    masks_dir.mkdir(parents=True, exist_ok=True)
    blueprint_path = sample_dir / "blueprint.json"
    blueprint_path.write_text(_json(candidate["blueprint"]), encoding="utf-8")
    files: dict[str, Any] = {
        "sourceOriginal": _file_record(asset.path, layout.root),
        "blueprint": _file_record(blueprint_path, layout.root),
        "masks": {},
    }
    for name, image in candidate["masks"].items():
        path = masks_dir / f"{name}.png"
        image.save(path, format="PNG", optimize=True)
        files["masks"][name] = {**_file_record(path, layout.root), "originalSha256": asset.sha256}
    metadata = {
        "schemaVersion": "accepted-training-sample-v1",
        "sampleId": asset.asset_id,
        "sampleLayer": "scene",
        "domain": "world",
        "status": "accepted",
        "trainingEligible": True,
        "originalSha256": asset.sha256,
        "source": {
            "path": asset.path.relative_to(layout.root).as_posix(),
            "source": asset.source,
            "license": asset.license,
        },
        "versions": {"annotator": ANNOTATOR_VERSION, "geometry": GEOMETRY_VERSION, "judge": JUDGE_VERSION},
        "judge": report,
        "repairAttempts": attempts,
        "files": files,
    }
    (sample_dir / "metadata.json").write_text(_json(metadata), encoding="utf-8")
    return metadata


def write_quarantine(
    layout: DatasetLayout, asset: SourceAsset, candidate: dict[str, Any], attempts: list[dict[str, Any]]
) -> dict[str, Any]:
    path = layout.quarantine / asset.asset_id / "report.json"
    value = {
        "schemaVersion": "annotation-quarantine-v1",
        "sampleId": asset.asset_id,
        "status": "quarantined",
        "trainingEligible": False,
        "originalSha256": asset.sha256,
        "versions": {"annotator": ANNOTATOR_VERSION, "geometry": GEOMETRY_VERSION, "judge": JUDGE_VERSION},
        "repairAttempts": attempts,
        "blueprint": candidate["blueprint"],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_json(value), encoding="utf-8")
    return value


def _empty_masks() -> dict[str, Image.Image]:
    return {name: Image.new("L", (256, 192), 0) for name in V1_CONDITION_CHANNELS}


def _file_record(path: Path, root: Path) -> dict[str, Any]:
    return {"path": path.relative_to(root).as_posix(), "sha256": sha256_file(path), "byteLength": path.stat().st_size}


def _can_retry(report: dict[str, Any]) -> bool:
    return any("walkable conflicts" in error or "coverage" in error for error in report["errors"])


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"
