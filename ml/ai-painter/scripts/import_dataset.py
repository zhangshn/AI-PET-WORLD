from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.dataset import import_sample


def main() -> int:
    parser = ArgumentParser(description="Import one staged AI-PET-WORLD training sample.")
    parser.add_argument("sample_id")
    parser.add_argument("--dataset-root", type=Path, required=True)
    args = parser.parse_args()
    result = import_sample(args.dataset_root.resolve(), args.sample_id)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") == "accepted" else 1


if __name__ == "__main__":
    raise SystemExit(main())
