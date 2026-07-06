from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
from datetime import UTC, datetime
from hashlib import sha256
import json
from math import hypot
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.blueprint.v1_validator import validate_v1_blueprint_data


SCHEMA_VERSION = "natural-home-v120-complete-game-world-frame-source-dataset-v1"
STAGE_ID = "natural-home-v120-complete-game-world-frame-source-dataset"
STYLE_ID = "bright-healing-complete-game-world-pixel-v0"

GAME_WORLD_INTENT = {
    "scope": "complete_natural_home_mvp",
    "frameRole": "primary_world_view",
    "runtimeFrameSource": True,
    "tags": [
        "complete_natural_home_mvp",
        "primary_world_view",
        "runtime_frame_source",
        "complete_game_world_frame_source",
        "full_view_not_crop",
    ],
    "anchors": [
        "world_entry",
        "primary_path",
        "natural_boundary",
        "water_feature",
        "exploration_area",
        "visual_center",
        "home_or_work_center",
    ],
    "note": (
        "V120 source frames are complete game-world reference sources for local model training. "
        "They are source targets and condition data only. They are not generated candidates, "
        "not ApprovedFrames, and must not be shown directly in /world."
    ),
}

SOURCE_POLICY = {
    "selectedFor": STAGE_ID,
    "completeWorldConditionSource": True,
    "completeGameWorldFrameSource": True,
    "requiresModelGeneration": False,
    "displayAllowed": False,
    "canPromoteToWorld": False,
    "notApprovedFrame": True,
    "notRuntimeFrame": True,
    "sourceUse": "training_source_only",
}


def rect(item_id: str, item_type: str, x: int, y: int, width: int, height: int, layer: int) -> dict[str, Any]:
    x = max(0, min(CANVAS_WIDTH - 1, x))
    y = max(0, min(CANVAS_HEIGHT - 1, y))
    width = max(1, min(width, CANVAS_WIDTH - x))
    height = max(1, min(height, CANVAS_HEIGHT - y))
    return structure(item_id, item_type, {"kind": "rect", "x": x, "y": y, "width": width, "height": height}, layer)


def polygon(item_id: str, item_type: str, points: list[list[int]], layer: int) -> dict[str, Any]:
    bounded = [[max(0, min(CANVAS_WIDTH - 1, x)), max(0, min(CANVAS_HEIGHT - 1, y))] for x, y in points]
    return structure(item_id, item_type, {"kind": "polygon", "points": bounded}, layer)


def line(item_id: str, item_type: str, points: list[list[int]], width: int, layer: int) -> dict[str, Any]:
    bounded = [[max(0, min(CANVAS_WIDTH - 1, x)), max(0, min(CANVAS_HEIGHT - 1, y))] for x, y in points]
    return structure(item_id, item_type, {"kind": "polyline", "points": bounded, "lineWidth": width}, layer)


def structure(item_id: str, item_type: str, geometry: dict[str, Any], layer: int) -> dict[str, Any]:
    value: dict[str, Any] = {"id": item_id, "type": item_type, "geometry": geometry, "layer": layer}
    if item_type == "depth":
        value["depthValue"] = 128
    return value


def depth_band(item_id: str, y0: int, y1: int, value: int, layer: int) -> dict[str, Any]:
    item = polygon(item_id, "depth", [[0, y0], [255, y0], [255, y1], [0, y1]], layer)
    item["depthValue"] = value
    return item


