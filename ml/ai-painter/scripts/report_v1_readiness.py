from argparse import ArgumentParser
import json
from pathlib import Path

from ai_painter.dataset.v1_readiness import build_v1_readiness_report


def main() -> int:
    parser = ArgumentParser(description="Build Condition Blueprint v1 training readiness report.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = build_v1_readiness_report(args.dataset_root)
    text = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0 if report["readyForFirstTraining"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
