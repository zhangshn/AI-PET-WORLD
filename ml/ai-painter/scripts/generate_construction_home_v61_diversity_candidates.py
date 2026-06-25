from __future__ import annotations

from argparse import ArgumentParser
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import random
import shutil
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.inference import run_inference


@dataclass(frozen=True)
class ConstructionSceneSpec:
    sample_id: str
    seed: int
    water_mode: str
    road_mode: str
    building_mode: str
    material_mode: str
    tree_density: int
    rock_density: int


def main() -> int:
    parser = ArgumentParser(
        description="Generate new construction-home structure conditions and render them with the local V60 model."
    )
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/construction-home-v61-diversity-candidates"))
    parser.add_argument("--sample-count", type=int, default=6)
    parser.add_argument("--sample-id-prefix", default="construction-home-v61-diverse")
    parser.add_argument("--stage-id", default="construction-home-v61-diversity-candidates")
    parser.add_argument("--schema-version", default="construction-home-v61-diversity-candidates-v1")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    dataset_root = args.output_root / "dataset"
    inference_root = args.output_root / "inference"
    scene_root = dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    scene_root.mkdir(parents=True, exist_ok=True)
    inference_root.mkdir(parents=True, exist_ok=True)

    specs = build_scene_specs(args.sample_count, args.sample_id_prefix)
    rows: list[dict[str, Any]] = []
    for spec in specs:
        sample_dir = scene_root / spec.sample_id
        create_scene_sample(spec, sample_dir)
        output_dir = inference_root / spec.sample_id
        output_path = output_dir / "generated.png"
        result = run_inference(
            checkpoint_path=args.checkpoint,
            dataset_root=dataset_root,
            sample_id=spec.sample_id,
            output_path=output_path,
        )
        structure_preview = sample_dir / "condition-preview.png"
        pair_sheet = output_dir / "pair-sheet.png"
        build_pair_sheet(sample_dir / "target.png", output_path, structure_preview, spec.sample_id, pair_sheet)
        rows.append(
            {
                "sampleId": spec.sample_id,
                "status": "needs_visual_judge",
                "displayAllowed": False,
                "canPromoteToWorld": False,
                "generated": str(output_path.resolve()),
                "target": str((sample_dir / "target.png").resolve()),
                "structurePreview": str(structure_preview.resolve()),
                "blueprint": str((sample_dir / "blueprint.v1.json").resolve()),
                "contactSheet": str(pair_sheet.resolve()),
                "sha256": result["sha256"],
                "spec": spec.__dict__,
                "activeChannels": read_active_channels(sample_dir / "masks_v1"),
                "note": "New structure condition rendered by local V60 Tiny U-Net. It is not an ApprovedFrame.",
            }
        )

    write_index(dataset_root, [spec.sample_id for spec in specs])
    contact_sheet = build_contact_sheet(rows, args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": args.schema_version,
        "status": "needs_visual_judge",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "construction_home_v60_generalization_candidate_only",
        "stageId": args.stage_id,
        "checkpoint": str(args.checkpoint.resolve()),
        "datasetRoot": str(dataset_root.resolve()),
        "inferenceRoot": str(inference_root.resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "sampleCount": len(rows),
        "rows": rows,
        "note": "V61 tests whether the local V60 model can render new construction-home structures. Candidates are hidden until VisualJudge and ApprovedFrame.",
    }
    write_json(args.output_root / "latest.json", manifest)
    write_json(args.output_root / "candidate-pack.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def build_scene_specs(sample_count: int, sample_id_prefix: str) -> list[ConstructionSceneSpec]:
    modes = [
        ("right_river", "southwest_to_gate", "foundation_square", "east_stacks", 13, 9),
        ("bottom_stream", "west_curve", "foundation_rect", "split_stacks", 15, 12),
        ("corner_lake", "north_to_yard", "roof_started", "south_stacks", 11, 14),
        ("left_pond", "loop_to_site", "foundation_square", "west_stacks", 16, 10),
        ("diagonal_stream", "northwest_to_south", "roof_started", "east_stacks", 12, 13),
        ("right_river", "center_s_curve", "foundation_rect", "split_stacks", 18, 11),
    ]
    result: list[ConstructionSceneSpec] = []
    for index in range(max(1, sample_count)):
        water_mode, road_mode, building_mode, material_mode, tree_density, rock_density = modes[index % len(modes)]
        result.append(
            ConstructionSceneSpec(
                sample_id=f"{sample_id_prefix}-{index + 1:02d}",
                seed=6100 + index * 53,
                water_mode=water_mode,
                road_mode=road_mode,
                building_mode=building_mode,
                material_mode=material_mode,
                tree_density=tree_density,
                rock_density=rock_density,
            )
        )
    return result


def create_scene_sample(spec: ConstructionSceneSpec, sample_dir: Path) -> None:
    if sample_dir.exists():
        shutil.rmtree(sample_dir)
    masks_dir = sample_dir / "masks_v1"
    masks_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(spec.seed)
    masks = {name: Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0) for name in V1_CONDITION_CHANNELS}

    ImageDraw.Draw(masks["grass"]).rectangle((0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), fill=255)
    draw_depth(masks["depth"])
    water_polygons = draw_water(masks["water_body"], spec.water_mode, rng)
    masks["shoreline"] = shoreline_from_water(masks["water_body"])
    road_points = road_points_for(spec.road_mode)
    draw_road(masks, road_points)
    draw_walkable(masks["walkable"], road_points)
    building = draw_building(masks, spec.building_mode)
    materials = draw_materials(masks, spec.material_mode, building)
    draw_trees(masks, spec.tree_density, water_polygons, road_points, building, rng)
    draw_rocks(masks, spec.rock_density, water_polygons, road_points, building, rng)

    for name, image in masks.items():
        image.save(masks_dir / f"{name}.png")

    preview = build_condition_preview(masks)
    preview.save(sample_dir / "target.png")
    preview.save(sample_dir / "condition-preview.png")
    write_json(
        sample_dir / "blueprint.v1.json",
        {
            "schemaVersion": "world-blueprint-v1",
            "sceneId": spec.sample_id,
            "width": CANVAS_WIDTH,
            "height": CANVAS_HEIGHT,
            "seed": spec.seed,
            "generationRole": "construction_home_diversity_condition",
            "facts": {
                "waterMode": spec.water_mode,
                "roadMode": spec.road_mode,
                "buildingMode": spec.building_mode,
                "materialMode": spec.material_mode,
            },
            "objects": [
                {"id": "construction-site-main", "type": "construction_site", "box": list(building)},
                *[
                    {"id": f"material-{index + 1}", "type": "construction_material", "box": list(box)}
                    for index, box in enumerate(materials)
                ],
            ],
            "displayAllowed": False,
            "canPromoteToWorld": False,
        },
    )
    write_json(
        sample_dir / "metadata.json",
        {
            "schemaVersion": "construction-home-v61-sample-metadata-v1",
            "sampleId": spec.sample_id,
            "seed": spec.seed,
            "generatedBy": "project_local_scene_blueprint_generator",
            "displayAllowed": False,
            "canPromoteToWorld": False,
        },
    )


def draw_depth(depth: Image.Image) -> None:
    pixels = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH), dtype=np.uint8)
    for y in range(CANVAS_HEIGHT):
        pixels[y, :] = 48 + int(176 * (y / max(1, CANVAS_HEIGHT - 1)))
    depth.paste(Image.fromarray(pixels))


