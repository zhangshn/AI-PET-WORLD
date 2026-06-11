from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.dataset import audit_dataset, build_dataset_indexes


def main() -> int:
    parser = ArgumentParser(description="Build deterministic train/validation indexes.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--validation-ratio", type=float, default=0.1)
    args = parser.parse_args()
    dataset_root = args.dataset_root.resolve()
    audit = audit_dataset(dataset_root)
    print(json.dumps(audit, ensure_ascii=False, indent=2))
    if audit["status"] != "passed":
        return 1
    summary = build_dataset_indexes(dataset_root, args.validation_ratio)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
