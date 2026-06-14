from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageFilter

from .visual_judge_b import judge_target_quality_proxy


POLICY_VERSION = "single-asset-vj-a-v1"


def judge_single_asset(asset_dir: Path) -> dict[str, Any]:
    metadata = json.loads((asset_dir / "metadata.json").read_text(encoding="utf-8"))
    with Image.open(asset_dir / "sprite.png") as source:
        sprite = source.convert("RGBA")
    metrics = _measure(sprite)
    checks = {
        "canvas_128_square": sprite.size == (128, 128),
        "binary_alpha": metrics["partialAlphaPixelCount"] == 0,
        "balanced_coverage": 0.18 <= metrics["coverageRatio"] <= 0.72,
        "palette_depth": metrics["paletteColorCount"] >= 16,
        "luminance_range": metrics["luminanceRange"] >= 90,
        "pixel_edge_density": metrics["edgeDensity"] >= 0.045,
        "same_source_annotation": metadata.get("annotationSource") == "layer_alpha_same_source",
        "technical_gate_passed": metadata.get("quality", {}).get("technicalGate") == "passed",
    }
    reasons = [_reason(name) for name, passed in checks.items() if not passed]
    vj_a_passed = all(checks.values())
    masks = _load_masks(asset_dir, metadata)
    vj_b1 = judge_target_quality_proxy(sprite, masks, metadata.get("category", ""), vj_a_passed)
    report = {
        "schemaVersion": "single-asset-visual-review-v1",
        "policyVersion": POLICY_VERSION,
        "assetId": metadata["assetId"],
        "gate": "vj_a",
        "status": "passed" if vj_a_passed else "failed",
        "checks": checks,
        "metrics": metrics,
        "failureReasonsZh": reasons,
        "vjB": vj_b1,
        "approvedForTraining": False,
        "noteZh": "VJ-A 检查基础像素质量；VJ-B1 检查目标品质代理指标；VJ-B2 学习型参考质量审核尚未实现。",
    }
    (asset_dir / "visual-review.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return report


def _load_masks(asset_dir: Path, metadata: dict[str, Any]) -> dict[str, Image.Image]:
    result: dict[str, Image.Image] = {}
    for channel, record in metadata.get("masks", {}).items():
        if channel == "object_alpha":
            continue
        path = asset_dir / "masks" / record["path"]
        with Image.open(path) as source:
            result[channel] = source.convert("L").copy()
    return result


def _measure(sprite: Image.Image) -> dict[str, Any]:
    pixels = list(sprite.getdata())
    visible = [pixel for pixel in pixels if pixel[3] > 0]
    partial_alpha = sum(1 for pixel in pixels if 0 < pixel[3] < 255)
    palette = {pixel[:3] for pixel in visible}
    luminance = [round(0.2126 * red + 0.7152 * green + 0.0722 * blue) for red, green, blue, _ in visible]
    alpha = sprite.getchannel("A")
    edges = alpha.filter(ImageFilter.FIND_EDGES)
    edge_pixels = sum(1 for value in edges.getdata() if value > 0)
    return {
        "width": sprite.width,
        "height": sprite.height,
        "visiblePixelCount": len(visible),
        "partialAlphaPixelCount": partial_alpha,
        "coverageRatio": round(len(visible) / (sprite.width * sprite.height), 4),
        "paletteColorCount": len(palette),
        "luminanceRange": max(luminance) - min(luminance) if luminance else 0,
        "edgeDensity": round(edge_pixels / max(1, len(visible)), 4),
    }


def _reason(name: str) -> str:
    return {
        "canvas_128_square": "画布必须为 128×128。",
        "binary_alpha": "存在半透明像素，像素单体边缘不够干净。",
        "balanced_coverage": "主体占图比例不在 18% 到 72% 之间。",
        "palette_depth": "有效颜色少于 16 种，层次和细节不足。",
        "luminance_range": "明暗跨度不足 90，体积层次偏弱。",
        "pixel_edge_density": "有效边缘密度不足，轮廓或内部细节过于简单。",
        "same_source_annotation": "精灵图与 Mask 不是同源生成。",
        "technical_gate_passed": "技术完整性审核未通过。",
    }[name]
