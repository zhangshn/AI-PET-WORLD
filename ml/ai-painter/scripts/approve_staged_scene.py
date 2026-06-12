from argparse import ArgumentParser
from datetime import date
import json
from pathlib import Path

from ai_painter.dataset import build_dataset_indexes, import_sample


def main() -> int:
    parser = ArgumentParser(description="Approve and import one staged AI-PET-WORLD scene.")
    parser.add_argument("sample_id")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--reviewer", default="project-owner")
    args = parser.parse_args()
    root = args.dataset_root.resolve()
    metadata_path = root / "incoming" / args.sample_id / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    today = date.today().isoformat()
    metadata["source"]["humanApproved"] = True
    metadata["review"] = {
        "reviewer": args.reviewer,
        "reviewedAt": today,
        "rightsApproved": True,
        "blueprintApproved": True,
        "visualQualityApproved": True,
    }
    temporary = metadata_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(metadata_path)
    result = import_sample(root, args.sample_id)
    if result.get("status") == "accepted":
        result["indexes"] = build_dataset_indexes(root, 0.1)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") == "accepted" else 1


if __name__ == "__main__":
    raise SystemExit(main())