def box_polygon(item_id: str, item_type: str, x: int, y: int, width: int, height: int, layer: int) -> dict[str, Any]:
    inset = max(1, min(4, width // 6, height // 6))
    return polygon(
        item_id,
        item_type,
        [
            [x + inset, y],
            [x + width - inset, y],
            [x + width, y + inset],
            [x + width, y + height - inset],
            [x + width - inset, y + height],
            [x + inset, y + height],
            [x, y + height - inset],
            [x, y + inset],
        ],
        layer,
    )


def road(points: list[list[int]], width: int) -> list[dict[str, Any]]:
    left, right = offset_polyline(points, max(2.0, width / 2))
    return [
        line("road-edge-left", "road_edge", left, 2, 10),
        line("road-edge-right", "road_edge", right, 2, 10),
        line("road-center-main", "road_center", points, 3, 11),
        line("walkable-road", "walkable", points, width, 12),
    ]


def offset_polyline(points: list[list[int]], distance: float) -> tuple[list[list[int]], list[list[int]]]:
    left: list[list[int]] = []
    right: list[list[int]] = []
    for index, (x, y) in enumerate(points):
        before = points[max(0, index - 1)]
        after = points[min(len(points) - 1, index + 1)]
        dx, dy = after[0] - before[0], after[1] - before[1]
        length = hypot(dx, dy) or 1.0
        nx, ny = -dy / length * distance, dx / length * distance
        left.append([round(x + nx), round(y + ny)])
        right.append([round(x - nx), round(y - ny)])
    return left, right


def shelter(x: int, y: int, width: int, height: int, roof: bool) -> list[dict[str, Any]]:
    foundation_y = y + height - max(8, height // 4)
    values = [
        box_polygon("shelter-foundation-main", "shelter_foundation", x, foundation_y, width, max(8, height // 4), 50),
        box_polygon("shelter-wall-main", "shelter_wall", x, y + max(5, height // 5), width, max(8, height * 3 // 5), 51),
    ]
    if roof:
        values.append(box_polygon("shelter-roof-main", "shelter_roof", x, y, width, max(8, height // 3), 52))
    return values


def water(points: list[list[int]], shores: list[list[list[int]]]) -> list[dict[str, Any]]:
    values = [polygon("water-main", "water_body", points, 20)]
    values.extend(line(f"shoreline-{index}", "shoreline", shore, 5, 21) for index, shore in enumerate(shores, 1))
    return values


def boxes(item_type: str, items: list[tuple[int, int, int, int]], layer: int) -> list[dict[str, Any]]:
    return [box_polygon(f"{item_type}-{index}", item_type, x, y, w, h, layer) for index, (x, y, w, h) in enumerate(items, 1)]


def tree_boxes(items: list[tuple[int, int, int, int]]) -> list[dict[str, Any]]:
    values = boxes("tree_crown", items, 40)
    for index, (x, y, w, h) in enumerate(items, 1):
        values.append(rect(f"tree-trunk-{index}", "tree_trunk", x + w // 2 - 2, min(185, y + h - 9), 5, 9, 39))
    return values


def build_blueprint(scene_id: str, spec: dict[str, Any], original_path: Path) -> dict[str, Any]:
    structures: list[dict[str, Any]] = [
        polygon("grass-main", "grass", [[0, 0], [255, 0], [255, 191], [0, 191]], 1),
        depth_band("depth-background", 0, 63, 70, 2),
        depth_band("depth-midground", 64, 133, 145, 3),
        depth_band("depth-foreground", 134, 191, 220, 4),
    ]
    structures.extend(road(spec["road"], spec.get("roadWidth", 10)))
    structures.extend(shelter(*spec["shelter"], spec.get("roof", False)))
    if "water" in spec:
        structures.extend(water(spec["water"], spec.get("shore", [])))
    structures.extend(boxes("construction_material", spec.get("materials", []), 70))
    structures.extend(tree_boxes(spec.get("trees", [])))
    structures.extend(boxes("rock", spec.get("rocks", []), 45))
    for index, points in enumerate(spec.get("grassPatches", []), 1):
        structures.append(polygon(f"grass-patch-{index}", "grass", points, 5))

    return {
        "schemaVersion": "world-blueprint-v1",
        "sceneId": scene_id,
        "width": CANVAS_WIDTH,
        "height": CANVAS_HEIGHT,
        "seed": int(spec["seed"]),
        "styleId": STYLE_ID,
        "structures": structures,
        "gameWorldFrameIntent": GAME_WORLD_INTENT,
        "runtimeFrameIntent": GAME_WORLD_INTENT,
        "sourcePolicy": SOURCE_POLICY,
        "sourceOriginal": {
            "path": str(original_path.resolve()),
            "sha256": sha256_file(original_path),
            "license": "project-owned-or-owner-authorized-training-source",
        },
    }


SCENES: dict[str, dict[str, Any]] = {
    "01-timber-shelter-site": {
        "seed": 1201,
        "source": "01-timber-shelter-site.png",
        "road": [[37, 0], [48, 32], [39, 65], [52, 105], [70, 144], [77, 191]],
        "shelter": (91, 73, 58, 43),
        "materials": [(47, 75, 27, 20), (146, 82, 39, 17), (151, 105, 31, 13)],
        "trees": [(0, 0, 45, 42), (199, 0, 57, 49), (0, 143, 50, 49), (210, 139, 46, 52)],
        "rocks": [(41, 15, 18, 14), (174, 24, 18, 14), (214, 137, 16, 14), (65, 155, 16, 13)],
    },
    "02-stone-cottage-site": {
        "seed": 1202,
        "source": "02-stone-cottage-site.png",
        "road": [[6, 108], [43, 93], [80, 86], [110, 62], [121, 25], [132, 0]],
        "shelter": (102, 54, 62, 58),
        "roof": True,
        "materials": [(68, 80, 31, 18), (164, 81, 31, 17), (174, 105, 25, 15)],
        "trees": [(0, 0, 46, 42), (207, 0, 49, 46), (0, 145, 52, 47), (210, 143, 46, 49)],
        "rocks": [(30, 16, 16, 12), (77, 122, 17, 14), (178, 20, 17, 13)],
    },
    "03-river-bridge-site": {
        "seed": 1203,
        "source": "03-river-bridge-site.png",
        "road": [[64, 191], [83, 148], [96, 115], [120, 86], [153, 57], [194, 28], [230, 0]],
        "shelter": (156, 55, 50, 38),
        "water": [[0, 0], [98, 0], [114, 38], [145, 69], [183, 90], [255, 105], [255, 191], [100, 191], [83, 152], [61, 123], [28, 107], [0, 103]],
        "shore": [[[98, 0], [114, 38], [145, 69], [183, 90], [255, 105]], [[0, 103], [28, 107], [61, 123], [83, 152], [100, 191]]],
        "materials": [(177, 50, 28, 14), (195, 77, 28, 14)],
        "trees": [(0, 0, 42, 42), (209, 0, 47, 43), (0, 145, 47, 47), (211, 145, 45, 47)],
        "rocks": [(17, 39, 16, 13), (105, 22, 18, 14), (223, 126, 16, 14)],
    },
    "04-forest-workshop-site": {
        "seed": 1204,
        "source": "04-forest-workshop-site.png",
        "road": [[196, 0], [180, 36], [150, 65], [126, 91], [112, 123], [108, 157], [111, 191]],
        "shelter": (98, 60, 70, 54),
        "materials": [(68, 80, 30, 18), (168, 81, 36, 18), (176, 106, 29, 14)],
        "trees": [(0, 0, 50, 45), (205, 0, 51, 47), (0, 143, 53, 49), (207, 139, 49, 53)],
        "rocks": [(35, 18, 18, 14), (183, 29, 17, 13), (191, 135, 17, 14)],
    },
    "05-lakeside-dock-site": {
        "seed": 1205,
        "source": "05-lakeside-dock-site.png",
        "road": [[30, 0], [42, 35], [49, 72], [72, 105], [112, 130], [150, 153], [164, 191]],
        "shelter": (90, 71, 55, 43),
        "water": [[155, 0], [255, 0], [255, 191], [143, 191], [139, 151], [152, 118], [163, 84], [158, 43]],
        "shore": [[[155, 0], [158, 43], [163, 84], [152, 118], [139, 151], [143, 191]]],
        "materials": [(52, 86, 30, 17), (138, 90, 31, 16), (151, 113, 25, 14)],
        "trees": [(0, 0, 48, 47), (208, 0, 48, 44), (0, 142, 52, 50), (211, 143, 45, 49)],
        "rocks": [(34, 27, 17, 14), (178, 36, 17, 13), (199, 131, 16, 14)],
    },
    "06-meadow-roadworks": {
        "seed": 1206,
        "source": "06-meadow-roadworks.png",
        "road": [[196, 0], [188, 39], [174, 68], [149, 88], [119, 101], [88, 124], [67, 154], [55, 191]],
        "shelter": (105, 60, 50, 39),
        "materials": [(72, 78, 31, 17), (160, 75, 31, 17), (167, 101, 30, 14)],
        "trees": [(0, 0, 50, 45), (206, 0, 50, 45), (0, 143, 51, 49), (211, 143, 45, 49)],
        "rocks": [(50, 25, 17, 14), (183, 25, 18, 14), (183, 132, 16, 14)],
    },
    "07-cliff-retaining-wall-site": {
        "seed": 1207,
        "source": "07-cliff-retaining-wall-site.png",
        "road": [[104, 191], [109, 151], [112, 118], [104, 90], [98, 60], [106, 27], [121, 0]],
        "shelter": (125, 57, 74, 52),
        "materials": [(96, 86, 28, 17), (198, 79, 30, 17), (197, 105, 31, 15)],
        "trees": [(0, 0, 48, 44), (206, 0, 50, 45), (0, 145, 49, 47), (210, 143, 46, 49)],
        "rocks": [(21, 23, 23, 18), (68, 78, 25, 20), (190, 25, 18, 14)],
    },
    "08-stream-confluence-settlement": {
        "seed": 1208,
        "source": "08-stream-confluence-settlement.png",
        "road": [[199, 0], [188, 37], [169, 63], [146, 84], [125, 105], [118, 134], [123, 162], [130, 191]],
        "shelter": (99, 68, 58, 46),
        "water": [[214, 0], [255, 0], [255, 191], [197, 191], [204, 150], [215, 116], [229, 81], [222, 42]],
        "shore": [[[214, 0], [222, 42], [229, 81], [215, 116], [204, 150], [197, 191]]],
        "materials": [(65, 88, 30, 17), (158, 83, 30, 17), (165, 108, 29, 14)],
        "trees": [(0, 0, 47, 44), (207, 0, 49, 43), (0, 143, 52, 49), (211, 140, 45, 52)],
        "rocks": [(44, 20, 17, 13), (178, 28, 17, 14), (202, 128, 16, 14)],
    },
    "09-orchard-shed-site": {
        "seed": 1209,
        "source": "09-orchard-shed-site.png",
        "road": [[18, 146], [52, 127], [82, 102], [111, 81], [144, 66], [188, 45], [229, 0]],
        "shelter": (30, 58, 60, 50),
        "roof": True,
        "water": [[214, 0], [255, 0], [255, 191], [219, 191], [210, 147], [216, 100], [225, 53]],
        "shore": [[[214, 0], [225, 53], [216, 100], [210, 147], [219, 191]]],
        "materials": [(16, 103, 25, 15), (93, 80, 29, 16), (99, 105, 30, 15)],
        "trees": [(0, 0, 46, 44), (202, 0, 54, 45), (0, 142, 52, 50), (210, 141, 46, 51)],
        "rocks": [(64, 29, 16, 13), (167, 31, 17, 13), (189, 132, 17, 14)],
    },
    "10-wetland-boardwalk-site": {
        "seed": 1210,
        "source": "10-wetland-boardwalk-site.png",
        "road": [[99, 191], [105, 152], [116, 118], [141, 88], [177, 63], [212, 39], [246, 0]],
        "shelter": (150, 45, 48, 38),
        "water": [[0, 0], [130, 0], [137, 45], [128, 78], [142, 110], [177, 132], [255, 145], [255, 191], [0, 191]],
        "shore": [[[130, 0], [137, 45], [128, 78], [142, 110], [177, 132], [255, 145]]],
        "materials": [(179, 42, 27, 14), (181, 66, 31, 16)],
        "trees": [(0, 0, 41, 42), (214, 0, 42, 39), (0, 147, 43, 45), (215, 145, 41, 47)],
        "rocks": [(24, 18, 17, 14), (107, 25, 15, 12), (220, 119, 17, 14)],
    },
    "11-woodland-quarry-yard": {
        "seed": 1211,
        "source": "11-woodland-quarry-yard.png",
        "road": [[127, 191], [125, 151], [111, 123], [95, 106], [93, 83], [105, 55], [122, 0]],
        "shelter": (139, 62, 62, 47),
        "materials": [(99, 78, 31, 17), (200, 77, 32, 17), (199, 104, 32, 16)],
        "trees": [(0, 0, 49, 46), (207, 0, 49, 43), (0, 142, 53, 50), (210, 141, 46, 51)],
        "rocks": [(33, 18, 24, 18), (69, 88, 32, 24), (88, 117, 20, 17), (178, 30, 18, 14)],
    },
    "12-village-gate-site": {
        "seed": 1212,
        "source": "12-village-gate-site.png",
        "road": [[194, 0], [183, 38], [164, 62], [144, 82], [128, 103], [127, 127], [137, 153], [143, 191]],
        "shelter": (105, 60, 50, 36),
        "materials": [(70, 78, 29, 16), (159, 75, 28, 16), (166, 99, 32, 16)],
        "trees": [(0, 0, 47, 44), (209, 0, 47, 43), (0, 143, 52, 49), (211, 140, 45, 52)],
        "rocks": [(43, 20, 17, 13), (178, 28, 17, 14), (202, 128, 16, 14)],
    },
}


def main() -> int:
    parser = ArgumentParser(description="Prepare V120 complete game-world frame source dataset.")
    parser.add_argument("--source-root", type=Path, default=Path("data/ai-painter-source-originals/engineering-batch-01"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v120-complete-game-world-frame-source-dataset"))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)
    scene_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"

    rows: list[dict[str, Any]] = []
    for scene_id, spec in SCENES.items():
        original_path = args.source_root / str(spec["source"])
        if not original_path.is_file():
            raise ValueError(f"missing source image: {original_path}")
        sample_dir = scene_root / scene_id
        sample_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original_path, sample_dir / "source-original.png")
        with Image.open(original_path) as source:
            target = source.convert("RGB").resize((CANVAS_WIDTH, CANVAS_HEIGHT), Image.Resampling.LANCZOS)
        target.save(sample_dir / "target.png", "PNG", optimize=True)

        blueprint = build_blueprint(scene_id, spec, original_path)
        errors = validate_v1_blueprint_data(blueprint)
        if errors:
            raise ValueError(f"{scene_id}: {'; '.join(errors)}")
        blueprint_path = sample_dir / "blueprint.v1.json"
        write_json(blueprint_path, blueprint)
        masks = render_v1_masks_from_file(blueprint_path, sample_dir / "masks_v1")

        metadata = {
            "schemaVersion": "natural-home-v120-source-metadata-v1",
            "sampleId": scene_id,
            "stageId": STAGE_ID,
            "createdAt": datetime.now(UTC).isoformat(),
            "sourceOriginal": {
                "fileName": str(spec["source"]),
                "path": str(original_path.resolve()),
                "sha256": sha256_file(original_path),
            },
            "target": {
                "fileName": "target.png",
                "sha256": sha256_file(sample_dir / "target.png"),
                "width": CANVAS_WIDTH,
                "height": CANVAS_HEIGHT,
            },
            "maskCount": len(masks),
            "sourcePolicy": SOURCE_POLICY,
        }
        write_json(sample_dir / "metadata.json", metadata)
        rows.append(
            {
                "sampleId": scene_id,
                "target": str((sample_dir / "target.png").resolve()),
                "blueprint": str(blueprint_path.resolve()),
                "maskDir": str((sample_dir / "masks_v1").resolve()),
                "sourceOriginal": str(original_path.resolve()),
                "sourceSha256": sha256_file(original_path),
            }
        )

    train_ids = [row["sampleId"] for row in rows[:10]]
    validation_ids = [row["sampleId"] for row in rows[10:]]
    write_json(args.output_root / "indexes" / "train.json", {"schemaVersion": "dataset-index-v1", "split": "train", "sampleIds": train_ids})
    write_json(args.output_root / "indexes" / "validation.json", {"schemaVersion": "dataset-index-v1", "split": "validation", "sampleIds": validation_ids})

    contact_sheet = build_contact_sheet(args.output_root, [row["sampleId"] for row in rows], args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "status": "completed",
        "stageId": STAGE_ID,
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourceRoot": str(args.source_root.resolve()),
        "selectedSampleCount": len(rows),
        "trainCount": len(train_ids),
        "validationCount": len(validation_ids),
        "sourceFileCount": len(rows),
        "maskChannels": list(V1_CONDITION_CHANNELS),
        "sourcePolicy": SOURCE_POLICY,
        "gameWorldIntent": GAME_WORLD_INTENT,
        "contactSheet": str(contact_sheet.resolve()),
        "rows": rows,
        "policy": {
            "displayAllowed": False,
            "canPromoteToWorld": False,
            "purpose": (
                "V120 compiles complete game-world source frames for local model training. "
                "These records are not candidates, not ApprovedFrames, and not RuntimeFrames."
            ),
        },
        "sourceCoverage": dict(Counter(row["sampleId"].split("-", 1)[0] for row in rows)),
    }
    write_json(args.output_root / "dataset-manifest.json", manifest)
    write_json(args.output_root / "latest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def build_contact_sheet(output_root: Path, sample_ids: list[str], output_path: Path) -> Path:
    scale = 2
    gap = 10
    label_height = 20
    columns = 3
    cell_w = CANVAS_WIDTH * scale
    cell_h = CANVAS_HEIGHT * scale + label_height
    rows = max(1, (len(sample_ids) + columns - 1) // columns)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, sample_id in enumerate(sample_ids):
        target_path = output_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id / "target.png"
        with Image.open(target_path) as image:
            target = image.convert("RGB").resize((cell_w, CANVAS_HEIGHT * scale), Image.Resampling.NEAREST)
        col = index % columns
        row = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        draw.text((x, y), sample_id[:46], fill="#dff8e6")
        sheet.paste(target, (x, y + label_height))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return output_path


def sha256_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
