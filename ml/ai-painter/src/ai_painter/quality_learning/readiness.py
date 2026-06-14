from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from .contract import read_quality_sample
from PIL import Image


MINIMUM_PER_LABEL = 40


def inspect_quality_dataset(root: Path) -> dict[str, Any]:
    samples_root = root / "samples"
    counts: Counter[str] = Counter()
    valid_samples: list[str] = []
    errors: list[dict[str, str]] = []
    hashes: dict[str, str] = {}
    perceptual: list[tuple[str, int]] = []
    source_counts: Counter[str] = Counter()
    if samples_root.is_dir():
        for sample_dir in sorted(path for path in samples_root.iterdir() if path.is_dir()):
            try:
                value = read_quality_sample(sample_dir)
                image_hash = value["imageSha256"]
                if image_hash in hashes:
                    raise ValueError(f"图片与样本 {hashes[image_hash]} 完全重复")
                visual_hash = _difference_hash(sample_dir / "sprite.png")
                near = next((sample_id for sample_id, known in perceptual if _hamming(visual_hash, known) <= 3), None)
                if near:
                    raise ValueError(f"图片与样本 {near} 近似重复")
                source_asset_id = value["lineage"]["sourceAssetId"]
                source_counts[source_asset_id] += 1
                hashes[image_hash] = value["sampleId"]
                perceptual.append((value["sampleId"], visual_hash))
                counts[value["qualityLabel"]] += 1
                valid_samples.append(value["sampleId"])
            except (OSError, ValueError) as error:
                errors.append({"sampleId": sample_dir.name, "reasonZh": str(error)})
    blockers = []
    for label in ("acceptable", "unacceptable"):
        missing = max(0, MINIMUM_PER_LABEL - counts[label])
        if missing:
            blockers.append(f"{label} 还缺少 {missing} 个可信样本")
    if errors:
        blockers.append(f"存在 {len(errors)} 个无效样本")
    overrepresented = {source: count for source, count in source_counts.items() if count > 8}
    if overrepresented:
        blockers.append("单一源资产变体超过 8 个，存在数据偏置")
    return {
        "schemaVersion": "vj-b2-readiness-v1",
        "ready": not blockers,
        "minimumPerLabel": MINIMUM_PER_LABEL,
        "counts": dict(counts),
        "validSampleIds": valid_samples,
        "errors": errors,
        "sourceAssetCounts": dict(source_counts),
        "overrepresentedSources": overrepresented,
        "blockersZh": blockers,
    }


def _difference_hash(path: Path) -> int:
    with Image.open(path) as source:
        image = source.convert("L").resize((9, 8), Image.Resampling.NEAREST)
    pixels = list(image.getdata())
    bits = 0
    for row in range(8):
        for column in range(8):
            bits = (bits << 1) | int(pixels[row * 9 + column] > pixels[row * 9 + column + 1])
    return bits


def _hamming(left: int, right: int) -> int:
    return (left ^ right).bit_count()
