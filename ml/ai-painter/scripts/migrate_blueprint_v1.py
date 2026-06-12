from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.dataset.migration_v1 import migrate_dataset_v1


def main() -> int:
    parser = ArgumentParser(description="Migrate accepted v0 scenes to Condition Blueprint v1 drafts.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    args = parser.parse_args()
    result = migrate_dataset_v1(args.dataset_root)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
