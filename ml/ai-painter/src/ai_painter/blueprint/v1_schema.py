from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .v1_types import V1Blueprint, V1Geometry, V1Structure
from .v1_validator import validate_v1_blueprint_data


def load_v1_blueprint(path: Path) -> V1Blueprint:
    data = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_v1_blueprint_data(data)
    if errors:
        raise ValueError("; ".join(errors))
    return parse_v1_blueprint(data)


def parse_v1_blueprint(data: dict[str, Any]) -> V1Blueprint:
    return V1Blueprint(
        schema_version=data["schemaVersion"],
        scene_id=data["sceneId"],
        width=data["width"],
        height=data["height"],
        seed=data["seed"],
        style_id=data["styleId"],
        structures=tuple(_parse_structure(item) for item in data["structures"]),
        requires_manual_review=bool(data.get("requiresManualReview", False)),
        manual_review_reasons=tuple(data.get("manualReviewReasons", [])),
        source_blueprint_version=data.get("sourceBlueprintVersion"),
        source_blueprint_hash=data.get("sourceBlueprintHash"),
    )


def dump_v1_blueprint(data: dict[str, Any], path: Path) -> None:
    errors = validate_v1_blueprint_data(data)
    if errors:
        raise ValueError("; ".join(errors))
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _parse_structure(item: dict[str, Any]) -> V1Structure:
    geometry = item["geometry"]
    return V1Structure(
        structure_id=item["id"],
        structure_type=item["type"],
        geometry=V1Geometry(
            kind=geometry["kind"],
            x=geometry.get("x"),
            y=geometry.get("y"),
            width=geometry.get("width"),
            height=geometry.get("height"),
            points=tuple((point[0], point[1]) for point in geometry.get("points", [])),
            line_width=geometry.get("lineWidth"),
        ),
        layer=item["layer"],
        source_v0_id=item.get("sourceV0Id"),
        requires_manual_review=bool(item.get("requiresManualReview", False)),
        manual_review_reasons=tuple(item.get("manualReviewReasons", [])),
        depth_value=item.get("depthValue"),
    )
