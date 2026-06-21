from __future__ import annotations

from argparse import ArgumentParser
import ast
from hashlib import sha256
import json
from math import hypot
from pathlib import Path
import shutil

from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.blueprint.v1_validator import validate_v1_blueprint_data
from multiscene_expansion_specs import EXPANSION_SCENES


def main() -> int:
    parser = ArgumentParser(description="Compile project-authored scene specifications into a local multi-scene dataset.")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    source_root = args.source_root.resolve()
    output_root = args.output_root.resolve()
    specs = load_preserved_specs(Path("ml/ai-painter/scripts/relabel_engineering_batch_01.py"))
    specs.update(EXPANSION_SCENES)
    if output_root.exists():
        shutil.rmtree(output_root)
    scene_root = output_root / "accepted" / "dataset_v0" / "scene" / "world"
    scene_root.mkdir(parents=True)
    results = []
    for scene_id, spec in specs.items():
        source = source_root / f"{scene_id}.png"
        if not source.is_file():
            raise FileNotFoundError(f"场景原图不存在：{source}")
        sample_dir = scene_root / scene_id
        sample_dir.mkdir()
        shutil.copy2(source, sample_dir / "target.png")
        blueprint = build_blueprint(scene_id, spec)
        errors = validate_v1_blueprint_data(blueprint)
        if errors:
            raise ValueError(f"{scene_id}: {'; '.join(errors)}")
        blueprint_path = sample_dir / "blueprint.v1.json"
        blueprint_path.write_text(json.dumps(blueprint, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        masks = render_v1_masks_from_file(blueprint_path, sample_dir / "masks_v1")
        metadata = {
            "schemaVersion": "multiscene-training-sample-v1",
            "sampleId": scene_id,
            "sourceType": "project_generated_reference_image",
            "conditionSource": "project_authored_scene_specification",
            "imageSha256": digest(sample_dir / "target.png"),
            "blueprintSha256": digest(blueprint_path),
            "maskCount": len(masks),
            "trainingTier": "experimental_multiscene_v1",
        }
        (sample_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        results.append(scene_id)
    train_ids, validation_ids = results[:16], results[16:]
    indexes = output_root / "indexes"
    indexes.mkdir()
    write_index(indexes / "train.json", "train", train_ids)
    write_index(indexes / "validation.json", "validation", validation_ids)
    manifest = {
        "schemaVersion": "multiscene-dataset-manifest-v1",
        "status": "experimental_ready",
        "blueprintVersion": "v1",
        "conditionChannels": 14,
        "sampleCount": len(results),
        "trainCount": len(train_ids),
        "validationCount": len(validation_ids),
        "sampleIds": results,
        "warning": "This dataset uses project-authored scene specifications and is the first multi-scene experiment, not final production data.",
    }
    (output_root / "dataset-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def load_preserved_specs(path: Path) -> dict[str, dict[str, object]]:
    text = path.read_text(encoding="utf-8")
    start = text.index("SCENES: dict[str, dict[str, object]] =")
    start = text.index("{", start)
    end = text.index("\n\n\nROOF_SCENES", start)
    value = ast.literal_eval(text[start:end])
    if not isinstance(value, dict) or len(value) < 2:
        raise ValueError("保存的场景结构规格无效")
    return value


def build_blueprint(scene_id: str, spec: dict[str, object]) -> dict[str, object]:
    structures = [
        polygon("grass-main", "grass", [[0, 0], [255, 0], [255, 191], [0, 191]], 1),
        depth("depth-background", [[0, 0], [255, 0], [255, 63], [0, 63]], 70, 2),
        depth("depth-midground", [[0, 64], [255, 64], [255, 133], [0, 133]], 145, 3),
        depth("depth-foreground", [[0, 134], [255, 134], [255, 191], [0, 191]], 220, 4),
    ]
    for index, points in enumerate(spec.get("grass", []), 1):
        structures.append(polygon(f"grass-detail-{index}", "grass", points, 5))
    road_points = spec["road"]
    left, right = offset_polyline(road_points, 5)
    structures.extend([
        line("road-edge-left", "road_edge", left, 2, 10),
        line("road-edge-right", "road_edge", right, 2, 10),
        line("road-center-main", "road_center", road_points, 3, 11),
        line("walkable-road", "walkable", road_points, 10, 12),
    ])
    if "water" in spec:
        structures.append(polygon("water-main", "water_body", spec["water"], 20))
        for index, points in enumerate(spec.get("shore", []), 1):
            structures.append(line(f"shoreline-{index}", "shoreline", points, 5, 21))
    x, y, width, height = spec["shelter"]
    structures.extend([
        box("shelter-foundation-main", "shelter_foundation", x, y + height * 3 // 4, width, max(7, height // 4), 50),
        box("shelter-wall-main", "shelter_wall", x, y + height // 5, width, max(8, height * 3 // 5), 51),
    ])
    if scene_id in {"scene-world-2-d16f635d", "scene-world-6-baed2f27", "scene-world-9-1a418b26", "scene-world-11-e0e7975b"} or bool(spec.get("hasRoof")):
        structures.append(box("shelter-roof-main", "shelter_roof", x, y, width, max(8, height // 3), 52))
    for index, values in enumerate(spec["materials"], 1):
        structures.append(box(f"construction-material-{index}", "construction_material", *values, 70))
    for index, (tx, ty, tw, th) in enumerate(spec["trees"], 1):
        structures.append(box(f"tree-crown-{index}", "tree_crown", tx, ty, tw, th, 40))
        structures.append(box(f"tree-trunk-{index}", "tree_trunk", tx + tw // 2 - 2, min(184, ty + th - 7), 4, 7, 39))
    for index, values in enumerate(spec["rocks"], 1):
        structures.append(box(f"rock-{index}", "rock", *values, 45))
    return {
        "schemaVersion": "world-blueprint-v1",
        "sceneId": scene_id,
        "width": 256,
        "height": 192,
        "seed": int(spec["seed"]),
        "styleId": "bright-healing-topdown-pixel-v0",
        "requiresManualReview": False,
        "manualReviewReasons": [],
        "structures": structures,
    }


def shape(item_id: str, item_type: str, geometry: dict[str, object], layer: int) -> dict[str, object]:
    return {"id": item_id, "type": item_type, "geometry": geometry, "layer": layer, "requiresManualReview": False, "manualReviewReasons": []}


def polygon(item_id: str, item_type: str, points: list[list[int]], layer: int) -> dict[str, object]:
    return shape(item_id, item_type, {"kind": "polygon", "points": bounded_points(points)}, layer)


def line(item_id: str, item_type: str, points: list[list[int]], width: int, layer: int) -> dict[str, object]:
    return shape(item_id, item_type, {"kind": "polyline", "points": bounded_points(points), "lineWidth": width}, layer)


def box(item_id: str, item_type: str, x: int, y: int, width: int, height: int, layer: int) -> dict[str, object]:
    x, y = max(0, min(255, x)), max(0, min(191, y))
    width, height = max(1, min(width, 256 - x)), max(1, min(height, 192 - y))
    return shape(item_id, item_type, {"kind": "rect", "x": x, "y": y, "width": width, "height": height}, layer)


def bounded_points(points: list[list[int]]) -> list[list[int]]:
    return [[max(0, min(255, int(x))), max(0, min(191, int(y)))] for x, y in points]


def depth(item_id: str, points: list[list[int]], value: int, layer: int) -> dict[str, object]:
    item = polygon(item_id, "depth", points, layer)
    item["depthValue"] = value
    return item


def offset_polyline(points: list[list[int]], distance: float) -> tuple[list[list[int]], list[list[int]]]:
    left, right = [], []
    for index, (x, y) in enumerate(points):
        before, after = points[max(0, index - 1)], points[min(len(points) - 1, index + 1)]
        dx, dy = after[0] - before[0], after[1] - before[1]
        length = hypot(dx, dy) or 1.0
        nx, ny = -dy / length * distance, dx / length * distance
        left.append([round(x + nx), round(y + ny)])
        right.append([round(x - nx), round(y - ny)])
    return left, right


def write_index(path: Path, split: str, sample_ids: list[str]) -> None:
    path.write_text(json.dumps({"schemaVersion": "dataset-index-v1", "split": split, "sampleIds": sample_ids, "count": len(sample_ids)}, indent=2) + "\n", encoding="utf-8")


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
