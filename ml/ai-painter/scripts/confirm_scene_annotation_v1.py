from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.dataset.v1_review import confirm_v1_sample


def main() -> int:
    parser = ArgumentParser(description="Confirm one reviewed v1 Blueprint draft.")
    parser.add_argument("sample_id")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--submission", type=Path, required=True)
    args = parser.parse_args()
    try:
        submission = json.loads(args.submission.read_text(encoding="utf-8"))
        result = confirm_v1_sample(args.dataset_root, args.sample_id, submission)
        print(json.dumps({"status": "reviewed", "sampleId": args.sample_id, "review": result}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "failed", "errors": [str(error)]}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
