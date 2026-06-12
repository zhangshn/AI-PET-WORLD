from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.inference import run_inference


def main() -> int:
    parser = ArgumentParser(description="Generate one AI-PET-WORLD image with a local checkpoint.")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = run_inference(
        checkpoint_path=args.checkpoint,
        dataset_root=args.dataset_root,
        sample_id=args.sample_id,
        output_path=args.output,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
