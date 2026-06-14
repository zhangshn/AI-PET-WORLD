from __future__ import annotations

from typing import Any

from PIL import Image, ImageChops, ImageFilter

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS

from .geometry_deriver import OBSTACLES

JUDGE_VERSION = "annotation-judge-v1.0"
MIN_CONFIDENCE = 0.55


def judge_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    blueprint = candidate["blueprint"]
    masks = candidate["masks"]
    errors: list[str] = []
    if tuple(masks.keys()) != V1_CONDITION_CHANNELS:
        errors.append("14 condition mask channels are required in fixed order")
    structures = blueprint.get("structures", [])
    ids = [item.get("id") for item in structures]
    if len(ids) != len(set(ids)):
        errors.append("duplicate structure id")
    source_hash = blueprint.get("sourceImage", {}).get("sha256")
    for item in structures:
        errors.extend(_check_structure(item, source_hash))
    errors.extend(_check_mask_coverage(masks))
    errors.extend(_check_water_shoreline(masks))
    errors.extend(_check_road(masks))
    errors.extend(_check_building(masks))
    errors.extend(_check_tree(masks))
    errors.extend(_check_walkable(masks))
    if not source_hash or candidate["asset"].sha256 != source_hash:
        errors.append("source image, blueprint and masks must bind the same SHA-256")
    return {
        "schemaVersion": "annotation-judge-report-v1",
        "judgeVersion": JUDGE_VERSION,
        "status": "failed" if errors else "passed",
        "errors": errors,
        "evidence": {"checkedChannelCount": len(masks), "structureCount": len(structures)},
    }


def _check_structure(item: dict[str, Any], source_hash: str) -> list[str]:
    errors: list[str] = []
    if item.get("type") not in V1_CONDITION_CHANNELS:
        errors.append(f"invalid structure type: {item.get('type')}")
    if item.get("originalSha256") != source_hash:
        errors.append(f"structure hash mismatch: {item.get('id')}")
    if float(item.get("confidence", 0)) < MIN_CONFIDENCE:
        errors.append(f"low confidence: {item.get('id')}")
    geometry = item.get("geometry")
    if not isinstance(geometry, dict) or not _geometry_in_bounds(geometry):
        errors.append(f"geometry out of bounds: {item.get('id')}")
    if isinstance(geometry, dict) and _is_huge_box(geometry, item.get("type")):
        errors.append(f"huge approximate box: {item.get('id')}")
    return errors


def _check_mask_coverage(masks: dict[str, Image.Image]) -> list[str]:
    errors = []
    for name, mask in masks.items():
        if mask.size != (CANVAS_WIDTH, CANVAS_HEIGHT):
            errors.append(f"mask size invalid: {name}")
        if name != "depth" and _coverage(mask) > 0.96:
            errors.append(f"abnormal full-canvas coverage: {name}")
    depth_values = masks["depth"].resize((1, CANVAS_HEIGHT)).getdata()
    if len(set(depth_values)) <= 3:
        errors.append("depth mask must not be mechanical horizontal bands")
    return errors


def _check_water_shoreline(masks: dict[str, Image.Image]) -> list[str]:
    if not masks["water_body"].getbbox():
        return []
    if not masks["shoreline"].getbbox():
        return ["water body requires matching shoreline"]
    near_water = ImageChops.multiply(
        masks["shoreline"], masks["water_body"].filter(ImageFilter.MaxFilter(7))
    )
    return [] if near_water.getbbox() else ["shoreline must follow water-land boundary"]


def _check_road(masks: dict[str, Image.Image]) -> list[str]:
    errors = []
    if masks["road_edge"].getbbox() and not masks["road_center"].getbbox():
        errors.append("road edge requires road center")
    if masks["road_center"].getbbox():
        near = masks["road_edge"].filter(ImageFilter.MaxFilter(15))
        if not ImageChops.multiply(masks["road_center"], near).getbbox():
            errors.append("road center must correspond to road edge")
    return errors


def _check_building(masks: dict[str, Image.Image]) -> list[str]:
    boxes = {name: masks[name].getbbox() for name in ("shelter_foundation", "shelter_wall", "shelter_roof")}
    if boxes["shelter_roof"] and boxes["shelter_wall"] and boxes["shelter_roof"][3] > boxes["shelter_wall"][3] + 12:
        return ["shelter roof must align above walls"]
    if boxes["shelter_wall"] and boxes["shelter_foundation"] and boxes["shelter_wall"][3] < boxes["shelter_foundation"][1]:
        return ["shelter wall must connect to foundation"]
    return []


def _check_tree(masks: dict[str, Image.Image]) -> list[str]:
    trunk, crown = masks["tree_trunk"].getbbox(), masks["tree_crown"].getbbox()
    if trunk and not crown:
        return ["tree trunk requires matching tree crown"]
    if trunk and crown and (trunk[2] < crown[0] or trunk[0] > crown[2] or trunk[1] < crown[1]):
        return ["tree trunk must sit under matching crown"]
    return []


def _check_walkable(masks: dict[str, Image.Image]) -> list[str]:
    blocked = Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0)
    for name in OBSTACLES:
        blocked = ImageChops.lighter(blocked, masks[name])
    return ["walkable conflicts with obstacles"] if ImageChops.multiply(blocked, masks["walkable"]).getbbox() else []


def _geometry_in_bounds(geometry: dict[str, Any]) -> bool:
    points = geometry.get("points") or []
    if geometry.get("kind") == "rect":
        x, y, w, h = geometry.get("rect", [None] * 4)
        points = [[x, y], [x + w - 1, y + h - 1]] if all(isinstance(v, int) for v in (x, y, w, h)) else []
    return bool(points) and all(
        isinstance(p, list) and len(p) == 2 and 0 <= p[0] < CANVAS_WIDTH and 0 <= p[1] < CANVAS_HEIGHT
        for p in points
    )


def _is_huge_box(geometry: dict[str, Any], typ: Any) -> bool:
    if typ == "depth":
        return False
    points = geometry.get("points") or []
    if len(points) < 2:
        return False
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    area = (max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1)
    return area / (CANVAS_WIDTH * CANVAS_HEIGHT) > 0.88


def _coverage(mask: Image.Image) -> float:
    return sum(1 for value in mask.getdata() if value) / (mask.width * mask.height)
