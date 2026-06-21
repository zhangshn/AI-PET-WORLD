from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training.discrete_pixel_trainer import train_discrete_pixel_model


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Train discrete-palette local detail models for pure natural-home patches.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    results: dict[str, object] = {}
    for category in NATURAL_CATEGORIES:
        print(f"TRAINING_NATURAL_LOCAL_DISCRETE={category}", flush=True)
        results[category] = train_discrete_pixel_model(
            config,
            dataset_root=args.dataset_root / category,
            output_dir=args.output_root / category,
        )

    args.output_root.mkdir(parents=True, exist_ok=True)
    summary = {
        "schemaVersion": "natural-home-local-detail-discrete-training-v1",
        "status": "completed",
        "trainingVersion": "training-natural-home-local-details-v5-discrete",
        "modelVersion": "natural-home-local-detail-discrete-unet-v5",
        "categoryCount": len(NATURAL_CATEGORIES),
        "categories": results,
        "note": "Local diagnostic training only. This does not create an ApprovedFrame.",
    }
    (args.output_root / "training-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
