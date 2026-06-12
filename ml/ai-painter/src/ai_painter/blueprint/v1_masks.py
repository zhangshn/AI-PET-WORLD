from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

from .channels import V1_CONDITION_CHANNELS
from .v1_schema import load_v1_blueprint
from .v1_types import V1Blueprint, V1Geometry


def render_v1_blueprint_masks(blueprint: V1Blueprint, output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    masks = {name: Image.new("L", (blueprint.width, blueprint.height), 0) for name in V1_CONDITION_CHANNELS}
    for item in sorted(blueprint.structures, key=lambda value: (value.layer, value.structure_id)):
        value = _foreground_value(item.structure_type, item.depth_value, item.layer)
        _draw_geometry(masks[item.structure_type], item.geometry, value)
    paths: dict[str, Path] = {}
    for name in V1_CONDITION_CHANNELS:
        path = output_dir / f"{name}.png"
        masks[name].save(path, format="PNG", optimize=False, compress_level=9)
        paths[name] = path
    return paths


def render_v1_masks_from_file(blueprint_path: Path, output_dir: Path) -> dict[str, Path]:
    return render_v1_blueprint_masks(load_v1_blueprint(blueprint_path), output_dir)


def _foreground_value(structure_type: str, depth_value: int | None, layer: int) -> int:
    if structure_type == "depth":
        return depth_value if depth_value is not None else max(1, min(255, layer))
    return 255


def _draw_geometry(image: Image.Image, geometry: V1Geometry, value: int) -> None:
    draw = ImageDraw.Draw(image)
    if geometry.kind == "rect":
        assert geometry.x is not None and geometry.y is not None
        assert geometry.width is not None and geometry.height is not None
        box = (geometry.x, geometry.y, geometry.x + geometry.width - 1, geometry.y + geometry.height - 1)
        draw.rectangle(box, fill=value)
    elif geometry.kind == "polygon":
        draw.polygon(geometry.points, fill=value)
    elif geometry.kind == "polyline":
        draw.line(geometry.points, fill=value, width=geometry.line_width or 1, joint="curve")
