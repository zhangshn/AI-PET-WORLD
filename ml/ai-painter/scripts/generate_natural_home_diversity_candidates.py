from __future__ import annotations

from argparse import ArgumentParser
from dataclasses import dataclass
import json
import math
from pathlib import Path
import random
import shutil
import subprocess
import sys
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS


STYLE_SOURCE_IDS = (
    "natural-home-crop-v7-01-forest-grass-east",
    "natural-home-crop-v7-06-water-shore-clean",
    "natural-home-crop-v7-12-forest-stream-clean",
)


@dataclass(frozen=True)
class SceneSpec:
    sample_id: str
    seed: int
    water_mode: str
    road_mode: str
    tree_density: int
    rock_density: int
    style_source_id: str


def main() -> int:
    parser = ArgumentParser(description="Generate diverse natural-home condition scenes and render local model candidates.")
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v24-diversity-generation"))
    parser.add_argument("--expert-root", type=Path, default=Path(".runtime/ai-painter/natural-home-local-detail-v23-candidate-consolidation"))
    parser.add_argument("--direct-model-root", type=Path)
    parser.add_argument("--schema-version", default="natural-home-diversity-generation-v24")
    parser.add_argument("--stage-id", default="natural-home-v24-diversity-generation")
    parser.add_argument("--training-version", default="training-natural-home-local-details-v24-diversity-generation")
    parser.add_argument("--model-version", default="natural-home-local-detail-unet-v23-experts-used-for-v24-diversity")
    parser.add_argument("--sample-count", type=int, default=6)
    parser.add_argument("--sample-id-prefix", default="natural-home-v24-diverse")
    parser.add_argument("--patch-size", type=int, default=64)
    parser.add_argument("--stride", type=int, default=32)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    dataset_root = args.output_root / "dataset"
    inference_root = args.output_root / "inference"
    dataset_scene_root = dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    dataset_scene_root.mkdir(parents=True, exist_ok=True)
    inference_root.mkdir(parents=True, exist_ok=True)

    specs = build_scene_specs(args.sample_count, args.sample_id_prefix)
    style_profiles = build_style_profiles(args.expert_root, specs)
    (dataset_root / "style-profiles.json").write_text(
        json.dumps(style_profiles, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    rows: list[dict[str, Any]] = []
    for spec in specs:
        sample_dir = dataset_scene_root / spec.sample_id
        create_scene_sample(spec, sample_dir)
        render_output = render_candidate(
            dataset_root=dataset_root,
            expert_root=args.expert_root,
            direct_model_root=args.direct_model_root,
            output_root=inference_root / spec.sample_id,
            spec=spec,
            patch_size=args.patch_size,
            stride=args.stride,
        )
        rows.append(render_output)

    contact_sheet = build_contact_sheet(rows, args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": args.schema_version,
        "status": "needs_visual_quality_training",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "local_model_diversity_generation_only",
        "stageId": args.stage_id,
        "trainingVersion": args.training_version,
        "modelVersion": args.model_version,
        "sourceCount": len(rows),
        "sampleCount": len(rows),
        "datasetRoot": str(dataset_root.resolve()),
        "inferenceRoot": str(inference_root.resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "rows": rows,
        "note": (
            "This run generates new natural-home structure conditions, then renders hidden candidates with the "
            "configured local model root. These outputs are diversity candidates only and cannot enter /world "
            "without VisualJudge and ApprovedFrame."
        ),
    }
    (args.output_root / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def build_scene_specs(sample_count: int, sample_id_prefix: str) -> list[SceneSpec]:
    modes = [
        ("right_river", "southwest_to_north"),
        ("bottom_stream", "west_to_east"),
        ("left_pond", "northwest_loop"),
        ("diagonal_stream", "south_to_east"),
        ("corner_lake", "center_to_south"),
        ("right_river", "north_to_southwest"),
    ]
    specs: list[SceneSpec] = []
    for index in range(max(1, sample_count)):
        water_mode, road_mode = modes[index % len(modes)]
        specs.append(
            SceneSpec(
                sample_id=f"{sample_id_prefix}-{index + 1:02d}",
                seed=2400 + index * 37,
                water_mode=water_mode,
                road_mode=road_mode,
                tree_density=10 + (index % 4) * 3,
                rock_density=9 + (index % 3) * 4,
                style_source_id=STYLE_SOURCE_IDS[index % len(STYLE_SOURCE_IDS)],
            )
        )
    return specs


def create_scene_sample(spec: SceneSpec, sample_dir: Path) -> None:
    if sample_dir.exists():
        shutil.rmtree(sample_dir)
    masks_dir = sample_dir / "masks_v1"
    masks_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(spec.seed)

    masks = {name: Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0) for name in V1_CONDITION_CHANNELS}
    draw = {name: ImageDraw.Draw(image) for name, image in masks.items()}

    draw["grass"].rectangle((0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), fill=255)
    draw_depth(masks["depth"])
    water_polygons = draw_water(draw["water_body"], spec.water_mode, rng)
    masks["shoreline"] = shoreline_from_water(masks["water_body"])
    draw["shoreline"] = ImageDraw.Draw(masks["shoreline"])
    road_points = road_points_for(spec.road_mode)
    draw_road(masks, road_points)
    draw_walkable(draw["walkable"], road_points)
    draw_trees(masks, spec.tree_density, water_polygons, road_points, rng)
    draw_rocks(masks, spec.rock_density, water_polygons, road_points, rng)

    for name in ("shelter_foundation", "shelter_wall", "shelter_roof", "construction_material"):
        masks[name] = Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0)

    for name, image in masks.items():
        image.save(masks_dir / f"{name}.png")

    preview = build_condition_preview(masks)
    preview.save(sample_dir / "target.png")
    preview.save(sample_dir / "condition-preview.png")
    (sample_dir / "blueprint.v1.json").write_text(
        json.dumps(build_blueprint(spec, water_polygons, road_points), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (sample_dir / "metadata.json").write_text(
        json.dumps(
            {
                "schemaVersion": "natural-home-diversity-sample-metadata-v1",
                "sampleId": spec.sample_id,
                "seed": spec.seed,
                "styleSourceId": spec.style_source_id,
                "generatedBy": "project_local_scene_blueprint_generator",
                "displayAllowed": False,
                "canPromoteToWorld": False,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def draw_depth(depth: Image.Image) -> None:
    pixels = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH), dtype=np.uint8)
    for y in range(CANVAS_HEIGHT):
        base = 60 + int(160 * (y / max(1, CANVAS_HEIGHT - 1)))
        pixels[y, :] = base
    depth.paste(Image.fromarray(pixels))


def draw_water(draw: ImageDraw.ImageDraw, mode: str, rng: random.Random) -> list[list[tuple[int, int]]]:
    polygons: list[list[tuple[int, int]]] = []
    if mode == "right_river":
        points = [(205, 0), (255, 0), (255, 191), (210, 191), (220, 145), (212, 106), (224, 66)]
    elif mode == "bottom_stream":
        points = [(0, 160), (255, 132), (255, 191), (0, 191)]
    elif mode == "left_pond":
        points = [(0, 88), (45, 72), (67, 112), (52, 154), (0, 168)]
    elif mode == "diagonal_stream":
        points = [(180, 0), (229, 0), (198, 70), (226, 124), (205, 191), (165, 191), (184, 124), (158, 73)]
    else:
        points = [(205, 118), (255, 105), (255, 191), (188, 191), (176, 157)]
    points = [(x + rng.randint(-4, 4), y + rng.randint(-4, 4)) for x, y in points]
    draw.polygon(points, fill=255)
    polygons.append(points)
    return polygons


def shoreline_from_water(water: Image.Image) -> Image.Image:
    dilated = water.filter(ImageFilter.MaxFilter(11))
    water_array = np.asarray(water, dtype=np.int16)
    shore = np.asarray(dilated, dtype=np.int16) - water_array
    return Image.fromarray(np.clip(shore, 0, 255).astype(np.uint8))


def road_points_for(mode: str) -> list[tuple[int, int]]:
    if mode == "southwest_to_north":
        return [(25, 191), (60, 151), (73, 111), (109, 78), (147, 43), (167, 0)]
    if mode == "west_to_east":
        return [(0, 145), (43, 129), (88, 118), (132, 112), (187, 113), (255, 96)]
    if mode == "northwest_loop":
        return [(0, 48), (38, 64), (76, 57), (112, 82), (93, 120), (132, 157), (162, 191)]
    if mode == "south_to_east":
        return [(115, 191), (123, 154), (142, 119), (172, 92), (210, 78), (255, 73)]
    if mode == "center_to_south":
        return [(83, 0), (92, 48), (109, 89), (123, 121), (119, 160), (106, 191)]
    return [(151, 0), (133, 37), (121, 77), (94, 119), (61, 151), (38, 191)]


def draw_road(masks: dict[str, Image.Image], road_points: list[tuple[int, int]]) -> None:
    road_edge = Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0)
    road_center = Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0)
    ImageDraw.Draw(road_edge).line(road_points, fill=255, width=20, joint="curve")
    ImageDraw.Draw(road_center).line(road_points, fill=255, width=9, joint="curve")
    masks["road_edge"] = road_edge
    masks["road_center"] = road_center


def draw_walkable(draw: ImageDraw.ImageDraw, road_points: list[tuple[int, int]]) -> None:
    draw.line(road_points, fill=255, width=24, joint="curve")
    draw.ellipse((74, 65, 183, 143), fill=170)


def draw_trees(
    masks: dict[str, Image.Image],
    count: int,
    water_polygons: list[list[tuple[int, int]]],
    road_points: list[tuple[int, int]],
    rng: random.Random,
) -> None:
    crown = ImageDraw.Draw(masks["tree_crown"])
    trunk = ImageDraw.Draw(masks["tree_trunk"])
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 30:
        attempts += 1
        x = rng.choice([rng.randint(10, 52), rng.randint(185, 244), rng.randint(20, 236)])
        y = rng.choice([rng.randint(8, 55), rng.randint(132, 180), rng.randint(20, 170)])
        if too_close_to_road((x, y), road_points, 18) or inside_water((x, y), water_polygons):
            continue
        rx = rng.randint(10, 17)
        ry = rng.randint(10, 18)
        crown.ellipse((x - rx, y - ry, x + rx, y + ry), fill=255)
        trunk.rectangle((x - 2, y + ry - 4, x + 3, y + ry + 8), fill=255)
        placed += 1


def draw_rocks(
    masks: dict[str, Image.Image],
    count: int,
    water_polygons: list[list[tuple[int, int]]],
    road_points: list[tuple[int, int]],
    rng: random.Random,
) -> None:
    draw = ImageDraw.Draw(masks["rock"])
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 25:
        attempts += 1
        x = rng.randint(12, CANVAS_WIDTH - 16)
        y = rng.randint(12, CANVAS_HEIGHT - 16)
        if too_close_to_road((x, y), road_points, 11) or inside_water((x, y), water_polygons):
            continue
        rx = rng.randint(4, 10)
        ry = rng.randint(3, 8)
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=255)
        placed += 1


def too_close_to_road(point: tuple[int, int], road_points: list[tuple[int, int]], distance: int) -> bool:
    px, py = point
    return any(distance_to_segment(px, py, ax, ay, bx, by) < distance for (ax, ay), (bx, by) in zip(road_points, road_points[1:]))


def distance_to_segment(px: int, py: int, ax: int, ay: int, bx: int, by: int) -> float:
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / float(dx * dx + dy * dy)))
    cx = ax + t * dx
    cy = ay + t * dy
    return math.hypot(px - cx, py - cy)


