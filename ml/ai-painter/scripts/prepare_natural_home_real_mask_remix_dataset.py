from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS


VARIANTS: tuple[dict[str, object], ...] = (
    {"id": "copy", "operation": "copy", "offset": (0, 0), "groups": ()},
    {"id": "hflip", "operation": "hflip", "offset": (0, 0), "groups": ()},
    {"id": "shift-northwest", "operation": "shift", "offset": (-16, -8), "groups": ()},
    {"id": "shift-southeast", "operation": "shift", "offset": (16, 8), "groups": ()},
    {"id": "remix-water-rock", "operation": "remix", "offset": (0, 0), "groups": ("water", "shoreline", "rock")},
    {"id": "remix-road-tree", "operation": "remix", "offset": (0, 0), "groups": ("road", "tree", "walkable")},
)

GROUP_CHANNELS: dict[str, tuple[str, ...]] = {
    "water": ("water_body",),
    "shoreline": ("shoreline",),
    "road": ("road_center", "road_edge"),
    "tree": ("tree_trunk", "tree_crown"),
    "rock": ("rock",),
    "walkable": ("walkable",),
}


def main() -> int:
    parser = ArgumentParser(description="Prepare V28 natural-home real-mask remix dataset.")
    parser.add_argument("--source-root", type=Path, default=Path(".runtime/ai-painter/natural-home-clean-dataset"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v28-real-mask-remix-dataset"))
    args = parser.parse_args()

    args.output_root.mkdir(parents=True, exist_ok=True)
    train_sources = read_index(args.source_root / "indexes" / "train.json")
    validation_sources = read_index(args.source_root / "indexes" / "validation.json")
    train_ids = write_split(args.source_root, args.output_root, train_sources, "train")
    validation_ids = write_split(args.source_root, args.output_root, validation_sources, "validation")

    indexes = args.output_root / "indexes"
    indexes.mkdir(parents=True, exist_ok=True)
    write_json(indexes / "train.json", {"schemaVersion": "dataset-index-v1", "split": "train", "sampleIds": train_ids})
    write_json(
        indexes / "validation.json",
        {"schemaVersion": "dataset-index-v1", "split": "validation", "sampleIds": validation_ids},
    )
    contact_sheet = build_contact_sheet(args.output_root, train_ids[:12], args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": "natural-home-real-mask-remix-dataset-v1",
        "status": "completed",
        "stageId": "natural-home-v28-real-mask-remix",
        "sourceRoot": str(args.source_root.resolve()),
        "trainSourceCount": len(train_sources),
        "validationSourceCount": len(validation_sources),
        "variantsPerSource": len(VARIANTS),
        "trainCount": len(train_ids),
        "validationCount": len(validation_ids),
        "sampleCount": len(train_ids) + len(validation_ids),
        "contactSheet": str(contact_sheet.resolve()),
        "policy": {
            "source": "target.png and masks_v1 are transformed together",
            "remix": "selected real mask regions paste target pixels and every v1 mask channel from the same donor",
            "displayAllowed": False,
            "canPromoteToWorld": False,
        },
        "variants": [
            {
                "id": str(variant["id"]),
                "operation": str(variant["operation"]),
                "offset": list(variant["offset"]),
                "groups": list(variant["groups"]),
            }
            for variant in VARIANTS
        ],
    }
    write_json(args.output_root / "dataset-manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def write_split(source_root: Path, output_root: Path, source_ids: list[str], split: str) -> list[str]:
    output_ids: list[str] = []
    if not source_ids:
        return output_ids
    for index, source_id in enumerate(source_ids):
        base = load_scene(source_root, source_id)
        donor_id = source_ids[(index * 7 + 5) % len(source_ids)]
        if donor_id == source_id and len(source_ids) > 1:
            donor_id = source_ids[(index + 1) % len(source_ids)]
        donor = load_scene(source_root, donor_id)
        for variant in VARIANTS:
            variant_id = str(variant["id"])
            operation = str(variant["operation"])
            offset = tuple(variant["offset"])
            groups = tuple(str(value) for value in variant["groups"])
            sample_id = f"{source_id}__v28-{variant_id}"
            sample_dir = output_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
            masks_dir = sample_dir / "masks_v1"
            masks_dir.mkdir(parents=True, exist_ok=True)
            transformed = transform_scene(base, operation, offset)
            if operation == "remix":
                donor_scene = transform_scene(donor, "hflip" if index % 2 else "shift", (12, -6))
                target, masks = remix_scene(transformed, donor_scene, groups)
            else:
                target, masks = transformed["target"], transformed["masks"]
            target.save(sample_dir / "target.png")
            for name in V1_CONDITION_CHANNELS:
                masks[name].save(masks_dir / f"{name}.png")
            write_blueprint(base["directory"], sample_dir, sample_id, source_id, donor_id, variant_id, operation, offset, groups)
            write_metadata(sample_dir, sample_id, source_id, donor_id, variant_id, split, operation, offset, groups)
            output_ids.append(sample_id)
    return output_ids


def load_scene(source_root: Path, sample_id: str) -> dict[str, Any]:
    directory = source_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    return {
        "sampleId": sample_id,
        "directory": directory,
        "target": Image.open(directory / "target.png").convert("RGB"),
        "masks": {
            name: Image.open(directory / "masks_v1" / f"{name}.png").convert("L")
            for name in V1_CONDITION_CHANNELS
        },
    }


def transform_scene(scene: dict[str, Any], operation: str, offset: tuple[int, int]) -> dict[str, Any]:
    target = scene["target"]
    masks = scene["masks"]
    fill_color = median_grass_color(target, masks["grass"])
    if operation == "copy":
        return {"target": target.copy(), "masks": {name: image.copy() for name, image in masks.items()}}
    if operation == "hflip":
        return {"target": ImageOps.mirror(target), "masks": {name: ImageOps.mirror(image) for name, image in masks.items()}}
    return {
        "target": shifted(target, offset, fill_color),
        "masks": {name: shifted(image, offset, 255 if name == "grass" else 0) for name, image in masks.items()},
    }


def remix_scene(base: dict[str, Any], donor: dict[str, Any], groups: tuple[str, ...]) -> tuple[Image.Image, dict[str, Image.Image]]:
    region = Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0)
    for group in groups:
        for channel in GROUP_CHANNELS[group]:
            region = ImageChops.lighter(region, donor["masks"][channel])
    hard_region = region.point(lambda value: 255 if value > 0 else 0)
    feather_region = hard_region.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2.2))
    target = base["target"].copy()
    target.paste(donor["target"], (0, 0), feather_region)
    masks: dict[str, Image.Image] = {}
    for channel in V1_CONDITION_CHANNELS:
        result = base["masks"][channel].copy()
        result.paste(donor["masks"][channel], (0, 0), hard_region)
        masks[channel] = result
    return target, masks


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
        result.paste(image.crop((src_x0, src_y0, src_x1, src_y1)), (dst_x, dst_y))
    return result


