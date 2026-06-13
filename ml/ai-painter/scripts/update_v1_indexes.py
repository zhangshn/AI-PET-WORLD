from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.dataset.v1_indexer import build_trainable_v1_indexes


def main() -> int:
    parser = ArgumentParser(description="Build deterministic train/validation indexes from trainable v1 samples only.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--validation-ratio", type=float, default=0.1)
    args = parser.parse_args()
    result = build_trainable_v1_indexes(args.dataset_root.resolve(), args.validation_ratio)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not result["blockers"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