def inside_water(point: tuple[int, int], water_polygons: list[list[tuple[int, int]]]) -> bool:
    x, y = point
    for polygon in water_polygons:
        min_x = min(px for px, _ in polygon)
        max_x = max(px for px, _ in polygon)
        min_y = min(py for _, py in polygon)
        max_y = max(py for _, py in polygon)
        if min_x <= x <= max_x and min_y <= y <= max_y:
            return True
    return False


def build_condition_preview(masks: dict[str, Image.Image]) -> Image.Image:
    preview = Image.new("RGB", (CANVAS_WIDTH, CANVAS_HEIGHT), "#72a866")
    paste_mask(preview, masks["grass"], "#78b86c", 190)
    paste_mask(preview, masks["water_body"], "#2c8fac", 230)
    paste_mask(preview, masks["shoreline"], "#927046", 140)
    paste_mask(preview, masks["road_edge"], "#af8b47", 130)
    paste_mask(preview, masks["road_center"], "#d8b55a", 210)
    paste_mask(preview, masks["tree_crown"], "#1f6e3d", 230)
    paste_mask(preview, masks["tree_trunk"], "#86542c", 230)
    paste_mask(preview, masks["rock"], "#8a9186", 230)
    return preview


def paste_mask(preview: Image.Image, mask: Image.Image, color: str, alpha: int) -> None:
    overlay = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), color)
    overlay.putalpha(mask.point(lambda value: alpha if value > 0 else 0))
    preview.paste(overlay.convert("RGB"), (0, 0), overlay)


