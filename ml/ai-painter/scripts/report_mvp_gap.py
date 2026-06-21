from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
from typing import Any


REQUIRED_CHANNELS = [
    "grass",
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_trunk",
    "tree_crown",
    "rock",
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
    "walkable",
    "depth",
]

OFFICIAL_ASSET_CHANNELS = {
    "tree_trunk": "tree",
    "tree_crown": "tree",
    "grass": "grass",
    "water_body": "water",
    "shoreline": "shoreline",
    "road_center": "road",
    "road_edge": "road",
    "rock": "rock",
    "shelter_foundation": "building",
    "shelter_wall": "building",
    "shelter_roof": "building",
    "construction_material": "material",
}


def main() -> int:
    parser = ArgumentParser(description="Report MVP visual generation gaps for the local model training route.")
    parser.add_argument("--asset-root", type=Path, default=Path("data/ai-painter-assets/candidates"))
    parser.add_argument("--dataset-root", type=Path, default=Path(".runtime/ai-painter/multiscene-dataset"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/mvp-gap-report"))
    args = parser.parse_args()

    args.output_root.mkdir(parents=True, exist_ok=True)
    asset_summary = summarize_assets(args.asset_root)
    scene_count = count_scene_samples(args.dataset_root)

    channel_report = []
    for channel in REQUIRED_CHANNELS:
        family = OFFICIAL_ASSET_CHANNELS.get(channel)
        real_asset_count = asset_summary["byFamily"].get(family, 0) if family else 0
        if channel in {"walkable", "depth"}:
            status = "structure_only"
            reason = "该通道用于空间约束，不直接作为最终可见美术资产。"
        elif real_asset_count > 0:
            status = "asset_available"
            reason = f"已有 {real_asset_count} 个 {family} 候选资产，可进入后续质量审核与模型训练验证。"
        else:
            status = "missing_real_asset"
            reason = f"缺少 {family} 类型的项目自有高质量局部资产，必须补数据并继续训练本地模型，不能用程序画图替代。"
        channel_report.append({
            "channel": channel,
            "assetFamily": family,
            "status": status,
            "realAssetCount": real_asset_count,
            "reasonZh": reason,
        })

    missing = [item["channel"] for item in channel_report if item["status"] == "missing_real_asset"]
    report: dict[str, Any] = {
        "schemaVersion": "ai-painter-mvp-gap-report-v2",
        "status": "blocked_until_real_assets_and_model_quality_pass",
        "hardBoundaryZh": "本地训练训练的是 AI Painter 模型权重，不是训练程序画法；程序绘制、结构贴合、调试预览均不能替代模型生成图。",
        "sceneSamples": scene_count,
        "assetSummary": asset_summary,
        "removedProgramDrawingPath": {
            "canShowInWorld": False,
            "reviewStatus": "removed_from_formal_ai_painter_route",
            "reasonZh": "结构贴合、程序拼图和调试预览不属于正式 AI Painter 训练/推理路线，不能进入 /world，也不能作为 MVP 画面。",
        },
        "channels": channel_report,
        "missingRealAssetChannels": missing,
        "nextRequiredWorkZh": [
            "删除并禁用程序画图、结构贴合、调试预览路线。",
            "补齐道路、水岸、水体、建筑、石头、草地、施工材料的项目自有训练样本。",
            "用补齐后的数据重新训练本地模型，目标是完整世界位图，不是代码绘制画面。",
            "建立 VJ-1/VJ-2 质量审核，确认画面接近 MVP 参考质量后才能生成 ApprovedFrame。",
        ],
        "mvpCanShowInWorld": False,
    }
    (args.output_root / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def summarize_assets(asset_root: Path) -> dict[str, Any]:
    by_family: dict[str, int] = {}
    total = 0
    if asset_root.is_dir():
        for child in asset_root.iterdir():
            metadata_path = child / "metadata.json"
            sprite_path = child / "sprite.png"
            if not metadata_path.is_file() or not sprite_path.is_file():
                continue
            metadata = read_json(metadata_path) or {}
            family = str(metadata.get("category") or "unknown")
            quality = metadata.get("quality")
            if isinstance(quality, dict) and quality.get("technicalGate") != "passed":
                continue
            by_family[family] = by_family.get(family, 0) + 1
            total += 1
    return {"totalUsableAssets": total, "byFamily": by_family}


def count_scene_samples(dataset_root: Path) -> int:
    scene_root = dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    if not scene_root.is_dir():
        return 0
    return len([path for path in scene_root.iterdir() if path.is_dir()])


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


if __name__ == "__main__":
    raise SystemExit(main())
