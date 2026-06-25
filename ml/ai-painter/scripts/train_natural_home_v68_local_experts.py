from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training.local_patch_trainer import train_local_patch


MVP_LOCAL_EXPERTS = (
    "grass_ground",
    "road_path",
    "water_shoreline",
    "tree_bush",
    "rock_terrain",
    "open_ground",
)

FOCUS_LOSS_CHANNELS = {
    "grass_ground": ["grass", "walkable"],
    "road_path": ["road_center", "road_edge"],
    "water_shoreline": ["water_body", "shoreline"],
    "tree_bush": ["tree_trunk", "tree_crown"],
    "rock_terrain": ["rock"],
    "open_ground": ["grass", "walkable", "depth"],
}


def main() -> int:
    parser = ArgumentParser(description="Train MVP natural-home local expert models.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--stage", default="v68")
    args = parser.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    results = {}
    for category in MVP_LOCAL_EXPERTS:
        print(f"TRAINING_NATURAL_HOME_LOCAL_EXPERT_{args.stage.upper()}={category}", flush=True)
        category_config = {
            **config,
            "trainingVersion": f"{config.get('trainingVersion', 'training-v68-local-expert')}-{category}",
            "modelVersion": f"{config.get('modelVersion', 'local-expert-v68')}-{category}",
            "focusLossChannels": FOCUS_LOSS_CHANNELS[category],
        }
        results[category] = train_local_patch(
            category_config,
            dataset_root=args.dataset_root / category,
            output_dir=args.output_root / category,
        )
    summary = {
        "schemaVersion": f"natural-home-{args.stage}-local-expert-training-summary-v1",
        "status": "completed",
        "stage": args.stage,
        "mvpScope": "natural_home_without_construction_or_buildings",
        "categories": results,
    }
    args.output_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "training-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
