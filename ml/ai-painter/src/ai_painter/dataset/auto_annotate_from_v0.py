from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

from .auto_pipeline import run_auto_annotation_pipeline
from .layout import DatasetLayout


SOURCE_JSON_SUFFIX = ".source.json"


def auto_annotate_from_v0(dataset_root: Path, *, limit: int | None = None, force_sources: bool = False) -> dict[str, Any]:
    layout = DatasetLayout(dataset_root)
    layout.ensure()
    samples = sorted((layout.accepted / "scene" / "world").glob("*/target.png"))
    if limit is not None:
        samples = samples[:limit]
    results: list[dict[str, Any]] = []
    for target in samples:
        sample_id = target.parent.name
        try:
            source_path = _copy_source(layout, target, sample_id, force=force_sources)
            results.append(run_auto_annotation_pipeline(dataset_root, source_path.stem))
        except (OSError, ValueError, json.JSONDecodeError) as error:
            results.append({
                "sampleId": sample_id,
                "status": "failed",
                "trainingEligible": False,
                "error": str(error),
            })
    accepted = sum(1 for item in results if item.get("status") == "accepted")
    quarantined = sum(1 for item in results if item.get("status") == "quarantined")
    failed = sum(1 for item in results if item.get("status") == "failed")
    summary = {
        "schemaVersion": "module-d-auto-annotation-from-v0-report-v1",
        "source": "accepted/dataset_v0 target.png",
        "total": len(results),
        "accepted": accepted,
        "quarantined": quarantined,
        "failed": failed,
        "results": [_compact_result(item) for item in results],
    }
    report_path = layout.manifests / "module-d-auto-annotation-from-v0.json"
    report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return summary


def _copy_source(layout: DatasetLayout, target: Path, sample_id: str, *, force: bool) -> Path:
    source_path = layout.source_originals / f"{sample_id}.png"
    source_record = layout.source_originals / f"{sample_id}{SOURCE_JSON_SUFFIX}"
    if force or not source_path.is_file():
        source_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(target, source_path)
    if force or not source_record.is_file():
        source_record.write_text(
            json.dumps({"source": "local-dataset-v0-target-bootstrap", "license": "project-internal-training-source"}, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    return source_path


def _compact_result(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "sampleId": item.get("sampleId"),
        "status": item.get("status"),
        "trainingEligible": item.get("trainingEligible"),
        "judgeStatus": item.get("judge", {}).get("status") if isinstance(item.get("judge"), dict) else None,
        "judgeErrors": item.get("judge", {}).get("errors") if isinstance(item.get("judge"), dict) else item.get("repairAttempts", [])[-1].get("errors") if item.get("repairAttempts") else item.get("error"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="从 dataset_v0 的 target.png 批量生成模块 D 自动标注 dataset_v1。")
    parser.add_argument("--dataset-root", default="data/ai-painter-datasets")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force-sources", action="store_true")
    args = parser.parse_args()
    summary = auto_annotate_from_v0(Path(args.dataset_root), limit=args.limit, force_sources=args.force_sources)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
