from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

GeometryKind = Literal["rect", "polygon", "polyline"]


@dataclass(frozen=True)
class V1Geometry:
    kind: GeometryKind
    x: int | None = None
    y: int | None = None
    width: int | None = None
    height: int | None = None
    points: tuple[tuple[int, int], ...] = ()
    line_width: int | None = None


@dataclass(frozen=True)
class V1Structure:
    structure_id: str
    structure_type: str
    geometry: V1Geometry
    layer: int
    source_v0_id: str | None
    requires_manual_review: bool
    manual_review_reasons: tuple[str, ...]
    depth_value: int | None = None


@dataclass(frozen=True)
class V1Blueprint:
    schema_version: str
    scene_id: str
    width: int
    height: int
    seed: int
    style_id: str
    structures: tuple[V1Structure, ...]
    requires_manual_review: bool
    manual_review_reasons: tuple[str, ...]
    source_blueprint_version: str | None
    source_blueprint_hash: str | None
