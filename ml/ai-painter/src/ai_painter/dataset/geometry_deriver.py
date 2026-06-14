from __future__ import annotations

from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH

from .auto_annotator import components, mask_polygon, mask_polyline, record

GEOMETRY_VERSION = "geometry-deriver-v1.0"
OBSTACLES = (
    "water_body", "tree_trunk", "tree_crown", "rock", "shelter_foundation",
    "shelter_wall", "shelter_roof", "construction_material",
)


def derive_geometry(
    base: dict[str, Image.Image], source_hash: str
) -> tuple[dict[str, Image.Image], list[dict[str, Any]]]:
    water = base["water_body"]
    grass = base["grass"]
    road = base["construction_material"].filter(ImageFilter.MaxFilter(5))
    shoreline = ImageChops.subtract(
        water.filter(ImageFilter.MaxFilter(5)), water.filter(ImageFilter.MinFilter(3))
    )
    road_edge = ImageChops.subtract(
        road.filter(ImageFilter.MaxFilter(5)), road.filter(ImageFilter.MinFilter(5))
    )
    road_center = Image.new("L", road.size, 0)
    for box in components(road):
        if (box[2] - box[0] + 1) * (box[3] - box[1] + 1) < 45:
            continue
        y = (box[1] + box[3]) // 2
        ImageDraw.Draw(road_center).line([(box[0], y), (box[2], y)], fill=255, width=3)
    blocked = Image.new("L", grass.size, 0)
    for name in OBSTACLES:
        blocked = ImageChops.lighter(blocked, base[name])
    walkable = ImageChops.lighter(grass, road)
    walkable.paste(0, mask=blocked)
    depth = _depth_mask()
    masks = {
        "shoreline": shoreline,
        "road_center": road_center,
        "road_edge": road_edge,
        "walkable": walkable,
        "depth": depth,
    }
    records = []
    if water.getbbox():
        records.append(record(
            "shoreline-000", "shoreline", mask_polyline(shoreline), 0.78,
            source_hash, {"method": "water-land-boundary"},
        ))
    records.extend([
        record("road-center-000", "road_center", mask_polyline(road_center), 0.70, source_hash, {"method": "road-interior-axis"}),
        record("road-edge-000", "road_edge", mask_polyline(road_edge), 0.70, source_hash, {"method": "road-boundary"}),
        record("walkable-000", "walkable", mask_polygon(walkable), 0.76, source_hash, {"method": "grass-road-minus-obstacles"}),
        record("depth-000", "depth", {"kind": "rect", "rect": [0, 0, CANVAS_WIDTH, CANVAS_HEIGHT]}, 0.86, source_hash, {"method": "continuous-spatial-gradient"}),
    ])
    return masks, records


def _depth_mask() -> Image.Image:
    depth = Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0)
    pix = depth.load()
    for y in range(CANVAS_HEIGHT):
        for x in range(CANVAS_WIDTH):
            pix[x, y] = max(1, min(255, round(35 + y * 0.85 + ((x * 17 + y * 7) % 23))))
    return depth
