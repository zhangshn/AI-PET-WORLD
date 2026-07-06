from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from ai_painter.runtime_retention import preserve_runtime_dir_before_clear


MASK_CHANNELS = [
    "grass",
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_trunk",
    "tree_crown",
    "rock",
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
    "walkable",
    "depth",
]

FORBIDDEN_CHANNELS = {
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
    "building",
    "shelter",
}

NATURAL_STAGE_TAGS = [
    "complete_natural_home_mvp",
    "primary_world_view",
    "runtime_frame_source",
    "complete_game_world_frame_source",
    "full_view_not_crop",
    "pure_natural_stage",
    "no_building",
    "no_character",
    "no_dynamic_state",
]


def main() -> int:
    parser = ArgumentParser(description="Build a pure-natural complete-frame dataset from V120 source frames.")
    parser.add_argument("--input-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--stage-id", default="natural-home-v129-pure-natural-complete-frame-dataset")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    report = build_dataset(args.input_root.resolve(), args.output_root.resolve(), args.stage_id, args.force)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def build_dataset(input_root: Path, output_root: Path, stage_id: str, force: bool) -> dict[str, Any]:
    input_manifest_path = input_root / "latest.json"
    if not input_manifest_path.exists():
        raise FileNotFoundError(f"input manifest not found: {input_manifest_path}")
    input_manifest = read_json(input_manifest_path)
    input_rows = input_manifest.get("rows", [])
    if not isinstance(input_rows, list) or not input_rows:
        raise ValueError(f"input manifest has no rows: {input_manifest_path}")

    if output_root.exists():
        if not force:
            raise FileExistsError(f"output root already exists: {output_root}")
        preserve_runtime_dir_before_clear(output_root, "prepare-natural-home-v129-pure-natural-frame-dataset")
    dataset_root = output_root / "accepted" / "dataset_v0" / "scene" / "world"
    dataset_root.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, Any]] = []
    for index, row in enumerate(input_rows):
        sample_id = str(row["sampleId"])
        source_dir = Path(row["target"]).parent
        target_dir = dataset_root / sample_id
        target_dir.mkdir(parents=True, exist_ok=True)

        shutil.copy2(source_dir / "source-original.png", target_dir / "source-original.png")
        forbidden_mask = merged_forbidden_mask(source_dir / "masks_v1")
        pure_target = remove_forbidden_visuals(source_dir / "target.png", forbidden_mask)
        pure_target_path = target_dir / "target.png"
        pure_target.save(pure_target_path)

        blueprint = read_json(source_dir / "blueprint.v1.json")
        blueprint = remove_forbidden_blueprint_structures(blueprint)
        blueprint["sceneId"] = sample_id
        blueprint["styleId"] = "bright-healing-pure-natural-complete-game-world-pixel-v0"
        blueprint["gameWorldIntent"] = {
            "scope": "complete_natural_home_mvp_pure_natural",
            "frameRole": "primary_world_view",
            "runtimeFrameSource": True,
            "tags": NATURAL_STAGE_TAGS,
            "forbiddenCurrentStageFacts": sorted(FORBIDDEN_CHANNELS),
            "note": "V129 is a pure-natural complete-frame training source. It removes current-stage forbidden construction and shelter facts from V120-derived source frames.",
        }
        blueprint_path = target_dir / "blueprint.v1.json"
        write_json(blueprint_path, blueprint)

        mask_dir = target_dir / "masks_v1"
        mask_dir.mkdir(parents=True, exist_ok=True)
        rewrite_masks(source_dir / "masks_v1", mask_dir, forbidden_mask)

        metadata = read_json(source_dir / "metadata.json")
        metadata.update(
            {
                "sampleId": sample_id,
                "stageId": stage_id,
                "sourceStageId": input_manifest.get("stageId"),
                "sourceUse": "pure_natural_training_source_only",
                "displayAllowed": False,
                "canPromoteToWorld": False,
                "notApprovedFrame": True,
                "notRuntimeFrame": True,
                "pureNaturalStage": True,
                "forbiddenChannelsRemoved": sorted(FORBIDDEN_CHANNELS),
                "generatedAt": iso_now(),
                "notes": [
                    "This target is a derived pure-natural training source.",
                    "It is not a generated candidate and must not be shown directly in /world.",
                ],
            }
        )
        write_json(target_dir / "metadata.json", metadata)

        rows.append(
            {
                "sampleId": sample_id,
                "target": str(pure_target_path),
                "blueprint": str(blueprint_path),
                "maskDir": str(mask_dir),
                "sourceOriginal": str(target_dir / "source-original.png"),
                "sourceDataset": str(input_root),
                "sourceSha256": sha256_file(target_dir / "source-original.png"),
                "targetSha256": sha256_file(pure_target_path),
                "forbiddenPixelsRemoved": int(np.asarray(forbidden_mask, dtype=np.uint8).sum() // 255),
            }
        )

    contact_sheet = output_root / "contact-sheet.png"
    build_contact_sheet(rows, contact_sheet)
    train_count = max(1, int(len(rows) * 0.84))
    report = {
        "schemaVersion": "natural-home-v129-pure-natural-complete-frame-dataset-v1",
        "status": "completed",
        "stageId": stage_id,
        "generatedAt": iso_now(),
        "sourceDataset": str(input_root),
        "selectedSampleCount": len(rows),
        "trainCount": train_count,
        "validationCount": len(rows) - train_count,
        "maskChannels": MASK_CHANNELS,
        "sourcePolicy": {
            "selectedFor": stage_id,
            "completeWorldConditionSource": True,
            "completeGameWorldFrameSource": True,
            "requiresModelGeneration": False,
            "displayAllowed": False,
            "canPromoteToWorld": False,
            "notApprovedFrame": True,
            "notRuntimeFrame": True,
            "sourceUse": "pure_natural_training_source_only",
        },
        "gameWorldIntent": {
            "scope": "complete_natural_home_mvp_pure_natural",
            "frameRole": "primary_world_view",
            "runtimeFrameSource": True,
            "tags": NATURAL_STAGE_TAGS,
            "anchors": [
                "world_entry",
                "primary_path",
                "natural_boundary",
                "water_feature",
                "exploration_area",
                "visual_center",
            ],
            "forbiddenCurrentStageFacts": sorted(FORBIDDEN_CHANNELS),
            "note": "Pure natural complete game-world training source. No building, shelter, construction material, character, animal, insect, or dynamic state is allowed in the current stage.",
        },
        "contactSheet": str(contact_sheet),
        "rows": rows,
    }
    write_json(output_root / "latest.json", report)
    return report


def merged_forbidden_mask(mask_dir: Path) -> Image.Image:
    mask = Image.new("L", (256, 192), 0)
    for channel in FORBIDDEN_CHANNELS:
        path = mask_dir / f"{channel}.png"
        if path.exists():
            channel_mask = Image.open(path).convert("L")
            mask = Image.composite(Image.new("L", mask.size, 255), mask, channel_mask)
    return mask.filter(ImageFilter.MaxFilter(5))


def remove_forbidden_visuals(target_path: Path, forbidden_mask: Image.Image) -> Image.Image:
    source = Image.open(target_path).convert("RGB")
    source_array = np.asarray(source).astype(np.float32)
    mask = np.asarray(forbidden_mask, dtype=np.uint8) > 0
    result = source_array.copy()
    if not mask.any():
        return source

    ring = np.asarray(forbidden_mask.filter(ImageFilter.MaxFilter(19)), dtype=np.uint8) > 0
    ring = ring & ~mask
    median_color = np.median(source_array[ring], axis=0) if ring.any() else np.asarray([91.0, 136.0, 63.0])
    result[mask] = median_color

    for _ in range(260):
        average = four_neighbor_average(result)
        result[mask] = average[mask]

    blurred = np.asarray(source.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
    texture = source_array - blurred
    shifted_texture = (
        np.roll(texture, shift=17, axis=0)
        + np.roll(texture, shift=-23, axis=1)
        + np.roll(texture, shift=(11, -13), axis=(0, 1))
    ) / 3.0
    result[mask] = result[mask] + shifted_texture[mask] * 0.65
    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8), "RGB")


