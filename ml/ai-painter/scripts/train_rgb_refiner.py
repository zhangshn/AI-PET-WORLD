from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training.rgb_refiner_trainer import train_rgb_refiner


def main() -> int:
    parser = ArgumentParser(description="Train the local RGB detail refiner.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--structure-checkpoint", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--max-epochs", type=int)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    result = train_rgb_refiner(config, dataset_root=args.dataset_root, structure_checkpoint=args.structure_checkpoint, output_dir=args.output_dir, max_epochs=args.max_epochs)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
