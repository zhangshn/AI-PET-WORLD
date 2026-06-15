from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageFilter, ImageStat


PROFILE_VERSION = "tree-drawing-profile-v1"
COMPARISON_VERSION = "tree-reference-comparison-v1"


def build_tree_drawing_profile(
    asset_id: str,
    sprite: Image.Image,
    masks: dict[str, Image.Image],
    drawing_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    alpha = sprite.getchannel("A")
    trunk = masks.get("tree_trunk", Image.new("L", sprite.size, 0))
    crown = masks.get("tree_crown", Image.new("L", sprite.size, 0))
    bounds = _bounds(alpha)
    trunk_bounds = _bounds(trunk)
    crown_bounds = _bounds(crown)
    visible = max(1, _area(alpha))
    trunk_area = _area(trunk)
    crown_area = _area(crown)
    profile = {
        "schemaVersion": PROFILE_VERSION,
        "assetId": asset_id,
        "canvas": {"width": sprite.width, "height": sprite.height},
        "sourceParameters": drawing_spec or {"availability": "measured_only"},
        "silhouette": {
            "bounds": bounds,
            "coverageRatio": round(visible / (sprite.width * sprite.height), 4),
            "widthHeightRatio": _aspect(bounds),
            "edgeDensity": _edge_density(alpha, visible),
            "horizontalSymmetry": _symmetry(alpha),
        },
        "trunk": {
            "bounds": trunk_bounds,
            "areaRatio": round(trunk_area / visible, 4),
            "centroid": _centroid(trunk),
        },
        "crown": {
            "bounds": crown_bounds,
            "areaRatio": round(crown_area / visible, 4),
            "centroid": _centroid(crown),
            "edgeDensity": _edge_density(crown, max(1, crown_area)),
        },
        "structure": {
            "trunkCrownConnected": _connected(trunk, crown),
            "anchorAligned": _anchor_aligned(trunk_bounds, crown_bounds),
            "verticalOrderValid": _vertical_order(trunk_bounds, crown_bounds),
        },
        "colorAndLight": _color_profile(sprite),
        "visualSignature": _visual_signature(sprite),
    }
    return profile


def compare_with_reference_profiles(
    candidate: dict[str, Any],
    references: list[dict[str, Any]],
    rejected_references: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    scored = []
    for reference in references:
        if reference.get("assetId") == candidate.get("assetId"):
            continue
        distance, differences = _profile_distance(candidate, reference)
        scored.append((distance, reference, differences))
    scored.sort(key=lambda item: item[0])
    nearest = scored[:5]
    similarity = round(max(0.0, 1.0 - (nearest[0][0] if nearest else 1.0)), 4)
    rejected_scored = []
    for reference in rejected_references or []:
        if reference.get("assetId") == candidate.get("assetId"):
            continue
        distance, _ = _profile_distance(candidate, reference)
        rejected_scored.append((distance, reference))
    rejected_scored.sort(key=lambda item: item[0])
    rejection_similarity = round(max(0.0, 1.0 - (rejected_scored[0][0] if rejected_scored else 1.0)), 4)
    quality_margin = round(similarity - rejection_similarity, 4)
    structural = candidate["structure"]
    warnings = []
    if not structural["trunkCrownConnected"]:
        warnings.append("树干与树冠没有形成稳定连接")
    if not structural["anchorAligned"]:
        warnings.append("树干中心与树冠重心偏离过大")
    if not structural["verticalOrderValid"]:
        warnings.append("树冠、树干的上下结构异常")
    if nearest and nearest[0][0] > 0.32:
        warnings.append("与当前合格标准库的结构和视觉特征距离过大")
    recommendation = "uncertain"
    if not warnings and quality_margin >= 0.025:
        recommendation = "reference_match"
    elif warnings or quality_margin <= -0.025:
        recommendation = "reference_mismatch"
    return {
        "schemaVersion": COMPARISON_VERSION,
        "assetId": candidate["assetId"],
        "referenceCount": len(references),
        "rejectedReferenceCount": len(rejected_references or []),
        "similarityScore": similarity,
        "rejectionSimilarityScore": rejection_similarity,
        "qualityMargin": quality_margin,
        "recommendation": recommendation,
        "warningsZh": warnings,
        "nearestReferences": [
            {
                "assetId": reference["assetId"],
                "similarityScore": round(max(0.0, 1.0 - distance), 4),
                "mainDifferencesZh": differences[:3],
            }
            for distance, reference, differences in nearest
        ],
        "nearestRejectedReferences": [
            {"assetId": reference["assetId"], "similarityScore": round(max(0.0, 1.0 - distance), 4)}
            for distance, reference in rejected_scored[:3]
        ],
        "noteZh": "该结果比较结构和视觉特征，不进行逐像素复制判断，也不替代项目所有者最终审核。",
    }


def write_tree_profile(asset_dir: Path, drawing_spec: dict[str, Any] | None = None) -> dict[str, Any]:
    metadata = json.loads((asset_dir / "metadata.json").read_text(encoding="utf-8"))
    with Image.open(asset_dir / "sprite.png") as source:
        sprite = source.convert("RGBA")
    masks = {}
    for channel in ("tree_trunk", "tree_crown"):
        path = asset_dir / "masks" / f"{channel}.png"
        if path.is_file():
            with Image.open(path) as source:
                masks[channel] = source.convert("L").copy()
    profile = build_tree_drawing_profile(metadata["assetId"], sprite, masks, drawing_spec)
    (asset_dir / "drawing-profile.json").write_text(
        json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return profile


def _profile_distance(left: dict[str, Any], right: dict[str, Any]) -> tuple[float, list[str]]:
    pairs = (
        ("主体占比", left["silhouette"]["coverageRatio"], right["silhouette"]["coverageRatio"], 0.10),
        ("轮廓宽高比", left["silhouette"]["widthHeightRatio"], right["silhouette"]["widthHeightRatio"], 0.10),
        ("轮廓边缘密度", left["silhouette"]["edgeDensity"], right["silhouette"]["edgeDensity"], 0.08),
        ("左右平衡", left["silhouette"]["horizontalSymmetry"], right["silhouette"]["horizontalSymmetry"], 0.06),
        ("树干占比", left["trunk"]["areaRatio"], right["trunk"]["areaRatio"], 0.07),
        ("树冠占比", left["crown"]["areaRatio"], right["crown"]["areaRatio"], 0.07),
        ("色彩数量", left["colorAndLight"]["paletteColorCount"] / 64, right["colorAndLight"]["paletteColorCount"] / 64, 0.04),
        ("明暗跨度", left["colorAndLight"]["luminanceRange"] / 255, right["colorAndLight"]["luminanceRange"] / 255, 0.03),
    )
    weighted = [(name, min(1.0, abs(a - b)), weight) for name, a, b, weight in pairs]
    visual_distance = _signature_distance(left["visualSignature"], right["visualSignature"])
    distance = sum(delta * weight for _, delta, weight in weighted) + visual_distance * 0.45
    differences = [f"{name}差异较大" for name, delta, _ in sorted(weighted, key=lambda item: item[1], reverse=True) if delta >= 0.12]
    return distance, differences


def _visual_signature(sprite: Image.Image) -> dict[str, Any]:
    bbox = sprite.getchannel("A").getbbox()
    if not bbox:
        return {"size": [16, 16], "luminance": [0] * 256, "alpha": [0] * 256}
    normalized = sprite.crop(bbox).resize((16, 16), Image.Resampling.BILINEAR)
    luminance = normalized.convert("RGB").convert("L")
    alpha = normalized.getchannel("A")
    return {
        "size": [16, 16],
        "luminance": [round(value / 255, 3) for value in luminance.getdata()],
        "alpha": [round(value / 255, 3) for value in alpha.getdata()],
    }


def _signature_distance(left: dict[str, Any], right: dict[str, Any]) -> float:
    left_values = left["luminance"] + left["alpha"]
    right_values = right["luminance"] + right["alpha"]
    if len(left_values) != len(right_values) or not left_values:
        return 1.0
    return sum(abs(a - b) for a, b in zip(left_values, right_values)) / len(left_values)


def _bounds(mask: Image.Image) -> list[int] | None:
    return list(mask.getbbox()) if mask.getbbox() else None


def _area(mask: Image.Image) -> int:
    return sum(value > 0 for value in mask.getdata())


def _aspect(bounds: list[int] | None) -> float:
    if not bounds:
        return 0.0
    return round((bounds[2] - bounds[0]) / max(1, bounds[3] - bounds[1]), 4)


def _centroid(mask: Image.Image) -> list[float] | None:
    points = [(index % mask.width, index // mask.width) for index, value in enumerate(mask.getdata()) if value > 0]
    if not points:
        return None
    return [round(sum(x for x, _ in points) / len(points), 2), round(sum(y for _, y in points) / len(points), 2)]


def _edge_density(mask: Image.Image, area: int) -> float:
    edges = mask.filter(ImageFilter.FIND_EDGES)
    return round(sum(value > 0 for value in edges.getdata()) / max(1, area), 4)


def _symmetry(mask: Image.Image) -> float:
    flipped = mask.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    different = sum(a != b for a, b in zip(mask.getdata(), flipped.getdata()))
    return round(1.0 - different / (mask.width * mask.height), 4)


def _connected(trunk: Image.Image, crown: Image.Image) -> bool:
    expanded = trunk.filter(ImageFilter.MaxFilter(5))
    return any(a > 0 and b > 0 for a, b in zip(expanded.getdata(), crown.getdata()))


def _anchor_aligned(trunk: list[int] | None, crown: list[int] | None) -> bool:
    if not trunk or not crown:
        return False
    trunk_x = (trunk[0] + trunk[2]) / 2
    crown_x = (crown[0] + crown[2]) / 2
    return abs(trunk_x - crown_x) <= max(10, (crown[2] - crown[0]) * 0.28)


def _vertical_order(trunk: list[int] | None, crown: list[int] | None) -> bool:
    return bool(trunk and crown and crown[1] < trunk[3] and crown[3] <= trunk[3] + 12)


def _color_profile(sprite: Image.Image) -> dict[str, Any]:
    visible = [pixel[:3] for pixel in sprite.getdata() if pixel[3] > 0]
    luminance = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in visible]
    mean = ImageStat.Stat(sprite.convert("RGB"), mask=sprite.getchannel("A")).mean[:3]
    return {
        "paletteColorCount": len(set(visible)),
        "luminanceRange": round(max(luminance) - min(luminance), 2) if luminance else 0,
        "meanRgb": [round(value, 2) for value in mean],
    }
