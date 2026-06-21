from __future__ import annotations

from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageFilter

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.blueprint.v1_validator import validate_v1_blueprint_data


SOURCE_SIZE = (CANVAS_WIDTH, CANVAS_HEIGHT)
TRAIN_SPLIT_RATIO = 0.8


def main() -> int:
    parser = ArgumentParser(description="Prepare natural-home-only training data for the local AI Painter model.")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    source_root = args.source_root.resolve()
    output_root = args.output_root.resolve()
    sources = sorted(source_root.glob("*.png"))
    if not sources:
        raise FileNotFoundError(f"no natural-home source PNG found: {source_root}")
    if output_root.exists():
        shutil.rmtree(output_root)
    scene_root = output_root / "accepted" / "dataset_v0" / "scene" / "world"
    scene_root.mkdir(parents=True)
    sample_ids: list[str] = []
    for index, source in enumerate(sources, 1):
        sample_id = source.stem
        sample_ids.append(sample_id)
        sample_dir = scene_root / sample_id
        sample_dir.mkdir()
        target = normalize_target(source, sample_dir / "target.png")
        masks = build_condition_masks(target)
        write_masks(masks, sample_dir / "masks_v1")
        blueprint = build_blueprint(sample_id, index, masks)
        errors = validate_v1_blueprint_data(blueprint)
        if errors:
            raise ValueError(f"{sample_id}: {'; '.join(errors)}")
        blueprint_path = sample_dir / "blueprint.v1.json"
        blueprint_path.write_text(json.dumps(blueprint, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        metadata = {
            "schemaVersion": "natural-home-training-sample-v1",
            "sampleId": sample_id,
            "sourceType": "project_owned_natural_home_source",
            "conditionSource": "same_source_image_analysis_v1",
            "purpose": "local_model_training_only",
            "forbiddenContentExcluded": [
                "building",
                "shelter_foundation",
                "shelter_wall",
                "shelter_roof",
                "construction_material",
                "character",
                "animal",
                "town",
                "city",
            ],
            "targetSha256": digest(sample_dir / "target.png"),
            "blueprintSha256": digest(blueprint_path),
            "maskSha256": {name: digest(sample_dir / "masks_v1" / f"{name}.png") for name in V1_CONDITION_CHANNELS},
        }
        (sample_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    indexes = output_root / "indexes"
    indexes.mkdir()
    train_count = max(1, min(len(sample_ids) - 1, int(len(sample_ids) * TRAIN_SPLIT_RATIO)))
    train_ids = sample_ids[:train_count]
    validation_ids = sample_ids[len(train_ids):]
    if not validation_ids and len(sample_ids) > 1:
        validation_ids = [train_ids.pop()]
    write_index(indexes / "train.json", "train", train_ids)
    write_index(indexes / "validation.json", "validation", validation_ids)
    manifest = {
        "schemaVersion": "natural-home-dataset-manifest-v1",
        "status": "experimental_training_ready",
        "scope": "natural_home_without_buildings",
        "blueprintVersion": "v1",
        "conditionChannels": len(V1_CONDITION_CHANNELS),
        "sampleCount": len(sample_ids),
        "trainCount": len(train_ids),
        "validationCount": len(validation_ids),
        "sampleIds": sample_ids,
        "note": "Targets are natural home source images. Conditions are source-derived training masks, not programmatic final rendering.",
    }
    (output_root / "dataset-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_contact_sheet(scene_root, sample_ids, output_root / "contact-sheet.png")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def normalize_target(source: Path, output: Path) -> Image.Image:
    with Image.open(source) as image:
        target = image.convert("RGB")
        if target.size != SOURCE_SIZE:
            target = target.resize(SOURCE_SIZE, Image.Resampling.LANCZOS)
        target.save(output, format="PNG", optimize=False, compress_level=9)
        return target


def build_condition_masks(image: Image.Image) -> dict[str, Image.Image]:
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    hsv = np.asarray(image.convert("HSV"), dtype=np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    water_raw = ((h >= 115) & (h <= 155) & (s > 45) & (b > r + 8)) | ((b > g + 12) & (b > r + 18) & (v > 45))
    road_raw = ((r > 90) & (g > 65) & (b < 95) & (s > 25) & ((r - b) > 22) & ((g - b) > 12))
    rock_raw = (s < 65) & (v > 55) & (v < 190) & (np.abs(r - g) < 35) & (np.abs(g - b) < 35)
    trunk_raw = ((r > 70) & (g > 35) & (b < 70) & ((r - g) > 15) & ~road_raw)
    tree_crown_raw = (g > r + 8) & (g >= b - 4) & (s > 45) & (v < 150) & ~water_raw
    grass_raw = (g > r - 2) & (g >= b - 8) & (s > 25)

    water = water_raw
    road = road_raw & ~water
    shoreline = border(water, radius=5) & ~water & ~road
    road_edge = border(road, radius=3) & ~water & ~road & ~shoreline
    rock = rock_raw & ~water & ~road & ~road_edge & ~shoreline
    trunk = trunk_raw & ~water & ~road & ~road_edge & ~shoreline & ~rock
    tree_crown = tree_crown_raw & ~water & ~road & ~road_edge & ~shoreline & ~rock & ~trunk
    grass = grass_raw & ~water & ~road
    walkable = road | (grass & ~tree_crown)
    masks: dict[str, np.ndarray] = {
        "grass": grass,
        "water_body": water,
        "shoreline": shoreline,
        "road_center": road,
        "road_edge": road_edge,
        "tree_trunk": trunk,
        "tree_crown": tree_crown,
        "rock": rock,
        "shelter_foundation": np.zeros_like(grass),
        "shelter_wall": np.zeros_like(grass),
        "shelter_roof": np.zeros_like(grass),
        "construction_material": np.zeros_like(grass),
        "walkable": walkable,
        "depth": depth_gradient(),
    }
    return {name: mask_image(value) for name, value in masks.items()}


def border(mask: np.ndarray, *, radius: int) -> np.ndarray:
    base = mask_image(mask)
    expanded = base.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    contracted = base.filter(ImageFilter.MinFilter(max(3, radius // 2 * 2 + 1)))
    return np.asarray(expanded, dtype=np.uint8) > np.asarray(contracted, dtype=np.uint8)


def depth_gradient() -> np.ndarray:
    values = np.linspace(55, 230, CANVAS_HEIGHT, dtype=np.uint8)
    return np.repeat(values[:, None], CANVAS_WIDTH, axis=1)


def mask_image(value: np.ndarray) -> Image.Image:
    if value.dtype == np.bool_:
        pixels = value.astype(np.uint8) * 255
    else:
        pixels = value.astype(np.uint8)
    return Image.fromarray(pixels)


def write_masks(masks: dict[str, Image.Image], output_dir: Path) -> None:
    output_dir.mkdir(parents=True)
    for name in V1_CONDITION_CHANNELS:
        masks[name].save(output_dir / f"{name}.png", format="PNG", optimize=False, compress_level=9)


def build_blueprint(sample_id: str, seed: int, masks: dict[str, Image.Image]) -> dict[str, object]:
    structures: list[dict[str, object]] = [
        polygon("grass-main", "grass", [[0, 0], [255, 0], [255, 191], [0, 191]], 1),
        depth("depth-background", [[0, 0], [255, 0], [255, 63], [0, 63]], 70, 2),
        depth("depth-midground", [[0, 64], [255, 64], [255, 133], [0, 133]], 145, 3),
        depth("depth-foreground", [[0, 134], [255, 134], [255, 191], [0, 191]], 220, 4),
    ]
    for name in ("water_body", "shoreline", "road_center", "road_edge", "tree_crown", "tree_trunk", "rock", "walkable"):
        box = mask_bbox(masks[name])
        if box:
            structures.append(rect(f"{name}-source-region", name, *box, layer_for(name)))
    return {
        "schemaVersion": "world-blueprint-v1",
        "sceneId": sample_id,
        "width": CANVAS_WIDTH,
        "height": CANVAS_HEIGHT,
        "seed": 2026061600 + seed,
        "styleId": "natural-home-local-model-training-v1",
        "requiresManualReview": False,
        "manualReviewReasons": [],
        "structures": structures,
    }


def mask_bbox(mask: Image.Image) -> tuple[int, int, int, int] | None:
    box = mask.point(lambda value: 255 if value else 0).getbbox()
    if box is None:
        return None
    left, top, right, bottom = box
    return left, top, max(1, right - left), max(1, bottom - top)


def layer_for(name: str) -> int:
    order = {
        "water_body": 10,
        "shoreline": 11,
        "road_edge": 20,
        "road_center": 21,
        "walkable": 22,
        "tree_trunk": 30,
        "tree_crown": 31,
        "rock": 32,
    }
    return order.get(name, 90)


def polygon(item_id: str, item_type: str, points: list[list[int]], layer: int) -> dict[str, object]:
    return {"id": item_id, "type": item_type, "geometry": {"kind": "polygon", "points": points}, "layer": layer, "requiresManualReview": False, "manualReviewReasons": []}


def depth(item_id: str, points: list[list[int]], value: int, layer: int) -> dict[str, object]:
    item = polygon(item_id, "depth", points, layer)
    item["depthValue"] = value
    return item


def rect(item_id: str, item_type: str, x: int, y: int, width: int, height: int, layer: int) -> dict[str, object]:
    return {"id": item_id, "type": item_type, "geometry": {"kind": "rect", "x": x, "y": y, "width": width, "height": height}, "layer": layer, "requiresManualReview": False, "manualReviewReasons": []}


def write_index(path: Path, split: str, sample_ids: list[str]) -> None:
    path.write_text(json.dumps({"schemaVersion": "dataset-index-v1", "split": split, "sampleIds": sample_ids, "count": len(sample_ids)}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_contact_sheet(scene_root: Path, sample_ids: list[str], output: Path) -> None:
    scale = 2
    columns = 3
    rows = (len(sample_ids) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * CANVAS_WIDTH * scale, rows * CANVAS_HEIGHT * scale), (5, 18, 14))
    for index, sample_id in enumerate(sample_ids):
        with Image.open(scene_root / sample_id / "target.png") as image:
            thumb = image.resize((CANVAS_WIDTH * scale, CANVAS_HEIGHT * scale), Image.Resampling.NEAREST)
        x = index % columns * CANVAS_WIDTH * scale
        y = index // columns * CANVAS_HEIGHT * scale
        sheet.paste(thumb, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG", optimize=False, compress_level=9)


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
