from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.dataset.migration_v1 import migrate_dataset_v1


def main() -> int:
    parser = ArgumentParser(description="Migrate accepted v0 scenes to Condition Blueprint v1 drafts.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--sample-id", action="append", dest="sample_ids")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    result = migrate_dataset_v1(args.dataset_root.resolve(), args.sample_ids, force=args.force)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
