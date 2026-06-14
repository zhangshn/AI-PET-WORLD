from __future__ import annotations

import json
import shutil
from pathlib import Path

from ai_painter.dataset.hashing import sha256_file
from .contract import LABELS, SCHEMA_VERSION


def register_quality_sample(
    source_image: Path,
    dataset_root: Path,
    sample_id: str,
    category: str,
    quality_label: str,
    evidence_zh: list[str],
    source_asset_id: str,
    variation_kind: str,
    creation_method: str,
) -> Path:
    if quality_label not in LABELS:
        raise ValueError("quality_label 只能是 acceptable 或 unacceptable")
    if not source_image.is_file() or source_image.suffix.lower() != ".png":
        raise ValueError("VJ-B2 样本来源必须是 PNG 文件")
    if not sample_id or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for character in sample_id):
        raise ValueError("sample_id 只能包含小写字母、数字、连字符和下划线")
    if not evidence_zh or not all(item.strip() for item in evidence_zh):
        raise ValueError("必须提供明确的中文质量依据")
    if not all(value.strip() for value in (source_asset_id, variation_kind, creation_method)):
        raise ValueError("来源资产、变体类型和生成方式不能为空")
    sample_dir = dataset_root / "samples" / sample_id
    if sample_dir.exists():
        raise ValueError(f"VJ-B2 样本已存在：{sample_id}")
    sample_dir.mkdir(parents=True)
    target = sample_dir / "sprite.png"
    shutil.copyfile(source_image, target)
    label = {
        "schemaVersion": SCHEMA_VERSION,
        "sampleId": sample_id,
        "category": category,
        "qualityLabel": quality_label,
        "sourceKind": "self_owned_project_asset",
        "reviewBasis": "project_confirmed_visual_target",
        "imageSha256": sha256_file(target),
        "evidenceZh": evidence_zh,
        "lineage": {
            "sourceAssetId": source_asset_id,
            "variationKind": variation_kind,
            "creationMethod": creation_method,
        },
    }
    (sample_dir / "label.json").write_text(
        json.dumps(label, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return sample_dir
