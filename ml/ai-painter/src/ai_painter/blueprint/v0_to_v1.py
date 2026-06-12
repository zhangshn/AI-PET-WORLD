from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from .channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_SCHEMA_VERSION, V0_SCHEMA_VERSION
from .schema import load_blueprint
from .v1_validator import validate_v1_blueprint_data


def convert_v0_file_to_v1(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    data = json.loads(raw.decode("utf-8"))
    blueprint = load_blueprint(path)
    result = convert_v0_data_to_v1(data, sha256(raw).hexdigest())
    result["sceneId"] = blueprint.scene_id
    return result


def convert_v0_data_to_v1(data: dict[str, Any], source_hash: str) -> dict[str, Any]:
    if data.get("schemaVersion") != V0_SCHEMA_VERSION:
        raise ValueError("source blueprint must be world-blueprint-v0")
    structures: list[dict[str, Any]] = []
    reasons = ["v0 到 v1 的细分结构需要人工复核"]
    for region in data.get("terrainRegions", []):
        terrain = region.get("terrain")
        if terrain == "grass":
            structures.append(_polygon(f"grass-{region['id']}", "grass", region["polygon"], 10, region["id"]))
        elif terrain == "water":
            structures.append(_polygon(f"water-body-{region['id']}", "water_body", region["polygon"], 20, region["id"]))
            structures.append(_shoreline(region))
    for road in data.get("roads", []):
        structures.append(_polyline(f"road-center-{road['id']}", "road_center", road["points"], road["width"], 40, road["id"]))
        edge_width = max(road["width"] + 8, road["width"] * 2)
        structures.append(_polyline(
            f"road-edge-{road['id']}", "road_edge", road["points"], edge_width, 39, road["id"],
            True, ["v0 road 只有中心区域，道路边缘为确定性草案"],
        ))
    for item in data.get("objects", []):
        structures.extend(_convert_object(item))
    structures.extend(_derived_walkable_and_depth())
    reasons.append("construction_material 在 v0 中没有明确世界事实，需人工补充")
    result = {
        "schemaVersion": V1_SCHEMA_VERSION,
        "sceneId": data["sceneId"],
        "width": CANVAS_WIDTH,
        "height": CANVAS_HEIGHT,
        "seed": data["seed"],
        "styleId": data["styleId"],
        "sourceBlueprintVersion": V0_SCHEMA_VERSION,
        "sourceBlueprintHash": source_hash,
        "requiresManualReview": True,
        "manualReviewReasons": reasons,
        "structures": structures,
    }
    errors = validate_v1_blueprint_data(result)
    if errors:
        raise ValueError("; ".join(errors))
    return result


def _convert_object(item: dict[str, Any]) -> list[dict[str, Any]]:
    if item["kind"] == "tree":
        trunk_width = max(3, item["width"] // 5)
        trunk_height = max(4, item["height"] // 5)
        trunk_x = item["x"] + (item["width"] - trunk_width) // 2
        trunk_y = min(CANVAS_HEIGHT - trunk_height, item["y"] + item["height"] - trunk_height)
        return [
            _rect(f"tree-crown-{item['id']}", "tree_crown", item, 70, item["id"]),
            _rect_values(
                f"tree-trunk-{item['id']}", "tree_trunk", trunk_x, trunk_y, trunk_width, trunk_height, 69, item["id"],
                True, ["v0 tree 无法确认树干精确位置，按落地点生成草案"],
            ),
        ]
    if item["kind"] == "rock":
        return [_rect(f"rock-{item['id']}", "rock", item, 60, item["id"])]
    if item["kind"] == "shelter":
        wall_height = max(1, round(item["height"] * 0.58))
        roof_height = max(1, item["height"] - wall_height)
        return [
            _rect(f"shelter-foundation-{item['id']}", "shelter_foundation", item, 80, item["id"]),
            _rect_values(
                f"shelter-wall-{item['id']}", "shelter_wall", item["x"], item["y"] + roof_height,
                item["width"], wall_height, 82, item["id"], True,
                ["v0 shelter 无法确认墙体范围，按下半部生成草案"],
            ),
            _rect_values(
                f"shelter-roof-{item['id']}", "shelter_roof", item["x"], item["y"], item["width"], roof_height, 84,
                item["id"], True, ["v0 shelter 无法确认屋顶范围，按上半部生成草案"],
            ),
        ]
    return []


def _shoreline(region: dict[str, Any]) -> dict[str, Any]:
    x0, y0, x1, y1 = _points_bounds(region["polygon"])
    return _rect_values(
        f"shoreline-{region['id']}", "shoreline", max(0, x0 - 4), max(0, y0 - 4),
        min(CANVAS_WIDTH, x1 + 5) - max(0, x0 - 4), min(CANVAS_HEIGHT, y1 + 5) - max(0, y0 - 4),
        21, region["id"], True, ["v0 water 只有水体区域，岸线为边界膨胀草案"],
    )


def _derived_walkable_and_depth() -> list[dict[str, Any]]:
    return [
        _rect_values("walkable-derived-v0", "walkable", 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 5, None, True, ["v0 walkable 由结构推断，需人工复核可行走边界"]),
        {**_rect_values("depth-derived-v0", "depth", 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 1, None, True, ["v0 depth 为固定规则草案"]), "depthValue": 128},
    ]


def _polygon(structure_id: str, structure_type: str, points: list[list[int]], layer: int, source_id: str | None) -> dict[str, Any]:
    return {"id": structure_id, "type": structure_type, "geometry": {"kind": "polygon", "points": points}, "layer": layer, "sourceV0Id": source_id, "requiresManualReview": False, "manualReviewReasons": []}


def _polyline(structure_id: str, structure_type: str, points: list[list[int]], width: int, layer: int, source_id: str | None, review: bool = False, reasons: list[str] | None = None) -> dict[str, Any]:
    return {"id": structure_id, "type": structure_type, "geometry": {"kind": "polyline", "points": points, "lineWidth": width}, "layer": layer, "sourceV0Id": source_id, "requiresManualReview": review, "manualReviewReasons": reasons or []}


def _rect(structure_id: str, structure_type: str, item: dict[str, Any], layer: int, source_id: str | None) -> dict[str, Any]:
    return _rect_values(structure_id, structure_type, item["x"], item["y"], item["width"], item["height"], layer, source_id, False, [])


def _rect_values(structure_id: str, structure_type: str, x: int, y: int, width: int, height: int, layer: int, source_id: str | None, review: bool, reasons: list[str]) -> dict[str, Any]:
    value: dict[str, Any] = {"id": structure_id, "type": structure_type, "geometry": {"kind": "rect", "x": x, "y": y, "width": width, "height": height}, "layer": layer, "requiresManualReview": review, "manualReviewReasons": reasons}
    if source_id is not None:
        value["sourceV0Id"] = source_id
    return value


def _points_bounds(points: list[list[int]]) -> tuple[int, int, int, int]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)
