from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training.discrete_pixel_trainer import train_discrete_pixel_model


CATEGORIES = ("building", "tree", "road", "shoreline")


def main() -> int:
    parser = ArgumentParser(description="Train four category-specific discrete pixel classifiers.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    results = {}
    for category in CATEGORIES:
        print(f"TRAINING_DISCRETE_ASSET={category}", flush=True)
        results[category] = train_discrete_pixel_model(config, dataset_root=args.dataset_root / category, output_dir=args.output_root / category)
    args.output_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "training-summary.json").write_text(json.dumps({"status": "completed", "categories": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
