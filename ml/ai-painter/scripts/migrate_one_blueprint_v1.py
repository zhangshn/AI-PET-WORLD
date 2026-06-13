from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.dataset.migration_v1 import migrate_dataset_v1


def main() -> int:
    parser = ArgumentParser(description="Migrate one accepted v0 scene to a v1 Blueprint draft.")
    parser.add_argument("sample_id")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    result = migrate_dataset_v1(args.dataset_root.resolve(), [args.sample_id], force=args.force)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if result["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