def draw_water(water: Image.Image, mode: str, rng: random.Random) -> list[list[tuple[int, int]]]:
    draw = ImageDraw.Draw(water)
    if mode == "right_river":
        points = [(209, 0), (255, 0), (255, 191), (212, 191), (220, 145), (213, 96), (225, 48)]
    elif mode == "bottom_stream":
        points = [(0, 160), (76, 148), (149, 156), (255, 130), (255, 191), (0, 191)]
    elif mode == "corner_lake":
        points = [(203, 116), (255, 102), (255, 191), (176, 191), (170, 156)]
    elif mode == "left_pond":
        points = [(0, 70), (44, 62), (66, 111), (51, 151), (0, 165)]
    else:
        points = [(172, 0), (222, 0), (198, 62), (228, 122), (205, 191), (161, 191), (181, 130), (158, 72)]
    points = [(clamp(x + rng.randint(-4, 4), 0, CANVAS_WIDTH - 1), clamp(y + rng.randint(-4, 4), 0, CANVAS_HEIGHT - 1)) for x, y in points]
    draw.polygon(points, fill=255)
    return [points]


def shoreline_from_water(water: Image.Image) -> Image.Image:
    dilated = water.filter(ImageFilter.MaxFilter(11))
    water_array = np.asarray(water, dtype=np.int16)
    border = np.asarray(dilated, dtype=np.int16) - water_array
    return Image.fromarray(np.clip(border, 0, 255).astype(np.uint8)).convert("L")


def road_points_for(mode: str) -> list[tuple[int, int]]:
    if mode == "southwest_to_gate":
        return [(18, 191), (48, 156), (71, 123), (103, 101), (128, 92)]
    if mode == "west_curve":
        return [(0, 132), (42, 120), (82, 119), (115, 103), (145, 90), (190, 78)]
    if mode == "north_to_yard":
        return [(132, 0), (128, 34), (138, 68), (132, 104), (126, 134), (116, 191)]
    if mode == "loop_to_site":
        return [(0, 116), (32, 104), (64, 88), (99, 92), (126, 106), (97, 126), (55, 142)]
    if mode == "northwest_to_south":
        return [(47, 0), (65, 37), (79, 74), (111, 101), (132, 136), (144, 191)]
    return [(120, 0), (111, 39), (120, 78), (103, 113), (107, 152), (88, 191)]