def four_neighbor_average(image: np.ndarray) -> np.ndarray:
    padded = np.pad(image, ((1, 1), (1, 1), (0, 0)), mode="edge")
    return (
        padded[:-2, 1:-1]
        + padded[2:, 1:-1]
        + padded[1:-1, :-2]
        + padded[1:-1, 2:]
    ) * 0.25


def remove_forbidden_blueprint_structures(blueprint: dict[str, Any]) -> dict[str, Any]:
    structures = blueprint.get("structures", [])
    if isinstance(structures, list):
        blueprint["structures"] = [
            structure
            for structure in structures
            if not (
                isinstance(structure, dict)
                and str(structure.get("type", "")).lower() in FORBIDDEN_CHANNELS
            )
        ]
    return blueprint


def rewrite_masks(source_mask_dir: Path, target_mask_dir: Path, forbidden_mask: Image.Image) -> None:
    for channel in MASK_CHANNELS:
        source_path = source_mask_dir / f"{channel}.png"
        target_path = target_mask_dir / f"{channel}.png"
        if channel in FORBIDDEN_CHANNELS:
            Image.new("L", (256, 192), 0).save(target_path)
            continue
        if not source_path.exists():
            Image.new("L", (256, 192), 0).save(target_path)
            continue
        mask = Image.open(source_path).convert("L")
        if channel in {"grass", "walkable"}:
            mask = Image.composite(mask, Image.new("L", mask.size, 255), forbidden_mask)
        mask.save(target_path)


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> None:
    thumb_w, thumb_h = 256, 192
    columns = 3
    rows_count = (len(rows) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * thumb_w, rows_count * (thumb_h + 18)), (6, 22, 17))
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        image = Image.open(row["target"]).convert("RGB")
        x = (index % columns) * thumb_w
        y = (index // columns) * (thumb_h + 18)
        sheet.paste(image, (x, y + 18))
        draw.text((x + 4, y + 3), str(row["sampleId"]), fill=(180, 255, 210))
    sheet.save(output_path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    raise SystemExit(main())
