from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter.quality_learning import inspect_quality_dataset


def main() -> None:
    parser = argparse.ArgumentParser(description="检查 VJ-B2 学习型审核数据是否可训练。")
    parser.add_argument("--root", type=Path, default=Path("data/ai-painter-quality/vj-b2"))
    args = parser.parse_args()
    report = inspect_quality_dataset(args.root.resolve())
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["ready"] else 2)


if __name__ == "__main__":
    main()
