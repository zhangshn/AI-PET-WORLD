from __future__ import annotations

from typing import Any

from .channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS, V1_SCHEMA_VERSION, V1_STRUCTURE_TYPES


REQUIRED_BLUEPRINT_KEYS = ("schemaVersion", "sceneId", "width", "height", "seed", "styleId", "structures")


def validate_v1_blueprint_data(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return ["v1 blueprint must be a JSON object"]
    errors: list[str] = []
    for key in REQUIRED_BLUEPRINT_KEYS:
        if key not in data:
            errors.append(f"{key} is required")
    if data.get("schemaVersion") != V1_SCHEMA_VERSION:
        errors.append(f"schemaVersion must be {V1_SCHEMA_VERSION}")
    if data.get("width") != CANVAS_WIDTH or data.get("height") != CANVAS_HEIGHT:
        errors.append("v1 blueprint size must be 256x192")
    if not isinstance(data.get("sceneId"), str) or not data.get("sceneId"):
        errors.append("sceneId is required")
    if not isinstance(data.get("seed"), int):
        errors.append("seed must be an integer")
    if not isinstance(data.get("styleId"), str) or not data.get("styleId"):
        errors.append("styleId is required")
    errors.extend(_validate_review_fields(data, "blueprint"))
    errors.extend(_validate_structures(data.get("structures")))
    return errors


def _validate_structures(value: Any) -> list[str]:
    if not isinstance(value, list):
        return ["structures must be an array"]
    errors: list[str] = []
    seen: set[str] = set()
    for index, item in enumerate(value):
        label = f"structures[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{label} must be an object")
            continue
        structure_id = item.get("id")
        if not isinstance(structure_id, str) or not structure_id:
            errors.append(f"{label}.id is required")
        elif structure_id in seen:
            errors.append(f"duplicate v1 structure id: {structure_id}")
        else:
            seen.add(structure_id)
        if item.get("type") not in V1_STRUCTURE_TYPES:
            errors.append(f"{label}.type must be one of {', '.join(V1_CONDITION_CHANNELS)}")
        if not isinstance(item.get("layer"), int):
            errors.append(f"{label}.layer must be an integer")
        errors.extend(_validate_review_fields(item, label))
        errors.extend(_validate_geometry(item.get("geometry"), label))
        if item.get("type") == "depth":
            depth_value = item.get("depthValue")
            if depth_value is not None and (not isinstance(depth_value, int) or not 0 <= depth_value <= 255):
                errors.append(f"{label}.depthValue must be between 0 and 255")
    return errors


def _validate_review_fields(item: dict[str, Any], label: str) -> list[str]:
    errors: list[str] = []
    if "requiresManualReview" in item and not isinstance(item.get("requiresManualReview"), bool):
        errors.append(f"{label}.requiresManualReview must be boolean")
    reasons = item.get("manualReviewReasons", [])
    if not isinstance(reasons, list) or not all(isinstance(reason, str) for reason in reasons):
        errors.append(f"{label}.manualReviewReasons must be an array of strings")
    return errors


def _validate_geometry(value: Any, label: str) -> list[str]:
    if not isinstance(value, dict):
        return [f"{label}.geometry is required"]
    kind = value.get("kind")
    if kind == "rect":
        return _validate_allowed_keys(value, {"kind", "x", "y", "width", "height"}, label) + _validate_rect(value, label)
    if kind == "polygon":
        return _validate_allowed_keys(value, {"kind", "points"}, label) + _validate_points(
            value.get("points"), 3, f"{label}.geometry.points"
        )
    if kind == "polyline":
        errors = _validate_allowed_keys(value, {"kind", "points", "lineWidth"}, label)
        errors.extend(_validate_points(value.get("points"), 2, f"{label}.geometry.points"))
        line_width = value.get("lineWidth")
        if not isinstance(line_width, int) or line_width <= 0:
            errors.append(f"{label}.geometry.lineWidth must be positive")
        return errors
    return [f"{label}.geometry.kind is invalid"]


def _validate_allowed_keys(value: dict[str, Any], allowed: set[str], label: str) -> list[str]:
    errors: list[str] = []
    for key in sorted(set(value) - allowed):
        errors.append(f"{label}.geometry.{key} is not allowed for {value.get('kind')} geometry")
        if key in {"x", "y"}:
            errors.append(f"{label}.geometry.{key} is outside the canvas")
        if key in {"width", "height"}:
            errors.append(f"{label}.geometry.{key} must be positive")
    return errors


def _validate_rect(value: dict[str, Any], label: str) -> list[str]:
    errors: list[str] = []
    for key in ("x", "y", "width", "height"):
        if not isinstance(value.get(key), int):
            errors.append(f"{label}.geometry.{key} must be an integer")
    x, y, width, height = value.get("x"), value.get("y"), value.get("width"), value.get("height")
    if isinstance(width, int) and width <= 0:
        errors.append(f"{label}.geometry.width must be positive")
    if isinstance(height, int) and height <= 0:
        errors.append(f"{label}.geometry.height must be positive")
    if all(isinstance(v, int) for v in (x, y, width, height)):
        if x < 0 or y < 0 or x >= CANVAS_WIDTH or y >= CANVAS_HEIGHT:
            errors.append(f"{label}.geometry origin is outside the canvas")
        if x + width > CANVAS_WIDTH or y + height > CANVAS_HEIGHT:
            errors.append(f"{label}.geometry extends beyond canvas")
    return errors


def _validate_points(value: Any, minimum: int, label: str) -> list[str]:
    if not isinstance(value, list) or len(value) < minimum:
        return [f"{label} requires at least {minimum} points"]
    errors: list[str] = []
    for point in value:
        if not isinstance(point, list) or len(point) != 2 or not all(isinstance(v, int) for v in point):
            errors.append(f"{label} contains an invalid point")
        elif not (0 <= point[0] < CANVAS_WIDTH and 0 <= point[1] < CANVAS_HEIGHT):
            errors.append(f"{label} contains an out-of-bounds point")
    return errors