def draw_road(masks: dict[str, Image.Image], points: list[tuple[int, int]]) -> None:
    ImageDraw.Draw(masks["road_edge"]).line(points, fill=255, width=18, joint="curve")
    ImageDraw.Draw(masks["road_center"]).line(points, fill=255, width=10, joint="curve")


def draw_walkable(walkable: Image.Image, road_points: list[tuple[int, int]]) -> None:
    draw = ImageDraw.Draw(walkable)
    draw.line(road_points, fill=255, width=16, joint="curve")
    draw.ellipse((82, 68, 179, 145), fill=255)


def draw_building(masks: dict[str, Image.Image], mode: str) -> tuple[int, int, int, int]:
    if mode == "foundation_rect":
        box = (95, 76, 162, 124)
    elif mode == "roof_started":
        box = (91, 73, 164, 127)
    else:
        box = (96, 74, 158, 130)
    draw_foundation = ImageDraw.Draw(masks["shelter_foundation"])
    draw_wall = ImageDraw.Draw(masks["shelter_wall"])
    draw_roof = ImageDraw.Draw(masks["shelter_roof"])
    draw_foundation.rectangle(box, fill=255)
    wall_box = (box[0] + 7, box[1] + 7, box[2] - 7, box[3] - 7)
    draw_wall.rectangle(wall_box, outline=255, width=8)
    for x in (box[0] + 8, box[0] + 22, box[2] - 22, box[2] - 8):
        draw_wall.line((x, box[1] - 16, x, box[3] + 12), fill=255, width=4)
    if mode == "roof_started":
        draw_roof.polygon([(box[0] + 10, box[1] - 8), (box[2] - 10, box[1] - 8), (box[2] - 3, box[1] + 18), (box[0] + 3, box[1] + 18)], fill=255)
    return box


def draw_materials(masks: dict[str, Image.Image], mode: str, building: tuple[int, int, int, int]) -> list[tuple[int, int, int, int]]:
    draw = ImageDraw.Draw(masks["construction_material"])
    if mode == "east_stacks":
        boxes = [(building[2] + 12, building[1] + 8, building[2] + 41, building[1] + 19), (building[2] + 14, building[3] - 6, building[2] + 52, building[3] + 8), (building[0] - 38, building[1] + 22, building[0] - 8, building[1] + 34)]
    elif mode == "south_stacks":
        boxes = [(building[0] + 6, building[3] + 9, building[0] + 48, building[3] + 19), (building[2] - 15, building[3] + 12, building[2] + 32, building[3] + 24), (building[0] - 36, building[3] - 8, building[0] - 8, building[3] + 6)]
    elif mode == "west_stacks":
        boxes = [(building[0] - 52, building[1] + 4, building[0] - 12, building[1] + 17), (building[0] - 46, building[3] - 12, building[0] - 10, building[3] + 2), (building[2] + 10, building[1] + 19, building[2] + 34, building[1] + 31)]
    else:
        boxes = [(building[0] - 42, building[1] + 8, building[0] - 12, building[1] + 22), (building[2] + 10, building[1] + 10, building[2] + 42, building[1] + 23), (building[0] + 13, building[3] + 9, building[0] + 48, building[3] + 20)]
    for box in boxes:
        draw.rectangle(box, fill=255)
    return boxes


def draw_trees(
    masks: dict[str, Image.Image],
    count: int,
    water_polygons: list[list[tuple[int, int]]],
    road_points: list[tuple[int, int]],
    building: tuple[int, int, int, int],
    rng: random.Random,
) -> None:
    trunk = ImageDraw.Draw(masks["tree_trunk"])
    crown = ImageDraw.Draw(masks["tree_crown"])
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 20:
        attempts += 1
        x = rng.randint(14, CANVAS_WIDTH - 14)
        y = rng.randint(10, CANVAS_HEIGHT - 14)
        if near_road((x, y), road_points, 15) or in_box((x, y), expand_box(building, 30)) or in_water((x, y), water_polygons):
            continue
        radius = rng.randint(9, 17)
        crown.ellipse((x - radius, y - radius, x + radius, y + radius), fill=255)
        trunk.rectangle((x - 2, y + radius - 4, x + 2, y + radius + 9), fill=255)
        placed += 1


