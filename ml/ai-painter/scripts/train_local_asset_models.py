from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training.local_patch_trainer import train_local_patch


CATEGORIES = ("building", "tree", "road", "shoreline")


def main() -> int:
    parser = ArgumentParser(description="Train all local asset detail models.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    results = {}
    for category in CATEGORIES:
        print(f"TRAINING_LOCAL_ASSET={category}", flush=True)
        results[category] = train_local_patch(config, dataset_root=args.dataset_root / category, output_dir=args.output_root / category)
    (args.output_root / "training-summary.json").write_text(json.dumps({"status": "completed", "categories": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
