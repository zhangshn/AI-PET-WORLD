from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from typing import Any

from PIL import Image, ImageDraw, ImageOps

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH

from .source_registry import SourceAsset

ANNOTATOR_VERSION = "automatic-visual-annotator-v1.0"
BASE_TYPES = (
    "grass", "water_body", "tree_trunk", "tree_crown", "rock",
    "shelter_foundation", "shelter_wall", "shelter_roof", "construction_material",
)


def load_canvas(path) -> Image.Image:
    with Image.open(path) as image:
        return ImageOps.fit(
            image.convert("RGB"), (CANVAS_WIDTH, CANVAS_HEIGHT), method=Image.Resampling.NEAREST
        )


def classify_image(image: Image.Image) -> dict[str, Image.Image]:
    masks = {name: Image.new("L", image.size, 0) for name in BASE_TYPES}
    pixels = image.convert("RGB").load()
    drawers = {name: ImageDraw.Draw(mask) for name, mask in masks.items()}
    for y in range(image.height):
        for x in range(image.width):
            name = pixel_type(pixels[x, y])
            if name:
                drawers[name].point((x, y), fill=255)
    return masks


def build_base_structures(
    masks: dict[str, Image.Image], asset: SourceAsset, attempt: int
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for name, mask in masks.items():
        for index, box in enumerate(components(mask)):
            area = (box[2] - box[0] + 1) * (box[3] - box[1] + 1)
            if area < (22 if name in {"grass", "water_body"} else 10):
                continue
            confidence = 0.82 if name in {"grass", "water_body"} else 0.72
            records.append(record(
                f"{name}-{index:03d}",
                name,
                box_geometry(box),
                confidence,
                asset.sha256,
                {"method": "deterministic-color-component", "bboxArea": area, "retry": attempt},
            ))
    return records


def record(
    item_id: str,
    typ: str,
    geometry: dict[str, Any],
    confidence: float,
    source_hash: str,
    evidence: dict[str, Any],
) -> dict[str, Any]:
    return {
        "id": item_id,
        "type": typ,
        "geometry": geometry,
        "confidence": confidence,
        "annotatorVersion": ANNOTATOR_VERSION,
        "originalSha256": source_hash,
        "generatedAt": now(),
        "evidence": evidence,
    }


def pixel_type(rgb: tuple[int, int, int]) -> str | None:
    r, g, b = rgb
    if b > 105 and b > r + 25 and b > g - 5:
        return "water_body"
    if abs(r - g) < 18 and abs(g - b) < 18 and 60 <= r <= 180:
        return "rock"
    if g > r + 18 and g > b + 12:
        return "tree_crown" if r < 80 and g < 150 else "grass"
    if r > 125 and g < 95 and b < 95:
        return "shelter_roof"
    if r > 145 and g > 105 and b > 70 and r > b + 25:
        return "shelter_wall"
    if 85 <= r <= 135 and 45 <= g <= 90 and b < 70:
        return "tree_trunk"
    if 95 <= r <= 150 and 70 <= g <= 110 and b < 80:
        return "shelter_foundation"
    if r >= 130 and g >= 105 and b < 95:
        return "construction_material"
    return None


def components(mask: Image.Image) -> list[tuple[int, int, int, int]]:
    pix = mask.load()
    seen: set[tuple[int, int]] = set()
    boxes: list[tuple[int, int, int, int]] = []
    for y in range(mask.height):
        for x in range(mask.width):
            if pix[x, y] == 0 or (x, y) in seen:
                continue
            queue = deque([(x, y)])
            seen.add((x, y))
            xs: list[int] = []
            ys: list[int] = []
            while queue:
                px, py = queue.popleft()
                xs.append(px)
                ys.append(py)
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if (
                        0 <= nx < mask.width
                        and 0 <= ny < mask.height
                        and pix[nx, ny]
                        and (nx, ny) not in seen
                    ):
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            boxes.append((min(xs), min(ys), max(xs), max(ys)))
    return boxes


def box_geometry(box: tuple[int, int, int, int]) -> dict[str, Any]:
    x1, y1, x2, y2 = box
    return {"kind": "polygon", "points": [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]}


def mask_polygon(mask: Image.Image) -> dict[str, Any]:
    box = mask.getbbox() or (0, 0, 1, 1)
    return box_geometry((box[0], box[1], box[2] - 1, box[3] - 1))


def mask_polyline(mask: Image.Image) -> dict[str, Any]:
    box = mask.getbbox() or (0, 0, 1, 1)
    y = (box[1] + box[3]) // 2
    return {"kind": "polyline", "points": [[box[0], y], [max(box[0], box[2] - 1), y]]}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
