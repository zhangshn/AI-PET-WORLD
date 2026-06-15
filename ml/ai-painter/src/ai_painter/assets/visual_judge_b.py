from __future__ import annotations

from collections import Counter
from typing import Any

from PIL import Image, ImageChops, ImageFilter, ImageStat


POLICY_VERSION = "single-asset-vj-b1-v1"


def judge_target_quality_proxy(
    sprite: Image.Image,
    masks: dict[str, Image.Image],
    category: str,
    vj_a_passed: bool,
    visual_profile: str = "default",
) -> dict[str, Any]:
    metrics = _measure(sprite, masks)
    required_channels = _required_channels(category)
    internal_edge_range = _internal_edge_range(category, visual_profile)
    checks = {
        "vj_a_passed": vj_a_passed,
        "category_profile_available": bool(required_channels),
        "category_layers_complete": required_channels.issubset(masks),
        "palette_richness": metrics["paletteColorCount"] >= 24,
        "dominant_color_control": metrics["dominantColorRatio"] <= 0.28,
        "internal_detail_density": internal_edge_range[0] <= metrics["internalEdgeDensity"] <= internal_edge_range[1],
        "highlight_shadow_balance": metrics["shadowRatio"] >= 0.08 and metrics["highlightRatio"] >= 0.06,
        "silhouette_complexity": 0.045 <= metrics["silhouetteEdgeDensity"] <= 0.22,
        "material_layer_separation": metrics["minimumLayerColorDistance"] >= 28,
    }
    reasons = [_reason(name) for name, passed in checks.items() if not passed]
    return {
        "policyVersion": POLICY_VERSION,
        "gate": "vj_b1_target_quality_proxy",
        "status": "passed" if all(checks.values()) else "failed",
        "checks": checks,
        "metrics": metrics,
        "visualProfile": visual_profile,
        "internalEdgeRange": list(internal_edge_range),
        "failureReasonsZh": reasons,
        "vjB2LearnedJudgeStatus": "not_implemented",
        "approvedForTraining": False,
        "noteZh": "VJ-B1 是可计算的目标品质代理审核，不等于学习型审美判断。VJ-B2 尚未实现，因此资产不能进入正式训练集。",
    }


def _measure(sprite: Image.Image, masks: dict[str, Image.Image]) -> dict[str, Any]:
    visible = [pixel for pixel in sprite.getdata() if pixel[3] > 0]
    palette = Counter(pixel[:3] for pixel in visible)
    luminance = [_luminance(pixel[:3]) for pixel in visible]
    mean_luminance = sum(luminance) / max(1, len(luminance))
    shadow_ratio = sum(value <= mean_luminance - 24 for value in luminance) / max(1, len(luminance))
    highlight_ratio = sum(value >= mean_luminance + 24 for value in luminance) / max(1, len(luminance))

    grayscale = sprite.convert("RGB").convert("L")
    internal_edges = grayscale.filter(ImageFilter.FIND_EDGES)
    alpha = sprite.getchannel("A")
    internal_edge_pixels = sum(
        1 for edge, opacity in zip(internal_edges.getdata(), alpha.getdata())
        if opacity > 0 and edge >= 28
    )
    silhouette_edges = alpha.filter(ImageFilter.FIND_EDGES)
    silhouette_edge_pixels = sum(value > 0 for value in silhouette_edges.getdata())

    layer_colors = _exclusive_layer_colors(sprite, masks)
    distances = [
        _color_distance(left, right)
        for index, left in enumerate(layer_colors)
        for right in layer_colors[index + 1:]
    ]
    return {
        "paletteColorCount": len(palette),
        "dominantColorRatio": round(max(palette.values(), default=0) / max(1, len(visible)), 4),
        "internalEdgeDensity": round(internal_edge_pixels / max(1, len(visible)), 4),
        "silhouetteEdgeDensity": round(silhouette_edge_pixels / max(1, len(visible)), 4),
        "shadowRatio": round(shadow_ratio, 4),
        "highlightRatio": round(highlight_ratio, 4),
        "minimumLayerColorDistance": round(min(distances, default=0), 2),
    }


def _required_channels(category: str) -> set[str]:
    return {
        "tree": {"tree_trunk", "tree_crown"},
        "rock": {"rock"},
        "construction_material": {"construction_material"},
    }.get(category, set())


def _internal_edge_range(category: str, visual_profile: str) -> tuple[float, float]:
    if category == "tree" and visual_profile == "sparse_tree":
        return 0.07, 0.58
    return 0.07, 0.48


def _masked_mean_rgb(sprite: Image.Image, mask: Image.Image) -> tuple[float, float, float]:
    rgb = sprite.convert("RGB")
    return tuple(ImageStat.Stat(rgb, mask=mask).mean[:3])


def _exclusive_layer_colors(
    sprite: Image.Image, masks: dict[str, Image.Image],
) -> list[tuple[float, float, float]]:
    colors: list[tuple[float, float, float]] = []
    items = list(masks.items())
    for index, (_, mask) in enumerate(items):
        exclusive = mask.copy()
        for other_index, (_, other) in enumerate(items):
            if index != other_index:
                exclusive = _subtract_mask(exclusive, other)
        if exclusive.getbbox():
            colors.append(_masked_mean_rgb(sprite, exclusive))
    return colors


def _subtract_mask(source: Image.Image, other: Image.Image) -> Image.Image:
    binary_source = source.point(lambda value: 255 if value > 0 else 0)
    binary_other = other.point(lambda value: 255 if value > 0 else 0)
    return ImageChops.subtract(binary_source, binary_other)


def _luminance(color: tuple[int, int, int]) -> float:
    red, green, blue = color
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def _color_distance(left: tuple[float, float, float], right: tuple[float, float, float]) -> float:
    return sum((a - b) ** 2 for a, b in zip(left, right)) ** 0.5


def _reason(name: str) -> str:
    return {
        "vj_a_passed": "VJ-A 基础像素审核未通过，不能进入目标品质审核。",
        "category_profile_available": "当前资产类别没有 VJ-B1 品质规则。",
        "category_layers_complete": "资产缺少类别要求的同源材质图层。",
        "palette_richness": "有效颜色少于 24 种，无法支撑目标级材质与光影层次。",
        "dominant_color_control": "单一颜色占比超过 28%，存在大面积平涂。",
        "internal_detail_density": "内部明暗边缘密度不在目标范围，细节过少或噪点过多。",
        "highlight_shadow_balance": "高光或阴影占比不足，体积与光照层次不完整。",
        "silhouette_complexity": "主体轮廓复杂度不在目标范围，轮廓过于简单或破碎。",
        "material_layer_separation": "不同材质图层的平均颜色距离不足，树干与树冠等材质区分不清。",
    }[name]