def draw_rocks(
    masks: dict[str, Image.Image],
    count: int,
    water_polygons: list[list[tuple[int, int]]],
    road_points: list[tuple[int, int]],
    building: tuple[int, int, int, int],
    rng: random.Random,
) -> None:
    draw = ImageDraw.Draw(masks["rock"])
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 20:
        attempts += 1
        x = rng.randint(10, CANVAS_WIDTH - 10)
        y = rng.randint(8, CANVAS_HEIGHT - 8)
        if near_road((x, y), road_points, 10) or in_box((x, y), expand_box(building, 20)) or in_water((x, y), water_polygons):
            continue
        rx = rng.randint(4, 8)
        ry = rng.randint(3, 6)
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=255)
        placed += 1


def build_condition_preview(masks: dict[str, Image.Image]) -> Image.Image:
    preview = Image.new("RGB", (CANVAS_WIDTH, CANVAS_HEIGHT), "#75a764")
    overlays = [
        ("water_body", "#2f89a8", 210),
        ("shoreline", "#8dbb74", 160),
        ("road_edge", "#c49954", 155),
        ("road_center", "#e5bd70", 220),
        ("walkable", "#d3a05b", 90),
        ("shelter_foundation", "#866340", 210),
        ("shelter_wall", "#a78f6d", 230),
        ("shelter_roof", "#805034", 230),
        ("construction_material", "#b87937", 230),
        ("rock", "#a2a8a0", 230),
        ("tree_trunk", "#755136", 230),
        ("tree_crown", "#2e7340", 210),
    ]
    for name, color, alpha in overlays:
        layer = Image.new("RGB", (CANVAS_WIDTH, CANVAS_HEIGHT), color)
        preview.paste(layer, mask=masks[name].point(lambda value: min(value, alpha)))
    return preview


def build_pair_sheet(target_path: Path, generated_path: Path, structure_path: Path, sample_id: str, output_path: Path) -> None:
    gap = 12
    label_height = 24
    sheet = Image.new("RGB", (CANVAS_WIDTH * 3 + gap * 4, CANVAS_HEIGHT + label_height + gap * 2), "#071510")
    draw = ImageDraw.Draw(sheet)
    labels = ("condition target", "local model generated", "structure preview")
    paths = (target_path, generated_path, structure_path)
    for index, (label, image_path) in enumerate(zip(labels, paths)):
        x = gap + index * (CANVAS_WIDTH + gap)
        draw.text((x, gap), f"{sample_id[:30]} / {label}", fill="#dff8e6")
        with Image.open(image_path) as image:
            sheet.paste(image.convert("RGB"), (x, gap + label_height))
    sheet.save(output_path)


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> Path:
    gap = 12
    label_height = 26
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    row_count = max(1, math.ceil(len(rows) / columns))
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, row_count * cell_h + (row_count + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        col = index % columns
        line = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + line * (cell_h + gap)
        draw.text((x, y), f"{index + 1:02d} V61 diversity candidate", fill="#79f2a6")
        draw.text((x, y + 13), row["sampleId"][:36], fill="#dff8e6")
        with Image.open(row["generated"]) as image:
            sheet.paste(image.convert("RGB"), (x, y + label_height))
    sheet.save(output_path)
    return output_path


def write_index(dataset_root: Path, sample_ids: list[str]) -> None:
    indexes = dataset_root / "indexes"
    indexes.mkdir(parents=True, exist_ok=True)
    payload = {"schemaVersion": "dataset-index-v1", "split": "train", "sampleIds": sample_ids, "count": len(sample_ids)}
    write_json(indexes / "train.json", payload)
    write_json(indexes / "validation.json", {**payload, "split": "validation"})


def read_active_channels(mask_dir: Path) -> list[str]:
    active = []
    for name in V1_CONDITION_CHANNELS:
        with Image.open(mask_dir / f"{name}.png") as image:
            if image.convert("L").getbbox() is not None:
                active.append(name)
    return active


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def in_water(point: tuple[int, int], polygons: list[list[tuple[int, int]]]) -> bool:
    x, y = point
    for polygon in polygons:
        if point_in_polygon(x, y, polygon):
            return True
    return False


def point_in_polygon(x: int, y: int, polygon: list[tuple[int, int]]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / max(1, yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def near_road(point: tuple[int, int], road_points: list[tuple[int, int]], threshold: int) -> bool:
    return any(distance_to_segment(point, road_points[index], road_points[index + 1]) <= threshold for index in range(len(road_points) - 1))


def distance_to_segment(point: tuple[int, int], a: tuple[int, int], b: tuple[int, int]) -> float:
    px, py = point
    ax, ay = a
    bx, by = b
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def in_box(point: tuple[int, int], box: tuple[int, int, int, int]) -> bool:
    x, y = point
    return box[0] <= x <= box[2] and box[1] <= y <= box[3]


def expand_box(box: tuple[int, int, int, int], amount: int) -> tuple[int, int, int, int]:
    return (box[0] - amount, box[1] - amount, box[2] + amount, box[3] + amount)


def clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


if __name__ == "__main__":
    raise SystemExit(main())
