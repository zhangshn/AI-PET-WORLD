from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil


def main() -> int:
    parser = ArgumentParser(
        description="Prepare a small curriculum dataset from trusted world-scene samples."
    )
    parser.add_argument("--source-dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--sample-id", action="append", required=True)
    parser.add_argument("--stage-id", default="curriculum-dataset")
    args = parser.parse_args()

    sample_ids = dedupe(args.sample_id)
    if not sample_ids:
        raise ValueError("At least one --sample-id is required.")

    source_root = args.source_dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    target_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"
    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    target_root.mkdir(parents=True, exist_ok=True)

    copied: list[str] = []
    for sample_id in sample_ids:
        source_sample = source_root / sample_id
        if not source_sample.exists():
            raise FileNotFoundError(f"sample not found: {source_sample}")
        shutil.copytree(source_sample, target_root / sample_id)
        copied.append(sample_id)

    indexes = args.output_root / "indexes"
    indexes.mkdir(parents=True, exist_ok=True)
    write_json(indexes / "train.json", index_payload("train", copied))
    write_json(indexes / "validation.json", index_payload("validation", copied))

    manifest = {
        "schemaVersion": "ai-painter-curriculum-dataset-v1",
        "stageId": args.stage_id,
        "status": "completed",
        "purpose": "local_model_small_scope_generalization_curriculum",
        "sourceDatasetRoot": str(args.source_dataset_root.resolve()),
        "sampleIds": copied,
        "trainCount": len(copied),
        "validationCount": len(copied),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    write_json(args.output_root / "dataset-manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def index_payload(split: str, sample_ids: list[str]) -> dict[str, object]:
    return {
        "schemaVersion": "dataset-index-v1",
        "split": split,
        "sampleIds": sample_ids,
        "count": len(sample_ids),
    }


def dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def write_json(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    raise SystemExit(main())
