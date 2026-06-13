from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path

from ai_painter.blueprint.v1_masks import render_v1_masks_from_file
from ai_painter.blueprint.v1_validator import validate_v1_blueprint_data


REASON = "工程批次 01 依据原图逐场景重新标注，必须人工复核后才能训练"


def rect(item_id: str, item_type: str, x: int, y: int, width: int, height: int, layer: int) -> dict[str, object]:
    x = max(0, min(255, x))
    y = max(0, min(191, y))
    width = max(1, min(width, 256 - x))
    height = max(1, min(height, 192 - y))
    return structure(item_id, item_type, {"kind": "rect", "x": x, "y": y, "width": width, "height": height}, layer)


def polygon(item_id: str, item_type: str, points: list[list[int]], layer: int) -> dict[str, object]:
    bounded = [[max(0, min(255, x)), max(0, min(191, y))] for x, y in points]
    return structure(item_id, item_type, {"kind": "polygon", "points": bounded}, layer)


def line(item_id: str, item_type: str, points: list[list[int]], width: int, layer: int) -> dict[str, object]:
    bounded = [[max(0, min(255, x)), max(0, min(191, y))] for x, y in points]
    return structure(item_id, item_type, {"kind": "polyline", "points": bounded, "lineWidth": width}, layer)


def structure(item_id: str, item_type: str, geometry: dict[str, object], layer: int) -> dict[str, object]:
    value: dict[str, object] = {
        "id": item_id, "type": item_type, "geometry": geometry, "layer": layer,
        "requiresManualReview": True, "manualReviewReasons": [REASON],
    }
    if item_type == "depth":
        value["depthValue"] = 128
    return value


def base(scene_id: str, seed: int) -> list[dict[str, object]]:
    return [
        rect("grass-main", "grass", 0, 0, 256, 192, 1),
        rect("depth-main", "depth", 0, 0, 256, 192, 2),
    ]


def road(points: list[list[int]], width: int = 10) -> list[dict[str, object]]:
    return [
        line("road-edge-main", "road_edge", points, width + 6, 10),
        line("road-center-main", "road_center", points, width, 11),
        line("walkable-road", "walkable", points, width + 2, 12),
    ]