def build_blueprint(
    spec: SceneSpec,
    water_polygons: list[list[tuple[int, int]]],
    road_points: list[tuple[int, int]],
) -> dict[str, Any]:
    return {
        "schemaVersion": "world-blueprint-v1",
        "sceneId": spec.sample_id,
        "width": CANVAS_WIDTH,
        "height": CANVAS_HEIGHT,
        "seed": spec.seed,
        "generationRole": "natural_home_diversity_condition",
        "terrainRegions": [
            {"id": "grass-main", "terrain": "grass", "polygon": [[0, 0], [CANVAS_WIDTH - 1, 0], [CANVAS_WIDTH - 1, CANVAS_HEIGHT - 1], [0, CANVAS_HEIGHT - 1]]},
            *[
                {"id": f"water-{index + 1}", "terrain": "water_body", "polygon": [[x, y] for x, y in polygon]}
                for index, polygon in enumerate(water_polygons)
            ],
        ],
        "roads": [{"id": "road-main", "points": [[x, y] for x, y in road_points], "width": 20}],
        "objects": {
            "allowed": ["tree", "rock", "shoreline", "road"],
            "forbiddenForThisStage": ["building", "butler", "animal", "town", "city"],
        },
        "styleSourceId": spec.style_source_id,
    }


def build_style_profiles(expert_root: Path, specs: list[SceneSpec]) -> dict[str, dict[str, list[float]]]:
    profile_by_source: dict[str, dict[str, list[float]]] = {}
    for style_source_id in STYLE_SOURCE_IDS:
        profile_path = expert_root / "datasets" / style_source_id / "style-profiles.json"
        if profile_path.exists():
            raw = json.loads(profile_path.read_text(encoding="utf-8"))
            profile_by_source[style_source_id] = raw.get(style_source_id, {})
    return {spec.sample_id: profile_by_source.get(spec.style_source_id, {}) for spec in specs}


