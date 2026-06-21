from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil
from typing import Any

import numpy as np
from PIL import Image, ImageOps

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS


VARIANTS: tuple[tuple[str, str, tuple[int, int]], ...] = (
    ("orig", "copy", (0, 0)),
    ("hflip", "hflip", (0, 0)),
    ("shift-left-up", "shift", (-18, -10)),
    ("shift-right-down", "shift", (18, 10)),
)


def main() -> int:
    parser = ArgumentParser(description="Prepare augmented natural-home full-scene diversity dataset.")
    parser.add_argument("--source-root", type=Path, default=Path(".runtime/ai-painter/natural-home-clean-dataset"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v27-augmented-diversity-dataset"))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    train_sources = read_index(args.source_root / "indexes" / "train.json")
    validation_sources = read_index(args.source_root / "indexes" / "validation.json")
    train_ids = write_split(args.source_root, args.output_root, train_sources)
    validation_ids = write_split(args.source_root, args.output_root, validation_sources)
    indexes = args.output_root / "indexes"
    indexes.mkdir(parents=True, exist_ok=True)
    write_json(indexes / "train.json", {"sampleIds": train_ids})
    write_json(indexes / "validation.json", {"sampleIds": validation_ids})
    manifest = {
        "schemaVersion": "natural-home-augmented-diversity-dataset-v1",
        "status": "completed",
        "stageId": "natural-home-v27-augmented-diversity",
        "sourceRoot": str(args.source_root.resolve()),
        "trainSourceCount": len(train_sources),
        "validationSourceCount": len(validation_sources),
        "variantsPerSource": len(VARIANTS),
        "trainCount": len(train_ids),
        "validationCount": len(validation_ids),
        "sampleCount": len(train_ids) + len(validation_ids),
        "variantPolicy": [
            {"id": variant_id, "operation": operation, "offset": list(offset)}
            for variant_id, operation, offset in VARIANTS
        ],
        "note": "Target PNG and masks_v1 are transformed together. This dataset is for local model diversity training only.",
    }
    write_json(args.output_root / "dataset-manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def write_split(source_root: Path, output_root: Path, source_ids: list[str]) -> list[str]:
    output_ids: list[str] = []
    for source_id in source_ids:
        source_dir = source_root / "accepted" / "dataset_v0" / "scene" / "world" / source_id
        target = Image.open(source_dir / "target.png").convert("RGB")
        masks = {
            name: Image.open(source_dir / "masks_v1" / f"{name}.png").convert("L")
            for name in V1_CONDITION_CHANNELS
        }
        fill_color = median_grass_color(target, masks["grass"])
        for variant_id, operation, offset in VARIANTS:
            sample_id = f"{source_id}__aug-{variant_id}"
            sample_dir = output_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
            masks_dir = sample_dir / "masks_v1"
            masks_dir.mkdir(parents=True, exist_ok=True)
            transform_target(target, operation, offset, fill_color).save(sample_dir / "target.png")
            for name in V1_CONDITION_CHANNELS:
                fill = 255 if name == "grass" else 0
                transform_mask(masks[name], operation, offset, fill).save(masks_dir / f"{name}.png")
            write_blueprint(source_dir, sample_dir, sample_id, source_id, variant_id, operation, offset)
            write_metadata(source_dir, sample_dir, sample_id, source_id, variant_id, operation, offset)
            output_ids.append(sample_id)
    return output_ids


def transform_target(image: Image.Image, operation: str, offset: tuple[int, int], fill_color: tuple[int, int, int]) -> Image.Image:
    if operation == "copy":
        return image.copy()
    if operation == "hflip":
        return ImageOps.mirror(image)
    return shifted(image, offset, fill_color)


def transform_mask(image: Image.Image, operation: str, offset: tuple[int, int], fill: int) -> Image.Image:
    if operation == "copy":
        return image.copy()
    if operation == "hflip":
        return ImageOps.mirror(image)
    return shifted(image, offset, fill)


def shifted(image: Image.Image, offset: tuple[int, int], fill) -> Image.Image:
    dx, dy = offset
    result = Image.new(image.mode, image.size, fill)
    src_x0 = max(0, -dx)
    src_y0 = max(0, -dy)
    src_x1 = min(CANVAS_WIDTH, CANVAS_WIDTH - dx)
    src_y1 = min(CANVAS_HEIGHT, CANVAS_HEIGHT - dy)
    dst_x = max(0, dx)
    dst_y = max(0, dy)
    if src_x1 > src_x0 and src_y1 > src_y0:
        crop = image.crop((src_x0, src_y0, src_x1, src_y1))
        result.paste(crop, (dst_x, dst_y))
    return result


def median_grass_color(target: Image.Image, grass: Image.Image) -> tuple[int, int, int]:
    pixels = np.asarray(target, dtype=np.uint8)
    mask = np.asarray(grass, dtype=np.uint8) > 0
    if not np.any(mask):
        return (92, 139, 62)
    values = pixels[mask]
    median = np.median(values, axis=0).round().astype(np.uint8)
    return (int(median[0]), int(median[1]), int(median[2]))


def write_blueprint(source_dir: Path, sample_dir: Path, sample_id: str, source_id: str, variant_id: str, operation: str, offset: tuple[int, int]) -> None:
    blueprint_path = source_dir / "blueprint.v1.json"
    if blueprint_path.exists():
        blueprint: dict[str, Any] = json.loads(blueprint_path.read_text(encoding="utf-8"))
    else:
        blueprint = {"schemaVersion": "world-blueprint-v1", "width": CANVAS_WIDTH, "height": CANVAS_HEIGHT}
    blueprint["sceneId"] = sample_id
    blueprint["sourceSceneId"] = source_id
    blueprint["augmentation"] = {"variantId": variant_id, "operation": operation, "offset": list(offset)}
    write_json(sample_dir / "blueprint.v1.json", blueprint)


def write_metadata(source_dir: Path, sample_dir: Path, sample_id: str, source_id: str, variant_id: str, operation: str, offset: tuple[int, int]) -> None:
    metadata_path = source_dir / "metadata.json"
    if metadata_path.exists():
        metadata: dict[str, Any] = json.loads(metadata_path.read_text(encoding="utf-8"))
    else:
        metadata = {}
    metadata.update(
        {
            "sampleId": sample_id,
            "sourceSampleId": source_id,
            "stageId": "natural-home-v27-augmented-diversity",
            "augmentation": {"variantId": variant_id, "operation": operation, "offset": list(offset)},
            "displayAllowed": False,
            "canPromoteToWorld": False,
        }
    )
    write_json(sample_dir / "metadata.json", metadata)


def read_index(path: Path) -> list[str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    values = raw.get("sampleIds")
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        raise ValueError(f"invalid index: {path}")
    return values


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
