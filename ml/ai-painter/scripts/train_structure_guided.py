from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.training.structure_guided_trainer import train_structure_guided


def main() -> int:
    parser = ArgumentParser(description="Train the local structure-guided AI Painter model.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--max-epochs", type=int)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    result = train_structure_guided(config, dataset_root=args.dataset_root, output_dir=args.output_dir, max_epochs=args.max_epochs)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
