from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ai_painter.dataset.hashing import sha256_file


SCHEMA_VERSION = "vj-b2-quality-sample-v1"
LABELS = {"acceptable", "unacceptable"}


def read_quality_sample(sample_dir: Path) -> dict[str, Any]:
    label_path = sample_dir / "label.json"
    image_path = sample_dir / "sprite.png"
    if not label_path.is_file() or not image_path.is_file():
        raise ValueError("VJ-B2 样本必须包含 label.json 和 sprite.png")
    value = json.loads(label_path.read_text(encoding="utf-8"))
    if value.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError("VJ-B2 样本协议版本无效")
    if value.get("sampleId") != sample_dir.name:
        raise ValueError("sampleId 必须与目录名一致")
    if value.get("qualityLabel") not in LABELS:
        raise ValueError("qualityLabel 只能是 acceptable 或 unacceptable")
    if not isinstance(value.get("category"), str) or not value["category"].strip():
        raise ValueError("category 不能为空")
    if value.get("sourceKind") != "self_owned_project_asset":
        raise ValueError("VJ-B2 只接受项目自有资产")
    lineage = value.get("lineage")
    if not isinstance(lineage, dict):
        raise ValueError("VJ-B2 样本必须包含 lineage 来源谱系")
    for field in ("sourceAssetId", "variationKind", "creationMethod"):
        if not isinstance(lineage.get(field), str) or not lineage[field].strip():
            raise ValueError(f"lineage.{field} 不能为空")
    evidence = value.get("evidenceZh")
    if not isinstance(evidence, list) or not evidence or not all(isinstance(item, str) and item.strip() for item in evidence):
        raise ValueError("evidenceZh 必须包含明确质量依据")
    actual_hash = sha256_file(image_path)
    if value.get("imageSha256") != actual_hash:
        raise ValueError("sprite.png 与 label.json 哈希不一致")
    return value