def render_candidate(
    dataset_root: Path,
    expert_root: Path,
    direct_model_root: Path | None,
    output_root: Path,
    spec: SceneSpec,
    patch_size: int,
    stride: int,
) -> dict[str, Any]:
    script = Path("ml/ai-painter/scripts/compose_natural_home_single_source_local_detail.py")
    model_root = direct_model_root if direct_model_root is not None else expert_root / "training" / spec.style_source_id
    command = [
        sys.executable,
        str(script),
        "--dataset-root",
        str(dataset_root),
        "--source-id",
        spec.sample_id,
        "--model-root",
        str(model_root),
        "--output-root",
        str(output_root),
        "--patch-size",
        str(patch_size),
        "--stride",
        str(stride),
        "--style-profile",
        str(dataset_root / "style-profiles.json"),
        "--condition-source-id",
        spec.style_source_id,
    ]
    completed = subprocess.run(command, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    latest = json.loads((output_root / "latest.json").read_text(encoding="utf-8"))
    return {
        "sourceId": spec.sample_id,
            "styleSourceId": spec.style_source_id,
            "status": "needs_visual_quality_training",
            "diagnosisStatus": "synthetic_condition_no_target_quality_review_required",
            "displayAllowed": False,
        "generated": latest.get("generated"),
        "target": latest.get("target"),
        "contactSheet": latest.get("contactSheet"),
        "blueprint": str((dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / spec.sample_id / "blueprint.v1.json").resolve()),
        "stdoutTail": completed.stdout[-1000:],
            "trainSampleCount": None,
            "validationSampleCount": None,
            "note": "No pixel target comparison is used for synthetic diversity outputs. This row proves generation-chain execution only and still needs visual-quality training.",
        }


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> Path:
    thumbs: list[tuple[str, Image.Image]] = []
    for row in rows:
        image_path = Path(str(row["generated"]))
        with Image.open(image_path) as image:
            thumbs.append((str(row["sourceId"]), image.convert("RGB")))
    gap = 12
    label_height = 22
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    sheet_w = columns * cell_w + (columns + 1) * gap
    rows_count = math.ceil(len(thumbs) / columns)
    sheet_h = rows_count * cell_h + (rows_count + 1) * gap
    sheet = Image.new("RGB", (sheet_w, sheet_h), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, (sample_id, image) in enumerate(thumbs):
        col = index % columns
        row = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        draw.text((x, y), sample_id, fill="#dff8e6")
        sheet.paste(image, (x, y + label_height))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return output_path


if __name__ == "__main__":
    raise SystemExit(main())
