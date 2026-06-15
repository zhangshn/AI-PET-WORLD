from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops

from ai_painter.dataset.hashing import sha256_file
from .tree_profile import build_tree_drawing_profile

SCHEMA_VERSION = "layered-pixel-asset-v1"
SUPPORTED_CHANNELS = {
    "tree_trunk", "tree_crown", "rock", "shelter_foundation",
    "shelter_wall", "shelter_roof", "construction_material",
}


def build_layered_asset(manifest_path: Path, output_root: Path) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    asset_id, size, layers = _validate_manifest(manifest, manifest_path)
    admission = manifest.get("admission", "accepted")
    output_dir = output_root / asset_id
    masks_dir = output_dir / "masks"
    output_dir.mkdir(parents=True, exist_ok=True)
    masks_dir.mkdir(parents=True, exist_ok=True)

    sprite = Image.new("RGBA", size, (0, 0, 0, 0))
    masks: dict[str, Image.Image] = {}
    layer_records: list[dict[str, Any]] = []
    for layer in sorted(layers, key=lambda item: item["zIndex"]):
        source = (manifest_path.parent / layer["file"]).resolve()
        image = _load_rgba_layer(source, size)
        sprite.alpha_composite(image)
        alpha = image.getchannel("A")
        masks[layer["channel"]] = ImageChops.lighter(
            masks.get(layer["channel"], Image.new("L", size, 0)), alpha,
        )
        layer_records.append({
            "id": layer["id"], "channel": layer["channel"],
            "zIndex": layer["zIndex"], "sourceSha256": sha256_file(source),
        })

    sprite_path = output_dir / "sprite.png"
    sprite.save(sprite_path, "PNG", optimize=True)
    mask_records = _write_masks(masks, sprite.getchannel("A"), masks_dir)
    quality = _build_quality_report(sprite, masks, admission)
    metadata = {
        "schemaVersion": SCHEMA_VERSION,
        "assetId": asset_id,
        "category": manifest["category"],
        "visualProfile": manifest.get("visualProfile", "default"),
        "size": list(size),
        "anchor": manifest["anchor"],
        "layers": layer_records,
        "sprite": _file_record(sprite_path),
        "masks": mask_records,
        "annotationSource": "layer_alpha_same_source",
        "admission": admission,
        "trainable": admission == "accepted",
        "quality": quality,
    }
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    if manifest["category"] == "tree":
        profile = build_tree_drawing_profile(
            asset_id, sprite, masks, manifest.get("drawingSpec"),
        )
        (output_dir / "drawing-profile.json").write_text(
            json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
        )
    return metadata


def _validate_manifest(value: Any, path: Path) -> tuple[str, tuple[int, int], list[dict[str, Any]]]:
    if not isinstance(value, dict) or value.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"单体清单版本无效：{path}")
    asset_id = value.get("assetId")
    size = value.get("size")
    layers = value.get("layers")
    anchor = value.get("anchor")
    if not isinstance(asset_id, str) or not asset_id:
        raise ValueError("assetId 不能为空")
    if not isinstance(size, list) or len(size) != 2 or not all(isinstance(item, int) and item > 0 for item in size):
        raise ValueError("size 必须是两个正整数")
    if not isinstance(anchor, list) or len(anchor) != 2:
        raise ValueError("anchor 必须是两个坐标")
    if value.get("admission", "accepted") not in {"engineering_only", "candidate", "accepted"}:
        raise ValueError("admission 只能是 engineering_only、candidate 或 accepted")
    if not isinstance(layers, list) or not layers:
        raise ValueError("layers 不能为空")
    ids: set[str] = set()
    for layer in layers:
        if not isinstance(layer, dict) or not all(key in layer for key in ("id", "file", "channel", "zIndex")):
            raise ValueError("每个图层必须包含 id、file、channel、zIndex")
        if layer["id"] in ids:
            raise ValueError(f"图层 ID 重复：{layer['id']}")
        if layer["channel"] not in SUPPORTED_CHANNELS:
            raise ValueError(f"不支持的标注通道：{layer['channel']}")
        ids.add(layer["id"])
    return asset_id, (size[0], size[1]), layers


def _load_rgba_layer(path: Path, size: tuple[int, int]) -> Image.Image:
    if not path.is_file():
        raise ValueError(f"单体图层不存在：{path}")
    with Image.open(path) as image:
        if "A" not in image.getbands():
            raise ValueError(f"图层没有有效 Alpha：{path}")
        rgba = image.convert("RGBA")
        if rgba.size != size:
            raise ValueError(f"图层尺寸不一致：{path}，需要 {size[0]}x{size[1]}")
        if not rgba.getchannel("A").getbbox():
            raise ValueError(f"图层没有有效 Alpha：{path}")
        return rgba.copy()


def _write_masks(masks: dict[str, Image.Image], alpha: Image.Image, root: Path) -> dict[str, Any]:
    records: dict[str, Any] = {}
    for channel, mask in {**masks, "object_alpha": alpha}.items():
        path = root / f"{channel}.png"
        mask.save(path, "PNG", optimize=True)
        records[channel] = _file_record(path)
    return records


def _file_record(path: Path) -> dict[str, Any]:
    return {"path": path.name, "sha256": sha256_file(path), "byteLength": path.stat().st_size}


def _build_quality_report(
    sprite: Image.Image, masks: dict[str, Image.Image], admission: str,
) -> dict[str, Any]:
    alpha = sprite.getchannel("A")
    bbox = alpha.getbbox()
    opaque_pixels = sum(1 for value in alpha.getdata() if value > 0)
    palette_colors = len({pixel[:3] for pixel in sprite.getdata() if pixel[3] > 0})
    required_channels = {"tree_trunk", "tree_crown"} if "tree_crown" in masks else set(masks)
    technical_checks = {
        "nonEmptyAlpha": bbox is not None,
        "requiredChannelsPresent": required_channels.issubset(masks),
        "hasUsableCoverage": opaque_pixels >= 64,
    }
    technical_passed = all(technical_checks.values())
    return {
        "technicalGate": "passed" if technical_passed else "failed",
        "technicalChecks": technical_checks,
        "opaquePixelCount": opaque_pixels,
        "paletteColorCount": palette_colors,
        "visualIndicators": {
            "hasBasicPaletteRange": palette_colors >= 4,
        },
        "contentBounds": list(bbox) if bbox else None,
        "visualGate": "pending" if admission == "candidate" else "not_applicable",
        "approvedForTraining": admission == "accepted" and technical_passed,
        "noteZh": "技术完整性通过不等于视觉质量通过。候选资产必须达到最终参考标准后才能转入正式训练集。",
    }