def shelter(x: int, y: int, width: int, height: int) -> list[dict[str, object]]:
    return [
        rect("shelter-foundation-main", "shelter_foundation", x, y + height - max(5, height // 4), width, max(5, height // 4), 50),
        rect("shelter-wall-main", "shelter_wall", x, y + max(4, height // 5), width, max(6, height * 3 // 5), 51),
        rect("shelter-roof-main", "shelter_roof", x, y, width, max(6, height // 3), 52),
    ]


def water_region(points: list[list[int]], shore_lines: list[list[list[int]]]) -> list[dict[str, object]]:
    values = [polygon("water-main", "water_body", points, 20)]
    values.extend(line(f"shoreline-{index}", "shoreline", item, 5, 21) for index, item in enumerate(shore_lines, 1))
    return values


def material_boxes(boxes: list[tuple[int, int, int, int]]) -> list[dict[str, object]]:
    return [rect(f"construction-material-{index}", "construction_material", *box, 70) for index, box in enumerate(boxes, 1)]


def object_boxes(item_type: str, boxes: list[tuple[int, int, int, int]], layer: int) -> list[dict[str, object]]:
    return [rect(f"{item_type}-{index}", item_type, *box, layer) for index, box in enumerate(boxes, 1)]


SCENES: dict[str, dict[str, object]] = {
    "scene-world-1-4f3fd5de": {
        "seed": 101, "road": [[104, 191], [104, 140], [82, 112], [87, 84], [55, 60], [18, 48]],
        "shelter": (88, 43, 72, 48),
        "materials": [(55, 50, 25, 18), (62, 78, 24, 14), (158, 64, 36, 17), (153, 88, 42, 14)],
        "trees": [(0, 0, 42, 38), (205, 0, 51, 48), (0, 143, 49, 49), (205, 139, 51, 53)],
        "rocks": [(41, 10, 15, 12), (165, 17, 14, 11), (212, 107, 13, 12)],
    },
    "scene-world-2-d16f635d": {
        "seed": 102, "road": [[141, 191], [137, 154], [116, 137], [82, 126], [68, 103], [76, 70], [92, 42], [114, 0]],
        "shelter": (96, 48, 76, 63),
        "materials": [(71, 77, 25, 14), (72, 105, 28, 14), (166, 88, 30, 20), (170, 113, 28, 16)],
        "trees": [(0, 0, 55, 45), (193, 0, 63, 50), (0, 145, 54, 47), (207, 135, 49, 57)],
        "rocks": [(31, 16, 18, 14), (172, 21, 18, 14), (191, 132, 16, 14)],
    },
    "scene-world-3-c3a70aac": {
        "seed": 103, "road": [[113, 191], [112, 150], [111, 124], [123, 101], [143, 79], [165, 58], [195, 40], [223, 0]],
        "shelter": (143, 43, 54, 45),
        "water": [[0, 0], [101, 0], [112, 38], [139, 75], [176, 101], [217, 114], [256, 119], [256, 192], [119, 192], [91, 158], [68, 126], [31, 111], [0, 106]],
        "shore": [[[101, 0], [112, 38], [139, 75], [176, 101], [217, 114], [255, 119]], [[0, 106], [31, 111], [68, 126], [91, 158], [119, 191]]],
        "materials": [(185, 43, 24, 12), (188, 63, 30, 12), (200, 82, 27, 16)],
        "trees": [(0, 0, 43, 44), (214, 0, 42, 42), (0, 145, 42, 47), (214, 147, 42, 45)],
        "rocks": [(12, 43, 15, 12), (92, 22, 16, 12), (225, 130, 17, 13)],
    },
    "scene-world-4-74fccaba": {
        "seed": 104, "road": [[119, 191], [121, 148], [113, 121], [107, 96], [103, 72], [103, 0]],
        "shelter": (78, 64, 73, 55),
        "materials": [(48, 71, 28, 17), (52, 102, 30, 14), (151, 77, 34, 18), (151, 105, 31, 15)],
        "trees": [(0, 0, 49, 46), (194, 0, 62, 51), (0, 141, 56, 51), (203, 137, 53, 55)],
        "rocks": [(55, 18, 14, 12), (174, 31, 16, 13), (184, 128, 15, 13)],
    },
    "scene-world-5-e1a539b7": {
        "seed": 105, "road": [[118, 191], [115, 150], [111, 119], [99, 95], [79, 70], [63, 42], [54, 0]],
        "shelter": (78, 50, 62, 47),
        "water": [[151, 0], [256, 0], [256, 192], [126, 192], [135, 154], [149, 127], [158, 94], [153, 55]],
        "shore": [[[151, 0], [153, 55], [158, 94], [149, 127], [135, 154], [126, 191]]],
        "materials": [(43, 75, 30, 16), (46, 102, 31, 14), (138, 67, 23, 14), (145, 100, 31, 15)],
        "trees": [(0, 0, 48, 48), (207, 0, 49, 45), (0, 142, 55, 50), (210, 143, 46, 49)],
        "rocks": [(33, 22, 16, 13), (177, 36, 17, 13), (195, 131, 16, 14)],
    },
    "scene-world-6-baed2f27": {
        "seed": 106, "road": [[200, 0], [190, 35], [177, 67], [183, 101], [196, 130], [205, 160], [209, 191]],
        "shelter": (52, 54, 61, 51),
        "materials": [(38, 91, 30, 17), (68, 111, 31, 14), (111, 79, 26, 15), (119, 105, 29, 15)],
        "trees": [(0, 0, 51, 46), (0, 143, 51, 49), (209, 0, 47, 39), (221, 145, 35, 47)],
        "rocks": [(35, 29, 16, 13), (143, 21, 18, 14), (155, 137, 19, 15)],
    },
    "scene-world-7-9eab6d8e": {
        "seed": 107, "road": [[116, 191], [119, 156], [120, 129], [111, 111], [100, 89], [93, 61], [100, 34], [113, 0]],
        "shelter": (89, 48, 91, 64),
        "water": [[0, 22], [25, 18], [37, 47], [29, 78], [40, 111], [26, 143], [49, 192], [0, 192]],
        "shore": [[[25, 18], [37, 47], [29, 78], [40, 111], [26, 143], [49, 191]]],
        "materials": [(76, 80, 25, 16), (75, 105, 27, 15), (179, 75, 27, 17), (174, 102, 34, 16)],
        "trees": [(0, 0, 36, 28), (207, 0, 49, 45), (0, 147, 39, 45), (206, 139, 50, 53)],
        "rocks": [(50, 21, 17, 13), (186, 20, 18, 14), (186, 129, 18, 15)],
    },
    "scene-world-stream-confluence-new-008": {
        "seed": 108, "road": [[74, 0], [69, 45], [75, 84], [98, 110], [140, 124], [171, 151], [174, 191]],
        "shelter": (120, 31, 69, 53),
        "water": [[0, 0], [39, 0], [35, 43], [45, 83], [75, 111], [107, 128], [133, 151], [145, 192], [88, 192], [78, 153], [55, 132], [25, 118], [0, 122]],
        "shore": [[[39, 0], [35, 43], [45, 83], [75, 111], [107, 128], [133, 151], [145, 191]], [[0, 122], [25, 118], [55, 132], [78, 153], [88, 191]]],
        "materials": [(101, 35, 20, 17), (102, 61, 24, 15), (187, 37, 27, 15), (185, 67, 35, 17), (174, 91, 37, 15)],
        "trees": [(0, 0, 42, 35), (209, 0, 47, 43), (0, 145, 49, 47), (211, 142, 45, 50)],
        "rocks": [(16, 17, 17, 14), (104, 16, 16, 13), (216, 113, 17, 15)],
    },
    "scene-world-9-1a418b26": {
        "seed": 109, "road": [[132, 191], [131, 147], [121, 124], [107, 105], [101, 79], [110, 46], [125, 0]],
        "shelter": (89, 54, 75, 58),
        "materials": [(58, 81, 29, 16), (62, 108, 31, 15), (165, 75, 31, 17), (166, 103, 35, 16)],
        "trees": [(0, 0, 49, 44), (205, 0, 51, 46), (0, 142, 51, 50), (207, 140, 49, 52)],
        "rocks": [(46, 20, 16, 13), (183, 24, 17, 13), (188, 132, 17, 14)],
    },
    "scene-world-10-fae3ae8f": {
        "seed": 110, "road": [[201, 0], [192, 39], [174, 65], [153, 86], [129, 102], [111, 124], [107, 154], [110, 191]],
        "shelter": (151, 42, 51, 45),
        "water": [[0, 0], [144, 0], [143, 47], [133, 79], [145, 110], [176, 132], [256, 144], [256, 192], [0, 192]],
        "shore": [[[144, 0], [143, 47], [133, 79], [145, 110], [176, 132], [255, 144]]],
        "materials": [(183, 35, 27, 14), (182, 63, 31, 16), (201, 90, 28, 15)],
        "trees": [(0, 0, 41, 42), (214, 0, 42, 39), (0, 147, 43, 45), (215, 145, 41, 47)],
        "rocks": [(24, 18, 17, 14), (107, 25, 15, 12), (220, 119, 17, 14)],
    },
    "scene-world-11-e0e7975b": {
        "seed": 111, "road": [[128, 191], [126, 151], [111, 123], [96, 106], [93, 83], [105, 55], [122, 0]],
        "shelter": (145, 51, 62, 52),
        "materials": [(117, 77, 28, 17), (118, 105, 31, 16), (205, 70, 27, 16), (204, 99, 31, 17)],
        "trees": [(0, 0, 49, 46), (207, 0, 49, 43), (0, 142, 53, 50), (210, 141, 46, 51)],
        "rocks": [(40, 21, 18, 15), (94, 42, 19, 16), (85, 117, 20, 17)],
    },
    "scene-world-12-5b4f2dac": {
        "seed": 112, "road": [[196, 0], [183, 38], [165, 62], [145, 81], [129, 101], [127, 127], [137, 153], [143, 191]],
        "shelter": (103, 51, 55, 45),
        "water": [[229, 122], [256, 116], [256, 192], [209, 192], [213, 160]],
        "shore": [[[229, 122], [213, 160], [209, 191]]],
        "materials": [(69, 73, 29, 16), (72, 101, 30, 15), (159, 70, 28, 16), (166, 99, 32, 16)],
        "trees": [(0, 0, 47, 44), (209, 0, 47, 43), (0, 143, 52, 49), (211, 140, 45, 52)],
        "rocks": [(43, 20, 17, 13), (178, 28, 17, 14), (202, 128, 16, 14)],
    },
}


def build(scene_id: str, spec: dict[str, object]) -> dict[str, object]:
    structures = base(scene_id, int(spec["seed"]))
    structures += road(spec["road"])
    structures += shelter(*spec["shelter"])
    if "water" in spec:
        structures += water_region(spec["water"], spec["shore"])
    structures += material_boxes(spec["materials"])
    structures += object_boxes("tree_crown", spec["trees"], 40)
    structures += object_boxes("tree_trunk", [
        (x + width // 2 - 2, min(188, y + height - 6), 4, 7) for x, y, width, height in spec["trees"]
    ], 39)
    structures += object_boxes("rock", spec["rocks"], 45)
    structures.append(rect("walkable-work-zone", "walkable", max(0, spec["shelter"][0] - 28), max(0, spec["shelter"][1] - 18), min(256 - max(0, spec["shelter"][0] - 28), spec["shelter"][2] + 56), min(192 - max(0, spec["shelter"][1] - 18), spec["shelter"][3] + 45), 13))
    return {
        "schemaVersion": "world-blueprint-v1", "sceneId": scene_id, "width": 256, "height": 192,
        "seed": int(spec["seed"]), "styleId": "bright-healing-topdown-pixel-v0",
        "requiresManualReview": True, "manualReviewReasons": [REASON], "structures": structures,
    }


def main() -> int:
    root = Path("data/ai-painter-datasets/accepted/dataset_v0/scene/world").resolve()
    results = []
    for scene_id, spec in SCENES.items():
        sample_dir = root / scene_id
        if not sample_dir.is_dir():
            raise ValueError(f"样本不存在: {scene_id}")
        if (sample_dir / "blueprint.v1.review.json").exists():
            raise ValueError(f"样本已经审核，禁止覆盖: {scene_id}")
        data = build(scene_id, spec)
        errors = validate_v1_blueprint_data(data)
        if errors:
            raise ValueError(f"{scene_id}: {'; '.join(errors)}")
        path = sample_dir / "blueprint.v1.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        masks = render_v1_masks_from_file(path, sample_dir / "masks_v1")
        record = {
            "schemaVersion": "blueprint-v1-manual-relabel-record-v0", "sampleId": scene_id,
            "status": "manual_relabel_requires_review", "blueprintHash": sha256(path.read_bytes()).hexdigest(),
            "targetImageHash": sha256((sample_dir / "target.png").read_bytes()).hexdigest(), "maskCount": len(masks),
        }
        (sample_dir / "migration.v1.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        results.append({"sampleId": scene_id, "structures": len(data["structures"]), "masks": len(masks)})
    print(json.dumps({"status": "completed", "count": len(results), "results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