def median_grass_color(target: Image.Image, grass: Image.Image) -> tuple[int, int, int]:
    pixels = np.asarray(target, dtype=np.uint8)
    mask = np.asarray(grass, dtype=np.uint8) > 0
    if not np.any(mask):
        return (92, 139, 62)
    median = np.median(pixels[mask], axis=0).round().astype(np.uint8)
    return int(median[0]), int(median[1]), int(median[2])


def write_blueprint(
    source_dir: Path,
    sample_dir: Path,
    sample_id: str,
    source_id: str,
    donor_id: str,
    variant_id: str,
    operation: str,
    offset: tuple[int, int],
    groups: tuple[str, ...],
) -> None:
    blueprint_path = source_dir / "blueprint.v1.json"
    if blueprint_path.exists():
        blueprint: dict[str, Any] = json.loads(blueprint_path.read_text(encoding="utf-8"))
    else:
        blueprint = {"schemaVersion": "world-blueprint-v1", "width": CANVAS_WIDTH, "height": CANVAS_HEIGHT}
    blueprint["sceneId"] = sample_id
    blueprint["sourceSceneId"] = source_id
    blueprint["requiresManualReview"] = False
    blueprint["v28RealMaskRemix"] = {
        "sourceSampleId": source_id,
        "donorSampleId": donor_id,
        "variantId": variant_id,
        "operation": operation,
        "offset": list(offset),
        "groups": list(groups),
        "note": "Training-only same-source target/mask remix. Not an ApprovedFrame.",
    }
    write_json(sample_dir / "blueprint.v1.json", blueprint)


def write_metadata(
    sample_dir: Path,
    sample_id: str,
    source_id: str,
    donor_id: str,
    variant_id: str,
    split: str,
    operation: str,
    offset: tuple[int, int],
    groups: tuple[str, ...],
) -> None:
    write_json(
        sample_dir / "metadata.json",
        {
            "schemaVersion": "natural-home-v28-real-mask-remix-sample-v1",
            "sampleId": sample_id,
            "sourceSampleId": source_id,
            "donorSampleId": donor_id,
            "split": split,
            "stageId": "natural-home-v28-real-mask-remix",
            "variantId": variant_id,
            "operation": operation,
            "offset": list(offset),
            "groups": list(groups),
            "displayAllowed": False,
            "canPromoteToWorld": False,
            "note": "Target and masks are co-generated from real accepted samples. This is training data, not player content.",
        },
    )


def build_contact_sheet(output_root: Path, sample_ids: list[str], output_path: Path) -> Path:
    gap = 10
    label_height = 20
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    rows = max(1, (len(sample_ids) + columns - 1) // columns)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, sample_id in enumerate(sample_ids):
        target_path = output_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id / "target.png"
        if not target_path.exists():
            continue
        col = index % columns
        row = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        draw.text((x, y), sample_id[:34], fill="#dff8e6")
        with Image.open(target_path) as image:
            sheet.paste(image.convert("RGB"), (x, y + label_height))
    sheet.save(output_path)
    return output_path


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
