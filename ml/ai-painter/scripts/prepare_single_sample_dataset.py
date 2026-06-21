from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil
from datetime import datetime, timezone


def main() -> int:
    parser = ArgumentParser(description="Prepare a single-sample overfit dataset for local model capability checks.")
    parser.add_argument("--source-dataset-root", type=Path, required=True)
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    source_sample = args.source_dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / args.sample_id
    if not source_sample.exists():
        raise FileNotFoundError(f"sample not found: {source_sample}")

    target_sample = args.output_root / "accepted" / "dataset_v0" / "scene" / "world" / args.sample_id
    if target_sample.exists():
        shutil.rmtree(target_sample)
    target_sample.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source_sample, target_sample)

    indexes = args.output_root / "indexes"
    indexes.mkdir(parents=True, exist_ok=True)
    for split in ("train", "validation"):
        write_json(indexes / f"{split}.json", {
            "schemaVersion": "dataset-index-v1",
            "split": split,
            "sampleIds": [args.sample_id],
        })

    manifest = {
        "schemaVersion": "single-sample-overfit-dataset-v1",
        "status": "completed",
        "purpose": "local_model_capability_check_only",
        "sourceDatasetRoot": str(args.source_dataset_root.resolve()),
        "sampleId": args.sample_id,
        "trainCount": 1,
        "validationCount": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    write_json(args.output_root / "dataset-manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def write_json(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
