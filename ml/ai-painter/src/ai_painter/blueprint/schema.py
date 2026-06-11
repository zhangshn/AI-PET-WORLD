from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

ALLOWED_TERRAINS = {"grass", "water"}
ALLOWED_OBJECTS = {"tree", "rock", "shelter"}


@dataclass(frozen=True)
class Region:
    region_id: str
    terrain: str
    polygon: tuple[tuple[int, int], ...]


@dataclass(frozen=True)
class PathShape:
    path_id: str
    width: int
    points: tuple[tuple[int, int], ...]


@dataclass(frozen=True)
class WorldObject:
    object_id: str
    kind: str
    x: int
    y: int
    width: int
    height: int
    stage: int | None


@dataclass(frozen=True)
class Blueprint:
    schema_version: str
    scene_id: str
    width: int
    height: int
    seed: int
    style_id: str
    terrain_regions: tuple[Region, ...]
    roads: tuple[PathShape, ...]
    objects: tuple[WorldObject, ...]


def load_blueprint(path: Path) -> Blueprint:
    data = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_blueprint_data(data)
    if errors:
        raise ValueError("; ".join(errors))
    return parse_blueprint(data)


def validate_blueprint_data(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return ["blueprint must be a JSON object"]
    errors: list[str] = []
    width = data.get("width")
    height = data.get("height")
    if data.get("schemaVersion") != "world-blueprint-v0":
        errors.append("schemaVersion must be world-blueprint-v0")
    if not isinstance(data.get("sceneId"), str) or not data["sceneId"]:
        errors.append("sceneId is required")
    if width != 256 or height != 192:
        errors.append("v0 blueprint size must be 256x192")
    if not isinstance(data.get("seed"), int):
        errors.append("seed must be an integer")
    if not isinstance(data.get("styleId"), str) or not data["styleId"]:
        errors.append("styleId is required")
    errors.extend(_validate_regions(data.get("terrainRegions"), width, height))
    errors.extend(_validate_roads(data.get("roads"), width, height))
    errors.extend(_validate_objects(data.get("objects"), width, height))
    errors.extend(_validate_unique_ids(data))
    return errors


def parse_blueprint(data: dict[str, Any]) -> Blueprint:
    return Blueprint(
        schema_version=data["schemaVersion"],
        scene_id=data["sceneId"],
        width=data["width"],
        height=data["height"],
        seed=data["seed"],
        style_id=data["styleId"],
        terrain_regions=tuple(
            Region(item["id"], item["terrain"], _points(item["polygon"]))
            for item in data["terrainRegions"]
        ),
        roads=tuple(
            PathShape(item["id"], item["width"], _points(item["points"]))
            for item in data["roads"]
        ),
        objects=tuple(
            WorldObject(
                item["id"], item["kind"], item["x"], item["y"],
                item["width"], item["height"], item.get("stage"),
            )
            for item in data["objects"]
        ),
    )


def _validate_regions(value: Any, width: Any, height: Any) -> list[str]:
    if not isinstance(value, list) or not value:
        return ["terrainRegions must be a non-empty array"]
    errors: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict) or item.get("terrain") not in ALLOWED_TERRAINS:
            errors.append(f"terrainRegions[{index}] has an invalid terrain")
            continue
        errors.extend(_validate_points(item.get("polygon"), width, height, 3, f"terrainRegions[{index}].polygon"))
    return errors


def _validate_roads(value: Any, width: Any, height: Any) -> list[str]:
    if not isinstance(value, list):
        return ["roads must be an array"]
    errors: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict) or not isinstance(item.get("width"), int) or item["width"] < 1:
            errors.append(f"roads[{index}] has an invalid width")
            continue
        errors.extend(_validate_points(item.get("points"), width, height, 2, f"roads[{index}].points"))
    return errors


def _validate_objects(value: Any, width: Any, height: Any) -> list[str]:
    if not isinstance(value, list):
        return ["objects must be an array"]
    errors: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict) or item.get("kind") not in ALLOWED_OBJECTS:
            errors.append(f"objects[{index}] has an invalid kind")
            continue
        for key in ("x", "y", "width", "height"):
            if not isinstance(item.get(key), int):
                errors.append(f"objects[{index}].{key} must be an integer")
        if isinstance(width, int) and isinstance(height, int):
            x = item.get("x")
            y = item.get("y")
            object_width = item.get("width")
            object_height = item.get("height")
            if not isinstance(x, int) or x < 0 or x >= width:
                errors.append(f"objects[{index}].x is outside the canvas")
            if not isinstance(y, int) or y < 0 or y >= height:
                errors.append(f"objects[{index}].y is outside the canvas")
            if not isinstance(object_width, int) or object_width < 1:
                errors.append(f"objects[{index}].width must be positive")
            elif isinstance(x, int) and x + object_width > width:
                errors.append(f"objects[{index}] extends beyond canvas width")
            if not isinstance(object_height, int) or object_height < 1:
                errors.append(f"objects[{index}].height must be positive")
            elif isinstance(y, int) and y + object_height > height:
                errors.append(f"objects[{index}] extends beyond canvas height")
    return errors


def _validate_points(value: Any, width: Any, height: Any, minimum: int, label: str) -> list[str]:
    if not isinstance(value, list) or len(value) < minimum:
        return [f"{label} requires at least {minimum} points"]
    errors: list[str] = []
    for point in value:
        if not isinstance(point, list) or len(point) != 2 or not all(isinstance(v, int) for v in point):
            errors.append(f"{label} contains an invalid point")
        elif isinstance(width, int) and isinstance(height, int) and not (0 <= point[0] < width and 0 <= point[1] < height):
            errors.append(f"{label} contains an out-of-bounds point")
    return errors


def _points(value: list[list[int]]) -> tuple[tuple[int, int], ...]:
    return tuple((point[0], point[1]) for point in value)


def _validate_unique_ids(data: dict[str, Any]) -> list[str]:
    seen: set[str] = set()
    errors: list[str] = []
    for group in ("terrainRegions", "roads", "objects"):
        value = data.get(group)
        if not isinstance(value, list):
            continue
        for index, item in enumerate(value):
            item_id = item.get("id") if isinstance(item, dict) else None
            if not isinstance(item_id, str) or not item_id:
                errors.append(f"{group}[{index}].id is required")
            elif item_id in seen:
                errors.append(f"duplicate blueprint id: {item_id}")
            else:
                seen.add(item_id)
    return errors
