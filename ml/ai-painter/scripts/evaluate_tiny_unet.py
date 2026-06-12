from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.inference import evaluate_checkpoint


def main() -> int:
    parser = ArgumentParser(description="Evaluate a local AI-PET-WORLD checkpoint.")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--split", choices=("train", "validation"), default="validation")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    result = evaluate_checkpoint(
        checkpoint_path=args.checkpoint, dataset_root=args.dataset_root,
        split=args.split, output_dir=args.output_dir,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
