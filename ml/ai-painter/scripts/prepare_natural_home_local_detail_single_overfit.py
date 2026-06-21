from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Prepare one-sample-per-category local detail overfit datasets.")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    result: dict[str, object] = {}
    for category in NATURAL_CATEGORIES:
        source_category_root = args.source_root / category
        validation_ids = json.loads((source_category_root / "validation.json").read_text(encoding="utf-8"))["sampleIds"]
        if not validation_ids:
            raise ValueError(f"missing validation sample for category: {category}")

        sample_id = validation_ids[0]
        source_sample = source_category_root / "samples" / sample_id
        target_category_root = args.output_root / category
        target_sample = target_category_root / "samples" / sample_id
        target_sample.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source_sample, target_sample)

        index = {"schemaVersion": "natural-home-local-single-overfit-index-v1", "sampleIds": [sample_id]}
        (target_category_root / "train.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (target_category_root / "validation.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        result[category] = {
            "sampleId": sample_id,
            "source": str(source_sample.resolve()),
            "target": str(target_sample.resolve()),
        }

    summary = {
        "schemaVersion": "natural-home-local-detail-single-overfit-dataset-v1",
        "status": "completed",
        "categoryCount": len(NATURAL_CATEGORIES),
        "categories": result,
        "note": "Diagnostic dataset only. Train and validation use the same sample to test model capacity, not generalization.",
    }
    (args.output_root / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
