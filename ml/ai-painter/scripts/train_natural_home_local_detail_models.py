from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training.local_patch_trainer import train_local_patch


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Train pure natural-home local detail models.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--only-category", choices=NATURAL_CATEGORIES)
    args = parser.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    results: dict[str, object] = read_existing_results(args.output_root) if args.only_category else {}
    categories = (args.only_category,) if args.only_category else NATURAL_CATEGORIES
    for category in categories:
        category_root = args.dataset_root / category
        if not category_root.exists():
            results[category] = {"status": "skipped", "reason": "missing category dataset"}
            continue
        print(f"TRAINING_NATURAL_HOME_LOCAL_DETAIL={category}", flush=True)
        results[category] = train_local_patch(config, dataset_root=category_root, output_dir=args.output_root / category)

    completed = [value for value in results.values() if isinstance(value, dict) and value.get("status") == "completed"]
    summary = {
        "schemaVersion": "natural-home-local-detail-training-summary-v1",
        "status": "completed",
        "stageId": "natural-home-v1-no-building-local-details",
        "trainingVersion": config.get("trainingVersion"),
        "modelVersion": config.get("modelVersion"),
        "epochs": config.get("maxEpochs"),
        "categoryCount": len(NATURAL_CATEGORIES),
        "trainSampleCount": sum(int(value.get("trainSampleCount", 0)) for value in completed),
        "validationSampleCount": sum(int(value.get("validationSampleCount", 0)) for value in completed),
        "bestValidationLoss": min((float(value.get("bestValidationLoss", 999.0)) for value in completed), default=None),
        "categories": results,
    }
    args.output_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "training-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def read_existing_results(output_root: Path) -> dict[str, object]:
    results: dict[str, object] = {}
    summary_path = output_root / "training-summary.json"
    if summary_path.exists():
      try:
          parsed = json.loads(summary_path.read_text(encoding="utf-8"))
          existing = parsed.get("categories")
          if isinstance(existing, dict):
              results.update(existing)
      except json.JSONDecodeError:
          pass
    for category in NATURAL_CATEGORIES:
        category_summary = output_root / category / "training-summary.json"
        if category_summary.exists() and category not in results:
            try:
                results[category] = json.loads(category_summary.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass
    return results


if __name__ == "__main__":
    raise SystemExit(main())
