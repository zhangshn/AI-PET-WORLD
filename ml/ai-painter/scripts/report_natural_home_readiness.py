from __future__ import annotations

from argparse import ArgumentParser
import ast
import json
from pathlib import Path
from typing import Any

from multiscene_expansion_specs import EXPANSION_SCENES


ALLOWED_CHANNELS = [
    "grass",
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_trunk",
    "tree_crown",
    "rock",
    "walkable",
    "depth",
]

FORBIDDEN_CHANNELS = [
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
]


def main() -> int:
    parser = ArgumentParser(description="Audit whether source data is usable for the no-building natural home stage.")
    parser.add_argument("--source-root", type=Path, default=Path("data/ai-painter-datasets/natural-home/source-originals"))
    parser.add_argument("--legacy-source-root", type=Path, default=Path("data/ai-painter-datasets/source-originals"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-readiness"))
    parser.add_argument("--minimum-sources", type=int, default=12)
    args = parser.parse_args()

    args.output_root.mkdir(parents=True, exist_ok=True)
    source_samples = scan_natural_sources(args.source_root)
    eligible_sources = [item for item in source_samples if item["status"] == "eligible_source"]
    legacy_samples = scan_legacy_sources(args.legacy_source_root)
    legacy_blocked = [item for item in legacy_samples if item["status"] == "blocked"]

    report: dict[str, Any] = {
        "schemaVersion": "natural-home-readiness-v2",
        "stageId": "natural-home-v1-no-building",
        "titleZh": "纯世界玩家家园第一阶段",
        "goalZh": "先训练自然家园外部环境：草地、树木、石头、花草、水体、水岸和自然小径；不训练建筑、施工材料、人物或动物。",
        "canStartTraining": len(eligible_sources) >= args.minimum_sources,
        "minimumSources": args.minimum_sources,
        "naturalSourceRoot": str(args.source_root),
        "sourceSampleCount": len(source_samples),
        "eligibleSampleCount": len(eligible_sources),
        "blockedSampleCount": len(source_samples) - len(eligible_sources),
        "legacySourceRoot": str(args.legacy_source_root),
        "legacySourceSampleCount": len(legacy_samples),
        "legacyBlockedSampleCount": len(legacy_blocked),
        "allowedChannels": ALLOWED_CHANNELS,
        "forbiddenChannels": FORBIDDEN_CHANNELS,
        "hardRulesZh": [
            "本阶段禁止建筑、房屋、施工地基、施工材料、人物、动物进入训练目标。",
            "现有带建筑的完整场景图不能直接用于本阶段训练。",
            "如果没有无建筑自然家园原图，本阶段必须先补充训练图，而不是用程序画图替代。",
            "道路和水体允许，但只能作为自然地貌的一部分，不能连接建筑。",
        ],
        "nextRequiredWorkZh": [
            "准备第一批无建筑自然家园训练 PNG，建议至少 12 张，目标 20 张。",
            "每张图只包含草地、树、石头、花草、水体、水岸和可选自然小径。",
            "导入后生成同源 Blueprint 与 14 通道 Mask，其中建筑和施工材料通道必须为空。",
            "数据闸门通过后，再启动本地模型训练。",
        ],
        "samples": source_samples,
        "legacyBlockedSamples": legacy_samples,
    }
    (args.output_root / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def scan_natural_sources(source_root: Path) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    if not source_root.is_dir():
        return samples
    for image_path in sorted(source_root.glob("*.png")):
        metadata_path = image_path.with_suffix(".source.json")
        metadata = read_json(metadata_path)
        blocked_reasons = []
        if metadata is None:
            blocked_reasons.append("source_metadata_missing")
        elif metadata.get("stageId") != "natural-home-v1-no-building":
            blocked_reasons.append("wrong_stage_id")
        elif metadata.get("declaredNoForbiddenContent") is not True:
            blocked_reasons.append("missing_no_forbidden_content_declaration")
        if metadata and (metadata.get("width") != 256 or metadata.get("height") != 192):
            blocked_reasons.append("source_size_must_be_256x192")
        samples.append({
            "sampleId": str(metadata.get("sampleId") if isinstance(metadata, dict) else image_path.stem),
            "status": "blocked_source" if blocked_reasons else "eligible_source",
            "sourcePng": str(image_path),
            "blockedReasons": blocked_reasons,
        })
    return samples


def scan_legacy_sources(legacy_source_root: Path) -> list[dict[str, Any]]:
    specs = load_preserved_specs(Path("ml/ai-painter/scripts/relabel_engineering_batch_01.py"))
    specs.update(EXPANSION_SCENES)
    samples = []
    for scene_id, spec in sorted(specs.items()):
        source_path = legacy_source_root / f"{scene_id}.png"
        blocked_reasons = []
        if not source_path.is_file():
            blocked_reasons.append("source_png_missing")
        if "shelter" in spec:
            blocked_reasons.append("contains_building_or_shelter")
        if spec.get("materials"):
            blocked_reasons.append("contains_construction_material")
        samples.append({
            "sampleId": scene_id,
            "status": "blocked" if blocked_reasons else "eligible",
            "sourcePng": str(source_path),
            "blockedReasons": blocked_reasons,
        })
    return samples


def load_preserved_specs(path: Path) -> dict[str, dict[str, object]]:
    text = path.read_text(encoding="utf-8")
    start = text.index("SCENES: dict[str, dict[str, object]] =")
    start = text.index("{", start)
    end = text.index("\n\n\nROOF_SCENES", start)
    value = ast.literal_eval(text[start:end])
    if not isinstance(value, dict) or len(value) < 2:
        raise ValueError("preserved scene specification is invalid")
    return value


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


if __name__ == "__main__":
    raise SystemExit(main())
