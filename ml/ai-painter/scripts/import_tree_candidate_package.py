from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from ai_painter.assets import build_layered_asset, judge_single_asset


PACKAGE_ASSET_ROOT = Path("data/ai-painter-quality/vj-b2/pending-tree-review")


def main() -> None:
    parser = argparse.ArgumentParser(description="将树木候选包安全导入项目候选资产目录。")
    parser.add_argument("package_root", type=Path)
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("data/ai-painter-assets/candidates"),
    )
    args = parser.parse_args()
    report = import_candidate_package(args.package_root.resolve(), args.output_root.resolve())
    print(json.dumps(report, ensure_ascii=False, indent=2))


def import_candidate_package(package_root: Path, output_root: Path) -> dict[str, object]:
    index_path = package_root / "index.json"
    if not index_path.is_file():
        raise ValueError(f"候选包缺少 index.json：{package_root}")
    index = json.loads(index_path.read_text(encoding="utf-8"))
    if index.get("admission") != "candidate" or index.get("trainable") is not False:
        raise ValueError("只允许导入 admission=candidate 且 trainable=false 的候选包")

    assets = index.get("assets")
    if not isinstance(assets, list) or not assets:
        raise ValueError("候选包没有可导入资产")
    if index.get("count") != len(assets):
        raise ValueError("候选包 count 与 assets 数量不一致")

    package_assets = package_root / PACKAGE_ASSET_ROOT
    asset_ids = [_validate_asset_record(record) for record in assets]
    duplicates = [asset_id for asset_id in asset_ids if (output_root / asset_id).exists()]
    if duplicates:
        raise ValueError("以下候选资产已存在，导入已中止且不会覆盖：" + ", ".join(duplicates))

    output_root.mkdir(parents=True, exist_ok=True)
    imported: list[dict[str, object]] = []
    created: list[Path] = []
    try:
        for asset_id in asset_ids:
            source_root = package_assets / asset_id / "source"
            manifest_path = source_root / "manifest.json"
            if not manifest_path.is_file():
                raise ValueError(f"候选资产缺少源清单：{asset_id}")
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if manifest.get("assetId") != asset_id or manifest.get("admission") != "candidate":
                raise ValueError(f"候选资产清单身份或 admission 无效：{asset_id}")

            metadata = build_layered_asset(manifest_path, output_root)
            created.append(output_root / asset_id)
            review = judge_single_asset(output_root / asset_id)
            if review["status"] != "passed" or review["vjB"]["status"] != "passed":
                raise ValueError(f"候选资产未通过项目真实 VJ-A/VJ-B1：{asset_id}")
            imported.append({
                "assetId": asset_id,
                "admission": metadata["admission"],
                "trainable": metadata["trainable"],
                "vjA": review["status"],
                "vjB1": review["vjB"]["status"],
                "vjB2": review["vjB"]["vjB2LearnedJudgeStatus"],
            })
    except Exception:
        for path in reversed(created):
            shutil.rmtree(path, ignore_errors=True)
        raise

    return {
        "importedCount": len(imported),
        "outputRoot": str(output_root),
        "trainableCount": sum(bool(item["trainable"]) for item in imported),
        "status": "candidate_import_complete",
        "assets": imported,
    }


def _validate_asset_record(record: object) -> str:
    if not isinstance(record, dict):
        raise ValueError("候选资产索引记录格式无效")
    asset_id = record.get("assetId")
    if not isinstance(asset_id, str) or not asset_id:
        raise ValueError("候选资产缺少 assetId")
    if record.get("admission") != "candidate" or record.get("trainable") is not False:
        raise ValueError(f"候选资产状态无效：{asset_id}")
    if record.get("vj_a_passed") is not True or record.get("vj_b1_passed") is not True:
        raise ValueError(f"候选资产尚未通过技术审核：{asset_id}")
    if record.get("vj_b2_status") != "not_reviewed":
        raise ValueError(f"候选资产 VJ-B2 状态异常：{asset_id}")
    return asset_id


if __name__ == "__main__":
    main()
